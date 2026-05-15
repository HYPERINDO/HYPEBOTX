const { createJokiRepository } = require('./src/repositories/jokiRepository');
function createMemoryDatabase() {
    const state = { jokiQueues: {} };
    const clone = v => JSON.parse(JSON.stringify(v));
    return {
        async read(fileKey, fallback = null) {
            if (!Object.prototype.hasOwnProperty.call(state, fileKey)) return clone(fallback);
            return clone(state[fileKey]);
        },
        async write(fileKey, payload) {
            state[fileKey] = clone(payload);
            return clone(payload);
        }
    };
}
(async () => {
    const oldAutoPromote = process.env.JOKI_AUTO_PROMOTE;
    process.env.JOKI_AUTO_PROMOTE = 'true';
    const database = createMemoryDatabase();
    const repo = createJokiRepository({ database, logger: console });
    await repo.addToQueue('guild-auto', { userId: 'u1', ticketId: '0001', estimatedSeconds: 1 });
    await repo.addToQueue('guild-auto', { userId: 'u2', ticketId: '0002', estimatedSeconds: 300 });
    await repo.ensureActive('guild-auto');
    const store = await database.read('jokiQueues', {});
    store['guild-auto'].orders[0].status = 'processing';
    store['guild-auto'].orders[0].startedAt = new Date(Date.now() - 5000).toISOString();
    store['guild-auto'].orders[1].status = 'queued';
    await database.write('jokiQueues', store);
    const tick = await repo.runAutomationTick('guild-auto');
    const queue = await repo.getQueue('guild-auto');
    console.log('tick', JSON.stringify(tick, null, 2));
    console.log('queue', JSON.stringify(queue, null, 2));
    process.env.JOKI_AUTO_PROMOTE = oldAutoPromote;
})().catch(err => { console.error(err); process.exit(1); });
