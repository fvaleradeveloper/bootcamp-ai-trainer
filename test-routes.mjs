// Prueba los handlers (formato Vercel Node req/res) con DB mockeada.
// Uso: node --import ./test-hooks.mjs test-routes.mjs
import assert from "node:assert/strict";

globalThis.__MOCK_DB__ = { users: [], progress: {} };
process.env.DATABASE_URL = "postgresql://mock/mock";
process.env.SESSION_SECRET = "test-secret-largo";

const register = (await import("./api/auth/register.js")).default;
const login = (await import("./api/auth/login.js")).default;
const me = (await import("./api/auth/me.js")).default;
const progress = (await import("./api/progress.js")).default;

// Mini req/res estilo Vercel/Express.
function mockReq({ method = "POST", body = {}, cookie = "" } = {}) {
  return { method, body, headers: { cookie }, cookies: {} };
}
function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    payload: null,
    status(c) { res.statusCode = c; return res; },
    json(o) { res.payload = o; return res; },
    setHeader(k, v) { res.headers[k] = v; return res; },
  };
  return res;
}
function cookieFrom(res) {
  const h = res.headers["Set-Cookie"] || "";
  return String(h).split(";")[0];
}

// registro ok -> 201 + cookie; duplicado -> 409; clave corta -> 400.
let req = mockReq({ body: { email: "yo@mail.com", password: "clave1234" } });
let res = mockRes();
await register(req, res);
assert.equal(res.statusCode, 201);
const sessionCookie = cookieFrom(res);
assert.ok(sessionCookie.startsWith("session="));

res = mockRes();
await register(mockReq({ body: { email: "yo@mail.com", password: "clave1234" } }), res);
assert.equal(res.statusCode, 409);

res = mockRes();
await register(mockReq({ body: { email: "yo@mail.com", password: "corta" } }), res);
assert.equal(res.statusCode, 400);

// login ok -> 200; mala clave -> 401 generico (anti-enumeracion).
res = mockRes();
await login(mockReq({ body: { email: "yo@mail.com", password: "clave1234" } }), res);
assert.equal(res.statusCode, 200);
const loginCookie = cookieFrom(res);

res = mockRes();
await login(mockReq({ body: { email: "yo@mail.com", password: "mala-mala" } }), res);
assert.equal(res.statusCode, 401);
assert.equal(res.payload.error, "Credenciales invalidas.");

res = mockRes();
await login(mockReq({ body: { email: "nadie@mail.com", password: "mala-mala" } }), res);
assert.equal(res.statusCode, 401);
assert.equal(res.payload.error, "Credenciales invalidas.");

// me con cookie -> email; sin cookie -> 401.
res = mockRes();
await me(mockReq({ method: "GET", cookie: loginCookie }), res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.email, "yo@mail.com");

res = mockRes();
await me(mockReq({ method: "GET" }), res);
assert.equal(res.statusCode, 401);

// progress: PUT guarda (filtra ids invalidos), GET devuelve.
res = mockRes();
await progress(mockReq({
  method: "PUT",
  cookie: loginCookie,
  body: { done: ["1.1", "hack'); DROP TABLE users;--"], open: ["1.1:hint"] },
}), res);
assert.equal(res.statusCode, 200);
assert.deepEqual(res.payload.done, ["1.1"]);

res = mockRes();
await progress(mockReq({ method: "GET", cookie: loginCookie }), res);
assert.equal(res.statusCode, 200);
assert.deepEqual(res.payload.done, ["1.1"]);
assert.deepEqual(res.payload.open, ["1.1:hint"]);

// sin sesion -> 401.
res = mockRes();
await progress(mockReq({ method: "GET" }), res);
assert.equal(res.statusCode, 401);

console.log("routes OK");
