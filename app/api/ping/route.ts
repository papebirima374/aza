// GET /api/ping — le serveur répond-il ? (n'utilise aucune bibliothèque)
export function GET() {
  return Response.json(
    { ok: true, node: process.version, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
