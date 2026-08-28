# R7-2 — Organization, Access & Context Model

**Status: R7-2 ORGANIZATION ACCESS & CONTEXT RED — AUTHENTICATED BROWSER ACCEPTANCE BLOCKED BY MISSING TEST ENVIRONMENT**

## Scope

De zeven afgesproken routes zijn op de bestaande contracten geconvergeerd:

- `/settings/business-structure`
- `/settings/hr-groups`
- `/settings/administration`
- `/authorization`
- `/role-assignments`
- `/departments`
- `/organization-chart`

De wijzigingen blijven UI/Foundation-convergentie. Bestaande routes, API-payloads, services, contextresolutie, permissions, tenant/HR-group-scope, schema, RLS en grants zijn niet aangepast.

## Contractmatrix

| Route | Read gate | Write gate | Context/data contract |
| --- | --- | --- | --- |
| Business structure | `hr-group:read` | `hr-group:manage` | actieve HR-groep en onderliggende administraties |
| HR-groups | `hr-group:read` | `hr-group:manage` | actieve HR-groep; bestaande admin CRUD |
| Administration | `settings:read` | bestaande context-selector | actieve HR-groep → administratie, via `/api/context/administration` |
| Authorization | `authorization:read` | `authorization:write` | matrix blijft server-side gescoped; self-lockout blijft actief |
| Role assignments | `management-assignment:read` | `management-assignment:write` | tenant + actieve HR-groep; toegestane rollen blijven beperkt |
| Departments | `department:read` | `department:write` | tenant + actieve HR-groep; deactiveren blijft bestaande mutatie |
| Organization chart | `organization-chart:read` plus bestaande graph-capabilities | `department:write` | bestaande department/placement/management graph |

## Foundation convergence

PageShell/PageHeader, Surface, FormField, TextInput/Textarea, DropdownSelect, Checkbox, Badge, EmptyState, CollectionToolbar, DataTableShell, RowActions, FormDrawer, ConfirmDialog, Dialog, MultiSelect en TabButton zijn hergebruikt. Native inline formulieren, lokale modalpatronen, nested card styling, hover-lift en de decoratieve chart-gradient zijn verwijderd. FormDrawer dirty-close is toegevoegd waar de bestaande draft-state dat kan bepalen.

## Verificatie

- Gerichte Organization/Context/Chart-set: `12/12` bestanden, `50/50` tests.
- `check:i18n`: `34` gelijke NL/EN-namespaces.
- strict TypeScript: groen.
- ESLint: `0 errors / 8 bestaande warnings`.
- Webpack build: `229/229` routes.
- `git diff --check`: groen.
- Full suite: `263/264` bestanden en `1008/1009` tests; uitsluitend de bekende ongewijzigde Journey-failure rond `Binnenkort beschikbaar`.

De echte browsercontrole kon niet starten voorbij middleware: de R7-2-worktree en repository-root bevatten geen `.env.local`, waardoor Supabase client-creatie in `proxy.ts` HTTP `500` geeft op `/login`. Daardoor zijn authenticated HR/Manager/Employee, desktop/mobile overflow, console-evidence en echte mutatie/readback niet bewezen. Geen credentials zijn gelogd, geen env-bestand is gekopieerd en geen remote write is uitgevoerd.

## Git/release

Dedicated worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r7-organization-access`; branch: `work/r7-organization-access`; baseline: `main=origin/main=051c57a998c33d17a8ac1bef166fe58f5c15b133`. Geen version bump, merge, push, Vercel-actie, migration of remote database write.
