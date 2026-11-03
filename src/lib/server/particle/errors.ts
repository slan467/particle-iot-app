export class ParticleError extends Error {
  constructor(
    public readonly status: number,
    public readonly retryAfterMs = 0
  ) {
    super(
      status === 401 || status === 403
        ? 'Particle authentication or permissions failed. Check the server credentials and device ownership.'
        : status === 429 || status === 529
          ? 'Particle rate limit reached. Waiting before retrying.'
          : 'Particle Cloud could not complete the request. Check that the device is online.'
    );
  }
}

export function retryAfter(response: Response): number {
  const value = response.headers.get('retry-after');
  if (!value) return 0;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(delay) ? Math.max(0, Math.min(delay, 300_000)) : 0;
}

export function connectionMessage(error: unknown): string {
  return error instanceof ParticleError
    ? error.message
    : 'Particle connection interrupted. Retrying automatically.';
}
