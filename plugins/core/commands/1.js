const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("test")
    .setDescription("none"),

  async execute(interaction) {
    await interaction.reply(".");
  }
};