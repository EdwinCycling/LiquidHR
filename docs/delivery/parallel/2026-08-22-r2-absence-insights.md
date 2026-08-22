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
