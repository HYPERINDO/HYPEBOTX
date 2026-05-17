# HYPEBOTX Master Roadmap - Discord Commerce Platform

## Current Status

HYPEBOTX is in production-stabilization shape:

- Core ticket, order, verify, permission, logging, AI, and multi-server flow exist.
- Test coverage is already broad across unit, business, feature, security, runtime, and staging checks.
- The active focus is no longer random feature growth. The active focus is stability, monitoring, data safety, dashboard, VPS deployment, and scaling.

## Final Vision

Target: professional Discord commerce ecosystem.

HYPEBOTX should become:

- Commerce automation platform
- Discord business ecosystem
- Ticket management system
- Payment automation layer
- AI assistant support
- Multi-server architecture
- Owner/admin dashboard
- Semi-SaaS ready platform

## Final Architecture

```txt
CLIENT
  Discord User
  Staff Dashboard
  Owner Dashboard
  Mobile Browser
    |
API GATEWAY
  Auth API
  Order API
  Payment API
  Analytics API
  Config API
    |
CORE SERVICES
  Discord Bot Core
  Order Engine
  Ticket Engine
  Payment Engine
  AI Engine
  Analytics Engine
  Logging Engine
  Notification Engine
    |
QUEUE SYSTEM
  Redis
  BullMQ
  Workers
    |
DATABASE
  PostgreSQL
  Backup System
  Cache Layer
```

## Stage Plan

### Stage 1 - Manual Testing

- Run live Discord UAT for verify, order, payment, ticket, joki, stock, warranty, and admin panels.
- Record every failure as a reproducible test before fixing.
- Confirm new `/panel` driven flow is usable without relying on legacy slash commands.

### Stage 2 - Production Stabilization

- Fix all UAT bugs.
- Strengthen duplicate guards for order, ticket, payment, queue, delivery, and testimonial flows.
- Canonicalize payment/order/ticket states.
- Improve monitoring alerts and owner health views.
- Keep destructive actions behind reason + confirm gates.

### Stage 3 - Database Migration

- Keep JSON stable for local hosting.
- Formalize repository contracts before PostgreSQL.
- Add schema mapping for users, guilds, tickets, ticket messages, orders, order items, payments, payment logs, products, stock, staff, analytics, audit logs, transcripts, verify logs, security logs, AI logs, and system logs.

### Stage 4 - Dashboard MVP

- Owner dashboard: revenue, orders today, online staff, error alerts.
- Ticket dashboard: open tickets, pending tickets, resolution time.
- Order dashboard: pending, paid, processing, completed.
- Pricelist dashboard: add/edit package and promo package.

### Stage 5 - Queue + Redis

- Move heavy tasks into queues: transcript, backup, payment checking, analytics, AI processing, reminder, notifications.
- Add worker status and retry visibility.

### Stage 6 - Monitoring + Security

- Add heartbeat, CPU/RAM, Discord latency, database latency, error alerts, and owner notification.
- Prepare adapters for Sentry, Grafana, Prometheus, and Uptime Kuma.

### Stage 7 - VPS Deployment

- Ubuntu + Node.js + PostgreSQL + Redis + PM2 + Nginx + SSL.
- Deploy bot and dashboard separately.
- Enable scheduled backups and monitoring.

### Stage 8 - Multi-Server Scaling

- Harden guild-scoped config and data access.
- Add per-guild plans/config.
- Prepare semi-SaaS operations.

## Immediate Dev Priorities

1. Finish manual testing for all core flows.
2. Fix every UAT bug with regression tests.
3. Strengthen anti-duplicate order/ticket/payment guards.
4. Canonicalize payment states.
5. Clean up order/ticket database contracts.
6. Add monitoring/error visibility.
7. Build dashboard MVP.
8. Deploy to VPS.

## Rating Targets

```txt
Current: 8.3 / 10
Advanced Custom Business Bot

After stabilization: 8.8 / 10
Production Ready Commerce Bot

After dashboard + VPS + monitoring: 9.2 / 10
Professional Discord Business Platform

After scaling + AI automation: 9.5 / 10
Semi SaaS Discord Commerce Ecosystem
```

## Engineering Rule

Every roadmap item should land with at least one of:

- Regression test
- Manual UAT checklist item
- Monitoring signal
- Audit log
- Migration/rollback note

No high-risk action should bypass permission guard, reason capture, confirm button, and audit log.
