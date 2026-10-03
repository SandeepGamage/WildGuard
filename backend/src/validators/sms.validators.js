const { z } = require('zod');

const simulateSmsBody = z.object({
  phone: z.string().trim().min(6).max(20),
  message: z.string().trim().min(1).max(320),
});

module.exports = { simulateSmsBody };
