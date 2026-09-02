# SEC-012 PUBLIC RECRUITMENT ABUSE & EDGE TRUST — REMEDIATION DESIGN

**Status: IMPLEMENTATION CANDIDATE — SEC-012 OPEN**

This document is the approved design baseline and records the local implementation-candidate evidence below. It does not by itself prove remote migration application, release, or Production acceptance.

## Decision summary

The recommended SEC-012 control is a server-owned, fail-closed public-intake gate with four properties:

1. The route accepts a client-network identity only from an explicitly verified direct Vercel edge contract. It never trusts an arbitrary `x-real-ip`, client-supplied identity field, email address, or idempotency key.
2. The abuse key is a keyed, privacy-preserving digest of the verified edge identity and public vacancy scope. Business idempotency remains a separate payload concern and is never part of the abuse key.
3. A service-only atomic database RPC claims one request slot and creates one short-lived proof in the same transaction. The public submit RPC consumes that proof exactly once and verifies its publication and bucket binding under its existing tenant/vacancy checks.
4. The request body is bounded before multipart parsing. Invalid, missing, or forged `Content-Length` cannot cause an unbounded `formData()` parse.

The upload-capacity decision is frozen for Public Recruitment V1: the maximum uploaded recruitment document is exactly `4,000,000` decimal bytes and the maximum complete public recruitment request body is exactly `4,250,000` decimal bytes. The previous `10 * 1024 * 1024` allowance is superseded for the Vercel public Recruitment application route only. This leaves headroom below Vercel's documented 4.5 MB Function boundary for multipart framing and normal recruitment fields. No upload-transport redesign is part of SEC-012; larger public files require a separate Public Recruitment Upload Transport capability/design.

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

### Frozen product and transport decision

- `PUBLIC_RECRUITMENT_DOCUMENT_MAX_BYTES = 4,000,000` exactly.
- `PUBLIC_RECRUITMENT_REQUEST_MAX_BYTES = 4,250,000` exactly.
- These are decimal byte values, not MiB conversions.
- The former 10 MiB public Recruitment document allowance is superseded only for this Vercel public application route.
- Employee Documents, Company Documents, Document Studio assets, authenticated internal uploads, and other Recruitment/internal paths must not be reduced by this decision. If the current validator is shared, the implementation must introduce an explicit public limit rather than changing unrelated contracts.
- Browser direct-to-storage, pre-signed quarantine, multipart/chunked upload, Vercel Blob, a new upload service/provider, and preserving public files above 4,000,000 bytes are explicitly out of scope.

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
- The proof lifetime is exactly 10 minutes and each proof is independent, publication-bound, bucket-bound, single-use, and fail-closed on expiry or replay.
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
- `x-vercel-forwarded-for` is present as exactly one syntactically valid IPv4 or IPv6 address. A comma-separated chain, blank value, malformed value, or ambiguous value is rejected rather than choosing a hop.
- `x-vercel-id` and `x-vercel-deployment-url` are present as provider deployment/provenance headers. Their presence is a required part of the direct-Vercel contract; no request header is treated as a cryptographic authentication token.
- If `x-forwarded-for` or `x-real-ip` is present, it is only a cross-check and must normalize to the same address. A mismatch, malformed value, or comma-separated value fails closed. Neither header is an independent fallback.
- The deployment is not fronted by an unverified custom reverse proxy. If a proxy is introduced, the Vercel Verified Proxy contract and its custom client-IP header must be explicitly verified and added as a separate reviewed adapter; until then the route blocks.

Normalization is limited to trimming, removing an enclosing IPv6 bracket pair when the provider supplies one, lowercasing, and validating one address with `node:net` `isIP`. Do not truncate IPv6, collapse to a prefix, select the first address in a list, or accept arbitrary `x-client-ip`/`cf-connecting-ip`/similar headers. The implementation must not add `@vercel/functions`: the dependency is absent and direct parsing of the reviewed provider header contract is the smaller dependency-safe boundary. Vercel's documentation describes `x-vercel-forwarded-for`/`x-real-ip` as request-header IP signals and notes that an upstream proxy can affect `x-forwarded-for`; this review therefore treats an unreviewed proxy as fail-closed, not as a reason to trust another header ([Vercel request headers](https://vercel.com/docs/headers/request-headers)).

The helper returns a typed result such as `TRUSTED_VERCEL_CLIENT` plus a normalized identity for key derivation. It never returns raw identity data to the client and does not write raw identity to logs or database rows. Unit tests may inject a typed identity fixture; they must not make arbitrary request headers trusted in production code.

Local and test runtimes do not establish a production identity. Deterministic tests may use a typed dependency/argument injection seam guarded by the test harness and `NODE_ENV=test`; request headers and environment values cannot enable that seam in Production or Preview. There is no trusted-proxy fallback in this candidate. A future Vercel Enterprise Trusted Proxy configuration requires a separate reviewed adapter and configuration evidence.

This helper is not a change to `resolveRequestOrigin`. SEC-005 host/origin resolution and SEC-012 client-network identity are distinct trust decisions.

### Abuse key and scope

Replace the current `networkAddress + email + idempotencyKey` fingerprint with a versioned HMAC-SHA-256 bucket key. The implementation uses the platform Web Crypto API in `public-security.ts`; no package is added:

```text
key    = UTF-8(RECRUITMENT_RATE_LIMIT_PEPPER)
message = "v1\0PUBLIC_RECRUITMENT\0" + publicationId + "\0" + trustedClientIdentity
bucketKeyHash = lowercase-hex(HMAC-SHA-256(key, message))
```

`RECRUITMENT_RATE_LIMIT_PEPPER` must be present and at least 32 characters in the implementation configuration check. The stored value is lowercase hexadecimal only. Raw IP, email, idempotency key, challenge token, document name, and document bytes never enter the database key or telemetry. The implementation must include a known HMAC test vector, not merely a shape/length assertion.

The database, rather than a caller-provided timestamp, owns the 15-minute UTC-aligned window. The HMAC intentionally does not include the window; the same server-derived bucket identity is stored once per publication/window and cannot be made inconsistent by clock skew between the route and the database.

The initial scope remains one bucket per public publication and trusted client identity. This prevents one noisy public vacancy from consuming the allowance of every vacancy in the tenant, matching current behavior. It does not claim to defeat distributed botnets or IP rotation. Shared NAT may group legitimate applicants; IPv6 privacy rotation may create separate buckets. These are documented residuals, not reasons to reintroduce caller-controlled fields.

### Atomic claim and proof issuance

Use one service-only database RPC, conceptually:

`public.recruitment_claim_public_intake(requested_publication_id uuid, requested_bucket_key_hash text, requested_proof_hash text)`

The route generates a fresh 256-bit raw proof with the server Web Crypto API, hashes it with SHA-256, and calls the RPC with the publication ID, the HMAC produced by the trusted-identity helper, and the proof digest. It never sends raw network data, email, idempotency, or a client timestamp to the database. The raw proof remains only in the server request flow and is passed to the submit RPC after a clean scan.

Inside one transaction the function must:

1. Validate the publication exists and is `OPEN`; derive `tenant_id` and `hr_group_id` from that row.
2. Derive the current UTC-aligned 15-minute window from database time.
3. Atomically insert the bucket counter or update it with `request_count = request_count + 1` only while the current count is below `5`. Use the existing unique publication/bucket/window constraint and an `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE request_count < 5 ... RETURNING` pattern, or an equivalent row-locking SQL operation.
4. Return a stable rate-limited result if no row is returned. The failed concurrent contender must not increment the count.
5. Accept the server-generated proof digest, store only that SHA-256 digest in a separate proof table, and return claim metadata to the server route. Insert the proof row in the same transaction as the counter increment so a proof-insert failure rolls back the allowance. The raw proof is generated and retained by the server route, not by SQL and not by a browser.
6. Set `issued_at` from database time, `expires_at` to `issued_at + 10 minutes`, and `consumed_at` to null. Never overwrite another proof.

The new proof record is bound to `publication_id`, `tenant_id`, `hr_group_id`, `bucket_key_hash`, and the current window. Update `recruitment_submit_public_application` to accept the server-derived bucket hash and require the matching proof row. The proof remains a bearer secret within the same request, but a stolen proof cannot be replayed from a different publication or bucket identity. A legitimate client whose network changes between claim and submit receives the same generic proof-invalid response; that trade-off is intentional and should be covered by acceptance tests.

The submit function continues to lock the proof row before checking expiry/consumption and consuming it. It retains its existing publication, tenant, HR-group, vacancy, module, payload, candidate, application, and event checks. No public caller receives direct table access or a way to mint a proof.

### Request-body boundary

Add a server-only bounded request reader, conceptually:

`apps/hr-suite/lib/http/bounded-request-body.ts`

The route must apply it before `request.formData()` or `request.json()`:

- Parse `Content-Length` strictly as a non-negative decimal. Reject a value above the configured public request cap immediately with a stable 413 response.
- Treat missing, invalid, or suspiciously small `Content-Length` as untrusted. Read the request stream with a hard byte limit of `cap + 1`; stop and reject as soon as the limit is exceeded.
- On a boundary-crossing chunk, retain only enough data to establish `cap + 1`, cancel the original reader, and reject. Reconstruct a bounded `Request` from the accepted bytes while preserving the original `content-type` (including multipart boundary) and safe end-to-end headers. Remove forged `content-length` and hop-by-hop headers before reconstruction; the reconstructed body is the only body subsequently parsed. Do not use `clone()` as the security control and then parse the original unbounded stream.
- Apply the same cap to JSON and multipart. Keep field count, field length, answer count, filename length, and document-byte checks bounded in the schema/service layer.
- Return 413 without Turnstile, database access, scanner access, storage access, or detailed body diagnostics.

The configured cap is frozen as `4,250,000` bytes for this public Recruitment route, not silently inherited from the current generic 27 MiB `proxyClientMaxBodySize`. The individual public document cap is frozen as `4,000,000` bytes. Exactly `4,250,000` bytes is accepted when the request is otherwise valid; `4,250,001` is rejected. Vercel's documented Node.js Function limit is 4.5 MB and an over-limit request returns 413 before application handling ([Vercel Functions limitations](https://vercel.com/docs/functions/limitations)). The approved decimal caps intentionally retain provider headroom. The implementation must not lower unrelated internal upload limits or attempt to maximize the public file size up to the provider boundary.

`next.config.ts` is explicitly unchanged. Its current `experimental.proxyClientMaxBodySize` remains the generic internal 27 MiB proxy-buffer contract; Next.js documents that this setting applies when Proxy is used and buffers/truncates the body rather than providing the route's application-level 413 decision ([Next.js `proxyClientMaxBodySize`](https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize)). The public route's bounded reader is therefore the authoritative public boundary.

### Scanner and downstream ordering

After a successful claim, call the existing remote scanner exactly once for the exact immutable document bytes that will be stored. Pass the clean result/reference through the service boundary to storage metadata persistence so the same accepted bytes, checksum, detected type, and scan reference are used. There is no second scan in the candidate: `scanAndStorePublicDocument` must be split or replaced so storage consumes the already-clean result. Scanner unavailable or rejected remains fail-closed; no storage or application rollback is invented for a post-claim scanner failure.

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

Never log raw IP, HMAC key, email, idempotency key, challenge token, proof, authorization header, document name/content, scanner API key, scanner response body, or Supabase error payload. Confirm the actual platform log retention period and access policy as an operations/governance follow-up; unknown retention duration is not an SEC-012 correctness blocker and this design does not create a new retention store.

## SEC-005 overlap and boundary

SEC-012 should reuse the same explicit Vercel runtime/deployment trust assumptions documented for SEC-005, but it must not turn `resolveRequestOrigin` into an IP resolver.

SEC-012 closes the client-network identity gap by rejecting arbitrary proxy headers, requiring a verified direct-edge contract, using server-derived keyed buckets, and failing closed when the contract is absent or ambiguous.

SEC-005 remains a separate residual for canonical host/origin resolution, forwarded-host allowlists, OAuth/callback/reset/invitation URL generation, local-only fallback policy, and any future reverse proxy or custom-domain configuration. The two controls should share a small runtime trust predicate or documented provider contract, not share mutable identity data or silently broaden trusted headers.

## Database, RLS, grants, indexes, and cleanup

**Migration required: YES.** A schema/RPC change is required because the current single limit row cannot represent multiple concurrent unconsumed proofs safely.

The implementation migration should:

- Keep `public.recruitment_public_intake_limits` as the per-publication/per-bucket/per-window counter with its existing unique key and request-count constraint. Use an additive forward migration: retain legacy columns/objects initially, deploy the new flow using only the new authoritative proof table, and leave destructive cleanup/removal to a separately reviewed cleanup migration. Do not maintain two active proof sources after cutover. The read-only current remote catalog has zero rows in both intake limits and documents, so no data migration is frozen for this candidate.
- Add `public.recruitment_public_intake_proofs` with: UUID primary key; `publication_id`, `tenant_id`, and `hr_group_id`; lowercase 64-hex `bucket_key_hash`; unique lowercase 64-hex `proof_hash`; `window_started_at`; `issued_at`; `expires_at`; nullable `consumed_at`; and UTC `created_at`. Add the composite publication foreign-key convention and checks for `expires_at > issued_at` and a maximum ten-minute lifetime. Store only the digest, never the raw proof.
- Add/retain indexes needed for the proof-hash lookup and bounded cleanup: the unique proof-hash constraint, a partial index for unconsumed expiry, and a partial index for consumed expiry if the cleanup plan requires it. The existing unique publication/bucket/window index remains the counter conflict key; add no redundant index without a query-plan reason.
- Enable RLS on the new table and add an explicit deny-all policy for public access. Revoke table privileges from `public`, `anon`, and `authenticated`; do not grant browser access. The service-only definer functions use owner privileges under an empty `search_path`; the browser reaches only the intended public submit/vacancy RPC boundary.
- Add `public.recruitment_claim_public_intake(uuid, text, text)` with explicit execute granted only to `service_role`; revoke `PUBLIC`, `anon`, `authenticated`, and any broader role. It must be `SECURITY DEFINER`, use `SET search_path = ''`, schema-qualify every object, validate both lowercase hashes, derive publication scope and time from the database, and expose no raw table operation.
- Implement the claim as one transaction. The RPC locks/validates the `OPEN` publication, module, and active vacancy, derives `tenant_id`/`hr_group_id`, computes a database-owned UTC-aligned 15-minute window, and uses `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE request_count < 5 ... RETURNING`. A sixth or losing concurrent claim returns a generic rate-limit result and does not increment the counter. The successful counter increment and proof-row insert roll back together if proof insertion fails. `expires_at` is `issued_at + 10 minutes`; the database owns `issued_at` and `window_started_at`.
- Keep only the three intended anonymous Recruitment execute boundaries: `recruitment_public_vacancy`, `recruitment_public_vacancy_state`, and the new five-argument `recruitment_submit_public_application`. The claim RPC is not one of them.
- Replace the active public submit contract with `recruitment_submit_public_application(uuid, text, jsonb, text, text)`, adding the server-derived bucket hash. Preserve the existing publication, tenant, HR-group, module, vacancy, stage, payload, candidate, application, duplicate, and event checks. Look up the new proof by SHA-256 digest, publication, tenant/HR group, and bucket hash; lock it; require `expires_at > database_now` and `consumed_at IS NULL`; then consume it exactly once. Missing, expired, consumed, wrong-publication, and wrong-bucket proofs all map to `RECRUITMENT_PUBLIC_PROOF_INVALID`. The old four-argument overload may remain only as a revoked compatibility tombstone that cannot execute for any caller; it is not an active proof source.
- Add `public.recruitment_cleanup_public_intake(requested_limit integer default 100)` as a service-only `SECURITY DEFINER` RPC with `SET search_path = ''`, explicit `service_role` claim guard, and revokes from `PUBLIC`, `anon`, and `authenticated`. Delete in bounded batches using row locking/`SKIP LOCKED`: unconsumed proofs after `expires_at < database_now - 1 hour`, consumed proofs after `consumed_at < database_now - 1 hour`, and counter rows only after a two-hour eligibility grace and only when no unexpired proof remains. Reuse the existing `CRON_SECRET`-protected recruitment-retention route and narrow service wrapper; add no public or second scheduler surface.
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

This is the approved implementation scope for the candidate; the evidence below records what was implemented and verified locally.

### Application and shared helpers

- **Add** `apps/hr-suite/lib/security/trusted-client-identity.ts`: verified Vercel edge identity contract, strict single-IP normalization, typed fail-closed result, test injection seam.
- **Add** `apps/hr-suite/lib/http/bounded-request-body.ts`: strict declared-length check and bounded stream buffering/reconstruction before parsing.
- **Modify** `apps/hr-suite/app/api/public/recruitment/vacancies/[publicId]/applications/route.ts`: apply body gate first, use trusted identity, remove email/idempotency from abuse key, call claim before scanner, pass bucket binding to submit, preserve stable response headers and security failures.
- **Modify** `apps/hr-suite/lib/recruitment/public-security.ts`: versioned Web Crypto HMAC bucket-key derivation and typed identity/key contracts; add an explicit public document limit option while retaining the default 10 MiB validator contract and fail-closed adapters.
- **Modify** `apps/hr-suite/lib/recruitment/public-intake-service.ts`: replace read/compare/update logic with the claim RPC, preserve config checks, and thread one clean scan result into storage.
- **Modify** `apps/hr-suite/lib/recruitment/application-service.ts`: pass the server-derived bucket binding to the public submit RPC without making client idempotency a rate-limit input.
- **Modify** `apps/hr-suite/lib/recruitment/errors.ts`: add stable 413/503/403 mappings while preserving current bot, malware, input, and vacancy contracts.
- **Modify** `apps/hr-suite/app/api/cron/recruitment-retention/route.ts` and the narrow Recruitment service wrapper: invoke bounded intake-proof/counter cleanup through the existing CRON_SECRET-protected route.
- **Do not modify** `apps/hr-suite/next.config.ts`: retain the generic 27 MiB `experimental.proxyClientMaxBodySize` contract for unrelated internal paths; the public route-specific bounded reader is the security boundary.

### Database and generated contracts

- **Add** one timestamped migration under `apps/hr-suite/supabase/migrations/`: proof table, indexes, RLS/policies, grants/revokes, claim RPC, submit-RPC binding, bounded cleanup RPC, and compatibility handling for legacy proof columns.
- **Modify** `apps/hr-suite/supabase/tests/recruitment_foundation_contract.sql`: atomic claim, proof lifecycle, binding, cleanup, RLS, and direct-access denial assertions.
- **Modify** `apps/hr-suite/supabase/tests/security_wave_b_rpc_grants.sql`: assert the claim RPC is service-only and the three existing anonymous Recruitment functions remain the sole intended public boundary.
- **Modify** `apps/hr-suite/lib/recruitment/migration-contract.test.ts`: assert table/RLS/grant/index/function contracts.
- **Regenerate** `packages/db/types.ts` only after the approved migration is applied to the canonical local schema; do not hand-edit generated types. This candidate intentionally did not regenerate it because the migration was not applied.

### Tests

- **Add** `apps/hr-suite/lib/security/trusted-client-identity.test.ts`.
- **Add** `apps/hr-suite/lib/http/bounded-request-body.test.ts`.
- **Add** `apps/hr-suite/app/api/public/recruitment/vacancies/[publicId]/applications/route.test.ts` for ordering, error mapping, no-preclaim scanner behavior, and forged/missing body lengths.
- **Modify** `apps/hr-suite/lib/recruitment/public-security.test.ts` for HMAC separation, stable normalization, and absence of raw identity.
- **Modify** `apps/hr-suite/lib/recruitment/public-intake.test.ts` for claim result mapping, proof binding, and idempotency/email independence.

No unrelated app, UI, package, version, migration-history, or deployment file belongs in the implementation diff. `apps/hr-suite/lib/recruitment/document-service.ts` remains on its existing default validator contract and is not in the candidate scope unless a type-only call-site adjustment is proved necessary. No `@vercel/functions` dependency is added.

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

## Remaining technical items — not design blockers

1. **Proxy topology — implementation/release gate.** Confirm the public Production and Preview domains terminate directly at Vercel or document an approved Verified Proxy contract. This is not a product blocker. If an unreviewed custom reverse proxy/CDN is discovered, stop before trusting client identity and obtain a separate trusted-proxy review.

2. **Legacy proof rows — migration preflight.** Inspect canonical local and approved remote state read-only for unexpired legacy proofs before executing the additive migration. Do not repair migration history or mutate remote state during this inspection; short-lived expired state does not require a complex data migration.

3. **Log retention — governance follow-up.** Confirm platform log retention/access policy for the allowlisted security events. This is not an SEC-012 correctness blocker and no new persistent audit table is proposed.

## IMPLEMENTATION REVIEW AND CANDIDATE EVIDENCE

This section is the authoritative implementation-review baseline and local candidate evidence for SEC-012. It does not authorize remote schema mutation or release. `SEC-012` itself remains `OPEN` until the candidate, migration, acceptance evidence, and Production verification are complete.

### BASELINE

- Exact source baseline: `origin/main` at `155ccbde373a06684e37d9746b01dd65931c870b`.
- Design source: `52e701daf00de816135727c5dc9f73f6fc5e25f8`.
- Review source: `9372c05ebb20c298e85b683e6bf3fc8479f1ad92`, with `SEC-012 OPEN`, severity `Medium`, confidence `High`.
- The isolated review branch is `security/sec012-public-intake-implementation-review`; the source worktree was clean and the dirty root was not modified.
- Visible application version at the baseline is `1.20260901.1` from `apps/hr-suite/lib/app-version.ts`. No version bump is part of SEC-012.

Read-only comparison confirmed that `origin/main` is the direct merge base for the design source and that no material Recruitment, security, routing, Supabase, Vercel, or request-handling drift was found between the approved baseline and the review source.

### TRUSTED IDENTITY

Freeze the direct-Vercel contract as follows:

- Production and Preview require server-side `VERCEL=1`, `VERCEL_ENV` equal to `production` or `preview`, `x-vercel-id`, `x-vercel-deployment-url`, and exactly one valid `x-vercel-forwarded-for` IPv4/IPv6 token.
- Use `x-vercel-forwarded-for` as the sole provider identity source. Trim, remove one enclosing IPv6 bracket pair when present, lowercase, and validate with `node:net` `isIP`.
- Reject missing, blank, malformed, comma-separated, or otherwise ambiguous values. Never select the first value from a chain.
- If `x-forwarded-for` or `x-real-ip` is present, use it only as an exact normalized cross-check. A malformed, comma-separated, or mismatching value fails closed; neither is a fallback.
- Local and test requests fail closed by default. Tests may inject a typed identity through a test-only dependency seam guarded by the test harness; no request header or production environment value may activate that seam.
- No external proxy/CDN header is trusted. Current Vercel read-only project metadata showed the configured Vercel domains and Git integration, with no configured external reverse-proxy field. This is `DIRECT VERCEL — VERIFIED` for the inspected Vercel project metadata, not proof for arbitrary DNS outside that project. A future custom/Enterprise Trusted Proxy needs a separate reviewed adapter and evidence.
- No raw IP is returned to clients, stored, or logged. Do not add `@vercel/functions`; it is absent and its IP helper would not replace this provenance contract.

### BODY / DOCUMENT LIMIT

- Public Recruitment document limit: exactly `4,000,000` decimal bytes.
- Complete public Recruitment request limit: exactly `4,250,000` decimal bytes, for both JSON and multipart.
- `4,250,000` is accepted; `4,250,001` is rejected with `RECRUITMENT_PUBLIC_REQUEST_TOO_LARGE` and HTTP `413`.
- A valid `Content-Length` above the cap is rejected before stream consumption. Missing, malformed, or suspiciously small `Content-Length` is untrusted; the original stream is read once with a hard `cap + 1` limit. A boundary-crossing chunk is cancelled and rejected.
- Parse only the reconstructed bounded `Request`; preserve `content-type` and safe end-to-end headers, strip `content-length` and hop-by-hop headers, and do not use `clone()` as the security control.
- The public route calls document validation with an explicit `4,000,000` limit. The shared default remains unchanged for unrelated callers: internal Recruitment document handling remains 10 MiB at the current validator/storage contract, and Employee/Company/internal upload contracts (including the current 25 MiB generic document rule) are not reduced.
- `next.config.ts` is unchanged. The existing generic `experimental.proxyClientMaxBodySize` setting remains the internal 27 MiB proxy-buffer contract; it is not the public route's 413 enforcement. Vercel documents a 4.5 MB Node.js Function payload ceiling, so these decimal caps retain provider headroom ([Vercel Functions limitations](https://vercel.com/docs/functions/limitations), [Next.js `proxyClientMaxBodySize`](https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize)).
- No transport redesign is included: no direct-to-storage flow, presigned quarantine, chunking, Vercel Blob, new upload provider, or public preservation of files above `4,000,000` bytes.

### ABUSE KEY

Use Web Crypto HMAC-SHA-256 with no new package:

```text
key     = UTF-8(RECRUITMENT_RATE_LIMIT_PEPPER)
message = "v1\0PUBLIC_RECRUITMENT\0" + publicationId + "\0" + trustedClientIdentity
bucket  = lowercase-hex(HMAC-SHA-256(key, message))
```

`RECRUITMENT_RATE_LIMIT_PEPPER` is required and must be at least 32 characters. The key is per public publication and trusted client identity; it excludes email, idempotency, challenge token, document metadata, and bytes. The same publication/identity is stable across requests; changing publication or identity changes the key. No raw identity or pepper enters storage or telemetry.

The policy is exactly 5 successful claims per 15-minute database-owned UTC-aligned window per publication/bucket. Each successful claim receives a fresh 256-bit server-generated proof. Proofs are independent, publication-bound, bucket-bound, single-use, and valid for exactly 10 minutes. A failed scanner, scanner unavailability, failed submit, or storage failure does not refund a successful claim; a proof-insert failure rolls back the counter increment in the same transaction.

### DATABASE

Freeze one additive migration, to be created only during the separately authorized implementation:

- Add `public.recruitment_public_intake_proofs` with UUID identity; publication/tenant/HR-group scope; lowercase 64-hex `bucket_key_hash`; unique lowercase 64-hex `proof_hash`; `window_started_at`, `issued_at`, `expires_at`, nullable `consumed_at`, and UTC `created_at`; composite publication foreign-key coverage; and non-volatile lifetime checks.
- Add `public.recruitment_claim_public_intake(uuid, text, text)` as a `SECURITY DEFINER` function with `SET search_path = ''`, explicit schema qualification, strict hash validation, database-owned time, and execute granted only to `service_role`.
- The claim locks the `OPEN` publication/module/active-vacancy scope, derives tenant and HR group, performs an atomic counter insert/update with `request_count < 5`, and inserts the proof digest in the same transaction. The sixth or concurrent losing claim returns a generic 429 result and does not increment.
- Replace the active submit function with `recruitment_submit_public_application(uuid, text, jsonb, text, text)`, adding the bucket hash. It locks the new proof by digest/publication/tenant/HR-group/bucket, validates expiry and single use, and preserves the existing vacancy/candidate/application/event checks. The old four-argument overload is not an active proof source and, if retained for compatibility, is revoked for every caller and made inert.
- Add service-only `public.recruitment_cleanup_public_intake(integer)` with the same definer/search-path discipline, an explicit service-role guard, bounded `SKIP LOCKED` cleanup, and grants only to `service_role`. Reuse the existing `CRON_SECRET`-protected recruitment-retention route and service wrapper.
- Cleanup eligibility is frozen at one hour after proof expiry/consumption; counter rows are eligible after two hours only when no unexpired proof remains. Legacy proof columns remain untouched in this additive migration and are removed only by a later reviewed cleanup migration.
- Enable RLS on the proof table, add an explicit deny-all policy for `anon`/`authenticated`, revoke direct table privileges from `public`, `anon`, and `authenticated`, and preserve the existing exact anonymous Recruitment RPC boundary. The claim RPC is service-only; browsers cannot read or write either intake table.

Current read-only catalog evidence: Supabase project `wnpfloqpjvaacobppbpk` is active/healthy; the implementation worktree started from exact review SHA `28f905189a1fe7de1ee972ed55ce69b362b915d0`; remote migration history remains `DIVERGED` (`409` remote versus `390` local before this candidate, with maximum remote timestamp `20260831165143`); remote `recruitment_public_intake_limits` and `recruitment_documents` row counts are both `0`; and remote `public.recruitment_claim_public_intake` does not exist. The candidate created exactly one local migration, `20260902113235_secure_public_recruitment_intake.sql`; it was not applied remotely. This drift is not a reason for `db push`, history repair, pull, or manual edits. Before any future remote apply, stop and request explicit authorization naming the exact migration filename and purpose.

### SCANNER / REQUEST ORDER

The runtime order is frozen as:

```text
bounded body gate
  -> JSON/multipart parse
  -> input schema and cheap local document validation
  -> public vacancy/config checks
  -> trusted edge identity
  -> Turnstile
  -> server proof generation and atomic service-only claim
  -> exactly one remote malware scan of immutable exact bytes
  -> public submit RPC with raw proof plus bucket hash
  -> private storage and CLEAN metadata using the same bytes and scan result
```

No document means no scanner. Body rejection, identity rejection, Turnstile rejection, and rate-limit denial must not reach scanner or storage; body rejection must not parse or reach any external service. Scanner rejection/unavailability remains fail-closed. There is no second scan: storage receives the clean result/reference/checksum from the single scan. A post-submit storage failure follows the existing cleanup/error contract and does not invent an application rollback.

### MIGRATION

The implementation candidate created one forward additive migration locally, but did not apply it. The current local/remote history is `DIVERGED` (`390` local versus `409` remote before the candidate, with different latest timestamps), and the remote Recruitment catalog has legacy proof columns with no current rows. `packages/db/types.ts` was not hand-edited or regenerated because the canonical schema was not updated. The local database lint could not run because no local Postgres was listening on `127.0.0.1:54322`; remote advisors were read-only and reported existing baseline findings, including the old four-argument submit function. Any remote apply remains separately authorization-gated.

### TESTS

The candidate must add/adjust tests for the following exact matrix:

- Body: `4,250,000` valid; `4,250,001` rejected; declared oversized length rejected immediately; missing/invalid/suspiciously small length; forged-small length; JSON; multipart; truncated stream; no parse/Turnstile/DB/scanner/storage after rejection.
- Document: `4,000,000` valid; `4,000,001` invalid; PDF/DOCX signature and MIME/extension checks; unrelated internal Recruitment 10 MiB and generic Employee/Company 25 MiB limits unchanged.
- Identity: direct Vercel IPv4 and IPv6; missing/malformed/comma values; mismatched provider cross-check; spoofed `x-real-ip`; unknown/local runtime; unsupported/unreviewed proxy; typed test injection only.
- HMAC: stable same publication/identity; distinct publication/identity; email/idempotency rotation unchanged; real known HMAC vector; no raw IP/pepper in output or telemetry.
- Atomicity: first five claims succeed and sixth fails; concurrent boundary has no lost increments or count above five; every success has an independent proof.
- Proof: valid, expired, consumed, replayed, wrong publication, wrong bucket, and concurrent consume all fail closed with the stable generic proof-invalid response.
- Grants/RLS: claim is service-only; `anon` cannot execute claim or read/write proof/counter tables; existing three anonymous Recruitment RPCs remain the only intended anonymous functions.
- Ordering/regression: no scanner before accepted claim; exactly one scanner after claim; normal public application; required/optional/hidden CV modes; existing vacancy checks; retention; internal Recruitment behavior.

Final production acceptance remains separate: verify released SHA and visible version, direct Vercel topology and identity behavior, normal synthetic public flow without personal data, oversize rejection, safe synthetic rate-limit boundary, no unexpected errors/raw identity logs, migration readback/RLS/grants/proof lifecycle, and no persistent synthetic residue after cleanup.

### FILES

The implementation candidate file scope is frozen to:

- Application: `apps/hr-suite/app/api/public/recruitment/vacancies/[publicId]/applications/route.ts`.
- Helpers: add `apps/hr-suite/lib/security/trusted-client-identity.ts` and `apps/hr-suite/lib/http/bounded-request-body.ts`; modify `apps/hr-suite/lib/recruitment/public-security.ts`.
- Services: modify `apps/hr-suite/lib/recruitment/public-intake-service.ts`, `apps/hr-suite/lib/recruitment/application-service.ts`, `apps/hr-suite/lib/recruitment/errors.ts`, `apps/hr-suite/lib/recruitment/guided-service.ts`, and `apps/hr-suite/app/api/cron/recruitment-retention/route.ts`.
- Database: add one timestamped migration; modify `apps/hr-suite/supabase/tests/recruitment_foundation_contract.sql`, `apps/hr-suite/supabase/tests/security_wave_b_rpc_grants.sql`, and `apps/hr-suite/lib/recruitment/migration-contract.test.ts`; regenerate `packages/db/types.ts` only after the approved local schema change.
- Tests: add `apps/hr-suite/lib/security/trusted-client-identity.test.ts`, `apps/hr-suite/lib/http/bounded-request-body.test.ts`, and the public application route test; modify the public security and public intake tests.

Explicitly out of this implementation candidate: `next.config.ts`, `apps/hr-suite/lib/recruitment/document-service.ts` behavior, UI, package/dependency changes, visible version, migration-history edits, `.env.local`, GitHub settings, Vercel settings/configuration, production deployment, and remote Supabase mutation without separate explicit authorization.

### OPEN ITEMS

- Production acceptance must re-confirm that the inspected public domains terminate directly at Vercel and that no custom reverse proxy/CDN is introduced before trusting the provider header contract.
- The additive migration must perform a read-only legacy-proof preflight immediately before implementation. The current inspected remote intake-limit and document tables are empty.
- Operations must confirm platform log retention/access for the allowlisted security events; this is a governance follow-up, not an SEC-012 correctness blocker.
- SEC-005 remains a separate residual for canonical host/origin resolution and future proxy/custom-domain changes.

### VERIFICATION

The candidate performed exact-baseline/worktree checks, read-only Supabase catalog and advisor checks, local migration-contract checks, the full hr-suite test suite (`318` files / `1,249` tests), typecheck, lint, and a successful production build. The local Supabase lint could not connect because no local database was listening on `127.0.0.1:54322`. No remote migration, deployment, browser/Production acceptance, provider-settings change, or generated DB type update was performed.

### MUTATIONS

The implementation-candidate mutation is limited to the listed app helpers/route/service changes, tests, one local migration, and this evidence update. No package or lockfile, version, `next.config.ts`, canonical environment file, migration history, remote Supabase schema/data, Vercel/GitHub setting, deployment, or `main` branch was changed. The canonical `apps/hr-suite/.env.local` was verified to exist and remain ignored; its values were not read or printed.

### CANDIDATE

The implementation candidate is branch `security/sec012-public-intake-implementation`, based on review SHA `28f905189a1fe7de1ee972ed55ce69b362b915d0`. The candidate commit contains the scoped route, helpers, services, tests, one local migration, SQL contracts, and this evidence update. No merge to `main` or remote migration apply is part of this candidate. The candidate branch is pushed non-force only if the explicitly requested remote branch operation succeeds.

### NEXT

Remaining gates are direct Vercel/Production acceptance, migration application/readback after separate authorization, local database advisors/contracts against the applied schema, and proof of cleanup/no residue. SEC-012 remains `OPEN`; SEC-005 remains unchanged and unrelated findings remain untouched.

## Files changed by this implementation candidate

- `docs/security/SEC-012_PUBLIC_RECRUITMENT_ABUSE_DESIGN.md`

The exact implementation file list is reported in the candidate verification and is intentionally limited to the approved SEC-012 scope.

## Candidate verification boundary

This candidate includes local code/test/build verification and read-only advisor/catalog checks. Remote schema mutation, deployment, browser/Production acceptance, and any migration-history repair remain out of scope.
