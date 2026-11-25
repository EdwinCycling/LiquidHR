[CmdletBinding()]
param(
    [ValidateSet('Development')][string]$Mode = 'Development',
    [switch]$TestRunner,
    [switch]$PreflightOnly,
    [switch]$StopTestRunner,
    [int]$RuntimePid,
    [int]$Port,
    [ValidateRange(1, 300)][int]$ReadyTimeoutSeconds = 60
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$launcher = Join-Path $PSScriptRoot 'start-test-worktree.ps1'
$head = (& git -C $repo rev-parse HEAD).Trim()
$stateDir = Join-Path $repo '.artifacts/local-acceptance'
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
$stateFile = Join-Path $stateDir 'owned-runtime.json'
function Emit($value) { Write-Output ($value | ConvertTo-Json -Compress) }
if ($StopTestRunner) {
    if (-not (Test-Path -LiteralPath $stateFile)) { throw 'OWNED_RUNTIME_RECORD_MISSING' }
    $record = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    if ($record.pid -ne $RuntimePid -or $record.port -ne $Port -or $record.head -ne $head -or $record.repo -ne $repo) { throw 'OWNED_RUNTIME_IDENTITY_MISMATCH' }
    $owned = Get-Process -Id $RuntimePid -ErrorAction SilentlyContinue
    if ($owned -and $owned.StartTime.ToUniversalTime().ToString('o') -ne $record.started) { throw 'OWNED_RUNTIME_PROCESS_REUSED' }
    if ($owned) {
        & taskkill.exe /PID $RuntimePid /T /F 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'OWNED_RUNTIME_STOP_FAILED' }
    }
    Remove-Item -LiteralPath $stateFile
    Emit @{ schemaVersion = 1; status = 'STOPPED'; stopped = $true; pid = $RuntimePid; port = $Port; head = $head }
    exit 0
}
if ($Port -eq 0) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hash = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($repo.ToLowerInvariant())) } finally { $sha.Dispose() }
    $Port = 20000 + ([BitConverter]::ToUInt16($hash, 0) % 20000)
}
if ($Port -lt 3000 -or $Port -gt 65535) { throw 'INVALID_LOOPBACK_PORT' }
& $launcher -Mode Development -Port $Port -PreflightOnly 6>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'LOCAL_RUNTIME_PREFLIGHT_FAILED' }
if ($PreflightOnly) { Emit @{ schemaVersion = 1; status = 'PREFLIGHT_GREEN' }; exit 0 }
if (Test-Path -LiteralPath $stateFile) { throw 'OWNED_RUNTIME_RECORD_EXISTS' }
$shell = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $launcher + '" -Mode Development -Port ' + $Port
$process = Start-Process -FilePath $shell -ArgumentList $arguments -WindowStyle Hidden -WorkingDirectory $repo -PassThru -RedirectStandardOutput (Join-Path $stateDir 'runtime.stdout.log') -RedirectStandardError (Join-Path $stateDir 'runtime.stderr.log')
$record = @{ pid = $process.Id; port = $Port; head = $head; repo = $repo; started = $process.StartTime.ToUniversalTime().ToString('o') }
$record | ConvertTo-Json | Set-Content -LiteralPath $stateFile
$url = "http://127.0.0.1:$Port"
$deadline = [DateTime]::UtcNow.AddSeconds($ReadyTimeoutSeconds)
$ready = $false
try {
do {
    try {
        $response = Invoke-WebRequest -Uri "$url/login" -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200) {
            $ready = $true
            Emit @{ schemaVersion = 1; status = 'READY'; url = $url; port = $Port; pid = $process.Id; head = $head; reused = $false; readyPath = '/login' }
            exit 0
        }
    } catch { }
    $process.Refresh()
    if ($process.HasExited) { throw 'LOCAL_RUNTIME_EXITED' }
    Start-Sleep -Milliseconds 500
} while ([DateTime]::UtcNow -lt $deadline)
throw 'LOCAL_RUNTIME_READY_TIMEOUT'
} finally {
    if (-not $ready) {
        $process.Refresh()
        if (-not $process.HasExited) { & taskkill.exe /PID $process.Id /T /F 2>&1 | Out-Null }
        if (Test-Path -LiteralPath $stateFile) { Remove-Item -LiteralPath $stateFile }
    }
}
