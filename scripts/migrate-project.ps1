$ErrorActionPreference = "Stop"

$branch = git branch --show-current
if ($branch -ne "feature/pro-monorepo-dashboard") {
  Write-Host "Current branch: $branch"
  Write-Host "Recommended branch: feature/pro-monorepo-dashboard"
}

powershell -ExecutionPolicy Bypass -File scripts/check-structure.ps1
Write-Host "Migration structure check completed"
