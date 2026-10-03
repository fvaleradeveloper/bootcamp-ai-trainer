import { json, clearSessionCookie } from "../../lib/db.mjs";

// POST /api/auth/logout -> cierra la sesion (limpia la cookie).
export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": clearSessionCookie(),
    },
  });
}
