export interface AppConfig {
  mode: 'mock' | 'live';
  origin: string;
  clientId: string;
  clientSecret: string;
  deviceId: string;
  productId: string;
  eventName: string;
  variableName: string;
  functionName: string;
  mongoUri: string;
  mongoDatabase: string;
  retentionDays: number;
}

/** Pure validation: report variable names, never their secret values. */
export function parseConfig(env: Record<string, string | undefined>): AppConfig {
  const text = (key: string, fallback = '') => env[key]?.trim() || fallback;
  const mode = text('APP_MODE', 'mock');
  if (mode !== 'mock' && mode !== 'live') throw new Error('APP_MODE must be mock or live.');
  const config: AppConfig = {
    mode,
    origin: text('APP_ORIGIN'),
    clientId: text('PARTICLE_CLIENT_ID'),
    clientSecret: text('PARTICLE_CLIENT_SECRET'),
    deviceId: text('PARTICLE_DEVICE_ID', mode === 'mock' ? 'mock-photon-2' : ''),
    productId: text('PARTICLE_PRODUCT_ID'),
    eventName: text('PARTICLE_EVENT_NAME', 'CounterEvent'),
    variableName: text('PARTICLE_VARIABLE_NAME', 'counter'),
    functionName: text('PARTICLE_FUNCTION_NAME', 'setCounter'),
    mongoUri: text('MONGODB_URI'),
    mongoDatabase: text('MONGODB_DATABASE', 'iot_starter'),
    retentionDays: Number(text('READING_RETENTION_DAYS', '7'))
  };
  if (config.origin) {
    let url: URL;
    try {
      url = new URL(config.origin);
    } catch {
      throw new Error('APP_ORIGIN must be an HTTP(S) origin.');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== config.origin) {
      throw new Error('APP_ORIGIN must be an HTTP(S) origin without a path or trailing slash.');
    }
  }
  if (
    !Number.isInteger(config.retentionDays) ||
    config.retentionDays < 1 ||
    config.retentionDays > 365
  ) {
    throw new Error('READING_RETENTION_DAYS must be an integer between 1 and 365.');
  }
  for (const [name, value] of Object.entries({
    PARTICLE_EVENT_NAME: config.eventName,
    PARTICLE_VARIABLE_NAME: config.variableName,
    PARTICLE_FUNCTION_NAME: config.functionName
  })) {
    if (!/^[a-zA-Z][a-zA-Z0-9_/-]{0,63}$/.test(value))
      throw new Error(`${name} has an invalid name.`);
  }
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(config.mongoDatabase))
    throw new Error('MONGODB_DATABASE has an invalid name.');
  if (config.productId && !/^[a-zA-Z0-9_-]+$/.test(config.productId))
    throw new Error('PARTICLE_PRODUCT_ID has an invalid ID/slug.');
  if (mode === 'live') {
    const required = [
      'PARTICLE_CLIENT_ID',
      'PARTICLE_CLIENT_SECRET',
      'PARTICLE_DEVICE_ID',
      'MONGODB_URI'
    ];
    const missing = required.filter((name) => !text(name));
    if (missing.length) throw new Error(`Live mode requires: ${missing.join(', ')}.`);
    if (!/^[a-f0-9]{24}$/i.test(config.deviceId))
      throw new Error('PARTICLE_DEVICE_ID must be a 24-character hexadecimal ID.');
    config.deviceId = config.deviceId.toLowerCase();
    if (!/^mongodb(?:\+srv)?:\/\//.test(config.mongoUri))
      throw new Error('MONGODB_URI must be a MongoDB connection URI.');
  }
  return config;
}
