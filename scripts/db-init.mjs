// Crea las tablas en Neon: `npm run db:init` (requiere DATABASE_URL).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL. Copia .env.example a .env.local y completalo.");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(here, "schema.sql"), "utf8");
const client = neon(url);

// El driver serverless ejecuta una sentencia por llamada: partimos por ";".
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith("--"));

for (const stmt of statements) {
  await client(stmt);
}
console.log("OK: esquema creado (" + statements.length + " sentencias).");
