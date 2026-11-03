import { describe, expect, it } from 'vitest';
import { EventParser } from '../src/lib/server/particle/events';
import { normalizeEvent, MemoryTrainingEvents } from '../src/lib/server/training-events';

const device = '0123456789abcdef01234567';
const published = '2026-01-01T12:00:00.000Z';
const now = new Date('2026-01-01T12:00:01.000Z');
const envelope = (data: string, at = published) => ({
  event: 'training',
  data: JSON.stringify({ coreid: device, data, published_at: at })
});
const event = (payload: unknown) => envelope(JSON.stringify(payload));
const end = { type: 'end', reps: 12, duration: 22, total: 135 };

describe('Particle event stream', () => {
  it('reassembles arbitrary chunks, CRLF, multiline data and heartbeats', () => {
    const parser = new EventParser();
    expect(parser.push(':ok\r\n\r\nevent: train')).toEqual([]);
    expect(parser.push('ing\r\ndata: first\r\ndata: sec')).toEqual([]);
    expect(parser.push('ond\r\nid: 123\r\n\r\n')).toEqual([
      { event: 'training', data: 'first\nsecond', id: '123' }
    ]);
    expect(parser.push(':keepalive\n\nevent: empty\n\n')).toEqual([]);
  });
  it('bounds untrusted stream frames', () => {
    expect(() => new EventParser().push('data: ' + 'x'.repeat(70_000))).toThrow('size limit');
  });
});

describe('training event contract', () => {
  it('converts an end event and keeps device filtering and exact event matching', () => {
    const result = normalizeEvent(event(end), device, 'training', now)!;
    expect(result).toMatchObject({ type: 'end', reps: 12, durationS: 22, total: 135 });
    expect(result.publishedAt).toBe(published);
    expect(result.receivedAt).toBe(now.toISOString());
    expect(normalizeEvent(event(end), 'another-device', 'training', now)).toBeNull();
    expect(
      normalizeEvent({ ...event(end), event: 'training/debug' }, device, 'training', now)
    ).toBeNull();
  });
  it('stores a start event without set values', () => {
    const result = normalizeEvent(event({ type: 'start', total: 0 }), device, 'training', now)!;
    expect(result).toMatchObject({ type: 'start', reps: null, durationS: null, total: 0 });
  });
  it.each([
    ['the old counter format', '42'],
    ['the old firmware text format', 'end;reps=12;duration=22'],
    ['an empty payload', ''],
    ['an array', '[]']
  ])('rejects %s', (_, data) => {
    expect(() => normalizeEvent(envelope(data), device, 'training', now)).toThrow();
  });
  it.each([
    ['an unknown type', { ...end, type: 'pause' }],
    ['a missing total', { type: 'start' }],
    ['a negative total', { ...end, total: -1 }],
    ['a total beyond the firmware int', { ...end, total: 2147483648 }],
    ['zero repetitions', { ...end, reps: 0 }],
    ['fractional repetitions', { ...end, reps: 2.5 }],
    ['repetitions as text', { ...end, reps: '12' }],
    ['a missing duration', { type: 'end', reps: 12, total: 135 }],
    ['a duration longer than a day', { ...end, duration: 86_401 }]
  ])('rejects %s', (_, payload) => {
    expect(() => normalizeEvent(event(payload), device, 'training', now)).toThrow();
  });
  it('rejects invalid JSON and timestamps', () => {
    expect(() =>
      normalizeEvent({ event: 'training', data: '{' }, device, 'training', now)
    ).toThrow();
    expect(() =>
      normalizeEvent(envelope(JSON.stringify(end), '2099-01-01T00:00:00Z'), device, 'training', now)
    ).toThrow('timestamp');
  });
  it('deduplicates identical observations and returns bounded, chronological history', async () => {
    const store = new MemoryTrainingEvents();
    const stored = normalizeEvent(event(end), device, 'training', now)!;
    expect(await store.insert(stored)).toBe(true);
    expect(await store.insert({ ...stored, receivedAt: new Date().toISOString() })).toBe(false);
    expect(await store.list(new Date('2025-01-01'), 1)).toEqual([stored]);
    expect(await store.list(new Date('2027-01-01'), 10)).toEqual([]);
    expect(await store.latest()).toEqual(stored);
  });
});
