import { db, readJson, sessionCookie } from "../../lib/db.mjs";
import { hashPassword, normalizeEmail, signSession } from "../../lib/auth.mjs";

// POST /api/auth/register  { email, password } -> crea usuario + sesion.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido." });
    return;
  }
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!email) {
    res.status(400).json({ error: "Email invalido." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "La clave debe tener 8+ caracteres." });
    return;
  }

  const sql = db();
  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing.length > 0) {
    res.status(409).json({ error: "Ese email ya esta registrado." });
    return;
  }

  const passwordHash = await hashPassword(password);
  const rows = await sql`INSERT INTO users (email, password_hash) VALUES (${email}, ${passwordHash}) RETURNING id, email`;
  const user = rows[0];
  await sql`INSERT INTO progress (user_id) VALUES (${user.id}) ON CONFLICT (user_id) DO NOTHING`;

  const token = signSession(user.id);
  res.setHeader("Set-Cookie", sessionCookie(token));
  res.status(201).json({ ok: true, email: user.email });
}
