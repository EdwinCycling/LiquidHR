# R3-TALENT — Team Talent Matrix

## Delivery context

- Baseline: `7ef5e39dae8995eafbefcd8f2c0d9eb950c75e21`
- Branch: `work/r3-team-talent`
- Worktree: `.codex-worktrees/r3-team-talent`
- Local port: `3126`
- Parallel group: `R3-TALENT`
- Scope: `/workforce/talent/team`, `TalentTeamMatrix`, team-service/API/tests and team-specific i18n.

## Implemented

- Added strict query parsing for `q`, capability type, status and source; invalid API filter input returns `400 TALENT_INPUT_INVALID`.
- Preserved the existing manager scope contract: `employee_organizations.direct_manager_id = context.employeeId`; HR tenant scope remains permission-controlled by `talent:manage`.
- Kept the existing employee/job/capabilities/type/status/source/scope contract and added explicit `scopeType`, `aggregateDisabled` and aggregate policy metadata.
- Added server-side filtering and client-side filtering over the already scoped result; no new analytics or aggregation algorithm was introduced.
- Reworked the matrix with Foundation `Surface`, `Badge`, `DropdownSelect`, `TextInput` and `EmptyState` primitives.
- Added localized capability type, status, source, validity and evidence presentation, employee-detail drilldown, no-results/empty states and explicit aggregate-disabled explanation.
- Added URL-state for `q`, `type`, `status` and `source` with browser back/forward synchronization; local filter changes do not trigger a second server scope read.
- Added the minimal `teamMatrix...` NL/EN keys only.

## Security and schema

- No schema or migration change was needed: the existing talent team matrix tables, RLS and `talent-team:read` contract were reused.
- No remote Supabase migration, reset, seed or destructive action was performed. Remote advisors were not run because the requested scope explicitly stops remote apply.
- Aggregate output remains disabled and is explained to the user; no unproven group score or percentage is emitted.

## Environment/auth preflight

- The canonical root `.env.local` was not present at `C:\Users\Edwin\Documents\Apps\LiquidHR\.env.local`, so a literal root-file copy was not possible.
- The existing app environment file was copied to the worktree at `apps/hr-suite/.env.local`; `.env.talent-auth.local` was also copied for the approved TEST fixtures. Secret values were not printed or committed.
- TEST fixtures used: `manager.fixture@liquidhr.test`, `hradmin.fixture@liquidhr.test`, `employee.fixture@liquidhr.test`.

## Verification

### Targeted gates

- Targeted Vitest: **GREEN**, 3 files / 7 tests.
- TypeScript strict type-check: **GREEN**.
- i18n parity: **GREEN**, 33 namespaces with matching NL/EN keys.
- ESLint: **GREEN**, 0 errors; 8 pre-existing warnings remain outside this slice (`employee-person-card`, `foundation-controls.test.tsx`, `dropdown-select`).
- `git diff --check`: **GREEN**.

### HTTP/API readback

- `/login`: `200`.
- Anonymous `/workforce/talent/team`: `307`.
- Anonymous `/api/talent/team-matrix`: `401`.
- Invalid `status` query: `400`.
- Authenticated TEST Manager API: `200`, `scopeType=TEAM`, `scopeCount=5`, 5 rows, `aggregateDisabled=true`.
- Manager scope did not include the manager's own employee record (`9048f02b-4fdc-3c4c-e1aa-fd339660029c`).
- Authenticated HR fixture API: `403` with insufficient-permission response; no permission was added.
- Authenticated Employee fixture API: `403`; no matrix data was returned.

### Browser acceptance

- Manager: login `303`, team route `200`, scoped matrix rendered, search/no-results rendered, status filter URL state `status=RELEASED`, search URL state `q=...`, employee drilldown `200`.
- Desktop `1280×800`: no horizontal overflow.
- Mobile `390×844`: route `200`, no horizontal overflow.
- Default theme: `liquid-navy`; LinkedHR theme: `linkedhr`.
- Final sequential manager run: **0 console errors**.
- HR remains an acceptance conditional because the provided HR fixture has no `talent-team:read`; Employee is the negative case and is denied.

During exploratory dev runs, repeated concurrent navigations occasionally produced a transient Supabase capability-read error and dev-server RSC stream error. After a clean server restart and sequential readback, the targeted manager run was stable and green; no reproducible code failure remained in the final run.

## Delivery boundary

- No other Talent route, generic Foundation component, central delivery document or version file was intentionally changed.
- No push, merge or deploy was performed.
- Local server on port `3126` was stopped after verification.
