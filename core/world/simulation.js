/**
 * Тики симуляции GDD: рынок, банк, экология, эффекты, политика.
 */

const gdd = require("./gdd");

const MINUTES_PER_YEAR = 365 * 24 * 60;

function clampRel(r) {
  return gdd.clamp(r, -1, 1);
}

function tickMarketPrices(db) {
  const wid = db.prepare("SELECT id FROM worlds ORDER BY id LIMIT 1").get()?.id;
  if (!wid) return;
  const rows = db
    .prepare("SELECT item_id, supply, demand, price FROM market_price_index WHERE world_id = ?")
    .all(wid);
  const upd = db.prepare(
    `UPDATE market_price_index SET supply = ?, demand = ?, price = ? WHERE world_id = ? AND item_id = ?`
  );
  for (const r of rows) {
    const price = gdd.marketPrice(r.demand, r.supply);
    const supply = r.supply * 0.9995 + Math.random() * 0.02;
    const demand = r.demand * 0.9995 + Math.random() * 0.02;
    upd.run(supply, demand, price, wid, r.item_id);
  }
}

function tickBankDeposits(db) {
  const rows = db.prepare("SELECT player_id, balance, annual_rate FROM bank_deposits WHERE balance > 0").all();
  const upd = db.prepare("UPDATE bank_deposits SET balance = ? WHERE player_id = ?");
  for (const r of rows) {
    const add = r.balance * (r.annual_rate / MINUTES_PER_YEAR);
    upd.run(r.balance + add, r.player_id);
  }
}

function tickLoans(db) {
  const rows = db.prepare("SELECT id, principal, apr, accrued_interest FROM bank_loans").all();
  const upd = db.prepare(
    "UPDATE bank_loans SET accrued_interest = ? WHERE id = ?"
  );
  for (const r of rows) {
    const add = r.principal * (r.apr / MINUTES_PER_YEAR);
    upd.run(r.accrued_interest + add, r.id);
  }
}

function tickPollutionDecay(db) {
  const rows = db.prepare("SELECT world_id, cx, cy, pollution FROM chunk_pollution WHERE pollution > 0").all();
  const upd = db.prepare(
    "UPDATE chunk_pollution SET pollution = ? WHERE world_id = ? AND cx = ? AND cy = ?"
  );
  for (const r of rows) {
    const p = Math.max(0, r.pollution * 0.999 - 0.0001);
    upd.run(p, r.world_id, r.cx, r.cy);
  }
}

function tickCountryRelations(db) {
  const rows = db.prepare("SELECT country_id_a, country_id_b, relation FROM country_relations").all();
  const upd = db.prepare(
    "UPDATE country_relations SET relation = ? WHERE country_id_a = ? AND country_id_b = ?"
  );
  for (const r of rows) {
    const drift = (Math.random() - 0.5) * 0.01;
    const rel = clampRel(r.relation + drift);
    upd.run(rel, r.country_id_a, r.country_id_b);
  }
}

function tickEffectsExpiry(db, nowSec = Math.floor(Date.now() / 1000)) {
  db.prepare("DELETE FROM player_effects WHERE expires_at <= ?").run(nowSec);
}

function tickBuildingWear(db, deltaSec = 60) {
  db.prepare(
    `UPDATE world_buildings SET wear = wear + ?,
     condition = MAX(0.1, condition - ?)`
  ).run(deltaSec * 0.0001, deltaSec * 0.00001);
}

module.exports = {
  tickMarketPrices,
  tickBankDeposits,
  tickLoans,
  tickPollutionDecay,
  tickCountryRelations,
  tickEffectsExpiry,
  tickBuildingWear
};
