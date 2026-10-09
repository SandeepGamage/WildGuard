/** Domain report -> Mongo document (snake_case top level, computed sections kept as-is). */
function toReportDocument(report) {
  return {
    id: report.id,
    park_id: report.park.id,
    created_by: report.createdBy,
    generated_at: report.generatedAt,
    filter: report.filter,
    stats: report.stats,
    trends: report.trends,
    coverage: report.coverage,
    heatmap: report.heatmap,
    top_hotspots: report.topHotspots,
    landmarks: report.landmarks,
    patrol_points: report.patrolPoints ?? [],
    incidents: report.incidents,
  };
}

/** Mongo document -> domain report. */
function toConservationReport(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    parkId: doc.park_id,
    createdBy: doc.created_by,
    generatedAt: doc.generated_at,
    filter: doc.filter,
    stats: doc.stats,
    trends: doc.trends ?? null,
    coverage: doc.coverage ?? null,
    heatmap: doc.heatmap ?? null,
    topHotspots: doc.top_hotspots ?? [],
    landmarks: doc.landmarks ?? [],
    patrolPoints: doc.patrol_points ?? [],
    incidents: doc.incidents ?? [],
  };
}

module.exports = { toReportDocument, toConservationReport };
