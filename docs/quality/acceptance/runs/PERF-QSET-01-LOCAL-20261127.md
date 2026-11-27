# PERF-QSET-01 — Core TEST-integratie en acceptatie

**27-11-2026 — feature geïntegreerd op de gecontroleerde featurebranch; Core TEST-migratie toegepast; geen Vercel-release gestart.** Basis: 96139de19eeb9eebf11d80a3d7f1ed6f9ccff083. Branch: work/perf-qset-01-20261127. De geteste featurecode staat op 0c2334a5895048d9dc88ec0d0126dce511048a50; daarna veranderde alleen acceptatiedocumentatie. De bestaande groene codegates zijn daarom hergebruikt.

## A01–A15-bewijsmatrix

| ID | Bewijs en uitgevoerde controle | Status |
|---|---|---|
| A01 | De bestaande gespreksvelden en lifecycle blijven beschikbaar zonder toegewezen vragen. De regressiesuite slaagde; op Core TEST bleven 112 rondes, 87 dossiers, 85 inzendingen, 717 auditregels en 49 privénotities behouden. Bestaande V1/V2-RPC-signatures zijn ongewijzigd; nieuwe antwoordkolommen hebben {} als default. | PASS |
| A02 | Vragensets zijn optioneel. De nieuwe modulecode staat in de moduleconstraint; Core TEST heeft nog geen module-activatieregel voor deze code, dus hij is uit. Modulecatalogus- en schematests slaagden. | PASS |
| A03 | Serverchecks, RLS, beperkte tabelrechten en HR-scopecontroles in de beheer-RPC's zijn aanwezig en op Core TEST nagelezen. De HR Admin CRUD-browserflow kon niet worden uitgevoerd: de bestaande persona-runtime en browserconfiguratie ontbreken. | NOT_RUN |
| A04 | Employee-, GV- en AB-defaults, deelnemersafwijkingen, uitschakeling en preview/testmodus zonder opslagrequest zijn geïmplementeerd en lokaal contractgetest. De ronde- en previewflows zijn niet met een bestaande browserpersona uitgevoerd. | NOT_RUN |
| A05 | De zeven vraagtypen, volgorde, opties en validatie van verplichte antwoorden zijn getest. Vier gerichte QSET-, module- en migratiecontractbestanden bevatten samen 9 geslaagde tests. | PASS |
| A06 | Publicatiesnapshots zijn rol- en dossiergebonden; de database bewaakt antwoordvalidatie en vereiste antwoorden bij definitieve inzending. PGlite-contracttests slaagden en de Core TEST-triggers zijn aanwezig. De end-to-end persona-inzending is niet uitgevoerd. | PASS |
| A07 | Conceptantwoorden lopen via de bestaande dossieropslag. De PGlite-contracttest controleert dat een GV-concept niet zichtbaar is voor de medewerker; de Core TEST-tabelrechten staan geen directe writes toe. Andere rolcombinaties zijn niet live gelezen. | PASS |
| A08 | Definitieve antwoorden worden via de bestaande SELF-, MANAGER- en ADDITIONAL_REVIEWER-lifecycle-RPC's opgeslagen. De code- en migratiecontracttests zijn groen; de volledige definitieve persona-workflow is niet doorlopen. | NOT_RUN |
| A09 | Publicatie bewaart de effectieve definitie per rol en dossier. De PGlite-test wijzigde de bronset en bevestigde dat de snapshot gelijk bleef; Core TEST heeft de snapshot- en immutabilitytriggers. | PASS |
| A10 | Dupliceren maakt een eigen conceptset en kopieert geen antwoorden of PMUX-taken. De beheer-API is aanwezig; de aparte browser-E2E voor dupliceren is niet uitgevoerd. | NOT_RUN |
| A11 | AB heeft een aparte respondentrol en krijgt geen GV-beoordelingsvelden of managerbevoegdheden. Rolmapping en guards zijn geïmplementeerd; een AB-personaflow kon niet worden uitgevoerd. | NOT_RUN |
| A12 | Core TEST heeft RLS op alle vijf nieuwe tabellen. Anon heeft geen tabeltoegang; authenticated heeft alleen toegestane SELECT-rechten en geen directe INSERT/UPDATE/DELETE. Schrijven loopt via geautoriseerde RPC's. De volledige negatieve tenant-, HR-groep-, administratie- en persona-matrix is niet uitgevoerd. | NOT_RUN |
| A13 | Antwoorden, snapshots, conceptarchieven en auditacties blijven in de Performance Review-tabellen. Audit- en snapshotimmutabilitytriggers bestaan op Core TEST; historische aantallen zijn voor en na migratie gelijk gebleven. Een bestaand historisch dossier is niet live doorlopen. | PASS |
| A14 | De migratie raakt geen Survey- of eNPS-tabellen. De aantallen bleven gelijk: Surveys 2, surveyvragen 7, surveyreacties 2, surveyantwoorden 7; eNPS-reacties en -antwoorden 0. De volledige bestaande testsuite slaagde. | PASS |
| A15 | TypeScript, i18n, lint, tests en productiebuild slaagden op de ongewijzigde featurecode. Gegenereerde Core TEST-types komen voor alle 7 betrokken tabellen exact overeen met packages/db/types.ts. Security-, performance- en health-advisors zijn gecontroleerd. Browser-/a11y-acceptatie is niet uitgevoerd. | PASS |

## Core TEST-migratie en databasecontrole

- Toegepast op Core TEST wnpfloqpjvaacobppbpk: migratie 20261127140000_performance_review_question_sets, exact één migratie.
- De dry-run noemde alleen deze migratie. De migratiebron bleef ongewijzigd; SHA-256: DA1BA823572C771657C86D33CB1257310B0280291DD60343A923B53078F4ACFB.
- De lokale Supabase CLI-manifestatie mist negen oudere Performance Review-versies doordat de remote ze onder andere versienummers registreerde dan de canonieke repositorybestanden. Zonder migratiegeschiedenis te repareren of te herschrijven is voor de dry-run en push een tijdelijke manifestkopie gebruikt met ongewijzigde SQL-inhoud onder de reeds geregistreerde remote-versies. Alleen QSET stond als nieuw. De canonieke migratiebestanden en remote voorgeschiedenis zijn niet aangepast; het bestaande versienummerdrift blijft voor toekomstige CLI-pushes een operationeel aandachtspunt.
- Alle vijf nieuwe tabellen hebben RLS en selectieve policies. Directe mutatierechten voor anon/authenticated ontbreken; de QSET-RPC's zijn niet uitvoerbaar door anon. De authenticated SECURITY DEFINER-RPC's voeren tenant-/HR-groep-/rolchecks uit.
- Na de migratie bleven de bestaande gegevens gelijk: 112 rondes, 87 dossiers, 85 inzendingen, 717 auditregels, 49 privénotities en 0 conceptarchieven. Alle nieuwe QSET-tabellen bevatten 0 rijen. De question_answers-kolommen voor inzendingen en archieven zijn NOT NULL met {}-default.
- Supabase security-advisor: geen QSET-tabel zonder RLS/policy; zeven QSET-RPC's verschijnen als algemene authenticated SECURITY DEFINER-waarschuwing. De implementaties zijn op tenant-/HR-groep-/rolchecks, module-gating en bestaande lifecycle-delegatie nagelezen; geen QSET-RPC is anon-uitvoerbaar. De overige securitymeldingen betreffen objecten buiten QSET.
- Performance-advisor: zes INFO-meldingen over niet-afgedekte foreign keys op nieuwe QSET-tabellen en drie INFO-meldingen over ongebruikte QSET-indexen (de nieuwe tabellen zijn leeg). Dit zijn geen regressiefouten; er is geen extra migratie buiten de expliciet aangewezen QSET-migratie uitgevoerd. Bestaande overige advisor-meldingen zijn niet gewijzigd.
- Health-advisor: geen meldingen.
- Typegeneratie bevestigde identieke Row/Insert/Update-velden voor vraagsets, audit, rondeconfiguratie, dossiersnapshots, pending overrides, inzendingen en conceptarchieven.

## Lokale technische gates

Op featurecodecommit 0c2334a5895048d9dc88ec0d0126dce511048a50:

- Vitest hoofdselectie: 850 bestanden geslaagd, 4 overgeslagen; 4.313 tests geslaagd, 8 overgeslagen.
- Afzonderlijke Payroll-kalendermigratietest: 1 bestand, 2 tests geslaagd.
- Gerichte QSET-, module- en migratiecontracttests: 4 bestanden, 9 tests geslaagd.
- Typecheck: PASS. i18n: PASS, 45 NL/EN-namespaceparen.
- Lint: PASS, 0 fouten en 9 bestaande, niet-gerelateerde ongebruikte-importwaarschuwingen in document-/Payroll-testbestanden.
- Productiebuild: PASS; Payroll-clientbundelscan, PDF function-trace-gates en runtime-provenance slaagden.
- git diff --check: PASS. apps/hr-suite/next-env.d.ts is ongewijzigd.

## Persona's, Vercel en releasegrens

- scripts/check-test-personas.ps1: statische catalogus- en role-switchcontrole geslaagd; lokale TEST-runtime en persona-credentials ontbreken. Lisa-, Jaap- en Frits-personaflows zijn NOT_RUN. Er zijn geen accounts of tenants gemaakt en geen alternatieve configuratie gebruikt.
- Vercel-project liquidhr blijft GitHub-gekoppeld aan EdwinCycling/LiquidHR, root apps/hr-suite. De project-API meldt gitProviderOptions.createDeployments=disabled; vercel.json houdt git.deploymentEnabled=false; voor dit project zijn geen deploy hooks geregistreerd.
- Huidige Vercel-deployment bleef READY op oude SHA 3b76be2c614d4e1abbac5f7289925ef8d75eddbd; de productalias wijst naar die deployment. De vorige READY fallback is 69d29bbe80a5791cf31c1d4966347f756cd10130; rollback is niet uitgevoerd.
- Er is geen Vercel-deployment, aliaswijziging of rollback gestart. Een latere, afzonderlijk geautoriseerde smoke omvat V1 (standaardgesprek zonder QSET), V2 (extra reviewer-workflow en bestaande rechten) en QSET (HR Admin CRUD/dupliceren/archiveren, zeven typen, preview zonder writes, Employee/GV/AB-defaults en overrides, immutable publicatiesnapshot, concept/definitief via bestaande workflow, audit en negatieve autorisatie). Deployment blijft geblokkeerd totdat de afzonderlijke vrijgave RELEASE LIQUIDHR TEST is gegeven.
