import { getRuntime } from '#lib/server/runtime.ts';
import { commands, failure } from '#lib/server/http.ts';

export async function GET() {
  if (!commands.take())
    return failure('Device request limit reached. Try again in a minute.', 429, {
      'Retry-After': '60'
    });
  try {
    const { device } = await getRuntime();
    return Response.json({ value: await device.readCounter(), readAt: new Date().toISOString() });
  } catch {
    return failure('Could not read the device. Check connectivity and Particle credentials.', 502);
  }
}
