<#
.SYNOPSIS
    Captures the ember scene as this machine's GPU draws it.

.DESCRIPTION
    The containerised browser tests have no GPU: they cover the static fallback
    and a small software render. This optional script closes that gap. It runs
    an installed Edge or Chrome headless, drives it over the DevTools protocol,
    and saves what the hardware actually draws, plus a JSON summary.

    It uses a throwaway browser profile under .local, an ephemeral loopback
    port, and stops only the browser processes it started. Your own browser
    windows and profile are never touched.

.PARAMETER Width
    Desktop pass viewport width in CSS pixels. Default 1440.

.PARAMETER Height
    Desktop pass viewport height in CSS pixels. Default 900.

.PARAMETER Scale
    Desktop pass device pixel ratio. Default 1. Pass your own browser's values
    to see the scene as your screen shows it: a 1920 x 1200 panel at 150 %
    scaling is roughly -Width 1280 -Height 650 -Scale 1.5.

.PARAMETER DesktopOnly
    Skips the cold-forge and phone passes.

.PARAMETER Probe
    Path to a JavaScript file holding one expression (an async function call is
    fine). It is evaluated in the page once the desktop scene has opened and its
    result is printed; nothing is captured and earlier evidence is left alone.
    The containerised tests have no GPU, so this is how a rendering or timing
    question gets answered on real hardware. See scripts\probes.

.PARAMETER Trace
    Prints every DevTools command and event with timings, for diagnosis.

.EXAMPLE
    .\scripts\Start-Local.ps1
    .\scripts\Capture-Scene.ps1

.EXAMPLE
    .\scripts\Capture-Scene.ps1 -Width 1280 -Height 650 -Scale 1.5 -DesktopOnly -OutputDirectory .\.local\evidence\display

.EXAMPLE
    .\scripts\Capture-Scene.ps1 -Width 1280 -Height 650 -Scale 1.5 -Probe .\scripts\probes\transition-pacing.js
#>
param(
    [string]$Url = "http://127.0.0.1:18102/",
    [string]$OutputDirectory,
    [string]$BrowserPath,
    [ValidateRange(320, 3840)][int]$Width = 1440,
    [ValidateRange(320, 2160)][int]$Height = 900,
    [ValidateRange(1, 3)][double]$Scale = 1,
    [switch]$DesktopOnly,
    [string]$Probe,
    [switch]$Trace
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$localDirectory = Join-Path $projectRoot ".local"
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $localDirectory "evidence"
}
# .NET file calls resolve against the process directory, not the shell's.
$OutputDirectory = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
$probeSource = $null
if ($Probe) {
    $probePath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Probe)
    if (-not (Test-Path -LiteralPath $probePath -PathType Leaf)) {
        throw "Probe script not found: $probePath"
    }
    $probeSource = [System.IO.File]::ReadAllText($probePath)
}
$profileDirectory = Join-Path $localDirectory "capture-profile"

if (-not $BrowserPath) {
    $roots = @(${env:ProgramFiles(x86)}, $env:ProgramFiles) | Where-Object { $_ }
    $relative = @("Microsoft\Edge\Application\msedge.exe", "Google\Chrome\Application\chrome.exe")
    $candidates = foreach ($item in $relative) { foreach ($root in $roots) { Join-Path $root $item } }
    $BrowserPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $BrowserPath -or -not (Test-Path -LiteralPath $BrowserPath)) {
    throw "No Edge or Chrome installation was found. Pass -BrowserPath."
}
$processName = [System.IO.Path]::GetFileName($BrowserPath)
$clock = [System.Diagnostics.Stopwatch]::StartNew()

function Write-Trace([string]$Message) {
    if ($Trace) {
        Write-Host ("  [{0,6:N1}s] {1}" -f $clock.Elapsed.TotalSeconds, $Message)
    }
}

# Only processes launched on this script's own profile are ever selected.
function Get-CaptureProcess {
    Get-CimInstance Win32_Process -Filter "Name='$processName'" |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profileDirectory) }
}

# The browser respawns helpers while it lives, so stop it first and repeat
# until nothing of ours is left.
function Stop-CaptureBrowser {
    $deadline = (Get-Date).AddSeconds(60)
    $remaining = @(Get-CaptureProcess)
    while ($remaining.Count -gt 0 -and (Get-Date) -lt $deadline) {
        foreach ($entry in ($remaining | Sort-Object { $_.CommandLine -match '--type=' })) {
            Stop-Process -Id $entry.ProcessId -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
        $remaining = @(Get-CaptureProcess)
    }
    if ($remaining.Count -gt 0) {
        $ids = ($remaining | ForEach-Object { $_.ProcessId }) -join ", "
        Write-Warning "Capture browser processes are still exiting: $ids"
        return $false
    }
    return $true
}

$script:nextId = 0
$script:issues = New-Object System.Collections.Generic.List[string]
$receiveBuffer = New-Object byte[] 262144
$socket = $null

function Add-PageIssue([string]$Text) {
    $message = $Text | ConvertFrom-Json
    $detail = $null
    if ($message.method -eq "Log.entryAdded") {
        if (@("error", "warning") -contains $message.params.entry.level) {
            $detail = "$($message.params.entry.level): $($message.params.entry.text)"
        }
    } elseif ($message.method -eq "Runtime.consoleAPICalled") {
        if (@("error", "warning") -contains $message.params.type) {
            $parts = foreach ($argument in $message.params.args) {
                $names = $argument.PSObject.Properties.Name
                if ($names -contains "value") { $argument.value } elseif ($names -contains "description") { $argument.description }
            }
            $detail = "$($message.params.type): $($parts -join ' ')"
        }
    } else {
        $detail = "exception: $($message.params.exceptionDetails.text)"
    }
    if ($detail) {
        $script:issues.Add($detail)
    }
}

# A cancelled receive aborts the socket on Windows PowerShell, so the timeout
# is a last resort rather than a polling interval.
function Invoke-Cdp([string]$Method, $Parameters = @{}, [int]$TimeoutSeconds = 120) {
    $script:nextId += 1
    $id = $script:nextId
    $request = @{ id = $id; method = $Method; params = $Parameters } | ConvertTo-Json -Depth 6 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($request)
    $cancel = [System.Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds($TimeoutSeconds))
    Write-Trace "-> $Method"
    try {
        $null = $socket.SendAsync(
            [System.ArraySegment[byte]]::new($bytes),
            [System.Net.WebSockets.WebSocketMessageType]::Text,
            $true,
            $cancel.Token
        ).GetAwaiter().GetResult()
        while ($true) {
            $stream = [System.IO.MemoryStream]::new()
            do {
                $part = $socket.ReceiveAsync([System.ArraySegment[byte]]::new($receiveBuffer), $cancel.Token).GetAwaiter().GetResult()
                if ($part.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
                    throw "The browser closed the DevTools connection during $Method."
                }
                $stream.Write($receiveBuffer, 0, $part.Count)
            } until ($part.EndOfMessage)
            $text = [System.Text.Encoding]::UTF8.GetString($stream.ToArray())
            if ($text.StartsWith("{`"id`":$id,", [System.StringComparison]::Ordinal)) {
                Write-Trace "<- $Method"
                if ($text.StartsWith("{`"id`":$id,`"error`"", [System.StringComparison]::Ordinal)) {
                    throw "DevTools $Method failed: $text"
                }
                return $text
            }
            if ($Trace) {
                Write-Trace ("   " + $text.Substring(0, [Math]::Min(96, $text.Length)))
            }
            if ($text.StartsWith('{"method":"Log.entryAdded"', [System.StringComparison]::Ordinal) -or
                $text.StartsWith('{"method":"Runtime.consoleAPICalled"', [System.StringComparison]::Ordinal) -or
                $text.StartsWith('{"method":"Runtime.exceptionThrown"', [System.StringComparison]::Ordinal)) {
                Add-PageIssue $text
            }
        }
    } finally {
        $cancel.Dispose()
    }
}

function Invoke-PageScript([string]$Expression) {
    $raw = Invoke-Cdp "Runtime.evaluate" @{ expression = $Expression; awaitPromise = $true; returnByValue = $true }
    $response = ($raw | ConvertFrom-Json).result
    if ($response.PSObject.Properties.Name -contains "exceptionDetails") {
        throw "Page script failed: $($response.exceptionDetails | ConvertTo-Json -Depth 4 -Compress)"
    }
    if ($response.result.PSObject.Properties.Name -contains "value") {
        return $response.result.value
    }
    return $null
}

function Save-Screenshot([string]$Name) {
    # The image is too large for ConvertFrom-Json in Windows PowerShell.
    $raw = Invoke-Cdp "Page.captureScreenshot" @{ format = "png" }
    $match = [regex]::Match($raw, '"data":"([A-Za-z0-9+/=]+)"')
    if (-not $match.Success) {
        throw "Screenshot '$Name' returned no image data."
    }
    $path = Join-Path $OutputDirectory "$Name.png"
    [System.IO.File]::WriteAllBytes($path, [Convert]::FromBase64String($match.Groups[1].Value))
    Write-Host "  saved $Name.png"
    return $path
}

$scrollHelper = @'
window.__go = (selector, offset) => {
  const node = document.querySelector(selector);
  window.scrollTo({
    top: node.getBoundingClientRect().top + window.scrollY + offset,
    behavior: "instant",
  });
  return "ok";
};
"ok"
'@

# Half way between the hero and the manifesto: every ember is mid flight.
$midFlight = @'
(() => {
  const hero = document.querySelector(".hero").getBoundingClientRect();
  const next = document.querySelector("#manifesto").getBoundingClientRect();
  window.scrollTo({
    top: (hero.bottom + next.top) / 2 + window.scrollY - window.innerHeight / 2,
    behavior: "instant",
  });
  return "ok";
})()
'@

$strike = @'
(() => {
  const button = Array.from(document.querySelectorAll("button")).find((item) =>
    item.textContent.includes("Strike the anvil"),
  );
  button.click();
  return "ok";
})()
'@

# Where the warm ember shape sits on the WebGL canvas, as fractions of its
# width and height. Read inside an animation frame, straight after the engine
# has drawn, and downscaled so stray embers average away.
$measure = @'
(() =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      const source = document.querySelector("canvas.forge-canvas");
      const probe = document.createElement("canvas");
      probe.width = Math.max(1, Math.round(source.width / 4));
      probe.height = Math.max(1, Math.round(source.height / 4));
      const context = probe.getContext("2d");
      context.drawImage(source, 0, 0, probe.width, probe.height);
      const pixels = context.getImageData(0, 0, probe.width, probe.height).data;
      const columns = new Array(probe.width).fill(0);
      const rows = new Array(probe.height).fill(0);
      let warm = 0;
      for (let y = 0; y < probe.height; y += 1) {
        for (let x = 0; x < probe.width; x += 1) {
          const index = (y * probe.width + x) * 4;
          if (pixels[index] > 120 && pixels[index] > pixels[index + 2] * 1.6) {
            columns[x] += 1;
            rows[y] += 1;
            warm += 1;
          }
        }
      }
      const median = (counts) => {
        let sum = 0;
        for (let k = 0; k < counts.length; k += 1) {
          sum += counts[k];
          if (sum >= warm / 2) {
            return Math.round(((k + 0.5) / counts.length) * 100) / 100;
          }
        }
        return 0.5;
      };
      resolve(
        JSON.stringify({
          x: median(columns),
          y: median(rows),
          warmShare: Math.round((warm / (probe.width * probe.height)) * 1000) / 1000,
        }),
      );
    });
  }))()
'@

$describe = @'
(async () => {
  const app = document.querySelector(".app");
  const canvas = document.querySelector("canvas.forge-canvas");
  const probe = document.createElement("canvas").getContext("webgl2");
  const info = probe && probe.getExtension("WEBGL_debug_renderer_info");
  const renderer = probe
    ? String(probe.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : probe.RENDERER))
    : "none";
  const rate = await new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    const tick = (now) => {
      frames += 1;
      if (now - start < 3000) {
        requestAnimationFrame(tick);
      } else {
        resolve((frames * 1000) / (now - start));
      }
    };
    requestAnimationFrame(tick);
  });
  return JSON.stringify({
    renderer,
    mode: app.dataset.gl,
    heat: app.dataset.heat,
    caption: document.querySelector(".hero-hud span:last-child").textContent,
    canvas: canvas.width + "x" + canvas.height,
    viewport: window.innerWidth + "x" + window.innerHeight,
    animationFramesPerSecond: Math.round(rate * 10) / 10,
  });
})()
'@

function Open-Scene([hashtable]$Metrics) {
    Invoke-Cdp "Emulation.setDeviceMetricsOverride" $Metrics | Out-Null
    Invoke-Cdp "Page.reload" | Out-Null
    # Give the old document time to go before asking the new one anything.
    Start-Sleep -Milliseconds 1500
    $deadline = (Get-Date).AddSeconds(150)
    $phase = ""
    $lastError = "none"
    do {
        Start-Sleep -Milliseconds 400
        try {
            $phase = Invoke-PageScript "(document.querySelector('.app') || { dataset: {} }).dataset.phase || ''"
        } catch {
            $phase = ""
            $lastError = $_.Exception.Message
        }
        if ((Get-Date) -gt $deadline) {
            throw "The page intro did not finish (phase '$phase'; last error: $lastError). Is the stack running? Tried $Url"
        }
    } until ($phase -eq "ready")
    Invoke-PageScript $scrollHelper | Out-Null
    # A reload restores the previous scroll position; every pass starts at the top.
    Invoke-PageScript "window.scrollTo({ top: 0, behavior: 'instant' }), 'ok'" | Out-Null
    # Let the intro wipe finish and the ember heat settle.
    Start-Sleep -Milliseconds 3200
    return (Invoke-PageScript $describe | ConvertFrom-Json)
}

function Save-Shot([string]$Name, [string]$Script, [int]$WaitMilliseconds) {
    Invoke-PageScript $Script | Out-Null
    Start-Sleep -Milliseconds $WaitMilliseconds
    return (Save-Screenshot $Name)
}

function Measure-Embers {
    return (Invoke-PageScript $measure | ConvertFrom-Json)
}

if (@(Get-CaptureProcess).Count -gt 0) {
    Stop-CaptureBrowser | Out-Null
}
New-Item -ItemType Directory -Force -Path $profileDirectory | Out-Null
if (-not $probeSource) {
    New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
    # Drop this script's own earlier output so one folder never mixes two runs.
    Get-ChildItem -LiteralPath $OutputDirectory -File |
        Where-Object { $_.Name -like "gpu-*.png" -or $_.Name -eq "gpu-capture.json" } |
        Remove-Item -Force
}
$portFile = Join-Path $profileDirectory "DevToolsActivePort"
Remove-Item -LiteralPath $portFile -ErrorAction SilentlyContinue

$files = New-Object System.Collections.Generic.List[string]
$summary = [ordered]@{ url = $Url; browser = $BrowserPath }

try {
    Write-Host "Starting $processName headless on a throwaway profile..."
    Start-Process -FilePath $BrowserPath -ArgumentList @(
        "--headless=new",
        "--remote-debugging-port=0",
        "--user-data-dir=`"$profileDirectory`"",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--hide-scrollbars",
        "--window-size=$Width,$Height",
        "--force-device-scale-factor=1",
        $Url
    ) | Out-Null

    $deadline = (Get-Date).AddSeconds(90)
    $port = 0
    while ($port -eq 0) {
        if ((Get-Date) -gt $deadline) {
            throw "The browser did not open a DevTools port. Remote debugging may be disabled by policy."
        }
        Start-Sleep -Milliseconds 250
        if (Test-Path -LiteralPath $portFile) {
            $first = Get-Content -LiteralPath $portFile -TotalCount 1 -ErrorAction SilentlyContinue
            if ($first -match '^\d+$') {
                $port = [int]$first
            }
        }
    }
    Write-Trace "DevTools port $port is open"

    $target = $null
    while (-not $target) {
        if ((Get-Date) -gt $deadline) {
            throw "The browser exposed no page for $Url."
        }
        Start-Sleep -Milliseconds 500
        try {
            $listed = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/list" -TimeoutSec 5
            $target = $listed | Where-Object { $_.type -eq "page" -and $_.url.StartsWith($Url) } | Select-Object -First 1
        } catch {
            $target = $null
        }
    }
    Write-Trace "Found the page target"

    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $null = $socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
    Invoke-Cdp "Runtime.enable" | Out-Null
    Invoke-Cdp "Log.enable" | Out-Null
    Invoke-Cdp "Network.enable" | Out-Null

    $desktopMetrics = @{ width = $Width; height = $Height; deviceScaleFactor = $Scale; mobile = $false }
    Write-Host "Desktop, $Width x $Height at ${Scale}x:"
    $desktop = Open-Scene $desktopMetrics
    $summary["desktop"] = $desktop
    if ($probeSource) {
        Write-Host ($desktop | ConvertTo-Json -Compress)
        Write-Host (Invoke-PageScript $probeSource)
        return
    }
    # Never label a capture as GPU output unless the page says it drew the scene.
    $prefix = if ($desktop.mode -eq "webgl2") { "gpu" } else { "gpu-unavailable" }
    if ($prefix -ne "gpu") {
        Write-Warning "The page reported '$($desktop.mode)' on '$($desktop.renderer)'. These captures show the static fallback."
    }

    $placement = [ordered]@{}
    $placement["anvil"] = Measure-Embers
    $files.Add((Save-Screenshot "$prefix-01-hero"))
    $files.Add((Save-Shot "$prefix-02-strike" $strike 170))
    Start-Sleep -Milliseconds 1800
    $files.Add((Save-Shot "$prefix-03-mid-flight" $midFlight 2400))
    $files.Add((Save-Shot "$prefix-04-manifesto" "__go('#manifesto', 140)" 2600))
    $files.Add((Save-Shot "$prefix-05-method" "__go('#method', 0)" 2600))
    $placement["runners"] = Measure-Embers
    $files.Add((Save-Shot "$prefix-06-method-scrolled" "__go('#method', 760)" 2200))
    $files.Add((Save-Shot "$prefix-07-signal" "__go('#system', 40)" 2600))
    $files.Add((Save-Shot "$prefix-08-workbench" "__go('#workbench', 150)" 2600))
    $files.Add((Save-Shot "$prefix-09-ledger" "__go('.ledger', 100)" 2600))
    $files.Add((Save-Shot "$prefix-10-footer" "__go('.site-footer', 60)" 2600))
    $placement["hammer"] = Measure-Embers
    $summary["placement"] = $placement
    # The ember count in this second reading drops if the page stepped its
    # quality down while it was being scrolled and photographed.
    $summary["desktopAtFooter"] = (Invoke-PageScript $describe | ConvertFrom-Json)
    # On a wide screen the anvil and the closing hammer belong right of centre.
    # Direct3D once drew the last formation dead centre by reading the wrong
    # matrix; no software test saw it.
    $wide = $Width -ge $Height
    $placementOk = ($prefix -ne "gpu") -or (-not $wide) -or ($placement["hammer"].x -gt 0.62 -and $placement["anvil"].x -gt 0.58)
    $summary["placementCheck"] = if ($prefix -ne "gpu") { "skipped: scene not drawn" } elseif (-not $wide) { "skipped: portrait viewport" } elseif ($placementOk) { "pass" } else { "FAIL: formations are not where the layout puts them" }

    if (-not $DesktopOnly) {
        Write-Host "Desktop with the system endpoint blocked (cold forge):"
        Invoke-Cdp "Network.setBlockedURLs" @{ urls = @("*/api/system") } | Out-Null
        $summary["cold"] = Open-Scene $desktopMetrics
        $files.Add((Save-Screenshot "$prefix-11-cold-hero"))
        $files.Add((Save-Shot "$prefix-12-cold-signal" "__go('#system', 40)" 2600))
        Invoke-Cdp "Network.setBlockedURLs" @{ urls = @() } | Out-Null
        # Blocking the endpoint logs one expected network error; keep it out of the report.
        $expected = @($script:issues | Where-Object { $_ -match 'ERR_BLOCKED_BY_CLIENT|api/system' })
        foreach ($item in $expected) {
            $script:issues.Remove($item) | Out-Null
        }

        Write-Host "Phone, 390 x 844 at 2x:"
        $summary["phone"] = Open-Scene @{ width = 390; height = 844; deviceScaleFactor = 2; mobile = $true }
        $files.Add((Save-Screenshot "$prefix-13-phone-hero"))
        $files.Add((Save-Shot "$prefix-14-phone-manifesto" "__go('#manifesto', 100)" 2600))
        $files.Add((Save-Shot "$prefix-15-phone-method" "__go('#method', 0)" 2600))
        $files.Add((Save-Shot "$prefix-16-phone-signal" "__go('#system', 40)" 2600))
        $files.Add((Save-Shot "$prefix-17-phone-workbench" "__go('#workbench', 300)" 2600))
        $files.Add((Save-Shot "$prefix-18-phone-footer" "__go('.site-footer', 0)" 2600))
        $summary["phoneAtFooter"] = (Invoke-PageScript $describe | ConvertFrom-Json)
    }

    $summary["consoleIssues"] = @($script:issues)
    $summary["files"] = @($files | ForEach-Object { Split-Path -Leaf $_ })
    $report = $summary | ConvertTo-Json -Depth 5
    Set-Content -LiteralPath (Join-Path $OutputDirectory "gpu-capture.json") -Value $report -Encoding UTF8
    Write-Host $report
    if (-not $placementOk) {
        throw "Placement check failed: see the 'placement' values in gpu-capture.json."
    }
} finally {
    if ($socket) {
        try {
            Invoke-Cdp "Browser.close" @{} 5 | Out-Null
        } catch {
            Write-Trace "Browser.close did not answer; stopping the processes instead."
        }
        $socket.Dispose()
    }
    if (Stop-CaptureBrowser) {
        Remove-Item -LiteralPath $profileDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
}
