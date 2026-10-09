const { CommunityIncident, Sector, Village, ConservationReport } = require('../../models/mongo/schemas');
const { toConservationReport, toReportDocument } = require('../../models/conservationReport.model');
const { INCIDENT_STATUS } = require('../../constants/domain');
const { PendingPatrolDataSource, PendingAlertDataSource } = require('../sources/pendingDataSources');

/**
 * Read model for UC4 (AnalyticsRepository in Fig 11). It only ever returns
 * analytics-safe fields: reporter ids and phone numbers never leave this class.
 */
class MongoAnalyticsRepository {
  /**
   * @param {{ patrolDataSource?: object, alertDataSource?: object }} [deps]
   *   UC1/UC2 sources. Without them the empty fallbacks in pendingDataSources.js are used.
   */
  constructor({ patrolDataSource, alertDataSource } = {}) {
    this.patrolDataSource = patrolDataSource ?? new PendingPatrolDataSource();
    this.alertDataSource = alertDataSource ?? new PendingAlertDataSource();
  }

  async listSectors(parkName) {
    const docs = await Sector.find({ park: parkName }).sort({ name: 1 }).lean();
    return docs.map((s) => ({ id: s.id, name: s.name }));
  }

  /**
   * @param {{ dateFrom: Date, dateTo: Date, previousFrom: Date, incidentTypes: string[], sectorIds: string[] }} filter
   *   `dateTo` is exclusive.
   */
  async queryAnalyticsData(filter) {
    const inPark = { sector_id: { $in: filter.sectorIds } };
    const inRange = { occurred_at: { $gte: filter.dateFrom, $lt: filter.dateTo } };
    const verifiedRoots = {
      ...inPark,
      duplicate_of_id: null,
      status: INCIDENT_STATUS.VERIFIED,
      incident_type: { $in: filter.incidentTypes },
    };

    const [docs, received, previousPeriodCount, villages, patrolTracks, patrolIncidents, collarAlerts] =
      await Promise.all([
        CommunityIncident.find({ ...verifiedRoots, ...inRange })
          .select(
            'id tracking_code incident_type source urgency occurred_at latitude longitude village_id sector_id',
          )
          .sort({ occurred_at: 1 })
          .lean(),
        CommunityIncident.countDocuments({ ...inPark, ...inRange }),
        CommunityIncident.countDocuments({
          ...verifiedRoots,
          occurred_at: { $gte: filter.previousFrom, $lt: filter.dateFrom },
        }),
        Village.find({ sector_id: { $in: filter.sectorIds }, is_active: true }).lean(),
        this.patrolDataSource.listTracks(filter),
        this.patrolDataSource.listIncidents(filter),
        this.alertDataSource.listAlerts(filter),
      ]);

    const villageNames = new Map(villages.map((v) => [v.id, v.name_en]));
    return {
      communityIncidents: docs
        .filter((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude))
        .map((d) => ({
          id: d.id,
          trackingCode: d.tracking_code,
          incidentType: d.incident_type,
          source: d.source,
          urgency: d.urgency,
          occurredAt: d.occurred_at,
          latitude: d.latitude,
          longitude: d.longitude,
          villageName: villageNames.get(d.village_id) ?? null,
          sectorId: d.sector_id,
        })),
      receivedCommunityReports: received,
      previousPeriodCount,
      villages: villages.map((v) => ({
        id: v.id,
        name: v.name_en,
        latitude: v.latitude,
        longitude: v.longitude,
      })),
      patrolTracks,
      patrolIncidents,
      collarAlerts,
    };
  }

  async saveReport(report) {
    await ConservationReport.create(toReportDocument(report));
  }

  async findReport(reportId) {
    const doc = await ConservationReport.findOne({ id: reportId }).lean();
    return toConservationReport(doc);
  }

  async listReports(createdBy, limit) {
    const docs = await ConservationReport.find({ created_by: createdBy })
      .select('id park_id created_by generated_at filter stats')
      .sort({ generated_at: -1 })
      .limit(limit)
      .lean();
    return docs.map(toConservationReport);
  }
}

module.exports = { MongoAnalyticsRepository };
