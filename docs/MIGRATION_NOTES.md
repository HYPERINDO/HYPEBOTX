# Migration Notes

This branch migrates HYPEBOTX from a single root bot project into a professional monorepo:

- Bot source moved to `apps/bot`.
- Dashboard backend added in `apps/dashboard-backend`.
- Dashboard frontend added in `apps/dashboard-frontend`.
- Shared roles, status constants, permissions, and helpers added in `packages/shared`.
- PM2, Docker, Compose, and Nginx moved into `infra`.
- Root package scripts now orchestrate workspaces.

Local `.env` files remain ignored. Do not commit real secrets.
