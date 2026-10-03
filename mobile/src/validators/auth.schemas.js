import { z } from 'zod';
import { accountToLoginEmail, normalizePhone } from '../utils/phone';

/** Messages are translation keys; screens pass them through `t()`. */
export const signInSchema = z.object({
  account: z
    .string()
    .trim()
    .min(1, 'validation.accountRequired')
    .refine((value) => accountToLoginEmail(value) !== null, 'validation.accountInvalid'),
  password: z.string().min(1, 'validation.passwordRequired'),
});

export const createAccountSchema = z.object({
  fullName: z.string().trim().min(2, 'validation.nameRequired').max(120, 'validation.nameRequired'),
  phone: z.string().refine((value) => normalizePhone(value) !== null, 'validation.phoneInvalid'),
  villageId: z.string().min(1, 'validation.villageRequired'),
  password: z.string().min(8, 'validation.passwordLength').max(72, 'validation.passwordLength'),
  consent: z.boolean().refine((value) => value === true, 'validation.consentRequired'),
});
