import type { RequestHandler } from '@sveltejs/kit';
import { getRuntime } from '#lib/server/runtime.ts';
import { failure, parseHistory } from '#lib/server/http.ts';

export const GET: RequestHandler = async ({ url }) => {
  let query;
  try {
    query = parseHistory(url.searchParams);
  } catch {
    return failure('Use minutes=1…1440 and limit=1…500.', 400);
  }
  try {
    return Response.json(await (await getRuntime()).snapshot(query.since, query.limit));
  } catch {
    return failure('Readings unavailable. Check MongoDB configuration and network access.');
  }
};
