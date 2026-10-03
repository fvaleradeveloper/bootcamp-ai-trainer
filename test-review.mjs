// test-review.mjs â€” valida /api/review y /api/answers sin salir a la red.
// Uso: node --import ./test-hooks.mjs test-review.mjs
import assert from "node:assert/strict";
import { RUBRIC, VALID_IDS, WEIGHTS } from "./lib/course.mjs";

delete process.env.GROQ_API_KEY;
delete process.env.GROQ_API_TOKEN;

const review = (await import("./api/review.js")).default;
const answers = (await import("./api/answers.js")).default;

// Sesion real (firmada con SESSION_SECRET) para pasar verifySession.
globalThis.__MOCK_DB__ = { users: [], progress: {}, answers: {} };
process.env.DATABASE_URL = "postgresql://mock/mock";
process.env.SESSION_SECRET = "test-secret-largo-para-el-corrector";
const register = (await import("./api/auth/register.js")).default;

function mkReqRes({ method = "POST", body = {}, cookie = "" } = {}) {
  return [
    { method, body, headers: { cookie, "x-real-ip": "test-ip" }, cookies: {}, ip: "test-ip" },
    {
      statusCode: 200,
      payload: null,
      chunks: [],
      headers: {},
      status(c) { this.statusCode = c; return this; },
      json(o) { this.payload = o; return this; },
      writeHead(c) { this.statusCode = c; return this; },
      write(c) { this.chunks.push(c); return true; },
      end() { return this; },
      once() {},
      setHeader(k, v) { this.headers[k] = v; return this; },
    },
  ];
}

const regRes = mkReqRes()[1];
await register(
  { method: "POST", body: { email: "yo@mail.com", password: "clave1234" }, headers: {}, cookies: {} },
  regRes
);
const COOKIE = String(regRes.headers["Set-Cookie"] || "").split(";")[0];
assert.ok(COOKIE.startsWith("session="), "sesion de prueba creada");

function req(body, method = "POST", cookie = COOKIE) {
  const [a] = mkReqRes();
  a.body = body;
  a.method = method;
  a.headers.cookie = cookie;
  return a;
}
function res() {
  return mkReqRes()[1];
}

const BUENA = "forEach no espera las promesas del callback async, asi que total se retorna " +
  "antes de incrementarse. Siempre falla. Corrijo con map y Promise.all.";

// ---------------------------------------------------------------- rubricas
assert.equal(VALID_IDS.length, 17, "17 ids validos");
assert.deepEqual(VALID_IDS, [
  "1.1", "1.2", "1.3", "1.4", "2.1", "2.2", "2.3",
  "3.1", "3.2", "3.3", "4.1", "4.2", "4.3",
  "5.1", "5.2", "5.3", "6.1",
], "los ids son los mismos que acepta /api/progress");
assert.equal(WEIGHTS.reduce((s, w) => s + w.pct, 0), 100, "los pesos suman 100");
for (const id of VALID_IDS) {
  const r = RUBRIC[id];
  for (const f of ["modulo", "enunciado", "bug", "causa", "cuando", "correccion"]) {
    assert.ok(typeof r[f] === "string" && r[f].length > 3, id + "." + f + " debe existir");
  }
  assert.ok(Array.isArray(r.mira) && r.mira.length >= 3, id + ".mira debe tener >= 3 puntos");
  assert.ok(typeof r.trampa === "string" && r.trampa.length > 3, id + ".trampa debe existir");
}

// ---------------------------------------------------------------- /api/review
let r = res();
await review(req({}, "GET"), r);
assert.equal(r.statusCode, 405, "solo POST");

for (const body of [
  { ex: "9.9", answer: BUENA },     // ejercicio inexistente
  { ex: "1.1", answer: "corto" },   // demasiado corta
  { ex: "1.1", answer: "   " },     // solo espacios
  { ex: "1.1", answer: 12345 },     // no es string
  { ex: 11, answer: BUENA },        // id no string
  { nope: true },
]) {
  const rr = res();
  await review(req(body), rr);
  assert.equal(rr.statusCode, 400, JSON.stringify(body));
}

r = res();
await review(req("{no es json"), r);
assert.equal(r.statusCode, 400, "JSON roto -> 400, no 500");

// Sin GROQ_API_KEY -> 503 con mensaje util, y el rate limit corta en la 13Âª.
let c503 = 0;
let c429 = 0;
let err503 = "";
for (let i = 0; i < 13; i++) {
  const rr = res();
  await review(req({ ex: "1.1", answer: BUENA + " intento " + i }), rr);
  if (rr.statusCode === 503) {
    c503++;
    if (!err503 && rr.payload) err503 = rr.payload.error || "";
  } else if (rr.statusCode === 429) {
    c429++;
  }
}
assert.equal(c503, 12, "12 aceptadas -> 503 (sin clave)");
assert.equal(c429, 1, "la 13Âª -> 429 rate limit");
assert.match(err503, /GROQ_API_KEY/);

// ---------------------------------------------------------------- /api/answers
// SIN cookie: 401, y el metodo ni se mira.
r = res();
await answers(req({}, "GET", ""), r);
assert.equal(r.statusCode, 401, "sin sesion -> 401");
r = res();
await answers(req({ answers: [{ ex: "1.1", body: "x" }] }, "PUT", ""), r);
assert.equal(r.statusCode, 401, "sin sesion -> 401 tambien en PUT");
r = res();
await answers(req({}, "DELETE", ""), r);
assert.equal(r.statusCode, 401, "sin sesion -> 401 antes de comprobar el metodo");
// Con sesion, un metodo no soportado si es 405.
r = res();
await answers(req({}, "DELETE"), r);
assert.equal(r.statusCode, 405, "DELETE con sesion -> 405 metodo no permitido");

// Con sesion valida y con la tabla `answers` todavia sin migrar.
globalThis.__MOCK_NO_ANSWERS__ = true;

r = res();
await answers(req({}, "GET"), r);
assert.equal(r.statusCode, 503, "tabla ausente en GET -> 503");
assert.equal(r.payload.degraded, true, "marca degraded: el frontend cae a localStorage");

r = res();
await answers(req({ answers: [{ ex: "1.1", body: "hola" }] }, "PUT"), r);
assert.equal(r.statusCode, 503, "tabla ausente en PUT -> 503");
assert.equal(r.payload.degraded, true, "PUT tambien degrada limpio");

// Con la tabla presente: GET devuelve lo guardado.
globalThis.__MOCK_NO_ANSWERS__ = false;

r = res();
await answers(req({ answers: [
  { ex: "1.1", body: "mi respuesta del 1.1", review: "APTO 8/10" },
  { ex: "3.2", body: "mi respuesta del 3.2", review: "" },
] }, "PUT"), r);
assert.equal(r.statusCode, 200, "PUT guarda dos respuestas");
assert.deepEqual(r.payload.saved, ["1.1", "3.2"], "reporta las guardadas");

// Ids invalidos se descartan en silencio (whitelist server-side).
r = res();
await answers(req({ answers: [
  { ex: "9.9", body: "no valido" },
  { ex: "../../etc/passwd", body: "no valido" },
  { ex: "1.2", body: "si valido" },
] }, "PUT"), r);
assert.equal(r.statusCode, 200);
assert.deepEqual(r.payload.saved, ["1.2"], "descarta los ids fuera de la lista");

r = res();
await answers(req({}, "GET"), r);
assert.equal(r.statusCode, 200, "GET con tabla presente");
assert.ok(r.payload.answers["1.1"], "devuelve la 1.1");
assert.equal(r.payload.answers["1.1"].body, "mi respuesta del 1.1");
assert.equal(r.payload.answers["1.1"].review, "APTO 8/10");
assert.equal(r.payload.answers["3.2"].review, "");
assert.ok(!r.payload.answers["9.9"], "no devuelve ids que nunca se guardaron");

// LÃ­mite de tamaÃ±o: el cuerpo se recorta, no se rechaza.
const enorme = "x".repeat(50000);
r = res();
await answers(req({ answers: [{ ex: "1.3", body: enorme, review: enorme }] }, "PUT"), r);
assert.equal(r.statusCode, 200);
r = res();
await answers(req({}, "GET"), r);
assert.equal(r.payload.answers["1.3"].body.length, 12000, "body recortado a 12000");
assert.equal(r.payload.answers["1.3"].review.length, 20000, "review recortado a 20000");

// Payload vacio -> 400.
r = res();
await answers(req({ answers: [] }, "PUT"), r);
assert.equal(r.statusCode, 400, "lista vacia -> 400");
r = res();
await answers(req({}, "PUT"), r);
assert.equal(r.statusCode, 400, "sin campo answers -> 400");

console.log("review OK (rubricas 17 completas / 405 / 400x6 / 400-json / 503x12 / 429 / " +
  "answers 401 / 405 / 503-degraded / whitelist / recorte / GET)");