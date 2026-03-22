const { Client, Collection, GatewayIntentBits } = require("discord.js");
const { registerApplicationCommands } = require("./commands");
const pluginManager = require("./runtime/pluginManager");
const { initWorld } = require("./world");

function createClient(options = {}) {
  const client = new Client({
    intents: options.intents ?? [GatewayIntentBits.Guilds]
  });

  client.commands = new Collection();
  initWorld(client, options.world);
  pluginManager(client);

  client.once("clientReady", async () => {
    console.log(`✅ ${client.user.tag} (${client.shard?.ids?.join(",") ?? "single"})`);
    const registerSlash = !client.shard || client.shard.ids.includes(0);
    if (registerSlash) {
      try {
        await registerApplicationCommands(client.user.id, client.commands);
        console.log("Slash-команды зарегистрированы (из plugins)");
      } catch (err) {
        console.error("Ошибка регистрации slash-команд:", err);
      }
    }
  });

  client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error(err);
      const msg = { content: "Ошибка при выполнении команды.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
  });

  return client;
}

module.exports = { createClient };
