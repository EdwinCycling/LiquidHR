# Roadmap 3 — Organization / Departments

## Scope

- Baseline: `abfa0bbb7db628f588faa3d4818a4f4663f27b46`
- Worktree: `.codex-worktrees/r3-organization-departments`
- Branch: `work/r3-organization-departments`
- Runtime: `http://localhost:3109`
- Slice: `/departments` and direct department organization UI, validation, API and tests.
- Central delivery/statusdocs were not changed.

## Delivered

- Foundation v1.2 list-first department workbench with search, active/inactive filter, name/code sort and hierarchy-preserving filtered context.
- Create and edit through the existing `FormDrawer`, including fixed Save/Cancel actions and dirty-change protection.
- Existing `RowActions` and `ConfirmDialog` for activate/deactivate; active/inactive semantics remain PATCH-based.
- Server-side `department:read` and `department:write` behavior preserved; no-write personas receive the existing read-only route behavior and employees are denied access.
- Existing parent/child and process-start relationships preserved. Manager and employee relationship tables/contracts were not changed; manager assignment remains on its existing organization surface and is not part of this department CRUD API.
- Default (`liquid-navy`) and LinkedHR are theme-agnostic and use the existing Foundation primitives; no `components/ui`, generic pattern or layout files were changed.
- Added the optional `includeInactive=true` read path while keeping the existing active-only GET default.
- Fixed an in-scope parent validation issue: existing database GUIDs are accepted by department parent input validation, matching the stored identifier contract.

## Authenticated acceptance evidence

Canonical fixture auth preflight: `npm run fixtures:talent-auth` succeeded for `hr-admin`, `manager` and `employee`.

Unique fixture: `R3-ORG-20260822-1336`.

- TEST HR create under `Directie`: HTTP `201 Created`; readback showed the new child in the Directie hierarchy.
- Edit name/description through FormDrawer: HTTP `200 OK`; search readback showed the edited value and retained parent context.
- Manager mutation: not applicable to the existing department CRUD contract; manager/employee relationship data remained untouched.
- RowActions → ConfirmDialog → deactivate: HTTP `200 OK`; inactive readback showed `Inactief` and the inactive filter returned the fixture.
- Cleanup: fixture remains deactivated, which is the existing contract; there is no DELETE endpoint for departments.
- Negative scope: canonical Test Medewerker direct access resolved to `/geen-toegang`; Test Manager retained its existing department access.
- Responsive: explicit Playwright viewport `390x844`; `scrollWidth=390` and `overflow=false`. Create drawer and dirty confirmation were usable at that viewport.
- Themes: `/departments` loaded under `data-theme=linkedhr` and `data-theme=liquid-navy`; final browser console was 0 errors / 0 warnings.

The first create attempt returned HTTP `400 DEPARTMENT_INPUT_INVALID` for an existing non-versioned database GUID parent; this was fixed in-scope and the retest returned `201 Created`.

## Gates

- Targeted Vitest: PASS — 2 files, 8 tests.
- TypeScript: PASS — `npm run type-check --workspace @liquid-hr/hr-suite`.
- i18n: PASS — `33 namespaces met gelijke NL/EN-sleutels`.
- Targeted ESLint: PASS — departments page/API/component/service/tree/schema files.
- `git diff --check`: PASS.
- Remote schema apply: not performed.
- Push, merge and deploy: not performed.

## Foundation gap

None. Existing Foundation controls, patterns and layout contracts were reused.
