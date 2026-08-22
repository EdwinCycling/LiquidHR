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

## Authenticated acceptance

Status: `BLOCKED BY ENVIRONMENT`, geen eindbewijs geclaimd.

De lokale server op `http://localhost:3111/login` kon niet renderen: `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ontbreken in de runtime. Daardoor zijn geen mocks, fake users, auth-bypasses of remote writes gebruikt en zijn de volgende gates niet uitgevoerd:

- echte positieve manager/HR persona en self persona;
- CREATE indien ondersteund, READ, EDIT/action/status en refresh/readback;
- cleanup/restore indien ondersteund;
- negative permission/scope;
- desktop en 390px;
- Default en LinkedHR.

## Handoff-volgende stap

Herhaal in een runtime met echte lokale Supabase-configuratie en bestaande testpersona-sessies op poort 3111 de R3-APPRAISAL-run. Leg de echte API-statuscodes, readback en cleanup vast; gebruik geen mocks en voer geen remote schema apply uit. Stop de server na de controle.

Lokale commit aanwezig met message `feat: redesign continuous appraisal`. Push, merge en deploy blijven buiten deze opdracht.
