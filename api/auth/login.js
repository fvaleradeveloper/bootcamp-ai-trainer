import { db, readJson, sessionCookie } from "../../lib/db.mjs";
import { checkPassword, normalizeEmail, signSession } from "../../lib/auth.mjs";

// POST /api/auth/login  { email, password } -> verifica y crea sesion.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido." });
    return;
  }
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!email || !password) {
    res.status(400).json({ error: "Email y clave requeridos." });
    return;
  }

  const sql = db();
  const rows = await sql`SELECT id, email, password_hash FROM bootcamp.users WHERE email = ${email}`;
  const user = rows[0];
  // Respuesta generica para no revelar si el email existe (anti-enumeracion).
  if (!user || !(await checkPassword(password, user.password_hash))) {
    res.status(401).json({ error: "Credenciales invalidas." });
    return;
  }

  const token = signSession(user.id);
  res.setHeader("Set-Cookie", sessionCookie(token));
  res.status(200).json({ ok: true, email: user.email });
}
