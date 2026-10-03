import { db, readJson, json, sessionCookie } from "../../lib/db.mjs";
import { checkPassword, normalizeEmail, signSession } from "../../lib/auth.mjs";

// POST /api/auth/login  { email, password } -> verifica y crea sesion.
export async function POST(req) {
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!email || !password) return json({ error: "Email y clave requeridos." }, 400);

  const sql = db();
  const rows = await sql`SELECT id, email, password_hash FROM users WHERE email = ${email}`;
  const user = rows[0];
  // Respuesta generica para no revelar si el email existe (anti-enumeracion).
  if (!user || !(await checkPassword(password, user.password_hash))) {
    return json({ error: "Credenciales invalidas." }, 401);
  }

  const token = signSession(user.id);
  return new Response(JSON.stringify({ ok: true, email: user.email }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookie(token),
    },
  });
}
