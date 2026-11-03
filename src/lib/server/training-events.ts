import { createHash } from 'node:crypto';
import type { TrainingEvent } from '../types';
import type { StreamEvent } from './particle/events';
import { isInteger, MAX_DURATION_S, MAX_INT, MAX_REPS } from './hantel';

export interface TrainingEventStore {
  insert(event: TrainingEvent): Promise<boolean>;
  list(since: Date, limit: number): Promise<TrainingEvent[]>;
  latest(): Promise<TrainingEvent | null>;
  close(): Promise<void>;
}

/**
 * The dumbbell-specific extension point. Firmware publishes JSON in `data`:
 * `{"type":"start","total":123}` or `{"type":"end","reps":12,"duration":25,"total":135}`.
 */
export function normalizeEvent(
  event: StreamEvent,
  deviceId: string,
  eventName: string,
  now = new Date()
): TrainingEvent | null {
  if (event.event !== eventName) return null; // Particle filters prefixes, we require an exact match.
  const envelope: unknown = JSON.parse(event.data);
  if (!envelope || typeof envelope !== 'object') throw new Error('Expected an event object.');
  const record = envelope as Record<string, unknown>;
  if (record.coreid !== deviceId) return null;
  if (typeof record.data !== 'string' || record.data.length > 1024)
    throw new Error('Expected a JSON string payload.');
  const payload: unknown = JSON.parse(record.data);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    throw new Error('Expected a training payload object.');
  const data = payload as Record<string, unknown>;
  if (data.type !== 'start' && data.type !== 'end') throw new Error('Unknown training type.');
  if (!isInteger(data.total, 0, MAX_INT)) throw new Error('Invalid total count.');
  let reps: number | null = null;
  let durationS: number | null = null;
  if (data.type === 'end') {
    if (!isInteger(data.reps, 1, MAX_REPS)) throw new Error('Invalid repetitions.');
    if (!isInteger(data.duration, 0, MAX_DURATION_S)) throw new Error('Invalid duration.');
    reps = data.reps;
    durationS = data.duration;
  }
  if (typeof record.published_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(record.published_at))
    throw new Error('Missing publication timestamp.');
  const published = new Date(record.published_at);
  if (!Number.isFinite(published.getTime()) || published.getTime() > now.getTime() + 300_000)
    throw new Error('Invalid publication timestamp.');
  const publishedAt = published.toISOString();
  // Particle SSE has no guaranteed globally unique event ID. Identical observations collapse.
  const id = createHash('sha256')
    .update(
      JSON.stringify([deviceId, eventName, publishedAt, data.type, reps, durationS, data.total])
    )
    .digest('hex');
  return {
    id,
    deviceId,
    eventName,
    type: data.type,
    reps,
    durationS,
    total: data.total,
    publishedAt,
    receivedAt: now.toISOString()
  };
}

export class MemoryTrainingEvents implements TrainingEventStore {
  private records: TrainingEvent[] = [];
  async insert(event: TrainingEvent) {
    if (this.records.some((record) => record.id === event.id)) return false;
    this.records.push(event);
    this.records = this.records.slice(-2000);
    return true;
  }
  async list(since: Date, limit: number) {
    return this.records
      .filter((r) => Date.parse(r.publishedAt) >= since.getTime())
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, limit)
      .reverse();
  }
  async latest() {
    return [...this.records].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0] ?? null;
  }
  async close() {}
}
