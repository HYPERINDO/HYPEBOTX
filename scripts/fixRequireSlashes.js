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

for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes("require(\"..") && !content.includes("require('..")) continue;
    const fixed = content.replace(/require\((['"])\.\.\\+([^"')]+)\1\)/g, (m, q, rest) => {
        const newPath = '../' + rest.replace(/\\\\/g, '/').replace(/\\/g, '/');
        return `require(${q}${newPath}${q})`;
    }).replace(/require\((['"])\.\.\/([^"')]+)\\([^"')]+)\1\)/g, (m) => m); // noop

    if (fixed !== content) {
        fs.writeFileSync(filePath, fixed, 'utf8');
        console.log('Fixed requires in', path.relative(projectRoot, filePath));
    }
}

console.log('Done');
