import { ParticleError, retryAfter } from './errors';

/** Tokens stay in memory. Concurrent REST/stream requests share one exchange. */
export class ParticleAuth {
  private token = '';
  private expiresAt = 0;
  private pending?: Promise<string>;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private request: typeof fetch = fetch
  ) {}

  invalidate(token: string) {
    if (this.token === token) this.expiresAt = 0;
  }

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt) return this.token;
    if (this.pending) return this.pending;
    this.pending = this.exchange();
    try {
      return await this.pending;
    } finally {
      this.pending = undefined;
    }
  }

  private async exchange(): Promise<string> {
    const response = await this.request('https://api.particle.io/oauth/token', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        expires_in: '3600'
      }),
      signal: AbortSignal.timeout(15_000),
      redirect: 'error'
    });
    if (!response.ok) throw new ParticleError(response.status, retryAfter(response));
    const result = await response.json();
    if (typeof result.access_token !== 'string' || !result.access_token)
      throw new Error('Invalid token response.');
    const seconds = Number(result.expires_in);
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid token expiration.');
    this.token = result.access_token;
    const lifetime = seconds === 0 ? 3600_000 : seconds * 1000;
    this.expiresAt = Date.now() + lifetime - Math.min(60_000, lifetime / 10);
    return this.token;
  }
}
