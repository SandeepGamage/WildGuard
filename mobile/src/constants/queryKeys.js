export const queryKeys = {
  me: ['me'],
  villages: ['villages'],
  myReports: ['incidents', 'mine'],
  myReport: (id) => ['incidents', 'mine', id],
  pendingReports: (userId) => ['pending', userId],
  queue: ['officer', 'queue'],
  officerIncident: (id) => ['officer', 'incident', id],
  officerMap: ['officer', 'map'],
  officerHistory: (decision) => ['officer', 'history', decision ?? 'all'],
};
