# PAY-W04-SOURCE-READINESS-01 — acceptance 24-10-2026

## Result

**PARTIAL.** The existing read-only Payroll source provider already binds scoped, effective-dated source rows to versions, a version vector, a hash, and explicit `SOURCE_GAP`/`UNSUPPORTED` gaps. W04 found and fixed one concrete hole in that contract: an impossible calendar date could pass the provider's shape-only `YYYY-MM-DD` check. Synthetic source and R1/R2 regression tests, TypeScript, lint, and the complete root production build pass.

This does not establish current employee or employer source values, close the regular R2 source gaps, or prove legal payroll compliance. No live Core/Payroll read was made in this wave, so actual R2 source readiness remains **NOT VERIFIED** and processing remains **HOLD**.

## Provenance and boundaries

- Repository: `EdwinCycling/LiquidHR`
- Branch: `work/pay-w04-source-readiness-01-20261024`
- Base: verified `origin/main` `630df89c84bc2be4774072d387ecb5dc7df10f91`
- Code commit: `fe2663cac940985a0b601eb7c63c17a4cd11774c`
- Worktree: `PAY-W04-SOURCE-READINESS-01`
- The W02 Draft PR #48 and the separate W01/W03 worktree were not changed. This branch does not include W02 commits.
- No remote reads or writes, migrations, live payroll calculation or run, saved finalization or artifact, push, merge, or deployment was performed. Synthetic local calculations in the existing regression tests were run in isolation.

## Existing source chain and readiness

The provider builds `payroll-source-contract-v1` into the hash-bound source snapshot. References identify source type and row, tenant/HR-group/administration/employee/employment/IKV scope, version components, and effective interval. The source version vector is checked against each reference. Missing or inconsistent required inputs remain explicit gaps; the calculation service fails closed rather than turning a gap into a successful net result.

For this inventory, **AVAILABLE** means the source contract/reader exists; **VALID** means a supplied synthetic record passes scope, version, and effective-date checks; **AMBIGUOUS** means conflicting candidates are present; and **MISSING** means a required input is absent and yields `SOURCE_GAP`. These are evidence states, not substitutes for a live source read. Historical K2/Frits reports contain an **AMBIGUOUS** salary-read record for that separate case. Actual regular R2 is **NOT VERIFIED** because no live source was read. The synthetic Retail R2 case explicitly exercises **MISSING** fiscal input and no complete payroll-owned result.

| Source | Existing contract and synthetic evidence | Actual regular R2 status from this wave |
| --- | --- | --- |
| Employee, employment, contract, role/function, hours, FTE, salary | Contract/reader **AVAILABLE**; supplied synthetic timelines **VALID** when versioned and effective. Retail R1/R2 source tests pass. | **NOT VERIFIED**: no live source read. Do not select a real contract or salary from this branch's fixture. |
| IKV and fiscal declaration, including tax credit | Contract/reader **AVAILABLE**; scoped/versioned synthetic K2 evidence **VALID**. Missing/ambiguous links and versions become **MISSING/AMBIGUOUS** gaps. Snapshot tests exclude BSN and other direct person identifiers. | **NOT VERIFIED / MISSING (`SOURCE_GAP`) when absent**: no actual R2 declaration or IKV read. BSN is not copied into the calculation snapshot by this source path. |
| CAO and effective applicability | Contract/reader **AVAILABLE**; supplied versioned synthetic rule inputs **VALID**. Retail R2 gross source/oracle pass. | **NOT VERIFIED**: synthetic rule provenance does not confirm a real employer's sector, activity, scope, or applicability. |
| Pension duty, assignment, arrangement and participation | Contract/reader **AVAILABLE**; supplied versioned K2 pension evidence **VALID**; tests cover **MISSING** assignment. | **NOT VERIFIED / MISSING (`SOURCE_GAP`) when absent**: real participation and plan applicability were not confirmed. |
| Employer classification, employer premiums and Whk | Contract/reader **AVAILABLE**; synthetic effective-dated configuration/hash path **VALID** and blockers explicit. | **NOT VERIFIED / MISSING (`SOURCE_GAP`) when incomplete**: no real employer decision, Whk assessment, or approved premium set was read. |
| Historical cumulatives/opening balance | Contract/reader **AVAILABLE**; synthetic versioned opening path **VALID**; absent/invalid required balances fail closed. | **NOT VERIFIED / MISSING (`SOURCE_GAP`) when required and absent**: no paid cumulative or current Payroll opening snapshot was read. |

`NOT_APPLICABLE` is not inferred from missing data. The wave did not establish that any of the above domains is inapplicable to a real R2 employee. A domain with no supplied source remains a gap unless the existing contract provides explicit evidence otherwise.

The repository's earlier synthetic Retail R2 fixture is a gross-source case only: it binds its gross inputs and verifies the 24/38 schedule basis and overlap-safe premium, while fiscal profile is `SOURCE_GAP` and there is no `payrollOwned` result. Existing regression assertions also prove missing fiscal, pension, employer, and cumulative evidence cannot produce a payslip. These fixtures are technical evidence only.

Historical K2/Frits reports record conflicting salary-read evidence and unconfirmed pension, employer, IKV, and cumulative inputs for that separate case. Those reports were used as context, not as proof about a live Retail R2 employee.

## W04 code change

`source-readiness.ts` already validated calendar dates by parsing and round-tripping the date. `sourceVersionContract()` in the provider used only a regex, so a value such as `2026-02-30` could be marked `BOUND` when its lexical range appeared effective. The provider now reuses the existing strict date validator. Invalid start/end dates make the reference `SOURCE_GAP` with `SOURCE_VERSION_EFFECTIVE_RANGE_INVALID`; no source value or payroll amount is repaired or defaulted.

The change is read-only and does not alter calculation rules, fiscal or pension parameters, source schema, database, or historical snapshots. New regressions cover the pure coverage check and an end-to-end synthetic provider snapshot. Existing provider tests continue to cover tenant/employee/administration scope, version mismatch, missing and ambiguous IKV, absent tax/pension/employer sources, and opening-cumulative requirements.

## Verification

All commands ran from this isolated worktree with Node `24.22.1`, npm `10.9.2`, and the checked-in `package-lock.json` (`npm ci --no-audit --no-fund`).

| Gate | Result |
| --- | --- |
| `liquid-hr-source-provider.test.ts` + `source-readiness.test.ts` | **PASS — 40 tests** |
| Retail R1/R2 source case + Retail payroll-flow integration + K2-06 source case | **PASS — 9 tests** |
| Root `npm run type-check` across workspaces | **PASS** |
| ESLint on the four changed files | **PASS — 0 errors**; one existing unused `PayrollSetupRepository` type-import warning in the provider |
| Root `npm run build` | **PASS** — HR Suite and Control production builds; 339 and 12 static pages; Payroll client-boundary scanner, exact PDF trace checks, and build provenance passed |
| `git diff --check` | **PASS** |

The first in-sandbox dependency install and Vitest attempts encountered Windows `EPERM`; the lockfile install and local test commands were then run outside the sandbox restriction. No package or lockfile change was made. The Focus widget build artifact was restored to this worktree's original `HEAD` and is not included.

The full monorepo test suite was not run; the relevant source, K2, and R1/R2 suites above were run.

## Remaining gates and downstream dependencies

The checked-in [commercial roadmap](../../../AA/AA-PAYROLL-COMMERCIAL-ROADMAP-20261019.md) describes D0/D1/D2/F0 and does not define W04/W05/W06 identifiers. The following W05/W06 prerequisites are therefore technical dependencies inferred from this request, not claims about formally recorded roadmap gates:

- **W05 prerequisite:** authorized source-owner confirmation and scoped readback of the real contract/effective salary/hours, IKV and fiscal declaration, applicable Cao, pension duty/assignment, employer classification and approved premiums/Whk, and required paid cumulatives. Each value must retain source identity, version, validity interval, and provenance. Contradictions remain blocked.
- **W06 prerequisite:** do not build a regular R2 net/payroll acceptance on top of unresolved source gaps. First prove a complete source set without gaps against the source provider, then compare the normal calculation service with an independent oracle and re-run the relevant negative-scope and immutable-history gates. W01/W03 hosted UI/performance acceptance remains a separate Spoor A gate.

**Integration recommendation: HOLD for regular R2 processing and W02 integration; PARTIAL for W04 source-readiness.** The code and local quality gates pass, but actual sources, employer/pension applicability, legal parameter confirmation, and real cumulative balances remain open. No claim of actual payroll readiness or legal conformity is made.
