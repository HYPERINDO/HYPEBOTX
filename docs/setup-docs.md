# HYPEBOTX Setup Guide

## Quick Start

### Prerequisites
- Node.js 20.11.0 or higher
- npm (comes with Node.js)
- Git
- SQLite3 (for database)
- FFmpeg (for music features, optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hypebotx
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your bot credentials
   ```

4. **Initialize database**
   ```bash
   npm run seed:roles
   npm run seed:channels
   npm run seed:templates
   ```

5. **Deploy commands**
   ```bash
   npm run deploy
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

## Detailed Setup

### Discord Bot Setup

1. **Create Discord Application**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application"
   - Enter application name (e.g., "HYPEBOTX")

2. **Get Bot Token**
   - Go to "Bot" section
   - Click "Add Bot"
   - Copy the token under "Token"
   - Keep this token secure!

3. **Get Client ID**
   - Go to "General Information"
   - Copy "Application ID"

4. **Configure Bot Permissions**
   - Go to "Bot" section
   - Enable following permissions:
     - Send Messages
     - Use Slash Commands
     - Embed Links
     - Attach Files
     - Read Message History
     - Use Voice Activity
     - Manage Channels (for setup)
     - Manage Messages (for moderation)

5. **Generate Invite Link**
   - Go to "OAuth2" → "URL Generator"
   - Select "bot" scope
   - Select required permissions
   - Use generated URL to invite bot

### Environment Configuration

Create `.env` file with the following variables:

```bash
# Discord Configuration
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
GUILD_ID=your_server_id_here

# Database Configuration
DATABASE_TYPE=sqlite
DATABASE_PATH=./storage/database.db

# Optional: Redis for caching
REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379

# Optional: OpenAI for AI features
OPENAI_API_KEY=your_openai_key_here
CHATBOT_MODE=rule_based

# Logging
LOG_LEVEL=info
LOG_WEBHOOK_URL=https://discord.com/api/webhooks/... (optional)

# Dashboard
OWNER_DASHBOARD_PORT=8787
OWNER_DASHBOARD_HOST=127.0.0.1

# Security
ALLOWED_GUILDS=guild_id_1,guild_id_2
```

### Guild Setup

1. **Invite Bot to Server**
   - Use the generated invite link
   - Grant necessary permissions

2. **Run Initial Setup**
   ```bash
   /setup basic
   /setup roles
   /setup gamestore
   ```

3. **Configure Permissions**
   - Set up staff roles
   - Configure channel permissions
   - Set up voice channels for music

### Database Setup

#### SQLite (Default)
No additional setup required. Database file will be created automatically.

#### PostgreSQL (Production)
1. Install PostgreSQL
2. Create database and user:
   ```sql
   CREATE DATABASE hypebotx;
   CREATE USER hypebotx WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE hypebotx TO hypebotx;
   ```

3. Update `.env`:
   ```bash
   DATABASE_TYPE=postgres
   POSTGRES_URL=postgresql://hypebotx:password@localhost:5432/hypebotx
   ```

### Redis Setup (Optional)

For improved performance and caching:

1. Install Redis
2. Start Redis server
3. Update `.env`:
   ```bash
   REDIS_ENABLED=true
   REDIS_URL=redis://localhost:6379
   ```

### Music Features Setup

For music functionality:

1. Install FFmpeg
   ```bash
   # Windows (Chocolatey)
   choco install ffmpeg

   # macOS (Homebrew)
   brew install ffmpeg

   # Linux
   sudo apt install ffmpeg
   ```

2. Verify installation:
   ```bash
   ffmpeg -version
   ```

## Docker Setup

### Using Docker Compose

1. **Build and run**
   ```bash
   docker-compose up -d
   ```

2. **Check logs**
   ```bash
   docker-compose logs -f hypebotx
   ```

3. **Stop services**
   ```bash
   docker-compose down
   ```

### Docker Environment Variables

For Docker deployment, use these additional variables:

```bash
# Docker-specific
NODE_ENV=production
CACHE_PROVIDER=memory
BULL_ENABLED=false
```

## PM2 Setup

For production process management:

1. **Install PM2 globally**
   ```bash
   npm install -g pm2
   ```

2. **Start with PM2**
   ```bash
   npm run pm2:start
   ```

3. **Monitor processes**
   ```bash
   npm run pm2:logs
   ```

4. **Stop processes**
   ```bash
   npm run pm2:stop
   ```

## Verification

After setup, verify everything works:

1. **Check bot status**
   ```bash
   /ping
   ```

2. **Run health check**
   ```bash
   /admin-priority health-check
   ```

3. **Test basic commands**
   ```bash
   /help
   /setup verify
   ```

4. **Check dashboard**
   - Open `http://localhost:8787`
   - Verify health endpoint: `http://localhost:8787/health`

## Troubleshooting Setup Issues

### Bot Not Starting

**Check token validity:**
```bash
# Test token format (should be ~59 characters)
echo $DISCORD_TOKEN | wc -c
```

**Check Node.js version:**
```bash
node --version  # Should be 20.11.0+
```

**Check logs:**
```bash
npm run pm2:logs  # If using PM2
# Or check console output
```

### Database Connection Issues

**SQLite:**
- Check file permissions on `./storage/`
- Ensure write access

**PostgreSQL:**
- Verify connection string
- Check PostgreSQL service status
- Test connection manually

### Command Registration Issues

**Check client ID:**
```bash
# Should match Discord application ID
echo $CLIENT_ID
```

**Check guild ID:**
```bash
# Right-click server → Copy ID (requires Developer Mode)
echo $GUILD_ID
```

**Redeploy commands:**
```bash
npm run refresh-commands
```

### Permission Issues

**Bot permissions:**
- Ensure bot has required permissions in server settings
- Check channel-specific permissions

**User permissions:**
- Verify user has necessary roles
- Check command-specific requirements

## Production Deployment

### Pre-deployment Checklist

- [ ] Environment variables configured
- [ ] Database initialized
- [ ] Commands deployed
- [ ] Permissions configured
- [ ] Health checks passing
- [ ] Backup system tested
- [ ] Monitoring configured

### Deployment Steps

1. **Prepare production environment**
2. **Run deployment script**
   ```bash
   ./scripts/deploy-production.sh
   ```
3. **Verify deployment**
4. **Configure monitoring**
5. **Set up backups**

### Post-deployment

1. **Monitor logs**
2. **Check health endpoints**
3. **Test critical features**
4. **Configure alerts**
5. **Document procedures**

## Security Considerations

### Token Security
- Never commit tokens to version control
- Use environment variables
- Rotate tokens regularly
- Limit token permissions

### Server Access
- Configure guild whitelist
- Use private channels for sensitive operations
- Implement rate limiting
- Monitor for abuse

### Data Protection
- Encrypt sensitive data
- Regular backups
- Secure database access
- Log access patterns

## Support

If you encounter issues:

1. Check the [troubleshooting guide](troubleshooting.md)
2. Review [logs](#logs)
3. Check [GitHub issues](https://github.com/your-repo/issues)
4. Contact support team

## Next Steps

After successful setup:

1. Configure your specific use case
2. Set up monitoring and alerts
3. Train staff on usage
4. Plan regular maintenance
5. Consider scaling requirements