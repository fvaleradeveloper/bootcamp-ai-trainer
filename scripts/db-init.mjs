// Crea las tablas en Neon: `npm run db:init` (requiere DATABASE_URL).
// Lee .env.local automaticamente si existe (ver package.json).
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
const raw = fs.readFileSync(path.join(here, "schema.sql"), "utf8");

// Quita comentarios de linea para no enviarlos como statements.
const cleaned = raw
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

// El driver serverless ejecuta una sentencia por llamada: partimos por ";".
const statements = cleaned
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const client = neon(url);
for (const stmt of statements) {
  await client(stmt);
}

// Verificacion: lista las tablas creadas dentro del schema `bootcamp`.
const tables = await client`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'bootcamp' ORDER BY 1`;
console.log("OK: " + statements.length + " sentencias aplicadas.");
console.log("schema bootcamp -> " + tables.map((t) => t.table_name).join(", "));
