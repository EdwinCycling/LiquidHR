# Lokale runtime en Vercel on-demand-procedure

Bijgewerkt: 2026-10-07

Deze procedure geldt voor LiquidHR-worktrees en expliciet aangevraagde previews/releases. GitHub `main` is de Development-baseline; de actieve Vercel `production`-deployment blijft de afzonderlijke synthetische TEST-baseline.

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

Elke worktree gebruikt een vrije eigen localhost-poort; de standaard is development `3010` en productie `3011`. Als die bezet is, kies een vrije `-Port`; stop nooit een bestaand proces. De browseracceptatie gebruikt de exacte actieve worktree/HEAD, een normale Test HR Admin-login en de afgesproken desktop- en 390 px-matrix. Test Auth blijft uitsluitend lokaal beschikbaar en faalt buiten lokale ontwikkeling gesloten.

## GitHub-integratie en expliciete Vercel Preview

- Gewone PR's en merges blijven in GitHub; ze mogen geen Vercel-build of Preview starten. `vercel.json` gebruikt `"git": { "deploymentEnabled": false }`. Schakel vóór de eerste policy-push ook de effectieve Vercel-projecttriggers uit en controleer branchregels, hooks, Actions en externe callers. Als dit niet betrouwbaar bevestigd is, stop vóór push. Verbreek de Git-integratie niet.
- `ignoreCommand` is alleen een fail-open buildfilter: alleen een niet-lege, SHA-geverifieerde docs-only Markdown-diff wordt overgeslagen. Dit voorkomt op zichzelf geen deploymentrecord.
- Een Preview is alleen toegestaan na expliciet verzoek en wanneer de risk-/releasegate die vereist. Gebruik een immutable commit-URL en uitsluitend Preview-scoped omgevingsvariabelen naar afzonderlijke synthetische backends. Gebruik geen lokale of gezamenlijke TEST-config. Namen van minimaal benodigde variabelen: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, en voor Payroll `PAYROLL_SUPABASE_URL`, `PAYROLL_SUPABASE_SECRET_KEY`, `PAYROLL_LAB_ENABLED`.
- Maak die Preview handmatig met Vercel CLI (`vercel deploy`) vanuit de schone checkout van de gekozen commit; start nooit een PR-/branch-trigger.
- Voer op een expliciet aangevraagde Preview-commit de normale browseracceptatie uit: publieke login, beveiligde route/authgedrag, relevante HR-scenario's, console/networkcontrole, styles en mobiel 390 px. Payroll omvat daarnaast de vereiste Payroll-routes en autorisatie-/scopecontroles. Test Auth mag niet publiek beschikbaar zijn.
- Leg Preview-ID/URL, environment, bron-SHA, READY en browserresultaat vast. Een ontbrekende Preview-gate is alleen een blocker als de toepasselijke acceptatie haar vereist.

## Expliciete release: `RELEASE LIQUIDHR TEST`

Alleen een apart expliciet verzoek **“Release LiquidHR TEST.”** autoriseert een TEST-deployment. Een main-merge werkt alleen de Development-baseline bij.

1. Bevestig actuele GitHub `main`, een schone releasecheckout en één vaste SHA. Controleer de actieve `liquidhr`-TEST-deployment, alias, appversie, rollback-/hersteloptie en databasecompatibiliteit.
2. Voer passende lokale releasegates uit. Verhoog indien nodig `apps/hr-suite/lib/app-version.ts` exact eenmaal; commit daarna en fixeer de definitieve source-SHA.
3. Gebruik de gekoppelde `liquidhr`-projectconfiguratie en production build settings vanuit de exacte schone releasecheckout. Start expliciet via Vercel CLI: `vercel deploy --prod`. Voer dit nooit uit bij een gewone push/merge; gebruik geen `vercel promote` of ander project.
4. Controleer deployment-ID, project, READY, exacte bron-SHA waar Vercel die toont, appversie en canonical alias. Voer één toepasselijke hosted smoke uit.
5. Als Vercel geen betrouwbare Git-SHA metadata levert, leg dan in `docs/quality/acceptance/runs/` een release-manifest vast met source commit-SHA en tree-SHA, deployment-ID/URL en buildlog, appversie, tijdstip, alias-readback en smoke-uitkomst. Rapporteer dit als manifestprovenance; claim geen metadata-SHA-pariteit zonder bewijs.
6. Werk de Deployed TEST-baseline bij en meet Function Storage. Geen deploymentopschoning in deze releaseflow.

Zie [Vercel Git deployments](https://vercel.com/docs/git), [Vercel environments](https://vercel.com/docs/deployments/environments), [environment variables](https://vercel.com/docs/environment-variables) en [promotion behavior](https://vercel.com/docs/deployments/promote-preview-to-production).

## Deploymentminima, Function Storage en retentie

- De `ignoreCommand` slaat alleen een niet-lege, geverifieerde docs-only Markdown-diff over. Ontbrekende of ongeldige SHAs, een lege diff, Git-fout of andere bestanden laten Vercel bouwen.
- Bij Chromium-, Playwright- of PDF-tracingwijzigingen: productiebuild plus `apps/hr-suite/scripts/check-function-trace-size.mjs`; leg dezelfde NFT-routepakketten vóór en na vast.
- Waarschuw vanaf 60% van de toepasselijke Vercel-opslaglimiet (Hobby: 6 GB van 10 GB). Meet vóór en na elke expliciete release of apart geautoriseerde retentiewijziging. Bescherm de actieve canonieke TEST-deployment; geen automatische opruiming. Retentie blijft expliciet beheerd; deploymentgeschiedenis mag alleen na afzonderlijk mandaat worden opgeschoond met de bewezen PowerShell V4-procedure en voorafgaande SHA-/aliascontrole. Zie `docs/AA/AA-REL.md` §6.

## Eenmalige Preview-backendconfiguratie

Preview-configuratie is alleen nodig wanneer een Preview expliciet als gate wordt vereist. Richt dit eenmalig in voordat zo'n gate wordt uitgevoerd:

1. Provision een aparte, geïsoleerde synthetische Core Preview-backend en een aparte Payroll Preview-backend; gebruik geen productie- of gezamenlijke TEST-database.
2. Voeg in Vercel-project `liquidhr` de hierboven genoemde variabelen toe aan de **Preview**-omgeving, met waarden van uitsluitend deze geïsoleerde Preview-backends. Zet dezelfde Preview-configuratie niet op Production of Development en kopieer geen lokale configuratiebestanden.
3. Configureer voor de Preview-hostnames alleen de vereiste normale auth-callback-/redirect-allowlist. Houd Test Auth fail-closed op Preview en Production. Gebruik een bestaande, goedgekeurde synthetische Test HR Admin-identiteit.
4. Bevestig dat gewone PR's geen Preview starten en dat een expliciet aangevraagde Preview met de on-demand route kan worden gemaakt; controleer of deploymentmetadata de commit-SHA toont.

Deze instellingen worden hier alleen beschreven; dit document bevat geen waarden en voert geen externe configuratiewijziging uit. Ontbreekt een afzonderlijke Preview-backend of Vercel Preview-instelling, registreer de Preview-gate als `BLOCKED BY ENVIRONMENT` en voer geen browserauthenticatie tegen een gedeelde/Production-database uit.
