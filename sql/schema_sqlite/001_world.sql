PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS item_categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES item_categories (id),
  tier        INTEGER NOT NULL DEFAULT 1,
  weight      REAL NOT NULL DEFAULT 0,
  stack_max   INTEGER NOT NULL DEFAULT 64,
  consumable  INTEGER NOT NULL DEFAULT 0,
  equip_slot  TEXT,
  tags        TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS worlds (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  seed   INTEGER NOT NULL,
  width  INTEGER NOT NULL DEFAULT 30000,
  height INTEGER NOT NULL DEFAULT 30000
);

CREATE TABLE IF NOT EXISTS players (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  external_ref TEXT NOT NULL UNIQUE,
  world_id     INTEGER NOT NULL REFERENCES worlds (id),
  pos_x        REAL NOT NULL DEFAULT 0,
  pos_y        REAL NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS player_vitals (
  player_id INTEGER PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
  health    REAL NOT NULL DEFAULT 100,
  hunger    REAL NOT NULL DEFAULT 100,
  energy    REAL NOT NULL DEFAULT 100,
  CHECK (health BETWEEN 0 AND 100 AND hunger BETWEEN 0 AND 100 AND energy BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS inventory_containers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id      INTEGER NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  kind           TEXT NOT NULL,
  capacity_slots INTEGER NOT NULL DEFAULT 36,
  UNIQUE (player_id, kind)
);

CREATE TABLE IF NOT EXISTS item_instances (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    INTEGER NOT NULL REFERENCES items (id),
  quantity   INTEGER NOT NULL DEFAULT 1,
  durability REAL,
  quality    REAL DEFAULT 1,
  CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS inventory_placements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  container_id INTEGER NOT NULL REFERENCES inventory_containers (id) ON DELETE CASCADE,
  slot_index   INTEGER NOT NULL,
  instance_id  INTEGER NOT NULL REFERENCES item_instances (id) ON DELETE CASCADE,
  UNIQUE (container_id, slot_index)
);

CREATE TABLE IF NOT EXISTS countries (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  world_id  INTEGER NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  capital_x REAL,
  capital_y REAL
);

CREATE TABLE IF NOT EXISTS cities (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  country_id INTEGER REFERENCES countries (id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  pos_x      REAL NOT NULL,
  pos_y      REAL NOT NULL,
  tier       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS map_chunks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  world_id   INTEGER NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  cx         INTEGER NOT NULL,
  cy         INTEGER NOT NULL,
  biome_code TEXT NOT NULL DEFAULT 'unknown',
  meta       TEXT DEFAULT '{}',
  UNIQUE (world_id, cx, cy)
);

CREATE TABLE IF NOT EXISTS rivers (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  world_id INTEGER NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  name     TEXT
);

CREATE TABLE IF NOT EXISTS river_segments (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  river_id INTEGER NOT NULL REFERENCES rivers (id) ON DELETE CASCADE,
  seq      INTEGER NOT NULL,
  x1       REAL NOT NULL,
  y1       REAL NOT NULL,
  x2       REAL NOT NULL,
  y2       REAL NOT NULL,
  width    REAL NOT NULL DEFAULT 1,
  UNIQUE (river_id, seq)
);

CREATE TABLE IF NOT EXISTS resource_nodes (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  world_id INTEGER NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  item_id  INTEGER NOT NULL REFERENCES items (id),
  pos_x    REAL NOT NULL,
  pos_y    REAL NOT NULL,
  volume   REAL NOT NULL,
  purity   REAL NOT NULL DEFAULT 1,
  chunk_cx INTEGER,
  chunk_cy INTEGER
);

CREATE INDEX IF NOT EXISTS idx_resource_nodes_world ON resource_nodes (world_id);
CREATE INDEX IF NOT EXISTS idx_players_world ON players (world_id);
CREATE INDEX IF NOT EXISTS idx_map_chunks_world ON map_chunks (world_id);
