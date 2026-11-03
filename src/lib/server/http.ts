/** No raw upstream error bodies, database URIs or tokens in public errors. */
export function failure(message: string, status = 503, headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers });
}

/** Process-wide budget: a public dashboard cannot bypass it by changing IP. */
export class CommandBudget {
  private start = 0;
  private used = 0;
  constructor(
    private limit = 20,
    private windowMs = 60_000
  ) {}
  take(now = Date.now()): boolean {
    if (now - this.start >= this.windowMs) {
      this.start = now;
      this.used = 0;
    }
    return ++this.used <= this.limit;
  }
}
export const commands = new CommandBudget();

/** A start and an end event per set: 500 events cover the newest 250 sets. */
export function parseHistory(search: URLSearchParams, now = Date.now()) {
  const daysText = search.get('days') ?? '7';
  const limitText = search.get('limit') ?? '500';
  if (!/^\d+$/.test(daysText) || !/^\d+$/.test(limitText))
    throw new Error('Invalid history query.');
  const days = Number(daysText),
    limit = Number(limitText);
  if (days < 1 || days > 30 || limit < 1 || limit > 500)
    throw new Error('History range or limit is out of bounds.');
  return { since: new Date(now - days * 86_400_000), limit };
}
