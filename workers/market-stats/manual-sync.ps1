param(
  [Parameter(Mandatory = $true)]
  [string]$WorkerDir
)

$ErrorActionPreference = 'Stop'

$workerPath = (Resolve-Path -LiteralPath $WorkerDir).Path
$outLog = Join-Path $workerPath 'manual-sync.out.log'
$errLog = Join-Path $workerPath 'manual-sync.err.log'
$manifestUrl = 'https://static.operit.app/market-stats/manifest.json'

Remove-Item -LiteralPath $outLog -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $errLog -Force -ErrorAction SilentlyContinue

$npx = (Get-Command 'npx.cmd' -ErrorAction Stop).Source
$args = @('wrangler', 'dev', '--remote', '--test-scheduled')
$previousManifestUpdatedAt = $null

try {
  $previousManifestUpdatedAt =
    (Invoke-RestMethod -Uri ("{0}?before={1}" -f $manifestUrl, [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) -TimeoutSec 30).updatedAt
} catch {
  Write-Warning "Failed to read current market manifest before sync: $($_.Exception.Message)"
}

Write-Host 'Starting market-stats scheduled trigger...'
$process = Start-Process -FilePath $npx -ArgumentList $args -WorkingDirectory $workerPath -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru

try {
  $ready = $false
  for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 2
    if ($process.HasExited) {
      break
    }

    if (Test-Path -LiteralPath $outLog) {
      $content = Get-Content -LiteralPath $outLog -Raw -ErrorAction SilentlyContinue
      if ($content -match 'Ready on http://127\.0\.0\.1:8787') {
        $ready = $true
        break
      }
    }
  }

  if (-not $ready) {
    $stdout = if (Test-Path -LiteralPath $outLog) { Get-Content -LiteralPath $outLog -Raw -ErrorAction SilentlyContinue } else { '' }
    $stderr = if (Test-Path -LiteralPath $errLog) { Get-Content -LiteralPath $errLog -Raw -ErrorAction SilentlyContinue } else { '' }
    throw "wrangler dev did not become ready.`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
  }

  $response = Invoke-WebRequest -Uri 'http://127.0.0.1:8787/__scheduled' -UseBasicParsing -TimeoutSec 120
  $currentManifestUpdatedAt = $previousManifestUpdatedAt

  for ($i = 0; $i -lt 24; $i++) {
    Start-Sleep -Seconds 5

    try {
      $currentManifestUpdatedAt =
        (Invoke-RestMethod -Uri ("{0}?after={1}" -f $manifestUrl, [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) -TimeoutSec 30).updatedAt
      if ($currentManifestUpdatedAt -and $currentManifestUpdatedAt -ne $previousManifestUpdatedAt) {
        break
      }
    } catch {
      Write-Warning "Failed to poll market manifest after sync: $($_.Exception.Message)"
    }
  }

  $stdout = if (Test-Path -LiteralPath $outLog) { Get-Content -LiteralPath $outLog -Raw -ErrorAction SilentlyContinue } else { '' }
  $stderr = if (Test-Path -LiteralPath $errLog) { Get-Content -LiteralPath $errLog -Raw -ErrorAction SilentlyContinue } else { '' }

  Write-Host ("Scheduled trigger finished with HTTP {0}." -f $response.StatusCode)
  Write-Host ("stdout log: {0}" -f $outLog)
  if ($stderr.Trim()) {
    Write-Host ("stderr log: {0}" -f $errLog)
  }

  if ($stdout -notmatch 'GET /__scheduled 200 OK') {
    throw 'The scheduled endpoint did not complete successfully according to the Wrangler log.'
  }

  if ($currentManifestUpdatedAt -and $currentManifestUpdatedAt -ne $previousManifestUpdatedAt) {
    Write-Host ("Market stats refresh completed successfully. manifest.updatedAt={0}" -f $currentManifestUpdatedAt)
  } else {
    throw "The scheduled endpoint responded, but manifest.updatedAt did not change. Previous=$previousManifestUpdatedAt Current=$currentManifestUpdatedAt"
  }
}
finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}
