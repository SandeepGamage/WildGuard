const { unwrap } = require('./support');

/** Private Supabase Storage bucket for incident photos. */
class PhotoStorageRepository {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} db Service-role client.
   * @param {string} bucket Bucket name.
   */
  constructor(db, bucket) {
    this.storage = db.storage.from(bucket);
  }

  /** @returns {Promise<{ path: string, token: string }>} One-time upload ticket for `path`. */
  async createSignedUpload(path) {
    const data = unwrap(await this.storage.createSignedUploadUrl(path));
    return { path: data.path, token: data.token };
  }

  /** @returns {Promise<string|null>} Short-lived read URL, or null when the object cannot be signed. */
  async createSignedUrl(path, ttlSeconds) {
    const result = await this.storage.createSignedUrl(path, ttlSeconds);
    return result.error ? null : result.data.signedUrl;
  }
}

module.exports = { PhotoStorageRepository };
