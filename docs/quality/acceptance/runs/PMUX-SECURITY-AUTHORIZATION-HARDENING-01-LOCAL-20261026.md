# PMUX-SECURITY-AUTHORIZATION-HARDENING-01 — local security review

**Verdict:** LOCAL HARDENING PASS; Core TEST MIGRATION OPEN; HOSTED ACCEPTANCE OPEN

**Date:** 2026-10-26

**Local branch:** `work/pmux-security-authorization-hardening-01-20261026`

**Base:** `origin/main` `11ba924b4a726431ae7928cfd8d2201d738893b4`

## Root cause

The defect is in shared Process Automation authorization. WVP's `PERMISSION_WORK_QUEUE` configuration exposed it, but changing only that process definition would leave the same bypass in other workflows.

The Core TEST read-only function readback confirmed the existing `process_assignment_candidate` checks that a candidate employee is active, has an auth user, and is in the requested administration. It does not establish current subject/team scope. The `PERMISSION_WORK_QUEUE` resolver selects by permission and scope grant, so a Manager or Employee can be materialized for a subject they do not manage. In the current database, `perform_process_work_item_action` allows `has_scope_permission OR candidate_ok`; the claim function can fall back to a candidate plus a generic `self:process-task:act` check that is not bound to the process subject. The work-item detail projection also promotes candidate status to `canAct`. The current read helper and RLS candidate policy call into legacy scope/candidate logic.

Thus candidate, read, claim and execute were not kept separate. Immutable candidate snapshots could outlive the team/admin relationship that originally produced them.

## Read-only Core TEST and hosted evidence

- Core TEST project `wnpfloqpjvaacobppbpk` has 585 registered migrations. WVP01 `20261026131216` and WVP audit correction `20261026175140` are present. Hardening migration `20261026190604` is absent.
- `pg_get_functiondef` readback found the legacy candidate/scope code in `claim_process_work_item`, `perform_process_work_item_action`, `process_instance_can_read`, `process_work_item_can_read`, `process_form_actor_allowed`, `get_process_work_projection`, `get_process_work_item_detail`, `commit_internal_transfer`, document acknowledgement/read, and `wvp_case_access`.
- Core RLS is enabled on process instances, work items, candidates and events. Candidate, work-item and event policies delegate to the corresponding read helper; WVP guidance-event RLS calls `wvp_case_access`. Authenticated RPC grants exist for the current task endpoints; the inspected public wrappers had no `anon` execute grant.
- The current Vercel TEST deployment readback is `dpl_BVSDnuTsJYHCvWnVotw4waxpxJ1n`, target `production`, state READY. Vercel reports `source=cli` and no Git-SHA metadata in the current deployment record. Existing AA evidence records build-provenance source SHA `5ec09687a8394955f0445f931a337be8e9984829`; the current API readback did not independently expose that SHA. The hosted bundle/source association remains OPEN. The shared Core TEST database still contains the vulnerable SQL functions.
- No remote migration, process start, process-definition edit, business-data write, push or deployment was performed.

## Actor and scope matrix

“Core now” below is the observed SQL contract, not an authenticated live RPC execution. The isolated PGlite contract test proves the corrected helper behavior; Core TEST has not received the migration.

| Actor and process target | Administration and team relation | Candidate | Read | Claim | Execute | Expected; corrected contract |
| --- | --- | --- | --- | --- | --- | --- |
| Manager; employee in direct team | Matching administration; active direct-manager relation and `process-task` permission | Yes | Yes | Yes | Yes | Same. Latest candidate routes the claim, while current direct-team scope authorizes it. |
| Manager; employee in managed department | Matching administration; active department assignment on target department/ancestor and permission | Yes | Yes | Yes | Yes | Same, after checking the current effective department relation. |
| Manager; employee outside team, same administration; historical queue candidate | Same administration but no current direct or department relation | Yes in observed WVP queue; existing snapshot retained | Current read can pass through broad same-admin process permission; detail can advertise `canAct` from candidacy | Candidate plus generic self permission can pass the current claim path | Current action ORs candidate with scoped permission after claim | No read/claim/action. New resolver filters the candidate; old snapshot remains but cannot authorize any operation. |
| HR Admin; subject in granted tenant/administration | Active matching tenant or administration grant; no employee link required for scoped read/action | Only when routed by the selector | Yes | Yes only when a latest eligible candidate exists | Yes only through an authorized task/claim path | Same explicit scope. Scope does not invent candidacy; assignment/reassignment remains required for claim. |
| HR Admin; subject outside grant; employee-linked stale candidate | No matching administration/tenant grant | Historical candidate may remain | No, absent another valid grant | Current candidate/self-permission fallback can pass for an employee-linked actor | Current candidate OR path can pass on an owned claim | No read/claim/action; stale candidate has no authority. |
| Employee; own process | Exact own employee link and matching `self:process-task:*` permission | Yes where self-assignment is enabled | Yes | Yes when latest eligible candidate | Yes while actor owns the claim | Same exact self scope; no broader employee access. |
| Employee; another employee's process | Different subject, even if the actor has a candidate row in the same administration | A queue may materialize one today | Legacy self permission/candidate read branch can expose the item | Candidate plus own self permission can pass current claim | Current candidate OR path can pass on an owned claim | No read/claim/action. User-to-employee identity and subject-self relation must match. |
| User with no matching process permission | No valid tenant/admin/self scope | No | No | No | No | No. |

## Recommended correction

Keep one PMUX authorization kernel and treat candidate snapshots only as routeability/history:

1. Filter every subject-bound `process-task:*` resolver result—including `PERMISSION_WORK_QUEUE`—through the current exact permission and subject scope. Record `TEAM_SCOPE_REQUIRED` as a rejection; do not mutate earlier candidate snapshots.
2. Require both current permission/scope and the latest eligible candidate at claim. Recheck current permission/scope, claim ownership, item state and versions at execution, before idempotent replay or any write.
3. Use the same current-scope kernel for instance/work-item/candidate reads and `canRead`/`canClaim`/`canAct` projections. Do not derive a read or action right from candidate status.
4. Keep native adapter guards before the first domain write: Leave/ESS-MSS, P9 commit and REQUEST_CHANGES, P10 acknowledgement/document read, and WVP case access. P10 remains the addressed Employee only; no HR Admin override is introduced.
5. Leave roles, permissions, public RPC grants, process history, audit rows and RLS policies otherwise unchanged. Do not alter global `can_manage_employee` or create a parallel authorization system.

If a queue loses all authorized candidates after filtering, the existing no-assignee result remains fail-closed. Any process-definition adjustment is a separate product decision; this migration does not edit or republish definitions.

## Migration proposal

- **ID:** `20261026190604_pmux_security_authorization_hardening`
- **SHA-256:** `fae20ac4b8f9d690ced6fb979a4abc3830feefe577fbf682dc9c298db11c0b63`
- **Database:** LiquidHR Core TEST `wnpfloqpjvaacobppbpk`
- **New private helpers (6):** `process_user_has_scoped_permission`, `process_manager_has_subject_permission`, `process_subject_actor_has_permission`, `process_instance_user_has_permission`, `process_work_item_user_has_permission`, `process_work_item_user_is_latest_candidate`.
- **Replaced functions (15):** `process_instance_can_read`, `process_work_item_can_read`, `process_form_actor_allowed`, `resolve_process_assignment`, `claim_process_work_item`, `release_process_work_item`, `reassign_process_work_item`, `re_resolve_process_work_item`, `perform_process_work_item_action`, `get_process_work_projection`, `get_process_work_item_detail`, `get_unified_process_work_projection`, `commit_internal_transfer`, `acknowledge_document_process_work_item_internal`, `get_document_acknowledgement_document_internal`.
- **Conditional replacement (1):** `wvp_case_access(public.absence_cases, boolean)` only when the WVP object exists.
- **Impact:** 22 function definitions total; no table, index, policy, trigger, permission, process-definition or business-data changes. The transaction reasserts existing authenticated execute grants for read helpers and revokes end-user execute on the private kernel; it adds no broader user grant. Function replacement preserves existing append-only event/candidate/audit history.
- **Recovery:** the migration is transactional; failure before commit rolls back. It contains no top-level data DML. After a successful commit, recovery is forward-only with a corrective migration. No separate backup or PITR action was taken or verified.

## Local verification and open gates

- PGlite PostgreSQL contract: **2 tests PASS**. Direct/department Manager, outside-team candidate, own/foreign Employee, valid/wrong HR Admin administration grants, unscoped viewer and private helper execute boundary are covered. The tests execute the SQL authorization helpers against synthetic rows and statically verify resolver filtering and adapter write ordering.
- Targeted changed-file ESLint: PASS.
- HR Suite TypeScript (`npm run type-check`): PASS.
- Full application workflow, actual authenticated Core RPC, concurrency/idempotency under database contention, and audit/RLS/grant readback after migration: OPEN until the separately authorized TEST gate. No positive workflow action was executed.
- Historical decision report named “PMUX autorisatiemodel — technisch beslisdocument” was not present in the repository file search; this run records the current read-only Core evidence and resulting decision without rewriting historical reports.

## Required regressions at the TEST gate

Test positive direct and department Managers; same-administration Managers outside team; valid and missing HR Admin scope; own and foreign Employees; known work-item IDs through direct `claim`, `perform` and `request_process_work_item_changes` RPCs; stale candidate revisions; revoked/expired relation and permissions; Leave APPROVE, REQUEST_CHANGES and CANCEL with unchanged domain state on denial; P9 commit/REQUEST_CHANGES; P10 own acknowledgement/document read and foreign/Admin denial; WVP case read/write; idempotent replay, concurrent claims/actions, audit preservation; and positive control of each previously authorized workflow. Use an existing approved synthetic work item or obtain a separate explicit data-mutation approval for test fixtures.
