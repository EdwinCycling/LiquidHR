# Payroll HOURLY_VARIABLE Consolidation — 2026-11-02

## 1. Executive Summary

**Verdict: GREEN for the local calculation/validation scope; HOLD for mid-period pension and fixture acceptance.** The expected base HEAD was `ef40abbc909cc1329a901251843ff28f227e3940`. Generic on-call `HOURLY_VARIABLE` source validation and released-hour pension basis were already present in that integration tree from `6f26f352`; they were not copied from the older source worktree. This run fixes a separate time-period validation defect and retains a regression test for it.

| ID | Area | What broke | Why | Fix | Regression | Result |
|---|---|---|---|---|---|---|
| PAY-PERIOD-01 | Employee Payroll preflight | `MONTH` with `fullPeriod=false` was accepted as a supported partial period | The source validator accepted `MONTH` with either boolean value and selected the partial-period package | `MONTH` now requires `fullPeriod=true`; partial periods require a valid composite period | New negative preflight test and existing positive composite-period test; zero snapshots/runs/inputs for the invalid source | GREEN |
| PAY-HOURLY-01 | Core Payroll source | Generic released-hour `HOURLY_VARIABLE` calculation appeared absent in the prior inventory | Feature commit `6f26f352` is already an ancestor of the integration HEAD | Kept the current, more developed integration implementation; no duplicate or file replacement | Source-provider and calculation tests plus the full workspace suite | GREEN |
| PAY-HOURLY-PARTIAL-01 | Partial pension period | A mid-period pension start does not produce a complete supported source | Current pension rules return `PENSION_PARTIAL_MONTH_PRORATION_UNVERIFIED`; the attempted scenario also exposed `INCOME_RELATIONSHIP_TIMELINE_GAP` | No guard was removed and no unsupported fixture assumption was introduced | Existing fail-closed behavior retained; exploratory positive scenario not kept as a passing test | HOLD |

## 2. Coverage

Reviewed the four authorized sourceworktree files against the current branch, the committed `HOURLY_VARIABLE` feature, the source mappings, period validation, pension basis and rounding path. The sourceworktree is an older snapshot; its broad file versions were not copied over the integration implementation.

## 3. Role Matrix

Not applicable: this is a service/preflight calculation change. No role, tenant scope or authorization behavior changed.

## 4. Functional Results

- Full-period on-call hourly wages continue to use only released `WORK` entries mapped to `PAYFULL02_VARIABLE_REGULAR_WAGE` with `HOURLY_RATE_X_HOURS`.
- The source provider continues to derive the hourly pension basis from the effective hourly rate, full-time hours and released paid hours, without inventing a fixed monthly salary.
- Valid composite partial-period tax inputs retain the partial-period PAYFULL02 composition.
- A partial source labeled `MONTH` is now rejected during read-only eligibility inspection.

## 5. Negative/Security Results

The malformed partial-period source returns `SUPPORTED_REGULAR_WAGE_INPUT_UNAVAILABLE` before creating a source snapshot, Payroll run or calculation input. No authorization, RLS, tenant or secret boundary changed.

## 6. Mobile/Responsive Results

Not applicable; no UI changed.

## 7. Data/DB Readback

No database connection, write, migration or readback was performed. All new regression coverage uses local test fixtures.

## 8. Quality Gates

- Focused Payroll calculation, source-provider and CAO tests: **87 PASS**.
- Focused pension-rule tests: **9 PASS**.
- Root TypeScript checks across configured workspaces: **PASS**.
- HR i18n validation: **PASS**, 43 namespaces with matching NL/EN keys.
- Full `npm test`: HR **4,143 PASS / 8 SKIP**, Control **11 PASS**, Payroll Rules NL 2026 **61 PASS**; total **4,215 PASS / 8 SKIP / 0 FAIL**.
- `git diff --check`: PASS; changed source files contain no conflict markers.
- Vitest emitted happy-dom diagnostics for unsupported `blob:` iframe URLs; the suite exited 0 and all assertions passed.

Historical comparison: the earlier 4,199 PASS / 8 SKIP result was a root-workspace total (HR 4,127, Control 11, Payroll Rules 61). The earlier 4,143 result was HR Suite only. The current root total is 4,215 because HR now has 16 more passing tests; the other workspace totals are unchanged. No test workspace exclusion caused the earlier apparent 56-test difference.

## 9. Fixed During Run

- **ID:** PAY-PERIOD-01.
- **Module/route:** `apps/hr-suite/lib/payroll/employee-payroll-calculation-service.ts` preflight.
- **Persona:** Not applicable.
- **Symptom:** a partial wage using `timePeriod=MONTH` was eligible and could select the partial-period rule package.
- **Classification:** source-period validation defect.
- **Technical root cause:** `MONTH` was considered supported whenever `fullPeriod` was any boolean; partial package selection used the same permissive rule.
- **Why previous tests missed it:** the positive table-driven test incorrectly treated `MONTH` with `fullPeriod=false` as a valid partial period.
- **What changed / fix:** require `MONTH` only with `fullPeriod=true`; partial periods require a parsed composite period. Renamed the helper to `isCompositeRegularWage` to match that contract.
- **Files:** calculation service and its test. No migrations.
- **DEV data/configuration changed:** no.
- **Regression/retest:** new read-only negative preflight test; focused suite and complete root suite pass.
- **Downstream areas rechecked:** Payroll source, CAO calculation, pension rules and full workspace tests.
- **Security/privacy impact:** none; invalid inputs now fail before calculation writes.
- **Behavior:** restores the intended partial-period contract; not a new payroll feature.
- **Commit SHA:** this change is in the local commit that contains this report; its full SHA is recorded in the phase-four handoff.
- **Prevention lesson:** a partial period must carry explicit composite tax-period segments, not a whole-month label.

## 10. ENVIRONMENT-GATED

No hosted persona, database or deployment acceptance was attempted. No hosted PASS is claimed.

## 11. PRODUCT DECISIONS

The existing committed Jantje/Mars helper is fixture-specific, labels legal/fiscal status `OPEN`, and is not part of this change. The sourceworktree's uncommitted Jantje/Mars edits were not copied. Those edits refer to a synthetic TEST arrangement and do not validate its rates, franchise, provider or legal applicability.

## 12. NOT FIXED

- Partial-month pension allocation remains blocked by `PENSION_PARTIAL_MONTH_PRORATION_UNVERIFIED`; the exploratory mid-period scenario also reported `INCOME_RELATIONSHIP_TIMELINE_GAP`. Keep this fail-closed until the source/timeline and proration contract are validated.
- **C34:** preserve the local Focus resource and `output/wvp01/`. Review modified `docs/AA/AA-CURRENT.md`, `AA-NEXT.md`, `AA-OPEN.md`, `AA-REL.md`, `docs/delivery/CURRENT_CONTEXT.md`, `IMPLEMENTATION_STATUS.md` and `LIQUIDHR-CONSOLIDATIE-34-FINAL-RELEASE-20261101.md` against the original hosted provenance before carrying that evidence forward.
- **PMUX:** review `PMUX-04-20261021-TEST-ACCEPTANCE.md` plus unique `PMUX-04R4-ROLE-SWITCHER-INDEX.md` and `PMUX-04R8-20261022-BROWSER-RESULTS.md`; the addenda mention migration repair and CLI-auth side effects.
- **PAYD1:** review unique `docs/quality/acceptance/runs/PAYD1-INTEGRATION-READINESS-01-20261022.md` before integrating its readiness claims.
- **Stash 2:** inspect `apps/hr-suite/app/(dashboard)/payroll/runs/actions.ts` and `apps/hr-suite/lib/salary-structures/service.ts` before deciding whether their older changes add behavior. `liquid-hr-source-provider.ts` diagnostics are superseded by the current source-read failure handling; `next-env.d.ts` is generated.
- **Stash 3:** `scripts/start-test-worktree.ps1` and `docs/delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md` add `-BsnAcceptance`, but the script also removes dependency preflight checks. Rework narrowly if needed; do not import the stash version as a whole.
- **Stash 5:** `apps/hr-suite/app/(dashboard)/employees/[employeeId]/employments/[employmentId]/salary-actions.ts` is a data-specific PAYDATA-02 source correction and is not general UI functionality. Old `settings/payroll/pension/{actions.ts,page.tsx}` is superseded by `/payroll/arrangements`. Historical evidence `PAYCASE-03B-20261016.md` and `PAYTEST-SETUP-01B-20261016.md` needs fact checking. Old migrations `20261017090000`, `20261017110000`, `20261017130000` correspond to current later versions `20261017063451`, `20261017072011`, `20261017075639`; do not reintroduce those IDs.
- **Stash 6:** the older code snapshot is not a bulk integration candidate. Its four absent migration files map to later current IDs: `20261008062900` → `20261010125613`; `20261008161100` → `20261008162746`; `20261008163200` → `20261008162923`; `20261010120000` → `20261010130013`. Preserve the current migration history.
- **Stash 8:** retain the four PAYLAB source-evidence files for provenance review: `tmp/nl2026-oracle-recheck.json`, `tmp/paylab03-sources/bijlage_rekenvoorschr_voor_geauto_loonadm_pdf_lh991b61fd.pdf.txt`, `handboek-loonheffingen-lh0221t61fd.pdf.txt` and `rekenvoorschriften_voor_geautomatiseerde_loonadministratie_lh991z62fd.pdf.txt`.
- **Stash 10:** `docs/quality/acceptance/runs/BRAND01-FINAL-CLOSEOUT-20261012.md` and its brand decision remain open for review.
- **Stash 11:** `docs/quality/acceptance/runs/APIAI-09-20261012-TEST-RELEASE.md` and `apps/hr-suite/public/model/` assets remain unverified. The missing assets are 17 named model photos under `01_portraits`, `02_office-work`, `03_meetings-coaching`, `04_commute-arrival`, `05_home-remote`, two model reference sheets and `public/model/README.md`; the brand-logo assets are already present. Require usage/source approval before integrating.
- **Jantje/Mars:** preserve the five uncommitted sourceworktree paths (`pension-arrangement-service.ts` and test, employment pension page, EN/NL employment messages) in that original worktree. They are fixture-only and legal source status is open; the current branch’s separately committed helper is already gated and was not changed here.
- Preserve `next-env.d.ts`, Focus resources, `output/wvp01`, `.tool-home` caches, all stashes and all worktrees. No cleanup occurred.

## 13. LESSONS/PATTERNS

The prior inventory mistook a stale, dirty sourceworktree for missing functionality. Check the current branch history and behavior before copying. For partial tax periods, validate the period label and completeness together. Preserve the pension proration guard when the source evidence does not establish the result.

## 14. Commits/Remote Head

Base integration HEAD: `ef40abbc909cc1329a901251843ff28f227e3940`. Feature commit already present: `6f26f352e7a39d22e15c673fffeb4bd650df7f6b`. One local phase-four commit contains the validator fix, regression and evidence. No GitHub push, merge, database write or Vercel deployment.

## 15. Final Verdict

**GREEN** for the local Payroll calculation/source validation and complete root test suite. **HOLD** for partial-month pension semantics and unvalidated Jantje/Mars fixture evidence. No remote release is claimed.
