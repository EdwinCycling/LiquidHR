[CmdletBinding()]
param(
    [ValidateSet('Development', 'Production')]
    [string]$Mode = 'Development',
    [ValidateRange(0, 65535)]
    [int]$Port = 0,
    [switch]$PayrollAcceptance,
    [switch]$Build,
    [switch]$PreflightOnly,
    [switch]$TestRunner,
    [Alias('Cleanup')]
    [switch]$StopTestRunner,
    [ValidateRange(1, 2147483647)]
    [int]$RuntimePid = 0,
    [ValidateRange(1, 300)]
    [int]$ReadyTimeoutSeconds = 60
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Build -and $Mode -ne 'Production') {
    throw '-Build is alleen toegestaan met -Mode Production.'
}
if ($Build -and $PreflightOnly) {
    throw '-Build en -PreflightOnly mogen niet tegelijk worden gebruikt.'
}
if ($Build -and $TestRunner) {
    throw '-Build en -TestRunner mogen niet tegelijk worden gebruikt; bouw eerst met de bestaande productieflow.'
}
if ($StopTestRunner -and -not $TestRunner) {
    throw '-StopTestRunner is alleen toegestaan met -TestRunner.'
}
if ($StopTestRunner -and $PreflightOnly) {
    throw '-StopTestRunner en -PreflightOnly mogen niet tegelijk worden gebruikt.'
}
if ($StopTestRunner -and ($RuntimePid -le 0 -or $Port -le 0)) {
    throw '-StopTestRunner vereist -RuntimePid en -Port uit de server die deze runner eerder heeft gestart.'
}
if (-not $StopTestRunner -and $RuntimePid -gt 0) {
    throw '-RuntimePid is alleen toegestaan met -StopTestRunner.'
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ($TestRunner -or $Mode -eq 'Production' -or $Build) {
    $gitRoot = (& git -C $repoRoot rev-parse --show-toplevel 2>$null).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($gitRoot) -or -not (Test-Path -LiteralPath $gitRoot -PathType Container)) {
        throw 'De exacte Git-worktree kon niet betrouwbaar worden vastgesteld.'
    }
    $repoRoot = (Resolve-Path -LiteralPath $gitRoot).Path
}
$appRoot = Join-Path $repoRoot 'apps/hr-suite'
$centralConfigRoot = [Environment]::GetEnvironmentVariable('LOCALAPPDATA')
if ([string]::IsNullOrWhiteSpace($centralConfigRoot)) {
    throw 'LOCALAPPDATA ontbreekt; de centrale TEST-configuratie is niet gevonden. Er is niets gekopieerd of gewijzigd.'
}

$centralConfig = Join-Path $centralConfigRoot 'LiquidHR/TestRuntime/.env.local'
if (-not (Test-Path -LiteralPath $centralConfig -PathType Leaf)) {
    throw 'De centrale lokale TEST-configuratie ontbreekt. Er is geen alternatieve configuratie gemaakt of gebruikt.'
}

# Next.js can load several .env* files after Node has loaded the central config.
# Reject sidecars before building or starting so they cannot override runtime
# values or add public build values outside the provenance fingerprint.
$unexpectedEnvFiles = [Collections.Generic.List[string]]::new()
foreach ($envRoot in @(
    [pscustomobject]@{ Path = $repoRoot; Label = 'repositoryroot'; AllowExample = $false; AllowCentralLink = $false },
    [pscustomobject]@{ Path = $appRoot; Label = 'apps/hr-suite'; AllowExample = $true; AllowCentralLink = $true }
)) {
    foreach ($envEntry in @(Get-ChildItem -LiteralPath $envRoot.Path -Force -Filter '.env*' -ErrorAction Stop)) {
        $allowed = $false
        if ($envRoot.AllowExample -and $envEntry.Name -ieq '.env.example' -and -not $envEntry.PSIsContainer) {
            $allowed = $true
        }
        if ($envRoot.AllowCentralLink -and $envEntry.Name -ieq '.env.local' -and -not $envEntry.PSIsContainer) {
            $allowed = $true
        }
        if (-not $allowed) {
            $unexpectedEnvFiles.Add("$($envRoot.Label): $($envEntry.Name)")
        }
    }
}
if ($unexpectedEnvFiles.Count -gt 0) {
    throw ".env*-bestanden buiten de toegestane set gevonden: $($unexpectedEnvFiles -join ', '). Alleen bestandsnamen zijn gecontroleerd; niets is geopend of gewijzigd."
}

# Een eventueel lokaal .env.local-bestand moet aantoonbaar naar dezelfde centrale
# file verwijzen. Alleen filesystemmetadata wordt gecontroleerd; de inhoud wordt
# niet geopend of gekopieerd.
$worktreeConfig = Join-Path $appRoot '.env.local'
if (Test-Path -LiteralPath $worktreeConfig -PathType Leaf) {
    $configItem = Get-Item -LiteralPath $worktreeConfig -Force
    $hardLinkPaths = @(& fsutil.exe hardlink list $worktreeConfig 2>$null)
    $hardLinkExitCode = $LASTEXITCODE
    $canonicalRelativePath = $centralConfig.Substring([IO.Path]::GetPathRoot($centralConfig).Length).TrimStart('\')
    $expectedHardLinkPath = '\' + $canonicalRelativePath
    $isCentralLink = $hardLinkExitCode -eq 0 -and @(
        $hardLinkPaths |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ -ieq $expectedHardLinkPath }
    ).Count -gt 0

    if (-not $isCentralLink -and ($configItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        $linkTarget = @($configItem.Target)[0]
        if ([string]::IsNullOrWhiteSpace($linkTarget)) {
            throw 'De worktree-configuratiekoppeling heeft geen verifieerbaar doel. Er is niets gestart of gewijzigd.'
        }
        if (-not [IO.Path]::IsPathRooted($linkTarget)) {
            $linkTarget = Join-Path $configItem.DirectoryName $linkTarget
        }
        $resolvedTarget = (Resolve-Path -LiteralPath $linkTarget).Path
        $resolvedCanonical = (Resolve-Path -LiteralPath $centralConfig).Path
        if ([string]::Equals($resolvedTarget, $resolvedCanonical, [StringComparison]::OrdinalIgnoreCase)) {
            $isCentralLink = $true
        }
    }

    if (-not $isCentralLink) {
        if ($hardLinkExitCode -ne 0 -and -not ($configItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'De worktree-configuratie kon niet als centrale hardlink worden geverifieerd. Het bestand is niet geopend of gewijzigd.'
        } else {
            throw 'De worktree-configuratie verwijst niet naar de centrale TEST-configuratie. Er is niets gestart of gewijzigd.'
        }
    }
}

# Voorkom dat geërfde runtime-instellingen de centrale bron overrulen. Dit is
# dezelfde complete naamfamilie die de runner-identiteit hieronder fingerprint.
$runtimeEnvironmentNamePattern = '^(NEXT_|SUPABASE_|PAYROLL_|PAYLAB_|LIQUIDHR_|TALENT_|AI_|OPENAI_|GEMINI_|BSN_|EMPLOYEE_|TURNSTILE_|RECRUITMENT_|GEOAPIFY_|AXE_|DG1_|AUTH_|NEXTAUTH_|DATABASE_|POSTGRES_|STRIPE_|SENTRY_|GOOGLE_|RESEND_|SMTP_|AWS_|CLOUDINARY_|TWILIO_|SENDGRID_|GITHUB_|CRON_SECRET$|NODE_(ENV|OPTIONS|PATH|EXTRA_CA_CERTS|TLS_REJECT_UNAUTHORIZED|DEBUG|NO_WARNINGS|PENDING_DEPRECATION|PRESERVE_SYMLINKS|DISABLE_COLORS|V8_COVERAGE)$|VERCEL(?:_|$)|PORT$|HOSTNAME$)'
$shadowedRuntimeNames = @(
    Get-ChildItem Env: |
        Where-Object { $_.Name -match $runtimeEnvironmentNamePattern } |
        ForEach-Object { $_.Name } |
        Sort-Object -Unique
)
if ($shadowedRuntimeNames.Count -gt 0) {
    throw "Deze PowerShell-sessie bevat al runtimevariabelen die de centrale TEST-config kunnen overrulen: $($shadowedRuntimeNames -join ', '). Start vanuit een schone sessie; waarden zijn niet gelezen of getoond."
}

$node = Get-Command node.exe -ErrorAction Stop
$nodeVersionOutput = (& $node.Source --version).Trim()
if ($LASTEXITCODE -ne 0 -or $nodeVersionOutput -notmatch '^v(?<version>\d+\.\d+\.\d+)') {
    throw 'Node.js kon niet betrouwbaar worden geverifieerd.'
}
$nodeVersion = [Version]$Matches.version
if ($nodeVersion -lt [Version]'20.12.0') {
    throw "Node.js $nodeVersionOutput is te oud voor deze geïsoleerde TEST-runtime; minimaal 20.12.0 is vereist."
}

$nextCliCandidates = @(
    (Join-Path $appRoot 'node_modules/next/dist/bin/next'),
    (Join-Path $repoRoot 'node_modules/next/dist/bin/next')
)
$nextCli = $nextCliCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $nextCli) {
    throw 'De bestaande Next.js-dependencies ontbreken in deze worktree. Het script installeert niets.'
}

$packagePath = Join-Path $appRoot 'package.json'
$lockPath = Join-Path $repoRoot 'package-lock.json'
if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf) -or -not (Test-Path -LiteralPath $lockPath -PathType Leaf)) {
    throw 'package.json of package-lock.json ontbreekt; dependency-state is niet verifieerbaar.'
}
$package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($package.scripts.build) -or [string]::IsNullOrWhiteSpace($package.scripts.start)) {
    throw 'De bestaande build- of startscript ontbreekt in apps/hr-suite/package.json.'
}

$npm = Get-Command npm.cmd -ErrorAction Stop
Push-Location $repoRoot
$previousErrorActionPreference = $ErrorActionPreference
try {
    # npm writes informational notices to stderr even when dependency validation succeeds.
    # Keep the command's real exit code as the gate without promoting that stderr to a script exception.
    $ErrorActionPreference = 'Continue'
    & $npm.Source ls --workspaces --depth=0 --json *> $null
    $dependencyExitCode = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $previousErrorActionPreference
    Pop-Location
}
if ($dependencyExitCode -ne 0) {
    throw 'De bestaande workspace-dependencyboom is niet compleet of consistent. Er is niets geïnstalleerd of gewijzigd; herstel dependencies apart met de repository-lockfile.'
}

$requiredGroupsJson = '[ ["NEXT_PUBLIC_SUPABASE_URL"], ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"], ["SUPABASE_SECRET_KEY"]'
if ($PayrollAcceptance) {
    $requiredGroupsJson += ', ["PAYROLL_SUPABASE_URL"], ["PAYROLL_SUPABASE_SECRET_KEY"], ["PAYROLL_LAB_ENABLED"]'
}
$requiredGroupsJson += ' ]'
$requiredGroupsBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($requiredGroupsJson))
$requiredGroupsBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($requiredGroupsJson))
$requirePayrollJson = if ($PayrollAcceptance) { 'true' } else { 'false' }
$configProbe = @'
process.loadEnvFile(process.argv[1]);
const groups = JSON.parse(Buffer.from(process.argv[2], 'base64').toString('utf8'));
const requirePayroll = process.argv[3] === 'true';
const missing = groups
  .filter((group) => !group.some((name) => (process.env[name] ?? '').trim().length > 0))
  .map((group) => group.join(' or '));
const unsupported = [];
if ((process.env.NODE_OPTIONS ?? '').trim()) unsupported.push('NODE_OPTIONS');
const canonicalTestHosts = {
  NEXT_PUBLIC_SUPABASE_URL: 'wnpfloqpjvaacobppbpk.supabase.co',
  PAYROLL_SUPABASE_URL: 'jhgeriucbkfarxiudzfy.supabase.co',
};
const invalidTargets = Object.entries(canonicalTestHosts)
  .filter(([name]) => requirePayroll || Boolean(process.env[name]))
  .filter(([name, host]) => {
    try {
      const target = new URL(process.env[name] ?? '');
      return target.protocol !== 'https:' || target.hostname !== host || target.port !== '' ||
        target.username !== '' || target.password !== '' || !['', '/'].includes(target.pathname) ||
        target.search !== '' || target.hash !== '';
    } catch {
      return true;
    }
  })
  .map(([name]) => name);
if (requirePayroll && process.env.PAYROLL_LAB_ENABLED !== 'true') {
  missing.push('PAYROLL_LAB_ENABLED=true');
}
if (process.env.PAYROLL_LAB_ENABLED === 'true' && !requirePayroll) {
  for (const name of ['PAYROLL_SUPABASE_URL', 'PAYROLL_SUPABASE_SECRET_KEY']) {
    if (!(process.env[name] ?? '').trim()) missing.push(name);
  }
}
if (missing.length > 0 || invalidTargets.length > 0 || unsupported.length > 0) {
  if (missing.length > 0) console.error(`Ontbrekende TEST-runtimevelden (alleen namen): ${missing.join(', ')}`);
  if (invalidTargets.length > 0) console.error(`Runtime-URL wijst niet naar het goedgekeurde TEST-project (alleen veldnamen): ${invalidTargets.join(', ')}`);
  if (unsupported.length > 0) console.error(`Niet-ondersteunde TEST-runtimevelden (alleen namen): ${unsupported.join(', ')}`);
  process.exitCode = 2;
} else {
  console.log('Centrale TEST-configuratie: vereiste variabelen aanwezig; waarden verborgen.');
}
'@
$configProbeOutput = & $node.Source -e $configProbe $centralConfig $requiredGroupsBase64 $requirePayrollJson 2>&1
$configProbeExitCode = $LASTEXITCODE
if ($configProbeExitCode -ne 0) {
    throw 'De centrale TEST-configuratie bevat niet alle vereiste runtimevelden; waarden zijn niet getoond.'
}
if (-not $TestRunner) {
    $configProbeOutput | Write-Host
}

$publicFingerprintProbe = @'
process.loadEnvFile(process.argv[1]);
const { createHash } = require('node:crypto');
const hash = createHash('sha256');
for (const [name, value] of Object.entries(process.env)
  .filter(([name]) => name.startsWith('NEXT_PUBLIC_'))
  .sort(([left], [right]) => left.localeCompare(right))) {
  hash.update(name).update('\0').update(value).update('\n');
}
process.stdout.write(hash.digest('hex'));
'@
$publicRuntimeFingerprint = (& $node.Source -e $publicFingerprintProbe $centralConfig).Trim()
if ($LASTEXITCODE -ne 0 -or $publicRuntimeFingerprint -notmatch '^[a-f0-9]{64}$') {
    throw 'De publieke runtimeconfiguratiehash kon niet veilig worden gecontroleerd.'
}

$gitCommit = $null
$runtimeConfigIdentity = $null
$runtimeHost = '127.0.0.1'
$nextDirectory = Join-Path $appRoot '.next'
$runtimeMetadataPath = Join-Path $nextDirectory 'liquidhr-test-runtime.json'
$runtimeLockPath = Join-Path $nextDirectory 'liquidhr-test-runtime.lock'
if ($TestRunner -or $Mode -eq 'Production') {
    $gitCommit = (& git -C $repoRoot rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $gitCommit -notmatch '^[a-f0-9]{40}$') {
        throw 'De huidige worktree-commit kon niet betrouwbaar worden vastgesteld.'
    }
}
if ($TestRunner) {
    $runtimeConfigIdentityProbe = @'
process.loadEnvFile(process.argv[1]);
const { createHash } = require('node:crypto');
const hash = createHash('sha256');
const runtimeName = /^(NEXT_|SUPABASE_|PAYROLL_|PAYLAB_|LIQUIDHR_|TALENT_|AI_|OPENAI_|GEMINI_|BSN_|EMPLOYEE_|TURNSTILE_|RECRUITMENT_|GEOAPIFY_|AXE_|DG1_|AUTH_|NEXTAUTH_|DATABASE_|POSTGRES_|STRIPE_|SENTRY_|GOOGLE_|RESEND_|SMTP_|AWS_|CLOUDINARY_|TWILIO_|SENDGRID_|GITHUB_|CRON_SECRET$|NODE_(ENV|OPTIONS|PATH|EXTRA_CA_CERTS|TLS_REJECT_UNAUTHORIZED|DEBUG|NO_WARNINGS|PENDING_DEPRECATION|PRESERVE_SYMLINKS|DISABLE_COLORS|V8_COVERAGE)$|VERCEL(?:_|$)|PORT$|HOSTNAME$)/;
for (const [name, value] of Object.entries(process.env)
  .filter(([name]) => runtimeName.test(name))
  .sort(([left], [right]) => left.localeCompare(right))) {
  hash.update(name).update('\0').update(value).update('\n');
}
process.stdout.write(hash.digest('hex'));
'@
    $runtimeConfigIdentity = (& $node.Source -e $runtimeConfigIdentityProbe $centralConfig).Trim()
    if ($LASTEXITCODE -ne 0 -or $runtimeConfigIdentity -notmatch '^[a-f0-9]{64}$') {
        throw 'De centrale TEST-runtime-identiteit kon niet veilig worden gecontroleerd.'
    }
}

$resolvedPort = if ($Port -gt 0) {
    $Port
} elseif ($Mode -eq 'Production') {
    3011
} else {
    3010
}

if ($Mode -eq 'Production' -and -not $Build) {
    $buildIdPath = Join-Path $appRoot '.next/BUILD_ID'
    $buildServerPath = Join-Path $appRoot '.next/server'
    $buildProvenancePath = Join-Path $appRoot '.next/liquidhr-build-provenance.json'
    if (-not (Test-Path -LiteralPath $buildIdPath -PathType Leaf) -or -not (Test-Path -LiteralPath $buildServerPath -PathType Container)) {
        throw 'De bestaande productiebuild ontbreekt of is onvolledig. Dit startscript bouwt niet automatisch.'
    }
    $buildId = (Get-Content -LiteralPath $buildIdPath -Raw).Trim()
    if ([string]::IsNullOrWhiteSpace($buildId) -or -not (Test-Path -LiteralPath $buildProvenancePath -PathType Leaf)) {
        throw 'De productiebuild mist verifieerbare bron- en runtimeprovenance; bouw opnieuw met de goedgekeurde TEST-runtimeconfiguratie.'
    }

    $gitCommit = (& git -C $repoRoot rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $gitCommit -notmatch '^[a-f0-9]{40}$') {
        throw 'De huidige worktree-commit kon niet betrouwbaar worden vastgesteld.'
    }
    $dirtyTracked = @(& git -C $repoRoot status --porcelain --untracked-files=all -- . ':(exclude)apps/hr-suite/next-env.d.ts')
    if ($LASTEXITCODE -ne 0 -or $dirtyTracked.Count -gt 0) {
        throw 'De huidige worktree bevat bronwijzigingen; bouw en start alleen vanaf een schoon, vastgelegd kandidaat.'
    }

    $buildProvenance = Get-Content -LiteralPath $buildProvenancePath -Raw | ConvertFrom-Json
    if ($buildProvenance.schemaVersion -ne 1 -or
        $buildProvenance.sourceCommit -ne $gitCommit -or
        $buildProvenance.buildId -ne $buildId -or
        $buildProvenance.publicRuntimeFingerprint -ne $publicRuntimeFingerprint) {
        throw 'De productiebuild hoort niet bij deze exacte commit en centrale TEST-public runtimeconfiguratie. Bouw opnieuw met de goedgekeurde TEST-runtimeconfiguratie.'
    }
}

function Assert-LoopbackPortAvailable {
    param([Parameter(Mandatory)][int]$CandidatePort)

    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $CandidatePort)
    try {
        $listener.Start()
    } catch {
        throw "Poort $CandidatePort is al bezet. Er is geen proces gestopt."
    } finally {
        $listener.Stop()
    }
}

function Test-LoopbackPortAvailable {
    param([Parameter(Mandatory)][int]$CandidatePort)

    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $CandidatePort)
    try {
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        try { $listener.Stop() } catch { }
    }
}

function Get-FirstFreeLoopbackPort {
    param([int]$StartPort = 3000)

    for ($candidatePort = $StartPort; $candidatePort -le 65535; $candidatePort++) {
        if (Test-LoopbackPortAvailable -CandidatePort $candidatePort) {
            return $candidatePort
        }
    }
    throw "Geen vrije loopback-poort gevonden vanaf $StartPort. Er is geen proces gestopt."
}

function ConvertTo-ProcessArgument {
    param([Parameter(Mandatory)][string]$Value)

    if ($Value -notmatch '[\s"]') {
        return $Value
    }

    $escaped = $Value -replace '(\\*)"', '$1$1\"'
    $escaped = $escaped -replace '(\\+)$', '$1$1'
    return '"' + $escaped + '"'
}

function Get-ProcessCreationUtc {
    param([Parameter(Mandatory)]$ProcessRecord)

    if ($null -eq $ProcessRecord.CreationDate) {
        return $null
    }
    try {
        if ($ProcessRecord.CreationDate -is [DateTime]) {
            return ([DateTime]$ProcessRecord.CreationDate).ToUniversalTime()
        }
        return [Management.ManagementDateTimeConverter]::ToDateTime([string]$ProcessRecord.CreationDate).ToUniversalTime()
    } catch {
        return $null
    }
}

function Test-NextProcessCommandLine {
    param(
        [Parameter(Mandatory)][string]$CommandLine,
        [Parameter(Mandatory)][string]$AppPath,
        [Parameter(Mandatory)][string]$NextCliPath,
        [Parameter(Mandatory)][string]$CentralConfigPath,
        [Parameter(Mandatory)][ValidateSet('Development', 'Production')][string]$RuntimeMode,
        [Parameter(Mandatory)][string]$HostAddress,
        [Parameter(Mandatory)][int]$RuntimePort
    )

    if ([string]::IsNullOrWhiteSpace($CommandLine)) {
        return $false
    }
    $normalizedCommandLine = $CommandLine.Replace('/', '\').ToLowerInvariant()
    $normalizedAppPath = $AppPath.Replace('/', '\').ToLowerInvariant()
    $normalizedNextCliPath = $NextCliPath.Replace('/', '\').ToLowerInvariant()
    $normalizedConfigPath = $CentralConfigPath.Replace('/', '\').ToLowerInvariant()
    $normalizedHost = $HostAddress.ToLowerInvariant()
    $modeToken = if ($RuntimeMode -eq 'Development') { 'dev' } else { 'start' }
    $modePattern = "(^|\s)$([Regex]::Escape($modeToken))(\s|$)"
    $hostPattern = "(^|\s)--hostname\s+$([Regex]::Escape($normalizedHost))(\s|$)"
    $portMatches = $RuntimePort -eq 0 -or $normalizedCommandLine -match "(^|\s)--port\s+$RuntimePort(\s|$)"

    return $normalizedCommandLine.Contains($normalizedAppPath) -and
        $normalizedCommandLine.Contains($normalizedNextCliPath) -and
        $normalizedCommandLine.Contains("--env-file=$normalizedConfigPath") -and
        $normalizedCommandLine -match $modePattern -and
        $normalizedCommandLine -match $hostPattern -and
        $portMatches -and
        ($RuntimeMode -eq 'Production' -or $normalizedCommandLine -match '(^|\s)--webpack(\s|$)')
}

function Get-NextProcessRecordById {
    param(
        [Parameter(Mandatory)][int]$ProcessId,
        [Parameter(Mandatory)][string]$AppPath,
        [Parameter(Mandatory)][string]$NextCliPath,
        [Parameter(Mandatory)][string]$CentralConfigPath,
        [Parameter(Mandatory)][ValidateSet('Development', 'Production')][string]$RuntimeMode,
        [Parameter(Mandatory)][string]$HostAddress,
        [Parameter(Mandatory)][int]$RuntimePort
    )

    try {
        $record = @(Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop | Select-Object -First 1)[0]
    } catch {
        throw 'Het proces-eigenaarschap kon niet veilig worden gecontroleerd; er is geen tweede Next.js-server gestart.'
    }
    if ($null -eq $record -or $record.Name -ine 'node.exe' -or
        -not (Test-NextProcessCommandLine -CommandLine ([string]$record.CommandLine) -AppPath $AppPath -NextCliPath $NextCliPath `
            -CentralConfigPath $CentralConfigPath -RuntimeMode $RuntimeMode -HostAddress $HostAddress -RuntimePort $RuntimePort)) {
        return $null
    }
    $creationUtc = Get-ProcessCreationUtc -ProcessRecord $record
    if ($null -eq $creationUtc) {
        throw 'Het Next.js-proces heeft geen parseerbare creation time; er is geen tweede Next.js-server gestart.'
    }
    return [pscustomobject]@{
        Pid = [int]$record.ProcessId
        CreationUtc = $creationUtc
        CommandLineMatches = $true
    }
}

function Test-ProcessIdAlive {
    param([Parameter(Mandatory)][int]$ProcessId)

    $process = $null
    try {
        $process = Get-Process -Id $ProcessId -ErrorAction Stop
        return $true
    } catch {
        if ($_.FullyQualifiedErrorId -like 'NoProcessFoundForGivenId,*') {
            return $false
        }
        throw 'Het proces-eigenaarschap kon niet veilig worden gecontroleerd; er is geen tweede Next.js-server gestart.'
    } finally {
        if ($null -ne $process) {
            $process.Dispose()
        }
    }
}

function Get-NextProcessRecords {
    param(
        [Parameter(Mandatory)][string]$AppPath,
        [Parameter(Mandatory)][string]$NextCliPath,
        [Parameter(Mandatory)][string]$CentralConfigPath,
        [Parameter(Mandatory)][ValidateSet('Development', 'Production')][string]$RuntimeMode,
        [Parameter(Mandatory)][string]$HostAddress,
        [Parameter(Mandatory)][int]$RuntimePort
    )

    try {
        $records = @(Get-CimInstance -ClassName Win32_Process -Filter "Name = 'node.exe'" -ErrorAction Stop)
    } catch {
        throw 'Het proces-eigenaarschap kon niet veilig worden gecontroleerd; er is geen tweede Next.js-server gestart.'
    }
    $matches = [Collections.Generic.List[object]]::new()
    foreach ($record in $records) {
        if (Test-NextProcessCommandLine -CommandLine ([string]$record.CommandLine) -AppPath $AppPath -NextCliPath $NextCliPath `
            -CentralConfigPath $CentralConfigPath -RuntimeMode $RuntimeMode -HostAddress $HostAddress -RuntimePort $RuntimePort) {
            $creationUtc = Get-ProcessCreationUtc -ProcessRecord $record
            if ($null -eq $creationUtc) {
                throw 'Een bestaand Next.js-proces heeft geen parseerbare creation time; er is geen tweede Next.js-server gestart.'
            }
            $matches.Add([pscustomobject]@{
                Pid = [int]$record.ProcessId
                CreationUtc = $creationUtc
                CommandLineMatches = $true
            })
        }
    }
    return @($matches)
}

function Test-NextProcessAppIdentity {
    param(
        [Parameter(Mandatory)][string]$CommandLine,
        [Parameter(Mandatory)][string]$AppPath,
        [Parameter(Mandatory)][string]$NextCliPath
    )

    if ([string]::IsNullOrWhiteSpace($CommandLine)) {
        return $false
    }
    $normalizedCommandLine = $CommandLine.Replace('/', '\').ToLowerInvariant()
    return $normalizedCommandLine.Contains($AppPath.Replace('/', '\').ToLowerInvariant()) -and
        $normalizedCommandLine.Contains($NextCliPath.Replace('/', '\').ToLowerInvariant())
}

function Get-NextProcessRecordsByApp {
    param(
        [Parameter(Mandatory)][string]$AppPath,
        [Parameter(Mandatory)][string]$NextCliPath
    )

    try {
        $records = @(Get-CimInstance -ClassName Win32_Process -Filter "Name = 'node.exe'" -ErrorAction Stop)
    } catch {
        throw 'Het proces-eigenaarschap kon niet veilig worden gecontroleerd; er is geen tweede Next.js-server gestart.'
    }
    $matches = [Collections.Generic.List[object]]::new()
    foreach ($record in $records) {
        if (Test-NextProcessAppIdentity -CommandLine ([string]$record.CommandLine) -AppPath $AppPath -NextCliPath $NextCliPath) {
            $creationUtc = Get-ProcessCreationUtc -ProcessRecord $record
            if ($null -eq $creationUtc) {
                throw 'Een bestaand Next.js-proces heeft geen parseerbare creation time; er is geen tweede Next.js-server gestart.'
            }
            $matches.Add([pscustomobject]@{
                Pid = [int]$record.ProcessId
                CreationUtc = $creationUtc
                CommandLineMatches = $true
            })
        }
    }
    return @($matches)
}

function Read-TestRuntimeMetadata {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return [pscustomobject]@{ Exists = $false; Invalid = $false; Data = $null }
    }
    try {
        $data = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
        return [pscustomobject]@{ Exists = $true; Invalid = $false; Data = $data }
    } catch {
        return [pscustomobject]@{ Exists = $true; Invalid = $true; Data = $null }
    }
}

function Get-MetadataProperty {
    param(
        [Parameter(Mandatory)]$Metadata,
        [Parameter(Mandatory)][string]$Name
    )

    $property = $Metadata.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }
    return $property.Value
}

function Test-TestRuntimeMetadataIdentity {
    param(
        [Parameter(Mandatory)]$Metadata,
        [Parameter(Mandatory)][string]$ExpectedWorktree,
        [Parameter(Mandatory)][string]$ExpectedHead,
        [Parameter(Mandatory)][string]$ExpectedConfigIdentity,
        [Parameter(Mandatory)][string]$ExpectedMode,
        [string]$ExpectedAppRoot = '',
        [string]$ExpectedNextCli = '',
        [string]$ExpectedConfigPath = '',
        [string]$ExpectedHost = '127.0.0.1',
        [int]$ExpectedPort = 0
    )

    $portValue = Get-MetadataProperty -Metadata $Metadata -Name 'port'
    $pidValue = Get-MetadataProperty -Metadata $Metadata -Name 'pid'
    $startedAtValue = Get-MetadataProperty -Metadata $Metadata -Name 'startedAtUtc'
    $startedAt = [DateTime]::MinValue
    $startedAtParsed = if ($startedAtValue -is [DateTime]) {
        $startedAt = ([DateTime]$startedAtValue).ToUniversalTime()
        $true
    } elseif ($startedAtValue -is [string]) {
        [DateTime]::TryParse(
            [string]$startedAtValue,
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::RoundtripKind,
            [ref]$startedAt
        )
    } else {
        $false
    }
    if ((Get-MetadataProperty -Metadata $Metadata -Name 'schemaVersion') -ne 1 -or
        (Get-MetadataProperty -Metadata $Metadata -Name 'worktree') -isnot [string] -or
        (Get-MetadataProperty -Metadata $Metadata -Name 'head') -isnot [string] -or
        (Get-MetadataProperty -Metadata $Metadata -Name 'configIdentity') -isnot [string] -or
        (Get-MetadataProperty -Metadata $Metadata -Name 'mode') -isnot [string] -or
        (Get-MetadataProperty -Metadata $Metadata -Name 'appRoot') -isnot [string] -or
        (Get-MetadataProperty -Metadata $Metadata -Name 'nextCli') -isnot [string] -or
        (Get-MetadataProperty -Metadata $Metadata -Name 'configPath') -isnot [string] -or
        (Get-MetadataProperty -Metadata $Metadata -Name 'host') -isnot [string] -or
        (($portValue -isnot [int]) -and ($portValue -isnot [long])) -or
        (($pidValue -isnot [int]) -and ($pidValue -isnot [long])) -or
        (Get-MetadataProperty -Metadata $Metadata -Name 'url') -isnot [string] -or
        -not $startedAtParsed) {
        return $false
    }

    $port = [int](Get-MetadataProperty -Metadata $Metadata -Name 'port')
    $metadataHost = [string](Get-MetadataProperty -Metadata $Metadata -Name 'host')
    $expectedUrl = "http://$metadataHost`:$port"
    return [string]::Equals((Get-MetadataProperty -Metadata $Metadata -Name 'worktree'), $ExpectedWorktree, [StringComparison]::OrdinalIgnoreCase) -and
        [string]::Equals((Get-MetadataProperty -Metadata $Metadata -Name 'head'), $ExpectedHead, [StringComparison]::OrdinalIgnoreCase) -and
        [string]::Equals((Get-MetadataProperty -Metadata $Metadata -Name 'configIdentity'), $ExpectedConfigIdentity, [StringComparison]::Ordinal) -and
        [string]::Equals((Get-MetadataProperty -Metadata $Metadata -Name 'mode'), $ExpectedMode, [StringComparison]::Ordinal) -and
        ([string]::IsNullOrWhiteSpace($ExpectedAppRoot) -or [string]::Equals((Get-MetadataProperty -Metadata $Metadata -Name 'appRoot'), $ExpectedAppRoot, [StringComparison]::OrdinalIgnoreCase)) -and
        ([string]::IsNullOrWhiteSpace($ExpectedNextCli) -or [string]::Equals((Get-MetadataProperty -Metadata $Metadata -Name 'nextCli'), $ExpectedNextCli, [StringComparison]::OrdinalIgnoreCase)) -and
        ([string]::IsNullOrWhiteSpace($ExpectedConfigPath) -or [string]::Equals((Get-MetadataProperty -Metadata $Metadata -Name 'configPath'), $ExpectedConfigPath, [StringComparison]::OrdinalIgnoreCase)) -and
        [string]::Equals($metadataHost, $ExpectedHost, [StringComparison]::OrdinalIgnoreCase) -and
        $port -ge 1 -and $port -le 65535 -and
        ($ExpectedPort -eq 0 -or $port -eq $ExpectedPort) -and
        [int](Get-MetadataProperty -Metadata $Metadata -Name 'pid') -gt 0 -and
        [string]::Equals((Get-MetadataProperty -Metadata $Metadata -Name 'url'), $expectedUrl, [StringComparison]::Ordinal)
}

function Wait-ForLoginReady {
    param(
        [Parameter(Mandatory)][string]$Url,
        [Parameter(Mandatory)][int]$TimeoutSeconds,
        [System.Diagnostics.Process]$OwnedProcess
    )

    $client = [Net.Http.HttpClient]::new()
    $client.Timeout = [TimeSpan]::FromMilliseconds(1500)
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    try {
        while ([DateTime]::UtcNow -lt $deadline) {
            if ($null -ne $OwnedProcess -and $OwnedProcess.HasExited) {
                return $false
            }
            try {
                $response = $client.GetAsync($Url).GetAwaiter().GetResult()
                $statusCode = [int]$response.StatusCode
                $response.Dispose()
                if ($statusCode -ge 200 -and $statusCode -lt 400) {
                    return $true
                }
            } catch {
                # The development server can need several seconds before /login responds.
            }
            Start-Sleep -Milliseconds 250
        }
        return $false
    } finally {
        $client.Dispose()
    }
}

function Acquire-TestRuntimeLock {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][int]$TimeoutSeconds
    )

    $parentDirectory = Split-Path -Parent $Path
    [void](New-Item -ItemType Directory -Path $parentDirectory -Force)
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            return [IO.FileStream]::new($Path, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        } catch [IO.IOException] {
            Start-Sleep -Milliseconds 250
        } catch [UnauthorizedAccessException] {
            throw 'Het test-runtime-lockbestand kon niet exclusief worden geopend; er is geen tweede Next.js-server gestart.'
        }
    }
    throw 'Een andere test-runner houdt het runtime-lockbestand vast; er is geen tweede Next.js-server gestart.'
}

function Write-TestRuntimeMetadata {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)]$Metadata
    )

    $temporaryPath = "$Path.$PID.tmp"
    $json = $Metadata | ConvertTo-Json -Depth 4 -Compress
    try {
        [IO.File]::WriteAllText($temporaryPath, $json, [Text.UTF8Encoding]::new($false))
        [void](Move-Item -LiteralPath $temporaryPath -Destination $Path -Force)
    } finally {
        if (Test-Path -LiteralPath $temporaryPath -PathType Leaf) {
            Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Start-TestRuntimeProcess {
    param(
        [Parameter(Mandatory)][string]$NodePath,
        [Parameter(Mandatory)][string]$CentralConfigPath,
        [Parameter(Mandatory)][string]$NextCliPath,
        [Parameter(Mandatory)][string]$WorkingDirectory,
        [Parameter(Mandatory)][ValidateSet('Development', 'Production')][string]$RuntimeMode,
        [Parameter(Mandatory)][string]$HostAddress,
        [Parameter(Mandatory)][int]$RuntimePort
    )

    $bootstrap = @'
const process = require('node:process');
const [envFileArgument, workingDirectory, nextCliPath, ...nextArgs] = process.argv.slice(1);
const envFilePrefix = '--env-file=';
if (!envFileArgument || !envFileArgument.startsWith(envFilePrefix)) {
  throw new Error('The central TEST config argument is invalid.');
}
process.loadEnvFile(envFileArgument.slice(envFilePrefix.length));
if ((process.env.NODE_OPTIONS ?? '').trim()) {
  throw new Error('NODE_OPTIONS is unsupported by the isolated TEST runtime.');
}
process.chdir(workingDirectory);
process.execArgv = [];
process.argv = [process.execPath, nextCliPath, ...nextArgs];
require(nextCliPath);
'@
    $arguments = [Collections.Generic.List[string]]::new()
    $arguments.Add('-e')
    $arguments.Add($bootstrap)
    $arguments.Add('--')
    $arguments.Add("--env-file=$CentralConfigPath")
    $arguments.Add($WorkingDirectory)
    $arguments.Add($NextCliPath)
    if ($RuntimeMode -eq 'Development') {
        $arguments.Add('dev')
        $arguments.Add('--webpack')
    } else {
        $arguments.Add('start')
    }
    $arguments.Add('--hostname')
    $arguments.Add($HostAddress)
    $arguments.Add('--port')
    $arguments.Add([string]$RuntimePort)

    try {
        # Start-Process rejects identical redirection strings before opening them.
        # NUL and NUL. are both Windows null devices, so neither stream is persisted
        # or exposed while PowerShell still sees distinct targets.
        # UseNewEnvironment excludes the caller's user/session environment. The
        # Node bootstrap loads the central config and passes its marker after `--`.
        $process = Start-Process -FilePath $NodePath `
            -ArgumentList (($arguments | ForEach-Object { ConvertTo-ProcessArgument -Value $_ }) -join ' ') `
            -WorkingDirectory $WorkingDirectory -PassThru -WindowStyle Hidden -UseNewEnvironment `
            -RedirectStandardOutput 'NUL' -RedirectStandardError 'NUL.'
        return $process
    } catch {
        throw 'Next.js kon niet veilig worden gestart.'
    }
}

function Stop-OwnedTestRuntimeProcess {
    param([System.Diagnostics.Process]$Process)

    if ($null -eq $Process) {
        return
    }
    try {
        if (-not $Process.HasExited) {
            $Process.Kill()
            $Process.WaitForExit(5000)
        }
    } catch {
        # The caller still receives the readiness failure; no unrelated process is touched.
    }
}

function Test-NextLockFiles {
    param([Parameter(Mandatory)][string]$NextDirectory)

    foreach ($candidatePath in @(
        (Join-Path $NextDirectory 'dev/lock'),
        (Join-Path $NextDirectory 'lock')
    )) {
        if (Test-Path -LiteralPath $candidatePath -PathType Leaf) {
            return $true
        }
    }
    return $false
}

function Invoke-TestRuntimeStop {
    param(
        [Parameter(Mandatory)][string]$RuntimeRepoRoot,
        [Parameter(Mandatory)][string]$RuntimeAppRoot,
        [Parameter(Mandatory)][string]$RuntimeMetadataPath,
        [Parameter(Mandatory)][string]$RuntimeLockPath,
        [Parameter(Mandatory)][string]$RuntimeCentralConfig,
        [Parameter(Mandatory)][string]$RuntimeNextCli,
        [Parameter(Mandatory)][ValidateSet('Development', 'Production')][string]$RuntimeMode,
        [Parameter(Mandatory)][string]$RuntimeHost,
        [Parameter(Mandatory)][string]$RuntimeHead,
        [Parameter(Mandatory)][string]$RuntimeConfigIdentity,
        [Parameter(Mandatory)][int]$RequestedPid,
        [int]$RequestedPort = 0,
        [Parameter(Mandatory)][int]$TimeoutSeconds
    )

    $runtimeLock = Acquire-TestRuntimeLock -Path $RuntimeLockPath -TimeoutSeconds $TimeoutSeconds
    try {
        $metadataState = Read-TestRuntimeMetadata -Path $RuntimeMetadataPath
        if (-not $metadataState.Exists -or $metadataState.Invalid) {
            throw 'Er is geen geldig test-runtime-eigenaarsrecord; er is geen proces gestopt.'
        }
        if (-not (Test-TestRuntimeMetadataIdentity -Metadata $metadataState.Data `
                -ExpectedWorktree $RuntimeRepoRoot -ExpectedHead $RuntimeHead `
                -ExpectedConfigIdentity $RuntimeConfigIdentity -ExpectedMode $RuntimeMode `
                -ExpectedAppRoot $RuntimeAppRoot -ExpectedNextCli $RuntimeNextCli `
                -ExpectedConfigPath $RuntimeCentralConfig -ExpectedHost $RuntimeHost `
                -ExpectedPort $RequestedPort)) {
            throw 'Het test-runtime-eigenaarsrecord hoort niet exact bij deze worktree, HEAD, config, mode of poort; er is geen proces gestopt.'
        }

        $metadataPid = [int](Get-MetadataProperty -Metadata $metadataState.Data -Name 'pid')
        if ($metadataPid -ne $RequestedPid) {
            throw 'De opgegeven RuntimePid is niet de PID uit het exacte test-runtime-eigenaarsrecord; er is geen proces gestopt.'
        }
        $metadataPort = [int](Get-MetadataProperty -Metadata $metadataState.Data -Name 'port')
        if (-not (Test-ProcessIdAlive -ProcessId $RequestedPid)) {
            if (-not (Test-LoopbackPortAvailable -CandidatePort $metadataPort)) {
                throw 'De opgegeven RuntimePid bestaat niet meer maar de geregistreerde poort is bezet; er is geen metadata verwijderd.'
            }
            try {
                Remove-Item -LiteralPath $RuntimeMetadataPath -Force -ErrorAction Stop
            } catch {
                throw 'Het test-runtime-proces is al gestopt maar het eigenaarsrecord kon niet veilig worden verwijderd.'
            }
            return [pscustomobject]@{
                schemaVersion = 1
                status = 'STOPPED'
                url = [string](Get-MetadataProperty -Metadata $metadataState.Data -Name 'url')
                port = $metadataPort
                pid = $RequestedPid
                stopped = $true
                alreadyStopped = $true
                reused = $false
                head = $RuntimeHead
                mode = $RuntimeMode
                readyPath = '/login'
            }
        }
        $record = Get-NextProcessRecordById -ProcessId $RequestedPid -AppPath $RuntimeAppRoot -NextCliPath $RuntimeNextCli `
            -CentralConfigPath $RuntimeCentralConfig -RuntimeMode $RuntimeMode -HostAddress $RuntimeHost -RuntimePort $metadataPort
        if ($null -eq $record -or $null -eq $record.CreationUtc) {
            throw 'De opgegeven RuntimePid heeft geen exacte process identity of parseerbare creation time; er is geen proces gestopt.'
        }

        $startedAt = [DateTime]::MinValue
        $startedAtValue = Get-MetadataProperty -Metadata $metadataState.Data -Name 'startedAtUtc'
        $startedAtParsed = if ($startedAtValue -is [DateTime]) {
            $startedAt = ([DateTime]$startedAtValue).ToUniversalTime()
            $true
        } else {
            [DateTime]::TryParse(
                [string]$startedAtValue,
                [Globalization.CultureInfo]::InvariantCulture,
                [Globalization.DateTimeStyles]::RoundtripKind,
                [ref]$startedAt
            )
        }
        if (-not $startedAtParsed -or [Math]::Abs(($record.CreationUtc - $startedAt.ToUniversalTime()).TotalSeconds) -gt 10) {
            throw 'De creation time van de opgegeven RuntimePid komt niet overeen met het exacte eigenaarsrecord; er is geen proces gestopt.'
        }

        try {
            $process = [Diagnostics.Process]::GetProcessById($RequestedPid)
        } catch {
            throw 'De opgegeven RuntimePid bestaat niet meer als het exacte test-runtime-proces; er is geen proces gestopt.'
        }
        try {
            # Re-read identity immediately before Kill so PID reuse cannot turn
            # this owner-only path into an arbitrary process stop.
            $verifiedRecord = Get-NextProcessRecordById -ProcessId $RequestedPid -AppPath $RuntimeAppRoot -NextCliPath $RuntimeNextCli `
                -CentralConfigPath $RuntimeCentralConfig -RuntimeMode $RuntimeMode -HostAddress $RuntimeHost -RuntimePort $metadataPort
            if ($null -eq $verifiedRecord -or $verifiedRecord.CreationUtc -ne $record.CreationUtc) {
                throw 'De process identity wijzigde voordat het test-runtime-proces kon worden gestopt; er is geen proces gestopt.'
            }
            Stop-OwnedTestRuntimeProcess -Process $process
        } finally {
            $process.Dispose()
        }
        if (Test-ProcessIdAlive -ProcessId $RequestedPid) {
            throw 'Het exacte test-runtime-proces kon niet veilig worden gestopt; de metadata is behouden.'
        }
        try {
            Remove-Item -LiteralPath $RuntimeMetadataPath -Force -ErrorAction Stop
        } catch {
            throw 'Het exacte test-runtime-proces is gestopt maar het eigenaarsrecord kon niet veilig worden verwijderd.'
        }
        return [pscustomobject]@{
            schemaVersion = 1
            status = 'STOPPED'
            url = [string](Get-MetadataProperty -Metadata $metadataState.Data -Name 'url')
            port = $metadataPort
            pid = $RequestedPid
            stopped = $true
            reused = $false
            head = $RuntimeHead
            mode = $RuntimeMode
            readyPath = '/login'
        }
    } finally {
        $runtimeLock.Dispose()
    }
}

function Invoke-TestRunner {
    param(
        [Parameter(Mandatory)][string]$RuntimeRepoRoot,
        [Parameter(Mandatory)][string]$RuntimeAppRoot,
        [Parameter(Mandatory)][string]$RuntimeNextDirectory,
        [Parameter(Mandatory)][string]$RuntimeMetadataPath,
        [Parameter(Mandatory)][string]$RuntimeLockPath,
        [Parameter(Mandatory)][string]$RuntimeNodePath,
        [Parameter(Mandatory)][string]$RuntimeCentralConfig,
        [Parameter(Mandatory)][string]$RuntimeNextCli,
        [Parameter(Mandatory)][ValidateSet('Development', 'Production')][string]$RuntimeMode,
        [Parameter(Mandatory)][string]$RuntimeHost,
        [Parameter(Mandatory)][string]$RuntimeHead,
        [Parameter(Mandatory)][string]$RuntimeConfigIdentity,
        [Parameter(Mandatory)][int]$RequestedPort,
        [Parameter(Mandatory)][int]$TimeoutSeconds
    )

    $runtimeLock = Acquire-TestRuntimeLock -Path $RuntimeLockPath -TimeoutSeconds $TimeoutSeconds
    $ownedProcess = $null
    try {
        $metadataState = Read-TestRuntimeMetadata -Path $RuntimeMetadataPath
        $metadataMatches = $false
        if ($metadataState.Exists -and -not $metadataState.Invalid) {
            $metadataMatches = Test-TestRuntimeMetadataIdentity -Metadata $metadataState.Data `
                -ExpectedWorktree $RuntimeRepoRoot -ExpectedHead $RuntimeHead `
                -ExpectedConfigIdentity $RuntimeConfigIdentity -ExpectedMode $RuntimeMode `
                -ExpectedAppRoot $RuntimeAppRoot -ExpectedNextCli $RuntimeNextCli `
                -ExpectedConfigPath $RuntimeCentralConfig -ExpectedHost $RuntimeHost `
                -ExpectedPort $RequestedPort
        }

        if ($metadataMatches) {
            $existingPid = [int](Get-MetadataProperty -Metadata $metadataState.Data -Name 'pid')
            $existingProcess = Get-NextProcessRecordById -ProcessId $existingPid -AppPath $RuntimeAppRoot -NextCliPath $RuntimeNextCli `
                -CentralConfigPath $RuntimeCentralConfig -RuntimeMode $RuntimeMode -HostAddress $RuntimeHost `
                -RuntimePort ([int](Get-MetadataProperty -Metadata $metadataState.Data -Name 'port'))
            if ($null -ne $existingProcess) {
                $recordedStart = [DateTime]::MinValue
                $recordedStartValue = Get-MetadataProperty -Metadata $metadataState.Data -Name 'startedAtUtc'
                if ($recordedStartValue -is [DateTime]) {
                    $recordedStart = ([DateTime]$recordedStartValue).ToUniversalTime()
                    $recordedStartParsed = $true
                } else {
                    $recordedStartParsed = [DateTime]::TryParse(
                        [string]$recordedStartValue,
                        [Globalization.CultureInfo]::InvariantCulture,
                        [Globalization.DateTimeStyles]::RoundtripKind,
                        [ref]$recordedStart
                    )
                }
                if (-not $recordedStartParsed -or $null -eq $existingProcess.CreationUtc) {
                    throw 'De geregistreerde test-server heeft geen parseerbare creation time; er is geen tweede Next.js-server gestart.'
                }
                if ([Math]::Abs(($existingProcess.CreationUtc - $recordedStart.ToUniversalTime()).TotalSeconds) -gt 10) {
                    throw 'De geregistreerde test-server-PID hoort niet bij de geregistreerde start; er is geen tweede Next.js-server gestart.'
                }

                $existingUrl = [string](Get-MetadataProperty -Metadata $metadataState.Data -Name 'url')
                if (-not (Wait-ForLoginReady -Url "$existingUrl/login" -TimeoutSeconds $TimeoutSeconds -OwnedProcess $null)) {
                    throw 'De geregistreerde test-server draait maar /login is niet bereikbaar; er is geen tweede Next.js-server gestart.'
                }
                return [pscustomobject]@{
                    schemaVersion = 1
                    status = 'RUNTIME_READY'
                    url = $existingUrl
                    port = [int](Get-MetadataProperty -Metadata $metadataState.Data -Name 'port')
                    pid = $existingPid
                    reused = $true
                    head = $RuntimeHead
                    mode = $RuntimeMode
                    readyPath = '/login'
                }
            }
            if (Test-ProcessIdAlive -ProcessId $existingPid) {
                throw 'De geregistreerde PID hoort niet aantoonbaar bij de geregistreerde Next.js-server; er is geen tweede server gestart.'
            }
        } elseif ($metadataState.Exists -and -not $metadataState.Invalid) {
            $recordedPidValue = Get-MetadataProperty -Metadata $metadataState.Data -Name 'pid'
            if ((($recordedPidValue -is [int]) -or ($recordedPidValue -is [long])) -and [int]$recordedPidValue -gt 0 -and
                (Test-ProcessIdAlive -ProcessId ([int]$recordedPidValue))) {
                throw 'Een bestaande runner-PID heeft geen verifieerbaar exact worktree-/HEAD-/config-eigenaarschap; er is geen tweede server gestart.'
            }
        }

        # A mismatched or stale record is never enough to start another server.
        # First prove that no Next process or Next lock remains for this .next directory.
        $existingNextProcesses = @(Get-NextProcessRecordsByApp -AppPath $RuntimeAppRoot -NextCliPath $RuntimeNextCli)
        if ($existingNextProcesses.Count -gt 0 -or (Test-NextLockFiles -NextDirectory $RuntimeNextDirectory)) {
            throw 'Een bestaande Next.js-server of lock in dezelfde .next-directory heeft geen verifieerbaar exact worktree-/HEAD-/config-eigenaarschap; er is geen tweede server gestart.'
        }

        $selectedPort = if ($RequestedPort -gt 0) {
            Assert-LoopbackPortAvailable -CandidatePort $RequestedPort
            $RequestedPort
        } else {
            Get-FirstFreeLoopbackPort -StartPort 3000
        }
        $runtimeUrl = "http://$RuntimeHost`:$selectedPort"
        $ownedProcess = Start-TestRuntimeProcess -NodePath $RuntimeNodePath -CentralConfigPath $RuntimeCentralConfig `
            -NextCliPath $RuntimeNextCli -WorkingDirectory $RuntimeAppRoot -RuntimeMode $RuntimeMode `
            -HostAddress $RuntimeHost -RuntimePort $selectedPort
        try {
            $ownedRecord = Get-NextProcessRecordById -ProcessId $ownedProcess.Id -AppPath $RuntimeAppRoot `
                -NextCliPath $RuntimeNextCli -CentralConfigPath $RuntimeCentralConfig -RuntimeMode $RuntimeMode `
                -HostAddress $RuntimeHost -RuntimePort $selectedPort
        } catch {
            Stop-OwnedTestRuntimeProcess -Process $ownedProcess
            $ownedProcess.Dispose()
            $ownedProcess = $null
            throw 'De nieuwe test-server heeft geen verifieerbare exacte process identity; de eigen server is gestopt.'
        }
        if ($null -eq $ownedRecord -or $null -eq $ownedRecord.CreationUtc) {
            Stop-OwnedTestRuntimeProcess -Process $ownedProcess
            $ownedProcess.Dispose()
            $ownedProcess = $null
            throw 'De nieuwe test-server heeft geen verifieerbare exacte process identity; de eigen server is gestopt.'
        }
        $startedAtUtc = $ownedRecord.CreationUtc.ToString('o')

        if (-not (Wait-ForLoginReady -Url "$runtimeUrl/login" -TimeoutSeconds $TimeoutSeconds -OwnedProcess $ownedProcess)) {
            Stop-OwnedTestRuntimeProcess -Process $ownedProcess
            $ownedProcess.Dispose()
            $ownedProcess = $null
            throw 'De nieuwe test-server werd gestart maar /login werd niet tijdig bereikbaar; de eigen server is gestopt.'
        }

        $metadata = [ordered]@{
            schemaVersion = 1
            worktree = $RuntimeRepoRoot
            appRoot = $RuntimeAppRoot
            nextCli = $RuntimeNextCli
            configPath = $RuntimeCentralConfig
            head = $RuntimeHead
            configIdentity = $RuntimeConfigIdentity
            mode = $RuntimeMode
            host = $RuntimeHost
            port = $selectedPort
            pid = $ownedProcess.Id
            url = $runtimeUrl
            startedAtUtc = $startedAtUtc
        }
        try {
            Write-TestRuntimeMetadata -Path $RuntimeMetadataPath -Metadata $metadata
        } catch {
            Stop-OwnedTestRuntimeProcess -Process $ownedProcess
            $ownedProcess.Dispose()
            $ownedProcess = $null
            throw 'De test-server is bereikbaar maar eigenaarschap kon niet atomair worden vastgelegd; de eigen server is gestopt.'
        }
        return [pscustomobject]@{
            schemaVersion = 1
            status = 'RUNTIME_READY'
            url = $runtimeUrl
            port = $selectedPort
            pid = $ownedProcess.Id
            reused = $false
            head = $RuntimeHead
            mode = $RuntimeMode
            readyPath = '/login'
        }
    } finally {
        if ($null -ne $ownedProcess) {
            $ownedProcess.Dispose()
        }
        $runtimeLock.Dispose()
    }
}

if ($TestRunner) {
    if ($StopTestRunner) {
        $stopResult = Invoke-TestRuntimeStop -RuntimeRepoRoot $repoRoot -RuntimeAppRoot $appRoot `
            -RuntimeMetadataPath $runtimeMetadataPath -RuntimeLockPath $runtimeLockPath `
            -RuntimeCentralConfig $centralConfig -RuntimeNextCli $nextCli -RuntimeMode $Mode `
            -RuntimeHost $runtimeHost -RuntimeHead $gitCommit -RuntimeConfigIdentity $runtimeConfigIdentity `
            -RequestedPid $RuntimePid -RequestedPort $Port -TimeoutSeconds $ReadyTimeoutSeconds
        Write-Output ($stopResult | ConvertTo-Json -Depth 4 -Compress)
        return
    }
    if ($PreflightOnly) {
        $preflightPort = if ($Port -gt 0) {
            Assert-LoopbackPortAvailable -CandidatePort $Port
            $Port
        } else {
            Get-FirstFreeLoopbackPort -StartPort 3000
        }
        Write-Host "Preflight geslaagd: $Mode, vrije loopback-poort $preflightPort, runner-identiteit en centrale configuratie gecontroleerd. Geen server gestart."
        return
    }

    $runnerResult = Invoke-TestRunner -RuntimeRepoRoot $repoRoot -RuntimeAppRoot $appRoot `
        -RuntimeNextDirectory $nextDirectory -RuntimeMetadataPath $runtimeMetadataPath -RuntimeLockPath $runtimeLockPath `
        -RuntimeNodePath $node.Source -RuntimeCentralConfig $centralConfig -RuntimeNextCli $nextCli `
        -RuntimeMode $Mode -RuntimeHost $runtimeHost -RuntimeHead $gitCommit -RuntimeConfigIdentity $runtimeConfigIdentity `
        -RequestedPort $Port -TimeoutSeconds $ReadyTimeoutSeconds
    Write-Output ($runnerResult | ConvertTo-Json -Depth 4 -Compress)
    return
}

Assert-LoopbackPortAvailable -CandidatePort $resolvedPort

if ($Build) {
    $npmCmd = Get-Command npm.cmd -ErrorAction Stop
    $npmDirectory = Split-Path -Parent $npmCmd.Source
    $npmCliCandidates = @(
        (Join-Path $npmDirectory 'node_modules/npm/bin/npm-cli.js'),
        (Join-Path (Split-Path -Parent $node.Source) 'node_modules/npm/bin/npm-cli.js')
    )
    $npmCli = $npmCliCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if (-not $npmCli) {
        throw 'De bestaande npm-cli.js kon niet worden gevonden; er is niets gebouwd of geïnstalleerd.'
    }

    $buildSourceCommit = (& git -C $repoRoot rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $buildSourceCommit -notmatch '^[a-f0-9]{40}$') {
        throw 'De kandidaatcommit kon niet betrouwbaar worden vastgesteld.'
    }
    $dirtyTracked = @(& git -C $repoRoot status --porcelain --untracked-files=all -- . ':(exclude)apps/hr-suite/next-env.d.ts')
    if ($LASTEXITCODE -ne 0 -or $dirtyTracked.Count -gt 0) {
        throw 'Bouw alleen vanaf een schoon, vastgelegd kandidaat. De gegenereerde next-env.d.ts is hiervan uitgezonderd.'
    }

    Write-Host "Bouw de bestaande LiquidHR-app voor commit $buildSourceCommit met de centrale TEST-configuratie; waarden blijven verborgen."
    Push-Location $appRoot
    try {
        & $node.Source "--env-file=$centralConfig" $npmCli run build
        $buildExitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($buildExitCode -ne 0) {
        throw "Next.js build is gestopt met exitcode $buildExitCode. Er is geen server gestart."
    }
    Write-Host 'Productiebuild en buildprovenance geslaagd. Start de runtime daarna met -Mode Production.'
    return
}

if ($PreflightOnly) {
    Write-Host "Preflight geslaagd: $Mode, loopback-poort $resolvedPort, dependencies/config/build gecontroleerd. Geen server gestart."
    return
}

$nextArguments = @()
if ($Mode -eq 'Development') {
    $nextArguments += @('dev', '--webpack')
} else {
    $nextArguments += 'start'
}
$nextArguments += @('--hostname', '127.0.0.1', '--port', [string]$resolvedPort)

# Next's development worker copies process.execArgv into NODE_OPTIONS. Node
# rejects --env-file there, so load the central config in a short-lived parent
# process and start Next as a clean child with that environment already loaded.
$nextBootstrap = @'
const { spawnSync } = require('node:child_process');
const [nextCli, ...nextArgs] = process.argv.slice(1);
const result = spawnSync(process.execPath, [nextCli, ...nextArgs], {
  env: process.env,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
'@
$nextArguments = @("--env-file=$centralConfig", '-e', $nextBootstrap, $nextCli) + $nextArguments

Write-Host "Start $Mode op http://127.0.0.1:$resolvedPort met de centrale TEST-configuratie. Configwaarden worden niet getoond of gekopieerd."
Push-Location $appRoot
try {
    & $node.Source @nextArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Next.js is gestopt met exitcode $LASTEXITCODE."
    }
} finally {
    Pop-Location
}
