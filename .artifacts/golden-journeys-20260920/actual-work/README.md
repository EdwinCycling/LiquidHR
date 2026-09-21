# GJ03 — Actual Work / Hours

Date: 2026-09-21
Environment: LiquidHR DEV project `wnpfloqpjvaacobppbpk`
Tenant/group: De Sterren / Planeten
Persona: Employee Noah Hendriks, `c6b1c7a9-c250-3d19-b1a0-87e317e80b13`
Employment: `eb1eea55-62c4-4b85-a3e9-20dca923e7d4`

## Contract correction

The previous 403 for Employee Actual Work self-write was a product gap. The
accepted contract is now implemented through the existing Actual Work domain:

- the global Employee role has the separate canonical permission
  `self:actual-work:write`;
- Focus → Uren uses the existing `/api/actual-work/entries` route,
  `saveActualWorkEntry` service and `save_actual_work_entry` RPC;
- the Employee can create and correct only records for the authenticated
  employee and employment;
- Manager/HR projection scope is unchanged;
- colleague/private reads and writes remain denied;
- Leave overlap, type validity, future-entry, period, employment and existing
  schedule/part-time eligibility checks remain server-side.

No parallel Focus backend and no service-role browser flow were introduced.

## DEV schema/configuration evidence

The bounded DEV migration was applied only to project
`wnpfloqpjvaacobppbpk`:

- local file: `apps/hr-suite/supabase/migrations/20260921100000_actual_work_employee_self_service.sql`;
- remote migration name: `actual_work_employee_self_service`;
- remote history version: `20260921092305`;
- global `EMPLOYEE` role readback contains `self:actual-work:write`;
- `employment_work_hour_entries` RLS allows own Employee insert/update but
  retains HR-only delete;
- `actual_work_revisions` allows own read/insert with the self permission;
- the RPC is `SECURITY INVOKER` and executable by `authenticated`.

The RPC keeps the existing hours precision, entry granularity, employment
date, type, future, period, limit and schedule checks. It additionally rejects
an approved Leave overlap with `ACTUAL_WORK_LEAVE_OVERLAP`. The current DEV
model has no partial-leave remaining-capacity calculation, so an approved
overlapping day is conservatively rejected.

Supabase type generation completed. Security/performance advisors were also
run; their output is project-wide and contains existing findings (including
RLS-without-policy informational findings, SECURITY DEFINER execute warnings,
foreign-key/index findings and multiple-permissive-policy warnings). These
were not broadened or silently treated as GJ03-specific failures.

## Authenticated Employee acceptance

The first authenticated browser run used Focus → Uren and performed the
business flow:

1. create one controlled own entry on 2026-09-21 for `1.7500` WORK hours;
2. edit that same entry once to `2.0000`, with correction reason
   `GJ03 Employee correctie`;
3. reload Focus and read the canonical API projection back.

The persisted Employee-owned row is:

| Field | Value |
| --- | --- |
| Entry | `5b1746a2-16df-4b09-bb1a-40e573c7b386` |
| Final status | `APPROVED` |
| Final hours | `2.0000` |
| Work type | `AW_WORK` / WORK |
| Date | `2026-09-21` |
| Actor | Employee fixture `f38fe229-494e-4294-822d-90c19188232f` |
| Revisions | CREATE `1.7500`; CORRECTION `2.0000`, delta `0.2500` |

DEV readback contains exactly one Employee-owned controlled row and two
revisions for it. One earlier HR baseline row remains from the pre-correction
debug attempt:

| Entry | Hours | Actor | Interpretation |
| --- | ---: | --- | --- |
| `80fdc675-6213-44ea-9941-ee18612ce398` | `2.2500` | HR fixture | Pre-contract baseline; retained, not deleted/voided |
| `5b1746a2-16df-4b09-bb1a-40e573c7b386` | `2.0000` | Employee fixture | The single controlled Employee create, corrected once |

The rerun after the browser harness probe was read-only and confirmed the
same persisted state; it did not create a second Employee row.

## Persona and server-side negative checks

The authenticated Employee projection returned HTTP 200 with five active
Actual Work types, the own rows, revision history, the open September period
and the effective 40-hour Monday-Friday schedule.

| Probe | Result |
| --- | --- |
| Employee reads own projection | 200; canonical rows and revisions returned |
| Employee reads Yara/foreign projection | 403 |
| Employee writes Yara/foreign employment | denied before persistence; 404 employment-scope response |
| Employee reads Team | 403 |
| Employee reads Insights | 403 |
| Manager tries Employee mutation path | 403 |
| Manager reads Noah entry | 403 |
| Manager reads Actual Work Team API | 403 |
| Manager opens `/actual-work/team` | `/geen-toegang` |
| Closed 2026-08 period | 400 `ACTUAL_WORK_PERIOD_CLOSED` |
| Future 2026-09-30 WORK entry | 400 `ACTUAL_WORK_FUTURE_NOT_ALLOWED` |
| Inactive/unknown work type | 400 `ACTUAL_WORK_TYPE_NOT_ACTIVE` |
| Approved Leave overlap on 2026-09-18 | 400 `ACTUAL_WORK_LEAVE_OVERLAP` |

After all probes the canonical readback still contained the same two Noah
rows and the same Employee CREATE/CORRECTION revision pair.

## HR and downstream projections

HR authenticated reads returned both Noah rows in the existing employee-hours
workbench. The existing Actual Work Team projection returned both Noah rows;
Insights returned the correction and the group totals. Leave balance and
accrual-preview reads completed through the existing HR endpoints.

Manager Focus Team remained the existing team surface and displayed no Actual
Work hours. The detailed Actual Work Manager route/API remained denied.

## Browser evidence

- `employee-flow.json`: authenticated Focus create/correction readback,
  own/foreign/team/insights probes and desktop/mobile layout evidence;
- `hr-downstream-flow.json`: HR projection, Team/Insights, Leave reads,
  validation probes, Employee privacy recheck and Manager negative checks;
- `employee-focus-hours-after-self-edit-1440x1000.png` and
  `employee-focus-hours-after-self-edit-390x844.png`;
- `hr-noah-hours-after-employee-self-service-1440x1000.png` and
  `hr-noah-hours-after-employee-self-service-390x844.png`;
- `manager-actual-work-denied-after-employee-self-service-1440x1000.png` and
  `manager-focus-team-after-employee-self-service-390x844.png`.

Desktop 1440px and mobile 390px checks reported no horizontal overflow for
Employee Focus and HR employee-hours surfaces. Manager Focus Team also had no
horizontal overflow; it showed no Actual Work hours.

## Local quality gate

- focused GJ03 tests: 4 files, 17/17 tests;
- full `npm test -- --testTimeout=30000`: 437/437 files, 1714/1714 tests;
- strict TypeScript: green;
- ESLint: green;
- i18n: 39 equal NL/EN namespaces;
- `npm run build`: 296/296 static pages generated;
- `git diff --check`: run before commit.

## Verdict

**GJ03 GREEN — Employee self-service Actual Work create/correction and
downstream/privacy/validation gates complete in DEV.**

## Final closure confirmation

The DEV migration metadata was reconciled without rerunning migration SQL:
the single `actual_work_employee_self_service` history row now has canonical
version `20260921100000`; the former `20260921092305` identity is absent.
Relevant schema objects and data were read back unchanged. Before and after
readback both contained 16 DEV entries and 23 revisions with unchanged
fingerprints. A repository metadata-identity regression guard was added and
the targeted GJ03 plus full Vitest suites remain green.
