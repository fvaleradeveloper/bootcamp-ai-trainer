// Hooks de mock para tests: redirige "@neondatabase/serverless" a un
// mock en memoria que lee/escribe globalThis.__MOCK_DB__.
// Uso: node --import ./test-hooks.mjs test-routes.mjs
import { register } from "node:module";

const MOCK_URL = "mock://neon-db";

const mockSource = `export function neon() {
  return async (strings, ...vals) => {
    const db = globalThis.__MOCK_DB__;
    const q = strings.join("?").toLowerCase();
    if (q.includes("select id from users")) {
      return db.users.filter(u => u.email === vals[0]);
    }
    if (q.includes("insert into users")) {
      const u = { id: db.users.length + 1, email: vals[0], password_hash: vals[1] };
      db.users.push(u);
      return [{ id: u.id, email: u.email }];
    }
    if (q.includes("select id, email, password_hash")) {
      return db.users.filter(u => u.email === vals[0]);
    }
    if (q.includes("select email from users")) {
      const u = db.users.find(x => x.id === vals[0]);
      return u ? [{ email: u.email }] : [];
    }
    if (q.includes("insert into progress (user_id, done")) {
      db.progress[vals[0]] = { done: vals[1], open: vals[2] };
      return [{ done: vals[1], open: vals[2], updated_at: new Date() }];
    }
    if (q.includes("from progress where")) {
      const p = db.progress[vals[0]];
      return p ? [{ done: p.done, open: p.open, updated_at: new Date() }] : [];
    }
    if (q.includes("insert into progress")) return [];
    // Simula la tabla todavia no migrada: el endpoint debe degradar, no 500.
    if (globalThis.__MOCK_NO_ANSWERS__) {
      throw Object.assign(new Error('relation "answers" does not exist'), { code: "42P01" });
    }
    // --- answers (respuestas del alumno + correccion) ---
    if (q.includes("insert into answers")) {
      // VALUES (user_id, ex_id, body, review)
      db.answers = db.answers || {};
      const key = vals[0] + ":" + vals[1];
      db.answers[key] = { ex_id: vals[1], body: vals[2], review: vals[3], updated_at: new Date() };
      return [];
    }
    if (q.includes("select ex_id, body, review")) {
      const rows = Object.keys(db.answers || {})
        .filter((k) => k.startsWith(vals[0] + ":"))
        .map((k) => db.answers[k]);
      return rows;
    }
    throw new Error("query no mockeada: " + q.slice(0, 80));
  };
}`;

export async function resolve(specifier, context, next) {
  if (specifier === "@neondatabase/serverless") {
    return { url: MOCK_URL, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url === MOCK_URL) {
    return { format: "module", shortCircuit: true, source: mockSource };
  }
  return next(url, context);
}

// Auto-registro cuando se carga via --import.
register(import.meta.url);
