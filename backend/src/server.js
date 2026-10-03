require('dotenv').config({ quiet: true });

const { loadConfig } = require('./config/env');
const { createSupabaseDependencies } = require('./config/supabase');
const { buildServices } = require('./container');
const { createApp } = require('./app');
const { createLogger } = require('./utils/logger');

const config = loadConfig();
const logger = createLogger(config.logLevel);

try {
  const { repositories, authGateway } = createSupabaseDependencies(config);
  const services = buildServices({ config, logger, repositories, authGateway });
  const app = createApp({ config, services, logger });

  const server = app.listen(config.port, () => {
    logger.info('WildGuard LK API listening', {
      port: config.port,
      env: config.nodeEnv,
      smsSimulator: config.smsSimulatorEnabled,
    });
  });

  const shutdown = () => {
    services.pendingQueue.stop();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  logger.error('Failed to start the API', { message: error.message });
  process.exit(1);
}
