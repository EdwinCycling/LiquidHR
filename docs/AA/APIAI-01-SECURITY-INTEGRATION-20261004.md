# APIAI-01 — security-integratie en end-to-end acceptatie

- **Datum:** 2026-10-04
- **Status:** **PARTIAL / SECURITY GATES OPEN / EXTERNAL ACTIVATION BLOCKED**
- **Branch:** `work/apiai-01-build-20261003`
- **Baseline:** GitHub `main` `6349d02538351cd01fc51f298c6e6fa0ba88006c`
- **Upstream PR:** [draft PR #3](https://github.com/EdwinCycling/LiquidHR/pull/3), target `main`
- **PR head at live recheck:** `399d596cbfd7cd5827f2d3f3eed60c40d40ba6dd`; this remained the remote head at the final pre-commit check. The local, unpushed code candidate SHA is recorded after the production-mode build below.
- **Scope boundary:** no OAuth activation, external route mount, remote migration, deployment, push, or merge.

## 1. Summary

APIAI-01 now has a local bearer-to-RLS request seam and a self-only Development Plans adapter that injects the same validated request context/client into the existing Talent service. Permission checks retain existing self-service/ESS/preboarding rules. Limiter and READ-audit wrappers are bound to that request RLS client and fail closed. Workforce Summary remains only `asOfDate` and is not a useful completed resource; its proposed count is withheld pending privacy approval. Team Skills remains deferred. All three public API routes remain unmounted.

Local code/unit evidence can prepare further work, but it does not prove an OAuth provider, bearer claims, cross-tenant/HR-group/administration isolation in live RLS, token revocation, database atomicity/grants, or read-audit persistence. Security gates are not GREEN.

## 2. Current remote and worktree state

The live GitHub check on 2026-10-04 found PR #3 open, draft, unmerged, mergeable, and **3 commits ahead / 0 behind** `main`. A fresh GitHub compare confirmed remote `main` is still exactly `6349d02538351cd01fc51f298c6e6fa0ba88006c`; no rebase is needed. Remote PR #3 head is still `399d596cbfd7cd5827f2d3f3eed60c40d40ba6dd`. PR #2 is still open, draft, unmerged, and based on the same SHA, with head `2d284fe81e6f03cc090339de3fa73a939c2e0e07`.

The latest Vercel `liquidhr` Production deployment in the live read-only check was `dpl_63efkfC6BXosA9m1dQy7GjZ4Gho5`, state `READY`, source `main` SHA `6349d02538351cd01fc51f298c6e6fa0ba88006c`. A branch-filtered deployment query found no Preview for `work/apiai-01-build-20261003`. The project metadata did not expose whether Preview deployments are disabled or automatic. Because a push might cause an unapproved Preview deployment and the user excluded deployment, this run did not push or update PR #3. The primary local checkout is clean but its local `main` is older (`cb73260`); the implementation and both PRs were checked against the live GitHub `main` SHA above.

The implementation worktree began clean at `399d596`; all later changes in it belong to this run or its explicitly assigned APIAI subagents. The D0 documentation worktree was not changed. PR #2 remains a separate draft and must not be overwritten or merged by this run.

## 3. Integrated contributions

| Workstream | Integrated result | Boundary / still unproven |
| --- | --- | --- |
| A — OAuth/provider | Official docs confirm Supabase OAuth Server supports Authorization Code + PKCE and access-token `client_id`, with a Custom Access Token Hook for audience claims. Native scopes are OIDC profile scopes; documented configuration does not enforce S256-only, and existing stateless JWT rejection after revoke needs an explicit liveness check. Keycloak 26.8 documents per-client `S256`, client scopes, audience and introspection/revocation paths, so it is the stronger alternative candidate for a provider trial. | Neither provider is runtime-proven or selected. The worktree has no Docker daemon, Java, Keycloak or Supabase CLI; shared TEST OAuth is disabled. No token, client, provider config, project, or database was changed. |
| B — bearer/AuthContext/RLS | Strict bearer parsing; exact `(issuer, subject)` account link; active-client gate; module-private bearer-client brand and private exact-token binding; explicit `getClaims(accessToken)`; current accessible context through that same client; ambiguous multiple-context cases fail closed. Local Supabase-client tests capture the synthetic bearer on Auth and REST requests and confirm no cookies are sent. | This proves client construction and code-level binding only. Provider-issued token validity, external client binding, live database RLS and cross-tenant/HR-group/administration negatives remain unproven. No service-role or browser-cookie fallback exists in this path. |
| C — resources | Self Development Plans is connected to existing `listTalentGoals` through explicitly injected AuthContext and bearer RLS client. The service selects only tenant, employee, period, progress, status and completion fields; it filters by server-derived tenant and employee and checks existing permission and TALENT-module access. Projection rejects tenant or employee mismatches and excludes title/free text and internal IDs. | Workforce count and Team Skills remain unimplemented/deferred; no public route mounted. Self-query behavior has not been validated against live bearer RLS. |
| D — limiter/audit | Typed allowlisted RPC wrapper payloads; bounded decision validation; missing/error responses fail closed; audit excludes fabricated entity IDs and HR payloads. | RPC/DDL, permissions, RLS, grants, database atomicity, concurrency and retention remain unimplemented/unverified. |
| E — official launcher | Development bridge loads the approved central TEST config without forwarding `--env-file` to Next child `NODE_OPTIONS`; launcher regression tests added. Official Development server started on checked free port 3015. Normal local TEST HR Admin login succeeded; the existing switcher fully re-logged into Manager and Employee personas. | `127.0.0.1` was rejected by the existing exact-Origin check; `localhost` succeeded. Manager/Yara and Employee/Noah dashboards rendered with narrowed navigation and no browser console errors. The server logged two invalid-refresh-token responses while leaving the pre-existing local auth session; subsequent TEST login and role changes completed. This is not API bearer evidence. |

Core service integration extracts an explicit-context permission helper preserving existing database-backed self/ESS/preboarding logic. The existing Goal service now accepts delegated dependencies only for `mode: 'self'`; manager/admin injection is rejected. `protected-get` requires the permission through that helper before reading and supplies one bearer-bound RLS wrapper to the read, limiter and audit factories.

## 4. Evidence matrix

| Gate | Result | Evidence / scope |
| --- | --- | --- |
| APIAI auth/resource/security tests | **PASS locally** | Final focused set: 5 files / 39 passed; added unbranded service-wrapper guard then reran its file: 1 file / 4 passed. The full suite includes API/OpenAPI contract tests. |
| TypeScript | **PASS locally** | `npm.cmd run type-check -- --incremental false`, including the final service-guard test. |
| Changed-file ESLint | **PASS locally** | ESLint over all changed APIAI/auth/service/test TypeScript files; 0 errors and 0 warnings. |
| Launcher regression | **PASS locally** | Pester: 2 passed, 0 failed. |
| Development official preflight | **PASS locally** | `scripts/start-test-worktree.ps1 -Mode Development -Port 3015 -PreflightOnly`; dependencies and approved central TEST target validated, values hidden. |
| Full HR suite | **PASS locally** | Final sequential `npm.cmd run test -- --no-file-parallelism --maxWorkers=1`: 527 files passed, 4 skipped; 2,233 tests passed, 8 skipped (2,241 total), duration 263.89 seconds. |
| Official local Development/browser | **PASS locally** | Launcher preflight passed on free port 3015. Browser login via the TEST HR Admin control succeeded; the role switcher re-logged as Test Manager (Yara) and Test Employee (Noah). Dashboard and scoped navigation rendered; no browser console errors. No bearer/API behavior is claimed. |
| Official Production-mode build | **PENDING** | Launcher requires the final candidate to be committed and clean before exact-commit TEST build/provenance. |
| OAuth provider / token | **NOT PROVEN** | No real Auth Code + PKCE S256, audience, client binding, token type, JWKS, account-link, unlink or revoke evidence. |
| Bearer/RLS positive and negatives | **NOT PROVEN** | Mocks verify code-level client/context binding only. No live bearer request tested across tenant, HR group, administration, user/subject mismatch or switched permissions. |
| Limiter / READ audit | **NOT PROVEN** | No database contract/RPC to exercise; no concurrent atomicity, RLS, grants, or stored audit readback. |
| Vercel / hosted | **NOT RUN** | No APIAI Preview, hosted browser, deployment, or production route test. |

The official Production build/runtime and final independent review remain pending; all reported PASS results above are local evidence only.

## 5. Provider trial and exact environment limit

The hosted Supabase TEST OAuth authorization-server metadata endpoint returned 404 `feature_disabled`; the tracked local configuration has `[auth.oauth_server].enabled = false`. There is no Supabase CLI installed, the Docker daemon is unavailable, and the isolated local Auth endpoint has no listener. The standard OIDC metadata response is not proof that Supabase OAuth Server is enabled. No client registration, Auth setting, external project, token, secret, database, container or project was modified.

A real provider gate remains **ENVIRONMENT-GATED / NOT PROVEN**. A local synthetic proof requires an isolated Supabase stack with Docker and a supported pinned CLI, a temporary test-only OAuth-enabled config and consent harness, a registered synthetic client, and explicit asymmetric signing/JWKS review. Required cases include PKCE S256 and wrong-verifier rejection, exact redirect, state/code replay negatives, access-token `aud` and `client_id`, ID-token rejection, issuer/subject link uniqueness, inactive client, current context, grant revoke followed by immediate use of the same still-unexpired token, and refresh-token rejection. Shared TEST activation or client registration is not part of this run.

The independent LUNA MAX review found that Supabase OAuth Server supports Authorization Code + PKCE but documents both `S256` and `plain`, without a project setting to reject `plain`; the standard audience is `authenticated` and a Custom Access Token Hook can adjust claims such as `aud`; the access token includes `client_id`, which is usable in RLS; native scopes cover OIDC profile data rather than LiquidHR resource permissions; and `revokeGrant` does not prove that every already-issued stateless JWT is immediately rejected. Protected routes would need a per-request session/grant-liveness check, or a provider/gateway with a proven immediate rejection contract. Primary sources: [OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows), [token security](https://supabase.com/docs/guides/auth/oauth-server/token-security), [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook), [sessions](https://supabase.com/docs/guides/auth/sessions), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

The LUNA MAX alternative-provider review found Keycloak 26.8 documents per-client `S256` selection, audience mappers, custom client scopes/consent, OIDC introspection and a token revocation path. However, docs alone do not prove a LiquidHR route rejects the same still-unexpired token immediately after revoke; per-request introspection/revocation-aware validation with no positive cache and a same-token negative HTTP test are still required. Keycloak client delegation uses a Preview feature and is excluded from this proposal. The official sources are the [Server Administration Guide](https://www.keycloak.org/docs/26.8.0/server_admin/), [OIDC endpoints](https://www.keycloak.org/securing-apps/oidc-layers), [Authorization Services](https://www.keycloak.org/docs/latest/authorization_services/index.html), [DPoP](https://www.keycloak.org/securing-apps/dpop), [token exchange](https://www.keycloak.org/securing-apps/token-exchange), and [RevokedTokenProvider API](https://www.keycloak.org/docs-api/latest/javadocs/org/keycloak/models/RevokedTokenProvider.html). The provider proof could not run here: Docker CLI exists but no daemon is reachable; Java, Keycloak and Supabase CLI are absent, and no relevant local listener/configuration exists. No container was started and no provider/config was changed. Therefore Keycloak is a **documented alternative candidate, not a proven or approved alternative**.

## 6. Resources, privacy and database contracts

- **Workforce Summary:** current projection is only `asOfDate`; it is not a meaningful completed API resource. `activeEmployeeCount` is only a conditional proposal, requiring approved population semantics, minimum cohort, suppression and anti-differencing controls. No count is exposed.
- **Development Plans:** local candidate fields are `periodStart`, `periodEnd`, `progressPercent`, `status`, and nullable `completedAt`. Employee is resolved from current `AuthContext.employeeId`; client-selected employee/context and free-text title are excluded. Tests exercise projector validation and service dependency injection, not live data under bearer RLS.
- **Team Skills:** deferred until a non-linkable field/filter/population contract is approved and proven. No IDs, employee labels, evidence or certificates are proposed for the first contract.
- **Limiter/audit:** the independent LUNA MAX review confirms the local TS wrappers enforce narrow payloads and fail closed, but storage-contract tests use mocks and the JavaScript `Map` limiter is only a test double. There are no matching SQL functions, tables, RLS/grants, concurrency proof or persisted audit readback. Existing `audit_logs` has no `READ`/`hr_group_id` and requires `entity_id`; proposed solution is a conditional nullable `entity_id` only for API `READ` events plus HR-group-aware audit reads, server-derived actor `auth.uid()`, and allowlisted read metadata. Proposal details and the alternative dedicated audit-table cost are in P-05. The proposed default is to persist `correlation_id` only; request/correlation header semantics and retention still need Product/Security approval.
- **Migration gate:** no migration was created or applied because the Supabase CLI and local database runtime are unavailable. No remote schema write, advisor run or database typegen occurred.

## 7. D0 review and decision requests

Independent read-only review of PR #2 found unresolved documentation issues: D0 does not state the bearer-to-existing-service contract; external scopes are not clearly distinguished from provider-native scopes; immediate revocation semantics and protocol-negative cases need to be explicit; the earlier D0 document has a `Development Plans.title` versus free-text privacy inconsistency; Team Skills filter/linkability limits need an explicit v1 boundary; a roadmap link is broken; the approved auth ADR-0002 is missing from cited sources; and the `docs/README.md` index does not link the APIAI document. The code work here addresses bearer/client/context injection for the local self-service adapter and omits title, but this run did not modify the D0 worktree or make PR #2 merge-ready. PR #2 remains a separate draft requiring document-owner updates.

Five detailed, still-unapproved proposals are in [APIAI-01-SECURITY-INTEGRATION-DECISIONS-20261004.md](APIAI-01-SECURITY-INTEGRATION-DECISIONS-20261004.md):

1. Provider/client lifecycle, claims, account link and immediate-revoke semantics.
2. External scope/capability mapping into canonical permissions, module checks and RLS.
3. First resource fields: self Development Plans candidate; meaningful workforce count conditional; Team Skills deferred.
4. Allowlist privacy, aggregation threshold, suppression and anti-differencing.
5. Atomic limiter, canonical READ-audit storage, no fabricated entity, quota and ID contract.

All five require the Product/Security/Privacy/Data decisions assigned in the addendum. They remain `PROPOSAL / NOT APPROVED` and must be recorded in ADR/FDR/approved contracts before the dependent routes or database work can be activated.

## 8. Current gates and remaining blocks

**GREEN locally (subject to final run):** typed delegated auth/service seam, self projection/unit contract, fail-closed wrapper behavior, strict TypeScript, scoped lint, launcher regression and official Development preflight.

**Not GREEN / blocks external API activation:** approved provider and actual OAuth proof; real active-token revocation behavior; approved scope and context-selection contract; live bearer-bound RLS proof for subject, tenant, HR group and administration; workforce/privacy field decision; Team Skills privacy/linkability decision if included; approved limiter/audit schema and actual atomic/RLS/grant/concurrency proof; independently reviewed committed candidate; exact runtime build/browser gates.

Work from CONVERGENCE01, CONTROL01, INS01 or AI01-A is not reopened as a prerequisite unless a specific APIAI dependency is found. Those independent workstream gates remain recorded in their own acceptance files.

## 9. Direct next execution prompt

> Continue APIAI-01 from draft PR #3 after the named Product, Security, Privacy and Data approvals are recorded. Keep the public `/api/v1` routes unmounted until approved provider/client registration, Authorization Code + PKCE S256, issuer/audience/client binding, exact `(issuer, subject)` account linking, active-token revocation and bearer-bound current `AuthContext`/RLS are proven with synthetic identities. Complete the approved read-only resource contracts: self Development Plans through the existing service only; Workforce Summary only if an approved privacy-safe aggregate is defined; keep Team Skills deferred until linkability and filters pass review. Implement the approved atomic limiter and canonical READ-audit contract in a local migration, run RLS/grant/advisor/typegen and concurrent fail-closed tests locally, and do not apply remote migrations without separate approval. Then run the full local suite, official TEST-configured build, normal login/persona/role-switch browser matrix and all positive/negative HTTP cases. Obtain an independent security review. Do not push if the connected Vercel project would create an unapproved Preview, and do not merge, deploy, or activate routes without the corresponding approval.
