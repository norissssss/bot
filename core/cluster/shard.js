const path = require("path");
const { ShardingManager } = require("discord.js");
const { token } = require("../../config");

const manager = new ShardingManager(path.join(__dirname, "../bot.js"), {
  token,
  totalShards: "auto"
});

manager.on("shardCreate", shard => {
  console.log(`🧩 Shard ${shard.id} запущен`);
});

manager.spawn();