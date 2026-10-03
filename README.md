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
| `lib/db.mjs`, `lib/auth.mjs` | Cliente Neon, cookies, tokens firmados, bcrypt |
| `scripts/schema.sql`, `scripts/db-init.mjs` | Esquema y creacion de tablas (`npm run db:init`) |

## Despliegue (Vercel + Neon)

1. **Neon** (neon.tech): crea proyecto + database. Copia la connection string pooled.
2. **GitHub**: sube este repo.
3. **Vercel**: New Project -> importa el repo. Framework Preset: **Other**.
   Variables de entorno (Production + Preview):
   - `DATABASE_URL` = connection string pooled de Neon (`?sslmode=require`).
   - `SESSION_SECRET` = secreto largo aleatorio.
4. Deploy. Luego crea las tablas con la misma `DATABASE_URL`:
   `npm install` y `npm run db:init` (o corre `scripts/schema.sql` en el SQL Editor de Neon).
5. Abre tu URL `*.vercel.app`, crea tu cuenta y entra desde tu celular con el mismo
   email: tu progreso (`done` + paneles abiertos) se fusiona por union, nunca se pierde.

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
