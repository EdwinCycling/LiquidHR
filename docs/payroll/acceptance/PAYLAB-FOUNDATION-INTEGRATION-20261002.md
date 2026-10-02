# PAYLAB00–04 controlled integration handoff — 2026-10-02

**Status: NOT MERGE-READY.** The Test HR Admin browser acceptance, calculations and trace/hash comparisons, 24 SYSTEM-component checks, CUSTOMER_FORK save/reopen, and negative authorization/scope probes completed. The user hard refresh restored CSS rendering: dashboard and Payroll Lab use the Next layout stylesheet, retrieved successfully (1 requested, 1 downloaded, 0 failures), and both were visibly styled on desktop and at 390 px. However, repeated Next.js client-side route changes now reproduce React Server Components runtime errors and the page-level “This page couldn’t load” screen; a full reload recovers the route, but a subsequent link navigation can fail again. CSS failure was not reproduced. The unstable client navigation leaves this acceptance NOT GREEN.

This handoff integrates the already accepted Payroll Lab foundation into the current LiquidHR main baseline. No Payroll implementation was restarted. No push, merge to main, version bump, deployment, Core/Control schema change, or remote migration apply was performed.

## References and transferred history

- LiquidHR main / `origin/main` baseline: `cb73260ff0cd83d19fa29e44c9f0b93749fb10af`, application version `1.20260928.1`. The TEST release is READY; the separate LiquidHR security-acceptance track remains OPEN. The TEST release contains no Payroll-foundation code.
- The final acceptance run fetched `origin/main` successfully. Both `FETCH_HEAD` and `origin/main` resolve to `cb73260ff0cd83d19fa29e44c9f0b93749fb10af`; no credentials were changed.
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

| Case | Run ID | Engine / composition | Source SHA-256 | Input SHA-256 | Result SHA-256 | Readback |
|---|---|---|---|---|---|---|
| Synthetic M0 | `3d83c8ca-2ebe-47f7-9735-76e7377168d7` | `0.2.0` / `RPC-GC1-V1` | `d751c32f1e54b6bbed64eec7314340b6c7a247a79e5a2792144068c19ce87854` | `ae1a740b0c1b3bad2ee07edd71fa331203f7496c0fc244a5e050530efa41c345` | `f23fa646764176becc9bb78cacba1e3909b3640f97103ae6386168ee6ef61acd` | `SUCCEEDED`; 9 results, 1 trace, 7 PASS controls; net `3175.00`, employer cost `4910.00` |
| NL-2026 | `06f7a7ff-fc8f-4ffe-aeb6-a9aed10f98ae` | `0.2.0` / `NL-PAYROLL-2026:2026.1` | `6e4e9e1c2d51eb4b06e28fc226a19a413b314b66c4cb7231b40d26be83c13d0c` | `47246b1f3e7037a11eb7ddd68303a9ed1625e5c62cf3fc4e4469d4833ff6c17a` | `a2995a7af2a6b1876f5b5ccb21fb5db04a7f4a2ddfe190699cdda9f871e41cc5` | `SUCCEEDED`; 4 results, 1 trace, 4 PASS controls; gross/taxable `4000.00`, tax `818.67`, net `3181.33` |

Comparison with the source acceptance records: NL-2026 source/input/result hashes and outputs match PAYLAB03 and PAYLAB04 exactly. The current M0 row matches the PAYLAB04 `0.2.0` recalculation (`3d83c8ca…`, input `ae1a740b…`, result `f23fa646…`). The older PAYLAB02 historical run `adc49957-55bd-40e3-82ce-2a9166988009` is engine `0.1.0-m0` with input `c4b2f80531185f60f03135b793f716635b01db49e394452cc8556448800c8088` and result `dd10e395497a290183038cc48434e1a78f5f293980d039a760463a16b9c01afe`; its differing hashes are expected and are not treated as a mismatch. There is no standalone general SYSTEM-package hash in the input schema. Existing readback confirmed two customer-component drafts; the browser-context Jupiter fork remains `CUSTOMER_FORK`/`DRAFT`, with package hash `17ea6e7b7caa736c91f76ef23cbe8410d77d43a2d6c09d20038faa39514cc876` and definition hash `429d7e673b661cdfcf64843e300e97324898d790f1af8099bb0356137ad0bbac`. The separate synthetic live-test draft is not treated as customer data.

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

## Final acceptance attempt — 2026-10-02

`git fetch origin main` succeeded and confirmed the exact baseline stated above. Next.js dev was started directly from this integration checkout on port `3010`; the server reported ready, but `/dashboard/start` failed before rendering because `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` were unavailable to this process. The missing configuration was reported by the standard app runtime; protected files were not read, copied, printed, or modified. No Git credentials were changed.

The existing browser session on `localhost:3000` was not the candidate server and showed no Payroll Lab navigation; `localhost:3001` is LiquidHR Control. Neither was used as candidate evidence. The authenticated Test HR Admin flow could not be exercised on the integration branch. Consequently, no calculation, Lab write, component fork, or authorization probe was issued during this attempt; no new browser or mobile result is claimed. The candidate server was stopped, and its generated `apps/hr-suite/next-env.d.ts` change was restored to the clean HEAD state. Independent LUNA MAX review found no code defect and confirmed this is an environment blocker; no safe supported path exists here to provide the absent config without reading/copying protected config.

PAYLAB04's earlier source-branch browser/screenshots remain valid for that source branch only. They do not close the integrated branch's browser gate.

## CSS and local TEST follow-up — 2026-10-02

The user performed Ctrl+Shift+R on the candidate at localhost:3010; the LiquidHR styles returned. I rechecked the dashboard and Payroll Lab on the integrated branch using the existing approved local TEST runtime. Protected configuration values were not read, printed, copied, or changed, and no authentication or security settings were modified.

The browser asset inventory showed /_next/static/css/app/layout.css on both pages. Bundling the observed stylesheet requested 1 asset, downloaded 1, and reported 0 failures. The stylesheet was present in document.styleSheets with 144 CSS rules. Console review found no CSS-specific warning or failed stylesheet load. Chrome’s native DevTools Network panel was not exposed by the current browser-control surface, so this is asset-inventory, successful retrieval, and console evidence rather than a direct Network-tab capture.

Visual and viewport checks on the integrated branch:

| Page | Desktop | 390 px viewport | CSS/layout result |
|---|---|---|---|
| Dashboard /dashboard/start | 1718 × 1207; styled dashboard rendered | 390 × 844; styled dashboard rendered | stylesheet loaded; document width matched 390 px on mobile |
| Payroll Lab /payroll-lab | 1718 × 1207; styled overview with exactly **Berekeningen** and **Salariscomponenten** | 390 × 844; the same two styled tiles rendered, each 356 px wide | stylesheet loaded; document width matched 390 px on mobile |

The browser-rendered stylesheet and dashboard were correct after the hard refresh. On the post-refresh route replay, Payroll Lab → Dashboard succeeded; Dashboard → Payroll Lab reproduced a Next.js runtime overlay. An earlier Calculations → Payroll Lab attempt also failed. Browser errors included “Cannot read properties of undefined (reading 'stack')” in react-server-dom-webpack-client.browser.development.js at initializeDebugInfo, “frame.join is not a function”, and “Cannot read properties of null (reading 'enqueueModel')”; the overlay said “This page couldn’t load.” The current overlay identifies Next.js 16.3.6 as “stale”. The official [Next.js version-staleness documentation](https://nextjs.org/docs/messages/version-staleness) defines that marker as meaning a newer stable release is available; it does not by itself show that browser CSS assets or local build output are stale. A Next.js dependency upgrade would be an out-of-scope version bump, so none was made. The dev-server log also reported that Fast Refresh had to perform a full reload. The page document request returned 200, and a full reload recovered the styled Payroll Lab overview, but the client-side Dashboard → Payroll Lab route still failed. This is a client/runtime navigation failure, not evidence of a missing CSS asset. Its source-level cause was not isolated; no CSS or application source change, cache deletion, rebuild, or dependency upgrade was made. While the dev server was active, Next.js generated a tracked working-tree change in `apps/hr-suite/next-env.d.ts`, changing references from `.next/types/` to `.next/dev/types/`. That generated file was not manually edited; the drift is visible in the current working tree and is not part of the integration code commit.

### Focused navigation fault isolation — 2026-10-02

On the integrated dev candidate, directly loading `/payroll-lab` rendered the overview, and directly loading `/dashboard/start` rendered the dashboard. From the dashboard, clicking the visible Payroll Lab navigation link changed the URL to `/payroll-lab` and then produced “This page couldn’t load.” Payroll Lab → Dashboard succeeded; the following Dashboard → Payroll Lab transition failed again. A newly opened Chrome tab using the same browser profile also passed direct loading and failed on the same sidebar transition; this was a fresh tab, not an isolated browser profile/session.

The browser console captured this full React Flight decoder stack on the failed transition:

```text
TypeError: Cannot read properties of null (reading 'enqueueModel')
    at resolveModelChunk (react-server-dom-webpack-client.browser.development.js:1724:52)
    at processFullStringRow (react-server-dom-webpack-client.browser.development.js:4573:19)
    at processFullBinaryRow (react-server-dom-webpack-client.browser.development.js:4431:7)
    at processBinaryChunk (react-server-dom-webpack-client.browser.development.js:4654:19)
    at progress (react-server-dom-webpack-client.browser.development.js:4972:16)
```

The trace also recorded a preceding React Flight performance-measure error (`PayrollLabOverview` had a negative timestamp) from `flushComponentPerformance` / `flushInitialRenderPerformance`. The previously reported `frame.join is not a function` is in Next’s compiled development RSC client while `buildFakeCallStack` reconstructs stack frames; the browser console exposed the decoder stack above on this reproduction, not a separate full stack for that exact message. Read-only source inspection found no application `frame.join` call, a standard `next/link` in the sidebar, shared dashboard layout, and no app-specific Flight request rewriting. These findings localize the observed failure to Flight response/debug-metadata handling but do not distinguish a bad RSC response from a development client/server artifact mismatch or an underlying server error.

The existing local `.next` production build was started on port 3011 with `npm.cmd run start -- --port 3011`. Next reported ready, but the route could not be rendered because this process did not have the approved TEST runtime values for creating a Supabase client. Protected files and values were not read or displayed. Production-build client navigation therefore remains unverified; the temporary server was stopped. Browser automation did not expose the native Network panel or response-body capture, and its page evaluator did not expose the Performance API, so the failing `_rsc` response and matching request status/body were not captured. The dev-server process on port 3010 was no longer reachable at the end of this focused pass.

No application-code defect has been proven, so no code, dependency, cache, or build change is justified in this single diagnostic round. No regression tests were run. The existing CSS, calculation, hash, component, authorization, and scope evidence above remains unchanged. The smallest reproducer is: in the integrated Next dev runtime, load `/dashboard/start` as Test HR Admin, click the Payroll Lab sidebar link, and observe the RSC decoder overlay; loading `/payroll-lab` directly succeeds. The exact `frame.join` stack itself was not available in this pass; the full sibling decoder stack above is the captured runtime trace.

### Definitive production navigation gate — 2026-10-02

The production navigation gate could not be run in this continuation. No app terminal session was attached to the task, and neither port 3010 nor 3011 had a listening process. I did not inspect or load protected configuration. Starting `next start` from the task shell previously reached “Ready” but lacked the approved TEST runtime context, so repeating that launch from the same shell would not provide valid acceptance evidence. This is **Gate C: production runtime unavailable**, not a production navigation failure. No browser acceptance or regression tests were run in this pass.

Required operator action: in the PowerShell session that has the already-approved TEST runtime loaded, run `Set-Location 'C:\Users\Edwin\Documents\Apps\LiquidHR-Payroll\Integration-Payroll-20261002\apps\hr-suite'` followed by `npm.cmd run start -- --port 3011 --hostname 127.0.0.1`. This uses the existing `.next` build, binds only to loopback, and requires no config values to be shared. Once the production server is available at `localhost:3011`, the requested Test HR Admin desktop/mobile route, history, trace, fork, and CSS acceptance can be performed.

### Browser acceptance in Test HR Admin

The existing Test HR Admin fixture session was active (hradmin.fixture). The M0 historical run and new browser calculation succeeded. Both reported the PAYLAB04 hashes and results:

| Case | Browser run | Result | Source hash | Input hash | Result hash |
|---|---|---|---|---|---|
| Synthetic M0 | e377e755-b014-4764-b75d-247445c08b2c | SUCCEEDED; 9 results, 7 PASS controls; net 3175.00, employer cost 4910.00 | d751c32f1e54b6bbed64eec7314340b6c7a247a79e5a2792144068c19ce87854 | ae1a740b0c1b3bad2ee07edd71fa331203f7496c0fc244a5e050530efa41c345 | f23fa646764176becc9bb78cacba1e3909b3640f97103ae6386168ee6ef61acd |
| NL-2026 | f9a254e1-a500-49dc-8e1d-4a7538903773 | SUCCEEDED; 4 PASS controls; gross/taxable 4000.00, tax 818.67, net 3181.33 | 6e4e9e1c2d51eb4b06e28fc226a19a413b314b66c4cb7231b40d26be83c13d0c | 47246b1f3e7037a11eb7ddd68303a9ed1625e5c62cf3fc4e4469d4833ff6c17a | a2995a7af2a6b1876f5b5ccb21fb5db04a7f4a2ddfe190699cdda9f871e41cc5 |

The historical M0 run 3d83c8ca-2ebe-47f7-9735-76e7377168d7 and historical NL-2026 run 06f7a7ff-fc8f-4ffe-aeb6-a9aed10f98ae opened with their calculation traces. New and historical calculation hashes matched the PAYLAB04 and PAYLAB03/PAYLAB04 reference evidence respectively. The new M0 trace showed 9 steps; NL-2026 showed 15 sequence steps.

The component view contained all 24 SYSTEM components. SYSTEM remained read-only; RegisteredRule NL_WAGE_TAX had a disabled copy control and stated that the system rule was not copyable. A CUSTOMER_FORK of NL_NET_PAY was created and saved as a draft, then reopened: ID 7a061ef3-bdd0-4da5-9361-43384695369e, code CUSTOM_C45BA4D05A7B478C8AA38F55E32238B0, origin NL_NET_PAY v2026.1. The fork is not used in calculations and receives no system updates.

The negative authorization probe switched to Test Manager; Payroll Lab was absent from navigation and opening the M0 run URL redirected to /geen-toegang. The negative case/run scope probe requested the M0 run under CC-NL-2026-001; the calculation page displayed “De gevraagde berekening is niet beschikbaar voor deze case” and did not expose that run’s result.

## Demonstration and availability

- **Completed on this integration branch:** Test HR Admin calculations and history traces, PAYLAB03/PAYLAB04 hash comparison, 24 SYSTEM checks, CUSTOMER_FORK save/reopen, RegisteredRule copy rejection, negative authorization and run/case scope checks, and styled dashboard/Payroll Lab checks at desktop and 390 px.
- **Still blocking:** the local dev runtime has the reproducible client-side route navigation failure documented above, and the production navigation gate is not run because the approved TEST runtime is unavailable in this task shell. No application code change is justified by the available evidence.
- **TEST and future deployment:** neither contains this Payroll integration. Version bump, push, main merge, and deployment were outside this handoff and were not performed.

**Merge decision: NOT MERGE-READY.** Gate C: production-build browser acceptance cannot be performed until Edwin starts the existing build from the PowerShell session with the approved TEST runtime already loaded. Development navigation remains unisolated; no production-only acceptance result is available. The separate LiquidHR release security acceptance remains OPEN.

## CAO-BENCH02 first implementation slice prepared (not implemented)

The next bounded slice is the versioned arrangement assignment/composition contract only. It should define:

1. Versioned `ArrangementPackage` metadata and version/effective dates; per-administration `AdministrationArrangementAvailability`; one effective-dated primary `PackageAssignment` per synthetic source employment; and immutable, hash-pinned `CalculationCompositionSnapshot` resolving the selected arrangement version.
2. Exactly one primary arrangement per employment and selection only from packages available to that linked administration. Extra pension/fund assignments remain a later compatible extension. Resolve the applicable package version by effective date; do not rewrite historical snapshots.
3. Keep executable SYSTEM rules in reviewed static registries. Do not store or execute rules from database text. Use synthetic fixtures until source ownership and the Core mapping contract are decided. No employee-ID-specific calculator branches.

Target cases are two Kinderopvang 2025–26, two Retail Non-Food 2026–27 Mode, two `LHR_DEMO_OPEN_BANDS_2026`, plus one CEO free-negotiation case under the company policy. Open-band midpoint and compa-ratio are company test policy using genuine public January/July 2026 A–J bounds. Metalektro-HP remains a separate applicability-only fixture and is not a third CAO payroll run. Start with September 2026 snapshots and test the 2026-10-01 salary/roster boundary, Frank's employment end, and one explicitly chosen Piet employment for the simple path. Lisa's manager relation does not establish Payroll permission; Eric's on-call case has no salary and is readiness-only.

Before building calculations or changing data, prove PAYLAB01's live read-only Core source path and decide ownership/mapping of `labor_condition_set_id`; confirm the final CONTROL02 IKV contract separately. No package import, new CAO calculation, employee-data edit, or Core/Control migration is part of this preparation.
