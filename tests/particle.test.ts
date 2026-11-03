import { describe, expect, it, vi } from 'vitest';
import { ParticleAuth } from '../src/lib/server/particle/auth';
import { ParticleClient } from '../src/lib/server/particle/client';
import { parseConfig } from '../src/lib/server/config';

const tokenResponse = () => Response.json({ access_token: 'server-only-token', expires_in: 3600 });

describe('Particle authentication and transport', () => {
  it('shares token exchanges, uses client_credentials and caches the token', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => tokenResponse());
    const auth = new ParticleAuth('client', 'secret', request);
    expect(await Promise.all([auth.getToken(), auth.getToken()])).toEqual([
      'server-only-token',
      'server-only-token'
    ]);
    await auth.getToken();
    expect(request).toHaveBeenCalledTimes(1);
    const init = request.mock.calls[0][1]!;
    expect((init.body as URLSearchParams).get('grant_type')).toBe('client_credentials');
    expect(request.mock.calls[0][0]).toBe('https://api.particle.io/oauth/token');
    auth.invalidate('server-only-token');
    await auth.getToken();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('does not include upstream error text or credentials in authentication errors', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('secret-in-upstream-body', { status: 401 }));
    await expect(new ParticleAuth('client', 'secret', request).getToken()).rejects.toThrow(
      'authentication'
    );
  });
  it('renews expired tokens and scopes API URLs to the configured device', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(Response.json({ result: 42 }));
    const config = parseConfig({ PARTICLE_DEVICE_ID: 'test-device' });
    const client = new ParticleClient(config, request);
    expect(await client.readCounter()).toBe(42);
    expect(request.mock.calls[1][0]).toBe('https://api.particle.io/v1/devices/test-device/counter');
    expect(request.mock.calls[1][1]?.headers).toEqual({
      Authorization: 'Bearer server-only-token'
    });
    expect(request.mock.calls).toHaveLength(4);
  });
  it.each([1000001, 2147483647])('reads counter %s within the firmware range', async (value) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(Response.json({ result: value }));
    expect(await new ParticleClient(parseConfig({}), request).readCounter()).toBe(value);
  });
  it.each([-1, 2147483648, 1.5])(
    'rejects variable value %s outside the counter range',
    async (value) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(Response.json({ result: value }));
      await expect(new ParticleClient(parseConfig({}), request).readCounter()).rejects.toThrow(
        'invalid counter'
      );
    }
  );
  it('parses streamed events and closes its connection', async () => {
    const config = parseConfig({});
    const frame = 'event: CounterEvent\ndata: {"data":"1"}\n\n';
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        new Response(frame, { headers: { 'content-type': 'text/event-stream' } })
      );
    const event = vi.fn();
    const connected = vi.fn();
    await new ParticleClient(config, request).stream(
      new AbortController().signal,
      event,
      connected
    );
    expect(connected).toHaveBeenCalledOnce();
    expect(event).toHaveBeenCalledWith({
      event: 'CounterEvent',
      data: '{"data":"1"}',
      id: undefined
    });
  });
  it('sends only the allowed reset argument and rejects device-side failures', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(Response.json({ return_value: -1 }));
    await expect(new ParticleClient(parseConfig({}), request).resetCounter()).rejects.toThrow(
      'rejected'
    );
    expect((request.mock.calls[1][1]?.body as URLSearchParams).get('arg')).toBe('0');
  });
});
