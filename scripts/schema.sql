-- Esquema de Bootcamp AI Trainer.
--
-- BASE DEDICADA: database `bootcamp` con rol propio `bootcamp_app`.
-- Este archivo NO se aplica nunca a `neondb` (la base de apu-saas), por
-- lo que las tablas viven directamente en `public`.
-- Idempotente: se puede ejecutar varias veces con `npm run db:init`.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un estado por usuario: que ejercicios completo y que paneles dejo abiertos.
CREATE TABLE IF NOT EXISTS progress (
  user_id    INTEGER NOT NULL PRIMARY KEY,
  done       TEXT[]  NOT NULL DEFAULT '{}',
  open       TEXT[]  NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT progress_user_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_progress_updated ON progress (updated_at);

-- Respuestas que el alumno escribe en cada ejercicio (texto libre, hasta 12000
-- chars) y la ultima correccion que le devolvio la IA. Una fila por usuario y
-- ejercicio. Sirve para que la respuesta viaje entre celular y PC igual que el
-- progreso. Es aditiva: si esta tabla no existe, el frontend sigue funcionando
-- solo con localStorage (ver api/answers.js).
CREATE TABLE IF NOT EXISTS answers (
  user_id    INTEGER NOT NULL,
  ex_id      TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '',
  review     TEXT    NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ex_id),
  CONSTRAINT answers_user_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT answers_ex_ck CHECK (ex_id ~ '^[1-6]\.[0-9]$')
);

CREATE INDEX IF NOT EXISTS idx_answers_updated ON answers (updated_at);
