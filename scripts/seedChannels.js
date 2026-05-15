const { createApp } = require("../src/app");

async function main() {
  const app = createApp();
  app.client.once("ready", async () => {
    const targetGuildId = app.client.container.botConfig.guildId;
    const guild = targetGuildId
      ? app.client.guilds.cache.get(targetGuildId) || await app.client.guilds.fetch(targetGuildId)
      : app.client.guilds.cache.first();
    if (!guild) {
      throw new Error("Guild tidak ditemukan.");
    }
    await app.client.container.services.structureService.ensureTemplate(guild, "gamestore");
    console.log("Channels seeded");
    process.exit(0);
  });

  await app.start();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
