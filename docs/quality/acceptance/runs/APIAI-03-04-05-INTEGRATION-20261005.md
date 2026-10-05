# APIAI-03/04/05 local adapter integration — 2026-10-05

## 1. Verdict

**LOCAL CONVERGENCE ACCEPTANCE: GREEN ON EXACT SOURCE SHA; FINAL PRODUCTION BUILD, PAYROLL BUNDLE SCAN, BROWSER PERSONA/MCP/WEBMCP ACCEPTANCE AND THREE INDEPENDENT REVIEWS COMPLETE WITH NO P0/P1. DRAFT PR #7 IS OPEN AND CLEAN; STATUS CHECKS AND VERCEL DEPLOYMENTS: NONE. EXTERNAL ACTIVATION: BLOCKED.** APIAI-01 provider/bearer/RLS/audit/database gates and ChatGPT-host acceptance remain open; local evidence does not close them.

## 2. Provenance and scope

- Branch: `work/apiai-030405-integrated-20261005`.
- Exact `origin/main` baseline at start: `6349d02538351cd01fc51f298c6e6fa0ba88006c`.
- PR #3 head integrated locally: `f6353c7aa0fc811dc065b402277a36f989b3542d`.
- PR #5 head integrated locally: `ce6a2ea6c1cc1e4071147076a411c60bff667d8f`.
- Integration checkpoint: `a7b84d102c65acca2f6ab3a49ab977040916255f`.
- Source commit: `1b9cbc3970589dc6be60c633162c7a0f5cf0ab73` (`feat(ai): add local MCP and WebMCP adapters`).
- Build candidate / committed delivery HEAD: `563028f1382d004d3938487c6d4ee8abf4b7d5ae`.
- No merge to main, version bump, Preview or Production deployment, public route activation, provider registration, public tunnel, remote database write, or migration apply occurred. The later authorized branch push and Draft PR are recorded in Section 11.

This run adds local adapters only. APIAI-01's external authentication and database security acceptance remains distinct and is not granted by these results.

## 3. Implementation results

| Slice | Result |
|---|---|
| APIAI-03 — local MCP transport | A stateless Streamable HTTP handler sits above the shared `dispatchWorkforceTool`. The Next route is closed by default and requires local development/test, the explicit feature flag, non-Vercel execution, HTTP loopback URL, a syntactically valid loopback Host authority with an optional port, and exact same-origin when an Origin header is present. Path, query, fragment, userinfo, backslash and comma-list Host values are rejected. The local Inspector profile advertises eight APIAI-02 read tools. |
| APIAI-04 — ChatGPT profile | A separate handler advertises only self-only `employee.talent.development-plans.read`, with strict empty input and the five approved output fields (`periodStart`, `periodEnd`, `progressPercent`, `status`, `completedAt`). Projection is applied to both structured and text content. This profile has no Next route. |
| APIAI-05 — WebMCP | Dashboard descriptors use existing audience, active permission, scope, and tenant-module checks. The client validates input against its supported published JSON Schema subset before sending, registers only read tools, uses the same-origin Workforce BFF, rejects caller context injection, and aborts/unregisters on lifecycle cleanup. All eight current catalog schemas pass the registration contract. The BFF/dispatcher remain authoritative. Unsupported browsers no-op without a polyfill. |
| Shared authorization | MCP and WebMCP use the APIAI-02 dispatcher/BFF. They add no parallel identity, database, or authorization path. HeRa remains on the same Workforce dispatcher. |

No database/schema/RLS/grants change and no MCP Apps UI widget were added.

## 4. Protocol and browser evidence

- Official MCP Inspector `2.9.0` ran `tools/list` with strict schema validation against temporary loopback harnesses. It found **8 tools** in the local role-test profile and **1 tool** in the ChatGPT profile. The harnesses were removed after the probe. No tool was executed by Inspector; this verifies the MCP handler protocol, not the authenticated Next route or ChatGPT host.
- An isolated Chrome Stable `154.0.8037.93` profile with the official WebMCP testing flag registered, called, and removed the native `liquidhr_employee_talent_skills_read` tool. The call used a local mock `fetch` response and verified the adapter's same-origin `POST /api/internal/workforce-tools`, same-origin credentials, no-store policy, request body, and cleanup. This verifies the native browser adapter path only; it does not prove an authenticated LiquidHR app or backend call.
- WebMCP contract tests reject missing required fields, invalid patterns, and extra fields before `fetch`, then verify valid input reaches the mock BFF. A catalog test confirms all eight current Workforce schemas can be registered.
- The temporary harness files, profile, browser, and local servers were removed/stopped. No unrelated browser profile was changed.

## 5. Automated and local quality gates

- Focused Vitest after the convergence-review fix: **37 files / 260 tests passed** across APIAI-01/02/03/04/05 and HeRa.
- Full HR suite on the corrected code with supported `--maxWorkers=4`: **545 files passed, 4 skipped; 2,369 tests passed, 8 skipped**.
- Strict HR TypeScript: passed with incremental output disabled.
- ESLint on changed source files: passed with zero warnings/errors.
- `git diff --check`: passed before documentation closeout.
- TEST launcher Pester: **3/3** at the preceding APIAI-01/02 integration checkpoint; launcher scripts were not changed in this slice and Pester was not rerun.
- Official local Production build on `563028f1382d004d3938487c6d4ee8abf4b7d5ae`: Next.js `16.3.6` compile and production TypeScript passed; **309/309** static pages generated; Payroll client-boundary negative control passed; scan passed across **152 browser assets**; build provenance recorded without runtime values.

The first full suite run under default parallelism hit the 20-second timeout in one unchanged Payroll boundary scanner. That scanner passed in isolation (1 file / 5 tests, 8.73 seconds); the subsequent complete run capped at four workers passed as recorded above.

## 6. Environment-gated acceptance

The official TEST launcher validated the required central runtime fields without displaying their values. It built the clean candidate above and started the local Production app at `http://127.0.0.1:3011`. The browser showed `/login?next=%2Fdashboard%2Fstart`; no valid authenticated TEST session was available. The server log contained `Invalid Refresh Token: Refresh Token Not Found`. No credentials were entered or exposed, and no Employee/Manager/HR persona matrix or authenticated app-route test was completed.

Anonymous loopback checks on that app returned `403 WORKFORCE_REQUEST_FORBIDDEN` for a Workforce read request and `404 MCP_UNAVAILABLE` for `/api/internal/mcp` in Production. These verify bounded anonymous denial and the Production MCP gate only. The server was stopped after the probe and port 3011 was confirmed to have no listener.

The canonical repository `apps/hr-suite/.env.local` was not read or modified. No configuration values or credentials were exposed.

## 7. Security, database, and external boundaries

- Public `/api/v1` remains unmounted; the ChatGPT profile is not exposed through a route.
- No bearer provider, OAuth/PKCE lifecycle, external identity mapping, or service-role fallback was introduced.
- Live authenticated `auth.uid()`/RLS behavior, tenant isolation, limiter concurrency/refill, READ audit persistence, PostgreSQL/pgTAP, advisors, type generation, and database readback were not tested in this run. APIAI-01 security/database acceptance remains open.
- No public HTTPS endpoint, tunnel, ChatGPT Developer Mode registration, or external host connection was created.
- There was no schema or data mutation.

## 8. Review and remaining work

The independent read-only LUNA MAX review found no P0/P1. Across its initial and follow-up passes it reported three P2 findings, all fixed with regression coverage: malformed `Host` authorities could parse as loopback; WebMCP did not validate published JSON Schema constraints before the BFF call; and a non-object schema root could be advertised despite the object-input execution contract. The corrected Host tests reject path/query/fragment/userinfo/backslash/comma-list values and invalid ports. WebMCP validates supported constraints before sending, rejects schemas with unsupported keywords, and advertises only object-root schemas. The final independent re-review found **no remaining P0/P1/P2**. Strict TypeScript, scoped ESLint, all five focused files / 35 tests, and the controlled full suite passed on the corrected source.

The adapter-only review preceded the later authenticated integrated-worktree run in Section 10. Three independent convergence reviews of the integrated candidate are complete; all found **no P0/P1**. The architecture review findings about stale MCP/WebMCP status and migration-source wording were corrected in the requirements and current context. The cross-channel review found a P2 409 context-selection error-code drift; the shared dispatcher now returns CONTEXT_SELECTION_REQUIRED, the BFF preserves it as 409, MCP/WebMCP preserve the bounded code, and HeRa maps it to its bounded denial. Five focused regression tests cover the dispatcher and all adapters. The security review noted that local MCP tools/list exposes the shared eight-tool catalog to all local roles; this is documented as a local-only discovery limitation, while every execution remains server-authorized. The static catalog does not block a dormant local Draft PR. Remaining acceptance gates are APIAI-01 provider/bearer/RLS/limiter/audit/database evidence and ChatGPT-host acceptance; any public endpoint requires a separately authorized external step.

## 9. Final status

**LOCAL AUTHENTICATED PERSONA / BFF / MCP / NATIVE WEBMCP ACCEPTANCE, AUTOMATED REGRESSION GATES, EXACT-SHA PRODUCTION BUILD / PAYROLL SCAN, AND THREE INDEPENDENT REVIEWS: GREEN WITH NO P0/P1. DRAFT PR #7: OPEN / DRAFT / MERGEABLE CLEAN; NO CHECK RUNS OR VERCEL DEPLOYMENTS. APIAI-01 SECURITY-DATABASE / PROVIDER / CHATGPT-HOST / HOSTED ACTIVATION: OPEN; EXTERNAL ACTIVATION BLOCKED.**

## 10. Authenticated local acceptance continuation — 2026-10-05

This section records the later run on the integrated worktree. It supersedes the earlier Section 6 statement that no authenticated persona/BFF run was available. The official scripts/start-test-worktree.ps1 Development launcher used the central TEST configuration on loopback port 3015. Fresh synthetic Test HR Admin login, ordinary role switching, logout, and HR-group selection were used; no auth bypass or credential values were exposed. The owned local server was stopped after the probes.

- **Employee:** real Workforce BFF returned Development Plans 200/6, gaps 200/4, skills 200/0; a forged employeeId was rejected. Real MCP initialize/tools/list/call returned self-only Development Plans with structured output; forged employee scope returned bounded MCP_INPUT_INVALID; Manager/HR tools returned ACCESS_DENIED.
- **Manager:** after full re-login, real BFF and MCP team matrix returned 5 direct-team rows under the selected Planeten context. Forged employeeId, teamId, tenantId, HR-group, and administration filters returned INPUT_INVALID; Employee/HR tool execution returned ACCESS_DENIED; malformed input was 400, unknown tool 404, and a request above 16 KiB was 413. Selecting the allowed Stap 6 test group through the normal context selector made both BFF and MCP return zero rows.
- **HR Admin:** fresh login after Manager logout returned 25 tenant-matrix rows through BFF and MCP. Employee-only and Manager tools returned ACCESS_DENIED; forged context filters returned INPUT_INVALID; a forged top-level tenant selection returned WORKFORCE_REQUEST_INVALID. Structured MCP output matched its text projection.
- **MCP discovery boundary:** tools/list is a shared static catalog of 8 tools for each role; it is not role-filtered. Every execution was rechecked by the shared dispatcher, and mismatched role execution was denied as above. Do not interpret discovery as authorization.
- **Native WebMCP:** isolated Chrome 154.0.8037.93 with the official WebMCP test flag used the real document.modelContext.getTools() / executeTool() APIs and real same-origin BFF/dispatcher. Employee registered 6 tools and returned 6 plans; Manager registered 1 tool and returned 5 rows, then 0 after HR-group context change; HR Admin registered 1 tool and returned 25 tenant rows. Role changes replaced registrations. An aborted Employee call rejected with AbortError; logout cleared the registry and an unauthenticated BFF request returned 401. Headless Chrome without the flag had no document.modelContext, so the feature remained a no-op. No unrelated Chrome profile was used.
- The dashboard serialization regression was reproduced before the source fix: Zod JSON Schema carried a non-enumerable ~standard property across the Server/Client boundary. The client projection now includes only id, description, operation, and inputSchema, round-trips through JSON, and is strict-validated. Its regression test checks plain data and absence of ~standard.
- Current source regression gates: focused APIAI-01/02/03/04/05 and HeRa 37 files / 260 tests passed; full HR suite 545 files passed, 4 skipped; 2,369 tests passed, 8 skipped; strict TypeScript, changed-file ESLint, i18n parity (41 NL/EN namespaces), and launcher Pester 3/3 passed. Live HeRa Gemini inference was not run.

The earlier pending statement is superseded by Section 11. Draft PR #7 is open; the handoff readback is recorded there. No merge or deployment is included.

## 11. Exact-source final acceptance closeout — 2026-10-05

The final code candidate is source commit 6e443463561e77d3039a1e2afb1bbcaecff548b0 on work/apiai-030405-integrated-20261005. The official local Production build on this exact source passed Next.js 16.3.6 compilation and production TypeScript, generated 309/309 static pages, passed the Payroll client-boundary negative control and the scan of 152 browser assets, and recorded build provenance for this SHA. The documentation closeout is a separate commit; it does not change this source SHA.

Exact-source Production-mode probes remained fail-closed: an anonymous same-origin Workforce BFF POST returned 401 AUTHENTICATION_REQUIRED; POST /api/internal/mcp returned 404 MCP_UNAVAILABLE; /api/v1/tools returned 404. No route was mounted or activated.

The authenticated local run used scripts/start-test-worktree.ps1 on loopback port 3015 with the central TEST configuration and a task-only Chrome profile. A clean Development restart after removing only the stale .next/dev generated cache produced a browser pass with zero console errors. The normal role sequence was also explicitly completed: Employee logout, fresh Test HR Admin login, then normal Test Role Switcher transition to Manager. In the resulting Manager context, the former Employee skills BFF tool returned 403 ACCESS_DENIED and the Manager team matrix returned 200 with 5 rows. Manager logout followed by fresh Test HR Admin login and Planeten context selection returned 25 HR-matrix rows; the former Manager tool returned 403 ACCESS_DENIED.

The earlier full exact-source persona matrix remains valid: Employee Development Plans returned 6, development gaps 4 and skills 0; Manager returned 5 direct-team rows and 0 after selecting the allowed Stap 6 test group; HR Admin returned 25 tenant rows. Forged context filters and role-mismatched calls were rejected. MCP initialize returned 200 Streamable HTTP SSE with protocol 2025-06-18; tools/list returned the static local catalog of 8; authenticated tools/call exercised the shared dispatcher and structured output. Employee, Manager and HR Admin MCP calls respected the same scopes, and cross-role execution returned bounded ACCESS_DENIED.

Native WebMCP ran in isolated Chrome 154.0.8037.93 with the official local test flag. Employee, Manager and HR Admin pages registered 6, 1 and 1 tools respectively and executed through the real same-origin BFF and shared dispatcher with 6 plans, 5 direct-team rows and 25 tenant rows. A Manager context change reduced its result to 0; role changes replaced the registrations; an in-flight call rejected with AbortError; logout unregistered tools and an unauthenticated BFF call returned 401. Headless Chrome without the testing flag had no document.modelContext and safely no-oped.

A separate repeated synthetic login initially encountered TEST environment clock skew (PGRST303, JWT issued at future) and a dashboard 500. After the token validity window passed, normal HR-group selection and the Employee logout, Manager switch, Manager logout and fresh HR Admin checks completed successfully without code changes. The browser error recorded by that first repeated attempt is environment evidence; it did not replace the earlier clean exact-source pass.

The five focused adapter regressions, 37 files / 260 tests across APIAI-01/02/03/04/05 and HeRa, full HR suite (545 files passed, 4 skipped; 2,369 tests passed, 8 skipped), strict TypeScript, changed-file ESLint, 41 NL/EN namespace parity checks and launcher Pester 3/3 all passed. Independent Security/Auth, Architecture/ONE VERSION and cross-channel reviews have no remaining P0/P1; the P2 context-selection code drift was normalized and covered by five regressions.

Post-push readback confirmed main remains at 6349d02538351cd01fc51f298c6e6fa0ba88006c; PR #3 and PR #5 remain open Draft at their unchanged heads f6353c7aa0fc811dc065b402277a36f989b3542d and ce6a2ea6c1cc1e4071147076a411c60bff667d8f. The convergence branch is pushed and has one Draft PR: #7, feat(ai): converge API, Workforce tools, MCP, ChatGPT and WebMCP, targeting main. GitHub readback reports mergeable=true / clean; combined statuses and check-runs are empty. At that post-create readback Vercel returned zero deployments for the branch; vercel.json disables Git deployments.

APIAI-01 live bearer/RLS, provider lifecycle, audit/limiter and isolated database gates remain OPEN. ChatGPT-host acceptance remains OPEN. No hosted deployment, remote migration, merge, tunnel, external registration, public MCP, /api/v1 activation or version change occurred. Conclusion for the dormant candidate: CONVERGENCE READY / EXTERNAL ACTIVATION BLOCKED.
