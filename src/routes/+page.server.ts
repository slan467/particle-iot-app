import { getRuntime } from '#lib/server/runtime.ts';

export async function load() {
  const runtime = await getRuntime();
  try {
    return { snapshot: await runtime.snapshot(), initialError: '' };
  } catch {
    return {
      snapshot: null,
      initialError: 'Readings unavailable. Check MongoDB configuration and network access.'
    };
  }
}
