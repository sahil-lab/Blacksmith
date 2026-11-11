param([switch]$Format)

. (Join-Path $PSScriptRoot "Common.ps1")

Assert-BlacksmithDocker
& (Join-Path $PSScriptRoot "Initialize-Local.ps1")
Assert-BlacksmithIsolation

Invoke-BlacksmithCompose --profile checks run --rm --no-deps node-tool npm ci --no-audit --no-fund
if ($Format) {
    Invoke-BlacksmithCompose --profile checks run --rm --no-deps node-tool npm run format
    Invoke-BlacksmithCompose --profile checks run --rm --no-deps api-tool spotless:apply
}
Invoke-BlacksmithCompose --profile checks run --rm --no-deps node-tool sh -lc "npm run format:check && npm run lint && npm run build && npm test"

try {
    Invoke-BlacksmithCompose --profile checks up --detach --wait --wait-timeout 90 test-db
    Invoke-BlacksmithCompose --profile checks run --rm --no-deps api-tool verify
} finally {
    Invoke-BlacksmithCompose --profile checks stop test-db
}

& (Join-Path $PSScriptRoot "Start-Local.ps1")
Invoke-BlacksmithCompose --profile checks run --rm --no-deps e2e
Write-Host "Blacksmith Phase 1 validation passed. Application services remain running."
