# LiquidHR — R6-2 gedeelde Insights-controls

## Status

**LOKAAL IMPLEMENTED — TECHNICAL GATES GREEN — AUTHENTICATED BROWSER GREEN — NO MAIN/REMOTE ACTIONS**

- Branch: `work/r6-insights-shared-controls`
- Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r6-insights-shared-controls`
- Exact R6-1 baseline: `32d5c32cb44e0b274a9cbfd1fca81763f5471701`
- Scope contains no migration, Supabase/RLS/permission/auth change, new report, new calculation, version bump, merge, push or deployment.

## Afgerond

- Foundation gap multiselect opgelost in `apps/hr-suite/components/ui/multi-select.tsx`: controlled searchable multi-select, select/clear all, selected count, hidden native values, loading/no-options, portal positioning, keyboard navigation, Escape/outside-close and focus restore.
- Shared Insights mechanics toegevoegd in `apps/hr-suite/components/insights/shared-controls.tsx`: responsive filter bar, active chips with remove-one, count, clear/reset and export status/download shell.
- Employee FacetFilter, Salary FilterMenu, Upcoming FilterDropdown en absence report filter summaries zijn gemigreerd. Existing report-owned period, privacy, calculations, permissions, loaders and serializers blijven leidend.
- Applied state blijft canonical URL-state: draft wijzigingen veranderen de URL niet; Apply gebruikt `router.push`; Reset/defaults en Back/Forward laden de canonical query. Export gebruikt de applied query en report-owned serializer. Drilldowns behouden de bestaande veilige Insights-returncontext.
- R6-2 component-/querytests zijn toegevoegd; Bradford/frequent report-only filters worden typed via de bestaande report query modules.

## Verificatie

- Nieuwe shared tests: `3` bestanden / `7` tests groen.
- Targeted Insights suite: `16` bestanden / `53` tests groen.
- Full suite: `257` bestanden / `987` geslaagd, `1` bestaande Journey-test failure op `Binnenkort beschikbaar`. Exact dezelfde failure reproduceert op baseline `e13c50f418cb327a6e4e99e266d58ab7370e4885`; Journey is niet gewijzigd.
- Strict TypeScript: groen.
- i18n: groen, `33` gelijke NL/EN-namespaces.
- ESLint: `0` errors; bestaande warnings blijven.
- Webpack production build: groen, `226` routes/pages.
- `git diff --check`: groen.

## Browser/evidence

De canonical `apps/hr-suite/.env.local` is naar de worktree gekopieerd; aanwezigheid en SHA-256 zijn gelijk gecontroleerd zonder waarden te tonen. Authenticated Playwright-acceptatie is groen op desktop `1440x900` en mobiel `390x844`: employee searchable multiselect, Apply, Reset, active-filter remove, Clear all, Back/Forward, refresh, absence, Bradford, Upcoming en salary primary/secondary filters, exportdownloads, drilldown return-context, keyboard/Escape/focus restore en page-level overflow zijn gecontroleerd. Browserconsole eindigde op `0` errors en `0` warnings. Twee echte R6-2-fouten zijn minimaal gecorrigeerd: employee active-filter actions schrijven nu de canonical URL bij en Upcoming toont `Afdeling` in plaats van `undefined`.

## Handoff

De branch is technisch klaar voor review/integratie. De bestaande Journey-baselinefailure blijft buiten scope; merge naar `main`, push, remote database-acties en deployment blijven bewust buiten deze slice.
