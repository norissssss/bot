/** Мир и выживание по promt.txt; константы — gdd.js */
const path = require("path");
const { openDatabase } = require("./db");
const { WorldService } = require("./service");

function initWorld(client, options = {}) {
  let dbPath = options.dbPath;
  if (!dbPath) {
    try {
      dbPath = require("../../config").dbPath;
    } catch {
      dbPath = path.join(__dirname, "../../data/anaria.db");
    }
  }
  const db = openDatabase(dbPath);
  const world = new WorldService(db);
  client.world = world;
  client.db = db;

  const runTick = () => {
    try {
      world.tickWorldAll();
    } catch (e) {
      console.error("[world] tick:", e);
    }
  };

  const shardOk = !client.shard || client.shard.ids.includes(0);
  if (shardOk) {
    const ms = options.survivalTickMs ?? 60_000;
    client._worldTick = setInterval(runTick, ms);
  }

  return world;
}

function stopWorld(client) {
  if (client._worldTick) {
    clearInterval(client._worldTick);
    client._worldTick = null;
  }
  if (client.db) {
    client.db.close();
    client.db = null;
  }
  client.world = null;
}

module.exports = { initWorld, stopWorld };
