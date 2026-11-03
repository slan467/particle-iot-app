import { describe, expect, it } from 'vitest';
import { buildSets, liveSince, setsToday, summarize } from '../src/lib/training';
import type { TrainingEvent } from '../src/lib/types';

const base = { deviceId: 'd', eventName: 'training', receivedAt: '2026-01-01T00:00:00.000Z' };
const start = (id: string, publishedAt: string): TrainingEvent => ({
  ...base,
  id,
  type: 'start',
  reps: null,
  durationS: null,
  total: 0,
  publishedAt
});
const end = (id: string, publishedAt: string, reps: number, durationS: number): TrainingEvent => ({
  ...base,
  id,
  type: 'end',
  reps,
  durationS,
  total: 0,
  publishedAt
});

describe('sets and statistics', () => {
  it('derives one set per end event, excluding the firmware end pause', () => {
    const [set] = buildSets([
      start('s', '2026-01-01T10:00:05.000Z'),
      end('e', '2026-01-01T10:00:30.000Z', 11, 20)
    ]);
    expect(set.endedAt).toBe('2026-01-01T10:00:25.000Z');
    expect(set.startedAt).toBe('2026-01-01T10:00:05.000Z');
    // 11 repetitions span 10 intervals.
    expect(set.paceS).toBe(2);
  });
  it('has no pace for a single repetition and sorts sets chronologically', () => {
    const sets = buildSets([
      end('late', '2026-01-02T10:00:00.000Z', 1, 0),
      end('early', '2026-01-01T10:00:00.000Z', 5, 8)
    ]);
    expect(sets.map((set) => set.id)).toEqual(['early', 'late']);
    expect(sets[1].paceS).toBeNull();
  });
  it('summarizes totals, best set and average pace', () => {
    const summary = summarize(
      buildSets([
        end('a', '2026-01-01T10:00:00.000Z', 5, 8),
        end('b', '2026-01-01T11:00:00.000Z', 9, 24),
        end('c', '2026-01-01T12:00:00.000Z', 1, 0)
      ])
    );
    expect(summary).toMatchObject({ sets: 3, reps: 15, averagePaceS: 2.5 });
    expect(summary.best?.id).toBe('b');
    expect(summarize([])).toEqual({ sets: 0, reps: 0, averagePaceS: null, best: null });
  });
  it('counts only sets since local midnight as today', () => {
    const now = new Date(2026, 0, 2, 9, 0);
    const sets = buildSets([
      end('yesterday', new Date(2026, 0, 1, 23, 59).toISOString(), 5, 8),
      end('today', new Date(2026, 0, 2, 0, 1).toISOString(), 5, 8)
    ]);
    expect(setsToday(sets, now).map((set) => set.id)).toEqual(['today']);
  });
  it('treats only a recent start as a set in progress', () => {
    const at = Date.parse('2026-01-01T10:00:00.000Z');
    const started = start('s', '2026-01-01T10:00:00.000Z');
    expect(liveSince(started, at + 60_000)).toBe(started.publishedAt);
    expect(liveSince(started, at + 16 * 60_000)).toBeNull();
    expect(liveSince(end('e', '2026-01-01T10:00:00.000Z', 5, 8), at)).toBeNull();
    expect(liveSince(null, at)).toBeNull();
  });
});
