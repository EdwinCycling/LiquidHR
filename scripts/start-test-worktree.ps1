[CmdletBinding()]
param(
    [ValidateSet('Development', 'Production')]
    [string]$Mode = 'Development',
    [ValidateRange(0, 65535)]
    [int]$Port = 0,
    [switch]$PayrollAcceptance,
    [switch]$Build,
    [switch]$PreflightOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Build -and $Mode -ne 'Production') {
    throw '-Build is alleen toegestaan met -Mode Production.'
}
if ($Build -and $PreflightOnly) {
    throw '-Build en -PreflightOnly mogen niet tegelijk worden gebruikt.'
}
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
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

# Voorkom dat geërfde Supabase-/Payroll-/testauth-instellingen de centrale bron overrulen.
$shadowedRuntimeNames = @(
    Get-ChildItem Env: |
        Where-Object { $_.Name -match '^(NEXT_PUBLIC_.*|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|PAYROLL_.*|LIQUIDHR_TEST_.*|TALENT_.*|VERCEL(?:_.*)?|NODE_ENV|NODE_OPTIONS)$' } |
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
if ($nodeVersion -lt [Version]'20.9.0') {
    throw "Node.js $nodeVersionOutput is te oud voor deze Next.js-runtime; minimaal 20.9.0 is vereist."
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
try {
    & $npm.Source ls --workspaces --depth=0 --json *> $null
    $dependencyExitCode = $LASTEXITCODE
} finally {
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
$requirePayrollJson = if ($PayrollAcceptance) { 'true' } else { 'false' }
$configProbe = @'
const groups = JSON.parse(process.argv[1]);
const requirePayroll = process.argv[2] === 'true';
const missing = groups
  .filter((group) => !group.some((name) => (process.env[name] ?? '').trim().length > 0))
  .map((group) => group.join(' or '));
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
if (missing.length > 0 || invalidTargets.length > 0) {
  if (missing.length > 0) console.error(`Ontbrekende TEST-runtimevelden (alleen namen): ${missing.join(', ')}`);
  if (invalidTargets.length > 0) console.error(`Runtime-URL wijst niet naar het goedgekeurde TEST-project (alleen veldnamen): ${invalidTargets.join(', ')}`);
  process.exitCode = 2;
} else {
  console.log('Centrale TEST-configuratie: vereiste variabelen aanwezig; waarden verborgen.');
}
'@
& $node.Source "--env-file=$centralConfig" -e $configProbe $requiredGroupsJson $requirePayrollJson
if ($LASTEXITCODE -ne 0) {
    throw 'De centrale TEST-configuratie bevat niet alle vereiste runtimevelden; waarden zijn niet getoond.'
}

$publicFingerprintProbe = @'
const { createHash } = require('node:crypto');
const hash = createHash('sha256');
for (const [name, value] of Object.entries(process.env)
  .filter(([name]) => name.startsWith('NEXT_PUBLIC_'))
  .sort(([left], [right]) => left.localeCompare(right))) {
  hash.update(name).update('\0').update(value).update('\n');
}
process.stdout.write(hash.digest('hex'));
'@
$publicRuntimeFingerprint = (& $node.Source "--env-file=$centralConfig" -e $publicFingerprintProbe).Trim()
if ($LASTEXITCODE -ne 0 -or $publicRuntimeFingerprint -notmatch '^[a-f0-9]{64}$') {
    throw 'De publieke runtimeconfiguratiehash kon niet veilig worden gecontroleerd.'
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

# Next.js kopieert process.execArgv naar zijn Development-child.
# --env-file zou daar onterecht NODE_OPTIONS worden, waar Node de vlag weigert.
$runtimeBridge = @'
const [configFile, nextEntry, ...nextArgs] = process.argv.slice(1);
if (!configFile || !nextEntry) throw new Error('TEST-runtimeconfiguratie of Next.js CLI ontbreekt.');
if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(configFile);
} else if (!process.execArgv.some((argument) => argument.startsWith('--env-file='))) {
    throw new Error('Deze Node.js-versie kan de TEST-runtimeconfiguratie niet laden.');
}
process.execArgv = [];
process.argv = [process.argv[0], nextEntry, ...nextArgs];
require(nextEntry);
'@
$runtimeArguments = @($centralConfig, $nextCli) + $nextArguments
$hasLoadEnvFileApi = $nodeVersion.Major -ge 22 -or
    ($nodeVersion.Major -eq 21 -and $nodeVersion.Minor -ge 7) -or
    ($nodeVersion.Major -eq 20 -and $nodeVersion.Minor -ge 12)

Write-Host "Start $Mode op http://127.0.0.1:$resolvedPort met de centrale TEST-configuratie. Configwaarden worden niet getoond of gekopieerd."
Push-Location $appRoot
try {
    # Next.js kopieert process.execArgv naar zijn dev-child; --env-file wordt
    # daar onterecht NODE_OPTIONS en Node weigert die vlag in die variabele.
    if ($hasLoadEnvFileApi) {
        & $node.Source -e $runtimeBridge @runtimeArguments
    } else {
        & $node.Source "--env-file=$centralConfig" -e $runtimeBridge @runtimeArguments
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Next.js is gestopt met exitcode $LASTEXITCODE."
    }
} finally {
    Pop-Location
}
