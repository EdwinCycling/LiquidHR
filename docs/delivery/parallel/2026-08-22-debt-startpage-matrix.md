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
