# CONTROL02 cancellation and read-only decommission inventory

Date: 2026-10-10

## Decision and code scope

CONTROL02 and the official Loonaangifte XML import are cancelled. No new
CONTROL02 development, repair migration, E2E acceptance, database mutation,
merge, or deployment is part of this closeout. PRs #4, #6, and #9 remain
closed and unmerged.

The cleanup candidate removes the `/imports/loonaangifte` page route and
renames the retained synthetic importer to
`/imports/interne-representatieve-fixture`. Its source contract is
`INTERNAL_REPRESENTATIVE` only. Analyze and stage reject XML at request
validation; recovery excludes historic XML batches; finalization checks the
stored batch source before claiming it or writing Core records. No current
`main` API route calls the CONTROL02 planner/writer functions.

CONTROL01 staging, the internal representative import service, shared
payroll-import API routes, Core HR/Payroll, Nmbrs, and APIAI are retained.
The Payroll Lab source-gap reason was generalized to
`INCOME_RELATIONSHIP_SOURCE_UNSUPPORTED`; its unsupported behavior is
unchanged. A historical migration comment remains historical and was not
rewritten.

## Code inventory

- CONTROL02/official-import-specific on the prior `origin/main`: the
  `/imports/loonaangifte` page name and its XML source option, plus the
  `LOONAANGIFTE_XML` request-schema path and fail-closed XML adapter stub.
  The cleanup removes those entry points. The previous XML stub returned
  `REAL_XML_PENDING`; this repository snapshot had no active CONTROL02
  planner/decision API route.
- Shared code already on `main` and retained: payroll-import analyze, stage,
  and finalize routes; import service/database contracts; employee matching;
  Employee/Employment/IncomeRelationship Core services; and the shared
  `match_payroll_import_employee_bsn_fingerprint` RPC. These are used by the
  internal representative importer and CONTROL01, so the route contract now
  allows only `INTERNAL_REPRESENTATIVE` while legacy row typing remains for
  readback. The finalizer rejects a stored XML source before processing.
- Cross-feature code: Payroll Lab's IncomeRelationship source adapter is
  shared outside CONTROL02. Its unsupported result is unchanged; only its
  generic reason code was renamed. Nmbrs, CONTROL01, and APIAI implementation
  files were not removed or refactored.

## TEST database identity and migration history

- Supabase project: `wnpfloqpjvaacobppbpk` (LiquidHR), `ACTIVE_HEALTHY`,
  PostgreSQL 17.6.1.141, eu-west-3.
- All database checks in this round were read-only. No migration, SQL
  mutation, migration-history edit, or record cleanup was performed.
- TEST has 16 registered CONTROL02 migrations, ending with
  `20261008165059 control02_test_final_writer_runtime_guards`. The unapproved
  `20261009063000` candidate is not registered.
- CONTROL01 payroll staging and grants migrations remain applied:
  `20260928095904 control01_payroll_import_staging` and
  `20260928100207 control01_payroll_import_grants_hardening`. Other CONTROL01
  migration history and shared Employee/Employment/Payroll schema are retained.

## CONTROL02-specific TEST objects

All seven listed tables have RLS enabled. Current total row counts:

| Object | Rows | Notes |
| --- | ---: | --- |
| `payroll_import_decisions` | 6 | Confirmed source decisions |
| `payroll_import_finalization_plans` | 7 | Plans |
| `payroll_import_finalization_plan_events` | 4 | Plan history |
| `payroll_import_finalization_actions` | 22 | Action ledger |
| `payroll_import_finalization_action_events` | 51 | Append-only action history |
| `payroll_import_xml_provenance` | 4 | One provenance row per XML batch |
| `payroll_import_protected_identifiers` | 2 | Protected identifier rows; values not read |

The four CONTROL02 SECURITY DEFINER functions currently have EXECUTE for
`postgres` and `service_role` only:

- `control02_test_finalization_schema_ready()`
- `execute_control02_test_payroll_finalization_action(uuid,uuid,uuid,text,uuid,uuid,text,jsonb,text)`
- `invalidate_payroll_import_finalization_plan(uuid,uuid,uuid,text,uuid,text)`
- `record_payroll_import_finalization_event(uuid,uuid,uuid,text,text,text,uuid,integer,text,text,text,jsonb,text,timestamp with time zone,uuid,text)`

Their owner is `postgres`. The catalog also contains seven table policies and
ten CONTROL02 table triggers, including append-only and scope-validation
guards. These policies, triggers, constraints, indexes, grants, and foreign
keys must be included in any later decommission migration; do not use
`CASCADE`.

Preserve shared import/Core objects: `payroll_import_batches` (9 total rows),
`payroll_import_persons` (19), `payroll_import_income_relationships` (24),
Employee/Employment/IncomeRelationship/link tables, and the shared
`match_payroll_import_employee_bsn_fingerprint` RPC overloads. CONTROL01 and
the internal representative importer use this shared foundation.

## Synthetic XML batches and linked Core records

All four XML batches remain `STAGED`. Counts below are read-only and include
no names, BSNs, addresses, or secret values.

| Batch | Persons | Staged IKVs | Decisions | Plans | Actions | Action events | Provenance | Protected IDs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `341e54a4-c7eb-48c0-8c03-19ae24414125` | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 1 |
| `5e83061b-ee6c-48c7-8d64-e7c73a7e8eae` | 1 | 1 | 1 | 1 | 3 | 3 | 1 | 1 |
| `71f4f831-5450-4a2e-9678-7e4a571b1aff` | 1 | 1 | 1 | 1 | 3 | 7 | 1 | 0 |
| `ca8d6435-d953-44f3-ba68-77ec8d9e6d7c` | 2 | 3 | 4 | 5 | 16 | 41 | 1 | 0 |

The last batch has 2 COMPLETED, 1 FAILED, 7 BLOCKED, and 6 PENDING actions.
The `5e83061b` batch has 3 BLOCKED actions. The `71f4f831` batch has 1
COMPLETED, 1 FAILED, and 1 PENDING action.

One Core Employee is attributable through the XML import-person link:

- Employee `100023`, id `5762d5a3-1289-4ded-a6ba-8f23065ee626`.
- Employment `1`, id `c6aa752b-3a77-4a24-9197-58c607a7588a`, status
  `DRAFT`, starts `2026-01-01`; it references import person
  `0348a627-8257-4882-9bd2-891f5a5c1f75` from batch
  `ca8d6435-d953-44f3-ba68-77ec8d9e6d7c`.
- That Employee has one administration assignment, zero IncomeRelationship
  rows, and zero Employment-to-IncomeRelationship links.
- No other XML import-person row is linked to a Core Employee or Employment.
  The batch person's `matched_employee_id` is null; the draft Employment is
  linked by `payroll_import_person_id`.

Do not remove Employee `100023`, Employment `1`, or source/ledger history in
the code cleanup. Any future Core-record cleanup needs its own dependency
readback and a separate exact approval.

## Proposed later decommission sequence

This is a proposal only; every step below requires a separate approval before
remote execution.

1. Keep the 16 migration-history records. Retire the four CONTROL02 RPC
   functions and their EXECUTE grants with a forward migration after checking
   all live callers again.
2. If historical ledger retention is not required, archive an approved
   read-only export, then remove the seven CONTROL02-only tables and their
   exact policies, triggers, indexes, constraints, grants, and foreign keys.
   Preserve their current row counts above until that approval.
3. If XML source-record cleanup is separately approved, target exactly the
   four batches and their 5 persons, 6 staged IKVs, 6 decisions, 4 provenance
   rows, and 2 protected-identifier rows. Include the 7 plans, 4 plan events,
   22 actions, and 51 action events in the reviewed deletion dependency graph.
   Do not alter the other 5 shared payroll-import batches or their records.
4. Treat Employee `100023` and Employment `1` as a separate Core decision:
   first re-read their full dependent references, then obtain approval naming
   those exact records before considering any Core cleanup.

No database object or TEST record has been dropped, truncated, deleted, or
rewritten in this closeout.

## Git and worktree inventory

- Local root checkout: `main` at `cb73260ff0cd83d19fa29e44c9f0b93749fb10af`;
  current `origin/main` at `783999044de83c902e63fefb3587fdbbf99d4de3`.
- Root main already had dirty paths `docs/delivery/CURRENT_CONTEXT.md`,
  `.tmp-control02-vitest/`, `[f.action`, and `docs/quality/security/`.
  They were not touched.
- Remote CONTROL02 heads inventoried:
  `codex/control02-closeout-20261008`,
  `docs/control02-planning-20261003`,
  `work/CONTROL02-FINAL-20261004`, and
  `work/CONTROL02-XML-V1-20261003`. The planning branch contained only two
  CONTROL02 planning documents, had no associated PR, was archived at
  `refs/archive/control02/docs-control02-planning-20261003`, and was deleted
  from origin. No PR was reopened or merged.
- Local CONTROL02-related branches also include
  `backup/control02-final-debug-20261008`,
  `integration/control02-final-20261007`,
  `work/CONTROL02-MEGA-20261006`,
  `work/CONTROL02-FINAL-20261004`,
  `work/CONTROL02-XML-V1-20261003`, and
  `work/control02-acceptance-20261004`.
- The integration branch includes shared APIAI code and is not eligible for
  deletion. The existing backup branch is retained as an archive.
- Local commit tips were preserved under `refs/archive/control02/`, including
  the clean acceptance, closeout, final-build, mega, XML-V1, and detached
  acceptance snapshots. The clean unmanaged
  `CONTROL02-ACCEPT-20261004` checkout was removed and its local branch
  deleted after preserving tip `48f2b0ec7321fb9a7723aa37cf592eb2e5b67880`.
- Other clean checkouts reported as managed/owned by other Codex tasks and
  were left in place: `control02-closeout-20261008`, `control02-final-build`,
  `control02-mega-20261006`, and `control02-xml-v1`. Their exact commits are
  archived locally. The remote FINAL and XML-V1 branches contain CONTROL01
  role-permission migrations and shared import changes, so they remain on
  origin. No other development branch was changed.
- `control02-final-20261007` has an in-progress merge, more than 100 dirty
  paths, and an ignored local `.env.local`; it is preserved.
  `control02-pr9-acceptance` has uncommitted CONTROL02 files/fixtures and an
  ignored `.env.local`; it is preserved. The detached acceptance worktree
  has an existing `next-env.d.ts` modification and is preserved. Root `main`
  dirty paths and its protected canonical `.env.local` were not modified.

## Verification

- Targeted payroll/API source-gate regressions: 41 tests passed across 6
  files. Full HR suite with `--maxWorkers=2`: 566 files passed, 4 skipped;
  2,533 tests passed, 8 skipped. Control package tests passed.
- Strict TypeScript passed for HR Suite and Control. `check:i18n` passed with
  41 matching NL/EN namespaces. Root lint exited 0 with 7 warnings; one is in
  an unrelated Payroll Lab test and six are existing unused test helpers in
  `payroll-import/service.test.ts`.
- Production builds passed for HR Suite and Control. The Next route manifest
  contains `/imports/interne-representatieve-fixture` and omits
  `/imports/loonaangifte`; the Payroll browser-boundary scan passed for 153
  assets. API contract tests reject XML before service calls, and finalizer
  regression proves historical XML batches are rejected before writes.
- `git diff --check` and i18n passed. `npm ci` reported 13 dependency audit
  advisories (2 moderate, 11 high); dependencies were not auto-updated.
- Remote state checked read-only on TEST project
  `wnpfloqpjvaacobppbpk`; no Production/Preview database, database mutation,
  migration apply, deployment, merge, or TEST-record cleanup occurred.

## Cleanup PR handoff

- Implementation commit: `6d6a3dcbd1566a9853a8836aed7baff46d4bf522`.
- Draft PR #12: https://github.com/EdwinCycling/LiquidHR/pull/12, base
  `main`, head `codex/control02-stop-cleanup-20261010`.
- The PR is a review candidate only. It is not merged or deployed; PRs #4,
  #6, and #9 remain closed and unmerged.
