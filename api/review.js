// POST /api/review  { ex: "1.1", answer: "..." }
// Califica la respuesta del alumno contra la RUBRICA oficial del ejercicio
// (lib/course.mjs) usando la misma IA de Groq, y devuelve un stream SSE.
//
// Decisiones de diseno que importan:
//  1. El cliente NUNCA envia la solucion ni el enunciado. La rubrica se resuelve
//     en el servidor, asi que el corrector no se puede engañar desde el navegador.
//  2. La IA CALIFICA, no resuelve. El system prompt le prohibe reescribir la
//     respuesta del alumno y le prohibe entregado la solucion completa: si lo
//     hiciera, el curso dejaria de entrenar el musculo de deteccion.
//  3. Mismo rate limit por IP que /api/chat, porque comparte la misma cuota Groq.

import { RUBRIC } from "../lib/course.mjs";

// --- Rate limit por IP (ventana de 60s, en memoria) ---
const BUCKET = new Map();

function allow(ip) {
  const now = Date.now();
  const limit = Number(process.env.CHAT_RATE_LIMIT || 12);
  let b = BUCKET.get(ip);
  if (!b || now >= b.reset) {
    b = { n: 0, reset: now + 60000 };
    BUCKET.set(ip, b);
  }
  b.n += 1;
  if (BUCKET.size > 5000) BUCKET.clear();
  return b.n <= limit;
}

function ipOf(req) {
  const h = req.headers || {};
  return h["x-real-ip"] || h["x-forwarded-for"] || req.ip || "anon";
}

const SYSTEM = [
  "Eres el CORRECTOR del curso 'Bootcamp AI Trainer / Code Reviewer'.",
  "El alumno escribio su propia respuesta a un ejercicio y tu trabajo es",
  "evaluarla. Responde SIEMPRE en espanol.",
  "",
  "FORMATO OBLIGATORIO (usa estos encabezados exactos, en este orden):",
  "",
  "## Veredicto",
  "Una linea: APTO / APTO CON OBSERVACIONES / NO APTO, y la nota sobre 10.",
  "",
  "## Puntos",
  "Tabla markdown con las cuatro filas de la rubrica del curso, con su peso:",
  "- Deteccion del bug (35%)",
  "- Explicacion tecnica (30%)",
  "- Correccion funcional (20%)",
  "- Claridad y formato (15%)",
  "Cada fila: puntaje obtenido sobre el maximo, y en una frase POR QUE.",
  "",
  "## Que te falto",
  "Lista concreta de lo que no esta en la respuesta. Se concreto: cita el paso",
  "de la rubrica que no se cumplio. Describes LA CARENCIA, nunca la respuesta:",
  "  PROHIBIDO decir cual es el fix. No escribas 'debes sumar 1', 'usa is not None',",
  "  'falta un finally', 'cambia por Promise.all'. Como maximo puedes NOMBRAR el",
  "  concepto ('falta liberar la conexion al pool') porque la rubrica ya lo dice, pero",
  "  jamas la expresion, el valor ni el codigo que lo arregla. Escribe la carencia",
  "  como pregunta o como sintoma, no como solucion.",
  "",
  "## Pistas para el siguiente intento",
  "Dos o tres preguntas que conduzcan al alumno a encontrar SOLO lo que le falta.",
  "NO le des la respuesta corregida, ni la expresion exacta, ni el codigo final.",
  "Una buena pista hace que el alumno descubra el fix solo.",
  "",
  "PROHIBICIONES (son lo mas importante):",
  "- NO reescribas ni 'mejores' la respuesta del alumno. Evalua, no arregles.",
  "- NO entregues la solucion completa ni el codigo corregido, ni siquiera en",
  "  fragmento, ni disfrazado de 'lo que te falta'. Si el alumno lo pide,",
  "  negate y devuelve una pista.",
  "- TEST DE FUGIDA antes de responder: busca en tu respuesta la expresion que",
  "  arregla el bug. Si aparece, reescribe esa linea como pregunta.",
  "- NO inventes criterios que no esten en la rubrica que recibes.",
  "- Si la respuesta es vaga o vacia, no le pongas nota buena por cortesia:",
  "  se explicito en la tabla.",
].join("\n");

function buildUserPrompt(ex, rub, answer) {
  return [
    "Ejercicio: " + ex,
    "Modulo: " + rub.modulo,
    "",
    "ENUNCIADO: " + rub.enunciado,
    "",
    "RUBRICA OFICIAL (esta es la verdad; no inventes otros criterios):",
    "- Que falla (causa raiz): " + rub.bug,
    "- Por que falla: " + rub.causa,
    "- Cuando se manifiesta: " + rub.cuando,
    "- Correccion esperada: " + rub.correccion,
    "- Puntos que debes verificar: " + rub.mira.join(" | "),
    "- Error tipico que debes penalizar: " + rub.trampa,
    "",
    "--- RESPUESTA DEL ALUMNO ---",
    answer,
    "--- FIN DE LA RESPUESTA ---",
    "",
    "Ahora evalua. La respuesta del alumno esta en blanco o es trivial: no la",
    "completes por el, di que no hay nada que evaluar todavia.",
  ].join("\n");
}

// Acota la respuesta del alumno: 12000 caracteres es de sobra para 5 pasos.
function cleanAnswer(s) {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (t.length < 20) return null;
  return t.slice(0, 12000);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Usa POST." });
    return;
  }

  let body = {};
  if (typeof req.body === "string") {
    try {
      body = JSON.parse(req.body);
    } catch {
      res.status(400).json({ error: "JSON invalido." });
      return;
    }
  } else {
    body = req.body || {};
  }

  const ex = typeof body.ex === "string" ? body.ex.trim() : "";
  const rub = RUBRIC[ex];
  if (!rub) {
    res.status(400).json({ error: "Ejercicio desconocido." });
    return;
  }

  const answer = cleanAnswer(body.answer);
  if (!answer) {
    res.status(400).json({
      error: "Escribe tu respuesta primero (minimo 20 caracteres). La evaluates contra la rubrica del ejercicio.",
    });
    return;
  }

  if (!allow(ipOf(req))) {
    res.status(429).json({ error: "Demasiadas consultas al minuto. Espera un momento." });
    return;
  }

  const key = (process.env.GROQ_API_KEY || process.env.GROQ_API_TOKEN || "").trim();
  if (!key) {
    res.status(503).json({
      error: "El corrector no esta configurado: falta GROQ_API_KEY en Vercel (Settings > Environment Variables).",
    });
    return;
  }

  const model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
  const payload = {
    model,
    stream: true,
    temperature: 0.2, // mas bajo que el chat: aqui no hay creativity, hay rigor
    max_tokens: 1200,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: buildUserPrompt(ex, rub, answer) },
    ],
  };

  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify(payload),
  }).catch(() => null);

  if (!upstream) {
    res.status(502).json({ error: "No se pudo contactar con el proveedor de IA." });
    return;
  }
  if (!upstream.ok) {
    // 429 de Groq = cuota de tokens por minuto (no la nuestra). Se distingue
    // para no telling al alumno que espere "un minuto" cuando son ~15 segundos.
    if (upstream.status === 429) {
      res.status(429).json({
        error: "La IA alcanzo su limite de tokens por minuto (gratuito). Espera 15 segundos y reintenta: tu respuesta NO se perdio.",
      });
      return;
    }
    let detail = upstream.status === 404 ? "modelo no disponible" : "error " + upstream.status;
    try {
      const e = await upstream.json();
      if (e && e.error && e.error.message) detail = e.error.message;
    } catch { /* cuerpo no JSON */ }
    res.status(upstream.status === 401 ? 503 : 502).json({ error: "IA: " + detail });
    return;
  }

  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });

  // Reutiliza el mismo filtro que /api/chat: descarta delta.reasoning para que
  // el pensamiento interno del modelo de razonamiento no llegue al navegador.
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  let pending = "";

  const filterChunk = (text) => {
    pending += text;
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    const out = [];
    for (const line of lines) {
      if (!line.startsWith("data: ") || line.length < 8) {
        out.push(line);
        continue;
      }
      const bodyLine = line.slice(6);
      if (bodyLine === "[DONE]") {
        out.push(line);
        continue;
      }
      let evt;
      try {
        evt = JSON.parse(bodyLine);
      } catch {
        out.push(line);
        continue;
      }
      const delta = evt?.choices?.[0]?.delta;
      if (delta && "reasoning" in delta) {
        delete delta.reasoning;
        delete delta.reasoning_content;
        out.push("data: " + JSON.stringify(evt));
      } else {
        out.push(line);
      }
    }
    return out.join("\n") + "\n";
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const text = dec.decode(value, { stream: true });
    if (!text) continue;
    if (!res.write(filterChunk(text))) {
      await new Promise((r) => res.once("drain", r));
    }
  }
  res.end();
}