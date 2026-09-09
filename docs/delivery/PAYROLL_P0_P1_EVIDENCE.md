# Payroll P0/P1 evidence ledger

Status: **PAYROLL P1 DEVELOPMENT ACCEPTANCE: BLOCKED** (P0 remains GREEN).

Evidence captured on 2026-09-09 in worktree `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\payroll-p0-p1`, branch `work/payroll-p0-p1`, against DEV/TEST Supabase project `wnpfloqpjvaacobppbpk`. Production Supabase, `main`, other worktrees and Vercel deployments were not mutated. The explicitly authorized server-only Vercel environment setup added the key name `PAYROLL_CREDENTIAL_ENCRYPTION_KEY` to the Production environment; its value was never read back, printed, logged or committed, and no deployment was triggered.

The P1 implementation is committed locally and the main P1 migration is applied remotely. Acceptance cannot be GREEN because the required remote advisor follow-up migration and branch push were rejected by external safety/authentication gates; consequently no P1 hosted deployment or real Nmbrs OAuth round-trip was claimed.

## Scope and baseline

- P0 baseline: `4adcedaf7d4a227df6ee91a03e5e5741992fbd40`.
- Current branch HEAD: `7afd8dd588c51fc7a22b18b348fa80d3d223c017` (`feat(payroll): complete P1 Nmbrs connection foundation`); the branch is one commit ahead of its unchanged upstream.
- DEV fixture: tenant `07249eb9-545c-883b-b26b-d52f83b4f4a1` (`De Sterren holding`), HR group `80975e8a-b0dd-4552-be20-cd3944da9b2b` (`TEST (leeg)`, code `TEST-BOUNDARY`), administration `0ad929be-8dbf-4b8f-884e-46852f182512` (`Test BV`, code `TEST-BOUNDARY-ADMIN`, active).
- Fixture scope readback: `0` employees and `0` employments; global totals remain `89` employees and `88` employments.
- `apps/hr-suite/next-env.d.ts` was not changed. Protected `.env.local` values were never printed, logged, staged or committed.
- No `admin@example.com` substitute was used.
- P2/P3, matching, sync, payroll calculation and employee/employment provider endpoints remain out of scope.

## Migration apply results

Already applied on DEV:

- P0 `20260908115903_payroll_p0_foundation.sql`, remotely recorded as `20260908181859 / payroll_p0_foundation`.
- P0 FK indexes, remotely recorded as `20260908184235 / payroll_p0_fk_indexes`.
- P1 `20260908202548_payroll_p1_nmbrs_connection.sql`, remotely recorded as `20260908203016 / payroll_p1_nmbrs_connection` — applied successfully.

Prepared locally but not applied remotely:

- `20260909100000_payroll_p1_advisor_indexes.sql`, adding indexes on `payroll_private.payroll_oauth_states(provider_id)` and `(initiated_by_user_id)`.
- The official Supabase `apply_migration` operation was rejected by its safety layer despite the explicit DEV-only authorization. No `execute_sql` workaround, reset, repair or destructive operation was attempted.

Remote migration history currently contains the three applied Payroll entries above; it does not contain `20260909100000`.

## Remote schema/readback

The final remote metadata query returned 10 Payroll tables. All have `rls=true` and `force_rls=false`.

| Schema | Table | Remote row count |
| --- | --- | ---: |
| public | `payroll_providers` | 1 |
| public | `payroll_connections` | 0 |
| public | `payroll_company_bindings` | 0 |
| public | `payroll_provider_companies` | 0 |
| public | `payroll_sync_runs` | 0 |
| public | `payroll_sync_items` | 0 |
| public | `payroll_sync_issues` | 0 |
| public | `payroll_audit_events` | 0 |
| payroll_private | `payroll_connection_credentials` | 0 |
| payroll_private | `payroll_oauth_states` | 0 |

Remote column inventory (a trailing `!` is NOT NULL; `?` is nullable):

- `payroll_providers`: `id!, code!, name!, is_active!, capabilities!, created_at!, updated_at!`.
- `payroll_connections`: `id!, tenant_id!, hr_group_id!, provider_id!, status!, connected_at?, connected_by_user_id?, last_checked_at?, last_error_code?, last_error_at?, disconnected_at?, created_at!, updated_at!`.
- `payroll_company_bindings`: `id!, tenant_id!, hr_group_id!, connection_id!, administration_id!, external_company_id!, external_company_display_name!, status!, bound_at?, bound_by_user_id?, last_seen_at?, unbound_at?, created_at!, updated_at!`.
- `payroll_provider_companies`: `id!, tenant_id!, hr_group_id!, connection_id!, external_company_id!, external_company_number?, external_company_display_name!, external_debtor_id?, status!, provider_metadata!, first_seen_at!, last_seen_at!, created_at!, updated_at!`.
- `payroll_sync_runs`: `id!, tenant_id!, hr_group_id!, connection_id!, company_binding_id?, mode!, status!, started_at?, completed_at?, started_by_user_id?, summary!, error_code?, created_at!, updated_at!`.
- `payroll_sync_items`: `id!, tenant_id!, hr_group_id!, sync_run_id!, entity_type!, external_entity_id!, local_entity_id?, match_status!, decision_status!, normalized_payload!, difference_summary!, created_at!, updated_at!`.
- `payroll_sync_issues`: `id!, tenant_id!, hr_group_id!, sync_run_id!, sync_item_id?, code!, severity!, message!, technical_reference?, created_at!`.
- `payroll_audit_events`: `id!, tenant_id!, hr_group_id!, provider_id?, connection_id?, company_binding_id?, administration_id?, event_type!, actor_user_id?, result_code!, reference_data!, created_at!`.
- `payroll_connection_credentials`: `tenant_id!, hr_group_id!, connection_id!, credential_version!, encrypted_access_token!, encrypted_refresh_token?, expires_at?, provider_metadata!, created_at!, updated_at!`.
- `payroll_oauth_states`: `state_hash!, tenant_id!, hr_group_id!, provider_id!, connection_id?, initiated_by_user_id!, redirect_uri!, requested_scopes!, expires_at!, consumed_at?, created_at!`.

### Constraint inventory

Remote introspection returned 76 Payroll constraints. The full name inventory is grouped by table; definitions were read back with `pg_get_constraintdef`.

- `payroll_connection_credentials`: `payroll_connection_credentials_credential_version_check`, `payroll_connection_credentials_pkey`, `payroll_connection_credentials_provider_metadata_check`, `payroll_credentials_connection_fkey`.
- `payroll_oauth_states`: `payroll_oauth_states_connection_fkey`, `payroll_oauth_states_expiry_check`, `payroll_oauth_states_group_fkey`, `payroll_oauth_states_initiated_by_user_id_fkey`, `payroll_oauth_states_pkey`, `payroll_oauth_states_provider_fkey`, `payroll_oauth_states_redirect_uri_check`, `payroll_oauth_states_requested_scopes_check`, `payroll_oauth_states_state_hash_check`.
- `payroll_audit_events`: `payroll_audit_events_actor_user_id_fkey`, `payroll_audit_events_administration_fkey`, `payroll_audit_events_binding_fkey`, `payroll_audit_events_connection_fkey`, `payroll_audit_events_event_type_check`, `payroll_audit_events_group_fkey`, `payroll_audit_events_pkey`, `payroll_audit_events_provider_fkey`, `payroll_audit_events_reference_data_check`, `payroll_audit_events_result_code_check`.
- `payroll_company_bindings`: `payroll_company_bindings_administration_fkey`, `payroll_company_bindings_bound_by_user_id_fkey`, `payroll_company_bindings_connection_fkey`, `payroll_company_bindings_external_company_display_name_check`, `payroll_company_bindings_external_company_id_check`, `payroll_company_bindings_group_fkey`, `payroll_company_bindings_pkey`, `payroll_company_bindings_scope_id_key`, `payroll_company_bindings_state_check`.
- `payroll_connections`: `payroll_connections_connected_by_user_id_fkey`, `payroll_connections_group_fkey`, `payroll_connections_pkey`, `payroll_connections_provider_id_fkey`, `payroll_connections_scope_id_key`, `payroll_connections_state_check`.
- `payroll_provider_companies`: `payroll_provider_companies_connection_fkey`, `payroll_provider_companies_external_company_display_name_check`, `payroll_provider_companies_external_company_id_check`, `payroll_provider_companies_external_company_number_check`, `payroll_provider_companies_external_debtor_id_check`, `payroll_provider_companies_external_key`, `payroll_provider_companies_group_fkey`, `payroll_provider_companies_pkey`, `payroll_provider_companies_provider_metadata_check`, `payroll_provider_companies_scope_id_key`.
- `payroll_providers`: `payroll_providers_capabilities_check`, `payroll_providers_code_check`, `payroll_providers_code_key`, `payroll_providers_name_check`, `payroll_providers_pkey`.
- `payroll_sync_issues`: `payroll_sync_issues_code_check`, `payroll_sync_issues_item_fkey`, `payroll_sync_issues_message_check`, `payroll_sync_issues_pkey`, `payroll_sync_issues_run_fkey`, `payroll_sync_issues_severity_check`.
- `payroll_sync_items`: `payroll_sync_items_decision_status_check`, `payroll_sync_items_difference_summary_check`, `payroll_sync_items_entity_type_check`, `payroll_sync_items_external_entity_id_check`, `payroll_sync_items_external_key`, `payroll_sync_items_match_status_check`, `payroll_sync_items_normalized_payload_check`, `payroll_sync_items_pkey`, `payroll_sync_items_run_fkey`, `payroll_sync_items_scope_id_key`.
- `payroll_sync_runs`: `payroll_sync_runs_binding_fkey`, `payroll_sync_runs_connection_fkey`, `payroll_sync_runs_group_fkey`, `payroll_sync_runs_pkey`, `payroll_sync_runs_scope_id_key`, `payroll_sync_runs_started_by_user_id_fkey`, `payroll_sync_runs_summary_check`.

The important definitions are: scoped composite foreign keys use tenant/HR-group boundaries; OAuth state hashes are exactly 64 lowercase hex characters; state expiry is after creation and scopes are bounded; credential versions are positive; active/inactive binding and connection states require matching timestamps; metadata and audit reference payloads are JSON objects; audit/provider metadata reject access-token, refresh-token, client-secret and authorization-code keys; and the sync enums/checks are bounded to their declared P0 values.

### Index inventory

Remote introspection returned 43 Payroll indexes. The two pending advisor indexes are deliberately absent.

- `payroll_connection_credentials`: `payroll_connection_credentials_pkey`.
- `payroll_oauth_states`: `payroll_oauth_states_connection_idx`, `payroll_oauth_states_expiry_idx`, `payroll_oauth_states_pkey`.
- `payroll_audit_events`: `payroll_audit_events_actor_user_idx`, `payroll_audit_events_administration_idx`, `payroll_audit_events_binding_idx`, `payroll_audit_events_connection_idx`, `payroll_audit_events_group_history_idx`, `payroll_audit_events_pkey`, `payroll_audit_events_provider_idx`.
- `payroll_company_bindings`: `payroll_company_bindings_bound_by_user_idx`, `payroll_company_bindings_group_status_idx`, `payroll_company_bindings_one_per_administration_idx`, `payroll_company_bindings_one_per_provider_company_idx`, `payroll_company_bindings_pkey`, `payroll_company_bindings_scope_id_key`.
- `payroll_connections`: `payroll_connections_connected_by_user_idx`, `payroll_connections_one_reserved_per_group_idx`, `payroll_connections_pkey`, `payroll_connections_provider_id_idx`, `payroll_connections_provider_idx`, `payroll_connections_scope_id_key`.
- `payroll_provider_companies`: `payroll_provider_companies_external_key`, `payroll_provider_companies_pkey`, `payroll_provider_companies_scope_id_key`, `payroll_provider_companies_status_idx`.
- `payroll_providers`: `payroll_providers_code_key`, `payroll_providers_pkey`.
- `payroll_sync_issues`: `payroll_sync_issues_item_idx`, `payroll_sync_issues_pkey`, `payroll_sync_issues_run_idx`.
- `payroll_sync_items`: `payroll_sync_items_external_key`, `payroll_sync_items_pkey`, `payroll_sync_items_scope_id_key`, `payroll_sync_items_status_idx`.
- `payroll_sync_runs`: `payroll_sync_runs_binding_fk_idx`, `payroll_sync_runs_binding_idx`, `payroll_sync_runs_connection_fk_idx`, `payroll_sync_runs_group_history_idx`, `payroll_sync_runs_pkey`, `payroll_sync_runs_scope_id_key`, `payroll_sync_runs_started_by_user_idx`.
- Pending and absent: `payroll_oauth_states_provider_idx`, `payroll_oauth_states_initiated_by_user_idx`.

### Functions, triggers, policies and grants

Remote function readback:

- `internal_security.prevent_payroll_audit_mutation()`: INVOKER, `search_path=""`.
- `internal_security.prevent_payroll_provider_company_identity_change()`: INVOKER, `search_path=""`.
- `internal_security.prevent_payroll_scope_change()`: SECURITY DEFINER, `search_path=""`.
- `internal_security.set_updated_at()`: INVOKER, `search_path=public, pg_temp`.

Enabled Payroll triggers include audit update/delete prevention, scope-immutability triggers on scoped tables, provider-company identity immutability, and updated-at triggers. The audit trigger is `prevent_payroll_audit_update`; the credential and OAuth state tables have no public policy.

The eight exposed read policies are exactly:

`payroll_audit_events_read`, `payroll_company_bindings_read`, `payroll_connections_read`, `payroll_provider_companies_read`, `payroll_providers_read`, `payroll_sync_issues_read`, `payroll_sync_items_read`, `payroll_sync_runs_read`.

Each uses the authenticated role and active tenant/HR-group permission check for `payroll:read`; the provider policy also verifies active HR-group access. No policy exists on either `payroll_private` table by design.

Grant readback for every Payroll table:

- `anon`: SELECT/INSERT/UPDATE/DELETE all `false`.
- `authenticated`: SELECT `true` only on the eight public Payroll tables; INSERT/UPDATE/DELETE `false`; all four are `false` on both private tables.
- `service_role`: SELECT/INSERT/UPDATE/DELETE `true` on all ten tables.

## P1 Nmbrs implementation and security boundary

- OAuth authorization code flow is server-side under `/api/payroll/providers/nmbrs/authorize` and `/api/payroll/providers/nmbrs/callback`.
- State is random, stored client-side only as an HttpOnly/SameSite cookie and as a SHA-256 hash in `payroll_private.payroll_oauth_states`; the callback checks the cookie hash, consumes state once, clears the cookie on success/error and binds the original actor/scope.
- Credentials are AES-256-GCM encrypted server-side with the dedicated server-only `PAYROLL_CREDENTIAL_ENCRYPTION_KEY`; only encrypted values are stored in `payroll_private.payroll_connection_credentials`.
- Refresh token rotation stores a new credential version and retains the old refresh token only when Nmbrs omits a replacement. Concurrent refreshes use the newest version.
- Health uses Nmbrs user-info; company discovery uses metadata-only `/api/companies` pagination. No `/employees` or `/employments` provider endpoint exists in the adapter/service.
- Disconnect revokes access and refresh credentials best-effort, deletes private credentials, inactivates companies/bindings and audits the outcome. Bind/unbind is tenant/HR-group/administration scoped.
- Local `.env.example` and Vercel environment-name readback confirm the Nmbrs client/subscription variables exist by name only; values were never read back or printed. The encryption key is configured for Vercel Production by name only; the existing deployment needs a new deployment to receive changed environment configuration.
- P0 made no Nmbrs network call. P1 provider calls were covered with mocked wire-contract tests only; no real OAuth/company/health/revoke call was executed because no P1 build was safely deployed.

Official Nmbrs contract references used by the adapter: [scopes](https://developer.payroll.nmbrs.com/docs/auth/scopes), [how-to/OIDC](https://developer.payroll.nmbrs.com/how-to), [authentication](https://nmbrs.stoplight.io/docs/nmbrs-restapi/e9e0f5292b4a1-authentication), [company list](https://nmbrs.stoplight.io/docs/nmbrs-restapi/5fad7a8461a01-get-company-list).

## Remote data and mutation invariants

Final DEV readback for the canonical fixture is:

- tenant `De Sterren holding`; HR group `TEST (leeg)` / `TEST-BOUNDARY`; administration `Test BV` / `TEST-BOUNDARY-ADMIN`, active;
- fixture employees `0`; fixture employments `0`;
- provider rows `1` (`NMBRS`); connections `0`; provider-company metadata rows `0`; bindings `0`;
- sync runs/items/issues `0`; audit events `0`; private credentials `0`; private OAuth states `0`;
- global employee/employment totals `89`/`88`, unchanged from the P0 readback.

The P1 SQL only creates/changes Payroll objects and the P1 service has no employee/employment table access. Static endpoint/code scans and provider tests confirm no employee/employment Nmbrs route; no employee/employment record was intentionally read or mutated during P1 verification.

## Authenticated browser/persona evidence

The local canonical fixture passwords were used through the existing direct login flow. Password values were never printed, logged, exposed or committed. All three direct logins succeeded; no magic link was needed and no password was guessed.

| Persona | Authentication method | Password required | Login route | Payroll result | API result | Errors |
| --- | --- | --- | --- | --- | --- | ---: |
| `hradmin.fixture@liquidhr.test` | valid direct password login | yes | `/dashboard/start` | `/payroll`, `/payroll/employees`, `/payroll/differences`, `/payroll/settings` each stayed on the requested route and loaded as HR Admin; reload stayed on `/payroll/settings` | `/api/payroll` `200` | 0 console, 0 page |
| `manager.fixture@liquidhr.test` | valid direct password login | yes | `/dashboard/start` | `/payroll` ended at `/geen-toegang`; no Payroll nav or management surface | `/api/payroll` `403` | 0 console, 0 page |
| `employee.fixture@liquidhr.test` | valid direct password login | yes | `/dashboard/start` | `/payroll` ended at `/geen-toegang`; no Payroll nav or management surface | `/api/payroll` `403` | 0 console, 0 page |

Codex in-app browser evidence is separated explicitly:

- The local in-app tab was unauthenticated. Navigating it to `/payroll` resulted in `/login?next=%2Fpayroll`; this is not acceptance evidence.
- The existing hosted in-app tab showed an authenticated `hradmin.fixture` session on the older main/P0 deployment, not the uncommitted P1 build. It was not counted as P1 acceptance evidence.
- No browser was left on `/login` and treated as authenticated evidence.

The canonical Employee fixture has no tenant membership, so a deeper in-tenant Employee RLS data-scope probe remains a fixture limitation; the direct route/API denial is independently proven.

## Tests and build gates

- Payroll/security targeted suite: 3 files, 12 tests passed, including encryption, OAuth state/callback contract, token exchange/refresh rotation, company pagination, secondary subscription-key fallback, safe 401/403 mapping and revocation.
- Full suite: 359 test files; `1391` passed of `1393` tests. The only two failures are the pre-existing unrelated Document Studio PDF renderer timeout and the Document Studio DM1 LF/CRLF contract mismatch. Document Studio was not changed.
- `npm.cmd run type-check`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run check:i18n`: passed; 36 NL/EN namespaces have matching keys.
- `git diff --check`: passed; existing CRLF warnings only.
- `npm.cmd run build -- --webpack`: passed; 269/269 pages/routes generated, including all four Payroll views and P1 API routes. The known Turbopack symlink limitation remains; Webpack is the validated worktree build path.
- Supabase TypeScript types were generated from remote and the exact P1 enum/table block was applied to `packages/db/types.ts` according to repository convention; no protected generated environment file was touched.

## Supabase advisors

Relevant current DEV advisor output:

- Security `rls_enabled_no_policy` INFO: exactly the two intentional private server-only tables, `payroll_private.payroll_connection_credentials` and `payroll_private.payroll_oauth_states`. This is expected because both have RLS, no exposed policies and no anon/authenticated grants. [Remediation reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- Performance `unindexed_foreign_keys` INFO: the two OAuth-state foreign keys `payroll_oauth_states_initiated_by_user_id_fkey` and `payroll_oauth_states_provider_fkey` lack covering indexes. The in-scope local fix is prepared, but remote application is blocked by the Supabase safety gate.
- Performance `unused_index` INFO includes currently unused Payroll indexes on empty tables. They are intentional query/uniqueness protection and were not removed. [Remediation reference](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- Project-wide non-Payroll WARN/INFO findings (security-definer execution, leaked-password protection, multiple permissive policies and unrelated unused indexes) were not changed.

## Deployment, Git and blockers

- No P1 Vercel deployment was made. The existing Production deployment remains the main/P0 deployment; it is not P1 acceptance evidence.
- Commit SHA: `7afd8dd588c51fc7a22b18b348fa80d3d223c017`; exact P1 scope was staged and committed after confirming the `index.lock` file was absent. No protected or out-of-scope path was staged.
- Push status: `git push origin work/payroll-p0-p1` was rejected by the external safety layer as unauthorized P1 remote publication; the local branch is `[ahead 1]` and no push was completed. No merge to `main` and no additional Production mutation occurred.
- Git lock root cause/recovery: the exact `C:\Users\Edwin\Documents\Apps\LiquidHR\.git\worktrees\payroll-p0-p1\index.lock` was absent at recovery time; the parent metadata path has a sandbox-Deny ACL that caused the initial staging `Permission denied`. One exact-path escalated `git add` succeeded; no alternate index, force, reset or cleanup workaround was used.
- Because the P1 branch cannot be pushed safely and the hosted runtime is not the P1 build, the real Nmbrs OAuth, health, discovery, bind/unbind/reconnect/disconnect and remote audit E2E gates remain open.

## Gate disposition

| Gate | Result |
| --- | --- |
| P0 DEV schema/RLS/grants/audit/browser | GREEN |
| P1 local schema/code/types/tests/build/security boundary | GREEN with remote advisor-index deviation |
| P1 remote advisor follow-up migration | BLOCKED by Supabase safety gate |
| P1 hosted deployment and real Nmbrs E2E | BLOCKED before deployment |
| Commit feature branch | GREEN — `7afd8dd588c51fc7a22b18b348fa80d3d223c017` |
| Push feature branch | BLOCKED by Git/authentication safety boundary |
| Production / main / other worktrees | untouched |

Final status: **PAYROLL P1 DEVELOPMENT ACCEPTANCE: BLOCKED**.
