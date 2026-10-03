const { z } = require('zod');
const { uuid, enumOf } = require('./common');
const { LANGUAGES } = require('../constants/domain');
const { normalizePhone } = require('../utils/phone');

const registerBody = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (!phone) ctx.addIssue({ code: 'custom', message: 'Enter a valid mobile number.' });
    return phone;
  }),
  villageId: uuid,
  password: z.string().min(8).max(72),
  language: enumOf(LANGUAGES).default(LANGUAGES.EN),
  consent: z.literal(true),
});

module.exports = { registerBody };
