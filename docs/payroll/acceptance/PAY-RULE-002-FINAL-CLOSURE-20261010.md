# PAY-RULE-002 — Final closure checkpoint

**Date:** 2026-10-10
**Status:** ENGINEERING GREEN / PERSISTENCE DEFERRED
**Worktree:** `Integration-PAY-CONVERGE-20261004` · `integration/pay-converge-20261004` · `0337af89d01ea072936b8894e01f46f09f7b3be9`

## Delivered

- Generic PFZW 2026 calculation and trace remain integrated with PAYRUN01, including separate employee/employer premiums, fiscal deduction, employer cost, effective dates, WIA threshold, and source/policy provenance.
- Core has a generic, scoped workflow to create/reuse an effective labor-condition-to-arrangement mapping and create one explicit employment assignment in the same transaction. A mapping never enrolls other employments.
- The workflow requires `pension:manage` and HR Admin/Tenant Admin role, tenant/HR-group/administration scope, valid employment/contract/arrangement periods and participant group, explicit mapping confirmation, idempotency, single-successor versioning, overlap checks, and audit writes. Authenticated direct DML to mapping and assignment tables is revoked; existing scoped read RLS policies remain.
- Synthetic records require the non-production server flag and matching trusted Supabase `app_metadata` claims. The workflow migration is applied only to synthetic TEST as `20261010130013_core_pension_assignment_workflow`; its FK-index follow-up is `20261010130140_core_pension_assignment_supersession_fk_indexes`. The two existing mappings and two existing assignments were versioned without creating or changing an employee assignment. Frits's assignment and successor payroll runs remain unpersisted.
- Core→Payroll source projection carries assignment and mapping version/provenance. PFZW projection blocks missing versions or an assignment whose mapping ID/version does not match the effective mapping.

## Frits calculation evidence

These are deterministic previews from the approved synthetic TEST vector, not persisted runs. September and October use a €46,649 whole-euro annual pensionable salary, 32/36 contractual factor, 12.9% employee and 13.0% employer OP/NP shares, and the versioned synthetic monthly allocation policy. October includes eight cash-paid extra hours and the synthetic `210 / (36 × 52)` hours uplift. No WIA-excedent premium applies.

| Preview only | September 2026 | October 2026 |
| --- | ---: | ---: |
| Gross salary | €3,044.44 | €3,219.41 |
| Annual pensionable salary (`RegLn`) | €46,649 | €46,649 |
| Contract DTF / contract pension hours | 0.8889 / 138.67 | 0.8889 / 138.67 |
| Additional pensionable hours / final DTF | 0 / 0.8889 | 8.8974358974 / 0.9460 |
| OP/NP assessment base | €26,103.44 | €27,780.24 |
| Employee / employer OP/NP | €280.61 / €282.79 | €298.64 / €300.95 |
| LB/PH, SV and Zvw bases | €2,763.83 each | €2,920.77 each |
| Wage tax / net | €292.75 / €2,471.08 | €356.00 / €2,564.77 |
| Holiday / actual 2026 EJU reserve | €243.56 / €243.56 | €257.55 / €257.55 |
| Cumulative gross / reserves | €3,044.44 / €243.56 each | €6,263.85 / €501.11 each |
| Total employer cost | €4,434.00 | €4,690.30 |

Employer cost is gross plus employer insurance (€619.65 / €654.84), employer pension, holiday reserve and 2026 EJU reserve. The employee contribution reduces LB/PH, SV and Zvw bases; the employer contribution does not reduce employee net. The trace uses `PFZW-PENSIONREGLEMENT-2026-07+UPA-2026-v5` and binds the source snapshot/hash, salary row, assignment/mapping/arrangement versions and TEST policy versions.

Protected historical records remain unchanged: Lisa FINALIZED `57ac6c10-7a02-49c4-a588-2ca244e621d9`; Jaap CONCEPT `e20e0345-90ac-489b-9fee-7610b2d8f6a3`; Frits pre-PFZW FINALIZED October `338ef391-fbf6-435a-a4d7-e28a8024ebc2`. No PFZW successor run ID exists.

## Verification

- PFZW golden and pension regression suite: **31/31 tests, 3 files**.
- Core assignment, migration contracts, PAYRUN01 integration/source snapshot/provider regressions: **86/86 tests, 10 files**.
- Strict non-incremental TypeScript: HR suite and payroll rules package.
- Changed-source ESLint: zero errors.
- NL/EN i18n parity: 42 namespaces.
- `git diff --check`: pass; Git emitted only existing LF→CRLF working-copy notices.
- Core DB advisors, live migration validation/readback and persisted lifecycle acceptance were not run because the authorized TEST runtime was absent. No Docker, interactive login, credential recovery, production change, remote database write, deploy, push, merge, payment, UPA or Loonaangifte action occurred.

## One remaining execution prerequisite

Provide an authorized non-production Core/Payroll TEST execution context through its normal setup. It must include:

1. Apply the prepared Core migration through the authorized migration process after the normal Core/DEV lineage check.
2. Restore the documented central TEST runtime; `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local` was absent in this run.
3. Enable server-side `PENSION_TEST_FIXTURES_ENABLED=true` and set the declared runtime to `test`.
4. Use an existing authorized TEST identity whose trusted `app_metadata` contains `liquidhr_pension_test_fixtures_enabled=true` and `liquidhr_pension_fixture_environment=test`. No identity was provisioned or changed here.

Then use the Core pension page/service to re-read Frits's exact scope, contract, generic PFZW arrangement and overlap state; explicitly create/read back the CAO mapping and one synthetic assignment effective 2026-09-01 with scenario `PAY-RULE-002 — FRITS_PFZW_2026`. Resolve the source through the PAYRUN01 snapshot provider, calculate September and October through the normal versioned TEST successor workflow, and read back hashes, controls, trace and artifacts. Keep every canonical run immutable and let lifecycle guards decide eligibility.

The complete PFZW rule contract and calculations remain in [PAY-RULE-002 acceptance](PAY-RULE-002-PFZW-2026-20261009.md); current task state is in [CURRENT_CONTEXT](../../delivery/CURRENT_CONTEXT.md).

**Recommendation:** close the engineering slice as implementation-complete and move the next payroll development phase forward. Keep Frits's persistence acceptance as the single environment-gated follow-up; do not treat these previews as persisted payroll results.
