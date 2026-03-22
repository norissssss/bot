const fs = require("fs");
const path = require("path");
const { seedRecipesIfEmpty } = require("./seedRecipes");

function loadSqlite() {
  try {
    return require("node:sqlite").DatabaseSync;
  } catch {
    throw new Error(
      "Модуль мира: нужен Node.js 22+ (встроенный node:sqlite). См. promt.txt и core/world/gdd.js"
    );
  }
}

function runSqlFile(db, filePath) {
  db.exec(fs.readFileSync(filePath, "utf8"));
}

function migrateColumn(db, table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some(c => c.name === column)) return;
  db.exec(ddl);
}

function ensureDefaultCountry(db) {
  const w = db.prepare("SELECT id FROM worlds ORDER BY id LIMIT 1").get();
  if (!w) return;
  const n = db.prepare("SELECT COUNT(*) AS c FROM countries WHERE world_id = ?").get(w.id).c;
  if (n > 0) return;
  db.prepare("INSERT INTO countries (world_id, name, capital_x, capital_y) VALUES (?, ?, ?, ?)").run(
    w.id,
    "Антария",
    15000,
    15000
  );
}

function assignPlayersToDefaultCountry(db) {
  const w = db.prepare("SELECT id FROM worlds ORDER BY id LIMIT 1").get();
  if (!w) return;
  const c = db.prepare("SELECT id FROM countries WHERE world_id = ? ORDER BY id LIMIT 1").get(w.id);
  if (!c) return;
  try {
    db.prepare("UPDATE players SET country_id = ? WHERE country_id IS NULL").run(c.id);
  } catch {
    /* колонка country_id может отсутствовать в очень старых БД */
  }
}

function ensureDefaultCities(db) {
  const country = db.prepare("SELECT id, capital_x, capital_y FROM countries ORDER BY id LIMIT 1").get();
  if (!country) return;
  const count = db.prepare("SELECT COUNT(*) AS c FROM cities WHERE country_id = ?").get(country.id).c;
  if (count > 0) return;

  const baseX = country.capital_x ?? 15000;
  const baseY = country.capital_y ?? 15000;
  const insert = db.prepare(
    "INSERT INTO cities (country_id, name, pos_x, pos_y, tier) VALUES (?, ?, ?, ?, ?)"
  );

  const cities = [
    ["Астерион", baseX, baseY, 3],
    ["Бриз", baseX + 1200, baseY - 850, 2],
    ["Кварц", baseX - 1450, baseY + 920, 2],
    ["Нова", baseX + 1950, baseY + 1480, 1]
  ];

  for (const [name, x, y, tier] of cities) {
    insert.run(country.id, name, x, y, tier);
  }
}

function seedFoodMedicineIfNeeded(db) {
  const row = db.prepare("SELECT id FROM items WHERE code = ?").get("food_ration_q1");
  if (row) return;
  const p = path.join(__dirname, "../../sql/seeds/002_gdd_food_medicine.sql");
  if (fs.existsSync(p)) runSqlFile(db, p);
}

function seedMarketIndexIfNeeded(db) {
  const wid = db.prepare("SELECT id FROM worlds ORDER BY id LIMIT 1").get()?.id;
  if (!wid) return;
  const codes = ["steel_bar_t1", "boards_t1", "raw_iron_ore_g1", "food_ration_q1", "plastic_sheet_t1"];
  const ins = db.prepare(
    `INSERT OR IGNORE INTO market_price_index (world_id, item_id, supply, demand, price)
     VALUES (?, ?, 100, 100, ?)`
  );
  for (const code of codes) {
    const item = db.prepare("SELECT id FROM items WHERE code = ?").get(code);
    if (!item) continue;
    ins.run(wid, item.id, code.startsWith("raw_") ? 5 : code.includes("food") ? 8 : 12);
  }
}

function openDatabase(dbPath) {
  const DatabaseSync = loadSqlite();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");

  const schemaPath = path.join(__dirname, "../../sql/schema_sqlite/001_world.sql");
  runSqlFile(db, schemaPath);

  const schema2 = path.join(__dirname, "../../sql/schema_sqlite/002_gdd_systems.sql");
  if (fs.existsSync(schema2)) runSqlFile(db, schema2);

  migrateColumn(
    db,
    "player_vitals",
    "temperature",
    "ALTER TABLE player_vitals ADD COLUMN temperature REAL NOT NULL DEFAULT 50"
  );
  migrateColumn(
    db,
    "player_vitals",
    "reputation",
    "ALTER TABLE player_vitals ADD COLUMN reputation REAL NOT NULL DEFAULT 0"
  );
  migrateColumn(
    db,
    "players",
    "country_id",
    "ALTER TABLE players ADD COLUMN country_id INTEGER REFERENCES countries (id)"
  );

  const row = db.prepare("SELECT id FROM worlds ORDER BY id LIMIT 1").get();
  if (!row) {
    db.prepare("INSERT INTO worlds (seed, width, height) VALUES (?, ?, ?)").run(424242, 30000, 30000);
  }

  const itemCount = db.prepare("SELECT COUNT(*) AS c FROM items").get().c;
  if (itemCount === 0) {
    const seedPath = path.join(__dirname, "../../sql/seeds/001_items.sql");
    runSqlFile(db, seedPath);
  }

  seedFoodMedicineIfNeeded(db);
  seedRecipesIfEmpty(db);
  ensureDefaultCountry(db);
  assignPlayersToDefaultCountry(db);
  ensureDefaultCities(db);
  seedMarketIndexIfNeeded(db);

  return db;
}

module.exports = { openDatabase };
