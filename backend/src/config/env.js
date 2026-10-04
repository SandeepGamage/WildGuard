const { z } = require('zod');

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  SUPABASE_STORAGE_BUCKET: z.string().default('incident-photos'),
  CORS_ORIGINS: z.string().default(''),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PHONE_LOGIN_EMAIL_DOMAIN: z.string().default('phone.wildguard.example'),
  SMS_SIMULATOR_ENABLED: booleanFromString.optional(),
  DEMO_USER_PASSWORD: z.string().default(''),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/wildguard'),
  JWT_SECRET: z.string().default('wildguard-lk-secret-jwt-key-32chars-min'),
});

/**
 * Parse and normalise environment variables into an immutable config object.
 * @param {NodeJS.ProcessEnv} source
 */
function loadConfig(source = process.env) {
  const env = envSchema.parse(source);
  const isProduction = env.NODE_ENV === 'production';

  return Object.freeze({
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    isProduction,
    mongodbUri: env.MONGODB_URI,
    jwtSecret: env.JWT_SECRET,
    supabase: Object.freeze({
      url: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      storageBucket: env.SUPABASE_STORAGE_BUCKET,
    }),
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    rateLimit: Object.freeze({ windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX }),
    logLevel: env.LOG_LEVEL,
    phoneLoginEmailDomain: env.PHONE_LOGIN_EMAIL_DOMAIN,
    smsSimulatorEnabled: env.SMS_SIMULATOR_ENABLED ?? !isProduction,
    demoUserPassword: env.DEMO_USER_PASSWORD,
  });
}

module.exports = { loadConfig };
