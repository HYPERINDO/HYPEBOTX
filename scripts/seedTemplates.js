const { createApp } = require("../src/app");

async function main() {
  const app = createApp();
  app.client.once("ready", async () => {
    console.log(
      app.client.container.services.templateService
        .listTemplates()
        .map((template) => `${template.key}: ${template.label}`)
        .join("\n"),
    );
    process.exit(0);
  });

  await app.start();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
