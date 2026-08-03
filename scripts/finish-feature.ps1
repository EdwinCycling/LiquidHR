[CmdletBinding()]
param(
    [string]$Message
)

. (Join-Path $PSScriptRoot '_git-toolkit-common.ps1')

Write-ToolkitHeader -Title 'Feature afronden'

$branch = Get-CurrentBranch
if ($branch -notmatch '^feature/.+') {
    throw "Feature afronden kan alleen op een branch met naam 'feature/<naam>'. Huidige branch: $branch"
}

Write-Host 'Stap 1/3: gerichte tests uitvoeren (hr-suite).' -ForegroundColor Yellow
$testOutput = (& npm.cmd test --workspace @liquid-hr/hr-suite -- --run 2>&1 | Out-String).TrimEnd()
if ($LASTEXITCODE -ne 0) {
    if (-not [string]::IsNullOrWhiteSpace($testOutput)) { Write-Host $testOutput }
    throw 'Tests zijn mislukt. Er is geen commit, tag-update, merge of push uitgevoerd.'
}
if (-not [string]::IsNullOrWhiteSpace($testOutput)) { Write-Host $testOutput }

Write-Host 'Stap 2/3: lokale feature-commit maken.' -ForegroundColor Yellow
$status = Get-WorkingTreeStatus
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host 'Geen wijzigingen om te committen; de huidige HEAD wordt als last-good gemarkeerd.' -ForegroundColor Yellow
} else {
    $defaultMessage = "feat: $($branch.Substring('feature/'.Length))"
    $commitMessage = if ([string]::IsNullOrWhiteSpace($Message)) { $defaultMessage } else { $Message.Trim() }
    Invoke-Git -Arguments @('add', '-A')
    Invoke-Git -Arguments @('commit', '-m', $commitMessage)
}

$head = Get-GitOutput -Arguments @('rev-parse', 'HEAD')
Invoke-Git -Arguments @('tag', '--force', 'last-good', $head)
Invoke-Git -Arguments @('branch', '--force', 'backup/last-good', $head)

Write-Host 'Stap 3/3: lokaal mergevoorstel tonen; merge wordt niet uitgevoerd.' -ForegroundColor Yellow
$shortHead = Get-GitOutput -Arguments @('rev-parse', '--short', $head)
$mainExists = Test-GitReference -Reference 'refs/heads/main'
Write-Host "`nFeature afgerond op $branch ($shortHead)." -ForegroundColor Green
Write-Host 'last-good en backup/last-good wijzen nu naar deze lokale commit.'
if ($mainExists) {
    Write-Host "Voorstel: controleer 'git diff main...$branch' en merge daarna bewust met 'git switch main' gevolgd door 'git merge $branch'."
}
Write-Host 'Er is geen merge en geen push uitgevoerd.'
Write-WorkingTreeSummary
