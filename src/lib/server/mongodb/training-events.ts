import { MongoServerError, type Collection } from 'mongodb';
import type { TrainingEvent, TrainingEventType } from '../../types';
import type { AppConfig } from '../config';
import type { TrainingEventStore } from '../training-events';
import { createMongoClient } from './client';

interface TrainingEventDocument {
  _id: string;
  deviceId: string;
  eventName: string;
  type: TrainingEventType;
  reps: number | null;
  durationS: number | null;
  total: number;
  publishedAt: Date;
  receivedAt: Date;
  expiresAt: Date;
}

/**
 * Dumbbell events live in their own collection. Counter records from the
 * original template stay untouched in `readings` and are not reinterpreted.
 */
export class MongoTrainingEvents implements TrainingEventStore {
  private client;
  private ready?: Promise<Collection<TrainingEventDocument>>;

  constructor(private config: AppConfig) {
    this.client = createMongoClient(config.mongoUri);
  }

  private collection(): Promise<Collection<TrainingEventDocument>> {
    this.ready ??= (async () => {
      await this.client.connect();
      const collection = this.client
        .db(this.config.mongoDatabase)
        .collection<TrainingEventDocument>('training_events');
      await collection.createIndex({ deviceId: 1, eventName: 1, publishedAt: -1 });
      await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      return collection;
    })().catch((error) => {
      this.ready = undefined;
      throw error;
    });
    return this.ready;
  }

  async insert(event: TrainingEvent) {
    const collection = await this.collection();
    try {
      await collection.insertOne({
        _id: event.id,
        deviceId: event.deviceId,
        eventName: event.eventName,
        type: event.type,
        reps: event.reps,
        durationS: event.durationS,
        total: event.total,
        publishedAt: new Date(event.publishedAt),
        receivedAt: new Date(event.receivedAt),
        expiresAt: new Date(Date.parse(event.receivedAt) + this.config.retentionDays * 86_400_000)
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
    return docs.reverse().map(toEvent);
  }

  async latest() {
    const collection = await this.collection();
    const doc = await collection.findOne(this.filter(), {
      sort: { publishedAt: -1 },
      maxTimeMS: 5000
    });
    return doc ? toEvent(doc) : null;
  }
  async close() {
    await this.client.close();
  }
}

function toEvent(doc: TrainingEventDocument): TrainingEvent {
  return {
    id: doc._id,
    deviceId: doc.deviceId,
    eventName: doc.eventName,
    type: doc.type,
    reps: doc.reps,
    durationS: doc.durationS,
    total: doc.total,
    publishedAt: doc.publishedAt.toISOString(),
    receivedAt: doc.receivedAt.toISOString()
  };
}
