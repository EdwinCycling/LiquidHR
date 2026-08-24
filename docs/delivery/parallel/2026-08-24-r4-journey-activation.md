# R4-JNY-ACT — Journey Start / Activation Wizard

## Delivery context

- Baseline: `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`
- Branch: `work/r4-journey-activation`
- Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR.codex-worktrees\r4-journey-activation`
- Local port: `3155`
- Scope: `/journeys/new`, existing `ActivationWizard`, direct activation service/API/tests.

## Implemented

- Confirmed `/journeys/new` already existed and was already linked from `/journeys`; the existing `ActivationWizard` was improved in place.
- Added published-template anchor metadata to start-options and made the wizard honor `EMPLOYMENT_START_DATE` versus `MANUAL_DATE`.
- Added target employee/employment synchronization, anchor-date guidance, team-resolution step, constrained manual participant selection and activation blocking feedback.
- Reused Foundation `Surface`, `Button` and `DropdownSelect` primitives; no second wizard, catalog or designer implementation was added.
- Kept activation idempotent across a retry by retaining one idempotency key for the selected payload.
- Added server-side employment existence, target-employment match and employment-anchor-date validation before participant resolution.
- Accepted deterministic TEST fixture UUIDs through the repository's `databaseUuid` validator; no generic `any` or local authorization substitute was introduced.
- Added the activation API route contract test and the deterministic-UUID domain regression test.

## Security, data and remote boundary

- No migration or schema change was made; no remote Supabase migration, reset, seed, destructive action or production configuration change was performed.
- No temporary template was created. Acceptance used an existing published TEST template.
- TEST target was Noah / `DEMO-035`; no external mail, SMS or webhook was triggered.
- HR/admin used the existing `journeys:write` contract. Manager and employee received `403` for both start-options and activation; the negative activation probe used a non-existent template UUID and could not create data.

## Verification

### API and readback

- Authenticated HR `/api/journeys/start-options`: `200`; 4 published templates, including anchor rules.
- Real preview for Noah / `DEMO-035` with the existing published employment-anchor template: `200`, `canActivate=true`, 3 participants, 2 moments, 0 blocking issues and 0 warnings.
- Real activation: `201`; created journey ID `d936c0e3-27c6-4bd0-b8fa-8f18f5a434ca`.
- Same activation payload and idempotency key: `201` replay with the same journey ID.
- Missing idempotency key: `400` validation response.
- Fresh detail read before cleanup: `200`, `ACTIVE`, 3 participants and 2 moments.
- Journey list readback: `200`, the test journey was present; detail projection was readable with `200`.
- Lifecycle cleanup through the existing transition contract: `200`, `ACTIVE` version 1 to `CANCELLED` version 2.
- Final detail readback: `200`, `CANCELLED`, 3 participant rows and 2 moments; residual TEST ID is documented above and is intentionally retained only as a canceled lifecycle record because this contract has no hard-delete operation.

### Persona and browser acceptance

- Manager: `/api/journeys/start-options` `403`; `/api/journeys/activate` `403`.
- Employee: `/api/journeys/start-options` `403`; `/api/journeys/activate` `403`.
- HR desktop browser flow: `/journeys/new` rendered, real preview response `200`, activation button enabled, no horizontal overflow and 0 console errors.
- HR mobile browser flow at `390×844`: activation button enabled, no horizontal overflow and 0 console errors.
- Visual snapshots were inspected for desktop and mobile; no route, API or data ownership changes were made outside this slice.

### Gates

- Full Vitest: **GREEN**, 235 files / 902 tests.
- Targeted Journey tests: **GREEN**, 4 files / 15 tests.
- Strict TypeScript: **GREEN**.
- i18n parity: **GREEN**, 33 namespaces with matching NL/EN keys.
- ESLint: **GREEN**, 0 errors; 8 existing warnings remain in `employee-person-card`, `foundation-controls.test.tsx` and `dropdown-select`.
- `git diff --check`: **GREEN**.

## Delivery boundary

- Changed only the owned activation flow, its runtime contract/validation, Journey NL/EN labels, focused tests and this parallel handoff document.
- No central delivery document was edited.
- No push, merge or deploy was performed.
