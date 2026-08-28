# R7-3 Employment, Calendar & Master Data Convergence

Datum: 2026-08-28
Branch: `work/r7-employment-masterdata`
Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r7-employment-masterdata`
Baseline: `778b601670c87ca7596000937d895859498b483a`
Zichtbare versie: `1.20260828.4`

## Resultaat

De bestaande R7-3 settings en master-data UI is geconvergeerd naar de bestaande LiquidHR UX Foundation. De volgende routes/componentflows zijn geraakt:

- `/settings/employment-contracts`: contractcatalogi, algemene instellingen en regelgeving.
- `/settings/holidays`: import, handmatige feestdagen, bedrijfsactiviteiten en kalenderlijst.
- `/settings/leave-accrual`: catalogus, employee sets, ledger, prioriteitsregels, accrual rules, uitzonderingen en werk-/overwerkuitzonderingen.
- `/settings/absence`: configuratie en taaktemplates.
- `/settings/anniversary-rules`: lijst-eerst CRUD.
- `/master-data/jobs`: functiegroepen, functies, senioriteitfiltering en bestaande 1-n-koppeling.
- `/master-data/salary-scales`: salarisstructuren, revisies en migratieconflicten.
- `/master-data` en `/master-data/end-reasons`: bestaande end reasons, documentcategorieën en relatietypen.

Foundation `Surface`, `DataTableShell`, `CollectionToolbar`, `FormDrawer`, `FormField`, `FormActions`, `ConfirmDialog`, `RowActions`, `ActionMenu`, `Button`, `TextInput`, `Textarea`, `DropdownSelect`, `Checkbox`, `Switch`, `Badge` en `EmptyState` zijn hergebruikt waar passend. Bespoke overlays, `window.confirm`, zware card shadows/lift en raw select-wrappers in de geraakte flows zijn verwijderd of teruggebracht. Native date inputs blijven voor datumsemantiek toegestaan.

Bestaande API-requests, servicecontracten, permissionchecks, validatie, delete/deactivate-semantiek, salarisberekeningen, verlofberekeningen en i18n zijn behouden. Er is geen nieuwe salary capability toegevoegd. Er is geen standalone work-pattern/schedule route gebouwd.

## Gates en bewijs

- Targeted R7-3 Foundation test: `2/2` tests groen.
- TypeScript: groen.
- i18n: groen, `34` NL/EN namespaces gelijk.
- ESLint: groen.
- `git diff --check`: groen.
- Webpack production build: succesvol afgerond.
- Full hr-suite: `1017/1018` tests groen; alleen de bekende baseline failure `components/journeys/journey-steps.test.tsx` op `Binnenkort beschikbaar`.

Authenticated browser acceptance is groen op de lokale production-mode candidate `http://localhost:3001` met de canonieke `.env.local` uit de root-workspace gekopieerd naar deze worktree. Source en target zijn byte-identiek en het target blijft door `.gitignore` genegeerd; geen secretwaarden zijn uitgelezen of vastgelegd. HR Admin is ingelogd in administratie `Jupiter BV`/HR-groep `Planeten`. Desktop `1440x900` gaf voor alle hoofd- en relevante leave-subroutes HTTP `200`, Foundation-layout en bestaande data; drawers, cancel, Escape/dirty-close, validation, RowActions en ConfirmDialog zijn gecontroleerd. Een unieke jubileumregel `42` is via de normale UI aangemaakt, na reload server-side teruggelezen en daarna bevestigd verwijderd; een tweede reload bevestigde cleanup. Desktop en mobile `390x844` hadden geen horizontale overflow (`scrollWidth === viewport`) en de finale production-console had `0` errors en `0` warnings, zonder hydrationmeldingen. Manager/Employee zijn niet als browserpersona uitgevoerd omdat de beschikbare HR Admin-sessie geen rolwissel exposeert; de gerichte permission-tests blijven hiervoor het bewijs.

Setup Assistant-bestemmingen zijn gecontroleerd: EMP-001 en EMP-002 openen `/settings/employment-contracts`, EMP-004 `/settings/holidays`, EMP-005 `/settings/leave-accrual` en EMP-006 `/settings/absence`. EMP-003 verwijst volgens het bestaande contract naar `/master-data/salary-scales`, maar blijft correct verborgen zolang de bestaande visibility-gate niet resolved is.

## Requirements gates

- `REQUIREMENTS GATE — SALARY CAPABILITY VISIBILITY UNRESOLVED`: bestaande salary capability gating is behouden; de R7-3 run verzint geen nieuw contract.
- Work-pattern/schedule: intentional gap; geen nieuwe route, schema of Setup-stap.
- Centrale integratie: lokale R7-3 branch is browsermatig groen en klaar voor centrale integratie; salary capability visibility blijft expliciet open.

## Scope safety

Geen migration, schema/RLS/RPC, structurele remote database write, merge, push, Vercel-deploy of version bump. De normale lokale R7-3-wijzigingen zijn met de afgesproken featurecommit vastgelegd; `origin/main` is niet gewijzigd.
