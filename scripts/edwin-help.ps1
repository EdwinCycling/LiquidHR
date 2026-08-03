[CmdletBinding()]
param(
    [string]$Command,
    [switch]$Detailed
)

. (Join-Path $PSScriptRoot '_git-toolkit-common.ps1')

# Voeg hier één object toe wanneer een nieuw natuurlijk Edwin-commando ontstaat.
$commands = @(
    [pscustomobject]@{
        Name = 'EdwinHelp'
        Aliases = @('help', 'overzicht', 'commando overzicht')
        Description = "Toont alle afgesproken Edwin-commando's en wat ze doen."
        Source = '.\scripts\edwin-help.ps1'
        Risk = 'Read-only'
        Example = 'EdwinHelp'
    },
    [pscustomobject]@{
        Name = 'Maak Git backup'
        Aliases = @('git backup', 'backup')
        Description = 'Maakt lokaal een backup-commit en werkt last-good bij.'
        Source = '.\scripts\backup.ps1'
        Risk = 'Commit lokaal; geen push'
        Example = 'Maak Git backup'
    },
    [pscustomobject]@{
        Name = 'Zet Git backup terug'
        Aliases = @('git restore', 'restore')
        Description = 'Zet tracked bestanden terug naar last-good na bevestiging.'
        Source = '.\scripts\restore.ps1'
        Risk = 'Destructief; bevestiging vereist'
        Example = 'Zet Git backup terug'
    },
    [pscustomobject]@{
        Name = 'Nieuwe feature: <naam>'
        Aliases = @('nieuwe feature', 'feature starten')
        Description = 'Maakt een genormaliseerde featurebranch vanaf last-good.'
        Source = '.\scripts\new-feature.ps1'
        Risk = 'Lokale branch; dirty tree wordt geweigerd'
        Example = 'Nieuwe feature: Split Screen'
    },
    [pscustomobject]@{
        Name = 'Feature afgerond'
        Aliases = @('feature finish', 'feature klaar')
        Description = 'Draait tests, maakt lokaal een commit en toont een mergevoorstel.'
        Source = '.\scripts\finish-feature.ps1'
        Risk = 'Commit lokaal; geen merge of push'
        Example = 'Feature afgerond'
    },
    [pscustomobject]@{
        Name = 'Maak project overview'
        Aliases = @('project overview', 'projectoverzicht', 'metrics')
        Description = "Maakt een actuele inventaris met code-KPI's, routes, database en mandagenbandbreedte."
        Source = 'docs\skills\project-overview\SKILL.md'
        Risk = 'Read-only; live DB-cijfers alleen met beschikbare connector'
        Example = 'Maak een project overview'
    },
    [pscustomobject]@{
        Name = 'Meet Next geheugen'
        Aliases = @('next geheugen', 'memory meting')
        Description = 'Meet periodiek geheugen en proceswaarden van een draaiende Next-server.'
        Source = '.\scripts\measure-next-memory.ps1'
        Risk = 'Schrijft alleen het opgegeven meetbestand'
        Example = '.\scripts\measure-next-memory.ps1 -ProcessIdParam 1234 -OutputPath .\work\next-memory.csv'
    }
)

function Test-CommandMatch {
    param(
        [Parameter(Mandatory)]
        [psobject]$Entry,
        [Parameter(Mandatory)]
        [string]$Query
    )

    $terms = @($Entry.Name) + @($Entry.Aliases)
    return @($terms | Where-Object { $_.IndexOf($Query, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 }).Count -gt 0
}

function Write-CommandEntry {
    param(
        [Parameter(Mandatory)]
        [psobject]$Entry,
        [switch]$ShowDetails
    )

    Write-Host "`n$($Entry.Name)" -ForegroundColor Cyan
    Write-Host "  $($Entry.Description)"
    if ($ShowDetails) {
        Write-Host "  Bron:   $($Entry.Source)"
        Write-Host "  Veilig: $($Entry.Risk)"
        Write-Host "  Voorbeeld: $($Entry.Example)"
    }
}

Write-ToolkitHeader -Title 'EdwinHelp'
Write-Host 'Dit is een lokaal, read-only overzicht. Het voert geen workflow uit.'

$selected = if ([string]::IsNullOrWhiteSpace($Command)) {
    $commands
} else {
    @($commands | Where-Object { Test-CommandMatch -Entry $_ -Query $Command.Trim() })
}

if ($selected.Count -eq 0) {
    throw "Geen Edwin-commando gevonden voor '$Command'. Gebruik EdwinHelp voor het volledige overzicht."
}

foreach ($entry in $selected) {
    Write-CommandEntry -Entry $entry -ShowDetails:$Detailed
}

Write-Host "`nGebruik: EdwinHelp -Detailed of EdwinHelp -Command 'backup'" -ForegroundColor Yellow
Write-Host "Uitbreiden: voeg een catalogus-item toe aan scripts/edwin-help.ps1 en documenteer aanvullende veiligheidsregels in AGENTS.md."
