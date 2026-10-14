# PAYCALC-REAL-01C — TEST provenance checkpoint — 2026-10-14

## Decision

**HOLD — no remote migration, payroll calculation, or TEST business-data write.** The Core project is documented and configured as the shared synthetic TEST environment. The remaining blocker is the current authorized source read needed to bind the proposed employee identifier to payroll-eligible Core data. No migration or calculation approval is requested in this checkpoint.

## Environment and source provenance

- Supabase metadata readback: Core `wnpfloqpjvaacobppbpk` (`LiquidHR`, `ACTIVE_HEALTHY`, `eu-west-3`, PostgreSQL 17.6); Payroll Lab `jhgeriucbkfarxiudzfy` (`LiquidHR-Payroll-Lab`, `ACTIVE_HEALTHY`, `eu-central-1`, PostgreSQL 17.11). These are separate projects/databases.
- Managed project documentation identifies `wnpfloqpjvaacobppbpk` as canonical Core TEST and describes the existing operational LiquidHR environment as synthetic TEST. The HR-group implementation document states that the current database contains synthetic test data only. The fixture migration `20260806143509_rename_demo_scope_display_names.sql` ties the synthetic demo tenant slug `liquid-hr-demo-holding` to the display name `De Sterren holding`; the shared R5 fixture document also records a synthetic dataset on the same Core project.
- This establishes the documented project classification. It is not a fresh row-by-row provenance inventory of the entire current database.
- The general email-domain check is not used here as a test-fixture verdict. A targeted search of Payroll calculation/API/script code found no dispositive email-domain gate; `.test` fixture addresses found by that search occur in acceptance documentation.

## Candidate identity and eligibility

- The supplied UUID `22222222-2222-4222-8222-222222222222` occurs in the synthetic fixture migration `20260727171300_seed_rich_absence_demo_employees.sql` as a Noah test record with employee number `TEST-VERZ-048`.
- The separate migration `20260804193021_move_test_employee_to_yara_team.sql` resolves an employee by `DEMO-035`; it does not bind that key to the supplied UUID. Existing documents call Noah `DEMO-035`, but the inspected migration evidence does not establish that this is the same current Core identity.
- No current authorized HR Admin source-service read was available in this checkout. Therefore tenant/HR-group/administration, in-period confirmed employment, valid READY/REPORTED IKV link, effective fixed EUR monthly salary, fiscal profile/confirmation, absence of a prior Payroll run, and the confirming HR Admin are **not reverified** for the supplied UUID. Do not use this candidate for the controlled calculation until those reads resolve the identity and eligibility.
- The official local TEST launcher preflight could not establish a safe runtime: it rejected an existing config destination that is not provably the canonical hardlink. The provisioner left it untouched. No config values were read. The open browser window was a ChatGPT tab, not an authenticated LiquidHR HR Admin session.

## Migration and history readback

- Core migration head: `20261013143616`; target `20261013150000_core_employment_payroll_tax_profiles` is absent.
- Payroll Lab migration head: `20261009050755`; target `20261013120000_paycalc_real01_generic_input_reference` is absent.
- Both local forward-only migration files are present at their specified paths. No remote migration was applied. No payroll row, profile, period, calculation, lifecycle state, or historical PAYRUN01 result was written or changed.
- Historical Lisa, Jaap, and Frits results were not used as candidates and were not mutated. This checkpoint does not claim a fresh data-level before/after hash readback for them.

## Git and handoff

- Feature branch: `work/PAYCALC-REAL-01-20261013`; base code HEAD and remote feature ref were both `432acdf7c0d42423d1a8b2b5bc04e1eaabe4bdc0` before this evidence note.
- Current remote `main`, verified through `git ls-remote`, is `8c585f8397e059070e2107cdbec57ab7fbe3757e`. GitHub compare reports the feature branch diverged from it (feature +4, main +3) at merge base `f7db482b19b81d9c5aa5517c66394faa5f628e1b`. Main's intervening files include employee-overview pagination and shared `employment-service.ts`, plus sidebar/roadmap updates; no other Payroll feature branch was imported.
- Local fetch could not update the shared Git object database (`insufficient permission for adding an object`). The local `origin/main` ref remains stale. No merge/rebase was attempted. Reconcile the changed shared employment service before integrating this payroll work in PAYFULL-01.
- The pre-existing untracked `.tmp-paycalc-real01/` worktree content was preserved.

## PAYFULL-01 next action

Use an already-authorized Core source-service context to resolve the exact employee identity and read the required scoped employment, IKV, compensation, fiscal, prior-run, and HR Admin facts. Then either select a proven eligible synthetic employee or stop with a source-gap reason. Only after a complete read-only preflight should the separately scoped TEST migration/calculation decision be requested. Keep PAYESS, Lisa/Jaap/Frits, remote writes, merge, and deployment outside this checkpoint.
