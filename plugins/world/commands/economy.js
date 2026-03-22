const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("economy")
    .setDescription("Экономика, банк, рынок, крафт, наука, политика (GDD)")
    .addSubcommand(s =>
      s.setName("balance").setDescription("Кошелёк и вклад в банке")
    )
    .addSubcommand(s =>
      s
        .setName("deposit")
        .setDescription("Положить на депозит")
        .addNumberOption(o =>
          o.setName("amount").setDescription("Сумма").setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand(s =>
      s
        .setName("withdraw")
        .setDescription("Снять с депозита")
        .addNumberOption(o =>
          o.setName("amount").setDescription("Сумма").setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand(s =>
      s
        .setName("loan")
        .setDescription("Взять кредит")
        .addNumberOption(o =>
          o.setName("amount").setDescription("Сумма").setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand(s =>
      s
        .setName("repay")
        .setDescription("Погасить кредит")
        .addIntegerOption(o =>
          o.setName("loan_id").setDescription("ID кредита из /economy loans").setRequired(true)
        )
    )
    .addSubcommand(s => s.setName("loans").setDescription("Список кредитов"))
    .addSubcommand(s =>
      s
        .setName("price")
        .setDescription("Цена на рынке")
        .addStringOption(o =>
          o
            .setName("item")
            .setDescription("Код предмета, напр. steel_bar_t1")
            .setRequired(true)
        )
    )
    .addSubcommand(s =>
      s
        .setName("buy")
        .setDescription("Купить на рынке")
        .addStringOption(o =>
          o.setName("item").setDescription("Код предмета").setRequired(true)
        )
        .addIntegerOption(o =>
          o.setName("qty").setDescription("Количество").setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand(s =>
      s
        .setName("craft")
        .setDescription("Начать крафт по рецепту")
        .addStringOption(o =>
          o
            .setName("recipe")
            .setDescription("Код рецепта, напр. sawmill_boards")
            .setRequired(true)
        )
    )
    .addSubcommand(s => s.setName("crafting").setDescription("Текущее производство"))
    .addSubcommand(s => s.setName("recipes").setDescription("Список рецептов"))
    .addSubcommand(s => s.setName("science").setDescription("Эксперимент (очки науки)"))
    .addSubcommand(s => s.setName("politics").setDescription("Доверие и страна"))
    .addSubcommand(s =>
      s
        .setName("contract")
        .setDescription("Контракт с другим игроком (по Discord ID)")
        .addUserOption(o => o.setName("partner").setDescription("Партнёр").setRequired(true))
        .addNumberOption(o =>
          o.setName("penalty").setDescription("Штраф при нарушении").setRequired(true).setMinValue(0)
        )
        .addIntegerOption(o =>
          o.setName("hours").setDescription("Срок в часах").setRequired(true).setMinValue(1)
        )
    ),

  async execute(interaction) {
    const world = interaction.client.world;
    if (!world) {
      await interaction.reply({ content: "Модуль мира не загружен.", ephemeral: true });
      return;
    }

    const player = world.getOrCreatePlayerDiscord(interaction.user.id);
    const sub = interaction.options.getSubcommand();

    if (sub === "balance") {
      const w = world.getWallet(player.id);
      const b = world.getBank(player.id);
      await interaction.reply({
        content: `**Баланс:** ${w.credits.toFixed(2)} кр.\n**Депозит:** ${b.balance.toFixed(2)} кр. (ставка ${(b.annual_rate * 100).toFixed(2)}% год.)`,
        ephemeral: true
      });
      return;
    }

    if (sub === "deposit") {
      const amount = interaction.options.getNumber("amount");
      const r = world.bankDeposit(player.id, amount);
      await interaction.reply({
        content: r.ok ? `Положено ${amount} кр. на депозит.` : "Недостаточно средств.",
        ephemeral: true
      });
      return;
    }

    if (sub === "withdraw") {
      const amount = interaction.options.getNumber("amount");
      const r = world.bankWithdraw(player.id, amount);
      await interaction.reply({
        content: r.ok ? `Снято ${amount} кр.` : "Недостаточно на депозите.",
        ephemeral: true
      });
      return;
    }

    if (sub === "loan") {
      const amount = interaction.options.getNumber("amount");
      const r = world.takeLoan(player.id, amount);
      const map = {
        ok: `Кредит ${amount} кр. зачислен (5% APR, проценты капают).`,
        limit: "Превышен лимит задолженности.",
        bad_amount: "Некорректная сумма."
      };
      await interaction.reply({
        content: r.ok ? map.ok : map[r.reason] ?? "Отказ.",
        ephemeral: true
      });
      return;
    }

    if (sub === "loans") {
      const loans = world.getLoans(player.id);
      if (!loans.length) {
        await interaction.reply({ content: "Нет активных кредитов.", ephemeral: true });
        return;
      }
      const text = loans
        .map(
          l =>
            `ID \`${l.id}\`: тело ${l.principal.toFixed(2)} + проц. ${l.accrued_interest.toFixed(2)} (APR ${(l.apr * 100).toFixed(1)}%)`
        )
        .join("\n");
      await interaction.reply({ content: `**Кредиты**\n${text}`, ephemeral: true });
      return;
    }

    if (sub === "repay") {
      const loanId = interaction.options.getInteger("loan_id");
      const r = world.repayLoan(player.id, loanId);
      await interaction.reply({
        content: r.ok ? `Погашено ${r.paid.toFixed(2)} кр.` : "Нельзя погасить (средства или ID).",
        ephemeral: true
      });
      return;
    }

    if (sub === "price") {
      const code = interaction.options.getString("item");
      const p = world.getMarketPrice(code);
      await interaction.reply({
        content: p
          ? `**${code}** — цена ~${p.price.toFixed(2)} (S=${p.supply.toFixed(1)} D=${p.demand.toFixed(1)})`
          : "Нет данных по рынку.",
        ephemeral: true
      });
      return;
    }

    if (sub === "buy") {
      const code = interaction.options.getString("item");
      const qty = interaction.options.getInteger("qty");
      const r = world.marketBuy(player.id, code, qty);
      await interaction.reply({
        content: r.ok
          ? `Куплено ${qty}× \`${code}\` за ${r.cost.toFixed(2)} кр.`
          : `Покупка не удалась (${r.reason}).`,
        ephemeral: true
      });
      return;
    }

    if (sub === "craft") {
      const recipe = interaction.options.getString("recipe");
      const r = world.startCraft(player.id, recipe);
      const map = {
        ok: `Крафт \`${recipe}\` запущен (~${r.time_sec?.toFixed(0)} с).`,
        busy: "Уже идёт производство. /economy crafting",
        unknown_recipe: "Неизвестный рецепт.",
        missing_inputs: "Не хватает материалов в рюкзаке."
      };
      await interaction.reply({
        content: r.ok ? map.ok : map[r.reason] ?? "Ошибка.",
        ephemeral: true
      });
      return;
    }

    if (sub === "crafting") {
      const c = world.getCrafting(player.id);
      await interaction.reply({
        content: c
          ? `Рецепт \`${c.recipe_code}\`, осталось ~${c.progress_remain_sec.toFixed(0)} с`
          : "Нет активного крафта.",
        ephemeral: true
      });
      return;
    }

    if (sub === "recipes") {
      const list = world.listRecipes();
      const text = list
        .slice(0, 20)
        .map(r => `\`${r.code}\` → ${r.output_code} ×${r.output_qty} (${r.machine_type}, ${r.time_sec}s)`)
        .join("\n");
      await interaction.reply({
        content: list.length ? `**Рецепты** (фрагмент)\n${text}` : "Нет рецептов в БД.",
        ephemeral: true
      });
      return;
    }

    if (sub === "science") {
      const r = world.scienceExperiment(player.id);
      await interaction.reply({
        content: `Опыты: +${r.gain.toFixed(3)} очков. Всего: **${r.points.toFixed(2)}**. Открытие: \`${r.discovery}\`.`,
        ephemeral: true
      });
      return;
    }

    if (sub === "politics") {
      const pol = world.getPolitics(player.id);
      await interaction.reply({
        content: pol
          ? `**${pol.country}** — репутация ${pol.reputation.toFixed(0)}, доверие (модель) ${pol.trust.toFixed(1)}`
          : "Нет данных.",
        ephemeral: true
      });
      return;
    }

    if (sub === "contract") {
      const partner = interaction.options.getUser("partner");
      const penalty = interaction.options.getNumber("penalty");
      const hours = interaction.options.getInteger("hours");
      const other = world.getOrCreatePlayerDiscord(partner.id);
      const r = world.createContract(player.id, other.id, penalty, hours);
      await interaction.reply({
        content: r.ok
          ? `Контракт #${r.id} с <@${partner.id}>, штраф ${penalty}, ${hours} ч.`
          : "Не удалось создать контракт.",
        ephemeral: true
      });
    }
  }
};
