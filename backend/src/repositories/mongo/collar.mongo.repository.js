const {
  CollarDevice,
  GeofenceZone,
  CollarAlert,
  CollarTelemetryLog,
  Sequence,
} = require('../../models/mongo/schemas');
const { distanceM } = require('./village.mongo.repository');
const { ALERT_STATUS } = require('../../constants/domain');

/**
 * Repository: MongoCollarRepository
 * Handles persistence for collars, geofences, telemetry, and boundary breach alerts.
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
        },
      },
      { upsert: false },
    );
  }

  async listGeofenceZones() {
    let zones = await GeofenceZone.find({}).lean();
    if (!zones || zones.length === 0) {
      // Default initial seeds if none in DB
      zones = [
        {
          id: 'ZONE-NORTH-01',
          name: 'North Boundary - Kirinda Buffer',
          type: 'BUFFER',
          centre_lat: 6.2386,
          centre_lng: 81.3138,
          radius_metres: 3500,
          severity: 'HIGH',
          nearest_settlement: 'Kirinda Village',
        },
        {
          id: 'ZONE-SOUTH-02',
          name: 'South Boundary - Palatupana Farm Zone',
          type: 'SETTLEMENT_BOUNDARY',
          centre_lat: 6.2994,
          centre_lng: 81.3703,
          radius_metres: 4000,
          severity: 'HIGH',
          nearest_settlement: 'Palatupana Settlement',
        },
        {
          id: 'ZONE-EAST-03',
          name: 'East Wildlife Corridor',
          type: 'CORRIDOR',
          centre_lat: 6.355,
          centre_lng: 81.392,
          radius_metres: 3000,
          severity: 'MEDIUM',
          nearest_settlement: 'Yodakandiya Farm Borders',
        },
        {
          id: 'ZONE-WEST-04',
          name: 'West Boundary - Tissamaharama Reservoir Border',
          type: 'BUFFER',
          centre_lat: 6.2836,
          centre_lng: 81.2889,
          radius_metres: 2500,
          severity: 'HIGH',
          nearest_settlement: 'Tissa Township',
        },
      ];
      await GeofenceZone.insertMany(zones);
    }
    return zones;
  }

  async createGeofenceZone(zoneData) {
    const doc = await GeofenceZone.create(zoneData);
    return doc.toObject();
  }

  async findActiveAlertByCollar(collarId) {
    return CollarAlert.findOne({
      collar_id: collarId,
      status: ALERT_STATUS.ACTIVE,
    }).lean();
  }

  async findAlertById(alertId) {
    return CollarAlert.findOne({ id: alertId }).lean();
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
      status: alertData.status,
      triggered_at: alertData.triggeredAt,
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
    const doc = await CollarAlert.findOneAndUpdate(
      { id: alertId },
      {
        $set: {
          status: statusData.status,
          response_action: statusData.responseAction,
          officer_id: statusData.officerId,
          officer_notes: statusData.officerNotes,
          dispatched_ranger_id: statusData.dispatchedRangerId,
          acknowledged_at: statusData.acknowledgedAt,
          resolved_at: statusData.resolvedAt,
        },
      },
      { new: true },
    ).lean();
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
}

/**
 * Concrete AlertDataSource reading from CollarAlert collection.
 * Plugs into MongoAnalyticsRepository for UC4 conservation reports & hotspot mapping!
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

module.exports = { MongoCollarRepository, MongoAlertDataSource };
