# SEC-012 PUBLIC RECRUITMENT ABUSE & EDGE TRUST — REMEDIATION DESIGN

**Status: DESIGN BLOCKED — SAFE IMPLEMENTATION REQUIRES AN UPLOAD-CAPACITY DECISION**

This is a documentation-only design candidate. It does not implement application code, SQL, migrations, tests, configuration, deployment, or provider changes.

## Decision summary

The recommended SEC-012 control is a server-owned, fail-closed public-intake gate with four properties:

1. The route accepts a client-network identity only from an explicitly verified direct Vercel edge contract. It never trusts an arbitrary `x-real-ip`, client-supplied identity field, email address, or idempotency key.
2. The abuse key is a keyed, privacy-preserving digest of the verified edge identity and public vacancy scope. Business idempotency remains a separate payload concern and is never part of the abuse key.
3. A service-only atomic database RPC claims one request slot and creates one short-lived proof in the same transaction. The public submit RPC consumes that proof exactly once and verifies its publication and bucket binding under its existing tenant/vacancy checks.
4. The request body is bounded before multipart parsing. Invalid, missing, or forged `Content-Length` cannot cause an unbounded `formData()` parse.

The design cannot safely state one implementation-ready upload cap yet. Current Recruitment document validation permits a 10 MiB document, while the current public endpoint is a Node.js Vercel Function and Vercel documents a 4.5 MB request/response payload limit. Preserving the existing 10 MiB upload contract therefore requires an approved transport change; choosing a route cap within the Vercel limit changes the public upload contract. This is a genuine product/platform decision, so implementation is intentionally not started.

## Baseline

- Repository: `C:\Users\Edwin\Documents\Apps\LiquidHR`
- Required source branch: exact current `origin/main`
- Baseline SHA: `155ccbde373a06684e37d9746b01dd65931c870b`
- Visible application version at baseline: `1.20260901.1`
- Authoritative security review SHA: `9372c05ebb20c298e85b683e6bf3fc8479f1ad92`
- Authoritative report: `docs/security/SECURITY_REVIEW_20260902_LUNA_MAX.md` on that exact review commit
- Review finding: `SEC-012 OPEN`, severity `Medium`, confidence `High`
- Affected path: `apps/hr-suite/app/api/public/recruitment/vacancies/[publicId]/applications/route.ts` and `apps/hr-suite/lib/recruitment/public-intake-service.ts`
- Current public security posture remains fail-closed when Turnstile, rate-limit pepper, or malware-scanner configuration is unavailable.

No app, test, migration, package, version, Supabase, Vercel, GitHub, or canonical environment file was changed for this design.

## Source evidence

The design uses the following evidence, in priority order:

- The pasted SEC-012 remediation request and its explicit scope and stop conditions.
- `SECURITY_REVIEW_20260902_LUNA_MAX.md` from the approved review commit `9372c05ebb20c298e85b683e6bf3fc8479f1ad92`.
- The exact `origin/main` implementation and current Recruitment tests, migration contracts, function grants, RLS policies, request helpers, and SEC-005 origin evidence.
- Official Vercel request-header and function-limit documentation. Vercel documents `x-forwarded-for` as the public client IP at the Vercel boundary, states that Vercel overwrites it, and documents `x-vercel-forwarded-for`/`x-real-ip` as equivalent headers. It also documents a 4.5 MB Node.js Function request/response payload limit: [Vercel request headers](https://vercel.com/docs/headers/request-headers), [Vercel Functions limitations](https://vercel.com/docs/functions/limitations), [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables), and [Vercel reverse proxy requirements](https://vercel.com/docs/security/reverse-proxy).

The authoritative review also records the current remote-read-only migration-history drift (`409` remote versus `389` local). This design does not repair, pull, push, or otherwise mutate database migration history.

## Current behavior and abuse paths

### Current request sequence

The public application route currently:

1. Parses multipart with `request.formData()` or JSON without an early bounded-body gate.
2. Validates the application payload and loads the public vacancy.
3. Validates and remotely scans a document before the rate-limit proof is claimed.
4. Reads the first `x-forwarded-for` value, then `x-real-ip`, and falls back to the literal `unknown`.
5. Builds the rate fingerprint as `${idempotencyKey}:${email}` and passes it, with the network value, to `createPublicIntakeProof`.
6. Reads the current limit row, compares `request_count` with `5`, then updates `current + 1` or inserts a row without a database lock or conditional atomic update.
7. Submits through the existing public RPC, which locks and consumes the proof row downstream.

The route also scans the document again in `scanAndStorePublicDocument` after application creation. The current scanner is fail-closed; this design preserves that invariant but moves scanner work behind the cheap abuse gate and makes one clean result authoritative for the exact immutable bytes.

### Exploitable or fragile boundaries

- An attacker can rotate caller-controlled email and idempotency values, so the current form fingerprint is not an abuse identity.
- `x-real-ip` is not an independently trusted edge identity. Local/test requests have no provider guarantee and must not be allowed to establish production buckets from arbitrary headers.
- Read-then-write permits concurrent requests to observe the same count and claim more than five slots. The unique bucket key does not make the increment atomic.
- The current limit row stores only one proof lifecycle. Concurrent successful claims can overwrite the previous proof, returning bearer proofs that no longer correspond to the stored row.
- Multipart parsing and remote malware scanning consume resources before the abuse decision. A missing or dishonest `Content-Length` is not a sufficient body defense.
- Existing public errors do not distinguish an oversize request, a missing trusted edge identity, or an expired/replayed proof in a stable, privacy-safe contract.

### Invariants to preserve

- Turnstile remains required and fail-closed.
- Malware scanning remains required, clean-only, and fail-closed on rejection or scanner unavailability.
- Public access remains limited to the intended public Recruitment boundary and existing vacancy/publication checks.
- The public submit RPC remains the tenant/vacancy authorization boundary and continues to reject cross-tenant, closed, inactive, or invalid publications.
- Document type, magic-byte, size, private-storage, cleanup, and scanner-reference checks remain in force.
- The existing 5 claims per 15-minute window per public publication and abuse bucket remain the starting policy; changing this threshold is not part of SEC-012.
- The existing 10-minute proof lifetime and single-use behavior remain the starting policy, subject to the upload-capacity decision below.
- The current public `idempotencyKey` input is not silently promoted to a business idempotency guarantee. In the current path it is used for rate fingerprinting but is not passed as a persisted public duplicate key to `recruitment_submit_public_application`. It may remain in the input contract, but it must not influence abuse identity.

## Recommended design

### Authoritative request flow

The implementation should use this order:

```text
provider payload gate
  -> bounded body read (reject before formData/json parsing)
  -> cheap schema and document-structure checks
  -> verified edge identity (fail closed if absent/ambiguous)
  -> Turnstile verification
  -> atomic service-only intake claim and proof issuance
  -> one clean-only malware scan of the exact bytes
  -> existing public submit RPC with proof and bucket binding
  -> private document storage and metadata persistence
```

The claim is deliberately before remote malware scanning. A rejected or unavailable scan consumes one bounded abuse slot, preventing a caller from using the scanner as a free high-cost oracle. Local file validation may run before the claim because it is bounded, deterministic, and does not contact the scanner. No storage upload occurs before a clean result.

### Trusted edge identity contract

Add one narrowly scoped server-only helper, separate from the existing origin helper:

`apps/hr-suite/lib/security/trusted-client-identity.ts`

The production route may return a usable identity only when all of the following hold:

- The runtime is an explicitly recognized Vercel Production or Preview runtime (`VERCEL=1` and `VERCEL_ENV` is `production` or `preview`). Unknown, missing, or local values fail closed for the public route.
- `x-forwarded-for` is present as one syntactically valid IPv4 or IPv6 address. A comma-separated chain, blank value, malformed value, or ambiguous value is rejected rather than choosing a hop.
- When `x-vercel-forwarded-for` is present, it must normalize to the same address. A mismatch fails closed. `x-real-ip` is not used as an independent fallback.
- The deployment is not fronted by an unverified custom reverse proxy. If a proxy is introduced, the Vercel Verified Proxy contract and its custom client-IP header must be explicitly verified and added as a separate reviewed adapter; until then the route blocks.

Normalization is limited to trimming, removing an enclosing IPv6 bracket pair when the provider supplies one, lowercasing, and validating one address with the existing runtime facilities. Do not truncate IPv6, collapse to a prefix, select the first address in a list, or accept arbitrary `x-client-ip`/`cf-connecting-ip`/similar headers.

The helper returns a typed result such as `TRUSTED_VERCEL_CLIENT` plus a normalized identity for key derivation. It never returns raw identity data to the client and does not write raw identity to logs or database rows. Unit tests may inject a typed identity fixture; they must not make arbitrary request headers trusted in production code.

This helper is not a change to `resolveRequestOrigin`. SEC-005 host/origin resolution and SEC-012 client-network identity are distinct trust decisions.

### Abuse key and scope

Replace the current `networkAddress + email + idempotencyKey` fingerprint with a versioned HMAC-SHA-256 bucket key:

```text
HMAC-SHA-256(RECRUITMENT_RATE_LIMIT_PEPPER,
  "v1\0PUBLIC_RECRUITMENT\0" + publicationId + "\0" + trustedClientIdentity)
```

The stored value is lowercase hexadecimal only. Raw IP, email, idempotency key, challenge token, document name, and document bytes never enter the database key or telemetry.

The database, rather than a caller-provided timestamp, owns the 15-minute UTC-aligned window. The HMAC intentionally does not include the window; the same server-derived bucket identity is stored once per publication/window and cannot be made inconsistent by clock skew between the route and the database.

The initial scope remains one bucket per public publication and trusted client identity. This prevents one noisy public vacancy from consuming the allowance of every vacancy in the tenant, matching current behavior. It does not claim to defeat distributed botnets or IP rotation. Shared NAT may group legitimate applicants; IPv6 privacy rotation may create separate buckets. These are documented residuals, not reasons to reintroduce caller-controlled fields.

### Atomic claim and proof issuance

Use one service-only database RPC, conceptually:

`public.recruitment_claim_public_intake(requested_publication_id uuid, requested_bucket_key_hash text)`

The route calls it with the publication ID and the HMAC produced by the trusted-identity helper. It never sends raw network data, email, idempotency, or a client timestamp.

Inside one transaction the function must:

1. Validate the publication exists and is `OPEN`; derive `tenant_id` and `hr_group_id` from that row.
2. Derive the current UTC-aligned 15-minute window from database time.
3. Atomically insert the bucket counter or update it with `request_count = request_count + 1` only while the current count is below `5`. Use the existing unique publication/bucket/window constraint and an `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE request_count < 5 ... RETURNING` pattern, or an equivalent row-locking SQL operation.
4. Return a stable rate-limited result if no row is returned. The failed concurrent contender must not increment the count.
5. Generate a fresh high-entropy proof, store only its SHA-256 digest in a separate proof table, and return the raw proof only to the server route. Insert the proof row in the same transaction as the counter increment so a proof-insert failure rolls back the allowance.
6. Set `issued_at` from database time, `expires_at` to `issued_at + 10 minutes`, and `consumed_at` to null. Never overwrite another proof.

The new proof record is bound to `publication_id`, `bucket_key_hash`, and the current window. Update `recruitment_submit_public_application` to accept the server-derived bucket hash and require the matching proof row. The proof remains a bearer secret within the same request, but a stolen proof cannot be replayed from a different bucket identity. A legitimate client whose network changes between claim and submit receives the same generic proof-invalid response; that trade-off is intentional and should be covered by acceptance tests.

The submit function continues to lock the proof row before checking expiry/consumption and consuming it. It retains its existing publication, tenant, HR-group, vacancy, module, payload, candidate, application, and event checks. No public caller receives direct table access or a way to mint a proof.

### Request-body boundary

Add a server-only bounded request reader, conceptually:

`apps/hr-suite/lib/http/bounded-request-body.ts`

The route must apply it before `request.formData()` or `request.json()`:

- Parse `Content-Length` strictly as a non-negative decimal. Reject a value above the configured public request cap immediately with a stable 413 response.
- Treat missing, invalid, or suspiciously small `Content-Length` as untrusted. Read the request stream with a hard byte limit of `cap + 1`; stop and reject as soon as the limit is exceeded.
- Reconstruct a bounded `Request` from the accepted bytes while preserving the original content type and parse the reconstructed request only after the bound passes. Do not use `clone()` as the security control and then parse the original unbounded stream.
- Apply the same cap to JSON and multipart. Keep field count, field length, answer count, filename length, and document-byte checks bounded in the schema/service layer.
- Return 413 without Turnstile, database access, scanner access, storage access, or detailed body diagnostics.

The configured cap must be an explicit public Recruitment contract, not silently inherited from the current generic 27 MiB `proxyClientMaxBodySize`. Vercel’s documented 4.5 MB Node.js Function limit applies before application code and means an application cap must be below that limit if the existing Vercel route remains the transport. Exact cap selection is blocked pending the upload decision in Open technical items.

### Scanner and downstream ordering

After a successful claim, validate the exact parsed document bytes and call the existing remote scanner once. Pass the clean result/reference through the service boundary to storage metadata persistence so the same accepted bytes and scan reference are used. If implementation retains a second scan temporarily for defense in depth, it remains bounded after the claim and must never permit storage on a non-clean or unavailable result; the targeted tests must assert that scanner cost is not reachable before the claim.

The existing private `recruitment-documents` bucket, tenant/HR-group storage key, checksum, scan status, scanner reference, and cleanup-on-metadata-failure behavior remain unchanged.

### Stable error contract

Keep public error bodies small and non-enumerating. Recommended mappings:

| Condition | HTTP | External code | Required behavior |
| --- | ---: | --- | --- |
| Declared or measured body exceeds cap | 413 | `RECRUITMENT_PUBLIC_REQUEST_TOO_LARGE` | No parse, challenge, DB, scanner, or storage work. |
| No trusted edge identity, unsupported proxy, or required security configuration missing | 503 | `RECRUITMENT_PUBLIC_SECURITY_UNAVAILABLE` | Fail closed; no trust detail or raw header. |
| Turnstile invalid | 422 | Existing bot-challenge/input security code | Preserve current fail-closed semantics. |
| Turnstile/scanner/provider unavailable | 503 | Existing unavailable code | Preserve current fail-closed semantics. |
| Atomic claim exhausted | 429 | `RECRUITMENT_PUBLIC_RATE_LIMITED` | Add `Retry-After` to the next database window; do not disclose count or bucket key. |
| Proof missing, expired, consumed, publication mismatch, or bucket mismatch | 403 | `RECRUITMENT_PUBLIC_PROOF_INVALID` | Same response for all proof-state failures. |
| Existing input/vacancy/application errors | Existing status/code | Existing contract | Do not widen public information disclosure. |

Internal reason labels may distinguish `MISSING_EDGE_IDENTITY`, `AMBIGUOUS_EDGE_HEADER`, `EXPIRED`, `CONSUMED`, and `BUCKET_MISMATCH`, but those labels must not be returned to the public client.

### Telemetry and privacy

No anonymous abuse event belongs in the tenant-scoped `audit_logs` stream because there is no authenticated actor or tenant-owned business mutation at the time of the gate. Use the existing server structured-log convention (the repository currently uses JSON server logging in performance/provider paths) and the platform log sink; do not add a second persistent observability system.

Allowlisted event fields:

- `type: liquidhr.security`
- `event: recruitment_public_intake`
- `outcome: body_rejected | edge_rejected | challenge_rejected | rate_limited | claim_failed | proof_rejected | scanner_rejected | accepted`
- stable `code`, route family, runtime (`production`/`preview`), and bounded duration
- an opaque request/deployment correlation ID only when already supplied by the platform and safe to retain
- an opaque publication scope identifier only if the existing logging policy permits it

Never log raw IP, HMAC key, email, idempotency key, challenge token, proof, authorization header, document name/content, scanner API key, scanner response body, or Supabase error payload. Confirm the actual platform log retention period and access policy during release review; this design does not create a new retention store.

## SEC-005 overlap and boundary

SEC-012 should reuse the same explicit Vercel runtime/deployment trust assumptions documented for SEC-005, but it must not turn `resolveRequestOrigin` into an IP resolver.

SEC-012 closes the client-network identity gap by rejecting arbitrary proxy headers, requiring a verified direct-edge contract, using server-derived keyed buckets, and failing closed when the contract is absent or ambiguous.

SEC-005 remains a separate residual for canonical host/origin resolution, forwarded-host allowlists, OAuth/callback/reset/invitation URL generation, local-only fallback policy, and any future reverse proxy or custom-domain configuration. The two controls should share a small runtime trust predicate or documented provider contract, not share mutable identity data or silently broaden trusted headers.

## Database, RLS, grants, indexes, and cleanup

**Migration required: YES.** A schema/RPC change is required because the current single limit row cannot represent multiple concurrent unconsumed proofs safely.

The implementation migration should:

- Keep `public.recruitment_public_intake_limits` as the per-publication/per-bucket/per-window counter with its existing unique key and request-count constraint. Existing legacy proof columns may remain inert for one bounded compatibility window; the new path must not read or write them. Do not maintain two active proof sources.
- Add `public.recruitment_public_intake_proofs` with UUID primary key, publication/tenant/HR-group scope, `bucket_key_hash`, unique `proof_hash`, `window_started_at`, `issued_at`, `expires_at`, `consumed_at`, and creation metadata. Store only the digest, never the raw proof.
- Add a composite publication/bucket/window lookup index if the existing unique index does not provide the required plan, a proof-hash lookup index/constraint, and a partial expiry index for unconsumed proofs. Keep tenant/HR-group/publication foreign-key coverage consistent with Recruitment foundation constraints.
- Enable RLS on the new table and add an explicit deny-all policy for public access. Revoke table privileges from `public`, `anon`, and `authenticated`; grant only the minimum service/definer privileges needed by the claim and submit functions. Direct table reads/writes by a browser remain impossible.
- Add `recruitment_claim_public_intake` with explicit execute granted only to `service_role`; revoke `PUBLIC`, `anon`, and `authenticated`. It must validate bounded inputs, use schema-qualified names, and either run as invoker under the service client or use a narrowly scoped `SECURITY DEFINER` body with `SET search_path = ''`; do not expose a raw table operation.
- Keep only the three intended anonymous Recruitment execute boundaries: `recruitment_public_vacancy`, `recruitment_public_vacancy_state`, and `recruitment_submit_public_application`. The claim RPC is not one of them.
- Update the public submit RPC signature and body to find/lock/consume the new proof by digest, publication, and bucket binding while preserving `SECURITY DEFINER`, `SET search_path = ''`, explicit schema qualification, and existing tenant/vacancy checks.
- Add a bounded service-only purge operation for expired/consumed proof rows and old counter rows. Reuse the existing `app/api/cron/recruitment-retention/route.ts` authorization and scheduling path rather than adding a second public or scheduler surface. Delete in a bounded batch, retain a grace period for clock skew, and never remove a counter row while it has an unexpired proof. Legacy proof columns can be removed only in a separately reviewed cleanup migration after the compatibility window is proven empty.
- Regenerate `packages/db/types.ts` after the migration. This is an implementation step only; no generated type or migration is changed in this design branch.

The migration must be checked against the known remote/local migration-history drift. Drift is evidence to stop and report, never a reason to run `db push`, repair history, pull remote schema, or edit migration history in place.

## Security acceptance criteria

The implementation is not GREEN unless all of these are demonstrated:

- Direct Vercel Production and Preview requests with provider-normalized identity can claim at most five slots per publication/bucket/window under concurrent load.
- Missing, malformed, comma-separated, mismatched, or locally spoofed identity headers fail closed.
- Rotating email and client idempotency values does not create new abuse buckets.
- A sixth concurrent claim is rejected atomically; no over-limit counter exists.
- Each successful claim receives an independent proof; one claim cannot overwrite or invalidate another successful proof.
- Proofs are publication- and bucket-bound, expire after ten minutes, and can be consumed exactly once. Expired, consumed, wrong-publication, and wrong-bucket proofs have the same external failure.
- Body size is rejected before multipart/JSON parsing for accurate `Content-Length`, missing `Content-Length`, and forged-small `Content-Length` cases.
- No remote scanner call, storage upload, or public application RPC occurs after a rejected body, untrusted edge identity, failed Turnstile, or rate-limit denial.
- Turnstile and malware scanner unavailable/rejected states remain fail-closed.
- Browser/anon cannot select from or write either intake table and cannot execute the service-only claim RPC.
- The existing three anonymous Recruitment RPCs remain the only intended anonymous function grants.
- Telemetry contains stable outcome codes only and no raw identity, credentials, applicant data, proof, or file bytes.
- A production verification run proves the deployed SHA and direct-edge header contract; a `READY` deployment alone is not sufficient.

## Implementation plan — exact file scope

This is the proposed implementation scope, not work performed on this branch.

### Application and shared helpers

- **Add** `apps/hr-suite/lib/security/trusted-client-identity.ts`: verified Vercel edge identity contract, strict single-IP normalization, typed fail-closed result, test injection seam.
- **Add** `apps/hr-suite/lib/http/bounded-request-body.ts`: strict declared-length check and bounded stream buffering/reconstruction before parsing.
- **Modify** `apps/hr-suite/app/api/public/recruitment/vacancies/[publicId]/applications/route.ts`: apply body gate first, use trusted identity, remove email/idempotency from abuse key, call claim before scanner, pass bucket binding to submit, preserve stable response headers and security failures.
- **Modify** `apps/hr-suite/lib/recruitment/public-security.ts`: versioned HMAC bucket-key derivation and typed identity/key contracts; retain document validation and fail-closed adapters.
- **Modify** `apps/hr-suite/lib/recruitment/public-intake-service.ts`: replace read/compare/update logic with the claim RPC, preserve config checks, and thread one clean scan result into storage.
- **Modify** `apps/hr-suite/lib/recruitment/application-service.ts`: pass the server-derived bucket binding to the public submit RPC without making client idempotency a rate-limit input.
- **Modify** `apps/hr-suite/lib/recruitment/errors.ts`: add stable 413/503/403 mappings while preserving current bot, malware, input, and vacancy contracts.
- **Modify** `apps/hr-suite/app/api/cron/recruitment-retention/route.ts` and the narrow Recruitment service wrapper: invoke bounded intake-proof/counter cleanup through the existing CRON_SECRET-protected route.
- **Review/possibly modify** `apps/hr-suite/next.config.ts`: align the configured proxy body setting with the approved public upload cap; do not leave a misleading generic 27 MiB setting as the only boundary.

### Database and generated contracts

- **Add** one timestamped migration under `apps/hr-suite/supabase/migrations/`: proof table, indexes, RLS/policies, grants/revokes, claim RPC, submit-RPC binding, bounded cleanup RPC, and compatibility handling for legacy proof columns.
- **Modify** `apps/hr-suite/supabase/tests/recruitment_foundation_contract.sql`: atomic claim, proof lifecycle, binding, cleanup, RLS, and direct-access denial assertions.
- **Modify** `apps/hr-suite/supabase/tests/security_wave_b_rpc_grants.sql`: assert the claim RPC is service-only and the three existing anonymous Recruitment functions remain the sole intended public boundary.
- **Modify** `apps/hr-suite/lib/recruitment/migration-contract.test.ts`: assert table/RLS/grant/index/function contracts.
- **Regenerate** `packages/db/types.ts` only after the approved migration is applied to the canonical local schema; do not hand-edit generated types.

### Tests

- **Add** `apps/hr-suite/lib/security/trusted-client-identity.test.ts`.
- **Add** `apps/hr-suite/lib/http/bounded-request-body.test.ts`.
- **Add** `apps/hr-suite/app/api/public/recruitment/vacancies/[publicId]/applications/route.test.ts` for ordering, error mapping, no-preclaim scanner behavior, and forged/missing body lengths.
- **Modify** `apps/hr-suite/lib/recruitment/public-security.test.ts` for HMAC separation, stable normalization, and absence of raw identity.
- **Modify** `apps/hr-suite/lib/recruitment/public-intake.test.ts` for claim result mapping, proof binding, and idempotency/email independence.

No unrelated app, UI, package, version, migration-history, or deployment file belongs in the implementation diff.

## Test plan

### Unit and contract tests

- Header matrix: direct Vercel valid IPv4/IPv6, absent, blank, malformed, comma chain, mismatched `x-vercel-forwarded-for`, local spoof, unsupported runtime, and verified-proxy-not-configured.
- Key matrix: same trusted identity produces the same key; different identity/publication produces different keys; changing email or idempotency does not change it; raw values never appear in the returned/stored representation.
- Body matrix: valid below-cap body, exact cap, cap plus one, accurate oversized `Content-Length`, missing length, forged-small length, invalid length, JSON, multipart, and truncated stream. Assert parsing and external calls do not occur after rejection.
- RPC grant/RLS matrix: anon/authenticated cannot execute claim or access tables; service-only claim works; exactly the existing three anonymous Recruitment functions remain allowed.
- SQL concurrency: run more than five concurrent claims for one publication/bucket/window and assert exactly five successes, one proof per success, and no count above five.
- Proof lifecycle: independent proofs, wrong publication/bucket, expiry, replay, and concurrent consume.

### Targeted runtime acceptance

Run only after the upload-capacity decision and approved implementation:

- a real configured public Recruitment flow with Turnstile and clean/rejected/unavailable scanner outcomes;
- server logs and response headers checked for privacy and stable codes;
- desktop and `390x844` public form smoke checks for no regression;
- production SHA/provenance and direct Vercel header-contract verification;
- canonical `.env.local` existence before and after, with no values printed.

Do not use a mocked final flow as production evidence. Test doubles are appropriate only for deterministic unit and ordering tests.

## Open technical items and genuine blocker

1. **Upload capacity decision — BLOCKING.** `validateRecruitmentDocument` currently permits a 10 MiB document and the public route is a Node.js Vercel Function with a documented 4.5 MB payload limit. Security requires an early route/provider cap, but lowering the public cap would weaken a legitimate current upload contract. The owner must choose one of:
   - approve a public Vercel-route cap below 4.5 MB and explicitly approve the resulting public document-size contract; or
   - approve a transport redesign that preserves 10 MiB (for example, a separately reviewed streaming/direct-quarantine flow using existing infrastructure or another approved provider boundary).

   SEC-012 implementation must not silently choose either option, claim that `proxyClientMaxBodySize` overrides the provider limit, or weaken scanner/storage controls to fit the limit.

2. **Proxy topology — required before release.** Confirm the public production and preview domains terminate directly at Vercel or document an approved Verified Proxy contract. Until verified, unknown proxy topology is fail-closed.

3. **Legacy proof rows — required before migration execution.** Inspect canonical local and approved remote read-only state for unexpired legacy proofs before choosing a one-migration cutover versus the bounded compatibility window described above. Do not repair migration history or mutate remote state during this inspection.

4. **Log retention — required before release.** Confirm platform log retention/access policy for the allowlisted security events. No new persistent audit table is proposed.

## Files changed by this design candidate

- `docs/security/SEC-012_PUBLIC_RECRUITMENT_ABUSE_DESIGN.md`

Only this documentation file is intended to be committed and pushed from the design worktree.

## Design verification boundary

This branch will receive documentation-only checks: whitespace validation, exact changed-file scope, clean worktree verification, baseline/commit identity verification, canonical environment-file existence verification, and confirmation that no app/test/migration/package/version file changed. Full app tests, production builds, browser checks, Supabase advisors, database pushes, Vercel operations, and production changes are intentionally out of scope for this design-only task.

## Next

Resolve the upload-capacity decision, confirm proxy topology, and obtain security review approval. Only then create a separate implementation task from the approved design; implementation must start from a freshly verified baseline and repeat the migration-drift and canonical-environment preflight.
