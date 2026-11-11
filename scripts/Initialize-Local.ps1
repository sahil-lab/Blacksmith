$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$secretDirectory = Join-Path (Join-Path $projectRoot ".local") "secrets"
[System.IO.Directory]::CreateDirectory($secretDirectory) | Out-Null

foreach ($name in @("db_password", "db_test_password")) {
    $path = Join-Path $secretDirectory $name
    if (Test-Path -LiteralPath $path) {
        $existing = [System.IO.File]::ReadAllText($path)
        if ($existing -notmatch "^[a-f0-9]{64}$") {
            throw "Existing local secret $name is invalid. Do not silently rotate a database credential."
        }
        continue
    }
    $bytes = New-Object byte[] 32
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $random.GetBytes($bytes)
    } finally {
        $random.Dispose()
    }
    $value = [System.BitConverter]::ToString($bytes).Replace("-", "").ToLowerInvariant()
    [System.IO.File]::WriteAllText($path, $value, (New-Object System.Text.UTF8Encoding($false)))
}

Write-Host "Blacksmith local secret files are ready; values are not printed."
