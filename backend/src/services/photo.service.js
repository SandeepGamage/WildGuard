const { randomUUID } = require('node:crypto');
const { PHOTO_RULES } = require('../constants/domain');
const { badRequest } = require('../errors/AppError');

const EXTENSIONS = Object.values(PHOTO_RULES.ALLOWED_TYPES).join('|');
const UUID_PATTERN = '[0-9a-fA-F-]{36}';

/** Issues upload tickets and signed read URLs for the private incident-photo bucket. */
class PhotoService {
  /**
   * @param {{ photoStorageRepository: object, bucket: string }} deps
   */
  constructor({ photoStorageRepository, bucket }) {
    this.storage = photoStorageRepository;
    this.bucket = bucket;
  }

  /**
   * Returns a one-time signed upload ticket. The object path is chosen by the
   * server (<userId>/<random>.<ext>) so clients cannot overwrite other files.
   * @param {{ id: string }} user
   * @param {{ contentType: string }} input Already validated by Zod.
   */
  async createUploadTicket(user, { contentType }) {
    const extension = PHOTO_RULES.ALLOWED_TYPES[contentType];
    const path = `${user.id}/${randomUUID()}.${extension}`;
    const ticket = await this.storage.createSignedUpload(path);
    return {
      bucket: this.bucket,
      path: ticket.path,
      token: ticket.token,
      maxBytes: PHOTO_RULES.MAX_BYTES,
    };
  }

  /** A report may only reference a photo that lives in the reporter's own folder. */
  assertOwnedPath(userId, photoPath) {
    if (photoPath === undefined) return;
    const pattern = new RegExp(`^${userId}/${UUID_PATTERN}\\.(${EXTENSIONS})$`);
    if (!pattern.test(photoPath)) {
      throw badRequest('INVALID_PHOTO_PATH', 'The photo reference is not valid.');
    }
  }

  /** @returns {Promise<string|null>} Short-lived URL, or null when there is no photo. */
  async signedUrl(photoPath) {
    if (!photoPath) return null;
    return this.storage.createSignedUrl(photoPath, PHOTO_RULES.SIGNED_URL_TTL_SECONDS);
  }
}

module.exports = { PhotoService };
