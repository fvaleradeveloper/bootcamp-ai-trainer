-- Esquema de Bootcamp AI Trainer (Neon / Postgres).
-- Idempotente: se puede ejecutar varias veces con `npm run db:init`.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un estado por usuario: que ejercicios completo y que paneles dejo abiertos.
CREATE TABLE IF NOT EXISTS progress (
  user_id    INTEGER NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  done       TEXT[]  NOT NULL DEFAULT '{}',
  open       TEXT[]  NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progress_updated ON progress (updated_at);
