# Lokale TEST-runtime en Vercel Preview-procedure

Bijgewerkt: 2026-10-07

Deze procedure geldt voor nieuwe LiquidHR-worktrees en toekomstige pull requests. Zij scheidt de lokale TEST-runtime, Vercel Preview en de gezamenlijke TEST-release.

## Lokale TEST-runtime per worktree

De enige goedgekeurde lokale TEST-configuratie staat centraal op:

`%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local`

Als dit centrale bestand ontbreekt, voer dan vanuit de repositoryroot de metadata-only provisioner uit:

```powershell
.\scripts\provision-test-runtime.ps1
.\scripts\start-test-worktree.ps1 -Mode Development -PreflightOnly
```

De provisioner controleert alleen dat de beschermde canonical `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\.env.local` bestaat en maakt de doelmap plus een NTFS-hardlink naar diezelfde file. Er wordt geen bestandsinhoud gelezen, geprint, gekopieerd, overschreven of verplaatst. Een afwijkend bestaand doel wordt geweigerd; ontbrekende hardlinkondersteuning geeft een fout zonder fallback-kopie. Een reeds geverifieerde hardlink is idempotent.

Gebruik vanuit de repositoryroot:

```powershell
.\scripts\start-test-worktree.ps1 -Mode Development -PreflightOnly
.\scripts\start-test-worktree.ps1 -Mode Development -PayrollAcceptance
```

De eerste opdracht controleert zonder serverstart; de tweede start Next.js op `127.0.0.1:3010`. De scriptcontrole omvat de centrale config (alleen vereiste namen/aanwezigheid), het vaste Core TEST-project, runtimeversie, bestaande workspace-dependencies, vrije loopback-poort en start/buildscripts. Met `-PayrollAcceptance` worden ook het vaste Payroll Lab TEST-project, de Payroll-runtimevelden en exact `PAYROLL_LAB_ENABLED=true` gecontroleerd. De enige ondersteunde Core-clientkey is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Maak een productiebuild vanaf een schone, vastgelegde kandidaat met:

```powershell
.\scripts\start-test-worktree.ps1 -Mode Production -PayrollAcceptance -Build
.\scripts\start-test-worktree.ps1 -Mode Production -PayrollAcceptance -PreflightOnly
.\scripts\start-test-worktree.ps1 -Mode Production -PayrollAcceptance
```

De productiepoort is standaard `3011`. `-Build` weigert een bezette gekozen poort en schrijft na een geslaagde Next.js-build provenance met de commit-SHA, `BUILD_ID` en een hash van alleen de `NEXT_PUBLIC_*`-waarden. Productie-preflight vergelijkt die gegevens opnieuw met de schone worktree en centrale config. Een ontbrekende of verouderde provenance blokkeert starten. Gebruik een andere `-Port` bij een aparte worktree wanneer de standaardpoort door een andere worktree wordt gebruikt; bouw nooit in een worktree waarvan de runtime op een andere poort actief is. Zonder `-Build` bouwt, installeert of stopt het script niets. Als dependencies ontbreken, herstel ze apart vanaf de repository-lockfile en herhaal de preflight.

Het script laadt het centrale bestand rechtstreeks in het Next child-proces via Node `--env-file`. Het toont geen waarden en schrijft geen `.env.local`. Een worktree zonder lokaal `.env.local` is ondersteund. Als er wel een lokaal `.env.local` staat, moet metadata aantonen dat het dezelfde centrale hardlink is; het script weigert een niet-geverifieerde kopie zonder die te openen of te verwijderen. Geërfde Supabase-, Payroll-, Test Auth-, Vercel- en Node-runtimevariabelen worden alleen op naam gecontroleerd om overschrijven te voorkomen. Een bezette poort geeft een fout; het bestaande proces wordt nooit gestopt.

De browseracceptatie gebruikt de exacte actieve worktree/HEAD, een normale Test HR Admin-login en de afgesproken desktop- en 390 px-matrix. Test Auth blijft uitsluitend lokaal beschikbaar en faalt buiten lokale ontwikkeling gesloten.

## Lokale live-meekijkmodus voor toekomstige Payroll-bouwslagen

**Werkafspraak 14 oktober 2026 — PAYFULL-01 is nog niet gestart.** Voor een expliciet gestarte Payroll-build kan Codex zelf de beveiligde launcher gebruiken. Edwin hoeft de PowerShell-instructie niet handmatig uit te voeren; de launcher blijft wel de gecontroleerde manier om juiste TEST-config en loopbackguard te gebruiken.

```powershell
.\scripts\start-test-worktree.ps1 -Mode Development -PayrollAcceptance -Port 3010
```

- Na geslaagde start test de gebruiker rechtstreeks in de browser op `http://127.0.0.1:3010`. Bij een bezette poort kiest Codex bewust een vrije poort met `-Port`; een bestaande server wordt niet gestopt. De **werkelijk** actieve URL en worktree/head-SHA moeten worden gemeld; zonder succesvolle start is er geen localhost-website beschikbaar.
- Codex moet de server in een beheerde, blijvende Windows-terminal/sessie laten draaien; het script blokkeert als foreground-server. Zodra die terminal/sessie eindigt kan de server stoppen. Een afgeronde agentrun garandeert geen eeuwig actief proces.
- De Next.js Development-modus laat tussentijds lokaal testen en code-refresh toe, dus normale iteraties hebben geen Vercel-deployment nodig. Dit is dezelfde HR Suite inclusief de bestaande Payroll-routes, geen tweede Payroll-app of Docker.
- Core TEST en Payroll Lab TEST blijven afzonderlijke **remote Supabase-databases**. Lokaal draaien of een geslaagde browserstart verleent géén toestemming om daar migraties, fiscale brondata, rollen of Payroll-historie te wijzigen. Volg de expliciete TEST-write- en acceptatiegates uit `AGENTS.md` en AA-PAYROLL.
- Lokale Test Auth/role-switch blijft onder Development/loopback/projectguards. Hosted Preview/Production is geen route voor Test Auth. Een Payroll-persona is pas bruikbaar zodra zijn Auth-, employment- en ESS-scope afzonderlijk bewezen zijn.

Zie [PAYFULL-01-uitvoeringsplan](../payroll/PAYFULL-01-EXECUTION-PLAN-20261014.md); de startopdracht wordt **later** gegeven door de gebruiker.

## Pull request en Vercel Preview

1. Push een kandidaatbranch en maak de bedoelde pull request. Het Vercel-project `liquidhr` hoort daarvoor een Preview-deployment met een immutable commit-URL te leveren.
2. Preview gebruikt uitsluitend Preview-scoped omgevingsvariabelen naar afzonderlijke synthetische Preview-backends. Gebruik geen lokale TEST- of gezamenlijke TEST-waarden. Minimaal benodigde namen zijn `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, en voor Payroll `PAYROLL_SUPABASE_URL`, `PAYROLL_SUPABASE_SECRET_KEY`, `PAYROLL_LAB_ENABLED`.
3. Voer op de exacte Preview-commit de normale browseracceptatie uit: publieke login, beveiligde route/authgedrag, relevante HR-scenario's, console/networkcontrole, styles, en mobiel 390 px. Payroll-Preview omvat daarnaast de voor de PR verplichte Payroll-routes en autorisatie-/scopecontroles. Test Auth mag niet publiek beschikbaar zijn.
4. Leg deployment-ID/URL, Preview-omgeving, commit-SHA, READY-status en browserresultaat vast in de PR-/acceptatie-evidence. Voor toekomstige PR-releases is ontbrekende of mislukte Preview-acceptatie een blokkade. De huidige ONE VERSION-release gebruikt de reeds geslaagde browseracceptatie op de exacte geïntegreerde lokale productiebuild; ontbrekende nieuwe Preview-instellingen blokkeren deze release niet.
5. Na onafhankelijke review en GREEN Preview-acceptatie wordt de PR gecontroleerd naar `main` gemerged. De Git-integratie bouwt vervolgens de exacte `main`-commit voor de bestaande gezamenlijke TEST-release. In dit project heet die Vercel-deploymentomgeving `Production`; dat label verandert de operationele TEST-grens niet.
6. Controleer dat de `liquidhr`-deployment READY is, dat Git-commit-SHA exact overeenkomt met `origin/main`, dat de bestaande TEST-alias naar die deployment wijst, en voer de beperkte hosted TEST-smoke uit. Bewaar Preview- en TEST-releasebewijs afzonderlijk.

Promoveer niet handmatig een Preview-deployment met `vercel promote` voor deze route. Vercel bouwt bij die actie opnieuw met Production-omgevingsvariabelen; de gecontroleerde PR-merge naar `main` levert hier de releasecommit en herhaalbare Git-provenance. Zie [Vercel Git deployments](https://vercel.com/docs/git), [Vercel environments](https://vercel.com/docs/deployments/environments), [environment variables](https://vercel.com/docs/environment-variables) en [promotion behavior](https://vercel.com/docs/deployments/promote-preview-to-production).

## Eenmalige inrichting door Edwin voor Preview

Preview-configuratie is nog geen voorwaarde voor de huidige gezamenlijke TEST-release. Richt dit eenmalig in voordat een volgende PR Preview-browseracceptatie vereist:

1. Provision een aparte, geïsoleerde synthetische Core Preview-backend en een aparte Payroll Preview-backend; gebruik geen productie- of gezamenlijke TEST-database.
2. Voeg in Vercel-project `liquidhr` de hierboven genoemde variabelen toe aan de **Preview**-omgeving, met waarden van uitsluitend deze geïsoleerde Preview-backends. Zet dezelfde Preview-configuratie niet op Production of Development en kopieer geen lokale configuratiebestanden.
3. Configureer voor de Preview-hostnames alleen de vereiste normale auth-callback-/redirect-allowlist. Houd Test Auth fail-closed op Preview en Production. Gebruik een bestaande, goedgekeurde synthetische Test HR Admin-identiteit.
4. Bevestig dat pull requests een branch-/commit-specifieke Vercel Preview-deployment opleveren en dat deploymentmetadata de commit-SHA toont.

Deze instellingen worden hier alleen beschreven; dit document bevat geen waarden en voert geen externe configuratiewijziging uit. Ontbreekt een afzonderlijke Preview-backend of Vercel Preview-instelling, registreer de Preview-gate als `BLOCKED BY ENVIRONMENT` en voer geen browserauthenticatie tegen een gedeelde/Production-database uit.
