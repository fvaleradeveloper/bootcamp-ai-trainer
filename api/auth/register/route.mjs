import { db, readJson, json, sessionCookie } from "../../lib/db.mjs";
import { hashPassword, normalizeEmail, signSession } from "../../lib/auth.mjs";

// POST /api/auth/register  { email, password } -> crea usuario + sesion.
export async function POST(req) {
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!email) return json({ error: "Email invalido." }, 400);
  if (password.length < 8) return json({ error: "La clave debe tener 8+ caracteres." }, 400);

  const sql = db();
  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing.length > 0) return json({ error: "Ese email ya esta registrado." }, 409);

  const passwordHash = await hashPassword(password);
  const rows = await sql`INSERT INTO users (email, password_hash) VALUES (${email}, ${passwordHash}) RETURNING id, email`;
  const user = rows[0];
  await sql`INSERT INTO progress (user_id) VALUES (${user.id}) ON CONFLICT (user_id) DO NOTHING`;

  const token = signSession(user.id);
  return new Response(JSON.stringify({ ok: true, email: user.email }), {
    status: 201,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookie(token),
    },
  });
}
