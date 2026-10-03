import { requestPhotoUpload } from '../api/incidents.api';
import { supabase } from './supabase';

/**
 * Upload one photo to the private incident-photos bucket using a one-time
 * signed upload ticket from the backend. The device never holds a key that can
 * write to storage on its own.
 * @param {{ uri: string, mimeType: string, sizeBytes: number }} photo
 * @returns {Promise<string>} Storage path to attach to the report.
 */
export async function uploadReportPhoto({ uri, mimeType, sizeBytes }) {
  const ticket = await requestPhotoUpload({ contentType: mimeType, sizeBytes });
  const response = await fetch(uri);
  const bytes = await response.arrayBuffer();
  const { error } = await supabase.storage
    .from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, bytes, { contentType: mimeType });
  if (error) throw error;
  return ticket.path;
}
