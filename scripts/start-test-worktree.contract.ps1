[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$launcherPath = Join-Path $PSScriptRoot 'start-test-worktree.ps1'
$launcherSource = Get-Content -LiteralPath $launcherPath -Raw
$tokens = $null
$parseErrors = $null
$launcherAst = [System.Management.Automation.Language.Parser]::ParseFile(
    (Resolve-Path -LiteralPath $launcherPath),
    [ref]$tokens,
    [ref]$parseErrors
)
if ($parseErrors.Count -gt 0) {
    throw "start-test-worktree.ps1 bevat PowerShell-syntaxfouten: $($parseErrors -join '; ')"
}
$forbiddenProcessCommand = 'Stop' + '-Process'
if ($launcherSource -match "(?im)$forbiddenProcessCommand") {
    throw 'De runner mag geen willekeurige bestaande processen stoppen.'
}
$forbiddenConfigReader = [Regex]::Escape(('read' + 'FileSync('))
if ($launcherSource -match "(?im)$forbiddenConfigReader") {
    throw 'De runner mag de centrale configuratie niet integraal uitlezen voor metadata.'
}
if ($launcherSource -notmatch "-RedirectStandardOutput 'NUL' -RedirectStandardError 'NUL\.'") {
    throw 'De runner moet voor stdout en stderr verschillende Windows-null-device-targets gebruiken.'
}
if ($launcherSource -notmatch '(?im)-UseNewEnvironment') {
    throw 'De runner mag geen user/session-environment erven bij het starten van Next.js.'
}
if ($launcherSource -notmatch '(?im)process\.loadEnvFile') {
    throw 'De runner moet de centrale config via Node process.loadEnvFile laden.'
}
$configProbeStartMarker = ([string][char]36) + 'configProbe = @' + [string][char]39
$configProbeStart = $launcherSource.IndexOf($configProbeStartMarker)
if ($configProbeStart -lt 0) {
    throw 'De centrale TEST-configvalidatie kon niet worden gevonden.'
}
$probeBodyStart = $launcherSource.IndexOf([Environment]::NewLine, $configProbeStart) + [Environment]::NewLine.Length
$probeEndMarker = [string][char]39 + '@'
$probeBodyEnd = $launcherSource.IndexOf($probeEndMarker, $probeBodyStart)
if ($probeBodyEnd -lt $probeBodyStart) {
    throw 'De centrale TEST-configvalidatie is onvolledig.'
}
$configProbeSource = $launcherSource.Substring($probeBodyStart, $probeBodyEnd - $probeBodyStart)
foreach ($requiredProbeToken in @(
    "process.loadEnvFile(process.argv[1]);",
    "Buffer.from(process.argv[2], 'base64')",
    "(process.env.NODE_OPTIONS ?? '').trim()",
    'PAYROLL_SUPABASE_URL',
    "PAYROLL_LAB_ENABLED !== 'true'"
)) {
    if ($configProbeSource -notmatch [Regex]::Escape($requiredProbeToken)) {
        throw "TEST-configprobe mist de fail-closed eis: $requiredProbeToken"
    }
}
if ($launcherSource -notmatch [Regex]::Escape('$StopTestRunner -and ($RuntimePid -le 0 -or $Port -le 0)')) {
    throw 'De stoproute moet zowel een positieve owner-PID als de exacte positieve runner-poort vereisen.'
}
if ($launcherSource -notmatch '(?im)process\.execArgv\s*=\s*\[\]') {
    throw 'De runner moet de Node-bootstrapopties wissen voordat Next.js wordt geladen.'
}
if ($launcherSource -notmatch "\`$arguments\.Add\('-e'\)" -or $launcherSource -notmatch "\`$arguments\.Add\('--'\)") {
    throw 'De runtimebootstrap moet de Next-argumenten na het Node-script doorgeven.'
}
if ($launcherSource -match '(?is)return\s+\[pscustomobject\]@\{[^}]*\bworktree\s*=') {
    throw 'Publieke runner-metadata mag geen absoluut worktree-pad bevatten.'
}
foreach ($requiredSourceToken in @('-StopTestRunner', '-RuntimePid', '/login', 'CreationUtc')) {
    if ($launcherSource -notmatch [Regex]::Escape($requiredSourceToken)) {
        throw "Runner-contract ontbreekt vereist lifecycle/identity-element: $requiredSourceToken"
    }
}
if ($launcherSource -match '\[Console\]::Out\.WriteLine') {
    throw 'De JSON-uitvoer van de runtime moet via de PowerShell-pipeline beschikbaar zijn voor de acceptatiewrapper.'
}
if ($launcherSource -notmatch '(?im)alreadyStopped\s*=\s*\$true') {
    throw 'De stoproute moet stale metadata kunnen verwijderen nadat PID-afwezigheid en vrije poort zijn bewezen.'
}

$redirectionProbe = $null
try {
    $redirectionProbe = Start-Process -FilePath $env:ComSpec -ArgumentList '/d /c exit 0' `
        -PassThru -WindowStyle Hidden -UseNewEnvironment -RedirectStandardOutput 'NUL' -RedirectStandardError 'NUL.'
    if (-not $redirectionProbe.WaitForExit(10000) -or -not $redirectionProbe.HasExited) {
        throw 'De redirection smoke test eindigde niet succesvol.'
    }
} finally {
    if ($null -ne $redirectionProbe) {
        $redirectionProbe.Dispose()
    }
}

$requiredFunctions = @(
    'Test-LoopbackPortAvailable',
    'Get-FirstFreeLoopbackPort',
    'Test-ProcessIdAlive',
    'Get-MetadataProperty',
    'Test-TestRuntimeMetadataIdentity',
    'Test-NextProcessCommandLine',
    'Read-TestRuntimeMetadata',
    'Write-TestRuntimeMetadata'
)
$functionAsts = @{}
foreach ($functionAst in $launcherAst.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst]
    }, $true)) {
    $functionAsts[$functionAst.Name] = $functionAst
}
foreach ($functionName in $requiredFunctions) {
    if (-not $functionAsts.ContainsKey($functionName)) {
        throw "Vereiste runnerfunctie ontbreekt: $functionName"
    }
    . ([scriptblock]::Create($functionAsts[$functionName].Extent.Text))
}
if (Test-ProcessIdAlive -ProcessId 2147483647) {
    throw 'Een afwezige PID werd als actief proces gerapporteerd.'
}

$freePort = Get-FirstFreeLoopbackPort -StartPort 3000
if ($freePort -lt 3000 -or $freePort -gt 65535) {
    throw "Vrije-poortselectie gaf een ongeldige poort terug: $freePort"
}

$worktree = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$appRoot = Join-Path $worktree 'apps/hr-suite'
$nextCli = Join-Path $worktree 'node_modules/next/dist/bin/next'
$configPath = 'C:\runtime\.env.local'
$head = ('a' * 40) -join ''
$configIdentity = ('b' * 64) -join ''
$metadata = [pscustomobject]@{
    schemaVersion = [long]1
    worktree = $worktree
    appRoot = $appRoot
    nextCli = $nextCli
    configPath = $configPath
    head = $head
    configIdentity = $configIdentity
    mode = 'Development'
    host = '127.0.0.1'
    port = [long]32123
    pid = [long]12345
    url = 'http://127.0.0.1:32123'
    startedAtUtc = '2026-10-04T00:00:00.0000000Z'
}
if (-not (Test-TestRuntimeMetadataIdentity -Metadata $metadata -ExpectedWorktree $worktree -ExpectedHead $head -ExpectedConfigIdentity $configIdentity -ExpectedMode 'Development' `
        -ExpectedAppRoot $appRoot -ExpectedNextCli $nextCli -ExpectedConfigPath $configPath -ExpectedHost '127.0.0.1')) {
    throw 'Een geldige runner-eigenaarsrecord werd niet herkend.'
}
if (Test-TestRuntimeMetadataIdentity -Metadata $metadata -ExpectedWorktree $worktree -ExpectedHead $head -ExpectedConfigIdentity (('c' * 64) -join '') -ExpectedMode 'Development' `
        -ExpectedAppRoot $appRoot -ExpectedNextCli $nextCli -ExpectedConfigPath $configPath -ExpectedHost '127.0.0.1') {
    throw 'Een gewijzigde config-identiteit werd onterecht hergebruikt.'
}
if (Test-TestRuntimeMetadataIdentity -Metadata $metadata -ExpectedWorktree $worktree -ExpectedHead $head -ExpectedConfigIdentity $configIdentity -ExpectedMode 'Production' `
        -ExpectedAppRoot $appRoot -ExpectedNextCli $nextCli -ExpectedConfigPath $configPath -ExpectedHost '127.0.0.1') {
    throw 'Een gewijzigde runtime-mode werd onterecht hergebruikt.'
}

$contractWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$contractWorkspacePrefix = $contractWorkspace.TrimEnd([char[]]@('\', '/')) + [IO.Path]::DirectorySeparatorChar
$contractTempDirectory = [IO.Path]::GetFullPath((Join-Path $contractWorkspacePrefix ('.test-runtime-contract-' + $PID)))
if (-not $contractTempDirectory.StartsWith($contractWorkspacePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Contract temp path escaped the workspace.' }
$contractMetadataPath = Join-Path $contractTempDirectory 'runtime.json'
try {
    [void](New-Item -ItemType Directory -Path $contractTempDirectory -Force)
    Write-TestRuntimeMetadata -Path $contractMetadataPath -Metadata $metadata
    $roundTripped = Read-TestRuntimeMetadata -Path $contractMetadataPath
    if ($roundTripped.Invalid -or -not (Test-TestRuntimeMetadataIdentity -Metadata $roundTripped.Data -ExpectedWorktree $worktree -ExpectedHead $head -ExpectedConfigIdentity $configIdentity -ExpectedMode 'Development' `
            -ExpectedAppRoot $appRoot -ExpectedNextCli $nextCli -ExpectedConfigPath $configPath -ExpectedHost '127.0.0.1')) {
        throw 'Runner-eigenaarsmetadata kon niet veilig worden opgeslagen en gelezen.'
    }
} finally {
    $resolvedContractTempDirectory = [IO.Path]::GetFullPath($contractTempDirectory)
    if (-not $resolvedContractTempDirectory.StartsWith($contractWorkspacePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Contract cleanup path escaped the workspace.' }
    Remove-Item -LiteralPath $resolvedContractTempDirectory -Recurse -Force -ErrorAction SilentlyContinue
}

$matchingCommandLine = "node -e bootstrap -- --env-file=$configPath $appRoot $nextCli dev --webpack --hostname 127.0.0.1 --port 32123"
if (-not (Test-NextProcessCommandLine -CommandLine $matchingCommandLine -AppPath $appRoot -NextCliPath $nextCli `
        -CentralConfigPath $configPath -RuntimeMode Development -HostAddress 127.0.0.1 -RuntimePort 32123)) {
    throw 'Een Next-procescommandline voor deze worktree werd niet herkend.'
}
if (Test-NextProcessCommandLine -CommandLine 'node unrelated-script.mjs' -AppPath $appRoot -NextCliPath $nextCli `
        -CentralConfigPath $configPath -RuntimeMode Development -HostAddress 127.0.0.1 -RuntimePort 32123) {
    throw 'Een unrelated Node-proces werd onterecht als Next-server herkend.'
}
if (Test-NextProcessCommandLine -CommandLine $matchingCommandLine.Replace(" $appRoot ", ' ') -AppPath $appRoot -NextCliPath $nextCli `
        -CentralConfigPath $configPath -RuntimeMode Development -HostAddress 127.0.0.1 -RuntimePort 32123) {
    throw 'Een Next-proces zonder de bedoelde app-werkmap werd onterecht als dezelfde server herkend.'
}
if (Test-NextProcessCommandLine -CommandLine $matchingCommandLine.Replace('--port 32123', '--port 32124') -AppPath $appRoot -NextCliPath $nextCli `
        -CentralConfigPath $configPath -RuntimeMode Development -HostAddress 127.0.0.1 -RuntimePort 32123) {
    throw 'Een Next-proces op een andere poort werd onterecht als dezelfde server herkend.'
}
if (Test-NextProcessCommandLine -CommandLine $matchingCommandLine.Replace('127.0.0.1', 'localhost') -AppPath $appRoot -NextCliPath $nextCli `
        -CentralConfigPath $configPath -RuntimeMode Development -HostAddress 127.0.0.1 -RuntimePort 32123) {
    throw 'Een Next-proces op een andere host werd onterecht als dezelfde server herkend.'
}
if (Test-NextProcessCommandLine -CommandLine $matchingCommandLine.Replace($configPath, 'C:\runtime\other.env') -AppPath $appRoot -NextCliPath $nextCli `
        -CentralConfigPath $configPath -RuntimeMode Development -HostAddress 127.0.0.1 -RuntimePort 32123) {
    throw 'Een Next-proces met een andere configbron werd onterecht als dezelfde server herkend.'
}
if (Test-TestRuntimeMetadataIdentity -Metadata ([pscustomobject]@{
        schemaVersion = [long]1; worktree = $worktree; appRoot = $appRoot; nextCli = $nextCli; configPath = $configPath
        head = $head; configIdentity = $configIdentity; mode = 'Development'; host = '127.0.0.1'
        port = [long]32123; pid = [long]12345; url = 'http://127.0.0.1:32123'; startedAtUtc = 'not-a-time'
    }) -ExpectedWorktree $worktree -ExpectedHead $head -ExpectedConfigIdentity $configIdentity -ExpectedMode Development `
        -ExpectedAppRoot $appRoot -ExpectedNextCli $nextCli -ExpectedConfigPath $configPath -ExpectedHost 127.0.0.1) {
    throw 'Onparseerbare creation time werd onterecht als eigenaarsmetadata geaccepteerd.'
}

'start-test-worktree contract checks passed'
