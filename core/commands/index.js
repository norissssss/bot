const { REST, Routes } = require("discord.js");
const { token, guildId } = require("../../config");

async function registerApplicationCommands(applicationId, commands) {
  const rest = new REST().setToken(token);
  const body = [...commands.values()].map(cmd => cmd.data.toJSON());
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body });
  } else {
    await rest.put(Routes.applicationCommands(applicationId), { body });
  }
}

module.exports = { registerApplicationCommands };
