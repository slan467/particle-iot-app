import { building } from '$app/env';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { getRuntime } from '#lib/server/runtime.ts';

// Adapter-node initializes hooks on process startup, even with no browser open.
export const init: ServerInit = async () => {
  if (!building) await getRuntime();
};

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  if (event.url.pathname.startsWith('/api/')) response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  return response;
};
