const fs = require('fs');
const path = require('path');

function walk(dir, filelist = []) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            if (file === 'node_modules') return;
            walk(full, filelist);
        } else if (file.endsWith('.js')) {
            filelist.push(full);
        }
    });
    return filelist;
}

const projectRoot = process.cwd();
const srcDir = path.join(projectRoot, 'src');
const files = walk(srcDir);
let patched = 0;
for (const filePath of files) {
    if (filePath.endsWith('utils/discordResponse.js') || filePath.endsWith('utils/interactionReply.js')) continue;
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('interaction.reply')) continue;

    const hasSafe = content.includes('safeReply');

    // Replace direct calls
    const newContent = content
        .split('await interaction.reply(').join('await safeReply(interaction, ')
        .split('return interaction.reply(').join('return safeReply(interaction, ')
        .split('interaction.reply(').join('safeReply(interaction, ');

    if (newContent === content) continue;

    let final = newContent;

    if (!hasSafe) {
        // add require for safeReply at top near other requires
        const rel = path.relative(path.dirname(filePath), path.join(srcDir, 'utils', 'discordResponse.js')).replace(/\\\\/g, '/').replace(/\\/g, '/');
        let requirePath = rel;
        if (!requirePath.startsWith('.')) requirePath = './' + requirePath;
        const requireLine = `const { safeReply } = require("${requirePath}");`;

        const lines = final.split('\n');
        let insertIdx = -1;
        for (let i = 0; i < Math.min(lines.length, 40); i++) {
            if (/^\s*(const|let|var)\s+.*=\s*require\(/.test(lines[i])) {
                insertIdx = i;
            }
        }
        if (insertIdx === -1) {
            lines.splice(0, 0, requireLine);
        } else {
            lines.splice(insertIdx + 1, 0, requireLine);
        }
        final = lines.join('\n');
    }

    fs.writeFileSync(filePath, final, 'utf8');
    patched++;
    console.log('Patched', path.relative(projectRoot, filePath));
}
console.log('Done, patched', patched, 'files');
