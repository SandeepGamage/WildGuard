import { z } from 'zod';
import { normalizePhone } from '../utils/phone';

export const smsSimulatorSchema = z.object({
  phone: z.string().refine((value) => normalizePhone(value) !== null, 'validation.phoneInvalid'),
  message: z.string().trim().min(1, 'validation.messageRequired').max(320, 'validation.messageRequired'),
});
