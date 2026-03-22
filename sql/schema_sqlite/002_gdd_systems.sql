PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS player_wallets (
  player_id INTEGER PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
  credits REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bank_deposits (
  player_id INTEGER PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
  balance REAL NOT NULL DEFAULT 0,
  annual_rate REAL NOT NULL DEFAULT 0.02
);

CREATE TABLE IF NOT EXISTS bank_loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  principal REAL NOT NULL,
  apr REAL NOT NULL DEFAULT 0.05,
  accrued_interest REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS market_price_index (
  world_id INTEGER NOT NULL REFERENCES worlds (id),
  item_id INTEGER NOT NULL REFERENCES items (id),
  supply REAL NOT NULL DEFAULT 100,
  demand REAL NOT NULL DEFAULT 100,
  price REAL NOT NULL DEFAULT 1,
  PRIMARY KEY (world_id, item_id)
);

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  output_item_id INTEGER NOT NULL REFERENCES items (id),
  output_qty INTEGER NOT NULL DEFAULT 1,
  machine_type TEXT NOT NULL DEFAULT 'hand',
  time_sec INTEGER NOT NULL DEFAULT 60,
  precision_default REAL NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS recipe_inputs (
  recipe_id INTEGER NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items (id),
  qty INTEGER NOT NULL,
  PRIMARY KEY (recipe_id, item_id)
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  world_id INTEGER NOT NULL REFERENCES worlds (id),
  name TEXT NOT NULL,
  founder_player_id INTEGER NOT NULL REFERENCES players (id),
  treasury_credits REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS company_members (
  company_id INTEGER NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (company_id, player_id)
);

CREATE TABLE IF NOT EXISTS world_buildings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  world_id INTEGER NOT NULL REFERENCES worlds (id),
  owner_player_id INTEGER REFERENCES players (id),
  company_id INTEGER REFERENCES companies (id),
  type TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  condition REAL NOT NULL DEFAULT 1,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL,
  wear REAL NOT NULL DEFAULT 0,
  power_generated_kw REAL NOT NULL DEFAULT 0,
  power_consumed_kw REAL NOT NULL DEFAULT 0,
  logistics_connected INTEGER NOT NULL DEFAULT 0,
  data_connected INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_effects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  effect_code TEXT NOT NULL,
  potency REAL NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_effects_player ON player_effects (player_id);

CREATE TABLE IF NOT EXISTS player_discoveries (
  player_id INTEGER NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  discovery_code TEXT NOT NULL,
  PRIMARY KEY (player_id, discovery_code)
);

CREATE TABLE IF NOT EXISTS player_science_points (
  player_id INTEGER PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
  points REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  world_id INTEGER NOT NULL REFERENCES worlds (id),
  party_a_type TEXT NOT NULL,
  party_a_id INTEGER NOT NULL,
  party_b_type TEXT NOT NULL,
  party_b_id INTEGER NOT NULL,
  terms_json TEXT NOT NULL DEFAULT '{}',
  penalty_credits REAL NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS country_relations (
  country_id_a INTEGER NOT NULL REFERENCES countries (id),
  country_id_b INTEGER NOT NULL REFERENCES countries (id),
  relation REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (country_id_a, country_id_b),
  CHECK (country_id_a < country_id_b)
);

CREATE TABLE IF NOT EXISTS chunk_pollution (
  world_id INTEGER NOT NULL REFERENCES worlds (id),
  cx INTEGER NOT NULL,
  cy INTEGER NOT NULL,
  pollution REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (world_id, cx, cy)
);

CREATE TABLE IF NOT EXISTS player_crafting (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  recipe_id INTEGER NOT NULL REFERENCES recipes (id),
  progress_remain_sec REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crafting_player ON player_crafting (player_id);

CREATE TABLE IF NOT EXISTS market_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  world_id INTEGER NOT NULL REFERENCES worlds (id),
  seller_player_id INTEGER NOT NULL REFERENCES players (id),
  item_id INTEGER NOT NULL REFERENCES items (id),
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_orders_world ON market_orders (world_id);
