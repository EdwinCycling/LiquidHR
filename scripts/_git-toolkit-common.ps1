Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RepositoryRoot {
    $repositoryHint = Split-Path -Parent $PSScriptRoot
    $root = (& git -C $repositoryHint rev-parse --show-toplevel 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($root)) {
        throw 'Deze map is geen Git-repository of Git is niet beschikbaar.'
    }

    return [System.IO.Path]::GetFullPath($root)
}

$script:RepositoryRoot = Get-RepositoryRoot

function Invoke-Git {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    $output = (& git -C $script:RepositoryRoot @Arguments 2>&1 | Out-String).TrimEnd()
    if ($LASTEXITCODE -ne 0) {
        $detail = if ([string]::IsNullOrWhiteSpace($output)) { 'Geen aanvullende foutmelding.' } else { $output }
        throw "Git-commando mislukt: git $($Arguments -join ' ')`n$detail"
    }

    if (-not [string]::IsNullOrWhiteSpace($output)) {
        Write-Output $output
    }
}

function Get-GitOutput {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    $output = (& git -C $script:RepositoryRoot @Arguments 2>&1 | Out-String).TrimEnd()
    if ($LASTEXITCODE -ne 0) {
        $detail = if ([string]::IsNullOrWhiteSpace($output)) { 'Geen aanvullende foutmelding.' } else { $output }
        throw "Git-commando mislukt: git $($Arguments -join ' ')`n$detail"
    }

    return $output
}

function Get-WorkingTreeStatus {
    return Get-GitOutput -Arguments @('status', '--porcelain=v1')
}

function Assert-CleanWorkingTree {
    param(
        [string]$Operation = 'Deze actie'
    )

    $status = Get-WorkingTreeStatus
    if (-not [string]::IsNullOrWhiteSpace($status)) {
        throw "$Operation vereist een schone werkboom. Er zijn nog niet-opgeslagen wijzigingen. Controleer eerst 'git status' of maak een backup. Gebruik geen force-optie tenzij je het risico bewust accepteert."
    }
}

function Test-GitReference {
    param(
        [Parameter(Mandatory)]
        [string]$Reference
    )

    & git -C $script:RepositoryRoot rev-parse --verify --quiet $Reference *> $null
    return ($LASTEXITCODE -eq 0)
}

function Get-CurrentBranch {
    $branch = Get-GitOutput -Arguments @('branch', '--show-current')
    if ([string]::IsNullOrWhiteSpace($branch)) {
        throw 'De repository staat op een detached HEAD. Schakel eerst naar een branch.'
    }

    return $branch.Trim()
}

function ConvertTo-GitSlug {
    param(
        [Parameter(Mandatory)]
        [string]$Name
    )

    $slug = $Name.Trim().ToLowerInvariant()
    $slug = $slug -replace '^feature[/:\s]+', ''
    $slug = $slug.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''
    $slug = $slug -replace '[^a-z0-9]+', '-'
    $slug = $slug.Trim('-')

    if ([string]::IsNullOrWhiteSpace($slug)) {
        throw "De naam '$Name' levert geen geldige Git-naam op. Gebruik letters of cijfers."
    }

    return $slug
}

function Write-ToolkitHeader {
    param(
        [Parameter(Mandatory)]
        [string]$Title
    )

    Write-Host "`n=== LiquidHR: $Title ===" -ForegroundColor Cyan
    Write-Host "Repository: $script:RepositoryRoot"
}

function Write-WorkingTreeSummary {
    $branch = Get-CurrentBranch
    $head = Get-GitOutput -Arguments @('rev-parse', '--short', 'HEAD')
    $status = Get-WorkingTreeStatus
    $state = if ([string]::IsNullOrWhiteSpace($status)) { 'clean' } else { 'dirty' }
    Write-Host "Branch: $branch | HEAD: $head | Werkboom: $state"
}
