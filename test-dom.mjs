// test-dom.mjs — smoke test del layout partido y del chat con DOM real.
// Uso: node test-dom.mjs
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TextDecoder } from "node:util";

const html = fs.readFileSync("index.html", "utf8");
const errors = [];
const calls = [];
const XSS = '<img src=x onerror="alert(1)">';
const REPLY = "Hola **profe**. Las microtareas son...\n\n```js\nawait Promise.resolve();\n```\n" + XSS;
// Respuesta tipo del corrector: encabezado, tabla markdown, negritas y XSS.
const REVIEW = [
  "## Veredicto",
  "APTO CON OBSERVACIONES — 7.5/10",
  "",
  "| Criterio | Puntaje |",
  "|---|---:|",
  "| Deteccion del bug (35%) | 3.5/3.5 |",
  "| Explicacion tecnica (30%) | 1.5/3 |",
  "",
  "## Que te falto",
  "- Falta el paso 3, **cuando se manifiesta**.",
  "",
  "```js",
  "for (const u of xs) await f(u);",
  "```",
  "",
  XSS,
].join("\n");

function sse(text) {
  const parts = [
    "data: " + JSON.stringify({ choices: [{ delta: { content: text } }] }) + "\n\n",
    "data: [DONE]\n\n",
  ].map((s) => new TextEncoder().encode(s));
  let i = 0;
  return {
    ok: true,
    headers: { get: (k) => (k.toLowerCase() === "content-type" ? "text/event-stream" : null) },
    body: { getReader: () => ({ read: () => Promise.resolve(i < parts.length ? { done: false, value: parts[i++] } : { done: true }) }) },
    json: () => Promise.resolve({}),
  };
}

const dom = new JSDOM(html, {
  url: "https://bootcamp.test/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  beforeParse(w) {
    w.TextDecoder = TextDecoder;
    w.fetch = (url, opts) => {
      calls.push({ url, opts });
      if (url === "/api/chat") return Promise.resolve(sse(REPLY));
      if (url === "/api/review") return Promise.resolve(sse(REVIEW));
      if (url === "/api/answers") {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: () => Promise.resolve({ answers: {}, degraded: false }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve({}) });
    };
    w.addEventListener("error", (e) => errors.push(String((e && e.error && e.error.message) || e.message)));
  },
});

const w = dom.window;
const d = w.document;
const $ = (id) => d.getElementById(id);
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const ok = (c, m) => { console.log((c ? "OK   " : "FAIL ") + m); if (!c) fails.push(m); };

await tick(50);

// 1. La pagina arranca sin errores de JS.
ok(errors.length === 0, "arranca sin errores JS" + (errors.length ? ": " + errors[0] : ""));

// 2. Los tres marcos existen y estan anidados bien.
ok(!!$("paneTop") && !!$("chatPane") && !!$("splitter"), "marco superior + splitter + marco inferior");
ok(!!d.querySelector(".panes > .pane-top > main"), "main dentro del marco superior");
ok(!!d.querySelector(".panes > .pane-bottom"), "chat dentro de .panes");
ok(d.querySelector("main > section") !== null, "secciones del curso dentro de main");

// 3. El curso y la barra de progreso quedaron intactos.
ok(d.querySelectorAll(".exercise").length === 17, "17 ejercicios en el DOM");
ok($("pt").textContent === "0 / 17", "progreso renderiza 0 / 17 (got: " + $("pt").textContent + ")");
ok(d.querySelectorAll("#chipRow .chip").length === 4, "4 chips de pregunta rapida");

// 4. Envio del chat -> request correcta + respuesta pintada.
const form = $("chatForm");
const input = $("chatInput");
input.value = "¿Que es una microtarea?";
form.dispatchEvent(new w.Event("submit", { cancelable: true }));
await tick(60);

const call = calls.find((c) => c.url === "/api/chat");
ok(!!call, "fetch a /api/chat lanzado");
if (call) {
  const body = JSON.parse(call.opts.body);
  ok(body.messages && body.messages.length === 1 && body.messages[0].role === "user", "messages enviados");
  ok(typeof body.context === "string", "contexto de seccion enviado");
}
const users = d.querySelectorAll(".msg.user");
ok(users.length === 1 && users[0].textContent.indexOf("microtarea") > -1, "burbuja del usuario");
const bot = d.querySelector(".msg.bot");
ok(!!bot && bot.innerHTML.length > 0, "burbuja de la IA con contenido");

// 5. Render seguro: la IA no puede inyectar HTML (el propio modulo 5 del curso).
ok(bot && bot.innerHTML.includes("&lt;img"), "XSS escapado -> &lt;img");
ok(bot && !bot.innerHTML.includes("<img src=x"), "no se inyecta la etiqueta real");
ok(bot && bot.innerHTML.includes("<strong>profe</strong>"), "markdown **negritas** renderizado");
ok(bot && bot.innerHTML.includes("<code>"), "markdown inline renderizado");
ok(bot && bot.innerHTML.includes("<pre>"), "bloque de codigo renderizado");

// 6. Persistencia del historial.
await tick(20);
const saved = w.localStorage.getItem("bootcamp_ai_chat_v1");
ok(!!saved && saved.includes("microtarea"), "historial persistido en localStorage");

// 7. Limpiar la conversacion.
$("chatClear").click();
ok(d.querySelectorAll(".msg.user").length === 0, "limpiar borra las burbujas");
ok(w.localStorage.getItem("bootcamp_ai_chat_v1") === "[]", "limpiar borra el historial");

// 8. Bloque de respuesta del alumno: uno por cada uno de los 17 ejercicios.
const boxes = d.querySelectorAll(".answer");
ok(boxes.length === 17, "17 bloques de respuesta (got: " + boxes.length + ")");
ok(d.querySelectorAll(".answer-input").length === 17, "17 textareas para escribir");
ok(d.querySelectorAll(".btn-eval").length === 17, "17 botones de correccion");

// Debe quedar ANTES de los botones de pista/solucion: escribir antes de mirar.
const ex11 = d.querySelector('.exercise[data-ex="1.1"]');
const box11 = ex11.querySelector(".answer");
const act11 = ex11.querySelector(".actions");
ok(!!box11 && !!act11 && box11.compareDocumentPosition(act11) & w.Node.DOCUMENT_POSITION_FOLLOWING,
  "la respuesta va antes de Pista / Ver solucion (regla de oro)");
const ta11 = ex11.querySelector(".answer-input");
ok(ta11.getAttribute("placeholder").indexOf("Qué falla") > -1, "el placeholder propone los 5 pasos");

// Escribir guarda en localStorage.
ta11.value = "forEach no espera las promesas del callback async, por eso total es 0.";
ta11.dispatchEvent(new w.Event("input", { bubbles: true }));
await tick(600);
const savedAnswers = w.localStorage.getItem("bootcamp_answers_v1");
ok(!!savedAnswers && savedAnswers.includes("forEach"), "la respuesta se guarda en localStorage");
ok(ex11.querySelector(".answer-count").textContent.indexOf("caracteres") > -1, "el contador de caracteres se actualiza");

// 9. Corregir: request a /api/review con SOLO {ex, answer} (no la rubrica).
ex11.querySelector(".btn-eval").click();
await tick(80);
const rcall = calls.find((c) => c.url === "/api/review");
ok(!!rcall, "fetch a /api/review lanzado");
if (rcall) {
  const rb = JSON.parse(rcall.opts.body);
  ok(rb.ex === "1.1", "envia el id del ejercicio");
  ok(rb.answer && rb.answer.indexOf("forEach") > -1, "envia la respuesta del alumno");
  // Si el cliente mandara la rubrica, el alumno podria inflarse la nota.
  ok(!("rubric" in rb) && !("solucion" in rb) && !("enunciado" in rb),
    "no envia rubrica ni solucion (el servidor las resuelve)");
}
const rev = ex11.querySelector(".review");
ok(!!rev && !rev.classList.contains("hidden"), "la correccion se muestra");
ok(rev && rev.innerHTML.includes("<table>"), "la tabla de la rubrica se renderiza");
ok(rev && rev.innerHTML.includes('class="md-h"'), "el encabezado ## se renderiza");
ok(rev && rev.innerHTML.includes("<strong>faltó</strong>") || (rev && rev.innerHTML.includes("<strong>cuando se manifiesta</strong>")),
  "negritas dentro de la correccion");
ok(rev && rev.innerHTML.includes("&lt;img"), "XSS de la correccion escapado -> &lt;img");
ok(rev && !rev.innerHTML.includes("<img src=x"), "la correccion no inyecta la etiqueta real");
ok(ex11.querySelector(".btn-eval").disabled === false, "el boton se rehabilita al terminar");

// Guardar la correccion para la proxima visita.
await tick(600);
const savedReview = w.localStorage.getItem("bootcamp_answers_v1");
ok(!!savedReview && savedReview.indexOf("Veredicto") > -1, "la correccion queda guardada");

// 10. Respuesta vacia: el boton NO llama a la IA, avisa en el sitio.
const ex12 = d.querySelector('.exercise[data-ex="1.2"]');
const before = calls.filter((c) => c.url === "/api/review").length;
ex12.querySelector(".btn-eval").click();
await tick(60);
ok(calls.filter((c) => c.url === "/api/review").length === before,
  "respuesta vacia: no llama a la IA");
ok(ex12.querySelector(".review").textContent.indexOf("Escribe tu respuesta primero") > -1,
  "respuesta vacia: avisa que escriba primero");

// 11. Plegar / desplegar el marco de chat.
$("chatToggle").click();
ok($("chatPane").classList.contains("collapsed"), "toggle pliega el chat");
$("chatToggle").click();
ok(!$("chatPane").classList.contains("collapsed"), "toggle despliega el chat");

// 9. Splitter: pointerdown + pointerup no revienta.
let splitErr = null;
try {
  $("splitter").dispatchEvent(new w.Event("pointerdown", { cancelable: true }));
  w.dispatchEvent(new w.Event("pointermove"));
  w.dispatchEvent(new w.Event("pointerup"));
} catch (e) { splitErr = e; }
ok(!splitErr, "splitter arrastrable sin excepciones" + (splitErr ? ": " + splitErr.message : ""));

ok(errors.length === 0, "sigue sin errores JS al final");
console.log("\n" + (fails.length ? "FAIL (" + fails.length + ")" : "PASS"));
process.exit(fails.length ? 1 : 0);
