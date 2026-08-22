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
