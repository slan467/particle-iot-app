import { defineEnvVars } from '@sveltejs/kit/env';

const optional = { schema: (value: string | undefined) => value ?? '' };

// Explicitly declared, private runtime variables (SvelteKit 3).
export const variables = defineEnvVars({
  APP_MODE: optional,
  APP_ORIGIN: optional,
  PARTICLE_CLIENT_ID: optional,
  PARTICLE_CLIENT_SECRET: optional,
  PARTICLE_DEVICE_ID: optional,
  PARTICLE_PRODUCT_ID: optional,
  PARTICLE_EVENT_NAME: optional,
  PARTICLE_VARIABLE_NAME: optional,
  PARTICLE_FUNCTION_NAME: optional,
  MONGODB_URI: optional,
  MONGODB_DATABASE: optional,
  READING_RETENTION_DAYS: optional
});
