/** hh:mm:ss for a duration in milliseconds. */
export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** "350 m" below a kilometre, otherwise "1.25 km". */
export function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

/** "30 s", "2 min" for a retry countdown. */
export function formatWait(ms) {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return seconds < 90 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
}
