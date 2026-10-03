const LOCAL_MOBILE_PATTERN = /^0\d{9}$/;

/**
 * Normalise a Sri Lankan mobile number to the local 10-digit form (07XXXXXXXX).
 * @param {string} input Raw user input, e.g. "+94 77 123 4567" or "077-123-4567".
 * @returns {string|null} Normalised number or null when it is not a valid mobile number.
 */
function normalizePhone(input) {
  if (typeof input !== 'string') return null;
  let digits = input.replace(/[\s\-()]/g, '');
  if (digits.startsWith('+94')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('94') && digits.length === 11) digits = `0${digits.slice(2)}`;
  return LOCAL_MOBILE_PATTERN.test(digits) ? digits : null;
}

/** Masked display form used outside the owner's own screens, e.g. "077 *** 812". */
function maskPhone(phone) {
  if (!phone || phone.length < 6) return null;
  return `${phone.slice(0, 3)} *** ${phone.slice(-3)}`;
}

/**
 * Supabase Auth is used with email+password, so a mobile number maps to a
 * deterministic pseudo-email. The mobile app uses the same mapping.
 */
function phoneToLoginEmail(phone, domain) {
  return `${phone}@${domain}`;
}

module.exports = { normalizePhone, maskPhone, phoneToLoginEmail };
