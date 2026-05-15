const fs = require('fs');
const path = require('path');
const glob = require('glob');
const root = path.join(__dirname, '..', 'src', 'commands');
const files = glob.sync('**/*.js', { cwd: root, absolute: true });
files.sort();
const out = [];
for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const nameMatches = [...content.matchAll(/\.setName\((?:'|")(.+?)(?:'|")\)/g)];
    const descMatches = [...content.matchAll(/\.setDescription\((?:'|")(.+?)(?:'|")\)/g)];
    const rel = path.relative(root, file).replace(/\\/g, '/');
    out.push(`FILE: ${rel}`);
    for (let i = 0; i < nameMatches.length; i++) {
        out.push(`  ${nameMatches[i][1]} => ${descMatches[i] ? descMatches[i][1] : ''}`);
    }
    out.push('');
}
fs.writeFileSync(path.join(__dirname, 'commands-flat.txt'), out.join('\n'), 'utf8');
console.log('Written', out.length, 'lines');
