<#
Deploy script for staging environment.
Run this on the staging host (PowerShell) where PM2 and repo are available.

Usage: Open PowerShell in repo root and run as a user with proper permissions:
    .\scripts\deploy_staging.ps1 -Branch main -RunTests

This script will:
 - fetch & checkout branch
 - install deps (`npm ci`)
 - run optional seeds/migrations (best-effort)
 - restart PM2 processes from `infra/pm2/ecosystem.config.js`
 - run `npm run qa:all` and save logs

#>

param(
    [string]$Branch = "main",
    [switch]$RunTests = $true,
    [switch]$RunSeeds = $false
)

Write-Host "Deploying branch: $Branch" -ForegroundColor Cyan

if (-not (Test-Path .git)) {
    Write-Error "Not a git repo. Run this from repository root."; exit 2
}

git fetch origin
git checkout $Branch
git pull --ff-only origin $Branch

Write-Host "Installing dependencies (npm ci)" -ForegroundColor Green
npm ci --no-audit --no-fund

if ($RunSeeds) {
    Write-Host "Running seed scripts (best-effort)" -ForegroundColor Yellow
    if (Test-Path scripts/seedTemplates.js) { node scripts/seedTemplates.js } 
    if (Test-Path scripts/seedRoles.js) { node scripts/seedRoles.js }
}

Write-Host "Restarting PM2 processes" -ForegroundColor Green
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    pm2 restart infra/pm2/ecosystem.config.js --update-env || pm2 start infra/pm2/ecosystem.config.js
    pm2 status
}
else {
    Write-Warning "pm2 not found in PATH. Start process manually.";
}

Write-Host "Waiting 4s for process to stabilize..."; Start-Sleep -Seconds 4

Write-Host "Tailing last 200 lines of logs" -ForegroundColor Green
if (Get-Command pm2 -ErrorAction SilentlyContinue) { pm2 logs hypebotx-bot --lines 200 --nostream } else { Get-Content ./apps/bot/logs/realtime-server-audit.json -Tail 200 -ErrorAction SilentlyContinue }

if ($RunTests) {
    Write-Host "Running QA suite (qa:all). Output will be saved to qa_deploy_output.txt" -ForegroundColor Green
    npm run qa:all 2>&1 | Tee-Object qa_deploy_output.txt
    if ($LASTEXITCODE -ne 0) {
        Write-Error "QA failed. See qa_deploy_output.txt and pm2 logs. Exiting with code $LASTEXITCODE"; exit $LASTEXITCODE
    }
}

Write-Host "Staging deploy completed. Please run manual smoke tests in Discord staging (see docs/STAGING_CHECKLIST.md)." -ForegroundColor Cyan
exit 0
