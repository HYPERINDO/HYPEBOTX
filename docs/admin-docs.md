# HYPEBOTX Admin Documentation

## Overview
HYPEBOTX is a comprehensive Discord bot system designed for gaming communities, providing order management, payment processing, ticketing, and administrative features.

## Architecture

### Core Components
- **Bot Core**: Discord.js based bot with command and event handling
- **Database Layer**: SQLite/PostgreSQL with migration support
- **Service Layer**: Modular services for different functionalities
- **API Layer**: REST API for dashboard and integrations
- **Monitoring**: Health checks, metrics, and alerting

### Key Services
- `guildWhitelistService`: Server access control
- `rateLimitService`: Request throttling
- `crashDetectionService`: Health monitoring and alerts
- `backupService`: Data backup and recovery
- `analyticsService`: Business intelligence

## Administration Commands

### Server Management
```
/admin-priority whitelist-add guild_id:123456789
/admin-priority whitelist-remove guild_id:123456789
/admin-priority whitelist-list
```

### System Health
```
/admin-priority health-check
/admin-priority recovery-status
/admin-priority migration-status
```

### Backup Management
```
/admin-priority backup-create
/admin-priority backup-list
/admin-priority backup-restore backup_id:backup_2024
```

### User Management
```
/admin customer-set user:@user role:booster
/admin customer-profile user:@user
/admin dispute ticket:123 reason:payment_issue
```

### Analytics
```
/admin analytics orders
/admin analytics payments
/admin analytics tickets
```

## Dashboard Access

### Owner Dashboard
- URL: `http://localhost:8787` (configurable)
- Features:
  - Real-time monitoring
  - Service health status
  - Backup management
  - Configuration editor
  - Audit logs viewer

### Health Endpoints
- `/health`: Basic health check
- `/metrics`: Detailed metrics
- `/status`: Service status overview

## Configuration

### Environment Variables
```bash
# Discord
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
GUILD_ID=your_guild_id

# Database
DATABASE_TYPE=sqlite|postgres
DATABASE_PATH=./storage/database.db
POSTGRES_URL=postgresql://user:pass@localhost:5432/db

# Redis (optional)
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379

# Monitoring
OWNER_DASHBOARD_PORT=8787
LOG_LEVEL=info
```

### Guild Whitelist
Configure allowed servers in `botConfig.allowedGuildIds` or via commands.

## Monitoring & Alerting

### Health Checks
- Memory usage monitoring
- CPU usage monitoring
- Error rate tracking
- Discord connection status
- Database connectivity

### Alert Types
- **Critical**: Memory > 80%, No Discord connection, Database issues
- **Warning**: CPU > 80%, Error rate > 10%, High heartbeat latency

### Log Files
- `logs/out.log`: General logs
- `logs/err.log`: Error logs
- `logs/combined.log`: All logs

## Backup & Recovery

### Automated Backups
- Daily backups at 02:00
- Backup retention: 30 days
- Storage: `./backups/`

### Manual Backup
```bash
npm run backup:create
```

### Recovery Process
1. Stop the bot
2. Restore database from backup
3. Restart services
4. Verify data integrity

### JSON Corruption Recovery
- Automatic detection of corrupted JSON files
- Backup restoration on corruption
- Alert generation for manual review

## Security Features

### Rate Limiting
- Global: 100 requests/minute
- Command: 10 commands/minute per user
- AI: 50 requests/hour per user

### Access Control
- Guild whitelist enforcement
- Role-based permissions
- Command cooldowns

### Anti-Spam
- Message filtering
- User behavior monitoring
- Automatic moderation actions

## Troubleshooting

### Common Issues

#### Bot Not Responding
1. Check Discord connection: `/health-check`
2. Verify token validity
3. Check rate limits
4. Review error logs

#### Database Issues
1. Check database file permissions
2. Verify SQLite/PostgreSQL connectivity
3. Run migration status: `/migration-status`
4. Restore from backup if needed

#### High Memory Usage
1. Check memory metrics: `/health`
2. Review active services
3. Restart if memory > 90%
4. Investigate memory leaks

#### Command Failures
1. Check permission matrix
2. Verify user roles
3. Review command logs
4. Test in different channels

### Emergency Procedures

#### Complete System Failure
1. Stop all services: `docker-compose down`
2. Restore from latest backup
3. Start services: `docker-compose up -d`
4. Verify functionality
5. Notify stakeholders

#### Data Corruption
1. Isolate affected services
2. Restore from clean backup
3. Run data integrity checks
4. Reconcile missing data if possible

## Performance Optimization

### Database
- Use PostgreSQL for high-traffic deployments
- Enable connection pooling
- Regular VACUUM operations

### Caching
- Redis for session data
- In-memory cache for frequent queries
- CDN for static assets

### Monitoring
- Set up alerts for key metrics
- Regular log rotation
- Performance profiling

## Scaling Considerations

### Horizontal Scaling
- Multiple bot instances with Redis coordination
- Database read replicas
- Load balancer for API endpoints

### Vertical Scaling
- Increase memory/CPU based on metrics
- Database optimization
- CDN integration

## Compliance & Security

### Data Protection
- Encrypted sensitive data storage
- Regular security audits
- Access logging and monitoring

### GDPR Compliance
- Data retention policies
- User data export capabilities
- Right to erasure implementation

## Support & Maintenance

### Regular Tasks
- Daily: Monitor health metrics
- Weekly: Review error logs
- Monthly: Security updates, backup verification
- Quarterly: Performance audits, capacity planning

### Contact Information
- Technical Support: [support@hypebotx.com]
- Emergency: [emergency@hypebotx.com]
- Documentation: [docs.hypebotx.com]