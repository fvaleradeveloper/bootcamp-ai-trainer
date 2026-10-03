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

// Lee el cuerpo JSON de una request de forma segura.
export async function readJson(req) {
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
export function getSessionToken(req) {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/);
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
