/**
 * Health check — returns 200 OK. No env inspection, no external calls.
 */
export async function GET(): Promise<Response> {
  return Response.json({ ok: true });
}
