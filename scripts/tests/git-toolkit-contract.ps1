[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ([string]::IsNullOrWhiteSpace($env:TEMP)) { throw 'TEMP ontbreekt; de test is niet gestart.' }
$tempBase = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd([char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar))
$temporaryRoot = $tempBase + [System.IO.Path]::DirectorySeparatorChar
$testRunName = "liquidhr-git-toolkit-contract-$([Guid]::NewGuid().ToString('N'))"
$testRoot = [System.IO.Path]::GetFullPath((Join-Path $tempBase $testRunName))
$originalLocation = (Get-Location).Path
$testRootCreated = $false
if (-not [string]::Equals([System.IO.Path]::GetDirectoryName($testRoot), $tempBase, [System.StringComparison]::OrdinalIgnoreCase) -or
    -not $testRoot.StartsWith($temporaryRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    [System.IO.Path]::GetFileName($testRoot) -notmatch '^liquidhr-git-toolkit-contract-[0-9a-f]{32}$') {
    throw "Weiger synthetische testuitvoering buiten TEMP: $testRoot"
}
if (Test-Path -LiteralPath $testRoot) { throw "Unieke testmap bestaat al; niets wordt overschreven of verwijderd: $testRoot" }

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

function Invoke-TestGit {
    param([string]$Repository, [string[]]$Arguments)
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = (& git -C $Repository @Arguments 2>&1 | Out-String).TrimEnd()
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($exitCode -ne 0) {
        throw "Synthetisch Git-commando mislukt: git $($Arguments -join ' ')`n$output"
    }
    return $output
}

function Invoke-ExpectedFailure {
    param([scriptblock]$Action, [string]$Message)
    $failed = $false
    try { & $Action | Out-Null } catch { $failed = $true }
    Assert-True $failed $Message
}

function New-TestRepository {
    param([string]$Name)

    $root = Join-Path $testRoot $Name
    $repository = Join-Path $root 'repo'
    $remote = Join-Path $root 'origin.git'
    $scripts = Join-Path $repository 'scripts'
    New-Item -ItemType Directory -Path $scripts -Force | Out-Null
    New-Item -ItemType Directory -Path $remote -Force | Out-Null

    Invoke-TestGit $remote @('init', '--bare', '--initial-branch=main') | Out-Null
    Invoke-TestGit $repository @('init', '--initial-branch=main') | Out-Null
    Invoke-TestGit $repository @('config', 'user.name', 'LiquidHR Toolkit Test') | Out-Null
    Invoke-TestGit $repository @('config', 'user.email', 'toolkit-test@example.invalid') | Out-Null
    Invoke-TestGit $repository @('config', 'core.quotepath', 'false') | Out-Null
    Set-Content -LiteralPath (Join-Path $repository 'README.md') -Value '# Synthetic repository' -Encoding utf8

    $scriptNames = @('_git-toolkit-common.ps1', 'new-feature.ps1', 'finish-feature.ps1', 'backup.ps1', 'restore.ps1', 'edwin-help.ps1')
    foreach ($scriptName in $scriptNames) {
        Copy-Item -LiteralPath (Join-Path $repositoryRoot "scripts/$scriptName") -Destination (Join-Path $scripts $scriptName)
    }

    Invoke-TestGit $repository @('add', '--', 'README.md', 'scripts/_git-toolkit-common.ps1', 'scripts/new-feature.ps1', 'scripts/finish-feature.ps1', 'scripts/backup.ps1', 'scripts/restore.ps1', 'scripts/edwin-help.ps1') | Out-Null
    Invoke-TestGit $repository @('commit', '-m', 'test: synthetic main baseline') | Out-Null
    Invoke-TestGit $repository @('remote', 'add', 'origin', $remote) | Out-Null
    Invoke-TestGit $repository @('push', '--set-upstream', 'origin', 'main') | Out-Null
    Invoke-TestGit $repository @('fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main') | Out-Null

    return [pscustomobject]@{
        Root = $root
        Repository = $repository
        Remote = $remote
        NewFeature = Join-Path $scripts 'new-feature.ps1'
        FinishFeature = Join-Path $scripts 'finish-feature.ps1'
        Backup = Join-Path $scripts 'backup.ps1'
        Restore = Join-Path $scripts 'restore.ps1'
    }
}

try {
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    $testRootCreated = $true

    $syntaxErrors = [System.Collections.Generic.List[string]]::new()
    foreach ($script in Get-ChildItem -LiteralPath (Join-Path $repositoryRoot 'scripts') -Filter '*.ps1' -File -Recurse) {
        $tokens = $null
        $parseErrors = $null
        $null = [System.Management.Automation.Language.Parser]::ParseFile($script.FullName, [ref]$tokens, [ref]$parseErrors)
        foreach ($parseError in $parseErrors) { $syntaxErrors.Add("$($script.FullName): $($parseError.Message)") }
    }
    Assert-True ($syntaxErrors.Count -eq 0) ("PowerShell-syntaxfouten: " + ($syntaxErrors -join '; '))

    $clean = New-TestRepository 'clean-start'
    $originHead = Invoke-TestGit $clean.Repository @('rev-parse', 'refs/remotes/origin/main')
    & $clean.NewFeature -Name 'AA-LEAN-01' -Date '20261011' | Out-Null
    $expectedBranch = 'work/aa-lean-01-20261011'
    Assert-True ((Invoke-TestGit $clean.Repository @('branch', '--show-current')) -eq $expectedBranch) 'Nieuwe branch heeft niet de afgesproken work/<run-id>-<YYYYMMDD>-vorm.'
    Assert-True ((Invoke-TestGit $clean.Repository @('rev-parse', 'HEAD')) -eq $originHead) 'Nieuwe branch gebruikt niet exact de opgehaalde origin/main-SHA.'
    Assert-True ([string]::IsNullOrWhiteSpace((Invoke-TestGit $clean.Repository @('tag', '--list', 'last-good')))) 'Featurestart maakte onverwacht een last-good-tag.'
    Assert-True ([string]::IsNullOrWhiteSpace((Invoke-TestGit $clean.Repository @('branch', '--list', 'backup/last-good')))) 'Featurestart maakte onverwacht een backupbranch.'
    $worktreeOutput = Invoke-TestGit $clean.Repository @('worktree', 'list', '--porcelain')
    $worktreeCount = [regex]::Matches($worktreeOutput, '(?m)^worktree ').Count
    Assert-True ($worktreeCount -eq 1) 'Featurestart maakte onverwacht een extra worktree.'

    $dirty = New-TestRepository 'dirty-start'
    $dirtyFile = Join-Path $dirty.Repository 'outside.txt'
    Set-Content -LiteralPath $dirtyFile -Value 'preserve this change' -Encoding utf8
    $dirtyStatus = Invoke-TestGit $dirty.Repository @('status', '--porcelain=v1')
    Invoke-ExpectedFailure { & $dirty.NewFeature -Name 'AA-LEAN-01' -Date '20261011' } 'Dirty worktree is niet geweigerd.'
    Assert-True ((Get-Content -LiteralPath $dirtyFile -Raw).Trim() -eq 'preserve this change') 'Dirty bestand is gewijzigd of verwijderd.'
    Assert-True ((Invoke-TestGit $dirty.Repository @('status', '--porcelain=v1')) -eq $dirtyStatus) 'Dirty werkboomstatus is gewijzigd.'
    Assert-True ((Invoke-TestGit $dirty.Repository @('branch', '--show-current')) -eq 'main') 'Dirty branch-start heeft de actieve branch gewijzigd.'

    $stale = New-TestRepository 'stale-main'
    Set-Content -LiteralPath (Join-Path $stale.Repository 'local-only.md') -Value 'not pushed' -Encoding utf8
    Invoke-TestGit $stale.Repository @('add', '--', 'local-only.md') | Out-Null
    Invoke-TestGit $stale.Repository @('commit', '-m', 'test: local main drift') | Out-Null
    $staleHead = Invoke-TestGit $stale.Repository @('rev-parse', 'HEAD')
    Invoke-ExpectedFailure { & $stale.NewFeature -Name 'AA-LEAN-01' -Date '20261011' } 'Afwijkende lokale main-baseline is niet geweigerd.'
    Assert-True ((Invoke-TestGit $stale.Repository @('rev-parse', 'HEAD')) -eq $staleHead) 'Stale baseline check heeft HEAD gewijzigd.'
    Assert-True ((Invoke-TestGit $stale.Repository @('branch', '--show-current')) -eq 'main') 'Stale baseline check heeft branch gewijzigd.'

    $offline = New-TestRepository 'missing-origin'
    Invoke-TestGit $offline.Repository @('remote', 'remove', 'origin') | Out-Null
    Invoke-ExpectedFailure { & $offline.NewFeature -Name 'AA-LEAN-01' -Date '20261011' } 'Ontbrekende GitHub/origin-toegang is niet fail-closed afgehandeld.'
    Assert-True ((Invoke-TestGit $offline.Repository @('branch', '--show-current')) -eq 'main') 'Fout op ontbrekende origin heeft branch gewijzigd.'

    $legacy = New-TestRepository 'legacy-scripts'
    Set-Content -LiteralPath (Join-Path $legacy.Repository 'preserved.txt') -Value 'keep' -Encoding utf8
    $legacyStatus = Invoke-TestGit $legacy.Repository @('status', '--porcelain=v1')
    Invoke-ExpectedFailure { & $legacy.Backup } 'Legacy backup is niet fail-closed.'
    Invoke-ExpectedFailure { & $legacy.Restore -Force -Clean } 'Legacy restore is niet fail-closed met oude destructive switches.'
    Assert-True ((Get-Content -LiteralPath (Join-Path $legacy.Repository 'preserved.txt') -Raw).Trim() -eq 'keep') 'Legacy restore heeft een bestaand bestand gewijzigd/verwijderd.'
    Assert-True ((Invoke-TestGit $legacy.Repository @('status', '--porcelain=v1')) -eq $legacyStatus) 'Legacy scripts hebben de werkboom gewijzigd.'
    Assert-True ([string]::IsNullOrWhiteSpace((Invoke-TestGit $legacy.Repository @('tag', '--list', 'last-good')))) 'Legacy backup maakte onverwacht een tag.'
    Assert-True ([string]::IsNullOrWhiteSpace((Invoke-TestGit $legacy.Repository @('branch', '--list', 'backup/last-good')))) 'Legacy backup maakte onverwacht een branch.'

    $finish = New-TestRepository 'finish-scope'
    Invoke-TestGit $finish.Repository @('switch', '--create', 'work/aa-lean-01-20261011', 'refs/remotes/origin/main') | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $finish.Repository 'docs') -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $finish.Repository 'docs/lean.md') -Value 'scoped' -Encoding utf8
    $fakeBin = Join-Path $finish.Root 'fake-bin'
    New-Item -ItemType Directory -Path $fakeBin -Force | Out-Null
    $suiteMarker = Join-Path $finish.Root 'unexpected-suite.txt'
    Set-Content -LiteralPath (Join-Path $fakeBin 'npm.cmd') -Value "@echo off`necho called>$suiteMarker`n" -Encoding ascii
    $previousPath = $env:PATH
    try {
        $env:PATH = "$fakeBin;$previousPath"
        & $finish.FinishFeature -Path 'docs/lean.md' -Message 'docs: synthetic finish' | Out-Null
    } finally {
        $env:PATH = $previousPath
    }
    $committedPaths = Invoke-TestGit $finish.Repository @('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD')
    Assert-True ($committedPaths -eq 'docs/lean.md') 'Finish commit bevatte niet uitsluitend het expliciete pad.'
    Assert-True (-not (Test-Path -LiteralPath $suiteMarker)) 'Docs-only afronden startte onverwacht npm/full-suite.'
    Assert-True ([string]::IsNullOrWhiteSpace((Invoke-TestGit $finish.Repository @('tag', '--list', 'last-good')))) 'Finish maakte onverwacht een tag.'
    Assert-True ([string]::IsNullOrWhiteSpace((Invoke-TestGit $finish.Repository @('branch', '--list', 'backup/last-good')))) 'Finish maakte onverwacht een backupbranch.'

    $outside = New-TestRepository 'outside-scope'
    Invoke-TestGit $outside.Repository @('switch', '--create', 'work/aa-lean-01-20261011', 'refs/remotes/origin/main') | Out-Null
    Set-Content -LiteralPath (Join-Path $outside.Repository 'selected.md') -Value 'selected' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $outside.Repository 'unrelated.txt') -Value 'keep unrelated' -Encoding utf8
    $outsideStatus = Invoke-TestGit $outside.Repository @('status', '--porcelain=v1')
    Invoke-ExpectedFailure { & $outside.FinishFeature -Path 'selected.md' } 'Finish heeft buiten-scope wijzigingen niet geweigerd.'
    Assert-True ((Invoke-TestGit $outside.Repository @('status', '--porcelain=v1')) -eq $outsideStatus) 'Buiten-scope refusal heeft Git-status gewijzigd.'
    Assert-True ((Get-Content -LiteralPath (Join-Path $outside.Repository 'unrelated.txt') -Raw).Trim() -eq 'keep unrelated') 'Buiten-scope bestand is gewijzigd/verwijderd.'

    $code = New-TestRepository 'targeted-required'
    Invoke-TestGit $code.Repository @('switch', '--create', 'work/aa-lean-01-20261011', 'refs/remotes/origin/main') | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $code.Repository 'src') -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $code.Repository 'src/feature.ts') -Value 'export const feature = true;' -Encoding utf8
    Invoke-ExpectedFailure { & $code.FinishFeature -Path 'src/feature.ts' } 'Runtimecode is zonder expliciete gerichte verificatie gecommit.'
    Assert-True ((Invoke-TestGit $code.Repository @('branch', '--show-current')) -eq 'work/aa-lean-01-20261011') 'Ontbrekende gerichte check heeft branch gewijzigd.'
    Assert-True ((Get-Content -LiteralPath (Join-Path $code.Repository 'src/feature.ts') -Raw).Trim() -eq 'export const feature = true;') 'Codebestand is gewijzigd/verwijderd na geweigerde afronding.'

    Write-Host 'PASS: PowerShell syntax, actuele-baseline branchstart, dirty/stale/offline fail-closed, legacy backup/restore, expliciete staging en docs-only zonder suite.' -ForegroundColor Green
} finally {
    if ($testRootCreated) {
        $resolvedTestRoot = [System.IO.Path]::GetFullPath($testRoot)
        if (-not [string]::Equals([System.IO.Path]::GetDirectoryName($resolvedTestRoot), $tempBase, [System.StringComparison]::OrdinalIgnoreCase) -or
            -not $resolvedTestRoot.StartsWith($temporaryRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
            [System.IO.Path]::GetFileName($resolvedTestRoot) -notmatch '^liquidhr-git-toolkit-contract-[0-9a-f]{32}$') {
            throw "Weiger synthetische testcleanup buiten TEMP: $resolvedTestRoot"
        }
        $reparsePoint = Get-ChildItem -LiteralPath $resolvedTestRoot -Force -Recurse | Where-Object { ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 } | Select-Object -First 1
        if ($null -ne $reparsePoint) { throw "Weiger cleanup met reparse point in synthetische testmap: $($reparsePoint.FullName)" }
        Set-Location -LiteralPath $repositoryRoot
        if (Test-Path -LiteralPath $resolvedTestRoot) { Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force }
        if (Test-Path -LiteralPath $originalLocation) { Set-Location -LiteralPath $originalLocation }
    }
}
