[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string[]]$Path,

    [string]$Message,

    [string[]]$Verify
)

. (Join-Path $PSScriptRoot '_git-toolkit-common.ps1')

Write-ToolkitHeader -Title 'Feature afronden'

$branch = Get-CurrentBranch
if ($branch -notmatch '^work/[a-z0-9]+(?:-[a-z0-9]+)*-\d{8}$' -or $branch -eq 'work/payroll-p0-p1') {
    throw "Afronden kan alleen op een tijdelijke branch 'work/<run-id>-<YYYYMMDD>'. Beschermde of afwijkende branch: $branch"
}

$originMain = Get-GitOutput -Arguments @('rev-parse', '--verify', 'refs/remotes/origin/main')
& git -C $script:RepositoryRoot merge-base --is-ancestor $originMain HEAD *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Deze branch bevat de vastgelegde origin/main-baseline $originMain niet. Herstel de baseline bewust; er is niets gestaged of gecommit."
}

$selectedPaths = [System.Collections.Generic.List[string]]::new()
foreach ($requestedPath in $Path) {
    if ([string]::IsNullOrWhiteSpace($requestedPath)) {
        throw 'Lege paden zijn niet toegestaan.'
    }

    $relativePath = $requestedPath.Trim().Replace('\', '/')
    if ([System.IO.Path]::IsPathRooted($requestedPath) -or $relativePath.StartsWith(':') -or $relativePath.Split('/') -contains '..' -or $relativePath.Split('/') -contains '.') {
        throw "Pad '$requestedPath' is geen veilig repository-relatief bestandspad."
    }

    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $script:RepositoryRoot $relativePath))
    $rootPrefix = $script:RepositoryRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    if (-not $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Pad '$requestedPath' valt buiten de repository."
    }

    $leaf = [System.IO.Path]::GetFileName($relativePath)
    if ($leaf -ieq '.env.local' -or $leaf -ieq 'next-env.d.ts' -or $relativePath -ieq 'docs/_local-incoming' -or $relativePath.StartsWith('docs/_local-incoming/')) {
        throw "Beschermd pad '$relativePath' kan niet via deze workflow worden geselecteerd."
    }

    if (-not $selectedPaths.Contains($relativePath)) {
        $selectedPaths.Add($relativePath)
    }
}

$statusOutput = Get-GitOutput -Arguments @('-c', 'core.quotepath=false', 'status', '--porcelain=v1', '--untracked-files=all')
$changedPaths = [System.Collections.Generic.List[string]]::new()
foreach ($line in ($statusOutput -split "`r?`n")) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line.Length -lt 4) { throw "Onverwachte Git-statusregel; er is niets gewijzigd: $line" }

    $statusCode = $line.Substring(0, 2)
    if ($statusCode.Contains('R') -or $statusCode.Contains('C')) {
        throw 'Hernoemde/gekopieerde bestanden vereisen expliciete handmatige scopebeoordeling; er is niets gestaged.'
    }

    $changedPaths.Add($line.Substring(3).Replace('\', '/'))
}

if ($changedPaths.Count -eq 0) {
    throw 'Er zijn geen onopgeslagen wijzigingen om expliciet te committen.'
}

$outsideScope = @($changedPaths | Where-Object { -not $selectedPaths.Contains($_) })
if ($outsideScope.Count -gt 0) {
    throw "Werkboom bevat wijzigingen buiten de opgegeven scope; er is niets gestaged. Controleer: $($outsideScope -join ', ')"
}

$notChanged = @($selectedPaths | Where-Object { -not $changedPaths.Contains($_) })
if ($notChanged.Count -gt 0) {
    throw "Deze geselecteerde paden zijn niet gewijzigd; verwijder ze uit -Path: $($notChanged -join ', ')"
}

$toolingOnly = @($selectedPaths | Where-Object { [System.IO.Path]::GetExtension($_).ToLowerInvariant() -notin @('.md', '.ps1', '.psm1', '.psd1') }).Count -eq 0
if (-not $toolingOnly) {
    if (-not $Verify -or $Verify.Count -lt 1) {
        throw 'Niet-documentatiebestanden vereisen één expliciet gerichte verificatieopdracht via -Verify. De volledige hr-suite wordt nooit automatisch gestart.'
    }

    $verifyExecutable = Get-Command -Name $Verify[0] -ErrorAction SilentlyContinue
    if (-not $verifyExecutable) {
        throw "Verificatieprogramma '$($Verify[0])' is niet beschikbaar; er is niets gestaged."
    }

    $verifyArguments = @($Verify | Select-Object -Skip 1)
    Write-Host "Gerichte verificatie: $($Verify -join ' ')" -ForegroundColor Yellow
    $verifyOutput = (& $verifyExecutable.Source @verifyArguments 2>&1 | Out-String).TrimEnd()
    if (-not [string]::IsNullOrWhiteSpace($verifyOutput)) { Write-Host $verifyOutput }
    if ($LASTEXITCODE -ne 0) {
        throw 'Gerichte verificatie is mislukt. Er is niets gestaged of gecommit.'
    }
} else {
    Write-Host 'Alle geselecteerde wijzigingen zijn documentatie of toolkitbestanden; de hr-suite wordt niet gestart.' -ForegroundColor Yellow
}

foreach ($relativePath in $selectedPaths) {
    if ([System.IO.Path]::GetExtension($relativePath) -in @('.ps1', '.psm1', '.psd1')) {
        $tokens = $null
        $parseErrors = $null
        $null = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $script:RepositoryRoot $relativePath), [ref]$tokens, [ref]$parseErrors)
        if ($parseErrors.Count -gt 0) {
            throw "PowerShell-syntaxfout in '$relativePath': $($parseErrors[0].Message)"
        }
    }
}

$literalPaths = @($selectedPaths | ForEach-Object { ":(literal)$_" })
Invoke-Git -Arguments (@('diff', '--check', '--') + $literalPaths)
Invoke-Git -Arguments (@('diff', '--cached', '--check', '--') + $literalPaths)

Write-Host 'Alleen expliciet geselecteerde paden worden gestaged en gecommit.' -ForegroundColor Yellow
Invoke-Git -Arguments (@('add', '--') + $literalPaths)
Invoke-Git -Arguments (@('diff', '--cached', '--check', '--') + $literalPaths)

$commitMessage = if ([string]::IsNullOrWhiteSpace($Message)) { "chore: finalize $branch" } else { $Message.Trim() }
Invoke-Git -Arguments (@('commit', '--only', '-m', $commitMessage, '--') + $literalPaths)

$head = Get-GitOutput -Arguments @('rev-parse', 'HEAD')
Write-Host "`nAfgerond op $branch ($head)." -ForegroundColor Green
Write-Host 'Er is geen tag/backupbranch aangemaakt, en er is niet gemerged of gepusht.'
Write-WorkingTreeSummary
