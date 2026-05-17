# HYPEBOTX Dashboard Spec

The dashboard is split into `apps/dashboard-frontend` and `apps/dashboard-backend`.

- Frontend: React UI only. It never stores Discord tokens, database URLs, payment secrets, or bot internal API keys.
- Backend: Express API, Discord OAuth, session cookie, role checks, shared storage access, and audit logging.
- Roles: `owner`, `admin`, `penjoki`.
- Protected routes call `/api/auth/me` with credentials included.
