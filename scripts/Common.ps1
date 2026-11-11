$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$script:ProjectRoot = Split-Path -Parent $PSScriptRoot
$script:ComposeFile = Join-Path (Join-Path (Join-Path $script:ProjectRoot "infra") "docker") "compose.yaml"

function Invoke-BlacksmithCompose {
    Write-Host ("> docker compose --project-name blacksmith --file infra/docker/compose.yaml " + ($args -join " "))
    & docker compose --project-name blacksmith --file $script:ComposeFile @args
    if ($LASTEXITCODE -ne 0) {
        throw "Blacksmith Compose command failed with exit code $LASTEXITCODE."
    }
}

function Assert-BlacksmithDocker {
    & docker info --format "Docker server {{.ServerVersion}}; OS={{.OSType}}"
    if ($LASTEXITCODE -ne 0) {
        throw "Docker is not available. Start Docker Desktop with Linux containers."
    }
    $containerOs = & docker info --format "{{.OSType}}"
    if ($LASTEXITCODE -ne 0 -or $containerOs -ne "linux") {
        throw "This project requires Linux containers."
    }
}

function Assert-BlacksmithIsolation {
    $raw = & docker compose --project-name blacksmith --file $script:ComposeFile --profile checks config --format json
    if ($LASTEXITCODE -ne 0) {
        throw "Compose configuration validation failed."
    }
    $config = $raw | ConvertFrom-Json
    if ($config.name -ne "blacksmith") {
        throw "Unexpected Compose project name."
    }
    foreach ($service in @("db", "test-db")) {
        if ($config.services.$service.PSObject.Properties.Name -contains "ports") {
            throw "Database service $service must not publish a host port."
        }
    }
    foreach ($entry in @(@{ Service = "web"; Port = "18102" }, @{ Service = "api"; Port = "18202" })) {
        $bindings = @($config.services.($entry.Service).ports)
        if ($bindings.Count -ne 1 -or $bindings[0].host_ip -ne "127.0.0.1" -or
            $bindings[0].published -ne $entry.Port -or $bindings[0].target -ne 8080) {
            throw "Unexpected port binding for $($entry.Service)."
        }
    }
    Write-Host "Isolation verified: blacksmith; loopback 18102/18202; no published database ports."
}
