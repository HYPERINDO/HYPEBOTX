module.exports = {
  name: "warn",
  async execute(client, warning) {
    client.container.logger.warn("client warning", { warning });
  },
};
