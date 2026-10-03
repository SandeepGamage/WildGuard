import { USER_ROLES } from '../src/constants/domain';
import { ROUTES } from '../src/constants/routes';
import { accountToLoginEmail, maskPhone, normalizePhone } from '../src/utils/phone';
import { homeRouteForRole } from '../src/utils/roleRoute';
import { formatDayAndTime, formatTimeAgo, greetingKey } from '../src/utils/time';
import { villageName } from '../src/utils/villageName';
import i18n from '../src/i18n';

const t = i18n.t.bind(i18n);

describe('role routing', () => {
  it('sends each role to its own interface', () => {
    expect(homeRouteForRole(USER_ROLES.VILLAGER)).toBe(ROUTES.villager.home);
    expect(homeRouteForRole(USER_ROLES.COMMUNITY_LIAISON_OFFICER)).toBe(ROUTES.liaison.queue);
  });

  it('has no mobile interface for other roles', () => {
    expect(homeRouteForRole(USER_ROLES.FIELD_RANGER)).toBeNull();
    expect(homeRouteForRole(undefined)).toBeNull();
  });
});

describe('phone helpers', () => {
  it('normalises Sri Lankan mobile numbers', () => {
    expect(normalizePhone('+94 77 123 4567')).toBe('0771234567');
    expect(normalizePhone('077-123-4567')).toBe('0771234567');
    expect(normalizePhone('12345')).toBeNull();
  });

  it('maps a mobile number to the pseudo-email used by Supabase Auth, and keeps real emails', () => {
    expect(accountToLoginEmail('077 123 4567')).toBe('0771234567@phone.wildguard.example');
    expect(accountToLoginEmail(' Officer@Example.com ')).toBe('officer@example.com');
    expect(accountToLoginEmail('nonsense')).toBeNull();
  });

  it('masks a number for display', () => {
    expect(maskPhone('0771234812')).toBe('077 *** 812');
    expect(maskPhone('')).toBe('');
  });
});

describe('time formatting', () => {
  const now = new Date('2026-05-02T12:00:00.000Z').getTime();
  const ago = (ms) => new Date(now - ms).toISOString();

  it('formats relative times', () => {
    expect(formatTimeAgo(ago(30 * 1000), t, now)).toBe('just now');
    expect(formatTimeAgo(ago(5 * 60 * 1000), t, now)).toBe('5 mins ago');
    expect(formatTimeAgo(ago((60 + 22) * 60 * 1000), t, now)).toBe('1h 22m');
    expect(formatTimeAgo(ago(2 * 24 * 60 * 60 * 1000), t, now)).toBe('2 days ago');
  });

  it('labels today and yesterday', () => {
    expect(formatDayAndTime(new Date(now).toISOString(), t, { withTime: false, now })).toBe('Today');
    expect(formatDayAndTime(ago(24 * 60 * 60 * 1000), t, { withTime: false, now })).toBe('Yesterday');
  });

  it('picks a greeting by hour', () => {
    expect(greetingKey(new Date(2026, 0, 1, 8))).toBe('time.goodMorning');
    expect(greetingKey(new Date(2026, 0, 1, 14))).toBe('time.goodAfternoon');
    expect(greetingKey(new Date(2026, 0, 1, 20))).toBe('time.goodEvening');
  });
});

describe('villageName', () => {
  const village = { nameEn: 'Kirinda', nameSi: 'කිරින්ද', nameTa: null };
  it('uses the active language and falls back to English', () => {
    expect(villageName(village, 'si')).toBe('කිරින්ද');
    expect(villageName(village, 'ta')).toBe('Kirinda');
    expect(villageName(null, 'en')).toBe('');
  });
});
