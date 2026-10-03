import { db, readJson, getSessionToken } from "../lib/db.mjs";
import { verifySession } from "../lib/auth.mjs";
import { VALID_IDS } from "../lib/course.mjs";

// GET  -> { answers: { "1.1": { body, review, updated_at } } }
// PUT  -> upsert de una o varias respuestas.
//
// DEGRADACION ELEGANTE (a proposito): si la tabla `answers` todavia no existe,
// este endpoint responde 503 con { degraded: true } en vez de reventar con un
// 500. El frontend lo detecta y se queda solo con localStorage. Motivo: la tabla
// se creo despues que el resto del esquema, y un despliegue que llegue antes de
// `npm run db:init` no debe romper el curso para nadie.

const MAX_BODY = 12000;
const MAX_REVIEW = 20000;
const MAX_ITEMS = 25; // por request

function cleanEx(v) {
  return typeof v === "string" && VALID_IDS.includes(v.trim()) ? v.trim() : null;
}

function clamp(s, max) {
  if (typeof s !== "string") return "";
  return s.slice(0, max);
}

export default async function handler(req, res) {
  const userId = verifySession(getSessionToken(req));
  if (!userId) {
    res.status(401).json({ error: "Sin sesion." });
    return;
  }

  let sql;
  try {
    sql = db();
  } catch (e) {
    res.status(503).json({ error: "Sin configuracion de base de datos.", degraded: true });
    return;
  }

  if (req.method === "GET") {
    let rows;
    try {
      rows = await sql`
        SELECT ex_id, body, review, updated_at FROM answers WHERE user_id = ${userId}
      `;
    } catch (e) {
      // 42P01 = undefined_table. Es el unico caso esperado: la migracion aun no corrio.
      const code = e && (e.code || e.errorCode || "");
      if (String(code).includes("42P01") || /does not exist/i.test(String(e.message))) {
        res.status(503).json({ error: "Respuestas en nube no disponibles todavia.", degraded: true });
        return;
      }
      throw e;
    }
    const answers = {};
    for (const r of rows) {
      answers[r.ex_id] = { body: r.body || "", review: r.review || "", updated_at: r.updated_at };
    }
    res.status(200).json({ answers, degraded: false });
    return;
  }

  if (req.method === "PUT") {
    const body = await readJson(req);
    const items = Array.isArray(body.answers) ? body.answers.slice(0, MAX_ITEMS) : [];
    if (items.length === 0) {
      res.status(400).json({ error: "Envia { answers: [{ ex, body, review }] }." });
      return;
    }

    // Upsert en una sola sentencia por item, con whitelist de ids validos en JS.
    const saved = [];
    for (const it of items) {
      const ex = cleanEx(it && it.ex);
      if (!ex) continue;
      const text = clamp(it.body, MAX_BODY);
      const review = clamp(it.review, MAX_REVIEW);
      try {
        await sql`
          INSERT INTO answers (user_id, ex_id, body, review, updated_at)
          VALUES (${userId}, ${ex}, ${text}, ${review}, now())
          ON CONFLICT (user_id, ex_id) DO UPDATE
            SET body = EXCLUDED.body, review = EXCLUDED.review, updated_at = now()
        `;
        saved.push(ex);
      } catch (e) {
        const code = e && (e.code || e.errorCode || "");
        if (String(code).includes("42P01") || /does not exist/i.test(String(e.message))) {
          res.status(503).json({ error: "Respuestas en nube no disponibles todavia.", degraded: true });
          return;
        }
        throw e;
      }
    }
    res.status(200).json({ ok: true, saved, degraded: false });
    return;
  }

  res.status(405).json({ error: "Metodo no permitido." });
}