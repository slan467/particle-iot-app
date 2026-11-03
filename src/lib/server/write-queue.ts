import type { Reading, CollectorStatus } from '../types';
import type { ReadingStore } from './readings';
import { pause } from './async';

/** One writer, capped memory, bounded retries. This is not a durable message broker. */
export class WriteQueue {
  private items: Reading[] = [];
  private running?: Promise<void>;
  private accepting = true;
  private abort = new AbortController();

  constructor(
    private store: ReadingStore,
    private status: CollectorStatus,
    private capacity = 100,
    private retryDelayMs = 1000
  ) {}

  enqueue(reading: Reading) {
    if (!this.accepting || this.status.pending >= this.capacity) {
      this.status.dropped++;
      this.status.storageError = 'Write queue is full or stopping. A reading was dropped.';
      return;
    }
    this.items.push(reading);
    this.status.pending++;
    this.kick();
  }

  private kick() {
    this.running ??= this.flush().finally(() => {
      this.running = undefined;
      // An event may have arrived between flush completion and this microtask.
      if (this.items.length && !this.abort.signal.aborted) this.kick();
    });
  }

  private async flush() {
    while (this.items.length && !this.abort.signal.aborted) {
      const reading = this.items.shift()!;
      let completed = false;
      for (let attempt = 0; attempt < 3 && !this.abort.signal.aborted; attempt++) {
        try {
          const inserted = await this.store.insert(reading);
          if (inserted) this.status.saved++;
          else this.status.duplicates++;
          this.status.lastWriteAt = new Date().toISOString();
          this.status.storageError = null;
          completed = true;
          break;
        } catch {
          this.status.storageError =
            'Database write failed. Check MongoDB configuration and network access.';
          if (attempt < 2) await pause(this.retryDelayMs * 2 ** attempt, this.abort.signal);
        }
      }
      if (!completed) this.status.dropped++;
      this.status.pending--;
    }
    this.status.dropped += this.items.length;
    this.status.pending -= this.items.length;
    this.items = [];
  }

  async stop(timeoutMs = 8000) {
    this.accepting = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      this.running,
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          this.abort.abort();
          resolve();
        }, timeoutMs);
      })
    ]);
    clearTimeout(timer);
    this.abort.abort();
  }
}
