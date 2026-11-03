import { getRuntime } from '#lib/server/runtime.ts';

export async function GET() {
  const { collector } = await getRuntime();
  return Response.json({ ...collector.status });
}
