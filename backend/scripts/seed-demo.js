require('dotenv').config({ quiet: true });

const { loadConfig } = require('../src/config/env');
const { createLogger } = require('../src/utils/logger');
const { disconnectMongo } = require('../src/config/database');
const { seedMongo } = require('./seed-mongo');

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  try {
    const { users, password } = await seedMongo(config, logger);
    console.log('\n=============================================');
    console.log('WildGuard LK MongoDB Data Ready. Sign in with:');
    console.log('  Villager  : 0771234812            (Nimali Perera)');
    console.log(`  Officer   : ${users.officer.email}   (N. Perera, 3 GN divisions)`);
    console.log(`  Officer 2 : ${users.officerTissa.email}  (A. Fernando, Tissamaharama only)`);
    console.log(`  Manager   : ${users.manager.email}  (D. Wijesinghe, analytics)`);
    console.log(`  Password  : ${password}`);
    console.log('=============================================\n');
  } catch (err) {
    logger.error('Seed demo error', { message: err.message, stack: err.stack });
    process.exit(1);
  } finally {
    await disconnectMongo();
  }
}

main();
