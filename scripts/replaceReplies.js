const fs = require('fs');
const path = require('path');

function walk(dir, filelist = []) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            if (file === 'node_modules') return; // skip
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

for (const filePath of files) {
    const rel = path.relative(projectRoot, filePath).replace(/\\\\/g, '/');
    if (rel === 'src/utils/discordResponse.js') continue;

    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('interaction.reply')) continue;
    if (content.includes('safeReply')) continue; // skip already migrated

    // compute require path from file to src/utils/discordResponse.js
    const utilPath = path.relative(path.dirname(filePath), path.join(srcDir, 'utils', 'discordResponse.js'));
    let requirePath = utilPath.replace(/\\\\/g, '/').replace(/\\/g, '/');
    if (!requirePath.startsWith('.')) requirePath = './' + requirePath;

    // Insert require near top: after the last require/const ... = require(...) line
    const lines = content.split('\n');
    let insertIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 40); i++) {
        if (/^\s*(const|let|var)\s+.*=\s*require\(/.test(lines[i])) {
            insertIdx = i;
        }
    }
    const requireLine = `const { safeReply } = require("${requirePath.replace(/\\\\/g, '/')}");`;
    if (insertIdx === -1) {
        lines.splice(0, 0, requireLine);
    } else {
        lines.splice(insertIdx + 1, 0, requireLine);
    }

    content = lines.join('\n');

    // Replace occurrences
    // 1) await interaction.reply(
    content = content.split('await interaction.reply(').join('await safeReply(interaction, ');
    content = content.split('return interaction.reply(').join('return safeReply(interaction, ');
    // 2) interaction.reply( (without await)
    content = content.split('interaction.reply(').join('safeReply(interaction, ');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Patched', rel);
}

console.log('Done');
