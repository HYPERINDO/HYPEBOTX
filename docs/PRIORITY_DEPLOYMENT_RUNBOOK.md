# Priority Features - Deployment & Runbook

## Pre-Deployment Checklist

### Code Review
- [ ] All 6 services implemented and tested
- [ ] Admin command functional
- [ ] No console errors on startup
- [ ] All dependencies installed (`npm install`)

### Configuration
- [ ] `.env` file updated with ALLOWED_GUILD_IDS
- [ ] Backup directories exist with write permissions
- [ ] Discord webhook URL configured for alerts
- [ ] Storage path has at least 500MB free space

### Database
- [ ] Database migrations run (`npm run migrate` if available)
- [ ] Backup of current database created
- [ ] Database connection tested

### Testing
- [ ] Guild whitelist tested (authorized & unauthorized servers)
- [ ] Backup creation and restore tested
- [ ] Health check endpoint responds (`/health`)
- [ ] Anti-spam detection tested
- [ ] Admin commands functional

### Infrastructure
- [ ] Monitoring port (3000) accessible
- [ ] Redis connection working (if enabled)
- [ ] Firewall rules allow incoming connections on monitoring port
- [ ] Enough memory for monitoring metrics
- [ ] Disk space monitored

### Logging
- [ ] Discord webhook accessible
- [ ] Console logs configured
- [ ] Log rotation enabled (if applicable)

---

## Deployment Steps

### Phase 1: Pre-Deployment Backup (Day -1)
```bash
# Create current state backup
/admin-priority backup-create

# Verify backup created
/admin-priority backup-list

# Test restore (optional, on test server)
/admin-priority backup-restore <backup_filename>
```

### Phase 2: Deploy Code (Day 0, Off-Peak Hours)

#### 1. Deploy services files
```bash
# Pull latest code
git pull origin main

# Install any new dependencies
npm install

# Copy new command
cp src/commands/admin-priority.js.new src/commands/admin-priority.js
```

#### 2. Verify app.js integration
```bash
# Check for syntax errors
node -c src/app.js

# Test startup in development
NODE_ENV=development npm run dev
```

#### 3. Update .env
```bash
# Backup current .env
cp .env .env.backup

# Add new variables
# (See .env.priority-features.example)
```

#### 4. Restart bot
```bash
# PM2 restart
pm2 restart hypebotx

# Or manual restart if not using PM2
# Kill current process and start new one
```

### Phase 3: Verification (First 30 minutes)
```bash
# Check health
/admin-priority health-check

# Check monitoring endpoint
curl http://localhost:3000/health

# Check logs for errors
pm2 logs hypebotx

# Test whitelist
# Try command in unauthorized server (should be blocked)
# Try command in authorized server (should work)
```

### Phase 4: Full Validation (First 24 hours)
```bash
# Monitor spam stats
/admin-priority spam-stats

# Check recovery status
/admin-priority recovery-status

# Verify no corrupted files found
/admin-priority recovery-scan

# Test backup operations
/admin-priority backup-create
/admin-priority backup-list
```

### Phase 5: Post-Deployment (Ongoing)

#### Daily Tasks
- [ ] Check health: `/admin-priority health-check`
- [ ] Review error logs
- [ ] Monitor metrics endpoint

#### Weekly Tasks
- [ ] Verify backup creation (should be automatic)
- [ ] Check spam statistics
- [ ] Review recovery status
- [ ] Monitor disk space usage

#### Monthly Tasks
- [ ] Test restore procedure (on test server)
- [ ] Review and optimize thresholds
- [ ] Archive old logs
- [ ] Update documentation

---

## Runbooks

### Runbook 1: Emergency Recovery

**Scenario:** Bot is crashing or behaving abnormally

**Steps:**
```bash
# 1. Check health status
/admin-priority health-check

# 2. Get recovery recommendations
# (Based on health check alerts)

# 3. If memory issue:
#    - Clear spam cache
/admin-priority spam-stats
# - Consider restarting bot during low traffic

# 4. If data corruption suspected:
/admin-priority recovery-scan

# 5. If recovery shows corrupted files:
# - Run automatic recovery (automatic via monitoring)
# - Or check latest backup
/admin-priority backup-list

# 6. If needed, restore from backup:
/admin-priority backup-restore <backup_filename>

# 7. Monitor for next 30 minutes after recovery
/admin-priority health-check
```

### Runbook 2: Backup Restoration

**Scenario:** Need to restore database from backup

**Steps:**
```bash
# 1. List available backups
/admin-priority backup-list

# 2. Choose latest backup (or specific one)
# Format: backup_YYYY-MM-DD-HHmmss.gz

# 3. Restore backup
/admin-priority backup-restore backup_2026-05-12-143022.gz

# 4. Verify restoration
/admin-priority health-check

# 5. Check system status
/admin-priority recovery-status

# 6. Monitor for errors in logs
pm2 logs hypebotx

# 7. If successful, document the restore
# If failed, try next most recent backup
```

### Runbook 3: Whitelist Management

**Scenario:** Need to add/remove authorized server

**Steps:**
```bash
# 1. Get server ID from user
# (Right-click server → Copy ID)

# 2. Add to whitelist
/admin-priority whitelist-add 123456789

# 3. Verify added
/admin-priority whitelist-list

# 4. Test in target server
# (Try a command in newly whitelisted server)

# 5. To remove later:
/admin-priority whitelist-remove 123456789

# 6. Verify removed
/admin-priority whitelist-list
```

### Runbook 4: Performance Optimization

**Scenario:** Bot running slow or using too much memory

**Steps:**
```bash
# 1. Check current metrics
/admin-priority health-check

# 2. If memory high (>80%):

#    Option A: Restart during low traffic (safest)
pm2 restart hypebotx

#    Option B: Check for memory leaks
#    - Review recent code changes
#    - Check for long-running operations
#    - Look at spam cache size

# 3. If CPU high (>80%):

#    Option A: Reduce monitoring interval
#    (Increase MONITORING_RECOVERY_INTERVAL in .env)

#    Option B: Check for infinite loops
#    - Review console for repeated errors
#    - Check command execution times

# 4. If error rate high (>10%):
#    - Check recent errors in logs
#    - Identify failing commands
#    - Fix or disable problematic commands

# 5. After optimization, verify:
/admin-priority health-check

# 6. Monitor for 1 hour
# (Check multiple times)
```

### Runbook 5: Spam Attack Response

**Scenario:** Users spamming messages, mentions, links

**Steps:**
```bash
# 1. Check spam statistics
/admin-priority spam-stats

# 2. Identify top violators
# (Shows users with most violations)

# 3. Manual timeout (if not automatic):
# - Use Discord moderation tools
# - Or create timeout command

# 4. If attack ongoing:
#    Option A: Lower spam thresholds temporarily
#    (Edit .env, ANTI_SPAM_MESSAGE_THRESHOLD)

#    Option B: Manually timeout repeat violators

# 5. After attack stops, restore thresholds:
pm2 restart hypebotx

# 6. Monitor spam stats for next 24 hours
/admin-priority spam-stats

# 7. Document incident:
# - When attack occurred
# - What type of spam
# - Who initiated
# - Actions taken
```

### Runbook 6: Database Migration

**Scenario:** Need to run database migrations

**Steps:**
```bash
# 1. Check current migration status
/admin-priority migration-status

# 2. Review pending migrations
# (Files in src/storage/migrations/)

# 3. Create backup before migration
/admin-priority backup-create

# 4. Run migrations
# (Auto-run at startup, or via migration service)
# - Migrations run before bot is operational
# - Pre-flight checks ensure safety

# 5. Verify migration success
/admin-priority migration-status

# 6. If migration failed:
#    Option A: Auto-rollback (if enabled)
#    Option B: Restore from backup
/admin-priority backup-restore <pre_migration_backup>

# 7. Review migration errors in logs
pm2 logs hypebotx

# 8. Fix issues and retry
```

### Runbook 7: Corruption Detection & Recovery

**Scenario:** JSON files corrupted or bot can't read storage

**Steps:**
```bash
# 1. Check recovery status
/admin-priority recovery-status

# 2. If corrupted files detected:

#    Option A: Auto-recovery (automatic via monitoring)
#    - Runs hourly
#    - Attempts repair first
#    - Falls back to restore
#    - Last resort: delete

# 3. Force manual scan:
/admin-priority recovery-scan

# 4. If recovery shows issues:
#    - Monitor logs for recovery process
#    - System will auto-attempt recovery
#    - Manual intervention needed only if auto-recovery fails

# 5. If auto-recovery fails:
#    Step A: Try backup restore
/admin-priority backup-restore <recent_backup>

#    Step B: If restore also fails
#    - Stop bot
#    - Manually inspect corrupted files
#    - Consider data loss

# 6. After recovery:
/admin-priority recovery-status

# 7. Monitor for recurrence
# (If recurring, investigate root cause)
```

---

## Monitoring Dashboard

### Health Check Output Interpretation

```
🏥 Bot Health: Healthy

Memory: 65%            ← OK (threshold: 80%)
CPU: 25%               ← OK (threshold: 80%)
Error Rate: 2.5%       ← OK (threshold: 10%)
Heartbeat: 5s ago      ← OK (threshold: 60s)
Discord: Connected     ← OK
Uptime: 48h

No Alerts              ← All systems nominal
```

### Alerts & Actions

| Alert | Severity | Action |
|-------|----------|--------|
| Memory >80% | Critical | Monitor, consider restart |
| CPU >80% | Warning | Check running processes |
| No Heartbeat >60s | Critical | Check bot status immediately |
| Discord Disconnected | Critical | Check network, restart if needed |
| Error Rate >10% | Warning | Review recent errors, fix issues |

---

## Performance Baseline

**Expected after deployment:**
- Memory: 150-200 MB
- CPU: <5% idle
- Error Rate: <1% under normal load
- Heartbeat: Always <1 second
- Backup Size: 1-5 MB (compressed)

---

## Rollback Plan

**If deployment causes critical issues:**

```bash
# 1. Immediate action: Restore previous bot version
git checkout HEAD~1

# 2. Stop current bot
pm2 stop hypebotx

# 3. Reinstall previous dependencies
rm -rf node_modules
npm install

# 4. Restore previous .env (if changed)
cp .env.backup .env

# 5. Start previous version
pm2 start hypebotx

# 6. Verify bot operational
/admin-priority health-check

# 7. Restore from backup if data was corrupted
/admin-priority backup-restore <pre_deployment_backup>
```

---

## Contact & Escalation

**For urgent issues:**
1. Check health: `/admin-priority health-check`
2. Review logs: `pm2 logs hypebotx`
3. Contact bot administrator
4. If data loss: Restore from backup

**For non-urgent issues:**
1. Document in issue tracker
2. Review `docs/PRIORITY_FEATURES_GUIDE.md`
3. Schedule fix during maintenance window

---

## Success Criteria

✅ All services initialized without errors
✅ Admin commands functional
✅ Health check shows "Healthy"
✅ No errors in logs
✅ Backups create automatically
✅ Whitelist enforces properly
✅ Anti-spam detects violations
✅ Monitoring endpoint responsive

---

## After Deployment

**Week 1:**
- Daily health checks
- Monitor all statistics
- Test admin commands
- Verify backup automation

**Month 1:**
- Weekly backup restoration test (on test server)
- Review logs for patterns
- Optimize thresholds if needed
- Document any issues

**Ongoing:**
- Monitor disk space
- Review and archive logs monthly
- Test recovery procedures quarterly
- Update documentation as needed
