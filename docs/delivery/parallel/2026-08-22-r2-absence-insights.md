# Roadmap 2 — Absence Insights

Status: **LOKAAL GREEN / BROWSER ACCEPTANCE BLOCKED BY ENVIRONMENT**
Datum: 2026-08-22

## Scope

- Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r2-absence-insights`
- Branch: `work/r2-absence-insights`
- Baseline: `abfa0bbb7db628f588faa3d4818a4f4663f27b46`
- Lokale poort: `3104`
- Gewijzigd: `components/insights/absence-report.tsx`, `components/insights/bradford-report.tsx`, `components/insights/frequent-absence-report.tsx`
- Test toegevoegd: `lib/insights/frequent-absence-query.test.ts`

Geen centrale deliverydocs, algemene Foundation, salary insights, upcoming events, routes, API's, schema's, RLS, permissions of report/query-services gewijzigd.

## Implementatie

De drie bestaande rapporten gebruiken nu één domain-specifieke report-family:

- Foundation `FilterBar`, `DropdownSelect`, `TextInput`, `Checkbox`, `Surface`, `Badge`, `DataTableShell`, `SectionHeader`, `EmptyState`, `Button` en `Dialog` worden hergebruikt.
- KPI's hebben een duidelijke primaire metric en semantische statuskleuren.
- Geselecteerde periode, afdeling en lokale reportfilters zijn zichtbaar als actieve selectie.
- HR-geschikte tabellen tonen kolomkoppen, status-/risicobadges, employee- en verzuimdossierlinks; tabellen scrollen intern op smalle schermen.
- Absence behoudt de roostergewogen formule, periodefilters, maandtrend en Excel-export.
- Bradford behoudt `S² × D`, risicobanden, lokale risk/search-filtering, uitlegdialog en Excel-export.
- Frequent absence behoudt de instelbare threshold, lokale frequent-only/search-filtering en Excel-export.
- Geen nieuwe `FOUNDATION_GAP`: er was geen generieke uitbreiding nodig.

## Gates

- Dedicated absence/Bradford/frequent query-, report- en exporttests: **GREEN — 6 files / 13 tests**.
- Strict TypeScript: **GREEN**.
- i18n: **GREEN — 33 gelijke NL/EN-namespaces**; geen taalbestanden gewijzigd.
- Targeted lint: **GREEN — 0 errors / 8 bestaande warnings buiten deze slice**.
- `git diff --check`: **GREEN**.

## Browser acceptance

De server startte vanuit exact deze worktree op poort `3104`, maar de worktree bevat geen `.env.local` en er is geen canonical Supabase-runtimeconfig beschikbaar. `/login` gaf daarom HTTP 500 vanuit `proxy.ts` met `Your project's URL and Key are required to create a Supabase client!`; Playwright registreerde 3 runtime-console-errors.

Daarom zijn de volgende acceptance-items **BLOCKED BY ENVIRONMENT** en niet als productbewijs geclaimd: echte absence/Bradford/frequent data, filters, zero-results, employee/dossierlinks, export, positieve/negatieve persona-permissions, desktop, 390×844, Default, LinkedHR en console-errors 0. Geen credentials of testdata zijn gekopieerd of gemuteerd.

Geen push, merge of deploy uitgevoerd.

## Acceptance retry — 2026-08-22

- Verplichte broncontrole: `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\.env.local` bestaat niet (`Test-Path = False`).
- De canonical repo bevat in `apps/hr-suite` alleen `.env.example`; er is geen alternatieve env gebruikt en geen secret gelezen, gelogd of gecommit.
- Doelcontrole: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r2-absence-insights\apps\hr-suite\.env.local` bestaat niet (`Test-Path = False`), omdat de verplichte `Copy-Item -Force` niet veilig kon worden uitgevoerd.
- Fixture-auth preflight, serverstart op 3104 en browser/API/persona/responsive/theme acceptance zijn hierdoor **BLOCKED BY ENVIRONMENT**; er zijn in deze retry geen HTTP-requests of testdata-mutaties uitgevoerd.

## Acceptance retry — canonical env hersteld — 2026-08-22

- De opgegeven bron met de bedoelde separator, `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\.env.local`, is gekopieerd met `Copy-Item -Force`; doel `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r2-absence-insights\apps\hr-suite\.env.local` gaf `Test-Path = True`. Inhoud en secrets zijn niet getoond, gelogd of gecommit.
- `fixtures:talent-auth` werkte uitsluitend de drie canonical fixtures bij: `hr-admin`, `manager`, `employee`.
- Exacte worktree-server op poort `3104`: authenticated fixture-login HTTP 200 voor TEST HR, TEST MANAGER en TEST EMPLOYEE.
- TEST HR positive: absence, Bradford en frequent absence report/API HTTP 200 met echte backendrijen; Excel-export HTTP 200 met `application/vnd.ms-excel`; employee/verzuimdossier-readback HTTP 200.
- Filters/readback: alle drie query-URL's behielden periode en afdeling na refresh, reload HTTP 200; Consultancy gaf 0 rijen. Bradford zero-search gaf 0 rijen en een echte empty state.
- TEST MANAGER en TEST EMPLOYEE negative: report-API's HTTP 403 voor alle drie reports; geen export- of dossierlinks. De report-shell bleef HTTP 200 zonder data, passend bij permission filtering.
- Default (`liquid-navy`) en LinkedHR: alle drie reports HTTP 200 op desktop en 390×844; bij 390 was `documentWidth=390`, geen page overflow en interne tabelscroll actief. TEST HR reportflows registreerden 0 console-errors; TEST EMPLOYEE 0.
- TEST MANAGER gaf één bestaande algemene-layout console-error voor een `storage://...jpg` branding-URL (`ERR_UNKNOWN_URL_SCHEME`). Dit is buiten de absence-report-scope; geen generieke Foundation- of brandingfix uitgevoerd. Daardoor blijft de strikte volledige console-0 acceptance **BLOCKED** door deze out-of-scope runtime-resource.
- Geen tijdelijke records aangemaakt; geen database-/schema-/remote writes uitgevoerd buiten de expliciet toegestane fixture-password preflight. TEST HR stond na de controle weer op Default (`Thema: Liquid Navy`).
