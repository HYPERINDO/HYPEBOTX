const fs = require('fs');
const path = require('path');
const glob = require('glob');
const root = path.join(__dirname, '..', 'src', 'commands');
const files = glob.sync('**/*.js', { cwd: root, absolute: true });
const commands = [];
for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const nameMatches = [...content.matchAll(/\.setName\((?:'|")(.+?)(?:'|")\)/g)];
    const descMatches = [...content.matchAll(/\.setDescription\((?:'|")(.+?)(?:'|")\)/g)];
    const fileCommands = [];
    for (let i = 0; i < nameMatches.length; i++) {
        fileCommands.push({ name: nameMatches[i][1], desc: descMatches[i] ? descMatches[i][1] : null });
    }
    commands.push({ path: path.relative(root, file).replace(/\\/g, '/'), commands: fileCommands });
}
commands.sort((a, b) => a.path.localeCompare(b.path));
console.log(JSON.stringify(commands, null, 2));
