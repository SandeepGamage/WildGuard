const { SMS_KEYWORDS } = require('../../constants/smsKeywords');

const normalizeKeyword = (word) => word.normalize('NFC').toUpperCase();
const isLatin = (word) => /^[ -~]+$/.test(word);

/**
 * Splits an SMS into keyword + place name. Pure and synchronous so it can be
 * tested without a database.
 */
class MessageParser {
  /** @param {ReadonlyArray<{keyword: string, language: string, incidentType: string}>} [dictionary] */
  constructor(dictionary = SMS_KEYWORDS) {
    this.lookup = new Map(dictionary.map((entry) => [normalizeKeyword(entry.keyword), entry]));
  }

  /**
   * @param {string} message Raw SMS text, e.g. "ALIYA PALATUPANA".
   * `replyLanguage` is set only for native-script keywords (Sinhala/Tamil); a Latin keyword such
   * as ALIYA says nothing reliable about the sender's language or handset.
   * @returns {{ ok: true, incidentType: string, language: string, replyLanguage: string|null, locationText: string }
   *   | { ok: false, reason: 'EMPTY' | 'UNKNOWN_KEYWORD' }}
   */
  parse(message) {
    const words = String(message ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return { ok: false, reason: 'EMPTY' };

    const entry = this.lookup.get(normalizeKeyword(words[0]));
    if (!entry) return { ok: false, reason: 'UNKNOWN_KEYWORD' };

    return {
      ok: true,
      incidentType: entry.incidentType,
      language: entry.language,
      replyLanguage: isLatin(words[0]) ? null : entry.language,
      locationText: words.slice(1).join(' '),
    };
  }
}

module.exports = { MessageParser };
