// Prueba lib/auth.mjs: hash, firmas de sesion y validacion de email.
import assert from "node:assert/strict";
import {
  hashPassword, checkPassword, signSession, verifySession, normalizeEmail,
} from "./lib/auth.mjs";

process.env.SESSION_SECRET = "test-secret-largo";

// bcrypt: hash verifica, clave mala no.
const hash = await hashPassword("clave-secreta-123");
assert.ok(await checkPassword("clave-secreta-123", hash));
assert.equal(await checkPassword("otra-clave", hash), false);

// sesion: firma valida -> userId; manipulada/expirada -> null.
process.env.SESSION_SECRET = "test-secret-largo";
const token = signSession(42);
assert.equal(verifySession(token), 42);
assert.equal(verifySession(token + "x"), null);
assert.equal(verifySession("no.es.token"), null);
assert.equal(verifySession(null), null);

// email: normaliza y rechaza malformados.
assert.equal(normalizeEmail("  USER@Mail.COM "), "user@mail.com");
assert.equal(normalizeEmail("sin-arroba"), null);
assert.equal(normalizeEmail("a@b"), null);

console.log("auth OK");
