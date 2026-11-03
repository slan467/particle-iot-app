// Liveness is intentionally independent of Particle/MongoDB availability.
export function GET() {
  return Response.json({ ok: true });
}
