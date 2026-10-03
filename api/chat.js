// POST /api/chat  { messages:[{role,content}], context:string }
// Proxy SERVER-SIDE a Groq (tier gratuito). La API key nunca llega al navegador.
// Devuelve un stream SSE con formato OpenAI (`data: {...}` / `data: [DONE]`).

const SYSTEM = [
  'Eres el tutor del "Bootcamp AI Trainer / Code Reviewer", un curso en espanol',
  "que prepara para las pruebas tecnicas de DataAnnotation.tech y Outlier",
  "(puesto: code reviewer para entrenamiento de modelos de IA).",
  "",
  "Tu unica labor: ayudar al estudiante a entender la TEORIA cuando algo no le queda claro.",
  "",
  "Modulos del curso:",
  "1. Asincronia JS/Node: event loop, microtareas vs macrotareas, los 4 combinadores",
  "   (all, allSettled, race, any), forEach+async, finally, concurrencia, race conditions.",
  "2. Python: tipos, excepciones (except desnudo), argumentos por defecto mutables,",
  "   truthiness/centinela, is vs ==, mutacion en iteracion.",
  "3. Edge cases: vacio, un elemento, 0, negativo, enorme, duplicados, mixtos, off-by-one,",
  "   division por cero, invariante de busqueda binaria.",
  "4. APIs/HTTP/seguridad: status codes, fetch sin res.ok, SQLi (parametros vs allowlist",
  "   en ORDER BY/LIKE), secrets en logs, hashing, enumeracion de usuarios, timeouts.",
  "5. Frontend: XSS/innerHTML, doble submit + idempotency key, polling con backoff.",
  "6. Simulacro: revision de una API con 17 bugs en 5 categorias.",
  "",
  "Reglas:",
  "- Responde SIEMPRE en espanol, directo y sin relleno.",
  "- Si preguntan por un ejercicio CONCRETO: orienta primero (que buscar, que pregunta",
  "  hacer, que caso de prueba). NO entregues la solucion completa salvo que lo pidan",
  "  literalmente con 'dame la solucion' o 'escribeme la solucion'.",
  "- Usa bloques de codigo etiquetados y ejemplos pequenos cuando aporte.",
  "- Si no sabes o esta fuera del ambito del curso, dilo. No inventes detalles ni APIs.",
].join("\n");

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
  if (BUCKET.size > 5000) BUCKET.clear(); // evita crecimiento descontrolado
  return b.n <= limit;
}

function ipOf(req) {
  const h = req.headers || {};
  return h["x-real-ip"] || h["x-forwarded-for"] || req.ip || "anon";
}

// Limpia y limita los mensajes del cliente (nunca se acepta role system).
function clean(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) return null;
  const out = [];
  let total = 0;
  for (const m of messages) {
    if (!m || typeof m.content !== "string") return null;
    if (m.role !== "user" && m.role !== "assistant") return null;
    const content = m.content.slice(0, 4000).trim();
    if (!content) return null;
    total += content.length;
    if (total > 24000) return null;
    out.push({ role: m.role, content });
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Usa POST." });
    return;
  }

  // req.body llega ya parseado en Vercel; en tests puede ser string.
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
  const messages = clean(body.messages);
  if (!messages) {
    res.status(400).json({ error: "Conversacion invalida (max 30 mensajes, 4000 chars c/u)." });
    return;
  }

  if (!allow(ipOf(req))) {
    res.status(429).json({ error: "Demasiadas consultas al minuto. Espera un momento." });
    return;
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    res.status(503).json({
      error: "El asistente no esta configurado: falta GROQ_API_KEY en Vercel (Settings > Environment Variables).",
    });
    return;
  }

  // Groq apagó llama-3.3-70b-versatile y llama-3.1-8b-instant el 16/08/2026
  // para los tiers gratuito y developer. Los modelos vigentes en el tier
  // gratuito son openai/gpt-oss-120b, openai/gpt-oss-20b, qwen/qwen3.6-27b y
  // qwen/qwen3.8-27b (ver https://console.groq.com/docs/models).
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const ctx = typeof body.context === "string" ? body.context.slice(0, 200) : "";
  const payload = {
    model,
    stream: true,
    temperature: 0.4,
    max_tokens: 900,
    messages: [
      { role: "system", content: SYSTEM },
      ...messages.slice(0, -1),
      {
        role: "user",
        content: ctx
          ? `[Seccion del curso en pantalla: ${ctx}]\n\n` + messages[messages.length - 1].content
          : messages[messages.length - 1].content,
      },
    ],
  };

  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + key,
    },
    body: JSON.stringify(payload),
  }).catch(() => null);

  if (!upstream) {
    res.status(502).json({ error: "No se pudo contactar con el proveedor de IA." });
    return;
  }
  if (!upstream.ok) {
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

  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!res.write(dec.decode(value, { stream: true }))) {
      await new Promise((r) => res.once("drain", r));
    }
  }
  res.end();
}
