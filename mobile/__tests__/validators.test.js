import { createAccountSchema, signInSchema } from '../src/validators/auth.schemas';
import { rejectSchema, verifySchema } from '../src/validators/officer.schemas';
import { reportDraftSchema } from '../src/validators/report.schema';
import { smsSimulatorSchema } from '../src/validators/sms.schema';

const messages = (result) => result.error.issues.map((issue) => issue.message);

describe('sign in', () => {
  it('accepts a mobile number or an email', () => {
    expect(signInSchema.safeParse({ account: '0771234567', password: 'x' }).success).toBe(true);
    expect(signInSchema.safeParse({ account: 'officer@wildguard.example', password: 'x' }).success).toBe(
      true,
    );
  });

  it('rejects an empty or malformed account and a missing password', () => {
    const result = signInSchema.safeParse({ account: 'abc', password: '' });
    expect(messages(result)).toEqual(['validation.accountInvalid', 'validation.passwordRequired']);
  });
});

describe('create account', () => {
  const valid = {
    fullName: 'Nimali Perera',
    phone: '077 123 4567',
    villageId: 'village-1',
    password: 'longenough',
    consent: true,
  };

  it('accepts valid details', () => {
    expect(createAccountSchema.safeParse(valid).success).toBe(true);
  });

  it('requires consent, a valid phone, a village and 8+ characters', () => {
    const result = createAccountSchema.safeParse({
      ...valid,
      phone: '123',
      villageId: '',
      password: 'short',
      consent: false,
    });
    expect(messages(result)).toEqual(
      expect.arrayContaining([
        'validation.phoneInvalid',
        'validation.villageRequired',
        'validation.passwordLength',
        'validation.consentRequired',
      ]),
    );
  });
});

describe('report draft', () => {
  const base = { incidentType: 'ELEPHANT_NEAR_VILLAGE', occurredWhen: 'NOW', elephantCountBand: '1' };

  it('needs a location: either a village or GPS coordinates', () => {
    expect(messages(reportDraftSchema.safeParse(base))).toContain('validation.locationRequired');
    expect(reportDraftSchema.safeParse({ ...base, villageId: 'v' }).success).toBe(true);
    expect(
      reportDraftSchema.safeParse({ ...base, coordinates: { latitude: 6.3, longitude: 81.3 } }).success,
    ).toBe(true);
  });

  it('needs the elephant count only for elephant reports', () => {
    const noCount = { incidentType: 'ELEPHANT_NEAR_VILLAGE', occurredWhen: 'NOW', villageId: 'v' };
    expect(messages(reportDraftSchema.safeParse(noCount))).toContain('validation.countRequired');
    expect(reportDraftSchema.safeParse({ ...noCount, incidentType: 'CROP_DAMAGE' }).success).toBe(true);
  });

  it('rejects out-of-range coordinates and unknown categories', () => {
    expect(
      reportDraftSchema.safeParse({ ...base, coordinates: { latitude: 120, longitude: 0 } }).success,
    ).toBe(false);
    expect(reportDraftSchema.safeParse({ ...base, villageId: 'v', incidentType: 'DRAGON' }).success).toBe(
      false,
    );
  });
});

describe('officer decisions', () => {
  it('rejecting requires a reason from the list', () => {
    expect(messages(rejectSchema.safeParse({ notes: 'no reason' }))).toEqual(['validation.reasonRequired']);
    expect(rejectSchema.safeParse({ reason: 'OTHER' }).success).toBe(true);
  });

  it('verifying requires a method and limits notes to 1000 characters', () => {
    expect(verifySchema.safeParse({ fieldActionRequired: false }).success).toBe(false);
    expect(
      verifySchema.safeParse({ method: 'SITE_VISIT', fieldActionRequired: true, notes: 'x'.repeat(1001) })
        .success,
    ).toBe(false);
    expect(verifySchema.safeParse({ method: 'SITE_VISIT', fieldActionRequired: true }).success).toBe(true);
  });
});

describe('sms simulator form', () => {
  it('needs a valid phone and some text', () => {
    expect(smsSimulatorSchema.safeParse({ phone: '0701112233', message: 'ALIYA PALATUPANA' }).success).toBe(
      true,
    );
    expect(smsSimulatorSchema.safeParse({ phone: 'x', message: '' }).success).toBe(false);
  });
});
