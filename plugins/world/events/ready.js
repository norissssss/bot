const { syncCountryGuilds } = require('../lib/discordWorldSync');

module.exports = {
  event: 'clientReady',
  once: true,

  async execute(readyClient) {
    const world = readyClient.world;
    if (!world) return;

    try {
      const countries = world.listCountriesWithCities();
      const result = await syncCountryGuilds(readyClient, countries);
      const created = result.filter(item => item.status === 'ok').length;
      const skipped = result.filter(item => item.status !== 'ok').length;
      console.log(`[world] Синхронизация каналов городов: ok=${created}, skipped=${skipped}`);
      if (skipped) {
        const skippedCountries = result
          .filter(item => item.status !== 'ok')
          .map(item => item.country)
          .join(', ');
        console.log(`[world] Не удалось подобрать сервер для стран: ${skippedCountries}`);
      }
    } catch (error) {
      console.error('[world] Ошибка синхронизации каналов городов:', error);
    }
  }
};
