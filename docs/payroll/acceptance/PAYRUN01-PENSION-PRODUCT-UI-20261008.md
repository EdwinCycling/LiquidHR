# PAYRUN01 pension and Payroll product UI checkpoint — 2026-10-08

**Scope:** local PAYRUN01 code and approved Payroll Lab TEST evidence. No push, merge, deployment, version bump, payment, Loonaangifte submission, or Production action.

**2026-10-10 reconciliation:** The historical status below describes the 8 October checkpoint. In the synthetic TEST project, the local FK-index migration is now aligned to and recorded once as `20261010125613_index_core_pension_arrangement_foreign_keys`; its two indexes are present. The previously mismatched pension versioning files now use the exact recorded versions `20261008162746` and `20261008162923`. PAY-RULE-002 workflow migration `20261010130013` and supersession-FK index migration `20261010130140` were also applied to TEST; the existing mappings/assignments were versioned without creating an employee assignment or payroll run.

## A. Core pension model

The repository now records the two migrations previously applied and read back on the user-designated Core/DEV project:

- `apps/hr-suite/supabase/migrations/20261008062756_add_core_pension_arrangements_wtp_and_grandfathering.sql`
- `apps/hr-suite/supabase/migrations/20261008062834_refine_pension_arrangement_rls_policies.sql`

They define four scoped, effective-dated tables: `pension_arrangements`, `pension_arrangement_tiers`, `labor_condition_pension_arrangements`, and `employment_pension_arrangement_assignments`. Rows carry tenant, HR-group, and administration scope; arrangement and assignment records include provenance. RLS is enabled on all four. The read/write policies require HR-group access plus `contract:read` or `contract:write`; update checks apply to both old and new rows. The inspected table grants were unchanged. The migration files are repository reconciliation records and must not be reapplied to Core/DEV.

At the 8 October checkpoint, two pension-arrangement FK indexes were missing and the local index migration was not yet applied. The 10 October reconciliation above records that migration's application on the user-designated synthetic TEST project. The historical checkpoint had no explicit TEST marker; the database status was later clarified and read back before applying the forward migration. Security-advisor status is refreshed in the convergence acceptance record.

Official parameter research is recorded in [PAYRUN01-PENSION-OFFICIAL-SOURCES-20261008.md](../research/PAYRUN01-PENSION-OFFICIAL-SOURCES-20261008.md). Lisa's WTP arrangement uses the 2026 €19,172 standard franchise. Jaap's stated legacy fixture instead references CAP Staffelsbesluit Annex IV Table 2: 1.701% middelloon, OP-only, 20% for age 60–64, with the 2026 Article 10aa franchise €15,308; the 2026 salary cap is €137,800. The 2/3–1/3 employer/employee split remains synthetic company policy. The month-end age convention is permitted by the Staffelsbesluit. These rules clarify the fixture but do not prove the actual Core arrangement-version or participant's legal eligibility; no seeded reference value was rewritten in this pass.

## B. Lisa — flat company pension

Lisa's prior finalized run `c53ee0d8-7a0b-4de2-8d7c-598e737c6054` remains preserved. The new explicit correction successor is finalized:

- Run: `57ac6c10-7a02-49c4-a588-2ca244e621d9`
- Config v5: `f02cb7cd-5fd3-4a48-bdad-5e810b0e94f5`; config hash `6d4809ba340b6847ca714b832e93f3868cd7b0140ed765346178e90f7c4b5131`
- Source snapshot: `812248d2-2c3b-507d-9fc2-468bf8f0f567`; upstream snapshot hash `e9f2964f8992ed3885017026bd7cff0ad4126b4569bcfb2e29c048108b5f90b`; projected source hash `7c869056fea1156050175704799f73ede4b679e7e34fdc6f1aaa40a30943a95d`
- CalculationInputSet: `100713d7-3b94-55ba-b5ca-93625efe6f2a`; input hash `dfd58d93560081c50efd8a1874468883b3ff46762c3fc8680d5fa1f05357447f`
- Result hash: `599f13183f6e4d400f9ec63e11f1cb7078f855fc2ace52db67b16848cdede06a`
- Provenance: `CORRECTION_SUCCESSOR` / `CORRECTED_PAYROLL_INPUT`, superseding the prior run. Lifecycle: `CONCEPT → REVIEWED → FINALIZED`. 18 controls passed.

For a €5,500 monthly salary, the persisted calculation used annual pensionable salary €66,000, franchise €19,172, pension base €46,828, and the 15% approved flat policy. The annual premium is €7,024.20; monthly total is €585.35, split employee €195.12 and employer €390.23. The resulting wage-tax, employee-insurance, and Zvw bases are each €5,304.88, kept as distinct components in the calculation graph. Wage tax is €1,477.33; net is €3,827.55. Employer insurance is €1,189.36, holiday reserve €440.00, year-end reserve €0.00, and total employer cost €7,519.59. Year-to-date gross is €55,000 and holiday reserve €4,400.

JSON was generated separately: artifact `3662d637-b4ba-4786-9ece-3cd11cf66124`, SHA-256 `4f000358dd083f88026e95d3539257950d783c9092817a5aeffe4fea3bfcdb65`, bound to the new input/result hashes and supersession provenance. PDF was separately generated through the product action: SHA-256 `41a84b88ebd06b01eb49802002a14d20f7170eb58628bd884f6d8c5472f1e82a`, media type `application/pdf`, with the same input/result binding. The PDF artifact and download route were confirmed; a separate browser-side hash of downloaded bytes was not captured.

## C. Jaap — progressive grandfathered pension

Jaap was created through the normal Core/DEV domain paths after the user designated the TEST project. Readback confirmed one employment, 40/40 hours Monday–Friday, €6,750 monthly salary, `Bedrijfseigen regeling`, the generic `Algemeen project` job placeholder, and the stored grandfathered company arrangement. Raw BSN and IBAN values are excluded from this report; their presence/validity flags were not re-read in this recovery.

Payroll Lab still contains only the original config v1 and assignment v1; the prior readback confirmed both historical hashes unchanged. No input reference exists for a Jaap calculation. The local PAYRUN01 config expects v2 and `HOURS_AND_SPECIFIC_DAYS`. The source-projection and identity regressions previously passed (22 tests), and this pass's offline pension-calculation test passed 6/6. The new v2/input/run has **not** been persisted. There is no standalone PAYRUN01 CLI/runner; the service's real source-provider and default dependencies require the authenticated Next request context and Core permissions. The injectable test path uses mocks. The Core pension page supports assigning an existing arrangement but has no supported arrangement-version correction operation. In this pass the Codex in-app browser had no active app tab, no listener was present on the checked PAYRUN01 ports 3010/3013/3123, and the ignored generated `apps/hr-suite/.next/dev/lock` exists with its owner still unidentified from the previous runtime diagnosis. No lock cleanup or process stop was attempted.

The user's 20% total is a synthetic company policy reconciled to the Annex IV Table 2 OP-only reference; the 2/3–1/3 split is also synthetic. The offline regression assumes the legacy version effective date is 2023-01-01, the new-entrant flat transition date is 2026-01-01, and the legacy contract is not solidarity-based. These three details are test assumptions, not Core readback. `PENSION_LEGAL_FISCAL_TREATMENT_UNVERIFIED` remains an independent finalization gate until the effective Core arrangement-version and assignment are read through the authorized app path and the participant-specific eligibility evidence is established. No concept, review, finalization, JSON, or PDF artifact was created for Jaap in this recovery. The secure identifier/bank presence flags remain OPEN pending a supported application-path readback.

TEST assumptions in the unpersisted Jaap configuration: NL tax residence (nationality NL was user-provided), white monthly table, under-AOW age category derived from the supplied DOB, standard regular full-period treatment, and no special situation; payroll-tax credit is disabled as user-specified. The employer-size assumption is small, AWf is set to the low rate based on an assumed written non-call indefinite contract, and Whk 1.81%/sector are unverified TEST assumptions. The payslip profile assumes a written contract, non-call status, and €14.99/hour minimum-wage presentation from 2026-07-01 for age 21+. The January–September opening balance (€60,750 gross, €4,860 holiday reserve, €0 year-end reserve) assumes €6,750 each month, 8% holiday reserve, and 0% year-end reserve; it is not reconstructed payroll history. `Algemeen project` is an existing generic placeholder, not a verified occupational function. No administration tax number was invented.

## D. Frits — PFZW

`PAY-RULE-002 = SOURCE_GAP`. The official PFZW source note confirms the 2026 annual base, franchise, cap, percentage, and scheme-hour treatment. It does not establish PAYRUN01's monthly allocation order, exact cent-rounding sequence, or employee/employer split for the fixture. No PFZW numeric amount or successor run was created. Frits' canonical corrected October 8-hour finalized run remains unchanged and explicitly pre-PFZW.

## E. Payroll Professional UI

The permanent navigation now separates Payroll, Employee Self-Service, and Payroll Lab. Payroll contains Overview, Payroll run, Corrections, Compare, Arrangements & components, and Settings; reconciliation remains contextual under a payroll run. The run view displays persisted component results, employer costs, YTD values, lifecycle, input/source/result hashes, and an expandable calculation trace. It does not recalculate in the browser.

Authenticated desktop review at 1280×720 showed the full right-aligned €7,519.59 employer cost and the calculation/YTD sections; the Setup rail did not obscure the amount at this width. The requested 393×852 iPhone acceptance was not run, so mobile readability, overflow, trace, and accordion behavior remain OPEN. The Setup tab is hidden below the medium breakpoint in the existing shared component, but that code observation is not a mobile acceptance result.

## F. External payroll comparison

The comparison form keeps entered external values in browser state. It compares saved LiquidHR components and displays exact, €0.01, or larger differences without changing a calculation. Browser checks showed €5,500.00 as exact, €5,500.01 as a one-cent difference, and €5,501.00 as a one-euro difference; reloading cleared the external entry and preserved the saved LiquidHR result. No external values were persisted.

## G. Employee Self-Service — Mijn salaris

The route is `/my-salary`, with separate Employee Self-Service navigation. The server service checks the authenticated employee identity and `salary:read`, then confirms tenant, HR-group, and administration consistency; it queries only that employee's succeeded individual payroll runs and projects saved calculation components and pension summary fields. The Edwin session had no finalized employee statement, so the page displayed no payroll amounts. The self-only behavior is covered by service tests; an employee-owned finalized statement was not available for a complete rendered pension-explanation acceptance. Mobile acceptance remains open.

## H. Quality gates

- Focused payroll/pension/UI regression: 12 files, 55 tests passed before the final menu-order label completion. After adding the missing `selfService` and `payrollLab` labels, the targeted navigation suite passed again: 1 file, 7 tests.
- NL/EN i18n parity: 42 namespace pairs passed.
- Changed-file ESLint: passed with exit code 0.
- Strict TypeScript, incremental output disabled: the only remaining diagnostic is the known unrelated `TS2366` in `apps/hr-suite/components/payroll/component-library-entry-detail.tsx:76`. A navigation-label type error found on the first run was fixed.
- Jaap recovery regression: source-projection and source-snapshot identity tests passed, 22/22; progressive pension calculation test passed, 6/6.
- `git diff --check`: passed after the report and index updates; only existing CRLF normalization warnings were emitted.
- Production build not run because the authenticated local Next.js runtime shares the generated `.next` tree; avoiding a competing build protects the active TEST runtime. The known PDF-renderer test's 5-second timeout remains untouched and explicitly reported.

## I. Remaining blockers

1. Jaap's config v2, corrected arrangement version/assignment, fresh source snapshot/input/run and artifacts are not persisted. The default pipeline requires an authenticated Next request and Core permissions; no safe standalone runner exists, and the Core pension UI has no supported arrangement-version correction workflow. Direct SQL/service-role writes would bypass that path and were not used.
2. `apps/hr-suite/.next/dev/lock` exists in ignored generated output; its owner is unidentified. There is no listener on checked PAYRUN01 ports 3010/3013/3123, and the Codex in-app browser has no active app tab. No lock/process cleanup was performed.
3. PFZW monthly allocation, exact rounding, and split remain `SOURCE_GAP`.
4. Authenticated 393×852 mobile acceptance is still open.
5. The earlier September Frits PDF contract-type discrepancy cannot be reconciled from a verified non-Production Core read in this pass; no contract evidence was fabricated in Payroll.
6. The unrelated `TS2366` and untouched PDF-renderer 5-second test timeout remain open.

## J. Git and side-effect state

Worktree: `Integration-PAY-CONVERGE-20261004`, branch `integration/pay-converge-20261004`, HEAD `0337af89d01ea072936b8894e01f46f09f7b3be9`. Existing dirty work was preserved. This pass changed only the official pension-source note and PAYRUN01 acceptance/current-context documentation; no product code or remote database was changed. The targeted pension unit test ran locally. No new Payroll run or Core write occurred. No push, merge, deployment, version bump, migration apply, payment, or Loonaangifte submission occurred.

## K. PAYRUN01 product acceptance continuation — 2026-10-09

This continuation supersedes the UI, browser, open-acceptance, and Git-state statements in Sections E, G, H, I, and J above. The user's addendum removes external payroll comparison from current acceptance; Section F is historical, existing comparison code was left untouched, and it was not retested or polished in this continuation.

### Acceptance journeys

| Journey | Result | Evidence |
| --- | --- | --- |
| Lisa professional reconciliation | GREEN | Finalized run opened at `/payroll/runs/57ac6c10-7a02-49c4-a588-2ca244e621d9`; saved gross €5,500.00, employee pension €195.12, employer pension €390.23, wage tax €1,477.33, net €3,827.55, employer insurance €1,189.36, holiday reserve €440.00, year-end reserve €0.00, employer cost €7,519.59. Reconciles as €5,500.00 − €195.12 − €1,477.33 = €3,827.55 and €5,500.00 + €1,189.36 + €390.23 + €440.00 + €0.00 = €7,519.59. |
| Jaap professional reconciliation | GREEN | Succeeded / CONCEPT run opened at `/payroll/runs/e20e0345-90ac-489b-9fee-7610b2d8f6a3`. The UI displays the concept lifecycle and pension-readiness warning; it is not a finalized payslip and was not finalized. The persisted trace has 62 engine steps, including 7 pension steps, and 18 PASS controls plus 1 pension-readiness WARN. |
| Frits incomplete-result representation | GREEN | Finalized pre-PFZW run opened at `/payroll/runs/338ef391-fbf6-435a-a4d7-e28a8024ebc2`; gross €3,219.41 and saved pre-PFZW net €2,743.91. The screen says pension was not calculated and source verification is required, and that net is not definitive. No missing pension is displayed as €0. |
| Employee ESS self-access | GREEN | Existing Lisa employee TEST identity reached `/my-salary` through the guarded test-role handoff and normal context selection. The page shows only her finalized `57ac6c10-7a02-49c4-a588-2ca244e621d9` statement with employee-friendly gross-to-net, pension, tax, employer pension, reserves, and YTD values including €55,000.00 gross and €4,400.00 holiday reserve. |

### Persisted reconciliation and trace evidence

Jaap's pension reconciles from saved values: annualized salary €81,000.00 − annual franchise €15,308.00 = annual pensionable base €65,692.00; the saved age tier applies 20%, yielding a monthly total of €1,094.87. The saved 1/3 employee and 2/3 employer allocations round HALF_UP to €364.96 and €729.91, which sum to €1,094.87. Gross-to-net is €6,750.00 − €364.96 = €6,385.04 wage-tax base, then €6,385.04 − €2,337.92 = €4,047.12 net. Employer cost is €6,750.00 + €1,112.28 employer insurance + €729.91 employer pension + €540.00 holiday reserve + €0.00 year-end reserve = €9,132.19.

Expanded persisted AWf, Aof, Whk, Wko, and Zvw details show each component code, €6,385.04 assessment base, saved percentage, result, formula, HALF_UP rounding, component/rule versions, effective period, Belastingdienst handbook source, trace step identity, and dependency references. The live acceptance check confirmed the five persisted premium steps, including AWf's 2.74% rate and dependencies on the saved AWf rate and employee-insurance assessment base. The trace remains a persisted result; the browser performs no payroll calculation.

### Browser, responsive, and security evidence

Controlled local browser acceptance used an authorized Edwin professional session scoped to Planeten / Jupiter BV and the existing authorized Lisa employee TEST identity. Routes exercised: `/payroll/runs`, all three run routes in the table, and `/my-salary`. The browser reported zero page errors. The visible detail route's explicit label map was completed for rule source, calculation provenance, and trace step; a fresh screenshot confirms translated labels and the actual trace sequence.

At 1440×900, the Lisa, Jaap, Frits, and Lisa ESS views rendered the persisted results. At 393×852, Jaap's pension summary and pension trace expanded with touch, Lisa's pension and YTD sections expanded with touch, and the payroll controls also expanded by keyboard Enter. Jaap's professional page had 103 currency values measured; every right edge was within the 393 px viewport, document/body/main width was 393 px, and the fixed Setup edge tab was hidden. ESS document/body/main width was also 393 px with no horizontal scroll. The navigation and all displayed amounts remained reachable.

ESS self-only checks passed: requesting `/my-salary?employeeId=dd9bde02-76bb-4f7c-8add-db544a148f3f` in Lisa's authenticated context returned Lisa's €3,827.55 statement and not Jaap's €4,047.12; requesting Jaap's technical JSON artifact returned HTTP 403 with no Jaap payroll value or result hash in the response. ESS output contained no 64-character internal hashes, `PAYRUN01_` codes, or raw `employee_pension` key. No account was provisioned/reset, no payroll result was written, and no calculation was rerun.

Screenshot artifacts (real local browser data; paths relative to this repository):

- `apps/hr-suite/output/playwright/PAYRUN01-lisa-professional-desktop-1440x900.jpg`
- `apps/hr-suite/output/playwright/PAYRUN01-jaap-awf-detail-1440x900.jpg`
- `apps/hr-suite/output/playwright/PAYRUN01-jaap-pension-detail-1440x900.jpg`
- `apps/hr-suite/output/playwright/PAYRUN01-frits-source-gap-desktop-1440x900.jpg`
- `apps/hr-suite/output/playwright/PAYRUN01-ess-lisa-desktop-1440x900.jpg`
- `apps/hr-suite/output/playwright/PAYRUN01-jaap-pension-detail-mobile-393x852.jpg`
- `apps/hr-suite/output/playwright/PAYRUN01-ess-lisa-mobile-393x852.jpg`

### Quality gates and remaining build limitation

- Focused Vitest: 4 files, 28 tests passed, covering professional display, persisted explanation projection, employee self-service authorization, and guarded test-role switching. No comparison test was run.
- Strict HR-suite TypeScript (`tsc --noEmit --incremental false`): passed.
- Changed-source ESLint: passed for the run-detail route and professional calculation view/tests.
- NL/EN parity: passed, 42 namespace pairs.
- Full controlled browser journeys: passed, zero page errors; responsive and security assertions are listed above.
- Production build: not run. The repository's authorized launcher could not start the isolated TEST runtime because `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local` was unavailable. The launcher was not bypassed; no secret file was read or changed. Production deployment/build side effects were not attempted.
- PFZW remains the separate authoritative `SOURCE_GAP`; this product UI pass did not alter pension calculations or finalize Jaap.

The worktree remains the existing `Integration-PAY-CONVERGE-20261004` branch with its prior dirty state preserved. This continuation made no push, merge, deployment, migration apply, remote database write, payment, or Loonaangifte submission.

## L. PAYRUN01 engineering closure — 2026-10-09

This section supersedes the previous technical status in Sections G–J. The accepted professional UI, calculation detail, ESS Lisa browser result, and desktop/mobile evidence above remain preserved. This closure did not perform interactive logins, account changes, payroll writes, recalculation, or migration application. Existing comparison code was left untouched and is outside the acceptance criteria.

### Functional acceptance retained

| Area | Status | Evidence |
| --- | --- | --- |
| Lisa professional reconciliation | GREEN | Persisted FINALIZED run `57ac6c10-7a02-49c4-a588-2ca244e621d9`; employee/employer totals and pension split reconcile as recorded in Section K. |
| Jaap professional reconciliation | GREEN | Persisted SUCCEEDED / CONCEPT run `e20e0345-90ac-489b-9fee-7610b2d8f6a3`; pension staffel, 62-step trace, 18 PASS controls, and one pension-readiness WARN remain visible. Not a finalized payslip. |
| Frits source-gap presentation | GREEN | Persisted FINALIZED pre-PFZW run `338ef391-fbf6-435a-a4d7-e28a8024ebc2`; PFZW is not calculated, source verification is required, and net is non-definitive. |
| ESS Lisa finalized statement | GREEN | Existing authorized Lisa TEST browser evidence at `/my-salary` remains completed evidence. This is not the deferred two-identity E2E proof. |
| Desktop/mobile presentation | GREEN | Existing 1440×900 and 393×852 browser evidence and screenshot paths in Section K remain the accepted evidence. No browser login was repeated in this closure. |

### ESS authorization review and automated proof

Code review confirmed that `/my-salary` accepts no employee identifier from the request. `getMySalaryStatement` derives the employee ID from authenticated context, requires `salary:read` for that identity, checks the permission context retains the same employee, tenant, HR group, and administration, and supplies that scope and employee ID to the persisted-data repository. It also rechecks artifact ownership and requires a matching `FINALIZED` lifecycle event before returning a statement. The response is an allow-listed projection of saved salary components and a limited pension summary; internal hashes, trace data, source payloads, and technical provenance are not returned.

New deterministic service tests use the production `requirePermission` implementation with controlled authenticated Lisa and Jaap identities and scoped payroll fixtures. They prove Lisa→Lisa finalized access; Lisa→Jaap and Jaap→Lisa denial even if a repository returns the wrong employee artifact; Jaap's own CONCEPT run is not exposed; tenant, HR-group, and administration scope mismatches return no statement; missing `self:salary:read` is denied before payroll reads; and the response omits hashes, raw source payload, and trace. Result: **9/9 authorization tests passed**. This automated evidence is separate from the deferred two-account browser E2E test.

### Open acceptance item — do not execute in this pass

| Acceptance ID | Status | Required later |
| --- | --- | --- |
| `PAYRUN01-ESS-TWO-IDENTITY-E2E` | **DEFERRED — USER DECISION** | Independently sign in as Lisa and Jaap with distinct real employee TEST accounts; prove positive self-only access, negative cross-employee access, and correct CONCEPT/FINALIZED visibility. No interactive login, user/credential creation, password search, authentication-fixture change, or HR Admin impersonation was performed for this item. |

### Engineering checks and build

- Focused payroll/UI/pension/security regressions: **16 files, 130 tests passed**, including the new authorization suite and direct CONCEPT/FINALIZED and PFZW source-gap view regressions, professional calculation explanation, saved-result service, payroll persistence/trace/source projection, pension arrangement versioning, and actual permission guard.
- A first focused run exposed two stale test expectations for the repository's specific assignment/composition conflict codes. The assertions now match the existing fail-closed error contract; the complete focused rerun passed. No calculation behavior changed.
- Strict TypeScript: `tsc --noEmit --incremental false` — passed after correcting the authorization-fixture map key type.
- Changed-source ESLint: passed for the professional/ESS UI, calculation explanation/service, and related tests.
- NL/EN parity: passed, 42 namespace pairs. `git diff --check`: passed; Git emitted only existing LF-to-CRLF normalization warnings.
- Production build: **BUILD_ENVIRONMENT_BLOCKED**. The established authorized launcher requires `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local`; that protected central TEST config was unavailable. No config was read, copied, reconstructed, or bypassed, and no alternate runtime or port was used.

### Core/DEV and Payroll Lab TEST migration state

Read-only Supabase migration listings were checked for Core/DEV `wnpfloqpjvaacobppbpk` and Payroll Lab TEST `jhgeriucbkfarxiudzfy`.

- At the 8 October checkpoint, local and remote migration names differed. The 10 October reconciliation aligns the local filenames to their recorded TEST versions; the seven version-FK indexes remain present. The historical check did not compare the remote migration SQL bodies.
- Payroll Lab TEST has 13 local PAYLAB/PAYRUN01 migration files and 13 corresponding applied entries. Only `20261007064350_payrun01_fix_input_reference_guard` has an exact version match; the other 12 local→server version pairs differ: `20260930100000→20260930125822`, `20261001153005→20261001155314`, `20261003100000→20261003122457`, `20261003123000→20261003122705`, `20261003130000→20261003124346`, `20261003140000→20261003171547`, `20261003180000→20261003174936`, `20261005100100→20261006055549`, `20261007091338→20261007091826`, `20261007175209→20261008061304`, `20261008170000→20261008175223`, and `20261009100000→20261009050755`. In particular, the local failed-attempt successor timestamp is later than its recorded server version. The remote migration listing reports version/name, not SQL-body equivalence.
- Migration-history version drift is confirmed; the two missing Core FK indexes are also confirmed absent. No migration was applied or repaired. Reconcile local filenames/history and decide the two Core indexes through the normal migration workflow before another migration is applied.

### Git and handoff

Branch `integration/pay-converge-20261004`, HEAD `0337af89d01ea072936b8894e01f46f09f7b3be9`. Existing dirty changes were preserved; 55 tracked files are modified, 7,533 files are untracked, and none are staged. Of the untracked entries, 7,478 are under `.tmp-*` / `apps/hr-suite/output/`, mostly generated test/compiler caches plus local harnesses and screenshots. They were not removed or staged. The screenshots contain employee payroll data and should remain outside ordinary code commits. `apps/hr-suite/next-env.d.ts` points into the isolated `.next/payrun01-acceptance-20261009` output and is generated runtime state, not a source change to stage.

Proposed commit units: (1) PAYRUN01 repository/service/calculation rules and Payroll Lab migrations; (2) professional reconciliation and ESS routes/components/locales with their tests; (3) pension-arrangement domain/versioning services, Core migrations, and database types; (4) acceptance documentation, with sensitive screenshots held as local evidence; (5) employment-contract, dashboard navigation, setup-assistant, and runtime-launcher changes reviewed and committed independently because they are separate work. Do not stage or commit the unrelated unit with PAYRUN01.

No hard-coded Lisa/Jaap/Frits behavior was found in the professional UI or ESS service; persona identifiers occur in fixtures and acceptance evidence only. Product source contains no acceptance `console.log`/debugger statements. Temporary harnesses remain untracked and were not run during this closure. No credentials or account secrets were added to product code or test fixtures.

### Remaining gates and recommendation

- `PAYRUN01-ESS-TWO-IDENTITY-E2E`: **DEFERRED — USER DECISION**.
- Jaap's legal/fiscal pension eligibility and participant evidence remain required before any FINALIZED lifecycle transition.
- Frits PFZW `PAY-RULE-002` remains a separate authoritative source gap; the missing pension is not zero and his net is not definitive.
- The production build remains environment-blocked by the central TEST config prerequisite above.
- Reconcile Core/DEV and Payroll Lab TEST migration lineage before any future database migration is applied.
- Broader payroll compliance, declaration, payment, and release requirements remain outside this product-acceptance closure.

**Recommendation: READY to begin the next PFZW engineering phase as an isolated code/research/test phase. Migration application remains gated on reconciling the recorded version/name drift; this recommendation is not production, release, or finalization approval.**

## M. PAYRUN01 → PFZW integration safety gate — 2026-10-09

This section supersedes the Git inventory, migration-lineage, build, and PFZW-readiness statements in Section L. Functional product acceptance and the ESS security evidence above remain preserved. This gate performed no browser login, account or payroll change, migration apply, staging, commit, push, merge, deployment, or Production action. `PAYRUN01-ESS-TWO-IDENTITY-E2E` remains **DEFERRED — USER DECISION**.

### Worktree inventory and proposed safe commit units

Checkout `Integration-PAY-CONVERGE-20261004`; branch `integration/pay-converge-20261004`; HEAD `0337af89d01ea072936b8894e01f46f09f7b3be9`. The current inventory is **55 modified tracked files, 7,534 untracked files, and 0 staged files**. Of the untracked files, **7,465** are generated harness/cache/runtime output: `.tmp-jaap-pension-tests-20261008/` (599), `.tmp-payrun01/` (1,803), and `apps/hr-suite/.tmp-payrun01/` (5,063). Another **13** are browser screenshots under `apps/hr-suite/output/playwright/`; they contain employee payroll information and remain local evidence. The other **56** are 40 source/test files, 8 migration files, and 8 PAYRUN01 documents. The large untracked count is generated temporary output, not 7,500 product source changes. Nothing was removed or staged.

Proposed reviewable units, after the migration-lineage hold is resolved:

1. **PAYRUN01 engine and persisted result path:** `apps/hr-suite/app/(dashboard)/payroll-lab/salarisverwerking/{actions*,page*}`, `apps/hr-suite/lib/payroll/{calculation-repository*,individual-payroll-migration-contract.test.ts,payrun01-*,source/liquid-hr-source-provider*,synthetic-calculation-service*,validation-pack*}`, and `packages/payroll-rules-nl-2026/src/{index.ts,payrun01-composition.ts,pension-calculation*,pfzw-2026-kinderopvang-jan*}` with their paired tests.
2. **Professional reconciliation and ESS:** payroll routes `arrangements/page.tsx`, `corrections/page.tsx`, `page.tsx`, `runs/page.tsx`, `runs/[runId]/page.tsx`, and `settings/page.tsx`; `/my-salary`; the payroll artifact API route; `payroll-professional-{navigation,view,explanations,service}*`; the two `messages/{en,nl}/payrollProfessional.json` files; and the associated tests. The existing `payroll/compare` route and `payroll-comparison-form*` are excluded from this scope and left untouched.
3. **Core pension arrangement domain and assignment UI:** `apps/hr-suite/app/(dashboard)/employees/[employeeId]/employments/[employmentId]/pension/{actions.ts,page.tsx}` and `apps/hr-suite/lib/employment/{pension-arrangement-service.ts,pension-arrangement-version*,pension-arrangement-*-migration.contract.test.ts,employment-salary-structure-model*}`. Hold `packages/db/types.ts` until schema lineage is reconciled. Hold every SQL migration below as a separate migration review/apply unit.
4. **PAYRUN01 evidence:** the current acceptance checkpoint, `docs/delivery/CURRENT_CONTEXT.md`, and the PAYRUN01 acceptance/research notes. Historical checkpoint documents are evidence records, not instructions to replay historical writes.
5. **Adjacent integration changes, reviewed separately:** employee/employment detail and settings (`app/(dashboard)/employees/.../page.tsx`, `app/(dashboard)/layout.tsx`, `app/(dashboard)/settings/{employment-contracts,menu-order}/page.tsx`, `components/employment/*`, `lib/employment/{detail-schemas*,employment-detail-service.ts,employment-settings.ts}`); sidebar/navigation/setup-assistant; test-role-switch route/tests; `lib/i18n/{config.ts,server.ts}` and `messages/{en,nl}/{employment,navigation}.json`; `docs/README.md`; `next.config.ts`, `tsconfig.json`, and `scripts/start-test-worktree{,.contract}.ps1`. Keep `component-library-entry-detail.tsx` separate with its known unrelated `TS2366`. Do not fold these into the payroll-engine unit without a path-by-path review.

Exclude from ordinary source commits: all three `.tmp-*` trees, `apps/hr-suite/output/playwright/` screenshots, generated `apps/hr-suite/next-env.d.ts`, all eight migrations pending lineage review, `packages/db/types.ts` pending schema alignment, and the comparison files outside scope. The existing `component-library-entry-detail.tsx` change also stays separate because its known `TS2366` diagnostic is unrelated to this gate. No persona-specific Lisa/Jaap/Frits product logic or new secret-bearing logs/artifacts were found in the reviewed source changes.

### Migration lineage — read-only comparison

SQL fingerprints below use lowercase SQL with line comments stripped and whitespace collapsed, then MD5 for equality comparison. A matching normalized fingerprint means equivalent SQL text under that normalization; a differing fingerprint means an actual body difference, not merely a filename mismatch. The fingerprint is not a security checksum. Project scopes: Core/DEV `wnpfloqpjvaacobppbpk`; Payroll Lab TEST `jhgeriucbkfarxiudzfy`.

**Core/DEV:**

| Local migration | Applied version/name | Normalized SQL fingerprint | Finding |
| --- | --- | --- | --- |
| `20261008062756_add_core_pension_arrangements_wtp_and_grandfathering` | `20261008062756 / add_core_pension_arrangements_wtp_and_grandfathering` | local `e0dbd9d6d4835ee5631b8039d570408a`; applied `0b944b940fb17007d56fb23f4ed9ef15` | Same version/name, different SQL body. Do not reapply or rewrite history. |
| `20261008062834_refine_pension_arrangement_rls_policies` | `20261008062834 / refine_pension_arrangement_rls_policies` | local `c71f907eee2a5114e60722ce29029acd`; applied `ba5f372508f61cc07a8a2e0ef1841556` | Same version/name, different SQL body. Do not reapply or rewrite history. |
| `20261010125613_index_core_pension_arrangement_foreign_keys` | `20261010125613 / index_core_pension_arrangement_foreign_keys` | local `44a34fd9810d57c5d84c1d3760d2af69` | Applied once on 10 October; both indexes are present. |
| `20261008162746_pension_arrangement_versioning` | `20261008162746 / pension_arrangement_versioning` | both `2ca6db4acc7ebc32f03b84f3e99caddc` | Local filename now matches the recorded TEST version; normalized SQL matches. |
| `20261008162923_pension_arrangement_version_fk_indexes` | `20261008162923 / pension_arrangement_version_fk_indexes` | both `bf9f6b24667ca74faebcc643c6b70db5` | Local filename now matches the recorded TEST version; seven indexes are present. |

There is no remote-only migration in this scoped Core pension set. Readback found seven pension tables, RLS enabled on all seven, 27 CHECK / 13 FK / 7 PK / 9 UNIQUE constraints, and 19 policies. The four base tables retain HR-group plus permission guards; UPDATE retains both `USING` and `WITH CHECK`. Those tables have CRUD grants to `anon`, `authenticated`, and `service_role`, with RLS remaining the row boundary. Version tables have `SELECT` for `authenticated` only, with no `anon` grant. The successor RPC remains `SECURITY DEFINER` with an empty search path, authenticated/service-role execution, and its scope and permission checks. The two absent indexes are `employment_pension_arrangement_assignments_arrangement_idx` and `labor_condition_pension_arrangements_arrangement_idx`, each on `pension_arrangement_id`. The local `CREATE INDEX IF NOT EXISTS` migration is a narrowly scoped forward correction prepared and contract-tested; it was not applied. No RLS or grant was weakened.

**Payroll Lab TEST:** all 13 local migrations map by migration name to an applied row; none are local-only or remote-only within this scoped PAYRUN01 lineage. Twelve have the same normalized SQL fingerprint. The single SQL-body difference is the availability-validity migration; both versions leave `effective_from` NOT NULL with no default, although the local script sets a temporary default before dropping it and the applied script backfills NULL before setting NOT NULL. Do not reapply it.

| Local version/name suffix | Applied version/name | Normalized SQL MD5 | Result |
| --- | --- | --- | --- |
| `20260930100000_paylab00_isolation_foundation` | `20260930125822 / 20260930100000_paylab00_isolation_foundation` | `4edb9a51bb72b2367ad84a7294612df2` | equivalent |
| `20261001153005_paylab04_customer_component_versions` | `20261001155314 / paylab04_customer_component_versions` | `bcce211a66de4a9a784739b04d3e1c87` | equivalent |
| `20261003100000_paylab05_arrangement_foundation` | `20261003122457 / 20261003100000_paylab05_arrangement_foundation` | `3eeda336a540b4ffcf290f7104ffe2f7` | equivalent |
| `20261003123000_paylab05_arrangement_integrity_hardening` | `20261003122705 / 20261003123000_paylab05_arrangement_integrity_hardening` | `5161b2360e74752dc93aa10d3e5ebf57` | equivalent |
| `20261003130000_paylab05_arrangement_availability_validity` | `20261003124346 / 20261003130000_paylab05_arrangement_availability_validity` | local `c2cf95ea48c87a38896ab5cd4340cf62`; applied `5cb277e667f3e66383c0bff33aa59284` | different body; equivalent final nullability/default state |
| `20261003140000_paylab06_audited_availability_start` | `20261003171547 / paylab06_audited_availability_start` | `4217615c6d2cfcebe261621255c17786` | equivalent |
| `20261003180000_paylab06_benchmark_fixture_codes` | `20261003174936 / paylab06_benchmark_fixture_codes` | `be123aa1fd749644d8ff2f9e7743d620` | equivalent |
| `20261005100100_payrun01_individual_payroll` | `20261006055549 / 20261005100100_payrun01_individual_payroll` | `397e79f8ec7b553e6de78a5aeaf0676f` | equivalent |
| `20261007064350_payrun01_fix_input_reference_guard` | `20261007064350 / payrun01_fix_input_reference_guard` | `53c25b7a3bcc20fdab8f04ca7df6e4e5` | same version; equivalent |
| `20261007091338_payrun01_test_version_supersession` | `20261007091826 / payrun01_test_version_supersession` | `8756ca23ba5039af2c44460afb458a2e` | equivalent |
| `20261007175209_payrun01_test_successful_version_supersession` | `20261008061304 / 20261007175209_payrun01_test_successful_version_supersession` | `f9a32353667adf7f8e4901b8de8bc208` | equivalent |
| `20261008170000_payrun01_test_initial_fixture_successor` | `20261008175223 / payrun01_test_initial_fixture_successor` | `39cd32d0bf6078f8b62732c3cd196f94` | equivalent |
| `20261009100000_payrun01_test_failed_attempt_successor` | `20261009050755 / payrun01_test_failed_attempt_successor` | `0fbafd08b3c868081e767361b8ef4f8c` | equivalent |

The “12 version/name mismatches” are therefore 12 local/applied version mismatches (the guard migration shares a version); they are not 12 SQL mismatches. Database readback found eight PAYRUN01 tables with RLS enabled, service-role-only policies, 32 CHECK / 17 FK / 8 PK / 15 UNIQUE constraints. Grants are `SELECT`/`INSERT` to `service_role` and `ALL` to `postgres`; there are no `anon` or `authenticated` grants. The success RPC remains service-role-only with empty search path and run/input/result-scope validation. No grants, RLS, successful historical run, or migration history were changed.

### Build prerequisite

**`BUILD_ENVIRONMENT_BLOCKED`.** The approved launcher prerequisite `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local` does not exist at the expected central TEST runtime path. The launcher was inspected; no secret contents were read, copied, reconstructed, or searched for. No login, repeated runtime restart, port-3000 action, or Docker use was attempted. Production build evidence remains blocked solely on this prerequisite.

### PFZW PAY-RULE-002 readiness and implementation plan

The current Frits run `338ef391-fbf6-435a-a4d7-e28a8024ebc2` remains finalized before PFZW; it is not recalculated. `packages/payroll-rules-nl-2026/src/pfzw-2026-kinderopvang-jan.ts` deliberately returns `UNSUPPORTED` for monthly PFZW allocation/rounding. No incomplete pension amount was persisted. The current authoritative parameter set is documented in [PFZW official sources](../research/PAYRUN01-PENSION-OFFICIAL-SOURCES-20261008.md): 2026 annual OP/NP franchise €17,283; WIA-excess franchise €79,409; per-employment pensionable-salary cap €137,800; total OP/NP 25.9%, WIA excess 3.4%; full-time norm hours determine DTF, represented to four decimals (Frits's sourced 32/36 example is 0.8889); scheme hours are reported to two decimals. The 2026 PFZW annual basis includes agreed structural salary, holiday pay, and structural year-end allowance, with participation-start/January basis dates and whole-euro RegLn ceiling. The 2026 PFZW basis uses the EJU structure/rate at 2025-12-31 (5.5%); the Kinderopvang cash reserve is 8% from 2026, a distinct basis. The sector-specific Kinderopvang 2026 split is employee/employer OP/NP 12.9%/13.0% and WIA 0%/3.4%, subject to source-confirmed coverage of Frits.

Sources: [PFZW Statuten en Reglementen, July 2026](https://www.pfzw.nl/content/dam/pfzw/web/statuten-en-reglementen/Statuten%20en%20reglementen%20juli%202026.pdf), [PFZW UPA 2026 manual](https://www.pfzw.nl/content/dam/pfzw/web/werkgevers/pensioenaangifte/2026_Handleiding-aanlevering-UPA-gegevens.pdf), [PFZW premium calculation](https://www.pfzw.nl/werkgevers/premie-en-factuur/premie-berekenen/hoe-bereken-ik.html), [PFZW rates and franchises](https://www.pfzw.nl/werkgevers/premie-en-factuur/premiepercentages-en-franchises.html), [Kinderopvang Works 2026 rates](https://www.kinderopvang-werkt.nl/nieuws/pensioenpremies-2026), [OAK 2026 decision](https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2026-01/Besluit-pensioenpremies-2026.pdf), and [CAO Kinderopvang year-end allowance](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/eindejaarsuitkering). The [Belastingdienst Handboek Loonheffingen 2026](https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf) identifies employee pension withholding in column 7; that deduction affects the separate employee-insurance, Zvw, and LB/PVV bases (columns 8, 12, and 14), while employer pension remains an employer cost.

Still unresolved before `PAY-RULE-002` can close:

- Obtain an authoritative current-WTP worked example/calculator or UPA-provider confirmation for monthly allocation, start/end-month proration, partial months, retroactive corrections/cumulatives, and the exact sequence of component and employee/employer cent rounding. The pre-WTP 2021 explanation is not sufficient evidence for 2026.
- Establish the precise pensionable salary composition and annualization for a participant starting 2026-09-01: applicable salary rows, structural allowances, EJU basis, and the participation-start annual basis. Obtain an authoritative new-participant example to lock the 5.5% EJU transition against the 8% cash reserve.
- Verify PFZW coverage and the labor-condition/arrangement assignment for Frits from authorized source records. For his corrected October eight hours, identify the applicable Kinderopvang ADV/vacation uplift and which hours enter PFZW scheme hours; apply PFZW’s two-decimal hours rule only after that source value is proven.
- Confirm the CAO/OAK 12.9%/13.0% OP/NP and 0%/3.4% WIA split applies to Frits’s effective arrangement. Preserve separate employee pension, employer pension, and fiscal wage bases. Then lock the fiscal deduction mapping and end-to-end cents with an independent oracle.

Implementation sequence after those sources arrive: extend the period-aware rule in `packages/payroll-rules-nl-2026/src/pfzw-2026-kinderopvang-jan.ts` and `pfzw-2026-kinderopvang-jan.test.ts`; project validated participation, salary composition, contract/full-time norm, scheme hours/uplift, and provenance in `apps/hr-suite/lib/payroll/payrun01-source-projection.ts` / `.test.ts` and `apps/hr-suite/lib/payroll/source/liquid-hr-source-provider.ts` / `.test.ts`; add persisted components/dependencies in `packages/payroll-rules-nl-2026/src/payrun01-composition.ts`; and enforce source/rule readiness in `apps/hr-suite/lib/payroll/payrun01-service.ts`, `validation-pack.ts`, and `payrun01-independent-oracle.ts` with their paired tests. Add acceptance oracles for the 2026-09-01 new participant and corrected October eight-hour case, including salary/EJU, DTF, franchise/cap, extra-hours uplift, allocation, split, fiscal bases, rounding, and reconciliation. Reject incomplete source rather than producing numeric pension. Only after approval should normal immutable September and October successor runs be created through the authorized service lifecycle; preserve the finalized October pre-PFZW run and all earlier artifacts.

### Current handoff

Prior engineering evidence remains recorded: ESS authorization service tests 9/9; focused regression set 16 files / 130 tests; strict TypeScript, changed-source ESLint, 42 NL/EN namespace pairs, and `git diff --check` passed. These are prior evidence, not rerun as part of this read-only integration gate. The index migration contract test passed 2/2. Functional acceptance is preserved for Lisa FINALIZED `57ac6c10-7a02-49c4-a588-2ca244e621d9`, Jaap SUCCEEDED/CONCEPT `e20e0345-90ac-489b-9fee-7610b2d8f6a3`, and Frits pre-PFZW FINALIZED `338ef391-fbf6-435a-a4d7-e28a8024ebc2`.

**Recommendation: READY to begin the next isolated PFZW engineering/research/test phase.** The two-identity ESS browser test remains deferred by user decision; the protected runtime prerequisite blocks a production build; PFZW monthly/rounding/source inputs block pension implementation and successor runs; and migration lineage blocks migration application. No historical migration or payroll run was rewritten.
