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
        Name = 'Provision lokale TEST-runtimeconfig'
        Aliases = @('test runtime config herstellen', 'test config provisionen')
        Description = 'Maakt de centrale TEST-runtimeconfig als geverifieerde NTFS-hardlink naar de beschermde canonieke config; leest of kopieert geen waarden en weigert een afwijkend bestaand doel.'
        Source = '.\scripts\provision-test-runtime.ps1'
        Risk = 'Maakt alleen de centrale doelmap en hardlink; de canonieke config wordt niet geopend of gewijzigd'
        Example = '.\scripts\provision-test-runtime.ps1'
    },
    [pscustomobject]@{
        Name = 'Start lokale TEST-runtime'
        Aliases = @('test runtime starten', 'start liquidhr test', 'test preflight')
        Description = 'Controleert de centrale lokale TEST-target, dependencies, loopback-poort en buildprovenance; bouwen of starten gebeurt alleen met expliciete opties.'
        Source = '.\scripts\start-test-worktree.ps1'
        Risk = 'Laadt centrale runtimeconfig in een child-proces; installeert niets en wijzigt geen config'
        Example = '.\scripts\start-test-worktree.ps1 -Mode Production -PayrollAcceptance -Build'
    },
    [pscustomobject]@{
        Name = 'Git backup (uitgefaseerd)'
        Aliases = @('git backup', 'backup')
        Description = 'Fail-closed legacycommando; maakt geen commit, tag of branch.'
        Source = '.\scripts\backup.ps1'
        Risk = 'Read-only foutmelding; geen Git-mutatie'
        Example = 'Maak Git backup'
    },
    [pscustomobject]@{
        Name = 'Git restore (uitgefaseerd)'
        Aliases = @('git restore', 'restore')
        Description = 'Fail-closed legacycommando; reset of clean is uitgeschakeld.'
        Source = '.\scripts\restore.ps1'
        Risk = 'Read-only foutmelding; geen bestanden of refs wijzigen/verwijderen'
        Example = 'Zet Git backup terug'
    },
    [pscustomobject]@{
        Name = 'Nieuwe feature: <naam>'
        Aliases = @('nieuwe feature', 'feature starten')
        Description = 'Vereist schone lokale main gelijk aan actuele origin/main; maakt lokaal work/<run-id>-<YYYYMMDD> zonder worktree.'
        Source = '.\scripts\new-feature.ps1'
        Risk = 'Lokale branch; dirty tree wordt geweigerd'
        Example = '.\scripts\new-feature.ps1 -Name AA-LEAN-01'
    },
    [pscustomobject]@{
        Name = 'Feature afgerond'
        Aliases = @('feature finish', 'feature klaar')
        Description = 'Accepteert work/<run-id>-<YYYYMMDD>, vereist expliciete paden en commit alleen die paden; docs/tooling starten geen hr-suite.'
        Source = '.\scripts\finish-feature.ps1'
        Risk = 'Commit lokaal; geen merge of push'
        Example = '.\scripts\finish-feature.ps1 -Path docs/AA/AA-OP.md,scripts/new-feature.ps1'
    },
    [pscustomobject]@{
        Name = 'Feature samenvoegen'
        Aliases = @('feature merge', 'merge feature')
        Description = 'Voer gecontroleerd uit als de oorspronkelijke opdracht merge/push autoriseert; verwijder alleen de eigen tijdelijke branch na bevestigde integratie.'
        Source = 'docs\AA\AA-REL.md'
        Risk = 'Externe GitHub-mutatie; vereist passend mandaat en groene gates'
        Example = 'Feature samenvoegen'
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
    },
    [pscustomobject]@{
        Name = 'Schrijf blog'
        Aliases = @('blog schrijven', 'schrijf artikel', 'EdwinHelp schrijven', 'redigeer tekst')
        Description = 'Schrijft of redigeert Nederlandse blogs en professionele teksten in Edwin-stijl, vanuit chat of bestanden in work.'
        Source = 'docs\skills\edwinhelp-writing\SKILL.md'
        Risk = 'Read/write tekst; geen code-, Git-, database- of deploymentactie'
        Example = 'Schrijf een blog over de trend achter deze gebeurtenis'
    },
    [pscustomobject]@{
        Name = 'Redesign LiquidHR scherm'
        Aliases = @('scherm redesign', 'UX redesign', 'redesign pagina', 'herontwerp scherm')
        Description = 'Analyseert en herontwerpt één LiquidHR-scherm volgens Liquid Flow en werkt requirements, status en delivery-context bij.'
        Source = 'docs\skills\edwinhelp-screen-redesign\SKILL.md'
        Risk = 'Read/write UX-documentatie en in-scope UI; geen schema, merge, push of deploy zonder aparte opdracht'
        Example = 'Gebruik EdwinHelp. Redesign de pagina Rollen en autorisatie op /authorization.'
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

$selected = @(if ([string]::IsNullOrWhiteSpace($Command)) {
    $commands
} else {
    @($commands | Where-Object { Test-CommandMatch -Entry $_ -Query $Command.Trim() })
})

if ($selected.Count -eq 0) {
    throw "Geen Edwin-commando gevonden voor '$Command'. Gebruik EdwinHelp voor het volledige overzicht."
}

foreach ($entry in $selected) {
    Write-CommandEntry -Entry $entry -ShowDetails:$Detailed
}

Write-Host "`nGebruik: EdwinHelp -Detailed of EdwinHelp -Command 'backup'" -ForegroundColor Yellow
Write-Host "Uitbreiden: voeg een catalogus-item toe aan scripts/edwin-help.ps1 en documenteer aanvullende veiligheidsregels in AGENTS.md."
