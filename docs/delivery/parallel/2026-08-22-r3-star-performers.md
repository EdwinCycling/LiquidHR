# Roadmap 3 — Star Performers + Star Performer Tags

Datum: 2026-08-22

- Baseline: `abfa0bbb7db628f588faa3d4818a4f4663f27b46`
- Worktree: `.codex-worktrees/r3-star-performers`
- Branch: `work/r3-star-performers`
- Runtime: poort `3112`

## Implemented

- `star-performer-tags`: Foundation v1.2 lijst-eerst beheer met zoeken, `FormDrawer` voor create/edit, `RowActions`, `ConfirmDialog` en permission-aware activate/deactivate-acties.
- `star-performers`: employee identity, department/job context, scanbare tag-badges, filters via URL-state, clickthrough naar employee detail wanneer `employee:read` beschikbaar is en permission-aware rating/tag-acties.
- NL/EN message parity bijgewerkt.
- Gerichte Foundation-componenten hergebruikt; geen generieke Foundationwijziging en geen `FOUNDATION_GAP`.
- Directe componenttest toegevoegd voor lijstweergave, read-only acties en employee/tag/clickthrough-presentatie.

## Behouden contracten

Er zijn geen schema-, migration-, API-, RLS- of permission-contracten gewijzigd. De bestaande tag-API en de bestaande `upsert_star_performer_assessment`-route/RPC blijven leidend.

De bestaande tag-API ondersteunt geen DELETE en de koppeltabel heeft een restrictieve foreign key. Daarom is geen delete-endpoint of lokale delete-flow uitgevonden: cleanup/deactivatie gebruikt het bestaande `is_active`-contract. Inactieve tags blijven leesbaar als bestaande koppeling, maar zijn niet opnieuw kiesbaar voor toewijzing.

## Vastgelegde HTTP-contracten

| Endpoint | Succes | Foutgevallen |
|---|---:|---|
| `GET /api/star-performer-tags` | 200 | 401/403 via permissionlaag |
| `POST /api/star-performer-tags` | 201 | 400 invalid input, 401/403 auth, 409 duplicate/conflict |
| `PATCH /api/star-performer-tags/[tagId]` | 200 | 400 invalid input, 401/403 auth, 404 not found, 409 conflict |
| `POST /api/star-performers/assessments` | 201 | 400 invalid input, 401/403 auth, 404 not found, 409 conflict volgens bestaande service-mapping |

## Verificatie

- Gerichte test: 1 file, 3 tests passed.
- TypeScript: `npm.cmd run type-check --workspace @liquid-hr/hr-suite` — groen.
- i18n: `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite` — 33 namespaces met gelijke NL/EN-sleutels.
- Lint: 0 errors, 8 bestaande warnings buiten deze slice.
- `git diff --check`: exit 0; alleen bekende LF/CRLF-normalisatieberichten.
- Geen remote Supabase-write, push, merge of deploy uitgevoerd.

## Open / geblokkeerd

De lokale server startte op poort 3112, maar `/login` en de R3-route gaven HTTP 500 omdat in deze worktree geen Supabase URL/key-runtimeconfiguratie beschikbaar was. Daardoor konden authenticated browser-proof en echte CRUD met unieke `R3-STAR-<runid>` niet veilig worden uitgevoerd.

Niet bewezen door deze environment-blocker: create → readback → edit → toewijzing → readback → cleanup, positieve en negatieve persona, Default en LinkedHR, desktop en echte 390px viewport, en de eis van nul relevante runtime-console-errors. De server en browser zijn vóór afronding gestopt/gesloten.

## Acceptance retry — 2026-08-22

- Verplichte broncontrole: `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\.env.local` bestaat niet (`Test-Path=False`).
- `Copy-Item -Force` kon daarom niet uitvoeren; doelbestand in deze worktree bestaat niet (`Test-Path=False`).
- Geen env-inhoud of secrets gelezen, gelogd of gecommit.
- Geen fixture-auth preflight, wachtwoordreset, serverstart, browser/API-call of CRUD uitgevoerd; zonder de canonical TEST-env zou dat geen geldige acceptance zijn.
- De eerder vastgestelde acceptance-blocker blijft actief: canonical TEST-runtimeconfiguratie ontbreekt.

## Acceptance retry — evidence 2026-08-22

### Environment en fixture-auth

- Canonical bron: `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\.env.local`; gekopieerd met `Copy-Item -Force` naar `apps/hr-suite/.env.local` in deze worktree.
- Doelcontrole: `Test-Path` was `True`. De env-inhoud en secrets zijn niet gelogd, getoond of gecommit.
- Canonical preflight: `npm.cmd run fixtures:talent-auth --workspace @liquid-hr/hr-suite` exit 0; uitsluitend `hr-admin`, `manager` en `employee` bijgewerkt.
- Server: exacte worktree op `http://localhost:3112`; geen remote schema/database apply, push, merge of deploy.

### Echte HTTP- en readback-evidence

| Flow | Evidence |
|---|---|
| Authenticated TEST HR | `GET /login` 200, login `POST` 200, `/dashboard/start` 200 |
| Taglijst | `GET /workforce/star-performer-tags` 200; refresh/readback 200 |
| Create tag | `POST /api/star-performer-tags` **201** voor `R3-STAR-20260822-194629`; lijst-readback en refresh bewezen |
| Edit tag | `PATCH /api/star-performer-tags/9253031f-5821-444d-be2c-a061fefeb081` **200**; `R3-STAR-20260822-194629-EDITED` readback bewezen |
| Assessment | `POST /api/star-performers/assessments` **201**; Maya Bos readback `5/5` |
| Tag assignment | `POST /api/star-performers/assessments` **201**; tag readback na volledige URL-refresh bewezen |
| Cleanup | Deactiveren via bestaande ConfirmDialog: `PATCH /api/star-performer-tags/9253031f-5821-444d-be2c-a061fefeb081` **200**; refresh toont `Inactief`, gebruik `1`, bestaande Maya-koppeling blijft zichtbaar |
| Post-cleanup Star Performers | volledige URL-refresh **200**; 4 medewerkers, 1 beoordeling, gemiddelde `5,0`, Maya Bos en de inactive R3-tag blijven leesbaar |

Delete is niet uitgevoerd: de bestaande API heeft geen DELETE-contract en de koppeling heeft een restrictieve foreign key. Deactiveren is daarom de contractuele cleanup.

### Personas, negative path en theme/responsive

- TEST HR Admin: GREEN voor tagbeheer, star-performer assessment, tag assignment, refresh/readback en permission-aware HR-acties.
- TEST Manager en TEST Employee: loginpoging uitgevoerd, maar beide sessions eindigden op `/geen-toegang` (document 200) wegens `Nog geen toegang — Je account is ingelogd, maar nog niet aan een klantomgeving gekoppeld.`. De HR test-role switcher gaf voor Manager **403** (`TEST_ROLE_SWITCH_FORBIDDEN`). Geen workaround of andere accountwijziging uitgevoerd.
- LinkedHR: desktop 1440x900 en 390x844, beide `scrollWidth` gelijk aan viewport; R3-route console `0` errors / `0` warnings (alleen React/HMR-info).
- Default/Liquid Navy: desktop 1440x900 en 390x844, beide `scrollWidth` gelijk aan viewport; R3-route console `0` errors / `0` warnings (alleen React/HMR-info).
- Clickthrough naar employee identity, scanbare tags, filters en geen overmatige card-layout zijn browsermatig gecontroleerd.

### In-scope productbug gevonden en opgelost

- Een bestaand database-fixture job-group-id (`a9c11a31-9082-571c-1a3e-24a211db2c62`) werd door Zod `.uuid()` afgewezen, waardoor `Test Customer Success` een Next error overlay gaf.
- Fix: lokaal R3-schema accepteert de bestaande database UUID-textvorm met exact 8-4-4-4-12 patroon; geen API-, database-, RLS- of permission-contract gewijzigd.
- Regressietest toegevoegd voor query/assessment acceptance en malformed input. Targeted test: 1 file, 4 tests passed. TypeScript, i18n (33 namespaces), lint en `git diff --check` groen.
- Na de fix is de foutgevende functiegroep opnieuw geopend met HTTP 200 en is de volledige assessment/tag/readback-flow opnieuw uitgevoerd.

### Eindstatus retry

- R3 Acceptance: **GREEN voor TEST HR Admin**.
- Persona-matrix is niet volledig sluitend voor Manager/Employee door de bestaande ontbrekende tenant-context; dit blijft een omgevings-/fixtureblokker buiten de R3-productfix.
- Tijdelijke data is volgens bestaand contract gedeactiveerd en refresh/readback gecontroleerd; geen tijdelijke tag is actief achtergelaten.
