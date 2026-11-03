import type { AppConfig } from './config';
import type { EventSource } from './collector';
import type { StreamEvent } from './particle/events';
import type { TrainingEventStore } from './training-events';
import { normalizeEvent } from './training-events';
import { pause } from './async';
import type { DeviceControl } from './hantel';
import { END_PAUSE_S } from '../training';

/** Ranges are [min, max] in milliseconds or repetitions. */
export interface MockTiming {
  /** Shorter first rest, so a fresh dashboard shows a set within seconds. */
  firstRestMs: [number, number];
  restMs: [number, number];
  repMs: [number, number];
  repsPerSet: [number, number];
  endPauseMs: number;
}

const DEFAULT_TIMING: MockTiming = {
  firstRestMs: [3000, 6000],
  restMs: [20_000, 40_000],
  repMs: [1500, 2500],
  repsPerSet: [8, 15],
  endPauseMs: END_PAUSE_S * 1000
};
/** Firmware START_MIN_REPS: a set is only recognized from this repetition on. */
const START_MIN_REPS = 3;

/** Simulates the dumbbell firmware, not a second set of browser-side fake readings. */
export class MockDevice implements EventSource, DeviceControl {
  private total = 0;
  private repetitions = 0;
  private publish?: (event: StreamEvent) => void;

  constructor(
    private config: AppConfig,
    private timing = DEFAULT_TIMING,
    private random = Math.random
  ) {}

  private between([min, max]: [number, number]) {
    return Math.round(min + this.random() * (max - min));
  }

  private event(data: Record<string, unknown>, at = new Date()): StreamEvent {
    return {
      event: this.config.eventName,
      data: JSON.stringify({
        coreid: this.config.deviceId,
        data: JSON.stringify(data),
        published_at: at.toISOString()
      })
    };
  }

  /** Fifteen earlier sets, roughly two per day over the last week. */
  async seed(store: TrainingEventStore) {
    const now = Date.now();
    let total = 1000;
    for (let index = 14; index >= 0; index--) {
      const reps = 8 + ((index * 5) % 8);
      // Paces between 1.6 and 2.4 seconds per repetition.
      const duration = Math.round((reps - 1) * (1.6 + (index % 5) * 0.2));
      const end = now - index * 11 * 3600_000 - 30 * 60_000;
      const start = end - (duration + END_PAUSE_S) * 1000 + 4000;
      total += reps;
      for (const [data, at] of [
        [{ type: 'start', total: total - reps + START_MIN_REPS }, start],
        [{ type: 'end', reps, duration, total }, end]
      ] as const) {
        const event = this.event(data, new Date(at));
        await store.insert(normalizeEvent(event, this.config.deviceId, this.config.eventName)!);
      }
    }
    this.total = total;
  }

  async stream(signal: AbortSignal, publish: (event: StreamEvent) => void, connected: () => void) {
    this.publish = publish;
    connected();
    try {
      let rest = this.timing.firstRestMs;
      while (!signal.aborted) {
        await pause(this.between(rest), signal);
        if (!signal.aborted) await this.runSet(signal);
        rest = this.timing.restMs;
      }
    } finally {
      this.publish = undefined;
      this.repetitions = 0;
    }
  }

  /** Same rules as the firmware: start at the third repetition, end after a pause. */
  private async runSet(signal: AbortSignal) {
    const target = this.between(this.timing.repsPerSet);
    const first = Date.now();
    let last = first;
    for (let rep = 1; rep <= target; rep++) {
      if (rep > 1) await pause(this.between(this.timing.repMs), signal);
      if (signal.aborted) return;
      last = Date.now();
      if (rep < START_MIN_REPS) continue;
      if (rep === START_MIN_REPS) {
        this.total += START_MIN_REPS; // repetitions before the start count as well
        this.publish?.(this.event({ type: 'start', total: this.total }));
      } else {
        this.total++;
      }
      this.repetitions = rep;
    }
    await pause(this.timing.endPauseMs, signal);
    if (signal.aborted) return;
    const duration = Math.floor((last - first) / 1000);
    this.publish?.(this.event({ type: 'end', reps: target, duration, total: this.total }));
    this.repetitions = 0;
  }

  async readState() {
    return { repetitions: this.repetitions, totalCount: this.total, sensorOk: true };
  }

  async resetTotal() {
    this.total = 0;
    return 0;
  }
}
