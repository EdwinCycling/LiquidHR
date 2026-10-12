# APIAI-09 — Manager Self-Service AI Assistant

**Status:** final code/test candidate `27d534fd06fee7868b3bf0534bc3fdb9a3736cd1` is on PR #18. Independent spec and standards reviews found no remaining blocker in the reviewed code paths. Strict TypeScript, targeted ESLint, i18n, diff-check, 19 focused files/180 tests, and the full HR suite (616 files passed, 4 skipped; 2,930 tests passed, 8 skipped) are green. Vercel Preview `dpl_4wdGu1WWCbjqbLqRV5qbhZfKCCkz` is READY with exact-SHA provenance. **HOLD / NOT RELEASED:** Preview backend isolation and hosted Employee/Manager authorization, audit, limiter, canonical-balance, and revoke/reconnect acceptance remain open. PR #18 stays Draft and unmerged. This requirement supersedes APIAI-07's original statement that Manager tools are not externally advertised; it does not authorize HR tools or any write tool.

## User value

A current Direct Manager can read current information from LiquidHR's existing canonical services about their own direct team:

1. Team overview.
2. Pending manager work.
3. Approved leave calendar.
4. Development plans that need follow-up.
5. Talent follow-ups.
6. Team capability matrix using the existing capability implementation.

## Tool contract

The Remote MCP catalog exposes these bounded, read-only tools:

- `manager.team.overview.read`
- `manager.work.pending.read`
- `manager.leave.calendar.read`
- `manager.talent.development-plans.read`
- `manager.talent.follow-ups.read`
- `manager.talent.team-capability-matrix.read`

Tools use typed input/output contracts, bounded result sizes and pagination or truncation indicators where needed. They return only fields required for the stated purpose. They do not return salary, bank, national identifier, medical, protected-case or unnecessary free-text data, and they do not perform writes.

## Authorization and consent

- Resolve the current Direct Manager identity, tenant, HR group, administration, employment, team membership, permissions, modules and data scope server-side. Never accept caller-selected employee, team, tenant, HR group, administration or role as authorization evidence.
- Continue using the existing OAuth-bound delegated bearer and the same bearer-bound RLS client. Each Manager call verifies the bearer, fetches the current Auth user, checks both the active user-scoped OAuth grant for the verified client ID and the current per-client Manager-consent version, then binds RLS and resolves current Manager context before dispatch through the existing audit and rate-limit path. This active-grant read is required because a revoked Supabase access JWT can remain statelessly valid until expiry. Missing, stale or malformed claims, grants, metadata, context, permissions, modules, RLS binding, audit or limiter fail closed.
- Existing OAuth grants and the existing scopes `openid email offline_access` do not imply Manager consent. A new Manager capability or disclosure version is not activated for data access until the authenticated user explicitly opts in on `/oauth/connections` for the exact existing ChatGPT OAuth client while a unique current Direct Manager context is available.
- Store the current consent marker only in trusted Auth `app_metadata`, keyed to the validated OAuth client ID. Do not trust `user_metadata`, browser-supplied scopes, cached token metadata or user-selected client IDs. Admin updates must preserve unrelated metadata and verify the resulting marker.
- Ordinary OAuth approval does not grant Manager consent. In-app revoke clears and verifies the marker before revoking the grant. A new OAuth approval clears any old per-client marker before issuing a new grant. An already-approved Supabase redirect first reads current ChatGPT grants and clears their Manager markers; errors block redirect. Reconnection cannot restore Manager access without a fresh explicit opt-in.
- MCP discovery metadata may identify the bounded Manager tools; discovery alone grants no access. Every Manager tool call remains denied without valid bearer authentication, the exact current consent version and current server-derived Manager authorization.
- Manager consent does not change OAuth scopes, roles, permissions, tenant access or RLS policies. Employee access remains on its existing route and contract.

## Non-goals and infrastructure

No database migration, schema change, OAuth scope/client change, Auth hook, new role, RLS expansion, Employee-flow change, externally callable WRITE tool, payroll change or manual Auth metadata mutation is included. Use existing Auth `app_metadata` and existing services. If a future implementation cannot satisfy the gate without changing schema or TEST auth configuration, prepare the exact change, impact, rollback and safety evidence first and request separate authorization.

## Required acceptance

- Positive Manager read tests use only the direct team and canonical service data.
- Negative tests deny Employee-only, HR-only, missing, ambiguous or unavailable Manager context; forged selectors; other team, tenant, HR group or administration; inactive permissions/modules; and malformed or expired bearers.
- A valid old grant without the current client-bound marker is denied. Old access/refresh token paths, revoke, disconnect, and reconnect with the same OAuth client cannot bypass the gate. A fresh opt-in is required.
- Tests prove the marker is read from trusted current Auth `app_metadata`, is keyed to the verified OAuth client ID, and does not overwrite unrelated metadata. Consent requires a real authenticated session, existing matching ChatGPT grant, current Direct Manager context and same-origin Server Action protections.
- Employee tools and scopes remain unchanged. Audit and limiter failures deny access. RLS remains bearer-bound and tenant/team scoped.
- Run focused OAuth/consent/MCP and scope regressions, the full HR suite, strict TypeScript, changed-file ESLint, i18n, `git diff --check`, exact-candidate build and independent security review.
- Before merge, review the complete PR diff and prove the Preview build and provenance on the exact candidate SHA. Do not run authenticated Preview calls against the shared TEST backend.
- Hosted acceptance requires eight Employee reads, six Manager reads, explicit Manager opt-in, old-grant/no-opt-in negatives, revoke/disconnect/reconnect, privacy/scope negatives, audit and limiter readback, and canonical leave-balance reconciliation. Record unperformed checks as open; a TEST deployment is not completed acceptance.

## Rollback and kill switch

Keep the existing tested main deployment as rollback reference. If a critical authorization regression appears, use the existing MCP kill switch/approved TEST rollout path immediately; do not repair evidence with direct SQL, service-role business-data writes, forged consent or permission changes.
