# PAYCALC-REAL-01 — acceptance record

Status: **PARTIAL / HOLD — PayrollCycle server foundation only**
Baseline: `origin/main` / `main` SHA `f7db482b19b81d9c5aa5517c66394faa5f628e1b`
Feature branch: `work/PAYCALC-REAL-01-20261013`

## Delivered in this slice

- `payroll_periods` remains the one-per-administration-and-period cycle record. Opening is idempotent and uses a compare-and-set from `DRAFT` to `OPEN`.
- The Payroll Professional server service can list the current period's individual runs and reconcile one authorized employee/employment against a fresh Core source snapshot.
- The worklist projection keeps technical run status separate from the existing `CONCEPT` / `REVIEWED` / `FINALIZED` lifecycle, groups by employment, and compares the current source hash and version vector with the latest revision.
- A late source change leaves a finalized business status intact and signals that an explicit correction successor is needed. The projection never changes a run or lifecycle event.
- Source selection can address one specific confirmed employment when an employee has multiple employments. An omitted employment remains ambiguous and fails closed.
- No ESS, payslip-dossier, historical-run, remote TEST-data, schema-apply, merge, or deployment changes were made.

## Calculation coverage and blockers

- No generic Core-backed salary amount is calculated or persisted by this slice. The current Core source adapter explicitly emits `taxProfile: SOURCE_GAP / NO_ACCEPTED_SOURCE_CONTRACT`; no supported general mapping supplies the NL rule package's effective fiscal profile and regular-wage inputs.
- `NL-PAYROLL-2026@2026.1` remains a narrow, versioned engine package. Its official regular-wage formula and tested anchors do not establish broad Dutch payroll coverage, multi-IKV allocation, cumulative-year inputs, or all gross-wage, pension, employer-cost, and special-situation categories.
- The server worklist exposes a category matrix: NL 2026 regular-wage withholding is bounded to profiled inputs; Core fiscal profile and PFZW monthly allocation are `SOURCE_GAP`; multi-IKV is partial; cumulative tax, variable/non-regular wage, and allowances/reserves are unsupported; employer social-cost assumptions remain test-only.
- PFZW monthly allocation and cent-rounding remain `SOURCE_GAP`; no pension amount or zero was inferred.
- Cycle freshness is recalculated on an explicit server reconciliation request. A persistent stale queue, Core event subscription, background scheduling, generic persisted calculation flow, review/finalize UI, and explicit correction-successor service remain unimplemented. No permanent worker or Vercel Docker process is assumed.
- Calculation-request idempotency/concurrency, automatic stale persistence, and recalculation revisions are not implemented. Only period opening uses the existing unique constraint and compare-and-set for retry safety.
- These are blockers to full PAYCALC-REAL-01 acceptance; this record does not claim production-ready Dutch payroll.

## Existing TEST history — read-only verification

- Lisa's existing October 2026 run remains `SUCCEEDED`, `FINALIZED`, revision 5.
- Jaap's existing October 2026 run remains `SUCCEEDED`, `CONCEPT`, revision 3.
- Frits's historical October 2026 run remains `SUCCEEDED`, `FINALIZED`, revision 4. Earlier September/October runs and revisions remain separate persisted records; previews were not counted as persisted evidence.
- These checks were read-only. No TEST rows, lifecycle events, or migrations were written or applied.

## Verification

- Targeted Vitest: cycle projection, cycle service, and Core source provider — **26 passed**.
- CONTROLLED Payroll release gate: `apps/hr-suite/lib/payroll` — **340 passed, 3 skipped**; payroll-engine — **18 passed**.
- TypeScript checks passed for hr-suite and payroll-engine (`--incremental false`).
- Changed Payroll files passed targeted ESLint with no remaining warnings.
- The first runner attempt failed before test collection on a Windows sandbox-temp rename (`EPERM`). Re-running with a task-owned temp directory and two Vitest workers passed.
- The final CONTROLLED local Payroll gate passed. Broader persisted/review/finalize acceptance remains **OPEN** because this slice made no TEST writes. The feature commit SHA is recorded in the delivery response.
