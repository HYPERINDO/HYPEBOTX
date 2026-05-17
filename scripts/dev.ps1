param(
  [ValidateSet("all", "bot", "dashboard", "backend", "frontend")]
  [string]$Target = "all"
)

$ErrorActionPreference = "Stop"

switch ($Target) {
  "bot" { npm run dev:bot }
  "backend" { npm run dev:backend }
  "frontend" { npm run dev:frontend }
  "dashboard" { npm run dev:dashboard }
  default { npm run dev:all }
}
