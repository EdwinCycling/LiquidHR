# APIAI-03/04/05 local adapter integration — 2026-10-05

## 1. Verdict

**PARTIAL / NOT RELEASE-READY.** The local MCP transport, ChatGPT-specific MCP profile, WebMCP progressive enhancement, automated regression gates, MCP Inspector protocol checks, and native Chrome WebMCP adapter smoke passed. The authenticated Next.js route, persona/BFF browser matrix, production build and bundle scan were not run because the approved TEST launcher could not find its central runtime configuration. Provider, bearer/RLS/audit, public hosting, and ChatGPT-host acceptance remain open.

## 2. Provenance and scope

- Branch: `work/apiai-030405-integrated-20261005`.
- Exact `origin/main` baseline at start: `6349d02538351cd01fc51f298c6e6fa0ba88006c`.
- PR #3 head integrated locally: `f6353c7aa0fc811dc065b402277a36f989b3542d`.
- PR #5 head integrated locally: `ce6a2ea6c1cc1e4071147076a411c60bff667d8f`.
- Integration checkpoint: `a7b84d102c65acca2f6ab3a49ab977040916255f`.
- Source commit: `1b9cbc3970589dc6be60c633162c7a0f5cf0ab73` (`feat(ai): add local MCP and WebMCP adapters`).
- No push, PR edit, merge to `main`, version bump, Preview or Production deployment, public route activation, provider registration, public tunnel, remote database write, or migration apply occurred.

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

- Focused Vitest after the review fixes: **5 files / 35 tests passed** (MCP server, local route, ChatGPT metadata, WebMCP, and Workforce registry).
- Full HR suite on the corrected code with supported `--maxWorkers=4`: **545 files passed, 4 skipped; 2,363 tests passed, 8 skipped**.
- Strict HR TypeScript: passed with incremental output disabled.
- ESLint on changed source files: passed with zero warnings/errors.
- `git diff --check`: passed before documentation closeout.
- TEST launcher Pester: **3/3** at the preceding APIAI-01/02 integration checkpoint; launcher scripts were not changed in this slice and Pester was not rerun.

The first full suite run under default parallelism hit the 20-second timeout in one unchanged Payroll boundary scanner. That scanner passed in isolation (1 file / 5 tests, 8.73 seconds); the subsequent complete run capped at four workers passed as recorded above.

No production build or bundle-boundary scan has run yet. The latest official `-Mode Production -PayrollAcceptance -Build` invocation validated central TEST variable presence without displaying values, then stopped before compilation because delivery documentation was uncommitted and the launcher requires a clean, committed candidate. The documentation commit will provide that candidate; the official build can then be retried.

## 6. Environment-gated acceptance

An earlier official Development preflight reported the central `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local` configuration missing. On the later Production build invocation, the same launcher validated the required central TEST variables without showing their values; it rejected the build before compilation because the worktree was not clean. No alternate configuration was used. No authenticated app session was started, and no live MCP/BFF call, Employee/Manager/HR persona matrix, app-route browser test, or production build was performed.

The canonical repository `apps/hr-suite/.env.local` was not read or modified. No configuration values or credentials were exposed.

## 7. Security, database, and external boundaries

- Public `/api/v1` remains unmounted; the ChatGPT profile is not exposed through a route.
- No bearer provider, OAuth/PKCE lifecycle, external identity mapping, or service-role fallback was introduced.
- Live `auth.uid()`/RLS behavior, tenant isolation, limiter concurrency/refill, READ audit persistence, PostgreSQL/pgTAP, advisors, type generation, and database readback were not tested in this run. APIAI-01 security/database acceptance remains open.
- No public HTTPS endpoint, tunnel, ChatGPT Developer Mode registration, or external host connection was created.
- There was no schema or data mutation.

## 8. Review and remaining work

The independent read-only LUNA MAX review found no P0/P1. Across its initial and follow-up passes it reported three P2 findings, all fixed with regression coverage: malformed `Host` authorities could parse as loopback; WebMCP did not validate published JSON Schema constraints before the BFF call; and a non-object schema root could be advertised despite the object-input execution contract. The corrected Host tests reject path/query/fragment/userinfo/backslash/comma-list values and invalid ports. WebMCP validates supported constraints before sending, rejects schemas with unsupported keywords, and advertises only object-root schemas. The final independent re-review found **no remaining P0/P1/P2**. Strict TypeScript, scoped ESLint, all five focused files / 35 tests, and the controlled full suite passed on the corrected source.

Remaining acceptance gates include the approved TEST runtime configuration, authenticated route and persona/BFF checks, official build and client-boundary scan, and APIAI-01 provider/bearer/RLS/limiter/audit evidence. ChatGPT host connection and any public endpoint require a separately authorized external step.

## 9. Final status

**LOCAL CODE / AUTOMATED TESTS / MCP INSPECTOR / NATIVE WEBMCP SMOKE: GREEN. AUTHENTICATED APP / BUILD / SECURITY-DATABASE / HOSTED ACCEPTANCE: OPEN. PARTIAL / NOT RELEASE-READY.**
