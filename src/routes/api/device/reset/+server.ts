import type { RequestHandler } from '@sveltejs/kit';
import { getRuntime } from '#lib/server/runtime.ts';
import { commands, failure } from '#lib/server/http.ts';

export const POST: RequestHandler = async ({ request, url }) => {
  const { config, device } = await getRuntime();
  // Public controls, but cross-origin websites cannot invoke them via a browser.
  if (request.headers.get('origin') !== (config.origin || url.origin))
    return failure('A same-origin request is required.', 403);
  if (!commands.take())
    return failure('Device request limit reached. Try again in a minute.', 429, {
      'Retry-After': '60'
    });
  // No arbitrary function name, device ID or argument accepted from the browser.
  try {
    return Response.json({ returnValue: await device.resetCounter() });
  } catch {
    return failure('Reset could not be confirmed. Read the device value before trying again.', 502);
  }
};
