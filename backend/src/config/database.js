const mongoose = require('mongoose');

let isConnected = false;

/**
 * Connect to MongoDB database via Mongoose.
 * @param {string} uri MongoDB connection string.
 * @param {object} logger Logger instance.
 */
async function connectMongo(uri, logger) {
  if (isConnected || mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  mongoose.connection.on('connected', () => {
    logger?.info?.('Connected to MongoDB database');
    isConnected = true;
  });

  mongoose.connection.on('error', (err) => {
    logger?.error?.('MongoDB connection error', { message: err?.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger?.warn?.('MongoDB disconnected');
    isConnected = false;
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    autoIndex: true,
  });

  isConnected = true;
  return mongoose.connection;
}

/**
 * Disconnect from MongoDB.
 */
async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
  }
}

module.exports = { connectMongo, disconnectMongo };
