import { MongoServerError, type Collection } from 'mongodb';
import type { Reading } from '../../types';
import type { AppConfig } from '../config';
import type { ReadingStore } from '../readings';
import { createMongoClient } from './client';

interface ReadingDocument {
  _id: string;
  deviceId: string;
  eventName: string;
  counter: number;
  publishedAt: Date;
  receivedAt: Date;
  expiresAt: Date;
}

export class MongoReadings implements ReadingStore {
  private client;
  private ready?: Promise<Collection<ReadingDocument>>;

  constructor(private config: AppConfig) {
    this.client = createMongoClient(config.mongoUri);
  }

  private collection(): Promise<Collection<ReadingDocument>> {
    this.ready ??= (async () => {
      await this.client.connect();
      const collection = this.client
        .db(this.config.mongoDatabase)
        .collection<ReadingDocument>('readings');
      await collection.createIndex({ deviceId: 1, eventName: 1, publishedAt: -1 });
      await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      return collection;
    })().catch((error) => {
      this.ready = undefined;
      throw error;
    });
    return this.ready;
  }

  async insert(reading: Reading) {
    const collection = await this.collection();
    try {
      await collection.insertOne({
        _id: reading.id,
        deviceId: reading.deviceId,
        eventName: reading.eventName,
        counter: reading.counter,
        publishedAt: new Date(reading.publishedAt),
        receivedAt: new Date(reading.receivedAt),
        expiresAt: new Date(Date.parse(reading.receivedAt) + this.config.retentionDays * 86_400_000)
      });
      return true;
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) return false;
      throw error;
    }
  }

  private filter() {
    return {
      deviceId: this.config.deviceId,
      eventName: this.config.eventName,
      expiresAt: { $gt: new Date() }
    };
  }

  async list(since: Date, limit: number) {
    const collection = await this.collection();
    const docs = await collection
      .find({ ...this.filter(), publishedAt: { $gte: since } })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .maxTimeMS(5000)
      .toArray();
    return docs.reverse().map(toReading);
  }

  async latest() {
    const collection = await this.collection();
    const doc = await collection.findOne(this.filter(), {
      sort: { publishedAt: -1 },
      maxTimeMS: 5000
    });
    return doc ? toReading(doc) : null;
  }
  async close() {
    await this.client.close();
  }
}

function toReading(doc: ReadingDocument): Reading {
  return {
    id: doc._id,
    deviceId: doc.deviceId,
    eventName: doc.eventName,
    counter: doc.counter,
    publishedAt: doc.publishedAt.toISOString(),
    receivedAt: doc.receivedAt.toISOString()
  };
}
