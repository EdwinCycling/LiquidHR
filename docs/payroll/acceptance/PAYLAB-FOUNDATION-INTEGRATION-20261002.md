# PAYLAB00–04 controlled integration handoff — 2026-10-02

**Status: CODE/TEST GREEN; integrated authenticated browser acceptance ENVIRONMENT-GATED. The branch is not yet fully merge-ready.**

This handoff integrates the already accepted Payroll Lab foundation into the current LiquidHR main baseline. No Payroll implementation was restarted. No push, merge to main, version bump, deployment, Core/Control schema change, or remote migration apply was performed.

## References and transferred history

- LiquidHR main / `origin/main` baseline: `cb73260ff0cd83d19fa29e44c9f0b93749fb10af`, application version `1.20260928.1`. The TEST release is READY; the separate LiquidHR security-acceptance track remains OPEN. The TEST release contains no Payroll-foundation code.
- The required start-time remote check confirmed that baseline. The final `git ls-remote` refresh could not authenticate (`SEC_E_NO_CREDENTIALS`); the local `origin/main` ref remains at the baseline, but a remote advance after the initial check cannot be excluded. Fetch and compare `main` again before any later merge decision.
- Payroll source checkout: `Code`, branch `work/paylab00`, HEAD `e4e8f009e681f7bbcfade069ed1b229ae05d4761`. PAYLAB04 implementation and actual tested code commit: `35c624acd7a7a64eeb2422334946a2f5e9731e7e`, an ancestor of that HEAD. Later source HEAD records acceptance/documentation, not additional tested implementation.
- Latest AA-documentation branch was read at `b0956d0542477b8b5866b723decbfb480b447b93`; it was not merged.
- Integration branch: `integration/payroll-foundation-20261002`, based on the exact main SHA above. Integrated code commit: `2cba7457d57ce41d941ef482117559bbe9319946` (documentation handoff follows it).
- Seven source commits were selectively transferred, without a branch merge or blind cherry-pick: source `5ac6060`, `f213722`, `1918a7b`, `5d7e9fc`, `ab2e1d5`, `35c624a`, `e4e8f00`; integration commits `cf6e912`, `10663bc`, `9c0dcdc`, `f9c8d1f`, `5224c2d`, `3982d95`, `61462be`.
- The source checkout already had tracked generated-file drift in `apps/hr-suite/next-env.d.ts` and untracked `.temp/` and `tmp/` content. These were not copied, cleaned, or committed.

## Integration choices and boundaries

There were four shared-path overlaps: dashboard `layout.tsx`, `docs/README.md`, `docs/delivery/CURRENT_CONTEXT.md`, and `docs/delivery/IMPLEMENTATION_STATUS.md`. The dashboard layout was reconciled manually: the new mainline context-selection redirect and auth/access redirects remain intact, while the single Payroll Lab entry and translated navigation labels are included behind the existing Lab capability resolver. The three central documents retain their newer mainline history and now have a dated Payroll handoff at the top.

`.env.example` from the source branch was deliberately excluded. No protected environment file was read, copied, printed, or modified. No Docker, container, or WSL was used. Existing employment/provider contracts were compatible; no Core or Control adaptation was needed. The one-time comparison of committed, staged, unstaged, and untracked paths against the exact baseline found no Core migration or Core Supabase-config delta. The regular unit test no longer embeds a fixed branch SHA; the exact-base comparison remains recorded here as integration evidence.

The Control app is unchanged. All Payroll Lab SQL stays under `apps/hr-suite/lib/payroll/supabase/migrations`; the newer Core migration lineage present on main remains untouched. No employee, employment, salary, or CAO source data was changed.

| Area | Integration result |
|---|---|
| `packages/payroll-engine` and `packages/payroll-rules-nl-2026` | Existing engine, Decimal behavior, trace contracts, GC-NL-001, and NL-2026 package transferred unchanged; regression results below. |
| HR Payroll Lab app, routes, and UI | Existing protected calculation/component routes and history links transferred. One sidebar entry is resolved through the existing Lab capability and administration context. Mainline context-selection and auth redirects are preserved. |
| Component library / persistence | 24 SYSTEM definitions and append-only, scope-bound CUSTOMER_FORK drafts retained; only the isolated Payroll Lab database has these tables. |
| Core source adapter | `LiquidHrPayrollSourceProvider` and the existing employment service contract are compatible; no duplicate adapter or Core query/write was introduced. PAYLAB01 live authenticated read remains a documented environment gate. |
| Supabase migrations | Existing PAYLAB00/PAYLAB04 Lab migration lineage retained; no migration re-run. No Core migrations/config or Control migrations changed. |
| LiquidHR Control | App and migrations unchanged; CONTROL02 IKV ownership/final contract remains a separate dependency. |

## Existing Payroll acceptance and Lab readback

PAYLAB04 retains one Payroll Lab sidebar entry with **Berekeningen** and **Salariscomponenten**, the 24 SYSTEM component definitions, historical run links/traces, and scoped detached customer drafts. PAYLAB04 source-branch acceptance includes desktop and mobile evidence; that evidence does not substitute for testing the reconciled integration branch.

The separate Payroll Lab project is `LiquidHR-Payroll-Lab` (`jhgeriucbkfarxiudzfy`). Read-only migration history contained:

| Remote version | Registered name | Local migration file | Result |
|---|---|---|---|
| `20260930125822` | `20260930100000_paylab00_isolation_foundation` | `20260930100000_paylab00_isolation_foundation.sql` | Present; not reapplied |
| `20261001155314` | `paylab04_customer_component_versions` | `20261001153005_paylab04_customer_component_versions.sql` | Present; tool apply-time registration retained |

Read-only run readback confirmed the accepted deterministic values and hashes:

| Case | Run ID | Engine / composition | Input SHA-256 | Result SHA-256 | Readback |
|---|---|---|---|---|---|
| Synthetic M0 | `3d83c8ca-2ebe-47f7-9735-76e7377168d7` | `0.2.0` / `RPC-GC1-V1` | `d751c32f1e54b6bbed64eec7314340b6c7a247a79e5a2792144068c19ce87854` | `f23fa646764176becc9bb78cacba1e3909b3640f97103ae6386168ee6ef61acd` | `SUCCEEDED`; 9 results, 1 trace, 7 PASS controls; net `3175.00`, employer cost `4910.00` |
| NL-2026 | `06f7a7ff-fc8f-4ffe-aeb6-a9aed10f98ae` | `0.2.0` / `NL-PAYROLL-2026:2026.1` | `47246b1f3e7037a11eb7ddd68303a9ed1625e5c62cf3fc4e4469d4833ff6c17a` | `a2995a7af2a6b1876f5b5ccb21fb5db04a7f4a2ddfe190699cdda9f871e41cc5` | `SUCCEEDED`; 4 results, 1 trace, 4 PASS controls; gross/taxable `4000.00`, tax `818.67`, net `3181.33` |

The corresponding NL input also records its package/composition version and source hash `6e4e9e1c2d51eb4b06e28fc226a19a413b314b66c4cb7231b40d26be83c13d0c`. There is no standalone general SYSTEM-package hash in the input schema. Existing readback confirmed two customer-component drafts; the browser-context Jupiter fork remains `CUSTOMER_FORK`/`DRAFT`, with package hash `17ea6e7b7caa736c91f76ef23cbe8410d77d43a2d6c09d20038faa39514cc876` and definition hash `429d7e673b661cdfcf64843e300e97324898d790f1af8099bb0356137ad0bbac`. The separate synthetic live-test draft is not treated as customer data.

Hashes are recorded per stored run. No comparison was made against earlier M0 values from engine `0.1.0-m0`, since engine versions differ.

## Verification and independent review

- Payroll engine and NL rules regression: **3 files, 44 tests passed**.
- Relevant HR regression selection, including Payroll Lab, Payroll import, component navigation, active contexts, capability route, and the two inherited CONTROL01 contracts: **33 files passed, 3 skipped; 196 passed, 3 skipped**.
- TypeScript: all workspaces passed.
- ESLint: passed with zero errors and 7 warnings in unchanged test files.
- NL/EN i18n parity: passed, 41 matching namespaces.
- Production Next build: **308/308 routes** generated. Direct Next CLI was used without invoking a wrapper that loads protected config.
- Production browser-asset marker scan: **152 assets passed**; a negative control confirmed the marker detector. Exact secret-value comparison was not run because that would require reading protected config.
- `git diff --check` passed. Exact-base Core migration/config path checks were empty.
- Independent LUNA MAX code/security review found no actionable defect in auth/context, tenant/HR-group/Lab scope, Core/Control boundaries, source adapter, historical run lookup, secret isolation, or the dashboard reconciliation. It identified a fixed-SHA unit-test issue and stale milestone/central-document gaps; the brittle assertion was removed, and dated status entries plus this report supersede the stale milestone assignment.

The integration branch has **not** had an authenticated desktop or mobile browser session. No app listener existed on ports 3000–3002, and protected config was not loaded into this checkout. This is an environment gate, not a passed browser result. PAYLAB04's earlier source-branch screenshots and browser acceptance are preserved separately.

## Demonstration and availability

- **Previously demonstrated on the accepted source branch:** M0 (`3175.00` net; `4910.00` employer cost), NL-2026 (`4000.00` gross; `818.67` tax; `3181.33` net), component library and customer-fork draft behavior, with desktop/mobile evidence in the PAYLAB04 acceptance materials.
- **Current integration branch:** production build and automated route/scope regressions pass. Integrated authenticated UI, context redirect interaction, historical deep links in a live session, fork create/readback, and the 390px layout have not yet been visually/browser accepted.
- **TEST and future deployment:** neither contains this Payroll integration. Version bump, push, main merge, and deployment were outside this handoff and were not performed.

To close the candidate acceptance gate before any later merge decision, run the existing secure Test HR Admin flow against this exact branch. Verify the single sidebar link and both tiles, context/auth redirects, both saved historical runs and traces, scoped detached fork create/readback, browser console, and desktop plus 390px mobile layout. Do not use the source checkout's browser evidence as proof for the candidate. The separate LiquidHR release security acceptance remains OPEN.

## CAO-BENCH02 first implementation slice prepared (not implemented)

The next bounded slice is the versioned arrangement assignment/composition contract only. It should define:

1. Versioned `ArrangementPackage` metadata and version/effective dates; per-administration `AdministrationArrangementAvailability`; one effective-dated primary `PackageAssignment` per synthetic source employment; and immutable, hash-pinned `CalculationCompositionSnapshot` resolving the selected arrangement version.
2. Exactly one primary arrangement per employment and selection only from packages available to that linked administration. Extra pension/fund assignments remain a later compatible extension. Resolve the applicable package version by effective date; do not rewrite historical snapshots.
3. Keep executable SYSTEM rules in reviewed static registries. Do not store or execute rules from database text. Use synthetic fixtures until source ownership and the Core mapping contract are decided. No employee-ID-specific calculator branches.

Target cases are two Kinderopvang 2025–26, two Retail Non-Food 2026–27 Mode, two `LHR_DEMO_OPEN_BANDS_2026`, plus one CEO free-negotiation case under the company policy. Open-band midpoint and compa-ratio are company test policy using genuine public January/July 2026 A–J bounds. Metalektro-HP remains a separate applicability-only fixture and is not a third CAO payroll run. Start with September 2026 snapshots and test the 2026-10-01 salary/roster boundary, Frank's employment end, and one explicitly chosen Piet employment for the simple path. Lisa's manager relation does not establish Payroll permission; Eric's on-call case has no salary and is readiness-only.

Before building calculations or changing data, prove PAYLAB01's live read-only Core source path and decide ownership/mapping of `labor_condition_set_id`; confirm the final CONTROL02 IKV contract separately. No package import, new CAO calculation, employee-data edit, or Core/Control migration is part of this preparation.
