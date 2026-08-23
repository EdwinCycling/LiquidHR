# Employment labor-condition mutation — handoff

## Scope and baseline

- Baseline: `7ef5e39dae8995eafbefcd8f2c0d9eb950c75e21`
- Branch: `work/bug-employment-labor-condition`
- Worktree: `.codex-worktrees/bug-employment-labor-condition`
- Port: `3128`
- Weight: HIGH; parallel group: BUGFIX
- Scope stayed limited to employment labor-condition mutation, its schema migration, and regression test.
- No UX Foundation, central documentation, version, production, push, merge, or deploy was touched. Remote schema apply was performed only on TEST after explicit follow-up authorization.

## Preflight and fixture

- TEST Supabase project: `wnpfloqpjvaacobppbpk`.
- Fixture password preflight completed with `scripts/set-talent-fixture-passwords.mjs`.
- `.env.local` was read from the existing main checkout for local runtime/auth only; it was not copied, logged, or committed.
- Existing debt handoff and old employment branch were inspected as evidence only; their broad changes were not carried forward.

## Snapshot and reproduction

Fixture `DEMO-035` / Noah Hendriks was the active non-CAO employment:

- employee: `DEMO-035`
- employment: `eb1eea55-62c4-4b85-a3e9-20dca923e7d4`
- contract: `5870e864-462b-8883-dd40-d258a3346509`
- current labor-condition row: `2c2a57ad-4687-1832-5240-3726229e718b`
- current condition: `Bedrijfseigen regeling`, valid from `2024-01-15`
- HR group: `6ba6f1df-e376-40f2-abff-ffdf000172e1`
- current row had `change_set_id = null`.

The authenticated HR browser reproduced the existing UI state: `CAO aanpassen` opens the wizard, but the labor-condition step is unavailable and the next action ends with `Vul eerst alle verplichte velden in.` The real authenticated API probe was:

```text
POST /api/employments/eb1eea55-62c4-4b85-a3e9-20dca923e7d4/timeline/LABOR_CONDITIONS
```

with a valid contract, future effective date, reason, and `payload.conditionGroup`. Result before the fix:

```text
HTTP 400 {"code":"EMPLOYMENT_CHANGE_FAILED"}
```

No probe row was created.

## Root cause classification

1. API route parses the labor-condition mutation and maps database failures to the generic `EMPLOYMENT_CHANGE_FAILED` response.
2. Employment service performs the server-side `contract:write` check and calls `apply_employment_timeline_mutation`; this path is not the defect.
3. Both deployed timeline RPCs insert into `employment_labor_conditions` without `hr_group_id` and `employment_contract_id`.
4. The existing `normalize_employment_labor_condition` trigger filled only `employment_contract_id`.
5. `employment_labor_conditions.hr_group_id` is `NOT NULL`; the RLS boundary policy checks `internal_security.has_hr_group_access(tenant_id, hr_group_id)`. The inserted null HR group therefore failed before a row could be created.
6. Supabase Postgres logs confirmed: `new row violates row-level security policy "employment_labor_conditions_hr_group_boundary"`.
7. Authenticated has execute privilege on both RPCs and anon does not; grants are not the cause.

Classification: fixture/data **no**; app/service **no**; RPC/schema alignment **yes**; RLS/grant configuration **no**.

## Fix

Migration:

```text
20260823122852_fix_employment_labor_condition_mutation_hr_group_scope.sql
```

The migration replaces the existing employment labor-condition normalizer. Before RLS evaluation it derives the canonical `hr_group_id` from the matching employment scope, rejects a supplied mismatching group, and preserves the existing effective-date contract lookup. This covers both the standalone and combined mutation RPC because both insert through the same trigger. No RPC or UI contract was broadened.

Regression test:

```text
apps/hr-suite/supabase/tests/employment_labor_condition_mutation.sql
```

The pgTAP test covers RPC existence/security/execute privileges and successful standalone plus combined labor-condition insertion with HR-group and contract scope. A pre-apply remote transaction probe showed both mutation paths failing (`2/2`), and rolled back. After explicit authorization, migration `20260823122852_fix_employment_labor_condition_mutation_hr_group_scope` was applied to TEST and the full pgTAP suite passed (`14/14`).

The Supabase MCP assigned the applied remote history entry the server timestamp `20260823134108` with the same migration name; the committed local source remains `20260823122852_fix_employment_labor_condition_mutation_hr_group_scope.sql`.

## Authorization and restore evidence

- HR Admin: authenticated API probe reached the mutation and reproduced the pre-fix HTTP 400.
- HR Admin post-apply: authenticated API mutation returned HTTP 201 with a change-set ID; readback showed the new condition, canonical HR group, contract ID, and `status = APPLIED`.
- HR Admin restore: the existing rollback API returned HTTP 200; the final employment timeline contains only the original labor-condition row.
- Manager: same endpoint returned HTTP 403, `Je hebt onvoldoende rechten voor deze actie.`
- Employee: same endpoint returned HTTP 403, `Je hebt geen selfservice-recht voor deze actie.`
- Final readback: the original labor-condition row remains `Bedrijfseigen regeling`, valid from `2024-01-15`, with `change_set_id = null`; probe rows and changed rows are both `0`.

## Local gates

- Targeted employment tests: 5 files, 34 tests passed.
- Strict TypeScript: passed.
- Lint: passed with 0 errors and 8 pre-existing warnings outside this change.
- `git diff --check`: passed.
- Supabase migration apply: TEST only, completed after explicit authorization.
- Supabase advisors: checked; only existing project-wide notices were returned.

## Handoff status

**GREEN**

Root cause: both employment timeline RPCs omitted the required HR-group scope, while the pre-RLS normalizer only filled contract scope; the HR-group boundary policy consequently rejected the insert.

TEST apply and the authenticated positive/negative mutation matrix are complete. The migration has not been applied to production.
