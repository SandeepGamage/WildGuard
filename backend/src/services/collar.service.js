const crypto = require('crypto');
const { ALERT_STATUS, BREACH_SEVERITY, RESPONSE_ACTION, NOTIFICATION_TYPES } = require('../constants/domain');
const { GeofenceEngine, SEVERITY_WEIGHT } = require('./geofenceEngine');

/**
 * Service: CollarService (UC2: Manage Wildlife Collar Boundary Alerts)
 * Implemented for Hanaan M F A S (IT23594586).
 */
class CollarService {
  /**
   * @param {object} deps
   * @param {object} deps.collarRepository
   * @param {object} [deps.notificationService]
   * @param {object} [deps.logger]
   * @param {() => Date} [deps.clock]
   */
  constructor({ collarRepository, notificationService, logger, clock } = {}) {
    this.collarRepository = collarRepository;
    this.notificationService = notificationService || null;
    this.logger = logger || console;
    this.clock = clock || (() => new Date());
    this.geofenceEngine = new GeofenceEngine();
  }

  /**
   * Main Flow & Alternate Flow A: Ingest single collar telemetry reading.
   * Evaluates against virtual geofences.
   *
   * @param {object} reading
   * @param {string} reading.collarId
   * @param {string} [reading.animalLabel]
   * @param {number} reading.latitude
   * @param {number} reading.longitude
   * @param {Date|string} [reading.recordedAt]
   * @param {boolean} [reading.isDelayed]
   */
  async ingestReading(reading) {
    const recordedAt = reading.recordedAt ? new Date(reading.recordedAt) : this.clock();
    const isDelayed = Boolean(reading.isDelayed);
    const location = { latitude: reading.latitude, longitude: reading.longitude };

    // 1. Update collar device location in directory
    await this.collarRepository.updateDeviceLocation(reading.collarId, location, recordedAt);

    // 2. Fetch preconfigured high-risk virtual geofences
    const zones = await this.collarRepository.listGeofenceZones();

    // 3. Evaluate location against geofences using GeofenceEngine
    const evaluation = this.geofenceEngine.evaluate(location, zones);

    if (!evaluation.isBreach) {
      // Alternate Flow A: Animal Remains in Safe Zone
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
        message: 'Safe zone: animal coordinates logged silently without active warning.',
      };
    }

    // Main Flow Step 3 & 4: Boundary breach detected -> Instant Visual & Acoustic Critical Alert
    const zone = evaluation.breachedZone;
    const initialStatus = isDelayed ? ALERT_STATUS.DELAYED_INCIDENT : ALERT_STATUS.ACTIVE;

    // Check if there is an existing ACTIVE alert for this collar to avoid duplicates
    let alert = await this.collarRepository.findActiveAlertByCollar(reading.collarId);

    if (alert) {
      // Update existing alert with newest location
      alert = await this.collarRepository.updateAlertLocation(alert.id, {
        latitude: location.latitude,
        longitude: location.longitude,
        zoneId: zone.id,
        zoneName: zone.name,
        severity: zone.severity,
        triggeredAt: recordedAt,
      });
    } else {
      // Create new critical alert record
      const alertId = crypto.randomUUID();
      const reference = await this.collarRepository.generateAlertReference();
      alert = await this.collarRepository.createAlert({
        id: alertId,
        alertReference: reference,
        collarId: reading.collarId,
        animalLabel: reading.animalLabel || `Animal ${reading.collarId}`,
        latitude: location.latitude,
        longitude: location.longitude,
        zoneId: zone.id,
        zoneName: zone.name,
        severity: zone.severity || BREACH_SEVERITY.HIGH,
        status: initialStatus,
        triggeredAt: recordedAt,
      });
    }

    return {
      isBreach: true,
      alert,
      siren: !isDelayed,
      priority: zone.severity,
      distanceToCentreM: evaluation.distanceToCentreM,
      distanceToPerimeterM: evaluation.distanceToPerimeterM,
      message: isDelayed
        ? 'Delayed telemetry processed: retroactive boundary breach flagged as Delayed Incident.'
        : `CRITICAL ALERT: ${alert.animal_label} breached boundary of ${zone.name} (${zone.severity} threat).`,
    };
  }

  /**
   * Alternate Flow B: List active alerts prioritized by threat level and proximity.
   */
  async listActiveAlerts() {
    const alerts = await this.collarRepository.listAlertsByStatuses([
      ALERT_STATUS.ACTIVE,
      ALERT_STATUS.DELAYED_INCIDENT,
    ]);

    // Alternate Flow B: Prioritize based on severity (HIGH > MEDIUM > LOW) and recent trigger time
    alerts.sort((a, b) => {
      const weightA = SEVERITY_WEIGHT[a.severity] || 1;
      const weightB = SEVERITY_WEIGHT[b.severity] || 1;
      if (weightB !== weightA) return weightB - weightA;
      return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime();
    });

    return alerts;
  }

  /**
   * Main Flow Steps 8-11: Operations Officer reviews alert and selects response action.
   *
   * @param {string} alertId
   * @param {object} actionDetails
   * @param {string} actionDetails.responseAction
   * @param {string} actionDetails.officerId
   * @param {string} [actionDetails.officerNotes]
   * @param {string} [actionDetails.dispatchedRangerId]
   */
  async acknowledgeAlert(alertId, { responseAction, officerId, officerNotes, dispatchedRangerId }) {
    const existing = await this.collarRepository.findAlertById(alertId);
    if (!existing) {
      throw new Error(`Alert ${alertId} not found.`);
    }

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

    const updated = await this.collarRepository.updateAlertStatus(alertId, {
      status: newStatus,
      responseAction,
      officerId,
      officerNotes: officerNotes || '',
      dispatchedRangerId: dispatchedRangerId || null,
      acknowledgedAt: now,
      resolvedAt: isResolved ? now : null,
    });

    // Main Flow Step 11: Automated dispatch notification to ranger mobile unit if dispatched
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

  /**
   * Alternate Flow C: Manual Override / Mark as False Alarm.
   */
  async markFalseAlarm(alertId, { officerId, notes }) {
    return this.acknowledgeAlert(alertId, {
      responseAction: RESPONSE_ACTION.MARK_FALSE_ALARM,
      officerId,
      officerNotes: notes || 'Stationary signal drift / false positive override',
    });
  }

  /**
   * Alternate Flow D: Delayed / Offline Batch Telemetry Processing.
   *
   * @param {Array<object>} readings
   */
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

  /**
   * Audit Trail: List all collar alerts & incidents.
   */
  async listAuditTrail({ collarId, limit = 50 } = {}) {
    return this.collarRepository.listAuditTrail({ collarId, limit });
  }

  /**
   * Directory: List configured geofence zones.
   */
  async listZones() {
    return this.collarRepository.listGeofenceZones();
  }

  /**
   * Directory: List active collar devices.
   */
  async listCollars() {
    return this.collarRepository.listDevices();
  }
}

module.exports = { CollarService };
