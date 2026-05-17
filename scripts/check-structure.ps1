$ErrorActionPreference = "Stop"

$required = @(
  "apps/bot/src",
  "apps/bot/tests",
  "apps/dashboard-frontend/src/app",
  "apps/dashboard-frontend/src/pages",
  "apps/dashboard-backend/src/routes",
  "apps/dashboard-backend/src/server.js",
  "packages/shared/src/constants/roles.js",
  "packages/shared/src/permissions/permissionMatrix.js",
  "packages/config",
  "infra/docker/Dockerfile.bot",
  "infra/docker/Dockerfile.dashboard-backend",
  "infra/docker/Dockerfile.dashboard-frontend",
  "infra/pm2/ecosystem.config.js",
  "infra/compose/docker-compose.yml",
  "infra/nginx/dashboard.conf"
)

$missing = @()
foreach ($path in $required) {
  if (-not (Test-Path $path)) {
    $missing += $path
  }
}

if ($missing.Count -gt 0) {
  Write-Error ("Missing required paths:`n" + ($missing -join "`n"))
}

Write-Host "HYPEBOTX monorepo structure OK"
