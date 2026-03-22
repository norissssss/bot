const gdd = require("./gdd");
const simulation = require("./simulation");

function withTransaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    fn();
    db.exec("COMMIT");
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}

const CONTAINER_KINDS = {
  body: { slots: 24 },
  backpack: { slots: 36 },
  phone: { slots: 1 }
};

const CHUNK_SIZE = 256;
const EFFECT_DAMAGE = {
  infection: { health: 0.12 },
  poisoning: { energy: 0.18 },
  radiation: { health: 0.06 }
};

function parseTags(raw) {
  if (!raw || raw === "{}") return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

class WorldService {
  constructor(db) {
    this.db = db;
  }

  get worldId() {
    const r = this.db.prepare("SELECT id FROM worlds ORDER BY id LIMIT 1").get();
    return r.id;
  }

  getWorldMeta() {
    return this.db.prepare("SELECT id, width, height, seed FROM worlds ORDER BY id LIMIT 1").get();
  }

  listCountriesWithCities() {
    const world = this.getWorldMeta();
    if (!world) return [];

    const countries = this.db
      .prepare(
        `SELECT id, name, capital_x, capital_y
         FROM countries
         WHERE world_id = ?
         ORDER BY id`
      )
      .all(world.id)
      .map(country => ({ ...country, cities: [] }));

    const cities = this.db
      .prepare(
        `SELECT id, country_id, name, pos_x, pos_y, tier
         FROM cities
         WHERE country_id IN (SELECT id FROM countries WHERE world_id = ?)
         ORDER BY tier DESC, name`
      )
      .all(world.id);

    const byCountry = new Map(countries.map(country => [country.id, country]));
    for (const city of cities) {
      const country = byCountry.get(city.country_id);
      if (country) {
        country.cities.push(city);
      }
    }

    return countries;
  }

  getWorldMapData() {
    const world = this.getWorldMeta();
    return {
      ...(world ?? { width: 1, height: 1, seed: 0 }),
      countries: this.listCountriesWithCities()
    };
  }

  _defaultCountryId() {
    const row = this.db
      .prepare("SELECT id FROM countries WHERE world_id = ? ORDER BY id LIMIT 1")
      .get(this.worldId);
    return row ? row.id : null;
  }

  getOrCreatePlayerDiscord(discordUserId) {
    const ref = `discord:${discordUserId}`;
    let p = this.db.prepare("SELECT * FROM players WHERE external_ref = ?").get(ref);
    if (p) {
      this._ensurePlayerEconomy(p.id);
      return p;
    }

    const wid = this.worldId;
    const cid = this._defaultCountryId();
    const info = this.db
      .prepare(
        "INSERT INTO players (external_ref, world_id, pos_x, pos_y, country_id) VALUES (?, ?, ?, ?, ?)"
      )
      .run(ref, wid, 15000, 15000, cid);

    const playerId = info.lastInsertRowid;
    this.db.prepare("INSERT INTO player_vitals (player_id) VALUES (?)").run(playerId);

    for (const [kind, { slots }] of Object.entries(CONTAINER_KINDS)) {
      this.db
        .prepare(
          "INSERT INTO inventory_containers (player_id, kind, capacity_slots) VALUES (?, ?, ?)"
        )
        .run(playerId, kind, slots);
    }

    this._ensurePlayerEconomy(playerId);
    this._giveStarterFood(playerId);

    return this.db.prepare("SELECT * FROM players WHERE id = ?").get(playerId);
  }

  _ensurePlayerEconomy(playerId) {
    const w = this.db.prepare("SELECT 1 FROM player_wallets WHERE player_id = ?").get(playerId);
    if (w) return;
    this.db.prepare("INSERT INTO player_wallets (player_id, credits) VALUES (?, 1000)").run(playerId);
    this.db
      .prepare("INSERT INTO bank_deposits (player_id, balance, annual_rate) VALUES (?, 0, 0.02)")
      .run(playerId);
    this.db.prepare("INSERT INTO player_science_points (player_id, points) VALUES (?, 0)").run(playerId);
  }

  _giveStarterFood(playerId) {
    const item = this.db.prepare("SELECT id FROM items WHERE code = ?").get("food_ration_q1");
    if (!item) return;

    const backpack = this.db
      .prepare(
        "SELECT id FROM inventory_containers WHERE player_id = ? AND kind = 'backpack'"
      )
      .get(playerId);

    for (let slot = 0; slot < 3; slot++) {
      const inst = this.db
        .prepare("INSERT INTO item_instances (item_id, quantity) VALUES (?, ?)")
        .run(item.id, 1);
      this.db
        .prepare(
          "INSERT INTO inventory_placements (container_id, slot_index, instance_id) VALUES (?, ?, ?)"
        )
        .run(backpack.id, slot, inst.lastInsertRowid);
    }
  }

  _chunkCoords(posX, posY) {
    return { cx: Math.floor(posX / CHUNK_SIZE), cy: Math.floor(posY / CHUNK_SIZE) };
  }

  getPollutionAtPlayer(playerId) {
    const pl = this.db.prepare("SELECT pos_x, pos_y, world_id FROM players WHERE id = ?").get(playerId);
    if (!pl) return 0;
    const { cx, cy } = this._chunkCoords(pl.pos_x, pl.pos_y);
    const row = this.db
      .prepare(
        "SELECT pollution FROM chunk_pollution WHERE world_id = ? AND cx = ? AND cy = ?"
      )
      .get(pl.world_id, cx, cy);
    return row ? gdd.clamp(row.pollution, 0, 1) : 0;
  }

  getDiseasePenalty(playerId) {
    const now = Math.floor(Date.now() / 1000);
    const rows = this.db
      .prepare(
        "SELECT effect_code, potency FROM player_effects WHERE player_id = ? AND expires_at > ?"
      )
      .all(playerId, now);
    let p = 0;
    for (const r of rows) {
      if (r.effect_code === "infection" || r.effect_code === "poisoning" || r.effect_code === "radiation") {
        p += 0.08 * (r.potency || 1);
      }
    }
    return gdd.clamp(p, 0, 0.6);
  }

  getVitals(playerId) {
    return this.db.prepare("SELECT * FROM player_vitals WHERE player_id = ?").get(playerId);
  }

  getBackpackLines(playerId, limit = 12) {
    const backpack = this.db
      .prepare(
        "SELECT id FROM inventory_containers WHERE player_id = ? AND kind = 'backpack'"
      )
      .get(playerId);
    if (!backpack) return [];

    return this.db
      .prepare(
        `SELECT p.slot_index, i.name, inst.quantity
         FROM inventory_placements p
         JOIN item_instances inst ON inst.id = p.instance_id
         JOIN items i ON i.id = inst.item_id
         WHERE p.container_id = ?
         ORDER BY p.slot_index
         LIMIT ?`
      )
      .all(backpack.id, limit);
  }

  getWallet(playerId) {
    this._ensurePlayerEconomy(playerId);
    return this.db.prepare("SELECT credits FROM player_wallets WHERE player_id = ?").get(playerId);
  }

  getBank(playerId) {
    this._ensurePlayerEconomy(playerId);
    return this.db.prepare("SELECT balance, annual_rate FROM bank_deposits WHERE player_id = ?").get(playerId);
  }

  getLoans(playerId) {
    return this.db
      .prepare("SELECT id, principal, apr, accrued_interest FROM bank_loans WHERE player_id = ?")
      .all(playerId);
  }

  getMarketPrice(itemCode) {
    const wid = this.worldId;
    const item = this.db.prepare("SELECT id FROM items WHERE code = ?").get(itemCode);
    if (!item) return null;
    const row = this.db
      .prepare(
        "SELECT supply, demand, price FROM market_price_index WHERE world_id = ? AND item_id = ?"
      )
      .get(wid, item.id);
    if (!row) return null;
    return { ...row, code: itemCode };
  }

  listRecipes() {
    return this.db
      .prepare(
        `SELECT r.code, r.machine_type, r.time_sec, i.code AS output_code, r.output_qty
         FROM recipes r JOIN items i ON i.id = r.output_item_id
         ORDER BY r.code`
      )
      .all();
  }

  getCrafting(playerId) {
    return this.db
      .prepare(
        `SELECT c.id, c.progress_remain_sec, r.code AS recipe_code
         FROM player_crafting c JOIN recipes r ON r.id = c.recipe_id WHERE c.player_id = ?`
      )
      .get(playerId);
  }

  _backpackContainer(playerId) {
    return this.db
      .prepare(
        "SELECT id, capacity_slots FROM inventory_containers WHERE player_id = ? AND kind = 'backpack'"
      )
      .get(playerId);
  }

  _findFreeSlot(containerId, capacity) {
    const used = new Set(
      this.db
        .prepare("SELECT slot_index FROM inventory_placements WHERE container_id = ?")
        .all(containerId)
        .map(r => r.slot_index)
    );
    for (let i = 0; i < capacity; i++) {
      if (!used.has(i)) return i;
    }
    return -1;
  }

  _countItemInBackpack(playerId, itemId) {
    const backpack = this._backpackContainer(playerId);
    if (!backpack) return 0;
    const rows = this.db
      .prepare(
        `SELECT inst.quantity FROM inventory_placements p
         JOIN item_instances inst ON inst.id = p.instance_id
         WHERE p.container_id = ? AND inst.item_id = ?`
      )
      .all(backpack.id, itemId);
    return rows.reduce((s, r) => s + r.quantity, 0);
  }

  _removeItemsFromBackpack(playerId, itemId, qty) {
    const backpack = this._backpackContainer(playerId);
    if (!backpack) return false;
    let need = qty;
    const placements = this.db
      .prepare(
        `SELECT p.instance_id, inst.quantity FROM inventory_placements p
         JOIN item_instances inst ON inst.id = p.instance_id
         WHERE p.container_id = ? AND inst.item_id = ?
         ORDER BY p.slot_index`
      )
      .all(backpack.id, itemId);

    for (const pl of placements) {
      if (need <= 0) break;
      const take = Math.min(need, pl.quantity);
      if (pl.quantity <= take) {
        this.db.prepare("DELETE FROM inventory_placements WHERE instance_id = ?").run(pl.instance_id);
        this.db.prepare("DELETE FROM item_instances WHERE id = ?").run(pl.instance_id);
      } else {
        this.db
          .prepare("UPDATE item_instances SET quantity = quantity - ? WHERE id = ?")
          .run(take, pl.instance_id);
      }
      need -= take;
    }
    return need <= 0;
  }

  _addItemToBackpack(playerId, itemId, qty, quality = 1) {
    const backpack = this._backpackContainer(playerId);
    if (!backpack) return { ok: false, reason: "no_backpack" };
    const slot = this._findFreeSlot(backpack.id, backpack.capacity_slots);
    if (slot < 0) return { ok: false, reason: "full" };
    const inst = this.db
      .prepare("INSERT INTO item_instances (item_id, quantity, quality) VALUES (?, ?, ?)")
      .run(itemId, qty, quality);
    this.db
      .prepare(
        "INSERT INTO inventory_placements (container_id, slot_index, instance_id) VALUES (?, ?, ?)"
      )
      .run(backpack.id, slot, inst.lastInsertRowid);
    return { ok: true };
  }

  startCraft(playerId, recipeCode) {
    this._ensurePlayerEconomy(playerId);
    const active = this.db.prepare("SELECT id FROM player_crafting WHERE player_id = ?").get(playerId);
    if (active) return { ok: false, reason: "busy" };

    const recipe = this.db.prepare("SELECT * FROM recipes WHERE code = ?").get(recipeCode);
    if (!recipe) return { ok: false, reason: "unknown_recipe" };

    const inputs = this.db
      .prepare(
        "SELECT item_id, qty FROM recipe_inputs WHERE recipe_id = ?"
      )
      .all(recipe.id);

    for (const inp of inputs) {
      if (this._countItemInBackpack(playerId, inp.item_id) < inp.qty) {
        return { ok: false, reason: "missing_inputs" };
      }
    }

    const eff = this.getEfficiency(playerId);
    const timeSec = Math.max(1, recipe.time_sec / Math.max(0.2, eff));

    withTransaction(this.db, () => {
      for (const inp of inputs) {
        this._removeItemsFromBackpack(playerId, inp.item_id, inp.qty);
      }
      this.db
        .prepare(
          "INSERT INTO player_crafting (player_id, recipe_id, progress_remain_sec, created_at) VALUES (?, ?, ?, ?)"
        )
        .run(playerId, recipe.id, timeSec, Math.floor(Date.now() / 1000));
    });

    return { ok: true, time_sec: timeSec };
  }

  _completeCraftRow(playerId, recipeId) {
    const recipe = this.db.prepare("SELECT * FROM recipes WHERE id = ?").get(recipeId);
    if (!recipe) return;
    const outItem = recipe.output_item_id;
    const matQ = 0.85;
    const q = gdd.quality(matQ, 1, recipe.precision_default);
    this._addItemToBackpack(playerId, outItem, recipe.output_qty, q);
  }

  eatOneFoodFromBackpack(playerId) {
    const backpack = this._backpackContainer(playerId);
    if (!backpack) return { ok: false, reason: "no_backpack" };

    const row = this.db
      .prepare(
        `SELECT p.instance_id, inst.quantity, it.code, it.tags
         FROM inventory_placements p
         JOIN item_instances inst ON inst.id = p.instance_id
         JOIN items it ON it.id = inst.item_id
         WHERE p.container_id = ? AND it.consumable = 1 AND it.code LIKE 'food_%'
         ORDER BY p.slot_index
         LIMIT 1`
      )
      .get(backpack.id);

    if (!row) return { ok: false, reason: "no_food" };

    const tags = parseTags(row.tags);
    const foodQ = typeof tags.food_quality === "number" ? tags.food_quality : 0.75;
    const energyBonus = typeof tags.energy_bonus === "number" ? tags.energy_bonus : 0;

    withTransaction(this.db, () => {
      if (row.quantity <= 1) {
        this.db.prepare("DELETE FROM inventory_placements WHERE instance_id = ?").run(row.instance_id);
        this.db.prepare("DELETE FROM item_instances WHERE id = ?").run(row.instance_id);
      } else {
        this.db
          .prepare("UPDATE item_instances SET quantity = quantity - 1 WHERE id = ?")
          .run(row.instance_id);
      }

      const v = this.db.prepare("SELECT hunger, energy FROM player_vitals WHERE player_id = ?").get(playerId);
      const hunger = Math.min(100, v.hunger + gdd.FOOD_RESTORE_HUNGER);
      const energy = Math.min(100, v.energy + gdd.FOOD_RESTORE_ENERGY + energyBonus);
      this.db
        .prepare("UPDATE player_vitals SET hunger = ?, energy = ? WHERE player_id = ?")
        .run(hunger, energy, playerId);

      const chance = gdd.diseaseChanceFromFoodQuality(foodQ);
      if (Math.random() < chance * 0.15) {
        const now = Math.floor(Date.now() / 1000);
        this.db
          .prepare(
            "INSERT INTO player_effects (player_id, effect_code, potency, expires_at) VALUES (?, ?, ?, ?)"
          )
          .run(playerId, "infection", 1, now + 3600);
      }
    });

    return { ok: true, ate: row.code };
  }

  useMedKit(playerId) {
    const backpack = this._backpackContainer(playerId);
    if (!backpack) return { ok: false, reason: "no_backpack" };

    const row = this.db
      .prepare(
        `SELECT p.instance_id, inst.quantity, it.code, it.tags
         FROM inventory_placements p
         JOIN item_instances inst ON inst.id = p.instance_id
         JOIN items it ON it.id = inst.item_id
         WHERE p.container_id = ? AND it.code IN ('med_kit_basic', 'med_drug_std', 'med_vaccine')
         ORDER BY p.slot_index LIMIT 1`
      )
      .get(backpack.id);

    if (!row) return { ok: false, reason: "no_med" };

    const tags = parseTags(row.tags);
    const heal = typeof tags.heal === "number" ? tags.heal : 10;

    withTransaction(this.db, () => {
      if (row.quantity <= 1) {
        this.db.prepare("DELETE FROM inventory_placements WHERE instance_id = ?").run(row.instance_id);
        this.db.prepare("DELETE FROM item_instances WHERE id = ?").run(row.instance_id);
      } else {
        this.db
          .prepare("UPDATE item_instances SET quantity = quantity - 1 WHERE id = ?")
          .run(row.instance_id);
      }

      const v = this.db.prepare("SELECT health FROM player_vitals WHERE player_id = ?").get(playerId);
      const health = Math.min(100, v.health + heal);
      this.db.prepare("UPDATE player_vitals SET health = ? WHERE player_id = ?").run(health, playerId);

      if (row.code === "med_drug_std" || row.code === "med_vaccine") {
        this.db.prepare("DELETE FROM player_effects WHERE player_id = ? AND effect_code = 'infection'").run(
          playerId
        );
      }
    });

    return { ok: true, used: row.code };
  }

  bankDeposit(playerId, amount) {
    if (amount <= 0) return { ok: false, reason: "bad_amount" };
    this._ensurePlayerEconomy(playerId);
    try {
      withTransaction(this.db, () => {
        const w = this.db.prepare("SELECT credits FROM player_wallets WHERE player_id = ?").get(playerId);
        if (w.credits < amount) throw new Error("funds");
        this.db
          .prepare("UPDATE player_wallets SET credits = credits - ? WHERE player_id = ?")
          .run(amount, playerId);
        this.db
          .prepare("UPDATE bank_deposits SET balance = balance + ? WHERE player_id = ?")
          .run(amount, playerId);
      });
    } catch {
      return { ok: false, reason: "funds" };
    }
    return { ok: true };
  }

  bankWithdraw(playerId, amount) {
    if (amount <= 0) return { ok: false, reason: "bad_amount" };
    this._ensurePlayerEconomy(playerId);
    const b = this.db.prepare("SELECT balance FROM bank_deposits WHERE player_id = ?").get(playerId);
    if (!b || b.balance < amount) return { ok: false, reason: "funds" };
    withTransaction(this.db, () => {
      this.db
        .prepare("UPDATE bank_deposits SET balance = balance - ? WHERE player_id = ?")
        .run(amount, playerId);
      this.db
        .prepare("UPDATE player_wallets SET credits = credits + ? WHERE player_id = ?")
        .run(amount, playerId);
    });
    return { ok: true };
  }

  takeLoan(playerId, principal) {
    if (principal <= 0 || principal > 50000) return { ok: false, reason: "bad_amount" };
    this._ensurePlayerEconomy(playerId);
    const existing = this.db
      .prepare("SELECT COALESCE(SUM(principal), 0) AS s FROM bank_loans WHERE player_id = ?")
      .get(playerId);
    if ((existing.s ?? 0) + principal > 100000) return { ok: false, reason: "limit" };
    withTransaction(this.db, () => {
      this.db
        .prepare(
          "INSERT INTO bank_loans (player_id, principal, apr, accrued_interest) VALUES (?, ?, 0.05, 0)"
        )
        .run(playerId, principal);
      this.db
        .prepare("UPDATE player_wallets SET credits = credits + ? WHERE player_id = ?")
        .run(principal, playerId);
    });
    return { ok: true };
  }

  repayLoan(playerId, loanId) {
    const loan = this.db
      .prepare("SELECT * FROM bank_loans WHERE id = ? AND player_id = ?")
      .get(loanId, playerId);
    if (!loan) return { ok: false, reason: "no_loan" };
    const total = loan.principal + loan.accrued_interest;
    this._ensurePlayerEconomy(playerId);
    const w = this.db.prepare("SELECT credits FROM player_wallets WHERE player_id = ?").get(playerId);
    if (w.credits < total) return { ok: false, reason: "funds" };
    withTransaction(this.db, () => {
      this.db
        .prepare("UPDATE player_wallets SET credits = credits - ? WHERE player_id = ?")
        .run(total, playerId);
      this.db.prepare("DELETE FROM bank_loans WHERE id = ?").run(loanId);
    });
    return { ok: true, paid: total };
  }

  marketBuy(playerId, itemCode, qty) {
    if (qty < 1 || qty > 999) return { ok: false, reason: "bad_qty" };
    const item = this.db.prepare("SELECT id FROM items WHERE code = ?").get(itemCode);
    if (!item) return { ok: false, reason: "no_item" };
    const row = this.db
      .prepare(
        "SELECT price FROM market_price_index WHERE world_id = ? AND item_id = ?"
      )
      .get(this.worldId, item.id);
    if (!row) return { ok: false, reason: "no_market" };
    const cost = row.price * qty;
    this._ensurePlayerEconomy(playerId);
    const w = this.db.prepare("SELECT credits FROM player_wallets WHERE player_id = ?").get(playerId);
    if (w.credits < cost) return { ok: false, reason: "funds" };

    try {
      withTransaction(this.db, () => {
        this.db
          .prepare("UPDATE player_wallets SET credits = credits - ? WHERE player_id = ?")
          .run(cost, playerId);
        this.db
          .prepare(
            "UPDATE market_price_index SET demand = demand + ?, supply = supply - ? WHERE world_id = ? AND item_id = ?"
          )
          .run(qty * 0.5, qty * 0.3, this.worldId, item.id);
        const placed = this._addItemToBackpack(playerId, item.id, qty, 1);
        if (!placed.ok) throw new Error(placed.reason);
      });
    } catch {
      return { ok: false, reason: "fail" };
    }
    return { ok: true, cost };
  }

  scienceExperiment(playerId) {
    this._ensurePlayerEconomy(playerId);
    const row = this.db.prepare("SELECT points FROM player_science_points WHERE player_id = ?").get(playerId);
    const pts0 = row?.points ?? 0;
    const exp = 0.5 + Math.random() * 0.5;
    const cond = 0.4 + Math.random() * 0.4;
    const know = 0.3 + pts0 / 1000;
    const gain = gdd.discovery(exp, cond, know);
    const newPoints = pts0 + gain;
    this.db
      .prepare("UPDATE player_science_points SET points = ? WHERE player_id = ?")
      .run(newPoints, playerId);
    const disc = `disc_${Math.floor(newPoints / 10)}`;
    this.db
      .prepare("INSERT OR IGNORE INTO player_discoveries (player_id, discovery_code) VALUES (?, ?)")
      .run(playerId, disc);
    return { ok: true, gain, points: newPoints, discovery: disc };
  }

  getPolitics(playerId) {
    const p = this.db
      .prepare(
        `SELECT pl.country_id, v.reputation FROM players pl
         JOIN player_vitals v ON v.player_id = pl.id WHERE pl.id = ?`
      )
      .get(playerId);
    if (!p) return null;
    const c = p.country_id
      ? this.db.prepare("SELECT name FROM countries WHERE id = ?").get(p.country_id)
      : null;
    const economy = 40 + (p.reputation || 0) * 0.2;
    const trust = gdd.politicalTrust(economy, 5, 10);
    return { country: c?.name ?? "—", reputation: p.reputation ?? 0, trust };
  }

  getInternationalSnapshot() {
    return this.db
      .prepare(
        "SELECT c1.name AS a, c2.name AS b, r.relation FROM country_relations r JOIN countries c1 ON c1.id = r.country_id_a JOIN countries c2 ON c2.id = r.country_id_b LIMIT 8"
      )
      .all();
  }

  createContract(playerId, otherPlayerId, penaltyCredits, hoursValid) {
    if (otherPlayerId === playerId) return { ok: false, reason: "self" };
    const exp = Math.floor(Date.now() / 1000) + hoursValid * 3600;
    const info = this.db
      .prepare(
        `INSERT INTO contracts (world_id, party_a_type, party_a_id, party_b_type, party_b_id, terms_json, penalty_credits, expires_at)
         VALUES (?, 'player', ?, 'player', ?, '{}', ?, ?)`
      )
      .run(this.worldId, playerId, otherPlayerId, penaltyCredits, exp);
    return { ok: true, id: info.lastInsertRowid };
  }

  extractResource(nodeId, playerId, rate) {
    const node = this.db.prepare("SELECT * FROM resource_nodes WHERE id = ?").get(nodeId);
    if (!node || node.volume <= 0) return { ok: false, reason: "empty" };
    const take = Math.min(rate, node.volume);
    const depletion = node.volume > 0 ? take / node.volume : 0;
    const val = gdd.resourceValue(1, node.purity, 1, take, depletion);
    this.db.prepare("UPDATE resource_nodes SET volume = volume - ? WHERE id = ?").run(take, nodeId);
    this._addItemToBackpack(playerId, node.item_id, Math.max(1, Math.floor(take / 10)), node.purity);
    return { ok: true, extracted: take, value_score: val };
  }

  addPollutionAtPlayer(playerId, amount) {
    const pl = this.db.prepare("SELECT pos_x, pos_y, world_id FROM players WHERE id = ?").get(playerId);
    if (!pl) return;
    const { cx, cy } = this._chunkCoords(pl.pos_x, pl.pos_y);
    this.db
      .prepare(
        `INSERT INTO chunk_pollution (world_id, cx, cy, pollution) VALUES (?, ?, ?, ?)
         ON CONFLICT(world_id, cx, cy) DO UPDATE SET pollution = MIN(1, chunk_pollution.pollution + excluded.pollution)`
      )
      .run(pl.world_id, cx, cy, amount);
  }

  tickSurvivalAll() {
    const players = this.db.prepare("SELECT player_id FROM player_vitals").all();
    const decay =
      gdd.SURVIVAL_HUNGER_DECAY_PER_TICK * gdd.SURVIVAL_ACTIVITY_MULT_IDLE;
    const decHunger = this.db.prepare(
      "UPDATE player_vitals SET hunger = MAX(?, hunger - ?) WHERE player_id = ?"
    );
    const dmg = this.db.prepare(
      "UPDATE player_vitals SET health = MAX(?, health - ?) WHERE player_id = ? AND hunger <= 0"
    );
    const tempUpd = this.db.prepare(
      `UPDATE player_vitals SET temperature = MIN(100, MAX(0,
        temperature + (? - temperature) * ?)) WHERE player_id = ?`
    );

    for (const { player_id } of players) {
      decHunger.run(gdd.VITAL_MIN, decay, player_id);
      dmg.run(gdd.VITAL_MIN, gdd.SURVIVAL_DAMAGE_WHEN_STARVING, player_id);
      tempUpd.run(gdd.TEMP_IDEAL, gdd.TEMP_DRIFT, player_id);
    }
  }

  tickDiseaseDamage() {
    const now = Math.floor(Date.now() / 1000);
    const rows = this.db
      .prepare("SELECT player_id, effect_code, potency FROM player_effects WHERE expires_at > ?")
      .all(now);
    const updH = this.db.prepare(
      "UPDATE player_vitals SET health = MAX(0, health - ?) WHERE player_id = ?"
    );
    const updE = this.db.prepare(
      "UPDATE player_vitals SET energy = MAX(0, energy - ?) WHERE player_id = ?"
    );
    for (const r of rows) {
      const cfg = EFFECT_DAMAGE[r.effect_code];
      if (!cfg) continue;
      const m = r.potency || 1;
      if (cfg.health) updH.run(cfg.health * m, r.player_id);
      if (cfg.energy) updE.run(cfg.energy * m, r.player_id);
    }
  }

  tickCraftingAll(deltaSec = 60) {
    const rows = this.db
      .prepare("SELECT id, player_id, recipe_id, progress_remain_sec FROM player_crafting")
      .all();
    for (const r of rows) {
      const left = r.progress_remain_sec - deltaSec;
      if (left <= 0) {
        this.db.prepare("DELETE FROM player_crafting WHERE id = ?").run(r.id);
        this._completeCraftRow(r.player_id, r.recipe_id);
      } else {
        this.db
          .prepare("UPDATE player_crafting SET progress_remain_sec = ? WHERE id = ?")
          .run(left, r.id);
      }
    }
  }

  tickWorldSimulation() {
    simulation.tickMarketPrices(this.db);
    simulation.tickBankDeposits(this.db);
    simulation.tickLoans(this.db);
    simulation.tickPollutionDecay(this.db);
    simulation.tickCountryRelations(this.db);
    simulation.tickEffectsExpiry(this.db);
    simulation.tickBuildingWear(this.db);
  }

  tickWorldAll() {
    this.tickSurvivalAll();
    this.tickDiseaseDamage();
    this.tickCraftingAll(60);
    this.tickWorldSimulation();
  }

  getEfficiency(playerId) {
    const v = this.getVitals(playerId);
    if (!v) return 0;
    const pol = this.getPollutionAtPlayer(playerId);
    const dis = this.getDiseasePenalty(playerId);
    return gdd.efficiencyFull(v.energy, v.health, v.hunger, pol, dis);
  }
}

module.exports = { WorldService, CONTAINER_KINDS };
