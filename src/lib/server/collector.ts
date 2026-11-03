import type { CollectorStatus } from '../types';
import type { AppConfig } from './config';
import { pause } from './async';
import { connectionMessage, ParticleError } from './particle/errors';
import type { StreamEvent } from './particle/events';
import { normalizeEvent, type ReadingStore } from './readings';
import { WriteQueue } from './write-queue';

export interface EventSource {
  stream(
    signal: AbortSignal,
    onEvent: (event: StreamEvent) => void,
    onConnected: () => void
  ): Promise<void>;
}

export class Collector {
  readonly status: CollectorStatus;
  private controller = new AbortController();
  private task?: Promise<void>;
  private writer: WriteQueue;

  constructor(
    private config: AppConfig,
    store: ReadingStore,
    private source: EventSource
  ) {
    this.status = {
      mode: config.mode,
      connection: 'starting',
      storage: config.mode === 'mock' ? 'memory' : 'mongodb',
      startedAt: new Date().toISOString(),
      lastEventAt: null,
      lastWriteAt: null,
      connectionError: null,
      storageError: null,
      received: 0,
      saved: 0,
      rejected: 0,
      duplicates: 0,
      dropped: 0,
      pending: 0,
      reconnects: 0
    };
    this.writer = new WriteQueue(store, this.status);
  }

  start() {
    this.task ??= this.run();
  }

  accept = (event: StreamEvent) => {
    try {
      const reading = normalizeEvent(event, this.config.deviceId, this.config.eventName);
      if (!reading) return;
      this.status.received++;
      this.status.lastEventAt = reading.receivedAt;
      this.writer.enqueue(reading);
    } catch {
      this.status.rejected++;
      console.warn('[collector] Rejected a malformed event. Check the firmware payload contract.');
    }
  };

  private async run() {
    let attempts = 0;
    while (!this.controller.signal.aborted) {
      this.status.connection = 'connecting';
      const connectedAt = Date.now();
      let delay = 0;
      try {
        await this.source.stream(this.controller.signal, this.accept, () => {
          this.status.connection = 'connected';
          this.status.connectionError = null;
        });
      } catch (error) {
        if (this.controller.signal.aborted) break;
        this.status.connectionError = connectionMessage(error);
        if (error instanceof ParticleError) {
          delay = Math.max(
            error.retryAfterMs,
            [401, 403, 429, 529].includes(error.status) ? 60_000 : 0
          );
        }
      }
      if (this.controller.signal.aborted) break;
      if (Date.now() - connectedAt > 60_000) attempts = 0;
      delay = Math.max(delay, Math.min(30_000, 1000 * 2 ** Math.min(attempts++, 5)));
      delay += Math.floor(Math.random() * delay * 0.2);
      this.status.connection = 'retrying';
      this.status.connectionError ??= 'Event stream closed. Reconnecting automatically.';
      this.status.reconnects++;
      console.warn(`[collector] ${this.status.connectionError}`);
      await pause(delay, this.controller.signal);
    }
    this.status.connection = 'stopped';
  }

  async stop() {
    this.controller.abort();
    await this.task;
    await this.writer.stop();
    this.status.connection = 'stopped';
  }
}
