# HYPEBOTX Recovery Documentation

## Overview

This document outlines recovery procedures for HYPEBOTX system failures, data corruption, and emergency situations. The system includes multiple recovery mechanisms to ensure business continuity.

## Recovery Architecture

### Automatic Recovery Systems
- **Crash Detection Service**: Monitors health and triggers alerts
- **JSON Recovery Service**: Detects and repairs corrupted JSON files
- **Auto-backup System**: Scheduled backups with retention policies
- **Migration System**: Database schema migrations with rollback

### Manual Recovery Tools
- **Backup Restore Commands**: Administrative commands for data restoration
- **Rollback Scripts**: Automated rollback procedures
- **Migration Tools**: Database migration management

## Health Monitoring

### Health Check Endpoints
- `GET /health`: Basic health status
- `GET /health.json`: Detailed health metrics
- `GET /metrics`: Performance metrics

### Health Metrics Monitored
- Memory usage (>80% triggers warning)
- CPU usage (>80% triggers warning)
- Error rate (>10% triggers warning)
- Discord connection status
- Database connectivity
- Service availability

### Alert System
Alerts are sent to Discord when:
- Critical health thresholds exceeded
- Services become unavailable
- Data corruption detected
- Backup failures occur

## Data Recovery

### Automatic JSON Recovery

The system automatically detects and recovers from JSON corruption:

1. **Detection**: File integrity checks on read operations
2. **Backup Creation**: Corrupted files are backed up before repair
3. **Recovery**: Data restored from last known good backup
4. **Alert**: Administrators notified of recovery action

**Files Protected:**
- `storage/orders/*.json`
- `storage/tickets/*.json`
- `storage/payments/*.json`
- Configuration files

### Database Recovery

#### SQLite Recovery
```bash
# Stop the bot
npm run pm2:stop

# Backup current database
cp storage/database.db storage/database.db.backup

# Restore from backup
cp backups/latest/database.db storage/database.db

# Restart bot
npm run pm2:start
```

#### PostgreSQL Recovery
```bash
# Stop the bot
npm run pm2:stop

# Restore from backup
pg_restore -d hypebotx backups/latest/postgres.dump

# Restart bot
npm run pm2:start
```

### Backup System

#### Automated Backups
- **Frequency**: Daily at 02:00
- **Retention**: 30 days
- **Location**: `./backups/`
- **Content**: Database, configurations, logs

#### Manual Backups
```bash
# Create backup
/admin-priority backup-create

# List backups
/admin-priority backup-list

# Restore backup
/admin-priority backup-restore backup_id:backup_2024_01_01
```

#### Backup Verification
```bash
# Check backup integrity
node scripts/verify-backup.js backup_file

# Test restore procedure
node scripts/test-restore.js backup_file
```

## Service Recovery

### Bot Process Recovery

#### PM2 Auto-recovery
PM2 automatically restarts crashed processes:
```bash
# Check process status
npm run pm2:status

# View logs
npm run pm2:logs

# Manual restart
npm run pm2:restart
```

#### Docker Recovery
```bash
# Check container status
docker-compose ps

# Restart services
docker-compose restart

# View logs
docker-compose logs hypebotx
```

### Database Service Recovery

#### SQLite
SQLite databases are file-based and recover automatically on restart.

#### PostgreSQL
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check connectivity
psql -d hypebotx -c "SELECT 1;"
```

### Redis Recovery
```bash
# Check Redis status
redis-cli ping

# Restart Redis
sudo systemctl restart redis

# Clear cache if needed
redis-cli FLUSHALL
```

## Emergency Procedures

### Complete System Failure

#### Immediate Actions
1. **Stop all services**
   ```bash
   docker-compose down
   # or
   npm run pm2:stop
   ```

2. **Assess damage**
   - Check log files for error details
   - Verify data integrity
   - Identify failure point

3. **Create emergency backup**
   ```bash
   ./scripts/emergency-backup.sh
   ```

#### Recovery Steps
1. **Restore from backup**
   ```bash
   ./scripts/rollback.sh
   ```

2. **Verify system integrity**
   ```bash
   npm run qa:all
   ```

3. **Gradual service restart**
   ```bash
   # Start core services first
   docker-compose up -d postgres redis

   # Then start bot
   docker-compose up -d hypebotx
   ```

4. **Monitor recovery**
   - Check health endpoints
   - Monitor error logs
   - Verify functionality

### Data Corruption Recovery

#### JSON File Corruption
1. **Identify corrupted files**
   ```bash
   find storage/ -name "*.json" -exec node scripts/check-json.js {} \;
   ```

2. **Automatic recovery** (usually handled by JSON recovery service)

3. **Manual recovery if needed**
   ```bash
   # Restore from backup
   cp backups/latest/storage/orders.json storage/orders/
   ```

#### Database Corruption
1. **Stop database access**
2. **Restore from backup**
3. **Run integrity checks**
   ```sql
   -- SQLite
   PRAGMA integrity_check;

   -- PostgreSQL
   SELECT * FROM pg_stat_database WHERE datname = 'hypebotx';
   ```

### Network Issues

#### Discord Connection Loss
- System automatically retries connection
- Monitor `/health` endpoint for connection status
- Manual intervention only if persistent

#### Database Connection Loss
```bash
# Check network connectivity
ping database_host

# Restart connection pool
docker-compose restart hypebotx

# Check database logs
docker-compose logs postgres
```

## Rollback Procedures

### Automated Rollback
```bash
# Interactive rollback
./scripts/rollback.sh

# Quick rollback to previous version
./scripts/rollback.sh --auto
```

### Manual Rollback Steps
1. **Create current state backup**
2. **Stop services**
3. **Restore previous version**
4. **Migrate data if needed**
5. **Start services**
6. **Verify functionality**

### Rollback Validation
- Run health checks
- Execute test suite
- Verify data integrity
- Check service functionality

## Migration Recovery

### Failed Migration Recovery
```bash
# Check migration status
/admin-priority migration-status

# Rollback migration
node scripts/migrate.js down migration_name

# Retry migration
node scripts/migrate.js up migration_name
```

### Database Migration Issues
1. **Backup database**
2. **Identify failed migration**
3. **Manual data migration if needed**
4. **Update migration status**
5. **Continue with next migrations**

## Monitoring Recovery

### Alert System Recovery
- Alerts sent to Discord webhooks
- Email notifications (if configured)
- SMS alerts for critical issues

### Monitoring Dashboard Recovery
```bash
# Restart dashboard
docker-compose restart hypebotx

# Check dashboard health
curl http://localhost:8787/health
```

## Testing Recovery Procedures

### Recovery Testing Checklist
- [ ] Backup creation and restoration
- [ ] Service restart procedures
- [ ] Data integrity verification
- [ ] Failover testing
- [ ] Rollback procedures

### Regular Testing
```bash
# Monthly recovery testing
npm run test:recovery

# Quarterly failover testing
npm run test:failover
```

## Prevention Measures

### Proactive Monitoring
- Set up alerts for early warning signs
- Regular health checks
- Performance monitoring
- Capacity planning

### Backup Strategy
- Multiple backup locations
- Offsite backups
- Encrypted backups
- Regular backup testing

### Maintenance Procedures
- Regular system updates
- Database maintenance
- Log rotation
- Security patches

## Communication Plan

### Internal Communication
- Development team notification
- Operations team alert
- Management notification

### External Communication
- User status page updates
- Social media updates
- Customer notifications

### Escalation Procedures
1. **Level 1**: Automatic alerts
2. **Level 2**: On-call engineer notification
3. **Level 3**: Full team mobilization
4. **Level 4**: Management and customer notification

## Documentation Updates

### Post-Incident Review
- Document incident details
- Identify root cause
- Update recovery procedures
- Implement preventive measures

### Continuous Improvement
- Regular procedure reviews
- Tool and process updates
- Training updates
- Documentation maintenance

## Contact Information

### Emergency Contacts
- **Primary**: [emergency@hypebotx.com]
- **Secondary**: [backup@hypebotx.com]
- **On-call**: Check status page or monitoring alerts

### Support Resources
- **Documentation**: [docs.hypebotx.com/recovery]
- **Runbooks**: [runbooks.hypebotx.com]
- **Status Page**: [status.hypebotx.com]

## Appendix

### Recovery Scripts Location
- `./scripts/rollback.sh`: Automated rollback
- `./scripts/emergency-backup.sh`: Emergency backup
- `./scripts/verify-backup.js`: Backup verification
- `./scripts/test-restore.js`: Restore testing

### Log Locations
- Application logs: `./logs/`
- PM2 logs: `~/.pm2/logs/`
- Docker logs: `docker-compose logs`
- System logs: `/var/log/`

### Backup Locations
- Daily backups: `./backups/daily/`
- Manual backups: `./backups/manual/`
- Emergency backups: `./backups/emergency/`