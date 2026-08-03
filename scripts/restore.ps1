[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$Clean
)

. (Join-Path $PSScriptRoot '_git-toolkit-common.ps1')

Write-ToolkitHeader -Title 'Git backup terugzetten'

if (-not (Test-GitReference -Reference 'refs/tags/last-good')) {
    throw "De backup-tag 'last-good' bestaat niet. Maak eerst een backup met .\scripts\backup.ps1."
}

$branch = Get-CurrentBranch
$target = Get-GitOutput -Arguments @('rev-parse', '--short', 'last-good')
$status = Get-WorkingTreeStatus
$hasChanges = -not [string]::IsNullOrWhiteSpace($status)

if ($hasChanges -and -not $Force) {
    throw "Restore geweigerd: de werkboom bevat wijzigingen. Maak eerst een backup of gebruik bewust -Force na controle van git status."
}

$untracked = Get-GitOutput -Arguments @('ls-files', '--others', '--exclude-standard')
$cleanWarning = if ($Clean) {
    if ([string]::IsNullOrWhiteSpace($untracked)) { 'Er zijn geen genegeerde/ongetrackte bestanden om te verwijderen.' } else { "Ook ongetrackte bestanden worden verwijderd:`n$untracked" }
} else {
    'Ongetrackte bestanden blijven behouden; gebruik -Clean alleen als je die expliciet wilt verwijderen.'
}

Write-Host "Doel: tag last-good ($target) op branch $branch" -ForegroundColor Yellow
if ($hasChanges) { Write-Host 'WAARSCHUWING: huidige tracked wijzigingen worden overschreven.' -ForegroundColor Red }
Write-Host $cleanWarning -ForegroundColor Yellow
$confirmation = Read-Host "Typ HERSTEL om door te gaan; ieder ander antwoord annuleert"
if ($confirmation -cne 'HERSTEL') {
    Write-Host 'Restore geannuleerd; er is niets gewijzigd.' -ForegroundColor Yellow
    exit 0
}

Invoke-Git -Arguments @('reset', '--hard', 'last-good')
if ($Clean) {
    Invoke-Git -Arguments @('clean', '-fd')
}

Write-Host "`nRestore voltooid naar $target op branch $branch." -ForegroundColor Green
Write-Host 'Er is niets naar GitHub gepusht en er is geen merge uitgevoerd.'
Write-WorkingTreeSummary
