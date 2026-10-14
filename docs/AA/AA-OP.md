# AA-OP — Codex operating model

Status: **LEIDEND** · doel: een afgebakende opdracht zelfstandig en met zo weinig mogelijk onnodige context afronden.

## 1. Mandaat binnen scope

Codex mag zelfstandig:

- relevante code, documentatie, tests en afhankelijkheden onderzoeken en een kleine aanpak kiezen;
- een concreet defect reproduceren, de oorzaak vaststellen, in scope repareren en gericht hertesten;
- tests toevoegen en passende typecheck-, lint-, build- of browserchecks uitvoeren;
- bestaande synthetische TEST-fixtures lezen/gebruiken binnen expliciet toegestane scope;
- alleen expliciet geselecteerde eigen wijzigingen committen en een Draft PR openen indien de bestaande workflow dat vereist;
- een merge-/releaseworkflow uitvoeren wanneer de **oorspronkelijke opdracht** dat expliciet autoriseert.

Vraag niet na iedere normale handeling om toestemming. Een technisch herstelbare fout is geen reden om de opdracht terug te geven.

Afzonderlijke expliciete toestemming blijft nodig voor nieuwe remote database/schemawrites, inclusief TEST; destructieve businessdatawijzigingen; Production-data of echte klantgegevens; secret-/credentialwijzigingen; materiële securityrechten- of tenanttoegangsverruiming buiten scope; het definitief weggooien van unieke niet-geïntegreerde wijzigingen; en merge/deployment/release zonder mandaat uit de oorspronkelijke opdracht. Zie `AGENTS.md` voor de harde grenzen.

## 1a. AA-LEAN-02 — TEST Fast Delivery (2026-10-12)

**Context:** LiquidHR werkt **LOCAL FIRST → GITHUB CONTINUOUS → VERCEL ON DEMAND**. GitHub `main` is de Development-baseline; Vercel `production` blijft de bestaande synthetische TEST-baseline tot expliciete release. Dit verandert geen tenant-/persoonsdata-/securitygrenzen.

Kies vóór de eerste codewijziging **één route op basis van de effectieve diff en risico's**, niet op basis van bestandsnaam of omvang van het gehele project:

| Route | Wanneer | GitHub-integratie en bewijs |
| --- | --- | --- |
| **FAST** | Logo, icoon, statische tekst, beperkte CSS/layout zonder auth-, privacy-, scope- of businesscontractwijziging | Kleine patch; direct geraakte controle(s), lint/type/i18n indien relevant; **één gerichte visuele smoke** bij zichtbare UI. Geen standaard volledige suite, alle persona's, alle thema's of Preview. |
| **STANDARD** | Gewone afgebakende functionaliteit of niet-gevoelige bugfix | Gerichte unit/contract-/integratietests, relevante type/lint/build waar de wijziging dat vraagt en één representatieve lokale browserflow voor gewijzigd UI-gedrag. |
| **CONTROLLED** | Autorisatie, OAuth-toestemmingssemantiek of scopes, tenant/RLS, schema, security, Payroll, gevoelige gegevens of aantoonbaar brede shared-core-impact | Positieve én negatieve scope-/autorisatietests, toepasselijke integriteits- en runtimecontroles; volledige finale relevante releasegate. Een gehoste gate vereist ook een expliciet releasebesluit. |

Een puur visuele wijziging **op een OAuth-scherm** kan FAST zijn, zolang toestemmingsinhoud, rechten en serverlogica ongewijzigd blijven. Wijzigingen in de **betekenis** van consenttekst vragen minimaal gerichte inhoudelijke/security-contractcontrole en worden bij risico CONTROLLED. Een mergeconflict mag nooit nieuwe rechten verwijderen of verruimen.

**Standaardflow:** actuele main/safe checkout → kleinste patch → gerichte lokale checks → commit → push/merge alleen binnen het oorspronkelijke Git-mandaat → alleen GitHub Development-baseline bijwerken. Geen Vercel-build, Preview of hosted smoke starten vanuit een gewone integratie. Gebruik de aparte `RELEASE LIQUIDHR TEST`-procedure alleen na expliciet verzoek; zie `AA-REL.md` §6. Een GitHub-merge is geen release.

Geen nieuwe worktree wanneer een veilige bestaande checkout voldoet; bij aantoonbaar alleen beschermde of dirty checkouts is **één** tijdelijke schone integratie-worktree verdedigbaar. De aanwezigheid van framework-generated drift elders vereist geen destructieve cleanup of wijziging aan beschermd `next-env.d.ts`.

Voor normale FAST/STANDARD-opdrachten volstaat een beknopt eindbericht (wat, gerichte checks, commit/deployment, echte OPEN-punten). Geen automatische nieuwe uitgebreide acceptance-rapporten of AA-indexwijzigingen bij een kleine wijziging, tenzij risico of releasecontract dat vereist. Gepland repository-/worktreeonderhoud staat los van featurelevering.

Zie `AA-TEST.md` voor het testminimum en `AA-REL.md` voor TEST-integratie versus formele releaseacceptatie.

## 2. Bounded execution en herstel

Normale cyclus: **Understand → Implement → Fix → Targeted Test → Verify → Deliver**.

Bij een falende check:

1. Reproduceer de concrete fout en identificeer de oorzaak.
2. Herstel binnen scope.
3. Herhaal de relevante gerichte controle en bewijs dat de fout weg is.
4. Ga door met de resterende opdracht.

Maximaal **twee gerichte herstelcycli per afzonderlijke blocker**. Daarna volgt één compact bericht met oorzaak, geprobeerd herstel, bewijs en de benodigde menselijke beslissing. Geen identieke herdiagnose, onveranderde testherhaling, volledige docs-herlezing, nieuwe branch voor een herstelbare fout of brede architectuurstudie bij een gewone bugfix. Schrijf volledige logs naar een taaklokaal bestand wanneer nodig; geef alleen relevante foutregels/conclusies terug.

Registreer een punt in `AA-OPEN.md` alleen wanneer een vastgestelde externe afhankelijkheid, expliciete beslissing of bewijsgrens de laatste verplichte stap echt verhindert. Normale reproduceerbare bugs blijven in de fix-/hertestcyclus.

## 3. Git, branch en worktree

- `origin/main` is de enige nieuwe-ontwikkelingbaseline. Bevestig de actuele SHA vóór een aparte branch. Gebruik nooit `last-good` als bron.
- Werk op de bestaande veilige checkout wanneer dat kan. Maak alleen een tijdelijke branch wanneer scope-isolatie of PR-workflow nodig is; naam `work/<RUN-ID>-<YYYYMMDD>`. `scripts/new-feature.ps1` start vanaf schone lokale `main` die gelijk is aan de opgehaalde `origin/main`.
- Maak geen automatische tweede worktree. Onderzoek of review vereist geen checkout. Bij expliciet geautoriseerde parallelle ontwikkeling heeft ieder traject een afgebakende eigenaar/bestandscope en dezelfde bevestigde main-SHA; één integrator doet de eindgate.
- Bescherm `work/payroll-p0-p1` en de bestaande Nmbrs-worktree. Neem bestaande unieke commits en wijzigingen niet stilzwijgend over of weg.
- Stage expliciete paden; nooit `git add -A`/`.` voor gemengde werkbomen. Gebruik geen permanente backup-, rescue- of archivebranch/tag.
- Geen automatische force-push, force-tag/branch, reset of clean. Oude `backup.ps1`/`restore.ps1` zijn fail-closed en maken of verwijderen niets.
- Een dirty werkboom wordt eerst geïnventariseerd. Behoud alle wijzigingen; voer geen branch-start uit op een dirty boom en commit niets buiten de opgegeven scope.

## 4. Geen containers; veilige lokale omgeving

Gebruik de bestaande Node/npm-, Vitest-, TypeScript-, ESLint-, PowerShell- en geautoriseerde browser-/Vercel/Supabase-middelen. Kies per worktree een vrije localhost-poort; stop nooit een bestaand proces om die vrij te maken. Gebruik geen Docker, Docker Desktop, compose, lokale containerized Supabase, devcontainer of WSL-workaround.

Bescherm `apps/hr-suite/.env.local` en de centrale TEST-hardlink `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local`. Toon of lees geen waarden, kopieer/vervang/verplaats/verwijder geen config. Controleer alleen metadata. Gebruik de bestaande provisioner/launcher alleen wanneer de taak de lokale runtime nodig heeft; de launcher stopt geen bestaand proces en gebruikt geen fallbackconfig. Zie `docs/delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md`.

Vercel `production` is de deploymentchannel van de bestaande synthetic TEST-omgeving, niet live productiedata. Een GitHub-merge mag geen build starten; een afzonderlijk expliciet TEST-releasebesluit is vereist.

## 5. Bestaande architectuur en data-integriteit

- Respecteer serverautorisatie én RLS; beperk elke read/write tot de geauthenticeerde tenant, HR-groep, administratie, actor, rol/capability en relevante werknemer/team/case. Forged clientinput mag scope niet verruimen.
- Gebruik bestaande services, schema's, routes en tests voordat je een alternatief bouwt. Geen service-role/SQL-bypass, verzonnen fallback of geforceerde lifecycle-state om acceptatie groen te maken.
- Migrations zijn additive/forward-only. Een migration als code maken mag binnen de expliciete feature-scope; remote toepassen vereist aparte toestemming. Controleer lineage en bestaande objecten vóór een migratie. Pas niets toe of herschrijf geen history om alleen versies gelijk te maken.
- Na een toegestane schemawijziging: relevante readback, RLS/grants/policies/RPC's, advisors en `packages/db/types.ts` controleren/regenereren. Behoud bestaande waarschuwingen buiten scope.
- Behoud auditability, privacy, Payroll-precisie/wettelijke rounding/versionering/immutable history en ESS/MSS-/Focus-rolgrenzen. SEC-01 is uitsluitend op TEST geaccepteerd; wijzig of herhaal die migratie niet. CONTROL02 en de officiële Loonaangifte-XML-import zijn geannuleerd.
- `apps/hr-suite/next-env.d.ts` wordt nooit handmatig gewijzigd of gecommit.

## 6. Scope- en bewijsdiscipline

- Geen opportunistische redesign, unrelated cleanup, feature-uitbreiding of statusclaim buiten de opdracht.
- Houd onderscheid tussen **BEDOELD**, **GEBOUWD**, **GETEST** en **RELEASED**. Een test op een andere SHA of een lokale mock bewijst geen huidige hosted/RLS-acceptatie.
- Werk requirements bij onder `docs/requirements/<domein>/`, duurzame besluiten in ADR/FDR, en acceptance evidence in bestaande gedateerde rapporten. Werk voor een afgeronde verticale slice alleen de relevante levende indexen bij; herschrijf oud evidence niet retroactief.
- Framework-generated drift, waaronder `next-env.d.ts`, blijft buiten de diff.

Voor Payroll gelden aanvullend `AA-PAYROLL.md` en de feitelijk geraakte Payroll-requirements. Voor verificatie en release gelden `AA-TEST.md` en `AA-REL.md`.

- Wijzigingen aan Chromium, Playwright of PDF-tracing vereisen een productiebuild met de top-10 NFT-pakketcontrole; controleer dezelfde route-/assetmethode voor en na de wijziging. Zie `AA-REL.md` §6.

## 7. Token-efficiëntie

- Lees alleen de noodzakelijke bronnen en toepasselijke secties. Hergebruik geldige context, analyses en groene testresultaten; vermijd dubbele toolcalls, volledige herlezingen en onnodig grote terminaluitvoer.
- Gebruik standaard één uitvoerende agent; start geen automatische subagents.
- Richtbudget per taak, indicatief als sturingsmiddel en geen harde limiet of veiligheidsgrens: LOW circa **2.000**, MEDIUM **6.000**, HIGH **15.000** tokens. Pas dit aan als aantoonbare complexiteit dat vraagt; verkort nooit security-, integriteits- of vereiste verificatie.
- Rapporteer input-, output-, cached tokens en kosten alleen als de runtime die betrouwbaar levert; anders vermeld **niet meetbaar**.
- Rapporteer bij grotere runs kort het aantal herstelcycli, de uitgevoerde tests, meetbaar tokengebruik en de belangrijkste bron van verspilling.
