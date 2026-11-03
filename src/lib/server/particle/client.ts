import type { AppConfig } from '../config';
import { ParticleAuth } from './auth';
import { ParticleError, retryAfter } from './errors';
import { EventParser, type StreamEvent } from './events';
import {
  isInteger,
  MAX_INT,
  MAX_REPS,
  RESET_ARGUMENT,
  VARIABLES,
  type DeviceControl,
  type DeviceReading
} from '../hantel';

export class ParticleClient implements DeviceControl {
  private auth: ParticleAuth;
  private devicePath: string;

  constructor(
    private config: AppConfig,
    private request: typeof fetch = fetch
  ) {
    this.auth = new ParticleAuth(config.clientId, config.clientSecret, request);
    const product = config.productId ? `/products/${encodeURIComponent(config.productId)}` : '';
    this.devicePath = `https://api.particle.io/v1${product}/devices/${encodeURIComponent(config.deviceId)}`;
  }

  async readState(): Promise<DeviceReading> {
    const [repetitions, totalCount, sensorOk] = await Promise.all(
      Object.values(VARIABLES).map(async (name) => {
        const result = await this.call(`/${encodeURIComponent(name)}`, { method: 'GET' });
        return result.result as unknown;
      })
    );
    if (!isInteger(repetitions, 0, MAX_REPS))
      throw new Error('Device returned invalid repetitions.');
    if (!isInteger(totalCount, 0, MAX_INT))
      throw new Error('Device returned an invalid total count.');
    // An int variable arrives as 0/1; accept a bool variable as well.
    if (![0, 1, true, false].includes(sensorOk as number | boolean))
      throw new Error('Device returned an invalid sensor status.');
    return { repetitions, totalCount, sensorOk: sensorOk === 1 || sensorOk === true };
  }

  async resetTotal(): Promise<number> {
    const result = await this.call(`/${encodeURIComponent(this.config.functionName)}`, {
      method: 'POST',
      body: new URLSearchParams({ arg: RESET_ARGUMENT })
    });
    if (result.return_value !== 0) throw new Error('Device rejected the reset.');
    return result.return_value;
  }

  private async call(path: string, init: RequestInit) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.auth.getToken();
      const response = await this.request(this.devicePath + path, {
        ...init,
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
        redirect: 'error'
      });
      if (response.status === 401 && attempt === 0) {
        this.auth.invalidate(token);
        await response.body?.cancel();
        continue;
      }
      if (!response.ok) throw new ParticleError(response.status, retryAfter(response));
      return response.json();
    }
    throw new ParticleError(401);
  }

  /** A connection runs until EOF, renewal, idle timeout, or shutdown. */
  async stream(
    signal: AbortSignal,
    onEvent: (event: StreamEvent) => void,
    onConnected: () => void
  ) {
    const token = await this.auth.getToken();
    signal.throwIfAborted();
    const connection = new AbortController();
    const abort = () => connection.abort();
    signal.addEventListener('abort', abort, { once: true });
    // Periodically reopen with a current token, even if the old stream stays connected.
    const renew = setTimeout(abort, 30 * 60_000);
    let idle: ReturnType<typeof setTimeout>;
    const touch = () => {
      clearTimeout(idle);
      idle = setTimeout(abort, 90_000);
    };
    touch();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await this.request(
        `${this.devicePath}/events/${encodeURIComponent(this.config.eventName)}`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: connection.signal,
          redirect: 'error'
        }
      );
      if (response.status === 401) this.auth.invalidate(token);
      if (!response.ok) throw new ParticleError(response.status, retryAfter(response));
      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
        throw new Error('Invalid Particle event stream.');
      }
      onConnected();
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = new EventParser();
      while (!signal.aborted) {
        const { value, done } = await reader.read();
        if (done) return;
        touch();
        for (const event of parser.push(decoder.decode(value, { stream: true }))) onEvent(event);
      }
    } finally {
      clearTimeout(renew);
      clearTimeout(idle!);
      signal.removeEventListener('abort', abort);
      await reader?.cancel().catch(() => {});
      connection.abort();
    }
  }
}
