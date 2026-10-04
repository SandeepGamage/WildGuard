require('dotenv').config({ quiet: true });

const { loadConfig } = require('./config/env');
const { createMongoDependencies } = require('./config/mongo');
const { disconnectMongo } = require('./config/database');
const { Village } = require('./models/mongo/schemas');
const { seedReferenceData } = require('../scripts/seed-mongo');
const { buildServices } = require('./container');
const { createApp } = require('./app');
const { createLogger } = require('./utils/logger');

const config = loadConfig();
const logger = createLogger(config.logLevel);

async function start() {
  try {
    const { repositories, authGateway } = await createMongoDependencies({ config, logger });

    // Auto-seed initial reference data if villages collection is empty
    try {
      const villageCount = await Village.countDocuments();
      if (villageCount === 0) {
        logger.info('Initializing MongoDB with reference data (villages, sectors, divisions)...');
        await seedReferenceData();
        logger.info('Reference data initialized successfully.');
      }
    } catch (seedErr) {
      logger.warn('Could not verify/seed initial reference data', { message: seedErr.message });
    }

    const services = buildServices({ config, logger, repositories, authGateway });
    const app = createApp({ config, services, logger });

    const server = app.listen(config.port, '0.0.0.0', () => {
      logger.info('WildGuard LK API listening with MongoDB data storage', {
        port: config.port,
        env: config.nodeEnv,
        database: 'MongoDB',
        photoStorage: 'Supabase Storage',
        smsSimulator: config.smsSimulatorEnabled,
      });
    });

    const shutdown = async () => {
      logger.info('Shutting down API server...');
      services.pendingQueue.stop();
      await disconnectMongo();
      server.close(() => process.exit(0));
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    if (
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('querySrv') ||
      error.name === 'MongooseServerSelectionError'
    ) {
      logger.error('Could not connect to MongoDB database', {
        message: error.message,
        hint: 'Please set MONGODB_URI in backend/.env to your MongoDB Atlas connection string (e.g. mongodb+srv://<user>:<password>@cluster.mongodb.net/wildguard).',
      });
    } else {
      logger.error('Failed to start the API', { message: error.message, stack: error.stack });
    }
    process.exit(1);
  }
}

start();
