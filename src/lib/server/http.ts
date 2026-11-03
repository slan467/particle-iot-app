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

export function parseHistory(search: URLSearchParams, now = Date.now()) {
  const minutesText = search.get('minutes') ?? '60';
  const limitText = search.get('limit') ?? '120';
  if (!/^\d+$/.test(minutesText) || !/^\d+$/.test(limitText))
    throw new Error('Invalid history query.');
  const minutes = Number(minutesText),
    limit = Number(limitText);
  if (minutes < 1 || minutes > 1440 || limit < 1 || limit > 500)
    throw new Error('History range or limit is out of bounds.');
  return { since: new Date(now - minutes * 60_000), limit };
}
