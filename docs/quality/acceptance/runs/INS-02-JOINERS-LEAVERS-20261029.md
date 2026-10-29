# INS-02 — Joiners & Leavers local implementation evidence

## 1. Executive Summary

**Result: PARTIAL.** The INS-02 code slice is implemented on the existing Draft PR #60 branch. Focused unit, contract, authorization, export, TypeScript, lint and i18n checks passed. The full repository typecheck is blocked by stale generated Next.js type files that reference absent unrelated routes. Live browser/RLS acceptance is deferred as requested; no database write, migration, merge or deployment occurred.

## 2. Coverage

- Reused the merged INS-01 Insights catalog, authorization helper, query seam, filters, report controls and CSV-safety utility.
- Added completed-month monthly employment starts/ends, employee scope entry/exit, separate termination events, KPI cards, monthly trends, authorized detail rows, filters, sorting, pagination, employee drilldown, full-range CSV, and NL/EN labels.
- Added a separate all-history reconciliation count for confirmed termination events linked to soft-deleted employments. The code does not count these as employment ends or leavers and does not derive a turnover percentage.
- No migration, database write, production/test data mutation, Vercel build or deployment.

## 3. Role Matrix

| Role | Expected access | Evidence |
|---|---|---|
| HR Admin | Existing `employee:read` plus `report-employee-department:read`; active HR-group administrations | Catalog and service authorization tests; live session not exercised |
| Direct Manager | Existing `employee:read`; active administration and current direct-team employee IDs | Catalog and service scope tests; live session not exercised |
| Employee | Denied before report-source reads | Service authorization test |

## 4. Functional Results

- Monthly employment events are counted independently from unique employees entering or leaving the authorized administration scope.
- Concurrent employment is treated as an employment change where another confirmed, non-deleted employment is active on the preceding/following day in the authorized scope.
- Employee counts are deduplicated. No first-ever-hire or rehire claim is inferred.
- Event-date organization placement is used; absent or ambiguous placement remains explicit.
- A matching termination workflow row does not increase the employment-end count. Date disagreements are separately surfaced.
- Filters affect the report metrics and rows; CSV exports the full filtered range rather than only the visible page.

## 5. Negative/Security Results

- Employee role denied before report-source access.
- HR report permission is required for the HR Admin audience; Managers remain on the INS-01 `employee:read` pattern.
- Out-of-scope administration filters, a Manager administration outside the active allowlist, truncated direct-team scope, and mismatched employee/employment visibility fail closed in service logic.
- Manager output does not expose historical direct-manager IDs outside the Manager's visible team scope.
- These are local unit/mock authorization checks; live Supabase RLS and authenticated persona behavior are not established by this run.

## 6. Mobile/Responsive Results

Not browser-tested. The report uses mobile detail cards and a desktop table with existing Insights components, but no viewport assertion was run. Hosted browser acceptance was explicitly deferred for the later joint acceptance.

## 7. Data/DB Readback

No database readback or write was performed in this run. The requirement contract records six confirmed termination events linked to soft-deleted employments; the service retains such rows as a separate all-history reconciliation measure. The live count and row-level readback remain for the later authorized TEST acceptance.

## 8. Quality Gates

| Gate | Result |
|---|---|
| Focused Vitest: query, calculation, authorization, CSV/export, report catalog, API route | PASS — 36 tests across 6 files |
| Targeted TypeScript over INS-02 and directly changed Insights files | PASS |
| Targeted ESLint over changed implementation and test files | PASS |
| NL/EN i18n check | PASS — 43 namespaces with matching keys |
| `git diff --cached --check` for the feature commit | PASS |
| Full `npm run type-check` | FAIL — generated `.next/dev/types` and `.next/types/validator.ts` reference absent absence/WVP routes; no INS-02 diagnostics |

## 9. Fixed During Run

| ID | Area | What broke | Why | Fix | Regression | Result |
|---|---|---|---|---|---|---|
| INS02-FIX-01 | Event-date placement mapping | Unassigned calculated events did not expose the contract field `placementStatus` | The placement helper returned a differently named property; earlier checks did not yet assert the response shape | Return the canonical field and use it when creating report events | Unassigned/ambiguous placement assertion; focused suite rerun | GREEN |

### Fixed-issue record — INS02-FIX-01

- **Persona:** none; pure calculation unit test.
- **Classification/root cause:** implementation contract mismatch; the helper's object key did not match the event schema.
- **Why previous tests missed it:** the targeted placement assertion was added with this slice and found the mismatch on its first run.
- **What changed/how fixed:** `organizationAtEvent` now returns `placementStatus`; `makeEvent` preserves that typed result.
- **Files/migrations:** `apps/hr-suite/lib/insights/joiners-leavers-calculation.ts` and its test; no migration.
- **DEV data/configuration changed:** no.
- **Regression/retest:** unassigned and ambiguous placement assertions; all 36 focused tests passed after the fix.
- **Downstream areas rechecked:** targeted TypeScript, ESLint, i18n, export and API route tests.
- **Security/privacy impact:** none; data scope and permission behavior were unchanged by this shape correction.
- **Behavior:** restores the new report's declared response contract.
- **Commit:** `4f413eaf497cb8302bb9b2116b0583cfeb59398e`.
- **Prevention lesson:** assert the public event shape for each placement state in the calculation tests.

## 10. ENVIRONMENT-GATED

- Authenticated HR Admin/Manager UI, direct-team scope, live RLS and the six-row reconciliation readback remain deferred to the later joint TEST acceptance.
- The Vercel project is Git-linked, but the branch's `vercel.json` sets `git.deploymentEnabled` to `false`. No Vercel deployment was listed for this branch after the push.

## 11. PRODUCT DECISIONS

- Employment starts/ends and unique employees entering/leaving scope are different measures.
- Only confirmed, non-deleted employments contribute to employment start/end measures. Confirmed termination workflow rows linked to soft-deleted employments remain an independent reconciliation measure pending validated deletion semantics.
- No turnover percentage, first-ever hire, or rehire label is inferred.
- The existing `terminations` report and permission grants remain unchanged.

## 12. NOT FIXED

- The full repository TypeScript command remains red because generated Next.js type files reference missing absence/WVP route files. Those generated artifacts and protected `next-env.d.ts` were not changed. A later clean Next type-generation/build pass can resolve or classify that unrelated state.
- No browser, live database or RLS result is claimed; those checks are intentionally deferred.

## 13. LESSONS/PATTERNS

- Reuse the INS-01 authorization and reporting seams; keep Manager employee scope and active administration enforced in the server service.
- Keep soft-deleted termination reconciliation visible without silently treating it as a confirmed employee departure.
- Local calculation and mock authorization tests establish code behavior, not live RLS or hosted acceptance.

## 14. Commits/Remote Head

- Starting branch head: `6914cc6ac904755934fd70f66e042e0064e9a496`.
- Implementation commit: `4f413eaf497cb8302bb9b2116b0583cfeb59398e`.
- Authorization-output regression-test commit: `59f5f275ef6c111a05fefee5512fe4012ba1ef1e`.
- Existing PR: [Draft PR #60](https://github.com/EdwinCycling/LiquidHR/pull/60), issue #58. After the implementation/test push it remained open, Draft and mergeable; remote head `59f5f275ef6c111a05fefee5512fe4012ba1ef1e` was verified.
- GitHub `main` at evidence time: `6ff3dfbcbb4064f59b8870a14176e746acd23ce3`.
- No second PR, force-push, merge, DB write, migration or deployment.

## 15. Final Verdict

**PARTIAL — local implementation gates pass.** The branch is ready for review on PR #60. Full repository typecheck has the unrelated generated-route failure above; hosted role/browser/RLS acceptance and the live reconciliation readback remain open for the jointly planned TEST acceptance.
