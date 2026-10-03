import { db, getSessionToken } from "../../lib/db.mjs";
import { verifySession } from "../../lib/auth.mjs";

// GET /api/auth/me -> { email } si hay sesion, 401 si no.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Metodo no permitido." });
    return;
  }
  const userId = verifySession(getSessionToken(req));
  if (!userId) {
    res.status(401).json({ error: "Sin sesion." });
    return;
  }
  const sql = db();
  const rows = await sql`SELECT email FROM users WHERE id = ${userId}`;
  if (rows.length === 0) {
    res.status(401).json({ error: "Sin sesion." });
    return;
  }
  res.status(200).json({ ok: true, email: rows[0].email });
}
