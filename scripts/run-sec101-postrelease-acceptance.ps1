[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$appRoot = Join-Path $repoRoot 'apps/hr-suite'
$runner = Join-Path $appRoot 'scripts/security/sec101-postrelease-acceptance.mjs'
$catalog = Get-Content -LiteralPath (Join-Path $repoRoot 'docs/quality/acceptance/PAYROLL-TEST-PERSONAS.json') -Raw | ConvertFrom-Json
$employeeEmail = ($catalog.personas | Where-Object { $_.key -eq 'jaap' } | Select-Object -First 1).email

function ConvertFrom-SecurePrompt {
    param([System.Security.SecureString]$Value)
    $ptr = [IntPtr]::Zero
    try {
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
        $Value.Dispose()
    }
}

$credentialMap = @{}
foreach ($persona in @(
    @{ Key = 'employee-only'; Label = 'Employee-only (use the canonical Jaap fixture)'; DefaultEmail = $employeeEmail },
    @{ Key = 'manager'; Label = 'Manager'; DefaultEmail = 'manager.fixture@liquidhr.test' },
    @{ Key = 'tenant-admin'; Label = 'Tenant Admin'; DefaultEmail = 'hradmin.fixture@liquidhr.test' }
)) {
    $email = Read-Host "$($persona.Label) email [$($persona.DefaultEmail)]"
    if ([string]::IsNullOrWhiteSpace($email)) { $email = $persona.DefaultEmail }
    $securePassword = Read-Host "$($persona.Label) password (hidden)" -AsSecureString
    $password = ConvertFrom-SecurePrompt -Value $securePassword
    $credentialMap[$persona.Key] = [pscustomobject]@{ email = $email; password = $password }
}

$payload = ConvertTo-Json -InputObject $credentialMap -Compress -Depth 4
$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = (Get-Command node -ErrorAction Stop).Source
$startInfo.Arguments = '"' + $runner + '"'
$startInfo.WorkingDirectory = $appRoot
$startInfo.UseShellExecute = $false
$startInfo.RedirectStandardInput = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $startInfo
try {
    [void]$process.Start()
    $process.StandardInput.WriteLine($payload)
    $process.StandardInput.Close()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($stdout) { Write-Output $stdout.TrimEnd() }
    if ($process.ExitCode -ne 0 -and -not $stdout) { Write-Output "RUNNER_EXIT=$($process.ExitCode); no credentials or response bodies were logged." }
    exit $process.ExitCode
} finally {
    $payload = $null
    $stdout = $null
    $stderr = $null
    foreach ($entry in $credentialMap.Values) { $entry.password = $null }
    $credentialMap.Clear()
    $process.Dispose()
}
