# R7-2 — Organization, Access & Context Model

**Status: R7-2 TEST RELEASE GREEN — CENTRAL GATE AND BROWSER SANITY VERIFIED**

## Scope

De zeven afgesproken routes zijn op de bestaande contracten geconvergeerd en eenmaal centraal geïntegreerd:

- `/settings/business-structure`
- `/settings/hr-groups`
- `/settings/administration`
- `/authorization`
- `/role-assignments`
- `/departments`
- `/organization-chart`

De wijzigingen blijven UI/Foundation-convergentie. Bestaande routes, API-payloads, services, contextresolutie, permissions, tenant/HR-group-scope, schema, RLS en grants zijn niet aangepast.

De aanvullende productbeslissing voor het organogram is verwerkt: `/organization-chart` is read-only exploration, afdelingbeheer staat alleen op `/departments`, de user-facing job/functiegroepen-view is verwijderd, `?view=job` valt veilig terug naar `Organisatiestructuur`, en de chart gebruikt alleen de perspectieven `Organisatiestructuur` en `Rapportagelijnen`. De bestaande job-, talent- en performanceprojectie blijft onderliggend beschikbaar voor andere contracten.

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

De aanvullende organogramcode is opnieuw strict gecompileerd en de gerichte set/i18n/lint/build-controles zijn opnieuw groen. Er is geen nieuwe migration, dependency, permission change of API redesign toegevoegd.

Authenticated browser-sanity is op de geïntegreerde candidate uitgevoerd voor HR Admin, Manager en Employee op desktop `1440x900` en mobile `390x844`. Organogram load/tabs/search/filter/reporting-lines, authorization/role-assignment context, Setup Assistant HR Admin access, console en overflow zijn gecontroleerd; er waren geen testdata-mutaties. Een bestaande avatar-resource gaf eenmaal HTTP `400`; dit raakt de R7-2-functionaliteit niet en is niet gewijzigd.

## Git/release

Source worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r7-organization-access`; branch: `work/r7-organization-access`; approved HEAD `4e34ea4`. Central integration uses dedicated release-worktree `work/r7-2-release` from `main=origin/main=54100b4`; version `1.20260828.4`. No migration, schema/RLS/grant change or structural remote database write.
