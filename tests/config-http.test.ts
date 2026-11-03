import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/lib/server/config';
import { CommandBudget, parseHistory } from '../src/lib/server/http';

describe('configuration and public API bounds', () => {
  it('starts in mock mode without credentials', () => {
    expect(parseConfig({}).mode).toBe('mock');
  });
  it('fails closed on a mode typo', () => {
    expect(() => parseConfig({ APP_MODE: 'production' })).toThrow('APP_MODE');
  });
  it('accepts only an exact configured application origin', () => {
    expect(parseConfig({ APP_ORIGIN: 'https://demo.example' }).origin).toBe('https://demo.example');
    for (const origin of [
      'https://demo.example/',
      'https://demo.example/path',
      'file:///tmp',
      'not-a-url'
    ]) {
      expect(() => parseConfig({ APP_ORIGIN: origin })).toThrow('APP_ORIGIN');
    }
  });
  it('requires live credentials without including values in diagnostics', () => {
    expect(() =>
      parseConfig({ APP_MODE: 'live', PARTICLE_CLIENT_SECRET: 'do-not-log-me' })
    ).toThrow('PARTICLE_CLIENT_ID');
    try {
      parseConfig({ APP_MODE: 'live', PARTICLE_CLIENT_SECRET: 'do-not-log-me' });
    } catch (error) {
      expect(String(error)).not.toContain('do-not-log-me');
    }
  });
  it('validates device IDs, database URIs and retention limits', () => {
    const env = {
      APP_MODE: 'live',
      PARTICLE_CLIENT_ID: 'client',
      PARTICLE_CLIENT_SECRET: 'secret',
      PARTICLE_DEVICE_ID: '0123456789abcdef01234567',
      MONGODB_URI: 'mongodb://localhost:27017'
    };
    expect(parseConfig(env).mode).toBe('live');
    expect(() => parseConfig({ ...env, PARTICLE_DEVICE_ID: '../device' })).toThrow(
      'PARTICLE_DEVICE_ID'
    );
    expect(() => parseConfig({ ...env, MONGODB_URI: 'https://example.com' })).toThrow(
      'MONGODB_URI'
    );
    expect(() => parseConfig({ READING_RETENTION_DAYS: '0' })).toThrow('READING_RETENTION_DAYS');
  });
  it('bounds query size and time range', () => {
    expect(parseHistory(new URLSearchParams('minutes=15&limit=50'), 1_000_000)).toEqual({
      since: new Date(100_000),
      limit: 50
    });
    for (const query of ['limit=501', 'minutes=99999', 'limit=-2', 'minutes=NaN', 'limit=1.2']) {
      expect(() => parseHistory(new URLSearchParams(query))).toThrow();
    }
  });
  it('enforces a shared command budget and resets after its window', () => {
    const budget = new CommandBudget(2, 1000);
    expect(budget.take(1000)).toBe(true);
    expect(budget.take(1001)).toBe(true);
    expect(budget.take(1002)).toBe(false);
    expect(budget.take(2000)).toBe(true);
  });
});
