# PERF-QSET-01 — lokale acceptatie en bewijsmatrix

**27-11-2026 — lokaal geïmplementeerd; persona- en TEST-acceptatie OPEN.** De feature staat op branch `work/perf-qset-01-20261127`, gebaseerd op `96139de19eeb9eebf11d80a3d7f1ed6f9ccff083`. De geteste featurecode is commit `0c2334a5895048d9dc88ec0d0126dce511048a50`.

## A01–A15

| ID | Lokaal bewijs | Status |
|---|---|---|
| A01 | Bestaande gespreksvelden blijven in de workspace staan; de aparte sectie Vragen wordt alleen getoond voor een toegewezen rol-snapshot. De lege configuratie blijft geldig. | IMPLEMENTED |
| A02 | `PERFORMANCE_REVIEW_QUESTION_SETS` is optioneel en standaard uit. De rondeconfiguratie ondersteunt uitschakelen; gepubliceerde snapshots blijven bruikbaar. | IMPLEMENTED; geen live modulewissel getest |
| A03 | HR Admin-beheer via afgeschermde pagina/API; serverautorisatie, RLS, RPC-rechten en ontbrekende directe clientwrites zijn in PGlite gecontroleerd. | PARTIAL; canonieke persona-flow niet uitgevoerd |
| A04 | Ronde-defaults voor Employee, GV en AB, deelnemersoverride, geen set en terugzetten naar default zijn geïmplementeerd. Voorbeeldweergave/testmodus voert geen opslagrequest uit. | IMPLEMENTED; UI-flow niet browsergetest |
| A05 | Alle zeven vraagtypen hebben schema-, antwoord- en verplichte-antwoordvalidatie; de gerichte tests dekken de zeven typen, ongeldige opties, volgorde en matrixverplichting. | PASS — unit- en PGlite-contract |
| A06 | Rolgebonden snapshots en verplichte antwoorden bij definitieve inzending zijn server- en databasezijdig afgedwongen. | PARTIAL; rolcontract getest, workflow niet met persona’s doorlopen |
| A07 | Conceptantwoorden lopen via de bestaande dossieropslag. De PGlite-contracttest controleert onder meer dat een GV-concept niet zichtbaar is voor de medewerker. | PARTIAL; niet alle rolcombinaties live getest |
| A08 | Definitieve antwoorden gebruiken de bestaande inzend- en lifecycle-RPC’s; guards voorkomen hergebruik van de conceptstatus voor een definitieve inzending. | IMPLEMENTED; geen live workflowacceptatie |
| A09 | Publicatie maakt een volledige rol-/dossiersnapshot. De PGlite-test wijzigt de bronset en controleert dat de snapshot de gepubliceerde definitie behoudt. | PASS — PGlite-contract |
| A10 | Dupliceren maakt via de beheer-API een eigen vragenset. Deze codeweg maakt geen antwoorden of PMUX-taken aan. | IMPLEMENTED; geen aparte browser-E2E gedraaid |
| A11 | AB-antwoorden gebruiken een afzonderlijke rol en krijgen geen GV-formele beoordelingsvelden of managerbevoegdheden. | IMPLEMENTED; persona-flow niet getest |
| A12 | RLS en serverchecks begrenzen beheer en toegang tot rol-snapshots; PGlite controleert onder meer dat een medewerker geen vragenset beheert of een GV-concept leest. | PARTIAL; niet iedere tenant-, HR-groep-, administratie- en persona-negatieve combinatie is uitgevoerd |
| A13 | Dossier-snapshots, antwoorden, conceptarchieven en auditacties blijven in de performance-reviewtabellen; immutability- en audittriggers zijn aanwezig en in het migratiecontract gecontroleerd. | IMPLEMENTED; geen live historisch dossier getest |
| A14 | De migratie wijzigt geen Survey- of eNPS-vragen-/antwoordtabellen. De volledige bestaande testsuite is op de featurecommit geslaagd. | PASS — codegrens en regressiesuite |
| A15 | NL/EN-sleutels, TypeScript, lint, tests, build, Payroll-clientbundelscan en PDF function-trace-gates zijn uitgevoerd. Responsieve breedtes, toetsenbordbediening en zichtbare focus zijn in de UI-code opgenomen. | PARTIAL; browser-/a11y-acceptatie en Supabase advisors zijn OPEN |

## Lokale gates

- Vitest hoofdselectie: **850 bestanden geslaagd, 4 overgeslagen; 4.313 tests geslaagd, 8 overgeslagen**.
- Afzonderlijke Payroll-kalendermigratietest: **1 bestand, 2 tests geslaagd**.
- Gerichte QSET-, module- en migratiecontracttests: **4 bestanden, 9 tests geslaagd**.
- `npm run type-check -w @liquid-hr/hr-suite`: PASS.
- `npm run check:i18n -w @liquid-hr/hr-suite`: PASS, 45 NL/EN-namespaceparen.
- `npm run lint -w @liquid-hr/hr-suite`: PASS, 0 fouten en 9 ongebruikte-importwaarschuwingen in bestaande, niet-gerelateerde document-/Payroll-testbestanden.
- `npm run build -w @liquid-hr/hr-suite`: PASS op de vastgelegde feature-SHA; Payroll-clientbundelscan, PDF function-traces en runtime-provenance zijn geslaagd.
- `git diff --check`: PASS. `apps/hr-suite/next-env.d.ts` is niet gewijzigd.

## Open acceptatiegrenzen

- `scripts/check-test-personas.ps1` bevestigde de persona-catalogus, maar stopte vóór login omdat de lokale TEST-runtimeconfiguratie ontbreekt. Er zijn geen accounts of tenants aangemaakt.
- De migratie is niet toegepast op lokaal Supabase of Core TEST. Daardoor zijn browseracceptatie met de bestaande persona’s en Supabase advisors niet uitgevoerd. De migratie is lokaal via PGlite-contracttests gecontroleerd.
- Geen remote SQL/schemawrite, push, merge naar `main` of Vercel-release in deze cyclus. Voor gebruik in TEST zijn de afzonderlijke migratie- en releasemandaten nodig.
