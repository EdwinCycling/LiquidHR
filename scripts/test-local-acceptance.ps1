[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$WorktreePath,
    [string]$Route = '/dashboard/start',
    [string]$EmployeeRoute = '/personal-settings',
    [string[]]$Personas = @('hr-admin', 'manager', 'employee'),
    [ValidateSet('desktop', 'mobile')]
    [string[]]$Viewports = @('desktop', 'mobile'),
    [string]$TenantId,
    [string]$HrGroupId,
    [string]$AdministrationId,
    [string[]]$AllowProbe = @(),
    [string[]]$DenyProbe = @(),
    [ValidateRange(1000, 120000)]
    [int]$TimeoutMs = 15000,
    [ValidateRange(1, 300)]
    [int]$ReadyTimeoutSeconds = 60,
    [switch]$PreflightOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$gitRoot = $null
$head = $null
$runtime = $null
$runtimeCleanup = $null
$phase = 'worktree-validation'

function Write-SanitizedResult {
    param([Parameter(Mandatory)]$Result)

    [Console]::Out.WriteLine(($Result | ConvertTo-Json -Depth 12))
}

function ConvertFrom-JsonEnvelope {
    param([string[]]$Lines)

    $text = ($Lines | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
    if ([string]::IsNullOrWhiteSpace($text) -or $text.Length -gt 1000000) {
        return $null
    }

    try {
        $wholeDocument = $text | ConvertFrom-Json -ErrorAction Stop
        if ($wholeDocument -is [pscustomobject] -and
            $wholeDocument.PSObject.Properties['schemaVersion'] -and
            $wholeDocument.PSObject.Properties['status']) {
            return $wholeDocument
        }
    } catch {
    }

    for ($start = 0; $start -lt $text.Length; $start++) {
        if ($text[$start] -ne '{') { continue }
        $depth = 0
        $inString = $false
        $escaped = $false
        for ($cursor = $start; $cursor -lt $text.Length; $cursor++) {
            $character = $text[$cursor]
            if ($inString) {
                if ($escaped) {
                    $escaped = $false
                } elseif ($character -eq '\') {
                    $escaped = $true
                } elseif ($character -eq '"') {
                    $inString = $false
                }
                continue
            }
            if ($character -eq '"') {
                $inString = $true
                continue
            }
            if ($character -eq '{') {
                $depth++
            } elseif ($character -eq '}') {
                $depth--
                if ($depth -eq 0) {
                    $jsonText = $text.Substring($start, $cursor - $start + 1)
                    try {
                        $candidate = $jsonText | ConvertFrom-Json -ErrorAction Stop
                        if ($candidate -is [pscustomobject] -and
                            $candidate.PSObject.Properties['schemaVersion'] -and
                            $candidate.PSObject.Properties['status']) {
                            return $candidate
                        }
                    } catch {
                        break
                    }
                    break
                }
            }
        }
    }
    return $null
}

function ConvertTo-SafeReportValue {
    param(
        [Parameter(Mandatory)][AllowNull()]$Value,
        [int]$Depth = 0
    )

    if ($Depth -gt 16) { return $null }
    if ($null -eq $Value) { return $null }
    if ($Value -is [string]) {
        if ($Value -match '^(?:[A-Za-z]:[\\/]|\\\\)') { return '[omitted]' }
        $safeText = $Value -replace '[\u0000-\u0008\u000B\u000C\u000E-\u001F]', ''
        return $safeText.Substring(0, [Math]::Min(2000, $safeText.Length))
    }
    if ($Value -is [bool] -or $Value -is [ValueType]) { return $Value }
    if ($Value -is [Collections.IDictionary]) {
        $safe = [ordered]@{}
        foreach ($key in $Value.Keys) {
            if ([string]$key -match '(?i)password|passcode|token|secret|cookie|authorization|credential|magic.?link|api.?key|bearer|session|jwt') { continue }
            $safe[[string]$key] = ConvertTo-SafeReportValue -Value $Value[$key] -Depth ($Depth + 1)
        }
        return $safe
    }
    if ($Value -is [System.Collections.IEnumerable]) {
        $safeItems = [Collections.Generic.List[object]]::new()
        foreach ($item in $Value) {
            $safeItems.Add((ConvertTo-SafeReportValue -Value $item -Depth ($Depth + 1)))
        }
        return ,$safeItems.ToArray()
    }
    if ($Value.PSObject -and $Value.PSObject.Properties) {
        $safe = [ordered]@{}
        foreach ($property in $Value.PSObject.Properties) {
            if ($property.Name -match '(?i)password|passcode|token|secret|cookie|authorization|credential|magic.?link|api.?key|bearer|session|jwt') { continue }
            $safe[$property.Name] = ConvertTo-SafeReportValue -Value $property.Value -Depth ($Depth + 1)
        }
        return $safe
    }
    return $null
}

function Get-LauncherFailure {
    param([string[]]$Output)

    $diagnostic = ($Output -join [Environment]::NewLine)
    if ($diagnostic -match '(?i)centrale .*TEST-configuratie|LOCALAPPDATA|runtimevelden|dependencyboom|dependencies ontbreken|Node\.js .* te oud|package\.json of package-lock\.json ontbreekt|\.env\*-bestanden|worktree-configuratie|Niet-ondersteunde TEST-runtimevelden') {
        return [pscustomobject]@{ Status = 'BLOCKED BY ENVIRONMENT'; Code = 'TEST_RUNTIME_PREREQUISITE_UNAVAILABLE' }
    }
    if ($diagnostic -match '(?i)eigenaarschap|eigenaar|process.?identity|process.?identiteit|runner-PID|Next\.js-server of lock|tweede server gestart|tweede Next') {
        return [pscustomobject]@{ Status = 'HARNESS_FRICTION'; Code = 'RUNTIME_OWNERSHIP_UNVERIFIED' }
    }
    if ($diagnostic -match '(?i)poort .* al bezet|geen vrije loopback-poort') {
        return [pscustomobject]@{ Status = 'HARNESS_FRICTION'; Code = 'RUNTIME_PORT_UNAVAILABLE' }
    }
    return [pscustomobject]@{ Status = 'HARNESS_FRICTION'; Code = 'RUNTIME_START_OR_REUSE_FAILED' }
}

function Stop-RegisteredRuntime {
    param(
        [Parameter(Mandatory)][string]$Launcher,
        [Parameter(Mandatory)]$RuntimeResult,
        [Parameter(Mandatory)][int]$TimeoutSeconds
    )

    if ($RuntimeResult.reused -isnot [bool] -or $RuntimeResult.reused) {
        return [pscustomobject]@{ status = 'NOT_OWNED'; stopped = $false }
    }

    try {
        $stopOutput = @(& $Launcher -Mode Development -TestRunner -StopTestRunner `
            -RuntimePid ([int]$RuntimeResult.pid) -Port ([int]$RuntimeResult.port) `
            -ReadyTimeoutSeconds $TimeoutSeconds 2>&1 6>$null)
    } catch {
        return [pscustomobject]@{ status = 'STOP_FAILED'; stopped = $false; code = 'OWNED_RUNTIME_STOP_FAILED' }
    }

    $stopResult = ConvertFrom-JsonEnvelope -Lines $stopOutput
    if ($null -eq $stopResult) {
        return [pscustomobject]@{ status = 'STOP_FAILED'; stopped = $false; code = 'RUNTIME_STOP_RESULT_INVALID' }
    }
    $resultFields = if ($null -ne $stopResult -and $stopResult.PSObject) {
        @($stopResult.PSObject.Properties.Name | Where-Object { $_ -match '^[A-Za-z][A-Za-z0-9_]*$' })
    } else {
        @()
    }
    if (@('stopped', 'pid', 'port', 'head' | Where-Object { $_ -notin $resultFields }).Count -gt 0) {
        return [pscustomobject]@{
            status = 'STOP_FAILED'
            stopped = $false
            code = 'RUNTIME_STOP_RESULT_INVALID'
            resultFields = $resultFields
        }
    }
    if ($stopResult.schemaVersion -ne 1 -or $stopResult.status -ne 'STOPPED' -or
        $stopResult.stopped -isnot [bool] -or -not $stopResult.stopped -or
        [int]$stopResult.pid -ne [int]$RuntimeResult.pid -or
        [int]$stopResult.port -ne [int]$RuntimeResult.port -or
        $stopResult.head -ne $RuntimeResult.head) {
        return [pscustomobject]@{ status = 'STOP_FAILED'; stopped = $false; code = 'RUNTIME_STOP_IDENTITY_MISMATCH' }
    }
    return [pscustomobject]@{ status = 'STOPPED'; stopped = $true }
}

function Get-RequiredCommand {
    param([Parameter(Mandatory)][string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $command -or -not $command.Source) {
        throw 'LOCAL_ACCEPTANCE_TOOLING_UNAVAILABLE'
    }
    return $command
}

function Invoke-GitText {
    param(
        [Parameter(Mandatory)][string]$RepositoryPath,
        [Parameter(Mandatory)][string[]]$Arguments
    )

    $output = @(& git -C $RepositoryPath @Arguments 2>$null)
    if ($LASTEXITCODE -ne 0) {
        throw 'WORKTREE_IDENTITY_UNAVAILABLE'
    }
    return (($output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Trim()
}

try {
    $resolvedPath = (Resolve-Path -LiteralPath $WorktreePath -ErrorAction Stop).Path
    if (-not (Test-Path -LiteralPath $resolvedPath -PathType Container)) {
        throw 'WORKTREE_NOT_FOUND'
    }

    $gitRoot = Invoke-GitText -RepositoryPath $resolvedPath -Arguments @('rev-parse', '--show-toplevel')
    $gitRoot = (Resolve-Path -LiteralPath $gitRoot -ErrorAction Stop).Path
    $head = Invoke-GitText -RepositoryPath $gitRoot -Arguments @('rev-parse', 'HEAD')
    if ($head -notmatch '^[a-f0-9]{40}$') {
        throw 'WORKTREE_IDENTITY_UNAVAILABLE'
    }
    $branch = Invoke-GitText -RepositoryPath $gitRoot -Arguments @('branch', '--show-current')
    $statusText = Invoke-GitText -RepositoryPath $gitRoot -Arguments @('status', '--porcelain', '--untracked-files=all')
    $statusLines = @($statusText -split '\r?\n' | Where-Object { $_.Length -gt 0 })

    $launcher = Join-Path $gitRoot 'scripts/start-test-worktree.ps1'
    $browserRunner = Join-Path $gitRoot 'apps/hr-suite/scripts/local-test-acceptance.mjs'
    if (-not (Test-Path -LiteralPath $launcher -PathType Leaf) -or
        -not (Test-Path -LiteralPath $browserRunner -PathType Leaf)) {
        throw 'LOCAL_ACCEPTANCE_FILES_UNAVAILABLE'
    }

    if ($PreflightOnly) {
        $preflightInvocationFailed = $false
        try {
            $preflightOutput = @(& $launcher -Mode Development -TestRunner -PreflightOnly -ReadyTimeoutSeconds $ReadyTimeoutSeconds 2>&1 6>$null)
            $preflightInvocationFailed = $LASTEXITCODE -ne 0
        } catch {
            $preflightOutput = @($_.Exception.Message)
            $preflightInvocationFailed = $true
        }
        if ($preflightInvocationFailed) {
            $failure = Get-LauncherFailure -Output @($preflightOutput | ForEach-Object { [string]$_ })
            Write-SanitizedResult ([ordered]@{
                schemaVersion = 1
                status = $failure.Status
                worktree = [IO.Path]::GetFileName($gitRoot)
                head = $head
                code = $failure.Code
            })
            exit 2
        }
        Write-SanitizedResult ([ordered]@{
            schemaVersion = 1
            status = 'PREFLIGHT_GREEN'
            worktree = [IO.Path]::GetFileName($gitRoot)
            branch = $branch
            head = $head
            worktreeState = if ($statusLines.Count -eq 0) { 'clean' } else { 'dirty' }
            changedPathCount = $statusLines.Count
            serverStarted = $false
        })
        exit 0
    }

    $phase = 'runtime-start'
    $runtimeInvocationFailed = $false
    try {
        $runtimeLines = @(& $launcher -Mode Development -TestRunner -ReadyTimeoutSeconds $ReadyTimeoutSeconds 2>&1 6>$null)
        $runtimeInvocationFailed = $LASTEXITCODE -ne 0
    } catch {
        $runtimeLines = @($_.Exception.Message)
        $runtimeInvocationFailed = $true
    }
    if ($runtimeInvocationFailed) {
        $failure = Get-LauncherFailure -Output @($runtimeLines | ForEach-Object { [string]$_ })
        Write-SanitizedResult ([ordered]@{
            schemaVersion = 1
            status = $failure.Status
            worktree = [IO.Path]::GetFileName($gitRoot)
            head = $head
            code = $failure.Code
        })
        exit 2
    }
    $runtime = ConvertFrom-JsonEnvelope -Lines $runtimeLines
    if ($null -eq $runtime -or $runtime -isnot [pscustomobject]) {
        throw 'RUNTIME_RESULT_INVALID'
    }
    $runtimeUrl = [Uri]::new([string]$runtime.url)
    if ($runtimeUrl.Scheme -ne 'http' -or
        $runtimeUrl.Host -notin @('localhost', '127.0.0.1') -or
        [int]$runtime.port -lt 3000 -or
        [int]$runtime.port -gt 65535 -or
        $runtime.readyPath -ne '/login' -or
        $runtime.head -ne $head -or
        $runtime.reused -isnot [bool]) {
        throw 'RUNTIME_IDENTITY_MISMATCH'
    }

    $node = Get-RequiredCommand -Name 'node.exe'
    $arguments = [Collections.Generic.List[string]]::new()
    $arguments.Add($browserRunner)
    $arguments.Add('--base-url')
    $arguments.Add($runtimeUrl.GetLeftPart([UriPartial]::Authority))
    $arguments.Add('--route')
    $arguments.Add($Route)
    $arguments.Add('--employee-route')
    $arguments.Add($EmployeeRoute)
    $arguments.Add('--personas')
    $arguments.Add(($Personas -join ','))
    $arguments.Add('--viewport')
    $arguments.Add(($Viewports -join ','))
    $arguments.Add('--timeout-ms')
    $arguments.Add([string]$TimeoutMs)

    if ($TenantId) { $arguments.Add('--tenant-id'); $arguments.Add($TenantId) }
    if ($HrGroupId) { $arguments.Add('--hr-group-id'); $arguments.Add($HrGroupId) }
    if ($AdministrationId) { $arguments.Add('--administration-id'); $arguments.Add($AdministrationId) }
    foreach ($probe in $AllowProbe) { $arguments.Add('--allow-probe'); $arguments.Add($probe) }
    foreach ($probe in $DenyProbe) { $arguments.Add('--deny-probe'); $arguments.Add($probe) }

    $argumentArray = $arguments.ToArray()
    $phase = 'browser-runner'
    $browserInvocationFailed = $false
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $browserLines = @(& $node.Source @argumentArray 2>&1)
        $browserExitCode = $LASTEXITCODE
    } catch {
        $browserLines = @()
        $browserExitCode = 1
        $browserInvocationFailed = $true
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($browserInvocationFailed) {
        $browserResult = [ordered]@{
            schemaVersion = 1
            status = 'HARNESS_FRICTION'
            phase = 'browser-runner'
            code = 'BROWSER_PROCESS_START_FAILED'
        }
    } else {
        $browserOutputText = ($browserLines | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
        $browserResult = ConvertFrom-JsonEnvelope -Lines $browserLines
        try {
            if ($null -eq $browserResult -or $browserResult -isnot [pscustomobject] -or
                -not $browserResult.PSObject.Properties['status']) {
                throw 'RUNNER_RESULT_INVALID'
            }
            $browserResult = ConvertTo-SafeReportValue -Value $browserResult
        } catch {
            $trimmedBrowserOutput = $browserOutputText.Trim()
            $braceJsonValid = $false
            $braceStart = $browserOutputText.IndexOf('{')
            $braceEnd = $browserOutputText.LastIndexOf('}')
            if ($braceStart -ge 0 -and $braceEnd -ge $braceStart) {
                try {
                    $braceCandidate = $browserOutputText.Substring($braceStart, $braceEnd - $braceStart + 1) |
                        ConvertFrom-Json -ErrorAction Stop
                    $braceJsonValid = $braceCandidate -is [pscustomobject] -and
                        $braceCandidate.PSObject.Properties['schemaVersion'] -and
                        $braceCandidate.PSObject.Properties['status']
                } catch {
                }
            }
        $browserResult = [ordered]@{
            schemaVersion = 1
            status = 'HARNESS_FRICTION'
            phase = 'browser-runner'
            code = 'RUNNER_RESULT_INVALID'
            processExitCode = $browserExitCode
            outputLineCount = $browserLines.Count
            outputLength = $browserOutputText.Length
            outputHasSchemaVersion = $browserOutputText -match '"schemaVersion"\s*:'
            outputHasStatus = $browserOutputText -match '"status"\s*:'
            outputHasKnownPlaywrightError = $browserOutputText -match 'PLAYWRIGHT_(?:DEPENDENCY|BROWSER)_UNAVAILABLE'
            outputHasNodeError = $browserOutputText -match '(?i)cannot find module|uncaught exception|fatal error'
            outputStartsWithJson = $trimmedBrowserOutput.StartsWith('{')
            firstToLastBraceParses = $braceJsonValid
        }
        }
    }

    $phase = 'runtime-cleanup'
    $runtimeCleanup = Stop-RegisteredRuntime -Launcher $launcher -RuntimeResult $runtime `
        -TimeoutSeconds $ReadyTimeoutSeconds

    $result = [ordered]@{
        schemaVersion = 1
        status = if ($runtimeCleanup.status -eq 'STOP_FAILED') {
            'HARNESS_FRICTION'
        } else {
            $browserResult.status
        }
        worktree = [IO.Path]::GetFileName($gitRoot)
        branch = $branch
        head = $head
        worktreeState = if ($statusLines.Count -eq 0) { 'clean' } else { 'dirty' }
        changedPathCount = $statusLines.Count
        runtime = [ordered]@{
            url = $runtimeUrl.GetLeftPart([UriPartial]::Authority)
            port = [int]$runtime.port
            pid = [int]$runtime.pid
            reused = [bool]$runtime.reused
            readyPath = [string]$runtime.readyPath
            cleanup = $runtimeCleanup
        }
        browser = $browserResult
    }
    Write-SanitizedResult $result

    if ($browserExitCode -ne 0 -or $browserResult.status -ne 'GREEN') {
        exit 1
    }
    exit 0
} catch {
    $code = $_.Exception.Message
    if ($code -notmatch '^[A-Z0-9_]+$') {
        $code = 'LOCAL_ACCEPTANCE_FAILED'
    }
    $exceptionType = if ($_.Exception) { $_.Exception.GetType().Name } else { 'Unknown' }
    $candidateErrorId = if ($_) { ([string]$_.FullyQualifiedErrorId -split ',')[0] } else { '' }
    $errorId = if ($candidateErrorId -match '^[A-Za-z0-9_]+$') { $candidateErrorId } else { 'UNCLASSIFIED' }
    $propertyName = 'UNCLASSIFIED'
    if ($_.Exception.Message -match "(?i)(?:property|eigenschap)\s+'(?<name>[A-Za-z_][A-Za-z0-9_]*)'") {
        $propertyName = $Matches.name
    }
    $catchCleanup = $runtimeCleanup
    if ($null -eq $catchCleanup -and $null -ne $runtime) {
        try {
            $catchCleanup = Stop-RegisteredRuntime -Launcher $launcher -RuntimeResult $runtime `
                -TimeoutSeconds $ReadyTimeoutSeconds
        } catch {
            $catchCleanup = [pscustomobject]@{ status = 'STOP_FAILED'; stopped = $false; code = 'OWNED_RUNTIME_STOP_FAILED' }
        }
    }
    Write-SanitizedResult ([ordered]@{
        schemaVersion = 1
        status = 'HARNESS_FRICTION'
        worktree = if ($gitRoot) { [IO.Path]::GetFileName($gitRoot) } else { 'unresolved' }
        head = $head
        code = $code
        errorType = $exceptionType
        errorId = $errorId
        propertyName = $propertyName
        phase = $phase
        runtimeCleanup = $catchCleanup
    })
    exit 2
}
