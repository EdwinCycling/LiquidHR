# LiquidHR — R6-2 gedeelde Insights-controls

## Status

**LOKAAL IMPLEMENTED — TECHNICAL GATES GREEN — AUTHENTICATED BROWSER BLOCKED BY ENVIRONMENT — NO MAIN/REMOTE ACTIONS**

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

De authenticated HR-browsergate is **BLOCKED BY ENVIRONMENT**. De worktree heeft geen `apps/hr-suite/.env.local`; de lokale Playwright-run op `http://localhost:3003/login` eindigde in HTTP `500` door ontbrekende Supabase URL/key in `proxy.ts`, met console-error `Your project's URL and Key are required...`. Daardoor zijn desktop `1440x900`, mobiel `390x844`, echte report-readback, Back/Forward en console/theme-evidence voor deze branch niet als browserresultaat geclaimd. De nieuwe DOM-interactie is wel via happy-dom componenttests afgedekt.

## Handoff

De branch is technisch klaar voor review/integratie, met de bestaande Journey-baselinefailure en authenticated browsergate als expliciete open punten. Merge naar `main`, push, remote database-acties en deployment blijven bewust buiten deze slice.
