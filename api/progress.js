import { db, readJson, getSessionToken } from "../lib/db.mjs";
import { verifySession } from "../lib/auth.mjs";

// Ids validos de ejercicios (17). Todo lo demas se ignora.
const VALID = new Set([
  "1.1", "1.2", "1.3", "1.4",
  "2.1", "2.2", "2.3",
  "3.1", "3.2", "3.3",
  "4.1", "4.2", "4.3",
  "5.1", "5.2", "5.3",
  "6.1",
]);

function clean(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const v of list) {
    if (typeof v !== "string") continue;
    // "1.1" o "1.1:hint" / "1.1:sol"
    const m = v.match(/^([1-6]\.\d)(?::(hint|sol))?$/);
    if (m && VALID.has(m[1]) && !out.includes(v)) out.push(v);
  }
  return out.slice(0, 60);
}

// GET -> estado del usuario. PUT { done, open } -> reemplazo total (last-write-wins).
export default async function handler(req, res) {
  const userId = verifySession(getSessionToken(req));
  if (!userId) {
    res.status(401).json({ error: "Sin sesion." });
    return;
  }
  const sql = db();
  if (req.method === "GET") {
    const rows = await sql`SELECT done, open, updated_at FROM progress WHERE user_id = ${userId}`;
    if (rows.length === 0) {
      res.status(200).json({ done: [], open: [], updated_at: null });
      return;
    }
    res.status(200).json({ done: rows[0].done || [], open: rows[0].open || [], updated_at: rows[0].updated_at });
    return;
  }
  if (req.method === "PUT") {
    const body = await readJson(req);
    const done = clean(body.done).filter((v) => !v.includes(":"));
    const open = clean(body.open);
    const rows = await sql`
      INSERT INTO progress (user_id, done, open, updated_at)
      VALUES (${userId}, ${done}, ${open}, now())
      ON CONFLICT (user_id) DO UPDATE SET done = EXCLUDED.done, open = EXCLUDED.open, updated_at = now()
      RETURNING done, open, updated_at
    `;
    res.status(200).json({ ok: true, done: rows[0].done, open: rows[0].open, updated_at: rows[0].updated_at });
    return;
  }
  res.status(405).json({ error: "Metodo no permitido." });
}
