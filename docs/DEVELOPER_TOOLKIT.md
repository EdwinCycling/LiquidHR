# Codex Developer Toolkit

Deze toolkit geeft LiquidHR vaste, natuurlijke werkcommando's. `EdwinHelp` is het actuele startpunt; de scripts werken lokaal in Git en voeren nooit vanzelf een push of merge uit.

## Commando's

| Natuurlijk commando | Lokale actie |
| --- | --- |
| `EdwinHelp` | Read-only overzicht van alle commando's, bronnen, risico's en voorbeelden. |
| `Maak Git backup` | Stage alle lokale wijzigingen, maak zo nodig een backup-commit en verplaats `last-good` en `backup/last-good` naar de actuele commit. |
| `Zet Git backup terug` | Vraag een expliciete bevestiging en zet tracked bestanden terug naar `last-good`; nieuwe ongetrackte bestanden blijven standaard behouden. |
| `Nieuwe feature: <naam>` | Weigert een dirty werkboom, normaliseert `<naam>` naar `feature/<slug>` en maakt die branch vanaf `last-good`. |
| `Feature afgerond` | Controleert diff en kwaliteit, commit op de featurebranch en synchroniseert veilig met de nieuwste `main`. |
| `Feature samenvoegen` | Merge't en pusht `main`, controleert commit/deployment en ruimt worktree en branches pas daarna op. |
| `Maak project overview` | Gebruikt de project-overview-skill voor actuele lokale KPI's en optioneel geaggregeerde live Supabase-cijfers. |
| `Meet Next geheugen` | Meet een draaiende Next-server en schrijft de opgegeven CSV-meting. |
| `Schrijf blog` | Schrijft of redigeert Nederlandse blogs en professionele teksten in Edwin-stijl, vanuit chat of bestanden in `work`. |
| `Redesign LiquidHR scherm` | Analyseert en herontwerpt één scherm volgens de Liquid Flow-skill en werkt requirements, status en delivery-context bij. |

De natuurlijke commando's zijn vastgelegd in [`AGENTS.md`](../AGENTS.md). Codex vertaalt ze naar de scripts in [`scripts/`](../scripts/).

## EdwinHelp gebruiken

```powershell
.\scripts\edwin-help.ps1
.\scripts\edwin-help.ps1 -Detailed
.\scripts\edwin-help.ps1 -Command 'backup'
```

In Codex is `EdwinHelp` voldoende. De catalogus staat centraal in [`scripts/edwin-help.ps1`](../scripts/edwin-help.ps1), zodat een nieuw commando op één plek kan worden toegevoegd met naam, aliassen, beschrijving, bron, veiligheidsniveau en voorbeeld.

## Schrijven vanuit chat, work en Codex

De schrijfmodus staat in [`docs/skills/edwinhelp-writing/SKILL.md`](skills/edwinhelp-writing/SKILL.md). Gebruik hem met één van deze ingangen:

- **Chat:** zeg `Gebruik EdwinHelp. Schrijf een blog over ...` en plak observaties, bronnen of een concept in de chat.
- **work:** zet bronbestanden in de actuele `work`-map en zeg `Gebruik EdwinHelp. Lees de bestanden in work en schrijf een blog. Sla het resultaat op in outputs.`
- **Codex vanuit de repository:** zeg `Lees AGENTS.md en ga verder vanaf CURRENT_CONTEXT.md. Gebruik EdwinHelp en schrijf ...`.

De schrijfmodus mag tekstbestanden lezen en nieuwe tekstbestanden maken, maar voert geen code-, Git-, database-, merge-, push- of deploymentactie uit. Voor projectstatus, branches en Git blijft het bestaande EdwinHelp-commando leidend.

## Schermen redesignen vanuit EdwinHelp

De vaste werkwijze staat in [`docs/skills/edwinhelp-screen-redesign/SKILL.md`](skills/edwinhelp-screen-redesign/SKILL.md). De afgeronde schermen en de volgende pagina staan in [`docs/requirements/ux/SCHERM_REDESIGN_STATUS.md`](requirements/ux/SCHERM_REDESIGN_STATUS.md).

Gebruik bijvoorbeeld:

```text
Gebruik EdwinHelp. Redesign de pagina Rollen en autorisatie op /authorization. Lees eerst de bestaande autorisatie-requirements en het UX-statusdocument. Maak eerst het requirementsdocument en een ontwerpvoorstel.
```

## Veiligheidsregels

- De huidige werkboom wordt bij restore standaard beschermd; `-Force` is nodig om dirty tracked wijzigingen te overschrijven.
- Restore vraagt altijd om exact `HERSTEL`, ook wanneer `-Force` is gebruikt.
- Restore verwijdert standaard geen nieuwe bestanden. Gebruik `.\scripts\restore.ps1 -Force -Clean` alleen na controle van de lijst met ongetrackte bestanden.
- Een nieuwe feature start alleen vanuit een schone werkboom en weigert een bestaande branchnaam.
- Backup en finish werken alleen lokale refs bij. Ze pushen niet naar GitHub en mergen niet naar `main`.
- `Feature afgerond` maakt alleen een commit wanneer de tests slagen. Bij testfalen wordt niets gecommit of getagd.
- `EdwinHelp` is read-only; het commando voert geen backup, restore, tests, merge of push uit.

## Handmatig gebruik

```powershell
.\scripts\backup.ps1
.\scripts\restore.ps1
.\scripts\new-feature.ps1 -Name 'Split Screen'
.\scripts\finish-feature.ps1
```

Voor een expliciete commitboodschap:

```powershell
.\scripts\backup.ps1 -Message 'backup: voor split screen'
.\scripts\finish-feature.ps1 -Message 'feat: voeg split screen toe'
```

## Eerste gebruik

Omdat de huidige werkboom niet automatisch door deze taak wordt gecommit, voert Edwin vóór de eerste feature zelf uit:

```powershell
.\scripts\backup.ps1 -Message 'backup: start Codex Developer Toolkit'
```

Controleer daarna `git status`, `git log --oneline --decorate -3` en `git tag --list last-good` voordat je een featurebranch start.

Als de lokale PowerShell Execution Policy directe `.ps1`-uitvoering blokkeert, gebruik dan een tijdelijke procesoptie; deze wijzigt de machinebeleidinstelling niet:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup.ps1 -Message 'backup: start Codex Developer Toolkit'
```
