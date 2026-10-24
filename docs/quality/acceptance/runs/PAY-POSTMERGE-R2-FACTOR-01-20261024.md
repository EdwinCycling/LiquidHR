# PAY-POSTMERGE-R2-FACTOR-01 — Retail R2 part-time reconciliation — 2026-10-24

**Verdict: PARTIAL.** The local R2 salary/hour reconciliation is repaired and the targeted regression gates pass on the feature branch. The production build is still OPEN because Next.js fails during prerendering of `/_global-error`. No merge, push, migration, shared-database write, deployment, shared TEST finalization, or historical PDF/run mutation was performed.

| Item | Evidence |
| --- | --- |
| Repository | `EdwinCycling/LiquidHR` |
| Verified `origin/main` baseline | `630df89c84bc2be4774072d387ecb5dc7df10f91` |
| Feature branch | `work/pay-postmerge-r2-factor-01-20261024` |
| Tested code commit | `cee92fa5efaa801e8ce94f42d2c2e78a2c276857` |
| Test environment | Local in-memory fixtures / PGlite lifecycle harness only |

## Reconciliation

The regression case uses a stored full-time monthly salary of €2,542.50, 24/38 weekly hours, stored part-time factor `0.6316`, and contractual part-time salary €1,605.79. The former check multiplied the rounded factor by full-time salary and rejected this valid roster/salary pair. The fix calculates salary from exact decimal hours and rounds HALF_UP to cents. It separately verifies that the stored factor is the four-decimal HALF_UP representation of the hours ratio. Contract hours, effective source checks, scale validation, CAO indexation, source hashes, authorization and SOURCE_GAP guards remain in the existing flow.

The independent R2 Retail slice remains base €1,605.79 + one overlap-safe premium of €15.44 = gross €1,621.23. The general Payroll calculation correctly returns `SOURCE_GAP`, with no run and null gross/net, while required tax, pension, employer and cumulative sources are absent. No R2 net is asserted or manufactured. R1 remains gross €4,767.20, net €3,461.38 and employer cost €6,545.86.

## Regressions and verification

The targeted 8-file Vitest run passed **87/87 tests**. It covers R2 24/38, R1 38/38, mismatched factor, mismatched part-time salary, conflicting full-time norm, zero hours, overlap-safe/no-double premium, missing source references, deterministic source hashes, lifecycle, and authorization negatives. The initial R2 integration assertion failed before the fix with `UNSUPPORTED` instead of the expected source-gated result.

| Gate | Result |
| --- | --- |
| Targeted arithmetic, oracle, source-contract, lifecycle and authorization tests | PASS — 8 files, 87 tests |
| TypeScript (`npm run type-check --workspace @liquid-hr/hr-suite`) | PASS |
| i18n | PASS — 43 namespaces with matching NL/EN keys |
| ESLint on changed TypeScript/TSX files | PASS |
| `git diff --check` | PASS |
| Next.js production build with Webpack | OPEN — compilation and TypeScript completed; prerender failed at `/_global-error` with `TypeError: Cannot read properties of null (reading 'useContext')` |

The build-generated Focus widget file was restored to its branch version; `next-env.d.ts` is unchanged. The build failure is reported as a gate, not treated as a reconciliation failure.

## Remaining source and release questions

- Confirm the real employer's Retail Non-Food / PFD applicability and business scope.
- Bind the applicable fiscal profile and IKV, pension arrangement and participation, employer contribution decisions, and opening cumulative balances before a real R2 gross-to-net flow.
- Integrate and re-run this branch change through the separately authorized main/release process; no such operation is included here.

Existing FINALIZED history and PDF artifacts were not changed. All R2 inputs in this acceptance are synthetic; the source gaps above remain open for real payroll use.
