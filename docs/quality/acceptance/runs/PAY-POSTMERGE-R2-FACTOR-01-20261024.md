# PAY-POSTMERGE-R2-FACTOR-01 — Retail R2 part-time reconciliation — 2026-10-24

**Verdict: PARTIAL.** The local R2 salary/hour reconciliation is repaired and the targeted regression gates pass on the feature branch. The production build is still OPEN because Next.js fails during prerendering of `/_global-error`. No merge, push, migration, shared-database write, deployment, shared TEST finalization, or historical PDF/run mutation was performed.

| Item | Evidence |
| --- | --- |
| Repository | `EdwinCycling/LiquidHR` |
| Verified `origin/main` baseline | `630df89c84bc2be4774072d387ecb5dc7df10f91` |
| Feature branch | `work/pay-postmerge-r2-factor-01-20261024` |
| Tested code commit | `cee92fa5efaa801e8ce94f42d2c2e78a2c276857` |
| Build comparison HEAD | Feature `c8c066b2e1e9cecccb5b6870b528798b9ea132f5`; baseline `630df89c84bc2be4774072d387ecb5dc7df10f91` |
| Test environment | Local in-memory fixtures / PGlite lifecycle harness only; no shared database access |

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
| Next.js production build with Webpack — feature HEAD | OPEN — compilation and TypeScript completed; prerender failed at `/_global-error`, `chunks/88873.js:335:15814`, digest `3076941538` |
| Next.js production build with Webpack — unchanged baseline | OPEN — same `/_global-error` / `useContext` failure at the same bundle offset on baseline Node 22.14.0 and Node 24.22.1; digest `489588194` |

The build-generated Focus widget file was restored to its branch version during the original feature acceptance. This closeout invoked the Next CLI directly and did not regenerate it. `next-env.d.ts` remains byte-identical on baseline and feature (SHA-256 `1b59d4c6b83807db275d43f3cf2cc8e9323f465fab764eea091cc5becd5bad37`).

## Build gate investigation — 2026-10-24

The exact unmodified `origin/main` baseline was built in a new detached checkout at `630df89c84bc2be4774072d387ecb5dc7df10f91`. Its `package-lock.json` Git blob is `cdd20c601e5956b419b96d7a346b36ba5b1ce14b`, identical to the feature branch. Both builds used Next.js `16.4.2`, React and React DOM `19.2.9`, Scheduler `0.27.0`, and the same single deduped React installation. The first baseline build used Node `22.14.0`; the bundled Node `24.22.1` rerun reproduced the same failure and digest, so the install warning that `@sparticuz/chromium` requires Node `22.17+` does not explain this failure.

Baseline Webpack compilation completed in 63 seconds and TypeScript in 106 seconds. Feature compilation completed in 61 seconds and TypeScript in 21.1 seconds. Both reached static page generation (`0/339`) and then failed on the generated `/_global-error` page with `TypeError: Cannot read properties of null (reading 'useContext')`. The baseline stack is `apps/hr-suite/.next/server/chunks/88873.js:335:15814` with digest `489588194`; the feature stack has the same chunk offset and message, with digest `3076941538`.

The module evidence points inside Next.js. Both generated `app-paths-manifest.json` files map `/_global-error/page` to `app/_global-error/page.js`, while neither source tree contains `app/global-error.tsx`. The failing function matches Next `dist/client/components/layout-router.js` `OuterLayoutRouter`, whose source calls `useContext(LayoutRouterContext)`. The corresponding generated module `78886` has the same factory SHA-256 on both builds (`9336ac2c8bb066d0a3b3490961e6c78a0ba141f2842dc946315043d7af891360`). Its React import wrapper `71277` also matches (`c54c7d61344bfc0dc94098b1780f0b669df89ee980aeaf3ef81c14c67d236bcb`) and resolves through Next's `vendored["react-ssr"].React`. The installed Next `layout-router.js` source hash is identical on both checkouts (`7887177c4d5c69911df9f24dbca2306cb8f4e193d3495165a5341a30a6899a4c`).

The feature diff changes no Next config, root layout, package manifest, or lockfile. The failure is therefore an independent baseline Next.js app-router prerender blocker, not a regression from the R2 Payroll change. The evidence identifies the failing framework module path but does not establish why the vendored React binding is null in this prerender; no Payroll workaround, dependency upgrade, global error layout edit, or buildguard change was made. The production build gate remains OPEN.

After the comparison, the 8 targeted Payroll test files were rerun at feature HEAD `c8c066b2e1e9cecccb5b6870b528798b9ea132f5`: **87/87 passed**. The workspace TypeScript check also passed. No source or shared system was changed by the build comparison.

## Remaining source and release questions

- Confirm the real employer's Retail Non-Food / PFD applicability and business scope.
- Bind the applicable fiscal profile and IKV, pension arrangement and participation, employer contribution decisions, and opening cumulative balances before a real R2 gross-to-net flow.
- Integrate and re-run this branch change through the separately authorized main/release process; no such operation is included here.

Existing FINALIZED history and PDF artifacts were not changed. All R2 inputs in this acceptance are synthetic; the source gaps above remain open for real payroll use.
