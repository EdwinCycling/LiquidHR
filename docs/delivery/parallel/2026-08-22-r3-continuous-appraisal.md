# R3 Continuous Appraisal — eigen handoff

Run: `R3-APPRAISAL-20260822-01`
Baseline: `abfa0bbb7db628f588faa3d4818a4f4663f27b46`
Branch: `work/r3-continuous-appraisal`
Worktree: `.codex-worktrees/r3-continuous-appraisal`
Previewpoort: `3111`

## Afgerond

- `/workforce/continuous-appraisal` en `/my-appraisal` gemigreerd naar Foundation v1.2-presentatie.
- Bestaande Continuous Appraisal-services, routes, payloads, permissions, scope, statuses, actor/employee-relaties, comments en attachments behouden.
- Collection/workbench opgebouwd met `PageShell`, `PageHeader`, `Surface`, `CollectionToolbar`, `FilterBar`, `ScrollableTabs`, `DetailColumns`, `Badge`, `EmptyState`, `FormDrawer`, `FormField`, `DropdownSelect` en `RowActions`.
- Create/Edit gebruikt één FormDrawer-contract met vaste Save/Cancel-footer en dirty protection. De appraisalflow is normaal item-CRUD en vereist geen full-page wizard.
- URL-state voor zoeken, type, status, eigenaar, periode, sortering en managerselectie behouden/gehard.
- Read-only permission awareness toegevoegd; mutatieacties zijn niet zichtbaar voor een read-only context.
- Attachment-upload verschijnt alleen bij `item.canEdit`; historische/vergrendelde items tonen geen serverafwijzende uploadactie.
- NL/EN `continuousAppraisal`-sleutels gelijkgetrokken en runtime-locale gebruikt voor datumlabels.
- Gerichte collectiecontracttests toegevoegd.
- Geen wijziging aan 9-grid, Talent, Star Performers, Workforce landing, generieke Foundation, schema/migrations, Supabase/RLS, centrale deliverydocs, push, merge of deploy.

## Lokale gates

- `npm.cmd test --workspace @liquid-hr/hr-suite -- components/continuous-appraisal/continuous-appraisal-workspace.test.tsx` — GREEN, 1 testbestand / 2 tests.
- `npm.cmd run type-check --workspace @liquid-hr/hr-suite` — GREEN.
- `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite` — GREEN, 33 namespaces.
- Gerichte ESLint op appraisal component, test en beide routes — GREEN.
- `git diff --check` — GREEN.
- Dependency-installatie was lokaal nodig omdat de nieuwe worktree geen bruikbare `.bin`-links had; `npm ci --ignore-scripts --no-audit --no-fund` slaagde met een tijdelijke task-cache. Er is geen lockfilewijziging.

## Acceptance retry — `R3-APPRAISAL-20260822-ACCEPTANCE`

Status: `GREEN` op de echte lokale TEST-runtime. De canonical TEST-env is met `Copy-Item -Force` vanuit de hoofdworkspace naar deze worktree gekopieerd en met `Test-Path` gecontroleerd; de inhoud is niet gelogd. `fixtures:talent-auth` heeft uitsluitend de drie canonical TEST-fixtureaccounts bijgewerkt: HR, manager en employee.

Persona's en echte API-statussen:

- TEST HR / `TENANT_ADMIN`: workspace READ `200`; HR CREATE zonder gekoppelde actor `403`; tenantbrede READ `200`.
- TEST MANAGER / `DIRECT_MANAGER`: CREATE `201`; EDIT/status `200`; READ na refresh `200`; buiten directe scope READ `403`.
- TEST EMPLOYEE / `EMPLOYEE`: eigen CREATE `201`; EDIT/status `200`; comment `201`; READ na refresh/readback `200`; buiten self-scope READ `403` en CREATE `403`.
- Tijdelijke herkenbare records met prefix `R3-APPRAISAL-20260822-ACCEPTANCE` zijn via het bestaande statuscontract op `CANCELLED` gezet. Er is geen DELETE/restore-endpoint voor appraisal-items; laatste readback: `0` actieve run-records.

Browser/responsive/theme:

- TEST HR en TEST MANAGER: `/workforce/continuous-appraisal` HTTP `200`, desktop `1440px`, geen horizontale overflow, Default `liquid-navy`.
- TEST EMPLOYEE: `/my-appraisal` HTTP `200`, `390x844`, geen horizontale overflow, LinkedHR `linkedhr`; workforce-denial bevat de bestaande `/geen-toegang` redirect-meta.
- TEST HR: dezelfde appraisal-workbench met LinkedHR-cookie HTTP `200`, desktop `1440px`, geen horizontale overflow.
- Dirty protection: echte FormDrawer met gewijzigde titel toont `Wijzigingen negeren?` en Terug naar formulier/Wijzigingen negeren.
- Relevante appraisal-console-errors: geen. De bekende `ERR_UNKNOWN_URL_SCHEME`-meldingen kwamen uitsluitend van de bestaande shell-avatar `storage://`-href en niet van Continuous Appraisal.

In-scope fixes tijdens retry:

- ontbrekende NL/EN-runtimekeys `archived`, `noResults`, `noResultsDescription` en `canWrite` toegevoegd;
- HR zonder gekoppelde employee actor fail-closed naar HTTP `403` in plaats van `500`;
- server-side target scope voor manager read/write/comment/attachment en employee-route authorization aangescherpt;
- manager employee-options beperkt tot actieve directe managerscope;
- appraisal authorization errors blijven echte HTTP `401/403` in de route response.

Geen generieke Foundation-, schema-, migration-, remote database-, push-, merge- of deployactie uitgevoerd.
