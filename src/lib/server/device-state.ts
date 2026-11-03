import type { DeviceState } from '../types';
import type { DeviceReading } from './hantel';

export class BudgetExceeded extends Error {
  constructor() {
    super('Device request limit reached.');
  }
}

/**
 * Shares one device read between all open dashboards for a few seconds.
 * Only a real device request consumes the command budget.
 */
export class DeviceStateCache {
  private cached?: DeviceState;
  private pending?: Promise<DeviceState>;

  constructor(
    private read: () => Promise<DeviceReading>,
    private ttlMs = 5000,
    private clock = Date.now
  ) {}

  get(takeBudget: () => boolean): Promise<DeviceState> {
    if (this.cached && this.clock() - Date.parse(this.cached.readAt) < this.ttlMs)
      return Promise.resolve(this.cached);
    if (this.pending) return this.pending;
    if (!takeBudget()) return Promise.reject(new BudgetExceeded());
    this.pending = this.read()
      .then((reading) => {
        this.cached = { ...reading, readAt: new Date(this.clock()).toISOString() };
        return this.cached;
      })
      .finally(() => {
        this.pending = undefined;
      });
    return this.pending;
  }

  /** Call after a command that changes device state. */
  invalidate() {
    this.cached = undefined;
  }
}
