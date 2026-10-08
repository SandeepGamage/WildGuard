const {
  CollarDevice,
  GeofenceZone,
  CollarAlert,
  CollarTelemetryLog,
  CameraTrapReview,
  Sequence,
} = require('../../models/mongo/schemas');
const { distanceM } = require('./village.mongo.repository');
const { ALERT_STATUS, BREACH_SEVERITY, ZONE_TYPE } = require('../../constants/domain');

const SEED_RESPONDERS = Object.freeze([
  {
    id: 'RESP-01',
    name: 'R. M. Bandara',
    role: 'FIELD_RANGER',
    phone: '+94771234567',
    latitude: 6.241,
    longitude: 81.315,
    status: 'AVAILABLE',
  },
  {
    id: 'RESP-02',
    name: 'K. S. Perera',
    role: 'FIELD_RANGER',
    phone: '+94772345678',
    latitude: 6.302,
    longitude: 81.372,
    status: 'AVAILABLE',
  },
  {
    id: 'RESP-03',
    name: 'M. T. Fernando',
    role: 'COMMUNITY_LIAISON_OFFICER',
    phone: '+94773456789',
    latitude: 6.280,
    longitude: 81.290,
    status: 'AVAILABLE',
  },
  {
    id: 'RESP-04',
    name: 'D. M. Jayasinghe',
    role: 'FIELD_RANGER',
    phone: '+94774567890',
    latitude: 6.360,
    longitude: 81.395,
    status: 'AVAILABLE',
  },
]);

/**
 * Repository: MongoCollarRepository
 * Handles persistence for collars, risk zones, telemetry, dispatches, and boundary alerts.
 */
class MongoCollarRepository {
  async findNearby(latitude, longitude, radiusM) {
    const active = await CollarDevice.find({ is_active: true }).lean();
    const result = [];

    for (const collar of active) {
      const d = distanceM(collar.latitude, collar.longitude, latitude, longitude);
      if (d <= radiusM) {
        result.push({
          code: collar.code,
          name: collar.name,
          distanceM: Math.round(d),
          lastSeenAt: collar.last_seen_at ? collar.last_seen_at.toISOString() : new Date().toISOString(),
        });
      }
    }

    result.sort((a, b) => a.distanceM - b.distanceM);
    return result;
  }

  async listDevices() {
    return CollarDevice.find({ is_active: true }).sort({ code: 1 }).lean();
  }

  async updateDeviceLocation(collarId, location, lastSeenAt) {
    await CollarDevice.updateOne(
      { code: collarId },
      {
        $set: {
          latitude: location.latitude,
          longitude: location.longitude,
          location: { type: 'Point', coordinates: [location.longitude, location.latitude] },
          last_seen_at: lastSeenAt || new Date(),
          signal_lost: false,
        },
      },
      { upsert: false },
    );
  }

  async setSignalLost(collarId, isLost = true) {
    await CollarDevice.updateOne(
      { code: collarId },
      { $set: { signal_lost: isLost } }
    );
    return CollarDevice.findOne({ code: collarId }).lean();
  }

  async listGeofenceZones() {
    let zones = await GeofenceZone.find({}).lean();
    if (!zones || zones.length === 0) {
      zones = [
        {
          id: 'ZONE-FARMLAND-01',
          name: 'Palatupana Farmland & Paddy Perimeter',
          type: ZONE_TYPE.FARMLAND,
          centre_lat: 6.2994,
          centre_lng: 81.3703,
          radius_metres: 3000,
          approach_buffer_metres: 500,
          severity: BREACH_SEVERITY.CRITICAL,
          nearest_settlement: 'Palatupana Village',
        },
        {
          id: 'ZONE-VILLAGE-02',
          name: 'Kirinda Coastal Settlement Zone',
          type: ZONE_TYPE.VILLAGE,
          centre_lat: 6.2386,
          centre_lng: 81.3138,
          radius_metres: 2500,
          approach_buffer_metres: 500,
          severity: BREACH_SEVERITY.CRITICAL,
          nearest_settlement: 'Kirinda Village',
        },
        {
          id: 'ZONE-ROAD-03',
          name: 'B399 Tissamaharama Highway Transit',
          type: ZONE_TYPE.ROAD,
          centre_lat: 6.355,
          centre_lng: 81.392,
          radius_metres: 2000,
          approach_buffer_metres: 500,
          severity: BREACH_SEVERITY.CRITICAL,
          nearest_settlement: 'Yodakandiya Farm Borders',
        },
        {
          id: 'ZONE-RAILWAY-04',
          name: 'Southern Railway Track Buffer',
          type: ZONE_TYPE.RAILWAY,
          centre_lat: 6.2836,
          centre_lng: 81.2889,
          radius_metres: 1800,
          approach_buffer_metres: 500,
          severity: BREACH_SEVERITY.CRITICAL,
          nearest_settlement: 'Tissa Township',
        },
      ];
      await GeofenceZone.insertMany(zones);
    }
    return zones;
  }

  async listAvailableResponders() {
    return SEED_RESPONDERS;
  }

  async findActiveAlertByCollar(collarId) {
    return CollarAlert.findOne({
      collar_id: collarId,
      status: {
        $in: [
          ALERT_STATUS.RAISED,
          ALERT_STATUS.VILLAGE_SMS_SENT,
          ALERT_STATUS.DISPATCHED,
          ALERT_STATUS.ACKNOWLEDGED,
          ALERT_STATUS.ESCALATED,
          ALERT_STATUS.ACTIVE,
        ],
      },
    }).lean();
  }

  async findAlertById(alertId) {
    return CollarAlert.findOne({ id: alertId }).lean();
  }

  async findAlertByReference(alertReference) {
    return CollarAlert.findOne({ alert_reference: alertReference }).lean();
  }

  async generateAlertReference() {
    const seq = await Sequence.findOneAndUpdate(
      { name: 'collar_alert_ref' },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const num = seq ? seq.seq : Math.floor(1000 + Math.random() * 9000);
    return `ALT-${String(num).padStart(4, '0')}`;
  }

  async createAlert(alertData) {
    const initialTimeline = alertData.statusTimeline || [
      {
        status: alertData.status || ALERT_STATUS.RAISED,
        timestamp: alertData.triggeredAt || new Date(),
        details: `Alert initialized: ${alertData.animalLabel} entered ${alertData.zoneName}`,
        actor: 'HazardMonitoringController',
      },
    ];

    const doc = await CollarAlert.create({
      id: alertData.id,
      alert_reference: alertData.alertReference,
      collar_id: alertData.collarId,
      animal_label: alertData.animalLabel,
      latitude: alertData.latitude,
      longitude: alertData.longitude,
      zone_id: alertData.zoneId,
      zone_name: alertData.zoneName,
      severity: alertData.severity,
      proximity: alertData.proximity || 'INSIDE',
      status: alertData.status || ALERT_STATUS.RAISED,
      status_timeline: initialTimeline,
      dispatch: alertData.dispatch || null,
      village_sms: alertData.villageSms || null,
      triggered_at: alertData.triggeredAt || new Date(),
    });
    return doc.toObject();
  }

  async updateAlertLocation(alertId, updateData) {
    const doc = await CollarAlert.findOneAndUpdate(
      { id: alertId },
      {
        $set: {
          latitude: updateData.latitude,
          longitude: updateData.longitude,
          zone_id: updateData.zoneId,
          zone_name: updateData.zoneName,
          severity: updateData.severity,
          triggered_at: updateData.triggeredAt,
        },
      },
      { new: true },
    ).lean();
    return doc;
  }

  async updateAlertStatus(alertId, statusData) {
    const update = {
      $set: {
        status: statusData.status,
        response_action: statusData.responseAction,
        officer_id: statusData.officerId,
        officer_notes: statusData.officerNotes,
        dispatched_ranger_id: statusData.dispatchedRangerId,
        acknowledged_at: statusData.acknowledgedAt,
        resolved_at: statusData.resolvedAt,
        resolution_reason: statusData.resolutionReason,
      },
    };

    if (statusData.timelineEntry) {
      update.$push = { status_timeline: statusData.timelineEntry };
    }
    if (statusData.dispatch) {
      update.$set.dispatch = statusData.dispatch;
    }
    if (statusData.villageSms) {
      update.$set.village_sms = statusData.villageSms;
    }

    const doc = await CollarAlert.findOneAndUpdate({ id: alertId }, update, { new: true }).lean();
    return doc;
  }

  async listAlertsByStatuses(statuses) {
    return CollarAlert.find({ status: { $in: statuses } })
      .sort({ triggered_at: -1 })
      .lean();
  }

  async listAuditTrail({ collarId, limit = 50 } = {}) {
    const query = collarId ? { collar_id: collarId } : {};
    return CollarAlert.find(query).sort({ triggered_at: -1 }).limit(limit).lean();
  }

  async recordTelemetryLog(logData) {
    await CollarTelemetryLog.create({
      collar_id: logData.collarId,
      latitude: logData.latitude,
      longitude: logData.longitude,
      recorded_at: logData.recordedAt || new Date(),
      is_delayed: Boolean(logData.isDelayed),
    });
  }

  // Camera Trap Review Storage
  async createCameraTrapReview(data) {
    const doc = await CameraTrapReview.create({
      id: data.id,
      trap_id: data.trapId,
      image_url: data.imageUrl,
      ai_species: data.aiSpecies,
      ai_confidence: data.aiConfidence,
      ai_threat: Boolean(data.aiThreat),
      status: data.status || 'PENDING_REVIEW',
      latitude: data.latitude,
      longitude: data.longitude,
      created_at: new Date(),
    });
    return doc.toObject();
  }

  async listPendingCameraTrapReviews() {
    return CameraTrapReview.find({ status: 'PENDING_REVIEW' }).sort({ created_at: -1 }).lean();
  }

  async findCameraTrapReviewById(id) {
    return CameraTrapReview.findOne({ id }).lean();
  }

  async updateCameraTrapReview(id, data) {
    const doc = await CameraTrapReview.findOneAndUpdate(
      { id },
      {
        $set: {
          status: data.status,
          reviewed_by: data.reviewedBy,
          reviewed_at: data.reviewedAt || new Date(),
        },
      },
      { new: true },
    ).lean();
    return doc;
  }
}

/**
 * Concrete AlertDataSource reading from CollarAlert collection for UC4 analytics.
 */
class MongoAlertDataSource {
  async listAlerts(filter) {
    const query = {};
    if (filter && filter.dateFrom && filter.dateTo) {
      query.triggered_at = { $gte: filter.dateFrom, $lt: filter.dateTo };
    }
    const alerts = await CollarAlert.find(query).lean();
    return alerts.map((a) => ({
      occurredAt: a.triggered_at,
      latitude: a.latitude,
      longitude: a.longitude,
      severity: a.severity,
    }));
  }
}

module.exports = { MongoCollarRepository, MongoAlertDataSource, SEED_RESPONDERS };
