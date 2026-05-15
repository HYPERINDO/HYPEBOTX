const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "src");
const patterns = [
    { label: "Collector creation", regex: /createMessageComponentCollector|createReactionCollector|createMessageCollector|createCollector/ },
    { label: "setInterval", regex: /setInterval\(/ },
    { label: "setTimeout", regex: /setTimeout\(/ },
    { label: "new Map", regex: /new Map\(/ },
    { label: "new Set", regex: /new Set\(/ },
    { label: "new Collection", regex: /new Collection\(/ },
    { label: "cache.set", regex: /\.set\(/ },
];

async function walk(dir) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "node_modules" || entry.name === ".git") continue;
            files.push(...(await walk(fullPath)));
        } else if (entry.isFile() && fullPath.endsWith(".js")) {
            files.push(fullPath);
        }
    }

    return files;
}

async function search() {
    const files = await walk(root);
    for (const file of files) {
        const content = await fs.promises.readFile(file, "utf8");
        const lines = content.split(/\r?\n/);
        patterns.forEach(({ label, regex }) => {
            lines.forEach((line, index) => {
                if (regex.test(line)) {
                    console.log(`${label}: ${file}:${index + 1}`);
                    console.log(`  ${line.trim()}`);
                }
            });
        });
    }
}

search().catch((error) => {
    console.error("Memory risk audit failed:", error);
    process.exit(1);
});
