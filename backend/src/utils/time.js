const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Approximate offset applied when a reporter says the event was "earlier today". */
const EARLIER_TODAY_OFFSET_MS = 3 * HOUR_MS;

/** Client clocks may be slightly off, and offline reports can be hours old. */
const MAX_CAPTURE_AGE_MS = 2 * DAY_MS;
const MAX_CLOCK_SKEW_MS = 5 * MINUTE_MS;

module.exports = {
  MINUTE_MS,
  HOUR_MS,
  DAY_MS,
  EARLIER_TODAY_OFFSET_MS,
  MAX_CAPTURE_AGE_MS,
  MAX_CLOCK_SKEW_MS,
};
