const { AttachmentBuilder, SlashCommandBuilder } = require('discord.js');
const { renderWorldMap } = require('../lib/mapRenderer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('map')
    .setDescription('Показать карту мира'),

  async execute(interaction) {
    const world = interaction.client.world;
    if (!world) {
      await interaction.reply({ content: 'Модуль мира не загружен.', ephemeral: true });
      return;
    }

    const mapData = world.getWorldMapData();
    const image = renderWorldMap(mapData);
    const file = new AttachmentBuilder(image, { name: 'world-map.png' });
    const cityCount = mapData.countries.reduce((sum, country) => sum + country.cities.length, 0);

    await interaction.reply({
      content: `Карта мира готова. Стран: **${mapData.countries.length}**, городов: **${cityCount}**.`,
      files: [file]
    });
  }
};
