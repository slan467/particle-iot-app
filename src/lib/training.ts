import type { TrainingEvent, TrainingSet } from './types';

/**
 * Pure training logic shared by server and browser. The browser computes "today"
 * in the viewer's own timezone, which the server does not know.
 */

/** Firmware END_PAUSE_MS: a set ends after this many seconds without a repetition. */
export const END_PAUSE_S = 5;
/** A start event without a matching end is considered stale after this time. */
export const LIVE_TIMEOUT_MS = 15 * 60_000;

/** One finished set per `end` event, oldest first. */
export function buildSets(events: TrainingEvent[]): TrainingSet[] {
  return events
    .filter((event) => event.type === 'end' && event.reps !== null && event.durationS !== null)
    .map((event) => {
      const reps = event.reps!;
      const durationS = event.durationS!;
      // The end event is published END_PAUSE_S after the last repetition.
      const endedAt = Date.parse(event.publishedAt) - END_PAUSE_S * 1000;
      return {
        id: event.id,
        startedAt: new Date(endedAt - durationS * 1000).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        reps,
        durationS,
        // n repetitions span n - 1 intervals.
        paceS: reps > 1 ? Math.round((durationS / (reps - 1)) * 10) / 10 : null
      };
    })
    .sort((a, b) => a.endedAt.localeCompare(b.endedAt));
}

export interface TrainingSummary {
  sets: number;
  reps: number;
  /** Average seconds per repetition across sets that have a pace. */
  averagePaceS: number | null;
  best: TrainingSet | null;
}

export function summarize(sets: TrainingSet[]): TrainingSummary {
  const paced = sets.filter((set) => set.paceS !== null);
  const average = paced.length
    ? paced.reduce((sum, set) => sum + set.paceS!, 0) / paced.length
    : null;
  return {
    sets: sets.length,
    reps: sets.reduce((sum, set) => sum + set.reps, 0),
    averagePaceS: average === null ? null : Math.round(average * 10) / 10,
    best: sets.reduce<TrainingSet | null>(
      (best, set) => (!best || set.reps > best.reps ? set : best),
      null
    )
  };
}

/** Sets that ended since local midnight of `now`. */
export function setsToday(sets: TrainingSet[], now = new Date()): TrainingSet[] {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return sets.filter((set) => Date.parse(set.endedAt) >= midnight);
}

/** A set is in progress when the newest event is a recent `start`. */
export function liveSince(latest: TrainingEvent | null, now = Date.now()): string | null {
  if (latest?.type !== 'start') return null;
  return now - Date.parse(latest.publishedAt) <= LIVE_TIMEOUT_MS ? latest.publishedAt : null;
}
