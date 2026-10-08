const { randomUUID } = require('node:crypto');
const { toIncident } = require('../../src/models/incident.model');
const { toProfile } = require('../../src/models/profile.model');
const { toNotification } = require('../../src/models/notification.model');
const { UNDECIDED_STATUSES, INCIDENT_STATUS } = require('../../src/constants/domain');

const EARTH_RADIUS_M = 6371000;

function distanceM(aLat, aLng, bLat, bLng) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * In-memory stand-ins for the Supabase repositories. They reproduce the
 * behaviour the SQL provides (scope trigger, idempotency constraint, duplicate
 * radius/window, row-locked review) so the service layer can be tested without
 * a database.
 */
function createInMemoryRepositories({ villages, profiles, collars = [], sectors = [] }) {
  const state = {
    incidents: [],
    records: [],
    notifications: [],
    smsLogs: [],
    sequence: 142,
    failNextInsert: false,
    photoCalls: [],
    reports: [],
    patrolTracks: [],
    patrolSessions: [],
    patrolTrackPoints: [],
    patrolIncidentRows: [],
    patrolIncidents: [],
    collarAlerts: [],
    failAnalyticsQuery: false,
  };

  const villageRows = villages.map((village) => ({
    id: village.id,
    name_en: village.nameEn,
    name_si: village.nameSi ?? null,
    name_ta: null,
    aliases: village.aliases ?? [],
    gn_division_id: village.gnDivisionId,
    sector_id: village.sectorId,
    latitude: village.latitude,
    longitude: village.longitude,
  }));
  const villageById = (id) => villageRows.find((row) => row.id === id) ?? null;

  const withEmbeds = (row) => ({
    ...row,
    village: row.village_id ? villageById(row.village_id) : null,
    reporter: profiles.find((profile) => profile.id === row.reporter_id)
      ? {
          id: row.reporter_id,
          full_name: profiles.find((profile) => profile.id === row.reporter_id).fullName,
          phone: profiles.find((profile) => profile.id === row.reporter_id).phone,
        }
      : null,
  });
  const domain = (row) => toIncident(withEmbeds(row));

  const incidentRepository = {
    async insert(values) {
      if (state.failNextInsert) {
        state.failNextInsert = false;
        throw new Error('Database error: connection refused');
      }
      const existing = values.client_request_id
        ? state.incidents.find(
            (row) =>
              row.reporter_id === values.reporter_id && row.client_request_id === values.client_request_id,
          )
        : null;
      if (existing) return { incident: domain(existing), created: false };

      const village = villageById(values.village_id);
      state.sequence += 1;
      const row = {
        id: randomUUID(),
        tracking_code: `C-${String(state.sequence).padStart(4, '0')}`,
        review_started_at: null,
        field_action_required: false,
        call_back_required: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...values,
        gn_division_id: village?.gn_division_id ?? null,
        sector_id: village?.sector_id ?? null,
      };
      state.incidents.push(row);
      return { incident: domain(row), created: true };
    },

    async findById(id) {
      const row = state.incidents.find((item) => item.id === id);
      return row ? domain(row) : null;
    },

    async findByIds(ids) {
      return state.incidents.filter((row) => ids.includes(row.id)).map(domain);
    },

    async findByClientRequestId(reporterId, clientRequestId) {
      const row = state.incidents.find(
        (item) => item.reporter_id === reporterId && item.client_request_id === clientRequestId,
      );
      return row ? domain(row) : null;
    },

    async findDuplicateId({ incidentType, latitude, longitude, occurredAt, radiusM, windowMinutes }) {
      const at = new Date(occurredAt).getTime();
      const match = state.incidents
        .filter(
          (row) =>
            row.incident_type === incidentType &&
            !row.duplicate_of_id &&
            UNDECIDED_STATUSES.includes(row.status) &&
            Math.abs(new Date(row.occurred_at).getTime() - at) <= windowMinutes * 60000 &&
            distanceM(row.latitude, row.longitude, latitude, longitude) <= radiusM,
        )
        .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))[0];
      return match?.id ?? null;
    },

    async listByReporter(reporterId, { limit, offset }) {
      return state.incidents
        .filter((row) => row.reporter_id === reporterId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(offset, offset + limit)
        .map(domain);
    },

    async listQueueRoots(divisionIds) {
      return state.incidents
        .filter(
          (row) =>
            !row.duplicate_of_id &&
            UNDECIDED_STATUSES.includes(row.status) &&
            divisionIds.includes(row.gn_division_id),
        )
        .map(domain);
    },

    async listMapRoots(divisionIds) {
      return state.incidents
        .filter(
          (row) =>
            !row.duplicate_of_id &&
            [...UNDECIDED_STATUSES, INCIDENT_STATUS.VERIFIED].includes(row.status) &&
            divisionIds.includes(row.gn_division_id),
        )
        .map(domain);
    },

    async listDuplicatesOf(rootIds) {
      return state.incidents.filter((row) => rootIds.includes(row.duplicate_of_id)).map(domain);
    },

    async countVerifiedRoots(divisionIds) {
      return state.incidents.filter(
        (row) =>
          !row.duplicate_of_id &&
          row.status === INCIDENT_STATUS.VERIFIED &&
          divisionIds.includes(row.gn_division_id),
      ).length;
    },

    async startReview(incidentId, officerId) {
      const root = resolveRoot(incidentId);
      if (!root) return { ok: false, code: 'INCIDENT_NOT_FOUND' };
      if (!officerInScope(officerId, root)) return { ok: false, code: 'OUT_OF_SCOPE' };
      if (root.status === INCIDENT_STATUS.PENDING) root.status = INCIDENT_STATUS.UNDER_REVIEW;
      state.incidents
        .filter((row) => row.id === root.id || row.duplicate_of_id === root.id)
        .forEach((row) => {
          row.review_started_at ??= new Date().toISOString();
        });
      return { ok: true, incident_id: root.id };
    },

    async reviewIncident({ incidentId, officerId, decision, method, notes, rejectionReason, fieldAction }) {
      // Yield once so concurrent callers interleave exactly as separate DB sessions would.
      await Promise.resolve();
      const root = resolveRoot(incidentId);
      if (!root) return { ok: false, code: 'INCIDENT_NOT_FOUND' };
      if (!officerInScope(officerId, root)) return { ok: false, code: 'OUT_OF_SCOPE' };

      if (!UNDECIDED_STATUSES.includes(root.status)) {
        const previous = [...state.records].reverse().find((record) => record.incident_id === root.id);
        const officer = profiles.find((profile) => profile.id === previous?.officer_id);
        return {
          ok: false,
          code: 'ALREADY_REVIEWED',
          status: root.status,
          reviewed_by_name: officer?.fullName ?? null,
          reviewed_at: previous?.verified_at ?? null,
        };
      }

      const fieldActionRequired = decision === 'VERIFIED' && Boolean(fieldAction);
      state.records.push({
        id: randomUUID(),
        incident_id: root.id,
        officer_id: officerId,
        decision,
        method: method ?? null,
        notes: notes ?? null,
        rejection_reason: rejectionReason ?? null,
        field_action_required: fieldActionRequired,
        verified_at: new Date().toISOString(),
      });
      const group = state.incidents.filter(
        (row) => row.id === root.id || (row.duplicate_of_id === root.id && row.status === 'DUPLICATE'),
      );
      group.forEach((row) => {
        row.status = decision;
        row.field_action_required = fieldActionRequired;
        row.call_back_required = false;
        row.updated_at = new Date().toISOString();
      });
      const members = state.incidents.filter((row) => row.id === root.id || row.duplicate_of_id === root.id);
      return {
        ok: true,
        incident_id: root.id,
        status: decision,
        field_action_required: fieldActionRequired,
        sector_id: root.sector_id,
        gn_division_id: root.gn_division_id,
        tracking_code: root.tracking_code,
        affected_incident_ids: members.map((row) => row.id),
        reporter_ids: [...new Set(members.map((row) => row.reporter_id).filter(Boolean))],
      };
    },
  };

  function resolveRoot(incidentId) {
    const row = state.incidents.find((item) => item.id === incidentId);
    if (!row) return null;
    return row.duplicate_of_id ? state.incidents.find((item) => item.id === row.duplicate_of_id) : row;
  }

  function officerInScope(officerId, root) {
    return profiles.find((profile) => profile.id === officerId)?.divisionIds?.includes(root.gn_division_id);
  }

  const profileRepository = {
    async findById(id) {
      const profile = profiles.find((item) => item.id === id);
      return profile ? { ...profile } : null;
    },
    async findByPhone(phone) {
      const profile = profiles.find((item) => item.phone === phone);
      return profile ? { ...profile } : null;
    },
    async create({ id, fullName, phone, language, registeredVillageId }) {
      const profile = toProfile({
        id,
        full_name: fullName,
        phone,
        role: 'VILLAGER',
        language,
        registered_village_id: registeredVillageId,
        sector_id: null,
        is_active: true,
      });
      profiles.push(profile);
      return profile;
    },
    async listOfficersByDivision(gnDivisionId) {
      return profiles
        .filter((p) => p.role === 'COMMUNITY_LIAISON_OFFICER' && p.divisionIds.includes(gnDivisionId))
        .map((p) => p.id);
    },
    async listRangersBySector(sectorId) {
      return profiles.filter((p) => p.role === 'FIELD_RANGER' && p.sectorId === sectorId).map((p) => p.id);
    },
  };

  const villageRepository = {
    async listActive() {
      return villages.map((village) => ({ ...village, aliases: village.aliases ?? [] }));
    },
    async findById(id) {
      const village = villages.find((item) => item.id === id);
      return village ? { ...village, aliases: village.aliases ?? [] } : null;
    },
    async findNearest(latitude, longitude, maxDistanceM) {
      const nearest = villages
        .map((village) => ({
          id: village.id,
          distanceM: distanceM(village.latitude, village.longitude, latitude, longitude),
        }))
        .sort((a, b) => a.distanceM - b.distanceM)[0];
      return nearest && nearest.distanceM <= maxDistanceM ? nearest : null;
    },
  };

  const verificationRepository = {
    async findLatestForIncident(incidentId) {
      const row = [...state.records].reverse().find((record) => record.incident_id === incidentId);
      if (!row) return null;
      const officer = profiles.find((profile) => profile.id === row.officer_id);
      return {
        id: row.id,
        incidentId: row.incident_id,
        officerId: row.officer_id,
        officerName: officer?.fullName ?? null,
        decision: row.decision,
        method: row.method,
        notes: row.notes,
        rejectionReason: row.rejection_reason,
        fieldActionRequired: row.field_action_required,
        verifiedAt: row.verified_at,
      };
    },
    async listByOfficer(officerId, { decision, limit, offset }) {
      return state.records
        .filter((record) => record.officer_id === officerId && (!decision || record.decision === decision))
        .slice(offset, offset + limit)
        .map((record) => {
          const incident = state.incidents.find((row) => row.id === record.incident_id);
          return {
            incidentId: record.incident_id,
            decision: record.decision,
            fieldActionRequired: record.field_action_required,
            verifiedAt: record.verified_at,
            incident: {
              trackingCode: incident.tracking_code,
              incidentType: incident.incident_type,
              village: null,
            },
          };
        });
    },
  };

  const notificationRepository = {
    async createMany(rows) {
      const created = rows.map((row) => ({ id: randomUUID(), read_at: null, ...row }));
      state.notifications.push(...created);
      return created.map(toNotification);
    },
    async listForUser({ userId, sectorId }) {
      return state.notifications
        .filter((row) => row.recipient_id === userId || (sectorId && row.target_sector_id === sectorId))
        .map(toNotification);
    },
    async markRead(id, userId) {
      const row = state.notifications.find((item) => item.id === id && item.recipient_id === userId);
      if (!row) return null;
      row.read_at = new Date().toISOString();
      return toNotification(row);
    },
  };

  const smsLogRepository = {
    async create(entry) {
      state.smsLogs.push(entry);
    },
  };

  const collarRepository = {
    async findNearby(latitude, longitude, radiusM) {
      return (state.collars || collars)
        .map((collar) => ({
          code: collar.code,
          name: collar.name,
          distanceM: Math.round(distanceM(collar.latitude, collar.longitude, latitude, longitude)),
          lastSeenAt: new Date().toISOString(),
        }))
        .filter((collar) => collar.distanceM <= radiusM);
    },
    async listDevices() {
      return state.collars || collars;
    },
    async updateDeviceLocation(collarId, location, lastSeenAt) {
      const collar = (state.collars || collars).find((c) => c.code === collarId);
      if (collar) {
        collar.latitude = location.latitude;
        collar.longitude = location.longitude;
        collar.last_seen_at = lastSeenAt || new Date();
      }
    },
    async setSignalLost(collarId, isLost = true) {
      const collar = (state.collars || collars).find((c) => c.code === collarId);
      if (collar) {
        collar.signal_lost = isLost;
      }
      return collar || null;
    },
    async listAvailableResponders() {
      return [
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
      ];
    },
    async listGeofenceZones() {
      if (!state.zones || state.zones.length === 0) {
        state.zones = [
          {
            id: 'ZONE-NORTH-01',
            name: 'North Boundary - Kirinda Buffer',
            type: 'BUFFER',
            centre_lat: 6.2386,
            centre_lng: 81.3138,
            radius_metres: 3500,
            approach_buffer_metres: 500,
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
            approach_buffer_metres: 500,
            severity: 'HIGH',
            nearest_settlement: 'Palatupana Settlement',
          },
          {
            id: 'ZONE-FARMLAND-01',
            name: 'Palatupana Farmland & Paddy Perimeter',
            type: 'FARMLAND',
            centre_lat: 6.2994,
            centre_lng: 81.3703,
            radius_metres: 3000,
            approach_buffer_metres: 500,
            severity: 'CRITICAL',
            nearest_settlement: 'Palatupana Village',
          },
          {
            id: 'ZONE-VILLAGE-02',
            name: 'Kirinda Coastal Settlement Zone',
            type: 'VILLAGE',
            centre_lat: 6.2386,
            centre_lng: 81.3138,
            radius_metres: 2500,
            approach_buffer_metres: 500,
            severity: 'CRITICAL',
            nearest_settlement: 'Kirinda Village',
          },
          {
            id: 'ZONE-ROAD-03',
            name: 'B399 Tissamaharama Highway Transit',
            type: 'ROAD',
            centre_lat: 6.355,
            centre_lng: 81.392,
            radius_metres: 2000,
            approach_buffer_metres: 500,
            severity: 'CRITICAL',
            nearest_settlement: 'Yodakandiya Farm Borders',
          },
          {
            id: 'ZONE-RAILWAY-04',
            name: 'Southern Railway Track Buffer',
            type: 'RAILWAY',
            centre_lat: 6.2836,
            centre_lng: 81.2889,
            radius_metres: 1800,
            approach_buffer_metres: 500,
            severity: 'CRITICAL',
            nearest_settlement: 'Tissa Township',
          },
        ];
      }
      return state.zones;
    },
    async findActiveAlertByCollar(collarId) {
      return (
        state.collarAlerts.find(
          (a) =>
            a.collar_id === collarId &&
            ['ACTIVE', 'RAISED', 'VILLAGE_SMS_SENT', 'DISPATCHED', 'ACKNOWLEDGED', 'ESCALATED'].includes(a.status),
        ) || null
      );
    },
    async findAlertById(alertId) {
      return state.collarAlerts.find((a) => a.id === alertId) || null;
    },
    async generateAlertReference() {
      state.sequence = (state.sequence || 100) + 1;
      return `ALT-${String(state.sequence).padStart(4, '0')}`;
    },
    async createAlert(data) {
      const alert = {
        id: data.id,
        alert_reference: data.alertReference,
        collar_id: data.collarId,
        animal_label: data.animalLabel,
        latitude: data.latitude,
        longitude: data.longitude,
        zone_id: data.zoneId,
        zone_name: data.zoneName,
        severity: data.severity,
        proximity: data.proximity || 'INSIDE',
        status: data.status || 'ACTIVE',
        status_timeline: data.statusTimeline || [
          {
            status: data.status || 'ACTIVE',
            timestamp: data.triggeredAt || new Date().toISOString(),
            details: `Alert created for ${data.animalLabel} in ${data.zoneName}`,
            actor: 'HazardMonitoringController',
          },
        ],
        dispatch: data.dispatch || null,
        village_sms: data.villageSms || null,
        triggered_at: data.triggeredAt || new Date().toISOString(),
      };
      state.collarAlerts.push(alert);
      return { ...alert };
    },
    async updateAlertLocation(alertId, data) {
      const alert = state.collarAlerts.find((a) => a.id === alertId);
      if (alert) {
        alert.latitude = data.latitude;
        alert.longitude = data.longitude;
        alert.zone_id = data.zoneId;
        alert.zone_name = data.zoneName;
        alert.severity = data.severity;
        alert.triggered_at = data.triggeredAt;
      }
      return alert ? { ...alert } : null;
    },
    async updateAlertStatus(alertId, data) {
      const alert = state.collarAlerts.find((a) => a.id === alertId);
      if (alert) {
        alert.status = data.status;
        if (data.responseAction !== undefined) alert.response_action = data.responseAction;
        if (data.officerId !== undefined) alert.officer_id = data.officerId;
        if (data.officerNotes !== undefined) alert.officer_notes = data.officerNotes;
        if (data.dispatchedRangerId !== undefined) alert.dispatched_ranger_id = data.dispatchedRangerId;
        if (data.acknowledgedAt !== undefined) alert.acknowledged_at = data.acknowledgedAt;
        if (data.resolvedAt !== undefined) alert.resolved_at = data.resolvedAt;
        if (data.resolutionReason !== undefined) alert.resolution_reason = data.resolutionReason;
        if (data.dispatch) alert.dispatch = data.dispatch;
        if (data.villageSms) alert.village_sms = data.villageSms;
        if (data.timelineEntry) {
          alert.status_timeline = alert.status_timeline || [];
          alert.status_timeline.push(data.timelineEntry);
        }
      }
      return alert ? { ...alert } : null;
    },
    async listAlertsByStatuses(statuses) {
      return state.collarAlerts.filter((a) => statuses.includes(a.status));
    },
    async listAuditTrail({ collarId, limit = 50 } = {}) {
      let filtered = state.collarAlerts;
      if (collarId) filtered = filtered.filter((a) => a.collar_id === collarId);
      return filtered.slice(0, limit);
    },
    async recordTelemetryLog(data) {
      state.telemetryLogs = state.telemetryLogs || [];
      state.telemetryLogs.push({ ...data });
    },
    async createCameraTrapReview(data) {
      const item = {
        id: data.id,
        trap_id: data.trapId,
        image_url: data.imageUrl,
        ai_species: data.aiSpecies,
        ai_confidence: data.aiConfidence,
        ai_threat: Boolean(data.aiThreat),
        status: data.status || 'PENDING_REVIEW',
        latitude: data.latitude,
        longitude: data.longitude,
        created_at: new Date().toISOString(),
      };
      state.cameraTrapReviews = state.cameraTrapReviews || [];
      state.cameraTrapReviews.push(item);
      return { ...item };
    },
    async listPendingCameraTrapReviews() {
      return (state.cameraTrapReviews || []).filter((r) => r.status === 'PENDING_REVIEW');
    },
    async findCameraTrapReviewById(id) {
      return (state.cameraTrapReviews || []).find((r) => r.id === id) || null;
    },
    async updateCameraTrapReview(id, data) {
      const review = (state.cameraTrapReviews || []).find((r) => r.id === id);
      if (review) {
        review.status = data.status;
        review.reviewed_by = data.reviewedBy;
        review.reviewed_at = data.reviewedAt || new Date().toISOString();
      }
      return review ? { ...review } : null;
    },
  };

  const photoStorageRepository = {
    async createSignedUpload(path) {
      state.photoCalls.push(path);
      return { path, token: 'upload-token' };
    },
    async createSignedUrl(path) {
      return `https://signed.example/${path}`;
    },
  };

  const inRange = (date, from, to) => new Date(date) >= from && new Date(date) < to;

  const analyticsRepository = {
    async listSectors(parkName) {
      return sectors.filter((s) => s.park === parkName).map((s) => ({ id: s.id, name: s.name }));
    },
    async queryAnalyticsData(filter) {
      if (state.failAnalyticsQuery) throw new Error('MongoNetworkError: connection refused');
      const inPark = (row) => filter.sectorIds.includes(row.sector_id);
      const verifiedRoot = (row) =>
        inPark(row) &&
        !row.duplicate_of_id &&
        row.status === INCIDENT_STATUS.VERIFIED &&
        filter.incidentTypes.includes(row.incident_type);
      const occurred = (row) => row.occurred_at ?? row.created_at;
      return {
        communityIncidents: state.incidents
          .filter((row) => verifiedRoot(row) && inRange(occurred(row), filter.dateFrom, filter.dateTo))
          .map((row) => ({
            id: row.id,
            trackingCode: row.tracking_code,
            incidentType: row.incident_type,
            source: row.source,
            urgency: row.urgency,
            occurredAt: new Date(occurred(row)),
            latitude: row.latitude,
            longitude: row.longitude,
            villageName: villageById(row.village_id)?.name_en ?? null,
            sectorId: row.sector_id,
          })),
        receivedCommunityReports: state.incidents.filter(
          (row) => inPark(row) && inRange(occurred(row), filter.dateFrom, filter.dateTo),
        ).length,
        previousPeriodCount: state.incidents.filter(
          (row) => verifiedRoot(row) && inRange(occurred(row), filter.previousFrom, filter.dateFrom),
        ).length,
        villages: villageRows
          .filter((v) => filter.sectorIds.includes(v.sector_id))
          .map((v) => ({ id: v.id, name: v.name_en, latitude: v.latitude, longitude: v.longitude })),
        patrolTracks: state.patrolTracks,
        patrolIncidents: state.patrolIncidents,
        collarAlerts: state.collarAlerts,
      };
    },
    async saveReport(report) {
      state.reports.push(structuredClone(report));
    },
    async findReport(reportId) {
      const report = state.reports.find((r) => r.id === reportId);
      return report ? { ...structuredClone(report), parkId: report.park.id } : null;
    },
    async listReports(createdBy, limit) {
      return state.reports
        .filter((r) => r.createdBy === createdBy)
        .reverse()
        .slice(0, limit)
        .map((r) => ({ ...r, parkId: r.park.id }));
    },
  };

  const patrolRepository = {
    async findSession(id) {
      const row = state.patrolSessions.find((s) => s.id === id);
      return row ? { ranger_id: row.rangerId, sector_id: row.sectorId } : null;
    },
    async upsertSession(rangerId, session) {
      const row = state.patrolSessions.find((s) => s.id === session.id);
      if (row) Object.assign(row, { status: session.status, endedAt: session.endedAt ?? null });
      else state.patrolSessions.push({ ...session, rangerId, endedAt: session.endedAt ?? null });
    },
    async upsertTrackPoints(rangerId, sessionId, points) {
      for (const p of points) {
        if (!state.patrolTrackPoints.some((x) => x.id === p.id)) {
          state.patrolTrackPoints.push({ ...p, sessionId, rangerId });
        }
      }
    },
    async upsertIncidents(rangerId, sessionId, sectorId, incidents) {
      for (const i of incidents) {
        if (!state.patrolIncidentRows.some((x) => x.id === i.id)) {
          state.patrolIncidentRows.push({ ...i, sessionId, rangerId, sectorId });
        }
      }
    },
  };

  return {
    state,
    repositories: {
      incidentRepository,
      profileRepository,
      villageRepository,
      verificationRepository,
      notificationRepository,
      smsLogRepository,
      collarRepository,
      photoStorageRepository,
      analyticsRepository,
      patrolRepository,
    },
  };
}

module.exports = { createInMemoryRepositories };
