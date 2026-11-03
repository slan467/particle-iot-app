/** Shared JSON contracts. Dates cross the HTTP boundary as ISO strings. */
export interface Reading {
  id: string;
  deviceId: string;
  eventName: string;
  /** Nonnegative signed 32-bit integer, matching the firmware counter. */
  counter: number;
  publishedAt: string;
  receivedAt: string;
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
  readings: Reading[];
  latest: Reading | null;
  eventName: string;
  variableName: string;
  functionName: string;
  deviceLabel: string;
}
