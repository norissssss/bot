const { ChannelType } = require('discord.js');

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'city';
}

function normalize(value) {
  return String(value).trim().toLowerCase();
}

function parseCountryGuildMap() {
  const raw = process.env.COUNTRY_GUILD_MAP;
  if (!raw) return new Map();
  try {
    return new Map(Object.entries(JSON.parse(raw)).map(([country, guildId]) => [normalize(country), String(guildId)]));
  } catch (error) {
    console.warn('[world] COUNTRY_GUILD_MAP parse error:', error.message);
    return new Map();
  }
}

function findGuildForCountry(client, country, explicitMap) {
  const normalized = normalize(country.name);
  const mappedGuildId = explicitMap.get(normalized);
  if (mappedGuildId) {
    return client.guilds.cache.get(mappedGuildId) ?? null;
  }

  const exactByName = client.guilds.cache.find(guild => normalize(guild.name) === normalized);
  if (exactByName) return exactByName;

  if (client.guilds.cache.size === 1) {
    return client.guilds.cache.first() ?? null;
  }

  return null;
}

async function ensureCountryCategory(guild, country) {
  const expectedName = `🏳️ ${country.name}`.slice(0, 100);
  const existing = guild.channels.cache.find(
    channel => channel.type === ChannelType.GuildCategory && channel.name === expectedName
  );
  if (existing) return existing;

  return guild.channels.create({
    name: expectedName,
    type: ChannelType.GuildCategory,
    reason: `Категория страны ${country.name}`
  });
}

async function ensureCityChannel(guild, parent, country, city) {
  const channelName = slugify(city.name);
  const topic = `WORLD_CITY:${country.id}:${city.id}:${city.name}`;
  const existing = guild.channels.cache.find(
    channel =>
      channel.type === ChannelType.GuildText &&
      (channel.topic === topic || (channel.parentId === parent.id && channel.name === channelName))
  );

  if (existing) {
    const updates = {};
    if (existing.parentId !== parent.id) updates.parent = parent.id;
    if (existing.topic !== topic) updates.topic = topic;
    if (existing.name !== channelName) updates.name = channelName;
    if (Object.keys(updates).length) {
      await existing.edit({ ...updates, reason: `Синхронизация города ${city.name}` });
    }
    return existing;
  }

  return guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parent.id,
    topic,
    reason: `Канал города ${city.name}`
  });
}

async function syncCountryGuilds(client, countries) {
  if (!client?.guilds?.cache?.size) return [];
  const explicitMap = parseCountryGuildMap();
  const results = [];

  for (const country of countries) {
    const guild = findGuildForCountry(client, country, explicitMap);
    if (!guild) {
      results.push({ country: country.name, status: 'skipped', reason: 'guild_not_found' });
      continue;
    }

    await guild.channels.fetch();
    const category = await ensureCountryCategory(guild, country);
    const channels = [];
    for (const city of country.cities ?? []) {
      const channel = await ensureCityChannel(guild, category, country, city);
      channels.push(channel.id);
    }

    results.push({ country: country.name, status: 'ok', guildId: guild.id, channels });
  }

  return results;
}

module.exports = { syncCountryGuilds };
