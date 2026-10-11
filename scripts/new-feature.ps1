[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)]
    [string]$Name,

    [string]$Date = (Get-Date -Format 'yyyyMMdd')
)

. (Join-Path $PSScriptRoot '_git-toolkit-common.ps1')

Write-ToolkitHeader -Title 'Nieuwe feature'
Assert-CleanWorkingTree -Operation 'Een nieuwe feature starten'

if ((Get-CurrentBranch) -ne 'main') {
    throw "Een nieuwe branch start alleen vanaf de schone lokale 'main'. Er is niets gewijzigd."
}

if ($Date -notmatch '^\d{8}$') {
    throw "Datum '$Date' is ongeldig. Gebruik YYYYMMDD. Er is niets gewijzigd."
}

$null = [DateTime]::ParseExact($Date, 'yyyyMMdd', [Globalization.CultureInfo]::InvariantCulture)
$slug = ConvertTo-GitSlug -Name $Name
$branch = "work/$slug-$Date"
if (Test-GitReference -Reference "refs/heads/$branch") {
    throw "Branch '$branch' bestaat al. Kies een andere run-id; er is niets gewijzigd."
}

$previousGitTerminalPrompt = [System.Environment]::GetEnvironmentVariable('GIT_TERMINAL_PROMPT', 'Process')
$previousGcmInteractive = [System.Environment]::GetEnvironmentVariable('GCM_INTERACTIVE', 'Process')
try {
    [System.Environment]::SetEnvironmentVariable('GIT_TERMINAL_PROMPT', '0', 'Process')
    [System.Environment]::SetEnvironmentVariable('GCM_INTERACTIVE', 'Never', 'Process')
    Invoke-Git -Arguments @('fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main')
} finally {
    [System.Environment]::SetEnvironmentVariable('GIT_TERMINAL_PROMPT', $previousGitTerminalPrompt, 'Process')
    [System.Environment]::SetEnvironmentVariable('GCM_INTERACTIVE', $previousGcmInteractive, 'Process')
}
$localMain = Get-GitOutput -Arguments @('rev-parse', 'refs/heads/main')
$originMain = Get-GitOutput -Arguments @('rev-parse', 'refs/remotes/origin/main')
if ($localMain -ne $originMain) {
    throw "Lokale main ($localMain) wijkt af van actuele origin/main ($originMain). Synchroniseer main bewust en probeer opnieuw; er is geen branch aangemaakt."
}

Invoke-Git -Arguments @('switch', '--create', $branch, 'refs/remotes/origin/main')

Write-Host "`nTijdelijke branch aangemaakt: $branch" -ForegroundColor Green
Write-Host "Basis: origin/main ($originMain)"
Write-Host 'Er is geen worktree, backupbranch of tag aangemaakt en er is niets gepusht.'
Write-WorkingTreeSummary
