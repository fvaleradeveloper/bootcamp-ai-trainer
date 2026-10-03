-- Esquema de Bootcamp AI Trainer (Neon / Postgres).
-- IMPORTANTE: vive en un schema dedicado `bootcamp` para NO colisionar
-- con las tablas de otras apps del mismo proyecto Neon (p.ej. public.users).
-- Idempotente: se puede ejecutar varias veces con `npm run db:init`.

CREATE SCHEMA IF NOT EXISTS bootcamp;

CREATE TABLE IF NOT EXISTS bootcamp.users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un estado por usuario: que ejercicios completo y que paneles dejo abiertos.
CREATE TABLE IF NOT EXISTS bootcamp.progress (
  user_id    INTEGER NOT NULL PRIMARY KEY,
  done       TEXT[]  NOT NULL DEFAULT '{}',
  open       TEXT[]  NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bootcamp_progress_user_fk FOREIGN KEY (user_id)
    REFERENCES bootcamp.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bootcamp_progress_updated
  ON bootcamp.progress (updated_at);
