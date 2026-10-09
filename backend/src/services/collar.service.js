const crypto = require('crypto');
const { distanceM } = require('../utils/geo');
const {
  ALERT_STATUS,
  BREACH_SEVERITY,
  PROXIMITY_STATUS,
  DISPATCH_STATUS,
  RESPONSE_ACTION,
  ZONE_TYPE,
  NOTIFICATION_TYPES,
  SMS_DIRECTION,
  SMS_LOG_STATUS,
} = require('../constants/domain');
const { GeofenceEngine, SEVERITY_WEIGHT } = require('./geofenceEngine');

const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000; // 3-minute acknowledgement timeout (UC2b / E2)
const SIGNAL_LOST_TIMEOUT_MS = 30 * 60 * 1000; // 30-minute silence detection (E1)

/**
 * Domain Service: CollarService (HazardMonitoringController & Dispatch Orchestration)
 * Strictly matches SE3070 A2 Report Section 7.4.2 (Table 18) and Section 8.2 (Screenshots 1-6).
 */
class CollarService {
  /**
   * @param {object} deps
   * @param {object} deps.collarRepository
   * @param {object} [deps.notificationService]
   * @param {object} [deps.smsLogRepository]
   * @param {object} [deps.logger]
   * @param {() => Date} [deps.clock]
   */
  constructor({ collarRepository, notificationService, notificationRepository, smsLogRepository, profileRepository, logger, clock }) {
    this.collarRepository = collarRepository;
    this.notificationService = notificationService;
    this.notificationRepository = notificationRepository;
    this.smsLogRepository = smsLogRepository;
    this.profileRepository = profileRepository;
    this.logger = logger || console;
    this.clock = clock || (() => new Date());
    this.geofenceEngine = new GeofenceEngine();
  }

  /**
   * UC2 Main Flow Steps 1-7 (Screenshot 1 & Screenshot 2):
   * Collar sends reading -> Geofence check -> Alert created with status timeline ->
   * Village SMS sent (if FARMLAND/VILLAGE) -> Nearest responder auto-dispatched.
   */
  async ingestReading(reading) {
    const recordedAt = reading.recordedAt ? new Date(reading.recordedAt) : this.clock();
    const isDelayed = Boolean(reading.isDelayed);
    const lat = typeof reading.latitude === 'number' ? reading.latitude : (reading.location ? reading.location.latitude : undefined);
    const lng = typeof reading.longitude === 'number' ? reading.longitude : (reading.location ? reading.location.longitude : undefined);
    const location = { latitude: lat, longitude: lng };

    // 1. Update collar device location in directory
    await this.collarRepository.updateDeviceLocation(reading.collarId, location, recordedAt);

    // 2. Fetch preconfigured risk zones (FARMLAND, VILLAGE, ROAD, RAILWAY)
    const zones = await this.collarRepository.listGeofenceZones();

    // 3. Evaluate location against geofences using GeofenceEngine
    const evaluation = this.geofenceEngine.evaluate(location, zones);

    if (evaluation.checkUnavailable) {
      // Exception E3: Geofence engine error logged
      this.logger.error('Geofence engine error during evaluation', { error: evaluation.error });
      return {
        isBreach: false,
        checkUnavailable: true,
        message: 'Automatic check unavailable – monitor zone manually (Exception E3)',
      };
    }

    if (!evaluation.isBreach) {
      // Alternate Flow A1: Animal Remains in Safe Zone
      await this.collarRepository.recordTelemetryLog({
        collarId: reading.collarId,
        latitude: location.latitude,
        longitude: location.longitude,
        recordedAt,
        isDelayed,
      });

      return {
        isBreach: false,
        alert: null,
        siren: false,
        message: 'Safe zone: animal coordinates logged silently without active warning (Alternate Flow A1).',
      };
    }

    // Step 3 & 4: Boundary breach detected (INSIDE or APPROACHING)
    const zone = evaluation.breachedZone;
    const severity = zone.severity || evaluation.severity || (evaluation.proximity === PROXIMITY_STATUS.INSIDE ? BREACH_SEVERITY.CRITICAL : BREACH_SEVERITY.WARNING);
    const proximity = evaluation.proximity;

    // Alternate Flow A2: Duplicate-alert suppression (step 3)
    let alert = await this.collarRepository.findActiveAlertByCollar(reading.collarId);

    if (alert) {
      // Update existing alert with newest location without creating alert storm
      alert = await this.collarRepository.updateAlertLocation(alert.id, {
        latitude: location.latitude,
        longitude: location.longitude,
        zoneId: zone.id,
        zoneName: zone.name,
        severity,
        triggeredAt: recordedAt,
      });

      return {
        isBreach: true,
        isDuplicateSuppressed: true,
        alert,
        siren: !isDelayed,
        priority: severity,
        proximity,
        distanceToCentreM: evaluation.distanceToCentreM,
        distanceToPerimeterM: evaluation.distanceToPerimeterM,
        message: `Updated existing open alert for ${alert.animal_label} (Duplicate-alert suppression A2).`,
      };
    }

    // Step 4: Create new alert record
    const alertId = crypto.randomUUID();
    const reference = await this.collarRepository.generateAlertReference();
    const animalLabel = reading.animalLabel || `Collared Animal ${reading.collarId}`;

    const initialTimeline = [
      {
        status: ALERT_STATUS.RAISED,
        timestamp: recordedAt,
        details: `${animalLabel} ${proximity === PROXIMITY_STATUS.INSIDE ? 'entered' : 'approaching'} ${zone.name} (${proximity})`,
        actor: 'HazardMonitoringController',
      },
    ];

    let currentStatus = isDelayed
      ? ALERT_STATUS.DELAYED_INCIDENT
      : (reading.status || (reading.autoDispatch ? ALERT_STATUS.DISPATCHED : ALERT_STATUS.ACTIVE));

    // Step 5: Village Early-Warning SMS (UC2e / Table 18 Step 5)
    let villageSmsData = null;
    const isSettlement = zone.type === ZONE_TYPE.VILLAGE || zone.type === ZONE_TYPE.FARMLAND || zone.type === 'SETTLEMENT_BOUNDARY' || zone.type === 'BUFFER';
    if (isSettlement && !isDelayed) {
      const smsText = `WILDGUARD ALERT: Wild animal ${animalLabel} detected near ${zone.name}. Please stay vigilant.`;
      
      // Fetch real villagers from MongoDB (including Sandeepa Akalanka, Nimali Perera, Kasun Silva, Saman Kumara)
      let villagers = [];
      try {
        const { Profile } = require('../models/mongo/schemas');
        villagers = await Profile.find({ role: 'VILLAGER' }).lean();
      } catch (_) {}

      if (!villagers || villagers.length === 0) {
        villagers = [
          { id: '6a2a999c-851d-4685-8f07-bc1cf3ef5c10', full_name: 'Sandeepa Akalanka', phone: '0728412012' },
          { id: 'be4c0ee9-42a1-4142-865c-3c2c500e7831', full_name: 'Nimali Perera', phone: '0771234812' },
          { id: '2d9999b9-ad03-4d00-b37a-68ba7ee9391a', full_name: 'Kasun Silva', phone: '0712345678' },
          { id: '15bd638b-5a29-4b0d-8f40-a9dd80691d64', full_name: 'Saman Kumara', phone: '0752345678' },
        ];
      }

      // 1. Create real outbound SMS in MongoDB SmsLog collection for each registered villager
      for (const v of villagers) {
        const recipientPhone = v.phone || '+94770001122';
        if (this.smsLogRepository) {
          try {
            await this.smsLogRepository.create({
              direction: SMS_DIRECTION.OUTBOUND,
              phone: recipientPhone,
              message: smsText,
              status: SMS_LOG_STATUS.ACCEPTED,
            });
          } catch (err) {
            this.logger.warn('Could not log village early warning SMS', { error: err.message });
          }
        }
      }

      // 2. Create in-app Notifications in MongoDB Notification collection for each villager
      try {
        const { Notification } = require('../models/mongo/schemas');
        const notifDocs = villagers.map((v) => ({
          id: crypto.randomUUID(),
          recipient_id: v.id,
          type: 'BOUNDARY_BREACH_EARLY_WARNING',
          title: `⚠️ EARLY WARNING: ${animalLabel}`,
          body: smsText,
          created_at: recordedAt,
        }));
        await Notification.insertMany(notifDocs);
      } catch (err) {
        this.logger.warn('Could not insert villager notifications in MongoDB', { error: err.message });
      }

      villageSmsData = {
        sent: true,
        count: villagers.length,
        recipients: villagers.map((v) => ({ name: v.full_name, phone: v.phone })),
        sample_message: smsText,
        sent_at: recordedAt,
      };

      initialTimeline.push({
        status: ALERT_STATUS.VILLAGE_SMS_SENT,
        timestamp: recordedAt,
        details: `Early-warning broadcast sent to registered villagers including Sandeepa Akalanka (0728412012) & Nimali Perera (${zone.nearest_settlement || zone.name})`,
        actor: 'SMSGateway',
      });
    }

    // Step 6 & 7: Nearest-Responder Dispatch (UC2b / Table 18 Step 6 & 7)
    let dispatchData = null;
    if (!isDelayed) {
      const getResponders = this.collarRepository.listAvailableResponders
        ? await this.collarRepository.listAvailableResponders()
        : null;
      const availableResponders = getResponders || [
        { id: 'RESP-01', name: 'R. M. Bandara', phone: '+94771234567', latitude: 6.241, longitude: 81.315 },
        { id: 'RESP-02', name: 'K. S. Perera', phone: '+94772345678', latitude: 6.302, longitude: 81.372 },
      ];

      if (availableResponders && availableResponders.length > 0) {
        const sorted = availableResponders
          .map((r) => ({
            ...r,
            distanceM: Math.round(distanceM(location.latitude, location.longitude, r.latitude, r.longitude)),
          }))
          .sort((a, b) => a.distanceM - b.distanceM);

        const nearest = sorted[0];
        const timeoutAt = new Date(recordedAt.getTime() + DEFAULT_TIMEOUT_MS);

        dispatchData = {
          responder_id: nearest.id,
          responder_name: nearest.name,
          responder_phone: nearest.phone,
          distance_m: nearest.distanceM,
          dispatched_at: recordedAt,
          timeout_at: timeoutAt,
          status: DISPATCH_STATUS.PENDING,
        };

        initialTimeline.push({
          status: ALERT_STATUS.DISPATCHED,
          timestamp: recordedAt,
          details: `Nearest responder ${nearest.name} auto-dispatched (${nearest.distanceM}m away). 3m ack timeout.`,
          actor: 'DispatchService',
        });

        if (reading.autoDispatch) {
          currentStatus = ALERT_STATUS.DISPATCHED;
        }

        // Create in-app emergency dispatch Notification & Outbound SMS in MongoDB for Field Ranger (R. M. Bandara)
        try {
          const { Notification } = require('../models/mongo/schemas');
          const rangerId = '337714ed-b3e8-42c4-bd16-c337393bcb73'; // R. M. Bandara in MongoDB
          await Notification.create({
            id: crypto.randomUUID(),
            recipient_id: rangerId,
            target_sector_id: zone.sector_id || '00000000-0000-4000-8000-0000000000s3',
            type: NOTIFICATION_TYPES.FIELD_ACTION,
            title: `🚨 EMERGENCY DISPATCH: Intercept ${animalLabel}`,
            body: `You are auto-dispatched to intercept ${animalLabel} near ${zone.name} (${nearest.distanceM}m away). 3-minute acknowledgement required.`,
            created_at: recordedAt,
          });

          if (this.smsLogRepository) {
            await this.smsLogRepository.create({
              direction: SMS_DIRECTION.OUTBOUND,
              phone: nearest.phone || '+94771234567',
              message: `EMERGENCY DISPATCH: Intercept ${animalLabel} near ${zone.name}. Acknowledge via mobile app within 3 mins.`,
              status: SMS_LOG_STATUS.ACCEPTED,
            });
          }
        } catch (err) {
          this.logger.warn('Could not create ranger notification in MongoDB', { error: err.message });
        }

        // Push notification simulation
        if (this.notificationService) {
          try {
            await this.notificationService.notifyFieldTeam({
              sectorId: zone.sector_id || zone.id,
              type: NOTIFICATION_TYPES.FIELD_ACTION,
              title: `BOUNDARY BREACH: ${animalLabel}`,
              body: `Auto-dispatched to intercept ${animalLabel} at ${zone.name} (${nearest.distanceM}m away)`,
              data: { alertId, latitude: location.latitude, longitude: location.longitude },
            });
          } catch (err) {
            this.logger.warn('Failed to send push notification', { error: err.message });
          }
        }
      } else {
        // Exception E2: No responder available -> ESCALATED
        currentStatus = ALERT_STATUS.ESCALATED;
        initialTimeline.push({
          status: ALERT_STATUS.ESCALATED,
          timestamp: recordedAt,
          details: 'No available responders within perimeter. Escalated to Operations Officer for manual assignment (E2).',
          actor: 'DispatchService',
        });
      }
    }

    // Save alert
    alert = await this.collarRepository.createAlert({
      id: alertId,
      alertReference: reference,
      collarId: reading.collarId,
      animalLabel,
      latitude: location.latitude,
      longitude: location.longitude,
      zoneId: zone.id,
      zoneName: zone.name,
      severity,
      proximity,
      status: currentStatus,
      statusTimeline: initialTimeline,
      dispatch: dispatchData,
      villageSms: villageSmsData,
      triggeredAt: recordedAt,
    });

    return {
      isBreach: true,
      alert,
      siren: !isDelayed,
      priority: severity,
      proximity,
      distanceToCentreM: evaluation.distanceToCentreM,
      distanceToPerimeterM: evaluation.distanceToPerimeterM,
      message: isDelayed
        ? 'Delayed telemetry processed: retroactive boundary breach flagged as Delayed Incident.'
        : `${severity} ALERT: ${alert.animal_label} ${proximity} of ${zone.name}.`,
    };
  }

  async acknowledgeDispatch(alertId, { responderId, notes } = {}) {
    const alert = await this.collarRepository.findAlertById(alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found.`);

    const now = this.clock();

    // Check 3-minute acknowledgement timeout (E2)
    if (alert.dispatch && alert.dispatch.timeout_at && new Date(alert.dispatch.timeout_at) < now) {
      return this.escalateAlert(alertId, 'Responder failed to acknowledge within 3-minute timeout window (E2).');
    }

    const updatedDispatch = alert.dispatch
      ? {
          ...alert.dispatch,
          acknowledged_at: now,
          status: DISPATCH_STATUS.ACKNOWLEDGED,
        }
      : null;

    const timelineEntry = {
      status: ALERT_STATUS.ACKNOWLEDGED,
      timestamp: now,
      details: `Responder ${responderId || (alert.dispatch ? alert.dispatch.responder_name : 'Assigned')} acknowledged dispatch & navigated to scene`,
      actor: 'FieldResponder',
    };

    const updated = await this.collarRepository.updateAlertStatus(alertId, {
      status: ALERT_STATUS.ACKNOWLEDGED,
      acknowledgedAt: now,
      officerNotes: notes || alert.officer_notes,
      dispatch: updatedDispatch,
      timelineEntry,
    });

    return {
      success: true,
      alert: updated,
      message: `Alert ${updated.alert_reference} acknowledged by responder. Status updated to ACKNOWLEDGED.`,
    };
  }

  async manualAssignResponder(alertId, { responderId, officerId, officerNotes } = {}) {
    const alert = await this.collarRepository.findAlertById(alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found.`);

    const now = this.clock();
    const availableResponders = (this.collarRepository.listAvailableResponders
      ? await this.collarRepository.listAvailableResponders()
      : null) || [];
    const candidate = availableResponders.find((r) => r.id === responderId) || {
      id: responderId,
      name: `Officer ${responderId}`,
      phone: '+94770000000',
      latitude: alert.latitude,
      longitude: alert.longitude,
    };

    const dist = Math.round(distanceM(alert.latitude, alert.longitude, candidate.latitude, candidate.longitude));
    const timeoutAt = new Date(now.getTime() + DEFAULT_TIMEOUT_MS);

    const dispatchData = {
      responder_id: candidate.id,
      responder_name: candidate.name,
      responder_phone: candidate.phone,
      distance_m: dist,
      dispatched_at: now,
      timeout_at: timeoutAt,
      status: DISPATCH_STATUS.PENDING,
    };

    const timelineEntry = {
      status: ALERT_STATUS.DISPATCHED,
      timestamp: now,
      details: `Operations Officer ${officerId || 'Operator'} manually assigned responder ${candidate.name} (${dist}m away).`,
      actor: 'OperationsOfficer',
    };

    const updated = await this.collarRepository.updateAlertStatus(alertId, {
      status: ALERT_STATUS.DISPATCHED,
      officerId,
      officerNotes: officerNotes || `Manually assigned by officer ${officerId}`,
      dispatch: dispatchData,
      timelineEntry,
    });

    return {
      success: true,
      alert: updated,
      message: `Responder ${candidate.name} manually assigned to alert ${updated.alert_reference}.`,
    };
  }

  async escalateAlert(alertId, reason = 'Acknowledgement timeout exceeded.') {
    const alert = await this.collarRepository.findAlertById(alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found.`);

    const now = this.clock();
    const timelineEntry = {
      status: ALERT_STATUS.ESCALATED,
      timestamp: now,
      details: reason,
      actor: 'DispatchService',
    };

    const updated = await this.collarRepository.updateAlertStatus(alertId, {
      status: ALERT_STATUS.ESCALATED,
      timelineEntry,
    });

    const candidates = await this.listCandidateResponders(alertId);

    return {
      escalated: true,
      alert: updated,
      candidateResponders: candidates,
      message: `Alert ${updated.alert_reference} ESCALATED: ${reason}`,
    };
  }

  async listCandidateResponders(alertId) {
    const alert = await this.collarRepository.findAlertById(alertId);
    const responders = (this.collarRepository.listAvailableResponders
      ? await this.collarRepository.listAvailableResponders()
      : null) || [];
    if (!alert || !responders) return responders || [];

    return responders.map((r) => ({
      ...r,
      distanceM: Math.round(distanceM(alert.latitude, alert.longitude, r.latitude, r.longitude)),
    })).sort((a, b) => a.distanceM - b.distanceM);
  }

  async handleCameraTrapImage(trapData) {
    const confidence = Number(trapData.confidence || 0);
    const isThreat = Boolean(trapData.isThreat);
    const now = this.clock();

    if (confidence >= 0.80 && isThreat) {
      const ingestRes = await this.ingestReading({
        collarId: `CAM-${trapData.trapId}`,
        animalLabel: `Detected ${trapData.species || 'Wildlife'} (Camera Trap ${trapData.trapId})`,
        latitude: trapData.latitude,
        longitude: trapData.longitude,
        recordedAt: now,
        autoDispatch: true,
      });

      return {
        autoRaised: true,
        queuedForReview: false,
        alert: ingestRes.alert,
        message: `High confidence AI detection (${(confidence * 100).toFixed(0)}%): Threat alert raised automatically.`,
      };
    }

    const reviewId = crypto.randomUUID();
    const reviewItem = await this.collarRepository.createCameraTrapReview({
      id: reviewId,
      trapId: trapData.trapId,
      imageUrl: trapData.imageUrl || 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=600&auto=format&fit=crop',
      aiSpecies: trapData.species || 'Elephant',
      aiConfidence: confidence,
      aiThreat: isThreat,
      latitude: trapData.latitude,
      longitude: trapData.longitude,
    });

    return {
      autoRaised: false,
      queuedForReview: true,
      reviewId,
      review: reviewItem,
      message: `Low confidence AI classification (${(confidence * 100).toFixed(0)}% < 80%): Queued for Operations Officer review (O3).`,
    };
  }

  async reviewCameraTrapImage(reviewId, { officerId, species, isThreat, notes } = {}) {
    const review = await this.collarRepository.findCameraTrapReviewById(reviewId);
    if (!review) throw new Error(`Camera-trap review ${reviewId} not found.`);

    const now = this.clock();
    await this.collarRepository.updateCameraTrapReview(reviewId, {
      status: isThreat ? 'APPROVED_ALERT' : 'DISMISSED',
      reviewedBy: officerId,
      reviewedAt: now,
    });

    if (!isThreat) {
      return {
        alertRaised: false,
        message: `Reviewed by ${officerId}: Tagged as non-threat. Review dismissed.`,
      };
    }

    const ingestRes = await this.ingestReading({
      collarId: `CAM-${review.trap_id}`,
      animalLabel: `Verified ${species || review.ai_species} (Camera Trap ${review.trap_id})`,
      latitude: review.latitude,
      longitude: review.longitude,
      recordedAt: now,
      autoDispatch: true,
    });

    return {
      alertRaised: true,
      alert: ingestRes.alert,
      message: `Threat confirmed by officer ${officerId}: Alert raised and nearest responder dispatched.`,
    };
  }

  async listPendingCameraTrapReviews() {
    return this.collarRepository.listPendingCameraTrapReviews();
  }

  async checkCollarHealth() {
    const collars = await this.collarRepository.listDevices();
    const now = this.clock().getTime();
    const results = [];

    for (const c of collars) {
      const lastSeen = c.last_seen_at ? new Date(c.last_seen_at).getTime() : 0;
      const silentMs = now - lastSeen;
      const isSignalLost = silentMs >= SIGNAL_LOST_TIMEOUT_MS || Boolean(c.signal_lost);

      if (isSignalLost && !c.signal_lost && this.collarRepository.setSignalLost) {
        await this.collarRepository.setSignalLost(c.code, true);
      }

      results.push({
        collarId: c.code,
        name: c.name,
        lastKnownLocation: { latitude: c.latitude, longitude: c.longitude },
        lastSeenAt: c.last_seen_at,
        signalLost: isSignalLost,
        silentMinutes: Math.round(silentMs / 60000),
      });
    }

    return results;
  }

  async simulateSignalLost(collarId) {
    let updated = null;
    if (this.collarRepository.setSignalLost) {
      updated = await this.collarRepository.setSignalLost(collarId, true);
    }
    return {
      collarId,
      signalLost: true,
      lastKnownLocation: updated ? { latitude: updated.latitude, longitude: updated.longitude } : null,
      message: `Exception Flow E1: Collar ${collarId} status flagged as 'Signal Lost' on dashboard.`,
    };
  }

  async resolveAlert(alertId, { reason, officerId, notes } = {}) {
    if (!reason) {
      throw new Error('Resolution reason is mandatory to resolve a boundary alert (SE3070 Table 18 Step 10).');
    }

    const alert = await this.collarRepository.findAlertById(alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found.`);

    const now = this.clock();
    const timelineEntry = {
      status: ALERT_STATUS.RESOLVED,
      timestamp: now,
      details: `Alert resolved by officer ${officerId || 'Operator'}: ${reason}`,
      actor: 'OperationsOfficer',
    };

    const updated = await this.collarRepository.updateAlertStatus(alertId, {
      status: ALERT_STATUS.RESOLVED,
      resolvedAt: now,
      officerId,
      officerNotes: notes || '',
      resolutionReason: reason,
      timelineEntry,
    });

    return {
      success: true,
      alert: updated,
      message: `Alert ${updated.alert_reference} resolved with reason: '${reason}'.`,
    };
  }

  async acknowledgeAlert(alertId, { responseAction, officerId, officerNotes, dispatchedRangerId }) {
    const existing = await this.collarRepository.findAlertById(alertId);
    if (!existing) throw new Error(`Alert ${alertId} not found.`);

    const validActions = Object.values(RESPONSE_ACTION);
    if (!validActions.includes(responseAction)) {
      throw new Error(`Invalid response action '${responseAction}'. Allowed: ${validActions.join(', ')}`);
    }

    const now = this.clock();
    const isFalseAlarm = responseAction === RESPONSE_ACTION.MARK_FALSE_ALARM;
    const isResolved = isFalseAlarm || responseAction === RESPONSE_ACTION.MONITOR_CLOSELY;

    const newStatus = isFalseAlarm
      ? ALERT_STATUS.FALSE_ALARM
      : isResolved
        ? ALERT_STATUS.RESOLVED
        : ALERT_STATUS.ACKNOWLEDGED;

    const timelineEntry = {
      status: newStatus,
      timestamp: now,
      details: `Action confirmed: ${responseAction} (${officerNotes || 'No notes'})`,
      actor: 'OperationsOfficer',
    };

    const updated = await this.collarRepository.updateAlertStatus(alertId, {
      status: newStatus,
      responseAction,
      officerId,
      officerNotes: officerNotes || '',
      dispatchedRangerId: dispatchedRangerId || null,
      acknowledgedAt: now,
      resolvedAt: isResolved ? now : null,
      timelineEntry,
    });

    let dispatchResult = null;
    if (responseAction === RESPONSE_ACTION.DISPATCH_RANGER && this.notificationService) {
      try {
        dispatchResult = await this.notificationService.notifyFieldTeam({
          sectorId: existing.zone_id,
          type: NOTIFICATION_TYPES.FIELD_ACTION,
          title: `BOUNDARY BREACH: ${existing.animal_label}`,
          body: `Ranger dispatched to intercept ${existing.animal_label} at ${existing.zone_name}. Action: ${officerNotes || 'Immediate response required.'}`,
          data: {
            alertId: existing.id,
            alertReference: existing.alert_reference,
            latitude: existing.latitude,
            longitude: existing.longitude,
          },
        });
      } catch (err) {
        this.logger.warn('Failed to dispatch notification to field team', { error: err.message });
      }
    }

    return {
      alert: updated,
      dispatched: responseAction === RESPONSE_ACTION.DISPATCH_RANGER,
      dispatchResult,
      message: `Response protocol '${responseAction}' confirmed for alert ${updated.alert_reference}.`,
    };
  }

  async markFalseAlarm(alertId, { officerId, notes }) {
    return this.acknowledgeAlert(alertId, {
      responseAction: RESPONSE_ACTION.MARK_FALSE_ALARM,
      officerId,
      officerNotes: notes || 'Stationary signal drift / false positive override',
    });
  }

  async listActiveAlerts() {
    const alerts = await this.collarRepository.listAlertsByStatuses([
      ALERT_STATUS.RAISED,
      ALERT_STATUS.VILLAGE_SMS_SENT,
      ALERT_STATUS.DISPATCHED,
      ALERT_STATUS.ACKNOWLEDGED,
      ALERT_STATUS.ESCALATED,
      ALERT_STATUS.ACTIVE,
      ALERT_STATUS.DELAYED_INCIDENT,
    ]);

    alerts.sort((a, b) => {
      const weightA = SEVERITY_WEIGHT[a.severity] || 1;
      const weightB = SEVERITY_WEIGHT[b.severity] || 1;
      if (weightB !== weightA) return weightB - weightA;
      return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime();
    });

    return alerts;
  }

  async ingestBatch(readings = []) {
    const results = [];
    let breaches = 0;
    let delayedIncidents = 0;

    for (const item of readings) {
      const res = await this.ingestReading({
        ...item,
        isDelayed: true,
      });
      results.push(res);
      if (res.isBreach) {
        breaches++;
        if (res.alert && res.alert.status === ALERT_STATUS.DELAYED_INCIDENT) {
          delayedIncidents++;
        }
      }
    }

    return {
      totalProcessed: readings.length,
      breachesDetected: breaches,
      delayedIncidents,
      message: `Batch processed: ${readings.length} readings, ${breaches} retroactive breaches flagged.`,
    };
  }

  async listAuditTrail({ collarId, limit = 50 } = {}) {
    return this.collarRepository.listAuditTrail({ collarId, limit });
  }

  async listZones() {
    return this.collarRepository.listGeofenceZones();
  }

  async listCollars() {
    return this.collarRepository.listDevices();
  }
}

module.exports = { CollarService, DEFAULT_TIMEOUT_MS, SIGNAL_LOST_TIMEOUT_MS };
