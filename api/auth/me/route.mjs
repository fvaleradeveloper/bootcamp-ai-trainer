import { db, json, getSessionToken } from "../../lib/db.mjs";
import { verifySession } from "../../lib/auth.mjs";

// GET /api/auth/me -> { email } si hay sesion, 401 si no.
export async function GET(req) {
  const userId = verifySession(getSessionToken(req));
  if (!userId) return json({ error: "Sin sesion." }, 401);
  const sql = db();
  const rows = await sql`SELECT email FROM users WHERE id = ${userId}`;
  if (rows.length === 0) return json({ error: "Sin sesion." }, 401);
  return json({ ok: true, email: rows[0].email });
}
