import { createIncident } from '../api/incidents.api';
import { newClientRequestId } from '../utils/uuid';
import { pendingReportsRepository } from './pendingReports.repository';
import { uploadReportPhoto } from './photoUploader';
import { createReportSync } from './reportSync.core';

/** App-wide report submission service backed by SQLite and the REST API. */
export const reportSync = createReportSync({
  repository: pendingReportsRepository,
  createIncident,
  uploadPhoto: uploadReportPhoto,
  newId: newClientRequestId,
});
