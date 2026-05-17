param(
  [ValidateSet("all", "bot", "backend", "frontend")]
  [string]$Target = "all"
)

$ErrorActionPreference = "Stop"

switch ($Target) {
  "bot" { npm run test:bot }
  "backend" { npm run test:backend }
  "frontend" { npm run test:frontend }
  default { npm run test:all }
}
