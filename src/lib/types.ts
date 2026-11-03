/** Shared JSON contracts. Dates cross the HTTP boundary as ISO strings. */

/** `start`: a set was recognized. `end`: the set finished after a pause. */
export type TrainingEventType = 'start' | 'end';

/** One stored `training` event published by the dumbbell firmware. */
export interface TrainingEvent {
  id: string;
  deviceId: string;
  eventName: string;
  type: TrainingEventType;
  /** Repetitions in the finished set; null for start events. */
  reps: number | null;
  /** Whole seconds from first to last repetition; null for start events. */
  durationS: number | null;
  /** The device's total repetitions after this event. */
  total: number;
  publishedAt: string;
  receivedAt: string;
}

/** A finished set, derived from one `end` event. */
export interface TrainingSet {
  id: string;
  /** Approximate time of the first repetition. */
  startedAt: string;
  /** Approximate time of the last repetition. */
  endedAt: string;
  reps: number;
  durationS: number;
  /** Seconds per repetition; null when a set has a single repetition. */
  paceS: number | null;
}

/** Values read on demand from the device's cloud variables. */
export interface DeviceState {
  /** Repetitions in the set currently in progress, 0 while resting. */
  repetitions: number;
  totalCount: number;
  sensorOk: boolean;
  readAt: string;
}

export interface CollectorStatus {
  mode: 'mock' | 'live';
  connection: 'starting' | 'connecting' | 'connected' | 'retrying' | 'stopped';
  storage: 'memory' | 'mongodb';
  startedAt: string;
  lastEventAt: string | null;
  lastWriteAt: string | null;
  connectionError: string | null;
  storageError: string | null;
  received: number;
  saved: number;
  rejected: number;
  duplicates: number;
  dropped: number;
  pending: number;
  reconnects: number;
}

export interface DashboardSnapshot {
  status: CollectorStatus;
  /** Chronological events within the requested range. */
  events: TrainingEvent[];
  /** Newest stored event, even when older than the requested range. */
  latest: TrainingEvent | null;
  eventName: string;
  functionName: string;
  deviceLabel: string;
}
