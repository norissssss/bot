-- World Simulation module — базовая схема (PostgreSQL).
-- Для SQLite: заменить BIGSERIAL, JSONB, убрать IF NOT EXISTS по вкусу.

CREATE TABLE IF NOT EXISTS item_categories (
  id   SMALLSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id          SERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  category_id SMALLINT NOT NULL REFERENCES item_categories (id),
  tier        SMALLINT NOT NULL DEFAULT 1,
  weight      REAL NOT NULL DEFAULT 0,
  stack_max   INT NOT NULL DEFAULT 64,
  consumable  INTEGER NOT NULL DEFAULT 0,
  equip_slot  TEXT,
  tags        JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS worlds (
  id     BIGSERIAL PRIMARY KEY,
  seed   BIGINT NOT NULL,
  width  INT NOT NULL DEFAULT 30000,
  height INT NOT NULL DEFAULT 30000
);

CREATE TABLE IF NOT EXISTS players (
  id              BIGSERIAL PRIMARY KEY,
  external_ref    TEXT NOT NULL UNIQUE,
  world_id        BIGINT NOT NULL REFERENCES worlds (id),
  pos_x           DOUBLE PRECISION NOT NULL DEFAULT 0,
  pos_y           DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_vitals (
  player_id BIGINT PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
  health    REAL NOT NULL DEFAULT 100 CHECK (health >= 0 AND health <= 100),
  hunger    REAL NOT NULL DEFAULT 100 CHECK (hunger >= 0 AND hunger <= 100),
  energy    REAL NOT NULL DEFAULT 100 CHECK (energy >= 0 AND energy <= 100)
);

CREATE TABLE IF NOT EXISTS inventory_containers (
  id        BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  kind      TEXT NOT NULL,
  capacity_slots INT NOT NULL DEFAULT 36,
  UNIQUE (player_id, kind)
);

CREATE TABLE IF NOT EXISTS item_instances (
  id         BIGSERIAL PRIMARY KEY,
  item_id    INT NOT NULL REFERENCES items (id),
  quantity   INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  durability REAL,
  quality    REAL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS inventory_placements (
  id            BIGSERIAL PRIMARY KEY,
  container_id  BIGINT NOT NULL REFERENCES inventory_containers (id) ON DELETE CASCADE,
  slot_index    INT NOT NULL,
  instance_id   BIGINT NOT NULL REFERENCES item_instances (id) ON DELETE CASCADE,
  UNIQUE (container_id, slot_index)
);

CREATE TABLE IF NOT EXISTS countries (
  id        SERIAL PRIMARY KEY,
  world_id  BIGINT NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  capital_x DOUBLE PRECISION,
  capital_y DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS cities (
  id          SERIAL PRIMARY KEY,
  country_id  INT REFERENCES countries (id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  pos_x       DOUBLE PRECISION NOT NULL,
  pos_y       DOUBLE PRECISION NOT NULL,
  tier        SMALLINT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS map_chunks (
  id        BIGSERIAL PRIMARY KEY,
  world_id  BIGINT NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  cx        INT NOT NULL,
  cy        INT NOT NULL,
  biome_code TEXT NOT NULL DEFAULT 'unknown',
  meta      JSONB DEFAULT '{}'::jsonb,
  UNIQUE (world_id, cx, cy)
);

CREATE TABLE IF NOT EXISTS rivers (
  id       SERIAL PRIMARY KEY,
  world_id BIGINT NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  name     TEXT
);

CREATE TABLE IF NOT EXISTS river_segments (
  id       BIGSERIAL PRIMARY KEY,
  river_id INT NOT NULL REFERENCES rivers (id) ON DELETE CASCADE,
  seq      INT NOT NULL,
  x1 DOUBLE PRECISION NOT NULL,
  y1 DOUBLE PRECISION NOT NULL,
  x2 DOUBLE PRECISION NOT NULL,
  y2 DOUBLE PRECISION NOT NULL,
  width    REAL NOT NULL DEFAULT 1,
  UNIQUE (river_id, seq)
);

CREATE TABLE IF NOT EXISTS resource_nodes (
  id          BIGSERIAL PRIMARY KEY,
  world_id    BIGINT NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  item_id     INT NOT NULL REFERENCES items (id),
  pos_x       DOUBLE PRECISION NOT NULL,
  pos_y       DOUBLE PRECISION NOT NULL,
  volume      REAL NOT NULL,
  purity      REAL NOT NULL DEFAULT 1,
  chunk_cx    INT,
  chunk_cy    INT
);

CREATE INDEX IF NOT EXISTS idx_resource_nodes_world ON resource_nodes (world_id);
CREATE INDEX IF NOT EXISTS idx_players_world ON players (world_id);
CREATE INDEX IF NOT EXISTS idx_map_chunks_world ON map_chunks (world_id);
