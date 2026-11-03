import { describe, expect, it, vi } from 'vitest';
import { ParticleAuth } from '../src/lib/server/particle/auth';
import { ParticleClient } from '../src/lib/server/particle/client';
import { parseConfig } from '../src/lib/server/config';

const tokenResponse = () => Response.json({ access_token: 'server-only-token', expires_in: 3600 });
/** Answers token and variable requests by URL, since variables are read in parallel. */
const deviceApi = (values: Record<string, unknown>) =>
  vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/oauth/token')) return tokenResponse();
    return Response.json({ result: values[url.split('/').pop()!] });
  });

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
      .mockResolvedValueOnce(Response.json({ return_value: 0 }));
    const config = parseConfig({ PARTICLE_DEVICE_ID: 'test-device' });
    expect(await new ParticleClient(config, request).resetTotal()).toBe(0);
    expect(request.mock.calls[1][0]).toBe(
      'https://api.particle.io/v1/devices/test-device/resetTotal'
    );
    expect(request.mock.calls[1][1]?.headers).toEqual({
      Authorization: 'Bearer server-only-token'
    });
    expect(request.mock.calls).toHaveLength(4);
  });
  it('reads the three fixed device variables', async () => {
    const request = deviceApi({ repetitions: 7, totalCount: 2147483647, sensorOk: 1 });
    expect(await new ParticleClient(parseConfig({}), request).readState()).toEqual({
      repetitions: 7,
      totalCount: 2147483647,
      sensorOk: true
    });
    const urls = request.mock.calls.map(([url]) => String(url));
    for (const name of ['repetitions', 'totalCount', 'sensorOk'])
      expect(urls).toContain(`https://api.particle.io/v1/devices/mock-photon-2/${name}`);
  });
  it('accepts a bool sensor variable as well', async () => {
    const request = deviceApi({ repetitions: 0, totalCount: 0, sensorOk: false });
    expect((await new ParticleClient(parseConfig({}), request).readState()).sensorOk).toBe(false);
  });
  it.each([
    ['negative repetitions', { repetitions: -1 }, 'repetitions'],
    ['fractional repetitions', { repetitions: 1.5 }, 'repetitions'],
    ['a total beyond the firmware int', { totalCount: 2147483648 }, 'total count'],
    ['a sensor status of 2', { sensorOk: 2 }, 'sensor status'],
    ['a missing variable', { sensorOk: undefined }, 'sensor status']
  ])('rejects %s', async (_, values, message) => {
    const request = deviceApi({ repetitions: 0, totalCount: 0, sensorOk: 1, ...values });
    await expect(new ParticleClient(parseConfig({}), request).readState()).rejects.toThrow(message);
  });
  it('parses streamed events and closes its connection', async () => {
    const config = parseConfig({});
    const frame = 'event: training\ndata: {"data":"1"}\n\n';
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
      event: 'training',
      data: '{"data":"1"}',
      id: undefined
    });
  });
  it('sends only the allowed reset argument and rejects device-side failures', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(Response.json({ return_value: -1 }));
    await expect(new ParticleClient(parseConfig({}), request).resetTotal()).rejects.toThrow(
      'rejected'
    );
    expect((request.mock.calls[1][1]?.body as URLSearchParams).get('arg')).toBe('0');
  });
});
