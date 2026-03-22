/**
 * Рецепты GDD §5, §9 — вставка при пустой таблице recipes.
 */

function getItemId(db, code) {
  const r = db.prepare("SELECT id FROM items WHERE code = ?").get(code);
  return r ? r.id : null;
}

function seedRecipesIfEmpty(db) {
  const c = db.prepare("SELECT COUNT(*) AS c FROM recipes").get().c;
  if (c > 0) return;

  const defs = [
    {
      code: "sawmill_boards",
      out: "boards_t1",
      outQty: 4,
      machine: "sawmill",
      time: 8,
      precision: 0.9,
      inputs: [{ code: "raw_wood_g1", qty: 1 }]
    },
    {
      code: "smelt_steel",
      out: "steel_bar_t1",
      outQty: 1,
      machine: "factory",
      time: 30,
      precision: 0.85,
      inputs: [
        { code: "raw_iron_ore_g1", qty: 1 },
        { code: "raw_coal_g1", qty: 1 }
      ]
    },
    {
      code: "chem_plastic",
      out: "plastic_sheet_t1",
      outQty: 2,
      machine: "chem_plant",
      time: 25,
      precision: 0.8,
      inputs: [{ code: "raw_oil_g1", qty: 1 }]
    },
    {
      code: "furnace_glass",
      out: "glass_sheet_t1",
      outQty: 2,
      machine: "furnace",
      time: 12,
      precision: 0.85,
      inputs: [{ code: "raw_sand_g1", qty: 1 }]
    },
    {
      code: "batch_concrete",
      out: "concrete_block_t1",
      outQty: 2,
      machine: "construction_plant",
      time: 15,
      precision: 0.8,
      inputs: [
        { code: "raw_stone_g1", qty: 1 },
        { code: "raw_water_g1", qty: 1 }
      ]
    },
    {
      code: "electronics_wire",
      out: "copper_wire_t1",
      outQty: 2,
      machine: "electronics",
      time: 20,
      precision: 0.88,
      inputs: [
        { code: "raw_copper_ore_g1", qty: 1 },
        { code: "plastic_sheet_t1", qty: 1 }
      ]
    },
    {
      code: "assembly_bolt",
      out: "comp_bolt_v1",
      outQty: 4,
      machine: "assembly",
      time: 10,
      precision: 0.9,
      inputs: [{ code: "steel_bar_t1", qty: 1 }]
    },
    {
      code: "battery_pack",
      out: "comp_battery_cell_v1",
      outQty: 1,
      machine: "electronics",
      time: 40,
      precision: 0.82,
      inputs: [
        { code: "raw_lithium_ore_g1", qty: 1 },
        { code: "plastic_sheet_t1", qty: 1 }
      ]
    },
    {
      code: "nanofab_chip",
      out: "comp_microchip_v1",
      outQty: 1,
      machine: "nanofab",
      time: 60,
      precision: 0.75,
      inputs: [
        { code: "raw_silicon_ore_g1", qty: 1 },
        { code: "raw_gold_ore_g1", qty: 1 }
      ]
    }
  ];

  const insR = db.prepare(
    `INSERT INTO recipes (code, output_item_id, output_qty, machine_type, time_sec, precision_default)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insIn = db.prepare(
    "INSERT INTO recipe_inputs (recipe_id, item_id, qty) VALUES (?, ?, ?)"
  );

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const d of defs) {
      const oid = getItemId(db, d.out);
      if (!oid) continue;
      const info = insR.run(
        d.code,
        oid,
        d.outQty,
        d.machine,
        d.time,
        d.precision
      );
      const rid = Number(info.lastInsertRowid);
      for (const inp of d.inputs) {
        const iid = getItemId(db, inp.code);
        if (!iid) continue;
        insIn.run(rid, iid, inp.qty);
      }
    }
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

module.exports = { seedRecipesIfEmpty };
