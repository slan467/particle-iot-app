import { MongoClient } from 'mongodb';

export function createMongoClient(uri: string) {
  try {
    return new MongoClient(uri, {
      appName: 'particle-iot-starter',
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 5000,
      waitQueueTimeoutMS: 5000
    });
  } catch {
    throw new Error('MONGODB_URI is invalid. Check the connection string format.');
  }
}
