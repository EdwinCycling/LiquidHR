[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)]
    [string]$Name
)

. (Join-Path $PSScriptRoot '_git-toolkit-common.ps1')

Write-ToolkitHeader -Title 'Nieuwe feature'
Assert-CleanWorkingTree -Operation 'Een nieuwe feature starten'

if (-not (Test-GitReference -Reference 'refs/tags/last-good')) {
    throw "De backup-tag 'last-good' bestaat niet. Maak eerst een backup met .\scripts\backup.ps1."
}

$slug = ConvertTo-GitSlug -Name $Name
$featureBranch = "feature/$slug"
if (Test-GitReference -Reference "refs/heads/$featureBranch") {
    throw "Branch '$featureBranch' bestaat al. Kies een andere naam of ga er bewust naartoe met Git."
}

$base = Get-GitOutput -Arguments @('rev-parse', '--short', 'last-good')
Invoke-Git -Arguments @('switch', '--create', $featureBranch, 'last-good')

Write-Host "`nFeaturebranch aangemaakt: $featureBranch" -ForegroundColor Green
Write-Host "Basis: last-good ($base)"
Write-Host 'De branch is alleen lokaal aangemaakt; er is niets gepusht.'
Write-WorkingTreeSummary
