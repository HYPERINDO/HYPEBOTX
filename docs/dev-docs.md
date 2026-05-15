# HYPEBOTX Developer Documentation

## Getting Started

### Prerequisites
- Node.js 20.11.0+
- npm or yarn
- SQLite3 or PostgreSQL
- Redis (optional)
- FFmpeg (for music features)

### Installation
```bash
git clone <repository-url>
cd hypebotx
npm install
```

### Configuration
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Development Setup
```bash
npm run dev  # Watch mode
npm test     # Run tests
npm run qa:all  # Run full QA suite
```

## Architecture Overview

### Directory Structure
```
src/
├── app.js              # Main application setup
├── index.js            # Entry point
├── config/             # Configuration files
├── commands/           # Discord commands
├── components/         # Discord UI components
├── database/           # Database connection and schemas
├── events/             # Discord event handlers
├── handlers/           # Command and interaction handlers
├── middlewares/        # Request processing middlewares
├── repositories/       # Data access layer
├── services/           # Business logic services
├── jobs/               # Scheduled jobs
├── utils/              # Utility functions
└── templates/          # Message and embed templates
```

### Core Concepts

#### Services Architecture
HYPEBOTX uses a modular service architecture where each service handles a specific domain:

```javascript
// Service creation pattern
function createMyService({ botConfig, logger, repositories }) {
    // Service implementation
    return {
        method1: () => { /* ... */ },
        method2: () => { /* ... */ }
    };
}
```

#### Repository Pattern
Data access is abstracted through repositories:

```javascript
// Repository interface
const myRepository = {
    create: async (data) => { /* ... */ },
    getById: async (id) => { /* ... */ },
    update: async (id, data) => { /* ... */ },
    delete: async (id) => { /* ... */ }
};
```

#### Middleware System
Request processing uses middleware chain:

```javascript
// Middleware pattern
async function myMiddleware(interaction, next) {
    // Pre-processing
    if (shouldBlock) {
        return; // Block request
    }

    await next(); // Continue to next middleware
}
```

## Development Workflow

### Creating a New Command
1. Create command file in `src/commands/`
2. Implement SlashCommandBuilder
3. Add permission checks
4. Register in command loader

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mycommand')
        .setDescription('My command description')
        .addStringOption(option =>
            option.setName('param')
                .setDescription('Parameter description')
                .setRequired(true)
        ),

    async execute(interaction) {
        const param = interaction.options.getString('param');
        // Command logic
        await interaction.reply('Response');
    }
};
```

### Adding a New Service
1. Create service file in `src/services/`
2. Implement service interface
3. Register in `src/app.js`
4. Add to container

```javascript
function createMyService({ logger, repositories }) {
    async function doSomething() {
        // Service logic
    }

    return {
        doSomething
    };
}

// In app.js
services.myService = createMyService({
    logger,
    repositories
});
```

### Database Operations
HYPEBOTX supports both SQLite and PostgreSQL:

```javascript
// Repository pattern
async function createItem(data) {
    const id = generateId();
    await database.run(
        'INSERT INTO items (id, data) VALUES (?, ?)',
        [id, JSON.stringify(data)]
    );
    return id;
}
```

### Testing
Use Node.js built-in test runner:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

test('my feature', async () => {
    // Test logic
    assert.equal(result, expected);
});
```

## API Reference

### Core Services

#### Logger
```javascript
const logger = createLogger('service-name');
logger.info('Message', { metadata });
logger.error('Error', error);
```

#### Database
```javascript
const db = createDatabase(config);
// SQLite operations
await db.run('INSERT INTO table VALUES (?, ?)', [param1, param2]);
const rows = await db.all('SELECT * FROM table');

// Migration support
await migrationService.createMigration('add_new_table');
```

#### Cache Service
```javascript
const cache = createCacheService(config);
await cache.set('key', 'value', 3600); // 1 hour TTL
const value = await cache.get('key');
```

#### Rate Limit Service
```javascript
const rateLimit = createRateLimitService(config, cache, logger);
const result = await rateLimit.checkInteraction(interaction);
if (!result.allowed) {
    // Handle rate limit exceeded
}
```

### Discord.js Extensions

#### Custom Embeds
```javascript
const { createEmbed } = require('./utils/embed');
const embed = createEmbed({
    title: 'Title',
    description: 'Description',
    color: 0x00ff00,
    fields: [
        { name: 'Field', value: 'Value', inline: true }
    ]
});
```

#### Button Components
```javascript
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const row = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('button_id')
            .setLabel('Click me')
            .setStyle(ButtonStyle.Primary)
    );
```

## Configuration

### Bot Configuration
Located in `src/config/bot.js`:

```javascript
module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    allowedGuildIds: process.env.ALLOWED_GUILDS?.split(',') || [],
    paths: {
        storage: './storage',
        logs: './logs',
        backups: './backups'
    },
    rateLimit: {
        global: { max: 100, windowMs: 60000 },
        command: { max: 10, windowMs: 60000 }
    }
};
```

### Environment Variables
```bash
# Required
DISCORD_TOKEN=your_token
CLIENT_ID=your_client_id

# Optional
DATABASE_TYPE=sqlite
REDIS_ENABLED=true
LOG_LEVEL=info
OWNER_DASHBOARD_PORT=8787
```

## Testing Strategy

### Unit Tests
Test individual functions and services:

```javascript
test('service method', async () => {
    const service = createMyService({ /* deps */ });
    const result = await service.method();
    assert.equal(result, expected);
});
```

### Integration Tests
Test service interactions:

```javascript
test('service integration', async () => {
    const { database } = createTestDatabase();
    const repositories = createAllRepositories(database);
    const service = createMyService({ repositories });

    // Test full workflow
});
```

### QA Tests
Heavy testing for production scenarios:

```javascript
test('production scenario', async () => {
    // Complex multi-step test
    // Race condition testing
    // Load testing
});
```

## Deployment

### Docker Deployment
```bash
docker-compose build
docker-compose up -d
```

### PM2 Deployment
```bash
npm run pm2:start
npm run pm2:logs
```

### CI/CD
GitHub Actions workflow includes:
- Automated testing
- Security scanning
- Docker building
- Deployment to staging/production

## Monitoring & Debugging

### Logging
Structured logging with Winston:

```javascript
logger.info('Operation completed', {
    userId: '123',
    guildId: '456',
    duration: 150
});
```

### Health Checks
```javascript
const health = await crashDetectionService.checkBotHealth();
console.log('Memory usage:', health.checks.memory.value);
```

### Debugging
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Check service status
curl http://localhost:8787/health

# View logs
npm run pm2:logs
```

## Performance Optimization

### Database Optimization
- Use indexes on frequently queried columns
- Implement connection pooling
- Regular maintenance (VACUUM, REINDEX)

### Caching Strategy
- Cache frequently accessed data
- Use Redis for distributed caching
- Implement cache invalidation

### Memory Management
- Monitor memory usage
- Implement garbage collection hints
- Use streaming for large data processing

## Security Considerations

### Input Validation
```javascript
const { param } = interaction.options.getString('param');
// Validate input
if (!isValidParam(param)) {
    return interaction.reply('Invalid parameter');
}
```

### Permission Checks
```javascript
const member = interaction.member;
if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply('Insufficient permissions');
}
```

### Rate Limiting
Automatic rate limiting on all interactions:

```javascript
const rateLimit = await rateLimitService.checkInteraction(interaction);
if (!rateLimit.allowed) {
    return interaction.reply({
        content: `Rate limited. Try again in ${rateLimit.remaining} seconds.`,
        ephemeral: true
    });
}
```

## Contributing

### Code Style
- Use ESLint configuration
- Follow existing patterns
- Add tests for new features
- Update documentation

### Pull Request Process
1. Create feature branch
2. Implement changes
3. Add tests
4. Update documentation
5. Create PR with description
6. Code review and approval
7. Merge to main

### Release Process
1. Update version in package.json
2. Update changelog
3. Create git tag
4. Deploy to staging
5. QA validation
6. Deploy to production

## Troubleshooting

### Common Development Issues

#### Module Not Found
```bash
rm -rf node_modules package-lock.json
npm install
```

#### Database Connection Issues
- Check database file permissions
- Verify connection string
- Check database server status

#### Discord API Errors
- Verify bot token
- Check bot permissions
- Review Discord.js documentation

#### Test Failures
```bash
# Run specific test
npm test -- --grep "test name"

# Debug test
npm test -- --inspect
```

## Resources

### Documentation Links
- [Discord.js Guide](https://discordjs.guide/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

### Community
- GitHub Issues for bug reports
- Discord server for discussions
- Email for security issues

### Tools
- VS Code with Discord.js extensions
- Postman for API testing
- Docker Desktop for container development
- Redis Insight for cache debugging