import { getRuntime } from '#lib/server/runtime.ts';
import { commands, failure } from '#lib/server/http.ts';
import { BudgetExceeded } from '#lib/server/device-state.ts';

export async function GET() {
  try {
    const { deviceState } = await getRuntime();
    // Cached for a few seconds: many open tabs share one device request.
    return Response.json(await deviceState.get(() => commands.take()));
  } catch (error) {
    if (error instanceof BudgetExceeded)
      return failure('Device request limit reached. Try again in a minute.', 429, {
        'Retry-After': '60'
      });
    return failure('Could not read the device. Check connectivity and Particle credentials.', 502);
  }
}
