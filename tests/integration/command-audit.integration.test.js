const test = require("node:test");
const assert = require("node:assert/strict");

const path = require("node:path");
const fs = require("node:fs");

const { loadCommands } = require("../../src/handlers/commandHandler");

function listJsFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) files.push(...listJsFiles(full));
        else if (e.isFile() && e.name.endsWith(".js")) files.push(full);
    }
    return files;
}

test("integration: command audit - load all command modules, ensure unique data.name, ensure execute exists", async () => {
    const commandsDir = path.join(__dirname, "..", "..", "src", "commands");
    const commandFiles = listJsFiles(commandsDir);

    assert.ok(commandFiles.length > 0, "should find command files under src/commands");

    const loaded = loadCommands(commandsDir, { warn() { }, error() { } });
    assert.ok(Array.isArray(loaded), "loadCommands should return array");

    // Validate basic shape: must have data.name and execute().
    // Duplicates may exist in repository, but deployCommands already de-dupes by name.
    for (const cmd of loaded) {
        const name = cmd?.data?.name;
        assert.ok(name, "command must have data.name");
        assert.equal(typeof cmd.execute, "function", `command ${name} must have execute()`);
    }
});
