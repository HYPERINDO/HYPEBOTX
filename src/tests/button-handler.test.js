const test = require("node:test");
const assert = require("node:assert/strict");

const { handleButton } = require("../handlers/buttonHandler");
const { componentIds } = require("../utils/constants");

function createInteraction() {
    const replies = [];
    return {
        guild: { id: "guild-1" },
        user: { id: "user-1", tag: "user#0001" },
        member: {
            id: "member-1",
            user: { id: "user-1", tag: "user#0001" },
            permissions: { has() { return false; } },
            roles: {
                cache: {
                    has(roleId) { return roleId === "MEMBER"; },
                    values: () => [{ name: "MEMBER", id: "MEMBER" }],
                    keys: () => ["MEMBER"],
                },
            },
        },
        customId: componentIds.customerSimpleCheckButton,
        replied: false,
        replies,
        async reply(payload) {
            this.replied = true;
            replies.push(payload);
        },
    };
}

test("button handler replies with a select row for customer simple check button", async () => {
    const interaction = createInteraction();

    const client = {
        container: {
            services: {},
            repositories: {},
            logger: { info() { }, warn() { }, error() { } },
        },
    };

    await handleButton(client, interaction);

    assert.equal(interaction.replies.length, 1);
    const reply = interaction.replies[0];
    assert.equal(reply.content, "Pilih status order kamu:");
    assert.equal(Array.isArray(reply.components), true);
    assert.equal(reply.components.length, 1);
    assert.equal(typeof reply.components[0].components, "object");
    assert.equal(reply.components[0].components[0].data.custom_id, componentIds.orderStatusSelect);
});

test("button handler customer simple order uses stable ticket mention label", async () => {
    const interaction = createInteraction();
    interaction.customId = componentIds.customerSimpleOrderButton;
    interaction.deferred = false;
    interaction.edits = [];
    interaction.guild = { id: "guild-1" };
    interaction.client = {
        container: {
            logger: { info() { }, warn() { }, error() { } },
            repositories: {},
            services: {},
        },
    };
    interaction.deferReply = async function () {
        this.deferred = true;
    };
    interaction.editReply = async function (payload) {
        this.edits.push(payload);
    };

    const client = {
        container: {
            services: {
                orderService: {
                    async openOrder() {
                        return {
                            reused: true,
                            channel: { id: "1234567890" },
                            ticket: { id: 77 },
                        };
                    },
                },
            },
            repositories: {
                orderRepository: {
                    async findByUserId() {
                        return [];
                    },
                },
            },
            logger: { info() { }, warn() { }, error() { } },
        },
    };
    interaction.client = client;

    await handleButton(client, interaction);

    assert.equal(interaction.edits.length, 1);
    const message = String(interaction.edits[0]);
    assert.equal(message.includes("Ticket order aktif di <#1234567890>."), true);
    assert.equal(message.includes("#unknown"), false);
});
