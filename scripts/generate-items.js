/**
 * 300 уникальных предметов для seeds.
 * Запуск: node scripts/generate-items.js > sql/seeds/001_items.sql
 */

const categories = [
  ["raw", "Сырьё"],
  ["processing", "Переработка"],
  ["components", "Компоненты"],
  ["tech", "Техника"],
  ["food", "Еда"],
  ["medicine", "Медицина"],
  ["military", "Военное"],
  ["clothing", "Одежда"],
  ["electronics", "Электроника"],
  ["misc", "Прочее"]
];

const catCodeToId = Object.fromEntries(categories.map(([c], i) => [c, i + 1]));

function escapeSql(s) {
  return String(s).replace(/'/g, "''");
}

const rows = [];

function addItem(code, name, catCode, tier = 1, weight = 1, stack = 64, extra = {}) {
  const cid = catCodeToId[catCode];
  if (!cid) throw new Error(`Unknown category: ${catCode}`);
  const cons = extra.consumable ? 1 : 0;
  const slot = extra.equip_slot ? `'${extra.equip_slot}'` : "NULL";
  rows.push(
    `('${code}', '${escapeSql(name)}', ${cid}, ${tier}, ${weight}, ${stack}, ${cons}, ${slot})`
  );
}

const rawMaterials = [
  "wood", "stone", "iron_ore", "coal", "oil", "sand", "water", "copper_ore",
  "silicon_ore", "lithium_ore", "uranium_ore", "gold_ore", "silver_ore",
  "clay", "sulfur", "salt", "phosphorus", "nitrogen", "hydrogen", "oxygen"
];

for (const r of rawMaterials) {
  for (let g = 1; g <= 5; g++) {
    addItem(`raw_${r}_g${g}`, `${r} (качество ${g})`, "raw", g, 1 + g * 0.1, 64);
  }
}

const proc = [
  ["boards", "Доски"],
  ["steel_bar", "Сталь"],
  ["plastic_sheet", "Пластик"],
  ["glass_sheet", "Стекло"],
  ["concrete_block", "Бетон"],
  ["copper_wire", "Провода"]
];
for (const [code, label] of proc) {
  for (let t = 1; t <= 8; t++) {
    addItem(`${code}_t${t}`, `${label} T${t}`, "processing", t, 0.5 + t * 0.05, 64);
  }
}

const comps = [
  ["bolt", "Болт"],
  ["engine_small", "Двигатель"],
  ["battery_cell", "Аккумулятор"],
  ["microchip", "Микрочип"],
  ["turbine", "Турбина"],
  ["bearing", "Подшипник"],
  ["circuit_board", "Плата"],
  ["antenna", "Антенна"]
];
for (const [code, label] of comps) {
  for (let v = 1; v <= 12; v++) {
    addItem(`comp_${code}_v${v}`, `${label} v${v}`, "components", Math.ceil(v / 3), 0.2, 128);
  }
}

const tech = [
  ["car", "Машина"],
  ["plane", "Самолёт"],
  ["drone", "Дрон"],
  ["generator", "Генератор"],
  ["pump", "Насос"],
  ["furnace", "Печь"]
];
for (const [code, label] of tech) {
  for (let m = 1; m <= 10; m++) {
    addItem(`tech_${code}_mk${m}`, `${label} Mk${m}`, "tech", m, 10 + m * 2, 1);
  }
}

const foods = [
  ["bread", "Хлеб"],
  ["rice", "Рис"],
  ["ration", "Рацион"],
  ["premium_meal", "Премиум-рацион"],
  ["soup", "Суп"],
  ["stew", "Рагу"]
];
for (const [code, label] of foods) {
  for (let q = 1; q <= 15; q++) {
    addItem(`food_${code}_q${q}`, `${label} Q${q}`, "food", Math.ceil(q / 5), 0.3, 32, {
      consumable: true
    });
  }
}

const med = [
  ["medkit", "Аптечка"],
  ["pills", "Лекарство"],
  ["vaccine", "Вакцина"],
  ["bandage", "Бинт"],
  ["serum", "Сыворотка"]
];
for (const [code, label] of med) {
  for (let s = 1; s <= 10; s++) {
    addItem(`med_${code}_s${s}`, `${label} S${s}`, "medicine", s, 0.1, 16, { consumable: true });
  }
}

const mil = [
  ["rifle", "Винтовка"],
  ["ammo", "Боеприпасы"],
  ["strike_drone", "Дрон-ударник"],
  ["armor_plate", "Бронеплита"],
  ["helmet", "Шлем"]
];
for (const [code, label] of mil) {
  for (let k = 1; k <= 12; k++) {
    addItem(`mil_${code}_k${k}`, `${label} K${k}`, "military", Math.ceil(k / 3), 2, 1);
  }
}

const clothes = [
  ["hat", "Шляпа", "head"],
  ["jacket", "Куртка", "body"],
  ["pants", "Штаны", "legs"],
  ["boots", "Ботинки", "feet"],
  ["gloves", "Перчатки", "hands"]
];
for (const [code, label, slot] of clothes) {
  for (let d = 1; d <= 15; d++) {
    addItem(`cloth_${code}_d${d}`, `${label} D${d}`, "clothing", Math.ceil(d / 5), 0.5, 1, {
      equip_slot: slot
    });
  }
}

for (let i = 1; i <= 25; i++) {
  addItem(`phone_model_${i}`, `Смартфон M${i}`, "electronics", Math.ceil(i / 5), 0.2, 1, {
    equip_slot: "phone"
  });
}

for (let i = 1; i <= 30; i++) {
  addItem(`backpack_${i}`, `Рюкзак ${i}L`, "misc", Math.ceil(i / 10), 1 + i * 0.05, 1);
}

let x = 1;
while (rows.length < 300) {
  addItem(`misc_part_${x}`, `Запчасть ${x}`, "misc", 1, 0.05, 256);
  x++;
}

const finalRows = rows.slice(0, 300);

console.log("-- 300 items (generated)");
console.log("BEGIN;");
console.log("INSERT INTO item_categories (id, code, name) VALUES");
console.log(
  categories
    .map(([code, name], i) => `  (${i + 1}, '${code}', '${escapeSql(name)}')`)
    .join(",\n") + "\nON CONFLICT (id) DO NOTHING;");
console.log(
  "INSERT INTO items (code, name, category_id, tier, weight, stack_max, consumable, equip_slot) VALUES"
);
console.log(finalRows.join(",\n") + ";");
console.log("COMMIT;");
