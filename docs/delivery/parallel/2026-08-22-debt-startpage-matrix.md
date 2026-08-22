# Startpage acceptance debt — 2026-08-22

## Scope

- Baseline: `abfa0bbb7db628f588faa3d4818a4f4663f27b46`
- Branch: `work/debt-startpage-matrix`
- Worktree: `.codex-worktrees/debt-startpage-matrix`
- Runtime target: `http://localhost:3108`, exact target worktree, Next Webpack
- Personas requested: TEST HR and, where applicable, TEST Manager
- Scope guard: no Journey-only fallback, API, schema, RLS, permission, theme/Foundation or central delivery-document changes

## Preference safety

The canonical fixture-auth preflight was run before any Startpage interaction:

```text
npm.cmd run fixtures:talent-auth -w @liquid-hr/hr-suite
node: .env.local: not found
```

No authenticated session was available, so the existing Startpage preference snapshot could not be read. No `PATCH /api/preferences/start-page` request was made and no user preference was changed; there was therefore nothing to restore. This is recorded explicitly rather than treating an unverified preference state as a snapshot.

## Browser acceptance

The exact target runtime started successfully on port 3108. Playwright then opened `/login` on desktop and on `390x844`.

| Acceptance item | Status | Evidence / reason |
|---|---|---|
| Authenticated HR Startpage sanity | BLOCKED BY ENVIRONMENT | Target has no `apps/hr-suite/.env.local`; `/login` returns HTTP 500 in `proxy.ts` because Supabase URL/key are absent. |
| Expanded mode | BLOCKED BY ENVIRONMENT | Startpage did not render. |
| Compact mode | BLOCKED BY ENVIRONMENT | Startpage did not render. |
| Compact widgets/content | BLOCKED BY ENVIRONMENT | Startpage did not render. |
| View preference persistence | BLOCKED BY ENVIRONMENT | No authenticated preference read/write was attempted. |
| Expanded drag/reorder | BLOCKED BY ENVIRONMENT | Startpage did not render. |
| Move controls | BLOCKED BY ENVIRONMENT | Startpage did not render. |
| Layout persistence after refresh | BLOCKED BY ENVIRONMENT | No preference mutation was attempted. |
| Manager scope switch | BLOCKED BY ENVIRONMENT | No Manager session was available. |
| Quick actions | BLOCKED BY ENVIRONMENT | Startpage did not render. |
| Calendar data | BLOCKED BY ENVIRONMENT | Startpage data could not load. |
| Representative operational cards | BLOCKED BY ENVIRONMENT | Startpage data could not load. |
| Desktop | BLOCKED BY ENVIRONMENT | `/login` failed before product render. |
| 390x844 | BLOCKED BY ENVIRONMENT | Playwright successfully set `390x844`; `/login` still failed before product render. This is not product-RED. |
| Default theme | BLOCKED BY ENVIRONMENT | No authenticated render. |
| LinkedHR theme | BLOCKED BY ENVIRONMENT | No authenticated render or theme switch. |
| Keyboard/focus | BLOCKED BY ENVIRONMENT | No Startpage controls rendered. |
| Page-level horizontal overflow | BLOCKED BY ENVIRONMENT | No Startpage document was available to measure. |
| Relevant console errors = 0 | BLOCKED BY ENVIRONMENT | Playwright showed the missing Supabase environment error plus the resulting HTTP 500/favicon resource errors; these are preflight/runtime-environment errors, not Startpage evidence. |

Because the route failed before authentication and before Startpage render, no product RED is assigned and no Startpage/preferences bug was inferred or fixed.

## Local gates

- Relevant Startpage tests: **GREEN**, 2 files / 4 tests
- TypeScript: **GREEN**, `npm.cmd run type-check -w @liquid-hr/hr-suite`
- i18n: **GREEN**, 33 equal NL/EN namespaces
- Targeted lint: **GREEN**, Startpage component and preference files
- `git diff --check`: **GREEN**

## Result

Acceptance is **BLOCKED BY ENVIRONMENT**, not GREEN. The remaining work is to provide the canonical local test environment (`apps/hr-suite/.env.local` with the approved fixture keys) and rerun this exact matrix. No source bugfix was justified by the available evidence.

## Herverificatie op 2026-08-22

- Preflight bevestigd: `apps/hr-suite/.env.local` ontbreekt en de process-environment bevatte geen canonical Supabase- of `TALENT_*_PASSWORD`-keys. `fixtures:talent-auth` eindigde met exit 9 (`node: .env.local: not found`).
- De huidige worktree-HEAD is `4cfe002f42db43a8c3d3c17af5ffbcbf44a17967`, exact één docs-only commit boven baseline `abfa0bbb7db628f588faa3d4818a4f4663f27b46`; er zijn geen source changes tussen baseline en deze HEAD.
- Exacte Webpack-runtime op `http://localhost:3108` was ready vanuit deze worktree. Zowel `/login` als `/dashboard/start` gaven HTTP 500 vóór productrender met de expliciete ontbrekende Supabase URL/Key-fout uit `apps/hr-suite/proxy.ts:19`.
- Playwright bevestigde desktop en viewport `390×844`; de Startpage-controls, authenticated session en preferences waren niet bereikbaar. Er is geen preference-read of `PATCH /api/preferences/start-page` uitgevoerd, dus de bestaande voorkeuren zijn niet gewijzigd en er was niets te herstellen.
- Geen Startpage/preferences-bugfix uitgevoerd: de enige waargenomen fouten waren environment-/runtime-preflightfouten vóór Startpage-render. De open acceptance-items blijven daarom **BLOCKED BY ENVIRONMENT**, niet **RED**.

## Acceptance retry — stap 0 geblokkeerd

- Retry uitgevoerd op dezelfde branch/worktree: `work/debt-startpage-matrix`, `42ef38a7aee919d48c8427b129a5636e0606d126`.
- De verplichte bron `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\.env.local` bestaat niet. Read-only controle met `Get-Item -Force` en `Test-Path` bevestigde dat de bron ontbreekt; het doelbestand is niet aangemaakt.
- `Copy-Item -Force` is daarom niet uitgevoerd, om geen andere env-bron te zoeken of credentials buiten de expliciet aangewezen bron te gebruiken. Er zijn geen secrets gelezen, gelogd of gecommit.
- Door deze stap-0-blocker zijn fixture-auth, preference snapshot/restore, serverstart op 3108, browser/API/persona/theme acceptance en cleanup in deze retry niet uitgevoerd. Er is geen remote write, productfix of gebruikersvoorkeurwijziging uitgevoerd.
- Status van deze retry: **BLOCKED BY ENVIRONMENT**. De eerder vastgelegde technische gates en vorige 3108/Playwright-bevindingen blijven ongewijzigd; nieuwe authenticated acceptance vereist dat de canonical TEST-env op de aangewezen bronlocatie beschikbaar is.

## Acceptance retry — canonical TEST-env en authenticated matrix — 2026-08-22

- Exacte worktree en branch: `.codex-worktrees/debt-startpage-matrix`, `work/debt-startpage-matrix`. De canonical TEST-env is met `Copy-Item -Force` vanuit `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\.env.local` naar `apps/hr-suite/.env.local` gekopieerd; `Test-Path` op het doel was `True`. De inhoud is niet gelezen, gelogd of gecommit.
- Canonical fixture-auth preflight: GREEN. Alleen de drie canonical TEST-fixtures HR, Manager en Employee zijn opnieuw ingesteld via `npm.cmd run fixtures:talent-auth -w @liquid-hr/hr-suite`.
- Exacte Webpack-runtime uit deze worktree: ready op `http://localhost:3108`. Geen remote schema/database apply, push, merge of deploy.

### Preference snapshot en herstel

- TEST HR snapshot: thema `liquid-navy` (Default), `viewMode=compact`, wide layout `teamAvailability, continuousAppraisal, leave, documents, absenceCases, events, kpis`, narrow layout `reminders, workInProgress, journeys`.
- TEST Manager snapshot: thema `liquid-navy` (Default), `viewMode=full`, wide layout `teamAvailability, leave, continuousAppraisal, absenceCases, events, documents, kpis`, narrow layout `reminders, workInProgress, journeys`.
- Beide snapshots zijn na de acceptance via de bestaande preference-flow hersteld en na refresh uit de echte app read back. Er zijn geen willekeurige gebruikersvoorkeuren achtergelaten.

### Browser/API evidence

- TEST HR authenticated op desktop `1280x720` en Playwright `390x844`: Default en LinkedHR, compact en expanded. Widgets, kalendertegel, quick action `Nieuw ziektegeval`, operationele cards, keyboard/focus en page-level overflow zijn gecontroleerd; `document.scrollWidth === body.scrollWidth === viewport width` in alle gecontroleerde runs. Relevant console-resultaat na fresh reload: 0 errors.
- TEST Manager authenticated op desktop `1280x720` en `390x844`: Default, compact en expanded. Team availability, continuous appraisal, reminders, journeys, process work, quick actions (`Mijn gegevens`, `Mijn team`, `Nieuw ziektegeval`), kalenderdatum en team-operationele cards zijn gecontroleerd; geen page-level horizontal overflow en 0 relevante console-errors na de fix.
- TEST Manager heeft in deze persona geen Startpage scope-switch control; de enige gevonden `role=group` was de availability-weergave. Daarmee is scope-switch gecontroleerd als niet beschikbaar voor deze persona, conform permission/persona-contract.
- Reële HTTP-statussen: `GET /login=200`, authenticated login `POST /login=200`, `GET /dashboard/start=200`, `PATCH /api/preferences/start-page=200`, personal-settings `POST /personal-settings=200`, quick-action/calendar/card routes `GET=200`, avatar proxy `GET /api/employees/{employeeId}/avatar=200`.
- Preference/layout readback na refresh is voor HR en Manager uitgevoerd. Move controls gaven echte `PATCH /api/preferences/start-page=200`; de gewijzigde order bleef na refresh behouden en is daarna teruggezet. Een bounded Playwright `dragstart` → `dragover` → `drop`-sequence op de echte expanded Manager-pagina gaf eveneens `PATCH /api/preferences/start-page=200` en persistente order-readback. De native pointer-drag primitive leverde daarnaast in deze runtime geen native events op; dat is als toolingcaveat vastgelegd, niet als product-RED. De toegankelijke move-controls en drag-event reorder-flow zijn GREEN.

### In-scope productfix

- `apps/hr-suite/lib/startpage/service.ts` normaliseert nu `storage://`-avatarwaarden voor Startpage leave/active-absence cards naar de bestaande `/api/employees/{id}/avatar` proxy. Dit voorkwam een echte relevante console-error op het Manager Startpage; na de fix waren de avatar requests HTTP 200 en relevante console-errors 0. Geen generieke Foundation-, theme- of journey-only code gewijzigd.

### Testdata en cleanup

- Er is geen tijdelijke TEST-data aangemaakt. Er was daarom geen product-cleanup nodig; alleen de drie geautoriseerde canonical fixture-passwords zijn tijdens preflight opnieuw ingesteld. Alle Startpage- en theme-preferences zijn hersteld.
- Scope-notitie bij destination smoke: een directe `/hr-calendar`-request gaf HTTP 200, maar de serverlog toonde voor een TEST-fixture-context een bestaande `AuthorizationError` op `hr-calendar:read`. De Startpage-kalenderdata zelf renderde correct en de browserconsole bleef op 0 errors. Dit route/permission-contract valt buiten de toegestane Startpage/preferences-only bugfixscope en is niet gewijzigd.

## Retry-resultaat

- Startpage acceptance retry: **GREEN**. De resterende authenticated acceptance is uitgevoerd; de enige productfix was de Startpage-avatar-proxy-normalisatie. De oude environment-blocker is met de canonical TEST-env opgelost. Geen remote schema apply, push, merge of deploy.
