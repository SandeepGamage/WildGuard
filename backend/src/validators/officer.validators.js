const { z } = require('zod');
const { enumOf, pagination } = require('./common');
const { VERIFICATION_METHODS, REJECTION_REASONS, VERIFICATION_DECISIONS } = require('../constants/domain');

const verifyBody = z.object({
  method: enumOf(VERIFICATION_METHODS),
  notes: z.string().trim().max(1000).optional(),
  fieldActionRequired: z.boolean().default(false),
});

const rejectBody = z.object({
  reason: enumOf(REJECTION_REASONS),
  notes: z.string().trim().max(1000).optional(),
});

const historyQuery = pagination.extend({
  decision: enumOf(VERIFICATION_DECISIONS).optional(),
});

module.exports = { verifyBody, rejectBody, historyQuery };
