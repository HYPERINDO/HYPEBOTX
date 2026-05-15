const fs = require('fs');
const path = require('path');

// Read realtime audit
const auditPath = path.join(__dirname, '..', 'logs', 'realtime-server-audit.json');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

console.log('Duplicate Channels to Clean:');
audit.duplicateChannels.forEach(dup => {
    console.log(`Key: ${dup.key}, Count: ${dup.count}`);
    dup.items.forEach(item => {
        console.log(`  - ${item.name} (${item.type === 0 ? 'Text' : 'Voice'}) in ${item.parent}`);
    });
});

console.log('\nMissing Channels:');
audit.missingChannels.forEach(missing => {
    console.log(`  - ${missing}`);
});

// Note: Actual cleanup requires Discord API access, this is just analysis