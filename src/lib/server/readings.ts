import { createHash } from 'node:crypto';
import type { Reading } from '../types';
import type { StreamEvent } from './particle/events';
import { MAX_COUNTER } from './counter';

export interface ReadingStore {
  insert(reading: Reading): Promise<boolean>;
  list(since: Date, limit: number): Promise<Reading[]>;
  latest(): Promise<Reading | null>;
  close(): Promise<void>;
}

/** The counter-specific extension point to adapt for another sensor. */
export function normalizeEvent(
  event: StreamEvent,
  deviceId: string,
  eventName: string,
  now = new Date()
): Reading | null {
  if (event.event !== eventName) return null; // Particle filters prefixes, we require an exact match.
  const payload: unknown = JSON.parse(event.data);
  if (!payload || typeof payload !== 'object') throw new Error('Expected an event object.');
  const record = payload as Record<string, unknown>;
  if (record.coreid !== deviceId) return null;
  if (typeof record.data !== 'string' || !/^\d{1,10}$/.test(record.data))
    throw new Error('Expected an integer counter string.');
  const counter = Number(record.data);
  if (counter > MAX_COUNTER) throw new Error('Counter exceeds the firmware integer range.');
  if (typeof record.published_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(record.published_at))
    throw new Error('Missing publication timestamp.');
  const published = new Date(record.published_at);
  if (!Number.isFinite(published.getTime()) || published.getTime() > now.getTime() + 300_000)
    throw new Error('Invalid publication timestamp.');
  const publishedAt = published.toISOString();
  // Particle SSE has no guaranteed globally unique event ID. Identical observations collapse.
  const id = createHash('sha256')
    .update(JSON.stringify([deviceId, eventName, publishedAt, counter]))
    .digest('hex');
  return { id, deviceId, eventName, counter, publishedAt, receivedAt: now.toISOString() };
}

export class MemoryReadings implements ReadingStore {
  private records: Reading[] = [];
  async insert(reading: Reading) {
    if (this.records.some((record) => record.id === reading.id)) return false;
    this.records.push(reading);
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
