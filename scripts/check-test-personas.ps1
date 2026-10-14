[CmdletBinding()]
param(
    [ValidatePattern('^http://localhost:\d{1,5}$')]
    [string]$BaseUrl = 'http://localhost:3010',
    [switch]$SkipBrowser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$catalogPath = Join-Path $repoRoot 'docs/quality/acceptance/PAYROLL-TEST-PERSONAS.json'
$launcherPath = Join-Path $PSScriptRoot 'start-test-worktree.ps1'
$browserCheckPath = Join-Path $PSScriptRoot 'check-test-personas.browser.mjs'
$catalog = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json

$expectedKeys = @('lisa', 'jaap', 'frits')
$actualKeys = @($catalog.personas | ForEach-Object { $_.key })
$expectedRuns = @{
    lisa = @{ Id = '57ac6c10-7a02-49c4-a588-2ca244e621d9'; Lifecycle = 'FINALIZED' }
    jaap = @{ Id = 'e20e0345-90ac-489b-9fee-7610b2d8f6a3'; Lifecycle = 'CONCEPT' }
    frits = @{ Id = '338ef391-fbf6-435a-a4d7-e28a8024ebc2'; Lifecycle = 'FINALIZED'; SourceStatus = 'TRACE_LABEL_MISMATCH_OPEN' }
}
if ($catalog.coreTestProjectRef -ne 'wnpfloqpjvaacobppbpk' -or
    $catalog.payrollLabTestProjectRef -ne 'jhgeriucbkfarxiudzfy' -or
    $catalog.personas.Count -ne 3 -or
    @((Compare-Object $expectedKeys $actualKeys)).Count -gt 0) {
    throw 'De canonieke persona-catalogus mist de goedgekeurde projectrefs of de vaste Lisa/Jaap/Frits-set.'
}
foreach ($persona in $catalog.personas) {
    $expectedRun = $expectedRuns[$persona.key]
    $primaryRun = $persona.payrollRuns | Select-Object -First 1
    if (-not $expectedRun -or
        $persona.email -notmatch '^[a-z0-9._+-]+@liquidhr\.test$' -or
        $persona.employeeId -notmatch '^[0-9a-f-]{36}$' -or
        $persona.employmentId -notmatch '^[0-9a-f-]{36}$' -or
        $persona.roleSwitchKey -ne "payroll-$($persona.key)" -or
        -not $primaryRun -or
        $primaryRun.id -ne $expectedRun.Id -or
        $primaryRun.lifecycle -ne $expectedRun.Lifecycle -or
        ($expectedRun.ContainsKey('SourceStatus') -and $primaryRun.sourceStatus -ne $expectedRun.SourceStatus)) {
        throw "De vaste employee-, role-switch- of Payroll-runreferentie voor $($persona.key) wijkt af van de gecontroleerde cataloguscontracten."
    }
}

$switchSource = Get-Content -LiteralPath (Join-Path $repoRoot 'apps/hr-suite/lib/auth/test-role-switch.ts') -Raw
$routeSource = Get-Content -LiteralPath (Join-Path $repoRoot 'apps/hr-suite/app/api/auth/test-role-switch/route.ts') -Raw
$sourceChecks = @(
    @{ Name = 'payroll-lisa'; Pattern = "key: 'payroll-lisa'|payroll-lisa" },
    @{ Name = 'payroll-jaap'; Pattern = "key: 'payroll-jaap'|payroll-jaap" },
    @{ Name = 'payroll-frits'; Pattern = "key: 'payroll-frits'|payroll-frits" },
    @{ Name = 'existing-user-only'; Pattern = 'listUsers' }
)
foreach ($check in $sourceChecks) {
    if ($check.Name -eq 'existing-user-only') {
        if ($routeSource -notmatch $check.Pattern) { throw 'De role-switchroute mist de controle op bestaande Auth-identiteiten.' }
    } elseif ($switchSource -notmatch $check.Pattern) {
        throw "De vaste role-switchallowlist mist $($check.Name)."
    }
}
if ($switchSource -notmatch '!vercel' -or $switchSource -notmatch '!vercelEnv') {
    throw 'De lokale Test Auth-guard mist de blokkade voor Vercel-contexten.'
}

Write-Output 'PAYTEST-AUTH-01 persona-preflight'
Write-Output "Catalogus: $catalogPath"
Write-Output "Core TEST: $($catalog.coreTestProjectRef); Payroll Lab TEST: $($catalog.payrollLabTestProjectRef)"
Write-Output 'Persona-IDs en verwachte run-lifecycle: statische cataloguscontrole geslaagd; live readback blijft browserbewijs.'
Write-Output 'Role-switchallowlist en gesloten Vercel-guard: statische broncontrole geslaagd.'
Write-Output 'Credentials: %LOCALAPPDATA%\LiquidHR\TestRuntime\payroll-test-personas.env (waarden blijven verborgen).'

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
try {
    $listener.Start()
    $preflightPort = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
} finally {
    $listener.Stop()
}

$runtimeReady = $false
$runtimeReason = $null
try {
    & $launcherPath -PayrollAcceptance -Port $preflightPort -PreflightOnly
    $runtimeReady = $true
} catch {
    $runtimeReason = $_.Exception.Message
    Write-Output "Lokale TEST-runtime: BLOCKED — $runtimeReason"
}

$credentialsReady = $false
$credentialReason = $null
try {
    & $launcherPath -PayrollAcceptance -PayrollPersonaAcceptance -Port $preflightPort -PreflightOnly
    $credentialsReady = $true
} catch {
    $credentialReason = $_.Exception.Message
    Write-Output "Persona-credentials: BLOCKED — $credentialReason"
}

$browserResults = @()
if (-not $SkipBrowser) {
    $serverReady = $false
    try {
        $null = Invoke-WebRequest -Uri "$BaseUrl/login" -Method Get -TimeoutSec 5 -UseBasicParsing
        $serverReady = $true
    } catch {
        Write-Output 'Lokale browser: BLOCKED — start eerst de server met scripts/start-test-worktree.ps1 -PayrollAcceptance.'
    }

    if ($serverReady) {
        $node = Get-Command node.exe -ErrorAction SilentlyContinue
        if (-not $node) {
            Write-Output 'Lokale browser: BLOCKED — node.exe ontbreekt.'
        } else {
            $localAppData = [Environment]::GetEnvironmentVariable('LOCALAPPDATA')
            $personaConfigPath = if ([string]::IsNullOrWhiteSpace($localAppData)) { '' } else { Join-Path $localAppData 'LiquidHR/TestRuntime/payroll-test-personas.env' }
            $credentialReadyFlag = if ($credentialsReady) { 'true' } else { 'false' }
            $browserOutput = @(& $node.Source $browserCheckPath $catalogPath $BaseUrl $personaConfigPath $credentialReadyFlag 2>$null)
            $browserExitCode = $LASTEXITCODE
            foreach ($line in $browserOutput) {
                $value = [string]$line
                if (-not $value.StartsWith('PAYTEST_PERSONA_RESULT ')) { continue }
                try {
                    $browserResults += ($value.Substring('PAYTEST_PERSONA_RESULT '.Length) | ConvertFrom-Json)
                } catch {
                    $browserResults = @()
                    break
                }
            }
            if ($browserExitCode -ne 0 -and $browserResults.Count -eq 0) {
                Write-Output 'Lokale browser: BLOCKED — de persona-browsercheck kon niet veilig worden voltooid.'
            }
        }
    }
}

$catalogByKey = @{}
foreach ($persona in $catalog.personas) { $catalogByKey[$persona.key] = $persona }
$resultByKey = @{}
foreach ($result in $browserResults) { $resultByKey[$result.personaKey] = $result }

$hasBlocked = $false
foreach ($persona in $catalog.personas) {
    if ($resultByKey.ContainsKey($persona.key)) {
        $result = $resultByKey[$persona.key]
        if (-not $runtimeReady -and $runtimeReason) {
            $result.status = 'BLOCKED'
            $result.reasons = @($result.reasons) + "Lokale TEST-runtimepreflight faalde: $runtimeReason"
        }
        if (-not $credentialsReady -and $credentialReason -and @($result.reasons | Where-Object { $_ -like "*$credentialReason*" }).Count -eq 0) {
            $result.status = 'BLOCKED'
            $result.reasons = @($result.reasons) + "Persona-credentials faalden de preflight: $credentialReason"
        }
    } else {
        $reasons = [Collections.Generic.List[string]]::new()
        if ($SkipBrowser) {
            $reasons.Add('Browseracceptatie is met -SkipBrowser overgeslagen; geen READY-status zonder live bewijs.')
        } elseif (-not $runtimeReady -and $runtimeReason) {
            $reasons.Add("Lokale TEST-runtimepreflight faalde: $runtimeReason")
        } else {
            $reasons.Add('Lokale server/browseracceptatie is niet uitgevoerd.')
        }
        if (-not $credentialsReady -and $credentialReason) {
            $reasons.Add("Persona-credentials faalden de preflight: $credentialReason")
        }
        $result = [pscustomobject]@{ personaKey = $persona.key; status = 'BLOCKED'; reasons = @($reasons); expectedGaps = @() }
    }

    if ($result.status -eq 'BLOCKED') { $hasBlocked = $true }
    Write-Output "PERSONA $($result.personaKey): $($result.status)"
    foreach ($reason in @($result.reasons)) { Write-Output "  BLOCKER: $reason" }
    foreach ($gap in @($result.expectedGaps)) { Write-Output "  EXPECTED_GAP: $gap" }
}

if ($hasBlocked) { exit 2 }
exit 0
