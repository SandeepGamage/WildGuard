const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const clockTime = (date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * "5 mins ago", "1h 22m ago", "2 days ago". Pass the i18next `t` function.
 */
export function formatTimeAgo(iso, t, now = Date.now()) {
  const elapsed = Math.max(0, now - new Date(iso).getTime());
  if (elapsed < MINUTE) return t('time.justNow');
  if (elapsed < HOUR) return t('time.minutesAgo', { count: Math.floor(elapsed / MINUTE) });
  if (elapsed < DAY) {
    return t('time.hoursMinutesAgo', {
      hours: Math.floor(elapsed / HOUR),
      minutes: Math.floor((elapsed % HOUR) / MINUTE),
    });
  }
  return t('time.daysAgo', { count: Math.floor(elapsed / DAY) });
}

/**
 * "Today, 6:42 PM" / "Yesterday 5:32 PM" / "Yesterday" style stamps.
 */
export function formatDayAndTime(iso, t, { withTime = true, now = Date.now() } = {}) {
  const date = new Date(iso);
  const dayDiff = Math.round((startOfDay(new Date(now)) - startOfDay(date)) / DAY);
  let day;
  if (dayDiff <= 0) day = t('time.today');
  else if (dayDiff === 1) day = t('time.yesterday');
  else return t('time.daysAgo', { count: dayDiff });
  return withTime ? `${day}, ${clockTime(date)}` : day;
}

/** "Good morning" / "Good afternoon" / "Good evening" translation key. */
export function greetingKey(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'time.goodMorning';
  if (hour < 17) return 'time.goodAfternoon';
  return 'time.goodEvening';
}
