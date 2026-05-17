module.exports = {
  name: "error",
  async execute(client, error) {
    client.container.logger.error("client error", { message: error.message });
  },
};
