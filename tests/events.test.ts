import { describe, expect, it } from 'vitest';
import { EventParser } from '../src/lib/server/particle/events';
import { normalizeEvent, MemoryReadings } from '../src/lib/server/readings';

const device = '0123456789abcdef01234567';
const published = '2026-01-01T12:00:00.000Z';
const now = new Date('2026-01-01T12:00:01.000Z');
const event = (data = '42') => ({
  event: 'CounterEvent',
  data: JSON.stringify({ coreid: device, data, published_at: published })
});

describe('Particle event stream', () => {
  it('reassembles arbitrary chunks, CRLF, multiline data and heartbeats', () => {
    const parser = new EventParser();
    expect(parser.push(':ok\r\n\r\nevent: CounterEv')).toEqual([]);
    expect(parser.push('ent\r\ndata: first\r\ndata: sec')).toEqual([]);
    expect(parser.push('ond\r\nid: 123\r\n\r\n')).toEqual([
      { event: 'CounterEvent', data: 'first\nsecond', id: '123' }
    ]);
    expect(parser.push(':keepalive\n\nevent: empty\n\n')).toEqual([]);
  });
  it('bounds untrusted stream frames', () => {
    expect(() => new EventParser().push('data: ' + 'x'.repeat(70_000))).toThrow('size limit');
  });
  it('keeps device filtering, exact event matching and numeric conversion on the server', () => {
    const result = normalizeEvent(event(), device, 'CounterEvent', now)!;
    expect(result.counter).toBe(42);
    expect(result.publishedAt).toBe(published);
    expect(result.receivedAt).toBe(now.toISOString());
    expect(normalizeEvent(event(), 'another-device', 'CounterEvent', now)).toBeNull();
    expect(
      normalizeEvent({ ...event(), event: 'CounterEvent/debug' }, device, 'CounterEvent', now)
    ).toBeNull();
  });
  it.each(['1000001', '2147483647'])('accepts counter %s within the firmware range', (data) => {
    expect(normalizeEvent(event(data), device, 'CounterEvent', now)?.counter).toBe(Number(data));
  });
  it.each(['', ' ', '-1', '2.5', 'NaN', '2147483648', '9999999999', '1e2', '{"counter":42}'])(
    'rejects invalid payload %j',
    (data) => {
      expect(() => normalizeEvent(event(data), device, 'CounterEvent', now)).toThrow();
    }
  );
  it('rejects invalid JSON and timestamps', () => {
    expect(() =>
      normalizeEvent({ event: 'CounterEvent', data: '{' }, device, 'CounterEvent', now)
    ).toThrow();
    const future = {
      event: 'CounterEvent',
      data: JSON.stringify({ coreid: device, data: '1', published_at: '2099-01-01T00:00:00Z' })
    };
    expect(() => normalizeEvent(future, device, 'CounterEvent', now)).toThrow('timestamp');
  });
  it('deduplicates identical observations and returns bounded, chronological history', async () => {
    const store = new MemoryReadings();
    const reading = normalizeEvent(event(), device, 'CounterEvent', now)!;
    expect(await store.insert(reading)).toBe(true);
    expect(await store.insert({ ...reading, receivedAt: new Date().toISOString() })).toBe(false);
    expect(await store.list(new Date('2025-01-01'), 1)).toEqual([reading]);
    expect(await store.list(new Date('2027-01-01'), 10)).toEqual([]);
    expect(await store.latest()).toEqual(reading);
  });
});
