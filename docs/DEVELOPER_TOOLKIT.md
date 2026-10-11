# Codex Developer Toolkit

De scripts zijn kleine, lokale helpers. De canonieke uitvoering staat in [`AGENTS.md`](../AGENTS.md), [`AA-OP.md`](AA/AA-OP.md), [`AA-TEST.md`](AA/AA-TEST.md) en [`AA-REL.md`](AA/AA-REL.md). Geen script voert ongemerkt brede staging, branch-/tagverplaatsing, reset, clean, merge of push uit.

## Huidige Git-workflow

| Commando | Gedrag |
| --- | --- |
| `EdwinHelp` | Read-only overzicht van actuele commando's en risico's. |
| `Nieuwe feature: <run-id>` | `new-feature.ps1 -Name <run-id>` vereist een schone lokale `main`, haalt `origin/main` non-interactief op, stopt bij een afwijkende SHA of ontbrekende Git-toegang en maakt lokaal `work/<slug>-<YYYYMMDD>`. Geen loginprompt, worktree, backupref of push. |
| `Feature afgerond` | `finish-feature.ps1 -Path <paden>` accepteert alleen `work/<run-id>-<YYYYMMDD>`, controleert scope en beschermde paden, en commit uitsluitend de expliciet genoemde bestanden. Docs-/tooling-only draait geen HR-suite. Codebestanden vereisen één expliciete gerichte `-Verify`-opdracht; er start nooit automatisch een volledige suite. |
| `Git backup` / `Git restore` | `backup.ps1` en `restore.ps1` zijn uitgefaseerd en fail-closed. Ze maken geen commits/refs en overschrijven/verwijderen niets, ook niet met oude switches. |
| `Feature samenvoegen` | Alleen uitvoeren als de oorspronkelijke opdracht merge/push autoriseert. Volg de toepasselijke gates uit `AA-REL.md`; verifieer daarna main en de eventueel automatisch gestarte deployment. |

Kleine, veilige werkzaamheden gebruiken waar passend de bestaande schone checkout. Een branch en aparte worktree zijn geen standaardvereiste. De enige branchvorm is `work/<RUN-ID>-<YYYYMMDD>`; `last-good` is geen baseline.

## Voorbeelden

```powershell
EdwinHelp
EdwinHelp -Detailed
EdwinHelp -Command 'nieuwe feature'
.\scripts\new-feature.ps1 -Name 'AA-LEAN-01'
```

Docs-/toolingwijzigingen afronden:

```powershell
.\scripts\finish-feature.ps1 -Path @('AGENTS.md', 'docs/AA/AA-OP.md', 'scripts/new-feature.ps1') -Message 'chore: align Codex operating model'
```

Een codewijziging vereist de concrete gerichte check. Geef de uitvoerbare opdracht als array door; selecteer de juiste test volgens `AA-TEST.md`:

```powershell
$verify = @('npm.cmd', 'test', '--workspace', '@liquid-hr/hr-suite', '--', '--run', 'lib/feature.test.ts')
.\scripts\finish-feature.ps1 -Path @('apps/hr-suite/lib/feature.ts', 'apps/hr-suite/lib/feature.test.ts') -Verify $verify
```

Voer alle overige toepasselijke typecheck-, lint-, i18n-, browser- of buildgates apart uit vóór afronding. Een `-Verify`-opdracht vervangt die gates niet.

## EdwinHelp

```powershell
.\scripts\edwin-help.ps1
.\scripts\edwin-help.ps1 -Detailed
.\scripts\edwin-help.ps1 -Command 'backup'
```

`EdwinHelp` voert zelf geen tests, commits, branch-, database-, merge-, push- of deploymentactie uit. De canonieke lokale TEST-runtimecommando's zijn `provision-test-runtime.ps1` en `start-test-worktree.ps1`; ze volgen de bescherming van `.env.local` en de centrale hardlink. Zie [`TEST_RUNTIME_AND_VERCEL_PREVIEW.md`](delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md).

## Andere vaste hulpmiddelen

- Redesign: [`docs/skills/edwinhelp-screen-redesign/SKILL.md`](skills/edwinhelp-screen-redesign/SKILL.md).
- Projectinventaris: [`docs/skills/project-overview/SKILL.md`](skills/project-overview/SKILL.md).
- Schrijf-/redigeerwerk: [`docs/skills/edwinhelp-writing/SKILL.md`](skills/edwinhelp-writing/SKILL.md).
- Next-geheugenmeting: `scripts/measure-next-memory.ps1`.

Schrijfmodus, projectinventaris en geheugenmeting zijn afzonderlijke taken en verruimen geen Git-, database-, security-, merge- of deploymandaat.
