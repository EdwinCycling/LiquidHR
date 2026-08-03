[CmdletBinding()]
param(
    [string]$Message
)

. (Join-Path $PSScriptRoot '_git-toolkit-common.ps1')

Write-ToolkitHeader -Title 'Git backup maken'

$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
$commitMessage = if ([string]::IsNullOrWhiteSpace($Message)) { "backup: snapshot $timestamp" } else { $Message.Trim() }
$before = Get-WorkingTreeStatus

if ([string]::IsNullOrWhiteSpace($before)) {
    Write-Host 'Geen wijzigingen gevonden; er wordt geen nieuwe commit gemaakt.' -ForegroundColor Yellow
} else {
    Write-Host 'Wijzigingen worden lokaal als backup-commit vastgelegd.' -ForegroundColor Yellow
    Invoke-Git -Arguments @('add', '-A')
    Invoke-Git -Arguments @('commit', '-m', $commitMessage)
}

$head = Get-GitOutput -Arguments @('rev-parse', 'HEAD')
Invoke-Git -Arguments @('tag', '--force', 'last-good', $head)
Invoke-Git -Arguments @('branch', '--force', 'backup/last-good', $head)

$shortHead = Get-GitOutput -Arguments @('rev-parse', '--short', $head)
Write-Host "`nBackup gereed: $shortHead" -ForegroundColor Green
Write-Host 'Tag: last-good | Branch: backup/last-good'
Write-Host 'Er is niets naar GitHub gepusht.'
Write-WorkingTreeSummary
