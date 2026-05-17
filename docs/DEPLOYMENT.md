# Deployment

PM2:

```powershell
npm run pm2:start
```

Docker Compose:

```powershell
docker compose -f infra/compose/docker-compose.yml up -d --build
```

Services:

- `hypebotx-bot`
- `hypebotx-dashboard-backend`
- `hypebotx-dashboard-frontend`

Frontend production is built and served by Nginx. Backend and bot read secrets from backend/bot environment files or server environment variables.
