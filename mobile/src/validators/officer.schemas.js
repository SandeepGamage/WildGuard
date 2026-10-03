import { z } from 'zod';
import { REJECTION_REASONS, VERIFICATION_METHODS } from '../constants/domain';

export const verifySchema = z.object({
  method: z.enum(Object.values(VERIFICATION_METHODS)),
  notes: z.string().trim().max(1000, 'validation.notesTooLong').optional(),
  fieldActionRequired: z.boolean(),
});

/** Rejecting without a reason is not allowed: it is the audit trail. */
export const rejectSchema = z.object({
  reason: z.enum(Object.values(REJECTION_REASONS), { error: 'validation.reasonRequired' }),
  notes: z.string().trim().max(1000, 'validation.notesTooLong').optional(),
});
