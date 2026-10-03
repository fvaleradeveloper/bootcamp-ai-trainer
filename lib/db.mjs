import { neon } from "@neondatabase/serverless";

let cached = null;

// Cliente Neon (HTTP, apto para serverless). Requiere DATABASE_URL.
export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta DATABASE_URL en variables de entorno.");
  }
  if (!cached) cached = neon(url);
  return cached;
}

// Lee el cuerpo de la request. Soporta Vercel Node (req.body ya
// parseado) y formato Web (req.json()).
export async function readJson(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body || {};
  }
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// Respuesta JSON estandar.
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// Extrae el token de sesion de la cookie "session".
// Soporta Vercel Node (req.cookies) y formato Web (header cookie).
export function getSessionToken(req) {
  if (req.cookies && typeof req.cookies.session === "string") {
    return req.cookies.session;
  }
  const raw = (req.headers && (req.headers.cookie || (req.headers.get && req.headers.get("cookie")))) || "";
  const m = String(raw).match(/(?:^|;\s*)session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Cookie de sesion: HttpOnly, SameSite=Lax, Secure en produccion.
export function sessionCookie(token) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `session=${encodeURIComponent(token)}; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax${secure}`;
}

// Cookie para cerrar sesion.
export function clearSessionCookie() {
  return "session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax";
}
