import { describe, expect, it, vi } from 'vitest';
import { Collector } from '../src/lib/server/collector';
import { parseConfig } from '../src/lib/server/config';
import { MemoryReadings, normalizeEvent, type ReadingStore } from '../src/lib/server/readings';
import { WriteQueue } from '../src/lib/server/write-queue';
import { MockDevice } from '../src/lib/server/mock';

describe('collector lifecycle and bounded persistence', () => {
  it('records without a dashboard and stops its stream cleanly', async () => {
    const config = parseConfig({});
    const store = new MemoryReadings();
    const device = new MockDevice(config);
    const collector = new Collector(config, store, device);
    collector.start();
    await device.resetCounter();
    await vi.waitFor(() => expect(collector.status.saved).toBe(1));
    expect((await store.latest())?.counter).toBe(0);
    await collector.stop();
    expect(collector.status.connection).toBe('stopped');
    expect(collector.status.pending).toBe(0);
  });
  it('counts malformed events and continues processing', async () => {
    const config = parseConfig({});
    const store = new MemoryReadings();
    const collector = new Collector(config, store, new MockDevice(config));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    collector.accept({ event: config.eventName, data: '{' });
    collector.accept({
      event: config.eventName,
      data: JSON.stringify({
        coreid: config.deviceId,
        data: '12',
        published_at: new Date().toISOString()
      })
    });
    await collector.stop();
    expect(collector.status.rejected).toBe(1);
    expect(collector.status.saved).toBe(1);
    warn.mockRestore();
  });
  it('reconnects after interruption and aborts a pending retry on shutdown', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let connects = 0;
    const source = {
      async stream() {
        connects++;
        throw new Error('offline');
      }
    };
    const collector = new Collector(parseConfig({}), new MemoryReadings(), source);
    collector.start();
    await vi.advanceTimersByTimeAsync(1500);
    expect(connects).toBe(2);
    await collector.stop();
    expect(collector.status.connection).toBe('stopped');
    expect(collector.status.reconnects).toBe(2);
    warn.mockRestore();
    vi.useRealTimers();
  });
  it('drops overflow instead of growing memory and retries a failed database write', async () => {
    const config = parseConfig({});
    const collector = new Collector(config, new MemoryReadings(), new MockDevice(config));
    const insert = vi.fn().mockRejectedValueOnce(new Error('db offline')).mockResolvedValue(true);
    const store: ReadingStore = {
      insert,
      list: async () => [],
      latest: async () => null,
      close: async () => {}
    };
    const queue = new WriteQueue(store, collector.status, 1, 1);
    const reading = normalizeEvent(
      {
        event: config.eventName,
        data: JSON.stringify({
          coreid: config.deviceId,
          data: '1',
          published_at: new Date().toISOString()
        })
      },
      config.deviceId,
      config.eventName
    )!;
    queue.enqueue(reading);
    queue.enqueue(reading);
    await queue.stop();
    expect(insert).toHaveBeenCalledTimes(2);
    expect(collector.status.saved).toBe(1);
    expect(collector.status.dropped).toBe(1);
    expect(collector.status.pending).toBe(0);
  });
  it('drops a write after the retry budget is exhausted', async () => {
    const config = parseConfig({});
    const collector = new Collector(config, new MemoryReadings(), new MockDevice(config));
    const insert = vi.fn().mockRejectedValue(new Error('offline'));
    const store: ReadingStore = {
      insert,
      list: async () => [],
      latest: async () => null,
      close: async () => {}
    };
    const queue = new WriteQueue(store, collector.status, 5, 1);
    queue.enqueue({
      id: 'test',
      deviceId: config.deviceId,
      eventName: config.eventName,
      counter: 1,
      publishedAt: new Date().toISOString(),
      receivedAt: new Date().toISOString()
    });
    await queue.stop();
    expect(insert).toHaveBeenCalledTimes(3);
    expect(collector.status.dropped).toBe(1);
    expect(collector.status.storageError).toContain('Database write failed');
  });
});
