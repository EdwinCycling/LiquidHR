# PAYROLL-K2-CLOSE-01 checkpoint

## Recovery point

- Worktree: `PAYINTEGRATE-01-20261017`
- Branch: `work/PAYINTEGRATE-01-20261017`
- Starting checkpoint: `603078e7`
- Scope: preserve the explicit salary application basis when HR Admin saves a salary timeline change.
- The checkpoint commit is the Git recovery point for the source files listed below. Do not reset or clean the worktree to restore it; keep later user changes and payroll history.

## Included source changes

- `apps/hr-suite/lib/employment/salary-source-mapping.ts`
- `apps/hr-suite/lib/employment/salary-source-mapping.test.ts`
- `apps/hr-suite/components/employment/employment-contract-change-dialog.tsx`
- `apps/hr-suite/components/employment/employment-mutation-panel.tsx`
- `apps/hr-suite/app/(dashboard)/employees/[employeeId]/employments/[employmentId]/page.tsx`

These changes preserve `CAO_SCALE` only when explicitly selected and keep `CUSTOM_SCALE`, manual, minimum-wage, and salary-band mappings distinct.

## Protected worktree content

- `apps/hr-suite/next-env.d.ts` was already modified and is excluded.
- Existing untracked `.tmp/` and `tmp/` content is excluded and must remain untouched.
- Existing payroll runs, artifacts, and historical records are not part of this Git checkpoint.

## Verification before the checkpoint

- Targeted salary-source Vitest: 4 tests passed.
- TypeScript check: passed.
- Targeted ESLint: passed.
- NL/EN i18n key check: passed.
- Runtime/package installation attempts were not repeated after the Windows EPERM; targeted checks used the existing toolchain.

## Business data state at checkpoint

No business mutation had been submitted when this manifest was prepared. The inspected future salary row was the latest row from `2026-11-01`; no November 2026 payroll run for Frits was present in the Payroll UI. Its subsequent correction and any resulting CONCEPT run must be verified in the normal HR Admin and Payroll UI after the user-approved workflow completes.
