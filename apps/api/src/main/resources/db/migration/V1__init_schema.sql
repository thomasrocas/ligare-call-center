CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  google_sub TEXT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  team TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  team TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS priorities (
  id BIGSERIAL PRIMARY KEY,
  team TEXT NOT NULL,
  name TEXT NOT NULL,
  sla_minutes INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calls (
  id BIGSERIAL PRIMARY KEY,
  team TEXT NOT NULL,
  status TEXT NOT NULL,
  category_id BIGINT REFERENCES categories(id),
  priority BIGINT REFERENCES priorities(id),
  assigned_to BIGINT REFERENCES users(id),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  aht_seconds INTEGER,
  caller_name TEXT,
  callback_number TEXT,
  patient_name TEXT,
  patient_dob DATE,
  reason TEXT,
  disposition_text TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_events (
  id BIGSERIAL PRIMARY KEY,
  call_id BIGINT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS kpi_daily_rollup (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  team TEXT NOT NULL,
  metrics_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date, team)
);
