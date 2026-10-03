import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "node:crypto";

// --- Tokens de sesion firmados (sin JWT externo) ---
// Formato: userId.exp.firma  (firma = HMAC-SHA256 de "userId.exp")

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("Falta SESSION_SECRET en variables de entorno.");
  return s;
}

export function signSession(userId) {
  const exp = Date.now() + 30 * 24 * 3600 * 1000; // 30 dias
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

// Devuelve userId (number) si el token es valido, o null.
export function verifySession(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (!/^\d+$/.test(userId)) return null;
  if (Number(exp) < Date.now()) return null;
  const expected = createHmac("sha256", secret()).update(`${userId}.${exp}`).digest();
  let given;
  try {
    given = Buffer.from(sig, "hex");
  } catch {
    return null;
  }
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;
  return Number(userId);
}

// --- Passwords con bcrypt ---

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function checkPassword(password, hash) {
  if (!password || !hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

// Email normalizado y validado (formato basico).
export function normalizeEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return null;
  return e;
}
