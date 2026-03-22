const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("world")
    .setDescription("Мир: выживание, инвентарь")
    .addSubcommand(s => s.setName("profile").setDescription("Виталы, эффективность, экология"))
    .addSubcommand(s => s.setName("inv").setDescription("Предметы в рюкзаке"))
    .addSubcommand(s => s.setName("eat").setDescription("Съесть еду из рюкзака"))
    .addSubcommand(s => s.setName("heal").setDescription("Использовать медикамент")),

  async execute(interaction) {
    const world = interaction.client.world;
    if (!world) {
      await interaction.reply({ content: "Модуль мира не загружен.", ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const player = world.getOrCreatePlayerDiscord(interaction.user.id);

    if (sub === "profile") {
      const v = world.getVitals(player.id);
      const eff = world.getEfficiency(player.id);
      const pol = world.getPollutionAtPlayer(player.id);
      const dis = world.getDiseasePenalty(player.id);
      const temp = v.temperature != null ? v.temperature.toFixed(1) : "50";
      const rep = v.reputation != null ? v.reputation.toFixed(0) : "0";
      await interaction.reply({
        content:
          `**Персонаж** (GDD §2–3, §16)\n` +
          `Позиция: ${player.pos_x.toFixed(0)} × ${player.pos_y.toFixed(0)}\n` +
          `Здоровье: ${v.health.toFixed(1)} | Голод: ${v.hunger.toFixed(1)} | Энергия: ${v.energy.toFixed(1)}\n` +
          `Температура: ${temp} | Репутация: ${rep}\n` +
          `Загрязнение чанка: ${(pol * 100).toFixed(1)}% | Штраф болезней: ${(dis * 100).toFixed(1)}%\n` +
          `Эффективность: ${(eff * 100).toFixed(1)}%`,
        ephemeral: true
      });
      return;
    }

    if (sub === "inv") {
      const lines = world.getBackpackLines(player.id, 15);
      if (!lines.length) {
        await interaction.reply({ content: "Рюкзак пуст.", ephemeral: true });
        return;
      }
      const text = lines
        .map(l => `[${l.slot_index}] ${l.name} ×${l.quantity}`)
        .join("\n");
      await interaction.reply({ content: `**Рюкзак**\n${text}`, ephemeral: true });
      return;
    }

    if (sub === "eat") {
      const r = world.eatOneFoodFromBackpack(player.id);
      if (!r.ok) {
        const map = { no_food: "Нет еды в рюкзаке.", no_backpack: "Нет контейнера." };
        await interaction.reply({ content: map[r.reason] ?? "Нельзя.", ephemeral: true });
        return;
      }
      const v = world.getVitals(player.id);
      await interaction.reply({
        content: `Съели: \`${r.ate}\`. Голод: ${v.hunger.toFixed(1)}, энергия: ${v.energy.toFixed(1)}`,
        ephemeral: true
      });
      return;
    }

    if (sub === "heal") {
      const r = world.useMedKit(player.id);
      if (!r.ok) {
        await interaction.reply({
          content: r.reason === "no_med" ? "Нет аптечки/лекарства." : "Нельзя.",
          ephemeral: true
        });
        return;
      }
      const v = world.getVitals(player.id);
      await interaction.reply({
        content: `Использовано: \`${r.used}\`. Здоровье: ${v.health.toFixed(1)}`,
        ephemeral: true
      });
      return;
    }

  }
};
