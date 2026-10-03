# Bootcamp AI Trainer / Code Reviewer

Curso interactivo para preparar la prueba tecnica de **DataAnnotation.tech / Outlier**
(cargo Code Reviewer para entrenamiento de modelos de IA).

- Un solo frontend estatico (`index.html`, sin frameworks ni CDNs).
- API serverless en Vercel (`/api/*`) + Postgres en Neon para sincronizar tu avance
  entre celular y PC con tu cuenta (email + clave).
- Sin cuenta tambien funciona: tu avance vive en `localStorage` del dispositivo.

## Estructura

| Ruta | Que es |
|---|---|
| `index.html` | Todo el curso: teoria por modulo, 17 ejercicios con Pista 1 + Pista 2 (guiada) + solucion oculta, plantilla de 5 pasos, checklist |
| `api/auth/register.js` | `POST {email, password}` crea usuario + sesion |
| `api/auth/login.js` | `POST {email, password}` abre sesion |
| `api/auth/logout.js` | `POST` cierra sesion |
| `api/auth/me.js` | `GET` sesion actual |
| `api/progress.js` | `GET` / `PUT {done, open}` estado del usuario |
| `api/chat.js` | `POST {messages, context}` -> stream SSE del asistente IA (Groq) |
| `lib/db.mjs`, `lib/auth.mjs` | Cliente Neon, cookies, tokens firmados, bcrypt |
| `scripts/schema.sql`, `scripts/db-init.mjs` | Esquema y creacion de tablas (`npm run db:init`) |

## Separacion total respecto a otros proyectos

Este curso es un proyecto **completamente independiente**: cada pieza es propia
del bootcamp y no se comparte con ningun otro de tus proyectos.

| Pieza | Bootcamp AI Trainer | Otros proyectos (p.ej. apu-saas) |
|---|---|---|
| GitHub | `fvaleradeveloper/bootcamp-ai-trainer` | repos propios, nada compartido |
| Vercel | proyecto `bootcamp-ai-trainer` | proyectos propios, env vars aparte |
| Neon | **database `bootcamp`** + rol `bootcamp_app` | database `neondb` |

**Base de datos dedicada.** El curso usa su propia database `bootcamp` con un rol
propio `bootcamp_app`, limitado a esa database: no tiene acceso a las demas.
En `bootcamp` las tablas viven directamente en `public`:

| Tabla | Contenido |
|---|---|
| `users` | email + `password_hash` (bcrypt) de las cuentas del curso |
| `progress` | `done` / `open` (arrays de texto) por usuario |

Sigue la convencion de tu proyecto Neon: **una database por proyecto**.
`npm run db:init` aplica `scripts/schema.sql` a la database que indique
`DATABASE_URL` (por eso es clave que esa variable apunte a `bootcamp`).

## Despliegue (Vercel + Neon)

1. **Neon** (neon.tech): database **dedicada** para el curso + rol propio.
   Copia la connection string **pooled** (host con sufijo `-pooler`).
2. **GitHub**: sube este repo.
3. **Vercel**: New Project -> importa el repo. Framework Preset: **Other**.
   Variables de entorno (Production + Preview + Development):
   - `DATABASE_URL` = connection string pooled de la database del curso.
   - `SESSION_SECRET` = secreto largo aleatorio.
4. Crea las tablas (una sola vez) con la misma `DATABASE_URL`:
   `npm install` y `npm run db:init` (lee `.env.local` si existe).
5. Abre tu URL `*.vercel.app`, crea tu cuenta y entra desde tu celular con el mismo
   email: tu progreso (`done` + paneles abiertos) se fusiona por union, nunca se pierde.

### Estado verificado

- `npm test` -> `auth OK` + `routes OK` + `chat OK` (handlers probados con Neon mockeado).
- E2E contra produccion: registro, login desde otro dispositivo, GET/PUT de progreso,
  filtrado de ids invalidos, 401 sin sesion y 409 por duplicado.
- Aislamiento: el rol `bootcamp_app` tiene acceso unicamente a la database `bootcamp`.

## Layout y asistente IA

El frontend se organiza en **tres marcos**:

```
+--------------------------------------------------+
| header (progreso + botones globales)             |
+--------------------------------------------------+
| authbar (sesion / estado de sincronizacion)      |
+-----------+--------------------------------------+
|           |  MARCO 1: teoria + ejercicios        |
|  menu     |  (scroll propio)                     |
|  (aside)  +--------------------------------------+
|           |  <-- splitter arrastrable -->        |
|           +--------------------------------------+
|           |  MARCO 2: chat con la IA             |
+-----------+--------------------------------------+
```

El splitter se arrastra con el raton/touch; el chat se pliega con `▼` y se limpia con
`🗑`. El historial se guarda en `localStorage` (`bootcamp_ai_chat_v1`) y se reanuda
al recargar.

### Asistente IA (Groq, tier gratuito)

La IA vive en **`/api/chat`**, que hace de proxy en el servidor: la API key **nunca
llega al navegador** (regla que el propio curso enseña). El modelo por defecto es
`openai/gpt-oss-120b` con streaming SSE.

> Groq apagó `llama-3.3-70b-versatile` y `llama-3.1-8b-instant` el **16/08/2026** en
> los tiers gratuito y developer (ahora son enterprise). Los modelos vigentes en el
> tier gratuito son `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.6-27b`
> y `qwen/qwen3.8-27b` (ver <https://console.groq.com/docs/models>).

Para activarlo:

1. Crea la key en **[console.groq.com](https://console.groq.com)** (Create API Key).
2. En Vercel -> proyecto -> **Settings -> Environment Variables** añade `GROQ_API_KEY`
   (Production + Preview) y haz redeploy. Opcional: `GROQ_MODEL`, `CHAT_RATE_LIMIT`.
3. Mientras falte la clave, el chat responde con un aviso claro (503) en lugar de romperse.

Detalles de seguridad/robustez:

- Solo se aceptan roles `user`/`assistant`; los mensajes `system` del cliente se
  **rechazan** (bloquea la inyeccion de prompts).
- Rate limit por IP: 12 consultas/minuto (`CHAT_RATE_LIMIT`).
- Payload limitado: max 30 mensajes, 4000 caracteres cada uno, 24000 en total.
- Las respuestas de la IA pasan por `esc()` **antes** de llegar a `innerHTML`:
  no se reproduzca el XSS que el curso denuncia en el modulo 5.
- El system prompt instruye a la IA a **orientar antes que entregar la solucion**
  de un ejercicio, salvo que la pidas explicitamente.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completa DATABASE_URL y SESSION_SECRET
npm run db:init
vercel dev                    # http://localhost:3000
```

Sin `vercel dev` tambien puedes abrir `index.html` directo: funciona en modo local
(sin nube) para estudiar offline.

## Como estudiar

1. Lee la **teoria del modulo** (bloque `📚`) y sus objetivos.
2. Intenta el ejercicio 10-15 min con la plantilla de 5 pasos.
3. **Pista 1** (orientacion) -> **Pista 2 (guiada)** (que linea mirar, sin revelar el fix).
4. **Solucion**: compara punto por punto; si fallaste la causa raiz, reescribe de memoria mañana.
5. Marca **Completado** solo con resolucion real. Dificultad: `Facil` -> `Media` -> `Dificil`.
