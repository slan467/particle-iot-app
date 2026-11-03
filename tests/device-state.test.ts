import { describe, expect, it, vi } from 'vitest';
import { BudgetExceeded, DeviceStateCache } from '../src/lib/server/device-state';

const reading = { repetitions: 3, totalCount: 120, sensorOk: true };

describe('shared device state cache', () => {
  it('shares one device request between concurrent and repeated reads', async () => {
    let now = 1_000_000;
    const read = vi.fn().mockResolvedValue(reading);
    const take = vi.fn().mockReturnValue(true);
    const cache = new DeviceStateCache(read, 5000, () => now);
    const [first, second] = await Promise.all([cache.get(take), cache.get(take)]);
    expect(first).toEqual({ ...reading, readAt: new Date(1_000_000).toISOString() });
    expect(second).toBe(first);
    now += 4999;
    await cache.get(take);
    expect(read).toHaveBeenCalledTimes(1);
    expect(take).toHaveBeenCalledTimes(1);
    now += 1;
    await cache.get(take);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('only consumes the budget for a real request and refuses when it is exhausted', async () => {
    const read = vi.fn().mockResolvedValue(reading);
    const cache = new DeviceStateCache(read);
    await expect(cache.get(() => false)).rejects.toBeInstanceOf(BudgetExceeded);
    expect(read).not.toHaveBeenCalled();
  });
  it('does not cache failures and rereads after invalidation', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(reading);
    const cache = new DeviceStateCache(read);
    await expect(cache.get(() => true)).rejects.toThrow('offline');
    await cache.get(() => true);
    cache.invalidate();
    await cache.get(() => true);
    expect(read).toHaveBeenCalledTimes(3);
  });
});
