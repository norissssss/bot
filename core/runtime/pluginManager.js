const fs = require("fs");
const path = require("path");
const config = require("../config/plugins");

module.exports = (client) => {
  client.plugins = new Map();

  client.loadPlugin = (name) => {
    if (!config.enabled.includes(name)) return;

    const base = path.join(__dirname, "..", "..", "plugins", name);

    const plugin = {
      name,
      commands: [],
      events: []
    };

    // commands
    const cmdPath = path.join(base, "commands");
    if (fs.existsSync(cmdPath)) {
      for (const file of fs.readdirSync(cmdPath)) {
        if (!file.endsWith(".js")) continue;
        const full = path.join(cmdPath, file);
        delete require.cache[require.resolve(full)];

        const cmd = require(full);

        client.commands.set(cmd.data.name, cmd);
        plugin.commands.push(cmd.data.name);
      }
    }

    // events
    const evtPath = path.join(base, "events");
    if (fs.existsSync(evtPath)) {
      for (const file of fs.readdirSync(evtPath)) {
        if (!file.endsWith(".js")) continue;
        const full = path.join(evtPath, file);
        delete require.cache[require.resolve(full)];

        const evt = require(full);

        const handler = (...args) => evt.execute(...args, client);

        if (evt.once) client.once(evt.event, handler);
        else client.on(evt.event, handler);

        plugin.events.push({ event: evt.event, handler });
      }
    }

    client.plugins.set(name, plugin);
    console.log(`🔌 Plugin loaded: ${name}`);
  };

  client.unloadPlugin = (name) => {
    const plugin = client.plugins.get(name);
    if (!plugin) return;

    for (const cmd of plugin.commands) {
      client.commands.delete(cmd);
    }

    for (const evt of plugin.events) {
      client.off(evt.event, evt.handler);
    }

    client.plugins.delete(name);

    console.log(`❌ Plugin unloaded: ${name}`);
  };

  client.reloadPlugin = (name) => {
    client.unloadPlugin(name);
    client.loadPlugin(name);
  };

  // initial load
  for (const name of config.enabled) {
    client.loadPlugin(name);
  }
};