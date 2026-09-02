# LIQUIDHR — COMPREHENSIVE SECURITY RE-REVIEW / SECOND OPINION

**Review date:** 2026-09-02
**Model intent:** independent security review, read/test/verify/document only
**Disposition:** READY FOR ROADMAP REVIEW — NO REMEDIATION IN THIS RUN

This is a fresh review of the current application state. It does not certify the application as secure and it does not replace a formal penetration test, privacy/DPIA assessment, malware analysis, or a provider assurance review.

## 1. Baseline and evidence boundary

### Authoritative baseline

- Authoritative Git baseline: `origin/main` at `155ccbde373a06684e37d9746b01dd65931c870b`.
- Visible application version at that baseline: `1.20260901.1`, from `apps/hr-suite/lib/app-version.ts`.
- Review branch: `security/comprehensive-rereview-20260902-luna-max`.
- Isolated review worktree: `.codex-worktrees/security-comprehensive-rereview-20260902-luna-max`.
- Review worktree started at the exact baseline SHA and was clean before review changes. The user's existing root worktree and older security worktrees were not used or modified.
- Canonical protected environment path: `apps/hr-suite/.env.local`. It existed before review and was not copied, read for values, modified, moved, deleted, staged, or committed. The isolated review worktree has no environment copy.

### Release and platform provenance

- Vercel production deployment: `dpl_7i52NwgRH1dTiKK3zu6uJWtppKMt`, state `READY`, target `production`, branch `main`, exact source SHA `155ccbde373a06684e37d9746b01dd65931c870b`.
- GitHub repository: `EdwinCycling/LiquidHR`; public default branch `main`.
- GitHub branch metadata reports `protected: false`, protection disabled, required-check enforcement `off`, and no configured required contexts/checks. The rulesets listing returned no rulesets. The branch-protection detail endpoint was not accessible to the read-only integration (`403`), so this conclusion is based on the public branch metadata and rulesets response, not an administrative settings export.
- The current commit has one successful Vercel status context, but it is not a required branch check. The current main commit is not GitHub-verified (`verified: false`, unsigned).
- Supabase project `wnpfloqpjvaacobppbpk` was inspected read-only. The project was healthy; the remote migration count was 409 versus 389 local migration files. No migration repair, pull, history edit, schema write, seed, or remote mutation was performed.

### Method and limitations

The review covered the current Next App Router/React/TypeScript source, auth/session helpers, authorization and tenant-context helpers, Supabase migrations and read-only catalog/advisor data, private Storage bucket configuration, upload routes and file rules, AI routes and tools, dependency lockfile and audit output, Git/GitHub/Vercel metadata, targeted tests, and passive production HTTP behavior.

Evidence included a passive production check of login, protected-route middleware behavior, selected unauthenticated API responses, headers, and selected asset endpoints. No production write, login with a customer credential, upload, application submission, role switch, AI action, or business-data mutation was attempted. The isolated worktree had no local environment, so no new authenticated local browser flow was run. Existing authenticated and production evidence in the prior security wave was used only as historical context and was rechecked against current source where possible.

## 2. Executive summary

### Current assessed posture

| Measure | Result |
| --- | ---: |
| Critical findings | 0 |
| High findings by assessed exploitability/impact | 0 |
| Medium findings | 5 |
| Low findings | 6 |
| New findings in this review | 4 |
| Proven regressions | 0 |
| Historical items closed and verified | 4 |
| Historical items hardened with residual risk | 3 |
| Historical items still open | 4 |

The dependency scanner reported four advisories labelled High: one production-tree transitive `nanoid` advisory (already tracked as SEC-009) and three dev/build-tree advisories (`brace-expansion`, `browserslist`, and `js-yaml`, tracked together as SEC-014). The assessed application risk is lower than the scanner label for the dev/build-only items; no direct application use or runtime exploit was proven.

The main decision blockers are public recruitment abuse resistance (SEC-012), Supabase leaked-password protection (SEC-008), the transitive production dependency (SEC-009), and release-governance controls on `main` (SEC-011). The highest product-impact residuals are the browser-readable Supabase session cookie (SEC-004), incomplete file-ingestion hardening outside the already scanned recruitment path (SEC-006), and the public recruitment rate-limit design (SEC-012).

## 3. New findings

### SEC-012 — Public recruitment anti-abuse limit is bypassable and race-prone

- **Status:** `OPEN`
- **Severity:** Medium
- **Confidence:** High
- **Affected area:** Public recruitment application intake at `app/api/public/recruitment/vacancies/[publicId]/applications/route.ts` and `lib/recruitment/public-intake-service.ts`.
- **Impact:** A caller who can obtain valid Turnstile challenges can rotate the caller-controlled idempotency key and email values to create new bucket keys. The intended five-request window therefore does not reliably cap requests per network address. The first forwarded address is also taken directly from `x-forwarded-for` (then `x-real-ip`) without an application-level trusted-proxy contract; where the boundary does not overwrite those headers, the caller can rotate or spoof the address component. The read-then-update counter is not an atomic conditional increment or locked claim, so concurrent requests can lose increments and issue multiple proofs against stale state. The likely impact is recruitment intake abuse, scanner/provider cost, mail/storage pressure, and availability degradation; no cross-tenant data exposure or privileged action was demonstrated.
- **Evidence:** The route builds `formFingerprint` from `${idempotencyKey}:${email}` and takes the network address from request headers. `createPublicIntakeKey` hashes both values. `createPublicIntakeProof` reads the current row, compares `request_count` with 5, then updates `request_count: current + 1` without a row lock or conditional update. The public submit RPC subsequently locks and validates a server-generated proof, which is a useful downstream control but does not repair the issuance/keying weakness.
- **Verification limit:** No production abuse attempt or load test was performed. This is a static finding with a clear reproduction hypothesis and should be verified in a non-production environment using key rotation, concurrent requests, and controlled forwarded-header values.
- **Recommendation:** Derive the rate-limit identity from a trusted edge/proxy signal, keep the form fingerprint independent of caller-controlled fields, enforce request-body limits before multipart parsing, add freshness/replay constraints, and issue/increment the window atomically in one database operation or RPC. Preserve the current fail-closed Turnstile and proof validation behavior.
- **Roadmap:** Immediate / Wave C; requires application, database/RPC, and proxy/provider contract work. Do not broaden public recruitment traffic until the abuse control is verified.

### SEC-013 — Excess anonymous CRUD grants weaken the RLS defense-in-depth boundary

- **Status:** `OPEN`
- **Severity:** Low
- **Confidence:** High
- **Affected area:** Supabase table ACLs and least-privilege posture.
- **Impact:** Read-only catalog inspection showed explicit `anon=arwdDxtm` privileges on 92 public tables, including sensitive or operational tables such as `company_documents`, `employee_documents`, `employee_secure_identifiers`, `administration_branding`, `ai_conversations`, `ai_messages`, `user_access`, `tenants`, and `payslips`. RLS was enabled on all 258 observed public tables, and the tested sensitive tables returned no rows to anonymous reads; therefore this review did not prove a current anonymous data breach. The risk is that a future policy, view, function, or schema change can accidentally turn these unnecessarily broad grants into direct anonymous CRUD access, and that insert/update/delete privileges materially enlarge the blast radius of an RLS mistake.
- **Evidence:** Remote catalog ACLs show the explicit anonymous privileges. Current table inspection reported RLS enabled for all 258 public tables; five service-only tables had no policies. Anonymous GET checks against representative sensitive tables returned HTTP 200 with empty results or HTTP 401, with no exposed rows. The only current anonymous/public policy observed was the intended deny-all policy for recruitment intake limits.
- **Recommendation:** Revoke direct `anon` privileges from all non-public tables and grant only the minimum required public execute/table access. Add a CI/catalog invariant that prevents broad anonymous CRUD grants from returning. Keep public recruitment access through the intentionally scoped SECURITY DEFINER boundary.
- **Roadmap:** Hardening / Wave C; migration and remote application require separate explicit authorization and are outside this review.

### SEC-014 — Additional dev/build dependency advisories remain in the lockfile

- **Status:** `OPEN`
- **Severity:** Low assessed application risk
- **Confidence:** High
- **Affected area:** Workspace dependency graph and build tooling.
- **Impact:** Full workspace audit reported advisories labelled High for `brace-expansion` `5.0.7`, `browserslist` `4.28.6`, and `js-yaml` `4.3.0`. The lockfile marks these paths as dev/build tooling; the production-only audit excluded them. They still affect developer and CI supply-chain exposure and should not be silently accepted as permanent debt.
- **Evidence:** `npm audit --workspace @liquid-hr/hr-suite --json` reported four High advisories in total. `npm audit --workspace @liquid-hr/hr-suite --omit=dev --json` reported only the already known transitive `nanoid` advisory. No package upgrade was made during this review. The app package also uses several `latest` ranges while the lockfile pins the installed graph, which increases future reproducibility/update risk.
- **Recommendation:** Update the affected dependency paths through a controlled lockfile change, test the build and lint toolchain, and replace `latest` ranges with deliberate supported ranges where compatible. Do not use an unreviewed audit autofix.
- **Roadmap:** Hardening; package/lockfile-only follow-up, with CI verification.

### SEC-015 — Department list route returns raw database error text

- **Status:** `OPEN`
- **Severity:** Low
- **Confidence:** High
- **Affected area:** `apps/hr-suite/app/api/departments/route.ts`.
- **Impact:** When the authenticated `department:read` query fails, the route returns `error.message` directly with HTTP 500. A PostgREST/Supabase message can disclose table, column, schema-cache, constraint, or provider implementation details. The endpoint is permission-gated and this review found no direct employee-data exposure or production stack trace, so the impact is limited information disclosure and a weaker external error contract.
- **Evidence:** The route returns `NextResponse.json({ error: error.message }, { status: 500 })` after the query. Most adjacent domain services already map database failures to stable internal error codes.
- **Recommendation:** Map unexpected database failures to a stable localized error code/message, retain the detailed provider error only in protected server-side logs, and audit analogous route-level `error.message` responses.
- **Roadmap:** Hardening; small application change with targeted negative API verification.

### Informational observations

- `X-Powered-By: Next.js` was present on the passive production `/login` response. This is a minor fingerprinting signal, not a material standalone vulnerability.
- `start_talent_review_campaign(uuid)` uses an explicit SECURITY DEFINER search path containing `pg_temp`; its body references were schema-qualified and no exploit was proven. Normalize SECURITY DEFINER search paths to the narrowest safe list as routine hardening.
- Remote/local migration history is divergent (409 remote versus 389 local). This is a governance and evidence limitation, not evidence for an emergency repair. No history repair or remote mutation was attempted.
- Vercel runtime telemetry for the last seven days contained old clusters for invalid refresh tokens, future JWT timestamps, insufficient rights, and a Talent context requirement. These are operational follow-ups; the sampled errors do not by themselves establish a new security defect.

## 4. Historical security register reclassification

Every historical item was assigned exactly one current disposition from the requested vocabulary. No regression was proven.

| ID | Historical issue | Current disposition | Fresh evidence and rationale |
| --- | --- | --- | --- |
| SEC-001 | Stored process-output HTML/XSS through caller-controlled summary | `CLOSED — VERIFIED` | Current process-output UI renders the typed/escaped summary path and no active `dangerouslySetInnerHTML` sink was found for that content. The remaining JSON-LD sink escapes `<` before insertion. Targeted tests passed. |
| SEC-002 | Missing scoped employee could surface as HTTP 500 | `CLOSED — VERIFIED` | Current employee route maps the typed `EmploymentServiceError` cases to stable status codes, including not-found/forbidden behavior. Targeted auth/employee tests passed. |
| SEC-003 | Production test-role switch mutable-flag risk | `CLOSED — VERIFIED` | Production guard rejects the route before authentication when production is detected; allowlisting and server-side admin link generation remain required. Passive production GET returned 405 and prior production POST evidence was consistent with the current guard. |
| SEC-004 | Browser-readable Supabase auth cookie | `HARDENED WITH RESIDUAL` | Production cookie hardening includes Secure where applicable and SameSite Lax, but the Supabase SSR auth-token cookie remains browser-readable by design (`HttpOnly=false`). XSS amplification remains a residual architecture decision. |
| SEC-005 | Forwarded-host/origin trust | `HARDENED WITH RESIDUAL` | Current origin resolution uses canonical app/Vercel hosts and explicit trusted hosts with local-only fallback behavior. Residual risk remains where deployment/proxy host configuration is incomplete or headers are not normalized at the edge. |
| SEC-006 | Internal upload lacked signature/AV/quarantine controls | `HARDENED WITH RESIDUAL` | Shared internal file rules now enforce size, extension/MIME, signatures, UTF-8 active-content checks, safe names, private buckets, scoped paths, and signed reads. Continuous-appraisal attachments and branding still lack the same magic-byte/decode/AV/quarantine layer; recruitment has fail-closed remote scanning. |
| SEC-007 | No Content Security Policy | `OPEN` | Current security headers include HSTS, nosniff, frame denial, referrer policy, and permissions policy, but no CSP is emitted in source or the passive production response. |
| SEC-008 | Supabase leaked-password protection disabled | `OPEN` | Current Supabase advisor still reports `auth_leaked_password_protection`; no remote Auth configuration mutation was authorized or performed. |
| SEC-009 | Transitive `nanoid` advisory | `OPEN` | Installed `nanoid` is `3.3.16`, reached through Next/PostCSS/Tailwind paths, with a fix available. The app has no direct source import, but production-tree audit still reports the advisory. |
| SEC-010 | Remote Supabase internal RPC grants drifted to anonymous | `CLOSED — VERIFIED` | Current remote grant/advisor inspection shows the Wave B internal RPC grant hardening in place; only the intended public recruitment functions retain anonymous execute. No broad anonymous SECURITY DEFINER execution was found beyond the intended public boundary. |
| SEC-011 | GitHub Actions/verified branch protection not proven | `OPEN` | Current public metadata reports `protected:false`, required-check enforcement off, no rulesets, and an unsigned current main commit. A successful Vercel status exists but is not required. |

Historical register totals: 4 `CLOSED — VERIFIED`, 3 `HARDENED WITH RESIDUAL`, 4 `OPEN`, 0 `REGRESSED`, 0 `SUPERSEDED`, and 0 `NOT REPRODUCIBLE / EVIDENCE INSUFFICIENT`.

## 5. Domain review

### Authentication, sessions, and account recovery

The middleware uses the server Supabase client and `getClaims` for protected routing; API routes perform their own authorization. Invalid session cookies are cleared. The test-role switch is disabled in production and uses an allowlist plus a short-lived HttpOnly handoff cookie. Cookie flags are improved, but the SSR auth cookie remains readable by browser JavaScript (SEC-004). Supabase leaked-password protection remains disabled (SEC-008). No unauthenticated protected-page content was observed in the passive production checks.

### Authorization, tenant isolation, and horizontal access

The authorization context resolves active tenant, HR group, user, roles, and permissions server-side. Permission checks distinguish self-scoped and context-scoped permissions. Employee, document, saved-analysis, AI, and action paths apply server-side scope checks and use RLS as a second boundary. Current analysis V1 remains aggregate-only and constrained to workforce/employees/headcount; drill and comparison reuse authorized session state and do not persist raw comparison data. No cross-tenant or horizontal data access was proven in this review. The unnecessary anonymous ACL surface is tracked separately as SEC-013.

### Database, RLS, RPCs, and SECURITY DEFINER

All 258 observed public tables had RLS enabled. Five service-only tables had no policies, which is consistent with their intended service-role boundary but should remain an explicit invariant. Public views were security-invoker. Current anonymous execute exposure was limited to three intended recruitment functions; authenticated SECURITY DEFINER functions were inventoried and current public functions had explicit search paths. The `pg_temp` observation on one function should be normalized. The database is healthy, but migration-history drift limits exact local-to-remote reproducibility evidence.

### Input validation, XSS, and injection

The current source uses strict Zod validation for analysis specs, AI Improve input, public recruitment fields, and relevant route payloads. No free SQL path was found in the reviewed analysis/AI flows. The current JSON-LD `dangerouslySetInnerHTML` sink escapes `<` in serialized structured data. Process output no longer uses the historical unsafe summary path. No new XSS or injection finding was proven. SEC-015 identifies one remaining raw provider-error response.

### Uploads and private Storage

All inspected buckets are private. Employee/company documents use permission checks, tenant/group-scoped UUID paths, checksums, signed URLs, and shared extension/MIME/signature/active-content rules. Avatars are decoded and re-encoded to constrained WebP. Public recruitment documents use strict PDF/DOCX checks and fail-closed remote malware scanning before storage. Continuous-appraisal attachments and administration branding still accept a narrower MIME/size contract without the shared magic-byte/decode/AV/quarantine layer; this is the residual in SEC-006. Branding and continuous-appraisal routes parse multipart form data before authorization or request-cap checks, which warrants body-limit ordering hardening even though no exploit was exercised.

### Security headers and browser boundary

The source and passive production response confirm HSTS with preload, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, strict-origin referrer policy, and a restrictive camera/microphone/geolocation Permissions Policy. CSP is absent (SEC-007), and `X-Powered-By` remains informational. No clickjacking or MIME-sniffing issue was observed in the passive check.

### Supabase Auth leaked-password control

The current Supabase security advisor still reports leaked-password protection disabled. This is an Auth configuration action, not a code-only issue, and was intentionally not changed during a review-only run. It remains a production security sign-off blocker until enabled and negative/positive password-reset and login checks are recorded.

### AI and contextual analysis

AI conversations, messages, tools, and action drafts are server-side scoped to the authenticated tenant and owner/context. Tools reauthorize and constrain returned data; analysis remains aggregate-only and avoids employee IDs, raw rows, free SQL, and persisted comparisons. AI Improve bounds source text, uses enums and idempotency, checks `ai:use` and target permissions, and remains proposal-only until a human Save. Provider storage is disabled in the OpenAI configuration and provider metadata stays internal. No confirmed AI authorization, prompt-injection-to-data, or action-execution vulnerability was found. Provider data-processing/retention and HR privacy decisions remain governance items rather than a proven code finding.

### Business logic, concurrency, audit, and error handling

Reviewed action flows use owner/tenant/status/version/expiry checks and atomic claims before normal business-service execution. The material newly identified concurrency weakness is the public recruitment proof/counter issuance in SEC-012. Audit logging and protected server-side error mapping are present across the reviewed domains, but the department list route still returns raw database text (SEC-015). No audit-log tampering path or payroll authorization bypass was proven.

### Production, deployment, and supply chain

The current production deployment is READY and maps to the exact current main SHA. Passive production checks did not reveal protected-page or selected API disclosure. GitHub main has no confirmed protection/ruleset/required-check enforcement (SEC-011), and the current commit is unsigned. Dependency audit found one production-tree transitive advisory and three dev/build advisories (SEC-009 and SEC-014). No secrets were found in the tracked current tree through the limited filename/literal/history scan; this is not an exhaustive historical secret-forensics claim.

## 6. Prioritized remediation roadmap

| Priority | Items | Objective | Required action/dependency | Exit evidence |
| --- | --- | --- | --- | --- |
| Immediate | SEC-012 | Make public recruitment abuse limits meaningful and concurrency-safe | Trusted edge identity, server-derived keying, atomic DB/RPC increment/proof issuance, pre-parse body cap, freshness/replay controls; application + database + proxy/provider contract | Non-production key-rotation, spoofed-header, concurrent-request, replay, and body-size tests; rate-limit telemetry; production canary review |
| Immediate | SEC-008 | Enable breached-password protection | Supabase Auth configuration change; explicit remote authorization required | Advisor no longer reports the lint, plus password reset/login negative/positive checks |
| Immediate | SEC-009 | Remove production-tree transitive `nanoid` advisory | Controlled dependency/lockfile update and compatibility/build check | Production-only audit clean or documented accepted exception with fixed resolution and provenance |
| Wave C | SEC-006 | Unify internal file ingestion controls | Magic-byte/decode validation, quarantine/AV or equivalent scanning for continuous-appraisal, branding, and remaining internal paths; provider/service design | Negative file corpus, scanner-failure fail-closed tests, private bucket/read-scope checks |
| Wave C | SEC-007 | Add a workable CSP without breaking Next/JSON-LD/AI UX | Inventory scripts/styles/connect targets, deploy report-only first, then enforce; code/config action | Production header proof, violation review, authenticated HR flows at desktop and 390x844 |
| Wave C | SEC-011 | Protect release integrity on `main` | GitHub branch protection/ruleset, required Vercel check, review requirements, and signed-commit policy; GitHub settings action | Read-only settings export/API proof and a controlled branch/check enforcement test |
| Architecture decision | SEC-004 | Decide the session-token/browser-XSS boundary | Prefer a documented server-session bridge if product constraints permit; otherwise document residual and test XSS amplification/logout/refresh behavior | Authenticated browser proof and explicit accepted-risk/ADR decision |
| Hardening | SEC-005, SEC-013 | Close origin and database least-privilege residuals | Canonical production/preview allowlist and fail-closed proxy contract; revoke broad anonymous table ACLs and add CI invariant | Origin matrix, anonymous negative matrix, catalog ACL proof, migration review and authorized remote application |
| Hardening | SEC-014, SEC-015 | Reduce tooling and error-disclosure debt | Controlled dependency update; generic route error mapping and audit of analogous handlers | Audit/build/lint results and negative API response proof |
| Follow-up | Informational observations | Reduce fingerprinting and SECURITY DEFINER drift; reconcile migration evidence separately | Remove `X-Powered-By` if desired, normalize `pg_temp`, reconcile 409/389 migration history only through the approved governance path | Advisor/catalog/history evidence; no ad-hoc repair |

Final acceptance should include fresh HR Admin, HR Manager, and Employee personas, negative cross-tenant and horizontal checks, upload corpus tests, public-intake abuse tests, production SHA/provenance, headers, logs/audit, no-secret evidence, and confirmation that the protected local environment file remains intact.

## 7. Verification performed in this review

- Isolated worktree dependencies installed locally with scripts disabled; no tracked dependency files changed.
- Targeted security/application tests: **17 files, 111 tests passed**. The set covered permissions, origin, role switch, cookies, file rules, public intake security, AnalysisSpec/engine/drill/comparison/saved analysis, and AI runtime/provider/config/resolution.
- Strict TypeScript check: passed.
- ESLint: passed.
- Production-only dependency audit: one High scanner advisory, SEC-009 (`nanoid`).
- Full workspace dependency audit: four High scanner advisories; the three additional dev/build paths are SEC-014.
- Passive production HTTP/header checks: login 200; protected dashboard middleware mapped to login; selected unauthenticated document/avatar/analysis endpoints did not disclose protected content; unsupported methods returned expected 405/404 responses.
- Supabase read-only catalog, advisor, function, view, ACL, storage, and row-count checks: completed; no remote mutation.
- `git diff --check`: passed on the documentation candidate before commit.
- Full application suite, local authenticated browser flow, database advisor rerun after changes, production deployment, migration application, package update, GitHub settings change, and Vercel configuration change: intentionally not performed because this was a review-only run.

## 8. Changes and mutation boundary

This review is intended to produce documentation only. The allowed candidate changes are this report and minimal index/status/context references. No application source, tests, migrations, package manifests, lockfiles, version files, Supabase state, Vercel state, GitHub settings, production data, or protected environment values were changed.

The review branch may be committed and pushed for roadmap review. It must not be merged into `main` as part of this task. Remediation is a separate authorized activity.
