import type { DeviceState } from '../types';

/** Device contract of the dumbbell firmware (hantelSim.cpp and IoTHantel.cpp). */

/** Nonnegative values supported by the firmware's signed 32-bit int. */
export const MAX_INT = 2_147_483_647;
/** Plausibility bounds for a single set. */
export const MAX_REPS = 10_000;
export const MAX_DURATION_S = 86_400;

/** Cloud variables registered by the firmware. Fixed so the browser cannot choose them. */
export const VARIABLES = {
  repetitions: 'repetitions',
  totalCount: 'totalCount',
  sensorOk: 'sensorOk'
} as const;

/** True for a whole number within [min, max]; untrusted JSON can contain anything. */
export const isInteger = (value: unknown, min: number, max: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** The only argument the reset function accepts. */
export const RESET_ARGUMENT = '0';

/** Device state as returned by the device, before the server adds `readAt`. */
export type DeviceReading = Omit<DeviceState, 'readAt'>;

/** Implemented by the real Particle client and the mock device. */
export interface DeviceControl {
  readState(): Promise<DeviceReading>;
  /** Resets the device total to 0; resolves with the function's return value. */
  resetTotal(): Promise<number>;
}
