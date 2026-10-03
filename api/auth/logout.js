import { clearSessionCookie } from "../../lib/db.mjs";

// POST /api/auth/logout -> cierra la sesion (limpia la cookie).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido." });
    return;
  }
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.status(200).json({ ok: true });
}
