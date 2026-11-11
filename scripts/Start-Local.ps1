. (Join-Path $PSScriptRoot "Common.ps1")

Assert-BlacksmithDocker
& (Join-Path $PSScriptRoot "Initialize-Local.ps1")
Assert-BlacksmithIsolation

Invoke-BlacksmithCompose build api
Invoke-BlacksmithCompose build web
Invoke-BlacksmithCompose up --detach --wait --wait-timeout 180 db api web
Invoke-BlacksmithCompose ps
Write-Host "Dashboard: http://127.0.0.1:18102"
Write-Host "API: http://127.0.0.1:18202"
