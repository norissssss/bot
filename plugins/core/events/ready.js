module.exports = {
  event: "clientReady",
  once: true,

  execute(readyClient) {
    console.log(`✅ Plugin core: ${readyClient.user.tag}`);
  }
};