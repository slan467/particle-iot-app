import type { AppConfig } from './config';
import type { EventSource } from './collector';
import type { StreamEvent } from './particle/events';
import type { ReadingStore } from './readings';
import { normalizeEvent } from './readings';
import { pause } from './async';
import { MAX_COUNTER } from './counter';

/** Simulates the firmware, not a second set of browser-side fake readings. */
export class MockDevice implements EventSource {
  private counter = 6000;
  private publish?: (event: StreamEvent) => void;
  constructor(private config: AppConfig) {}

  private event(counter: number, at = new Date()): StreamEvent {
    return {
      event: this.config.eventName,
      data: JSON.stringify({
        coreid: this.config.deviceId,
        data: String(counter),
        published_at: at.toISOString()
      })
    };
  }

  async seed(store: ReadingStore) {
    const now = Date.now();
    for (let index = 1; index <= 60; index++) {
      const reading = normalizeEvent(
        this.event(index * 100, new Date(now - (60 - index) * 10_000)),
        this.config.deviceId,
        this.config.eventName
      )!;
      await store.insert(reading);
    }
  }

  async stream(signal: AbortSignal, publish: (event: StreamEvent) => void, connected: () => void) {
    this.publish = publish;
    connected();
    try {
      while (!signal.aborted) {
        await pause(100, signal);
        if (signal.aborted) break;
        if (this.counter < MAX_COUNTER) {
          this.counter++;
          if (this.counter % 100 === 0) publish(this.event(this.counter));
        }
      }
    } finally {
      this.publish = undefined;
    }
  }
  async readCounter() {
    return this.counter;
  }
  async resetCounter() {
    this.counter = 0;
    this.publish?.(this.event(0));
    return 0;
  }
}
