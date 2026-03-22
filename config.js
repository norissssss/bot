const path = require("path");

module.exports = {
  token: "MTQ4NTI4MTEwNTQwNDc2MDI0Ng.GBRJs6.9_J00Jdf5MI72_d3r_3qgMNF90OEEk83zvx7AY",
  /** ID сервера — команды видны сразу. null = глобальные (Discord обновляет до ~1 ч). */
  guildId: null,
  /** SQLite: мир, игроки, инвентарь */
  dbPath: path.join(__dirname, "data", "anaria.db")
};