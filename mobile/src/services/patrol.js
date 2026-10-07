import { requestPatrolPhotoUpload, syncPatrol } from '../api/patrol.api';
import { newClientRequestId } from '../utils/uuid';
import { createPatrolEngine } from './patrol.core';
import { patrolRepository } from './patrol.repository';
import { preparePatrolPhoto } from './patrolPhoto';
import { createPatrolSync } from './patrolSync.core';
import { createPhotoUploader } from './photoUploader';

/** App-wide UC1 services backed by SQLite and the REST API. */
export const patrolEngine = createPatrolEngine({
  repository: patrolRepository,
  newId: newClientRequestId,
  preparePhoto: preparePatrolPhoto,
});

export const patrolSync = createPatrolSync({
  repository: patrolRepository,
  syncPatrol,
  uploadPhoto: createPhotoUploader(requestPatrolPhotoUpload),
});

export { patrolRepository };
