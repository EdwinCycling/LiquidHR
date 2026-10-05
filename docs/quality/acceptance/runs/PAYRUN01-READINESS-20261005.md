# PAYRUN01 — Complete Individual Payroll + TEST Persona Readiness — 2026-10-05

## Verdict

**NO-GO — PARTIAL / NOT RELEASE-READY.** The exact local candidate now passes its guarded build, local Production safety smoke, authenticated six-cell persona matrix, and separate Payroll Lab Admin desktop/mobile check. The individual Jan/Lisa payroll Definition of Done is still not met: required source contracts, persona authority, statutory/CAO inputs, cumulative basis, employer costs, controls, persisted results, independent comparison, and payslip artifacts are absent or unsupported. No approximate payroll result was produced.

This is the requested GO/NO-GO checkpoint. Do not merge, push, bump the app version, deploy, promote a deployment, or start payment/Loonaangifte flows from this result.

## Candidate and runtime provenance

- Worktree: C:\Users\Edwin\Documents\Apps\LiquidHR-Payroll\Integration-PAY-CONVERGE-20261004
- Branch: integration/pay-converge-20261004
- Baseline: origin/main was previously read-only verified at 6349d02538351cd01fc51f298c6e6fa0ba88006c.
- Exact code commit: c04d8e615afd3d1f42067c38840f8c83f43c3b3f — fix(payroll): correct source boundaries and persona readiness.
- The code worktree is clean at that SHA. App version remains 1.20261002.1.
- The protected canonical local config and approved central TEST config both exist. The central file passed the repository launcher’s secret-safe checks with the real user profile. They are distinct files, not a hardlink; the central file was already valid, so neither file was copied, replaced, or relinked. No config values were printed or recorded.
- The sandbox shell redirected LOCALAPPDATA to a sandbox profile and initially produced a false “missing config” result. Re-running the repository preflight with the real user profile returned GREEN. This was a profile-path difference, not a config repair.
- PAYRUN acceptance preflight confirmed the fixed Core TEST project, fixed Payroll Lab TEST project, enabled Payroll Lab flag, required variable names, dependency consistency, absence of conflicting .env sidecars and inherited runtime shadows, and free loopback port 3013. Values remained hidden.
- Guarded Production build source commit: c04d8e615afd3d1f42067c38840f8c83f43c3b3f. Build ID: 6o13BAPGCNJLUx68dWNCy. The client-boundary negative control passed; the scanner passed on 152 browser assets.
- The Production launcher served the build on 127.0.0.1:3013. Its exact launch session was stopped after smoke checks; a follow-up request confirmed the port was closed. The browser harness separately stopped each Development runtime it owned.

## Local code and runtime gates

| Gate | Result |
|---|---|
| Full serial HR-suite, Node 24.19.0 | PASS — 523 test files; 2,217 passed; 3 skipped |
| Strict TypeScript | PASS — HR-suite and payroll-rules-cao-bench02 |
| ESLint | PASS — zero errors; six existing warnings in payroll-import/service.test.ts |
| NL/EN i18n | PASS — 41 namespaces |
| Runtime launcher contract | PASS |
| Guarded Production build and provenance | PASS — source SHA matches c04d8e615afd3d1f42067c38840f8c83f43c3b3f |
| Production preflight and Development acceptance preflight | PASS — exact candidate; no server started during preflight |
| Authenticated persona matrix | PASS — 6/6 cells; HR Admin, Manager, Employee; desktop 1440×900 and iPhone 16 393×852 |
| Payroll Lab Admin route | PASS — /payroll-lab desktop and iPhone 16, 2/2 cells |
| Production anonymous safety smoke | PASS — see below |

The first six-cell browser attempt using the default 15-second action timeout encountered a transient context transport failure and role-switch destination timeout. The supported 30-second runner timeout retest passed 6/6 without source changes. Its result reported the exact candidate SHA, clean worktree, and successful owned-runtime cleanup. A separate Admin Payroll Lab run caused Next.js to change only the generated apps/hr-suite/next-env.d.ts imports; those two generated import lines were restored to the committed contents, and the candidate worktree is clean.

### Production smoke and authorization evidence

All requests were anonymous and sent to the local Production server.

| Request | Result |
|---|---:|
| GET /login | 200; no-store |
| POST /api/auth/test-login | 404 |
| POST /api/auth/test-role-switch | 404 |
| Same-origin POST /api/payroll-lab/capability with enabled=true | 403; no capability change |
| GET /api/payroll-lab/validation-pack with a valid-format case key/run ID | 401; no-store |

The successful browser matrix used existing local TEST identities in De Sterren holding → Planeten → Jupiter BV. HR Admin and Manager matched the selected administration; Employee context was server-authorized and consistent with its accessible set. Manager and Employee received 403 on GET /api/roles. The Payroll validation-pack probe returned 404 for Manager and 403 for Employee. The Manager 404 used a deliberately nonexistent run ID; it proves no result was returned for that request, not the cross-administration security boundary. A Mars-only administrator → Jupiter negative remains open under SEC-PAY-001.

The separate HR Admin /payroll-lab route returned 200 at both viewports, with zero console errors and zero page errors. The full persona matrix passed; route/API statuses were recorded by the repository harness. No hosted route was contacted. Local results do not prove Vercel Preview or Production behavior.

## Read-only Jan/Lisa readiness

Core TEST and Payroll Lab TEST were inspected without exposing BSN, complete IBAN, credentials, or secret values. No employee, employment, bank, tax, payroll, arrangement, or schema data was changed; no Auth account was created or provisioned. The browser matrix used existing TEST identities and their normal local sign-in/role-switch flows.

| Persona | Confirmed source state | Readiness |
|---|---|---|
| Jan | Active employment covers 1 September–30 November 2026. Salary and schedule records meet at the 1 October transition using half-open [valid_from, valid_until) semantics; they are adjacent, not overlapping, and the source adapter regression now covers that boundary. No linked Auth identity; income relationship remains DRAFT; no bank account; no valid October payroll tax-number row. | Not ready for an individual run. |
| Lisa | Active employment from 1 January 2026; salary and schedule source rows are present. An Auth identity exists, but effective Payroll permission has not been proven. Income relationship remains DRAFT; one bank account and one primary are present, without reading account contents. | Not ready for an individual run. |

Neither employment has a direct Payroll Lab source snapshot, arrangement assignment, or composition snapshot. No October 2026 Payroll Lab period exists. Historical CAO-BENCH02 runs and NL-2026 synthetic runs were preserved. No new calculation or business-data write was made.

## PAYRUN01 Definition of Done

| Requirement | Status and evidence |
|---|---|
| First-bank-account-primary behavior | PASS in code: server default and UI checkbox behavior have regression coverage. |
| BSN maintenance UI | PASS in code: write control is separate from read/reveal permission, uses the audited update route, starts blank, and has permission regression coverage. No BSN value was read. A live per-person read/write permission check remains OPEN. |
| Jan Kinderopvang arrangement and real salary structure | OPEN. The CAO maps salary scale to the employee’s function via its function matrix. Jan’s accepted function/scale/number mapping is not proven, so no band or salary has been inferred. |
| Lisa company / freely negotiated arrangement | OPEN. The actual company policy is unavailable; the synthetic LHR_DEMO_OPEN_BANDS_2026 fixture is not accepted as company policy. |
| October 2026 payroll period | Target period is explicitly October 2026. No corresponding Payroll Lab period record exists and no period was created. |
| Jan generic-engine calculation | UNSUPPORTED / SOURCE_GAP. The source provider is not wired into the current NL-2026 run service, whose accepted runner is a static September synthetic case. Income relationship is unsupported; tax profile has no accepted source contract; IKV, fiscal-credit, bank, and PFZW inputs are not accepted by this pipeline. |
| Lisa generic-engine calculation | UNSUPPORTED / SOURCE_GAP for the same source-contract and pipeline gaps; no separate result was created. |
| Cumulative/YTD basis | OPEN. No accepted year-to-date source basis or October payroll history is available for either employee. |
| Statutory tax scope | LIMITED. The existing NL-2026 package is restricted to its documented standard 2026 white monthly table case; it does not establish full legal coverage, multi-IKV treatment, or special situations. See the [Belastingdienst 2026 white monthly table](https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf). |
| CAO scope | OPEN for individual application. Kinderopvang salary depends on the mapped function and corresponding salary scale; the official scale increase is 1.5% from 1 September 2026. See [CAO salary determination](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/het-salaris-bepalen). |
| Pension | OPEN. PFZW publishes 2026 basis premium 25.9%, franchise €17,283, salary cap €137,800, and WIA-excess 3.4% / €79,409 franchise. Whether the employer must or may participate has not been determined, and no employee pensionable basis is accepted. See [PFZW 2026 rates](https://www.pfzw.nl/werkgevers/premie-en-factuur/premiepercentages-en-franchises.html) and [PFZW participation criteria](https://www.pfzw.nl/werkgevers/pensioen-bij-ons/klant-worden/moet-of-mag-ik-aansluiten.html). |
| Employer costs and reserves | OPEN / not implemented for these personas. |
| Controls and review/finalize/close lifecycle | OPEN / unavailable for these individual calculations. |
| Persistence, database readback, immutable result, hashes | NOT CREATED. No persona snapshot, assignment, composition, run, result hash, or readback exists. |
| Independent oracle | NOT AVAILABLE for Jan or Lisa because no accepted input/result exists. The existing independent fixture comparisons do not validate either person’s payroll. |
| Payslip PDF and JSON | NOT CREATED for Jan or Lisa. |
| Payroll scope negatives | Partial local evidence: Production fail-closed probes and Manager/Employee denial/hiding responses are above. Cross-administration Admin negative and live BSN read/write split remain OPEN. |

## Remaining AA items and decision

Keep SEC-PAY-001, PAY-RULE-002, PAY-COVER-003, PAY-CORE-004, and ENV-PREVIEW-010 OPEN. No full tax/CAO/pension compliance claim is made. Preview/hosted acceptance is absent; no candidate SHA is deployed.

The hard blockers for the individual payroll DoD are the missing accepted Core-to-Payroll contract and tax/IKV inputs, Jan identity and function/scale mapping, Lisa’s company compensation policy and effective Payroll authorization, missing YTD basis and payroll-period record, unresolved pension applicability, and missing cost/control/result-artifact lifecycle. Resolving them requires accepted source/authority evidence before code can safely produce an individual payroll result.

**Final checkpoint: NO-GO.** Keep code commit c04d8e615afd3d1f42067c38840f8c83f43c3b3f local. No push, merge, version bump, migration, account provisioning, deployment, promotion, Loonaangifte submission, payment execution, PAYRUN02, Continuous Payroll, or Component Designer work was performed.
