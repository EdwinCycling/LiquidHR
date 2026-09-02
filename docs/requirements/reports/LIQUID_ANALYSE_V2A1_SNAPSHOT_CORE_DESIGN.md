# Liquid Analyse V2A-1 Snapshot Core — implementation design

**Status:** DESIGN APPROVED CANDIDATE — READY FOR V2A-1 IMPLEMENTATION REVIEW
**Datum:** 2026-09-02
**Mode:** implementation design / repository discovery / documentation only
**Product scope:** V2A-1 Snapshot Core, canonical questions Q1, Q2, Q3, Q4 en Q7
**Approved Foundation:** `ec66f981c9bc732b4445c76ea3d1d363b1ad567d`
**Design branch:** `work/v2a1-snapshot-core-design`

Dit document is de enige autoritatieve technische ontwerpnotitie voor de
volgende V2A-1 implementation review. Het wijzigt de Foundation niet en is
geen bewijs dat V2A-1 al is gebouwd.

## 1. Doel, grens en uitgangspunten

V2A-1 levert één gecontroleerde snapshot-pipeline voor workforce analytics:

```text
strict AnalysisSpec V2
        |
        v
semantic registry + server authorization
        |
        v
complete authorized snapshot population at asOf
        |
        v
active qualification + effective dimension resolution
        |
        v
typed filters + 0..2 dimension grouping
        |
        v
optional second snapshot + aligned delta/delta_pct
        |
        v
sanitized AnalysisResult V2 -> existing Canvas/table fallback
```

De volgende productbesluiten zijn al gesloten en worden hier niet opnieuw
besproken of heropend:

- V2 `headcount` telt distinct employees die op de expliciete `asOf` als
  `ACTIVE_EMPLOYEE` kwalificeren binnen de server-authorized population.
  Parallelle qualifying Employments tellen eenmaal.
- Former, future en never-employed employees vallen standaard buiten V2.
  V2A-1 voegt geen event-, tenure-, FTE-, absence- of compensationsemantiek
  toe.
- `department`, `job` en `employment_type` krijgen de waarde die op de
  gevraagde snapshotdatum effectief is. Een huidige waarde wordt niet terug
  geprojecteerd.
- `employment_type` is de primaire workforce-mixdimensie. Het is niet een
  alias voor `contract_type` of `duration_type`.
- Snapshot comparison gebruikt twee expliciete snapshotdatums. De signed
  delta is current minus comparison; `delta_pct` is `null` bij een nulnoemer.
- Manager historical scope wordt expliciet bewezen. Er is geen HR-group
  fallback wanneer die scope niet veilig kan worden vastgesteld.
- Gewone V2A-1 headcount heeft geen universele `k=5` suppression.
- V1-definities en V1-uitvoering blijven version 1 en houden hun bestaande
  semantiek. Er is geen silent upgrade.
- Geen employee rows, employee IDs, result snapshots, vrije SQL of queryplan
  komt over de browser-, saved-definition- of resultgrens.

### Niet in deze slice

Q5/Q6 workforce events, Q8/Q9 tenure/capacity, FTE, scheduled hours,
employment events, transfers, planned changes, absence, location,
demographics, compensation, AN-7 Explain, AN-8 conversation, nieuwe chart
library, donut, matrix/crosstab, AI, export, scheduling, sharing en widgets
blijven buiten V2A-1. Een future seam mag worden genoemd, maar wordt niet
ontworpen als volledige latere capability.

## 2. Baseline en repository-evidence

### Baseline

De preflight van de design-worktree bevestigde:

| Item | Waarde | Betekenis |
|---|---|---|
| `origin/main` | `155ccbde373a06684e37d9746b01dd65931c870b` | actuele centrale test-baseline |
| Foundation local branch | `ec66f981c9bc732b4445c76ea3d1d363b1ad567d` | goedgekeurde bron |
| Foundation remote branch | `ec66f981c9bc732b4445c76ea3d1d363b1ad567d` | remote/local gelijk |
| visible app version | `1.20260901.1` | geen versie-eis voor design |
| design worktree HEAD | `ec66f981c9bc732b4445c76ea3d1d363b1ad567d` | geïsoleerd vanaf Foundation |
| canonical env | `apps/hr-suite/.env.local` bestaat | beschermd; niet gelezen of gemuteerd |

De design-worktree is `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\v2a1-snapshot-core-design`.
De goedgekeurde Foundation-worktree en de dirty root zijn niet gebruikt voor
wijzigingen.

### Governing documents

De inhoudelijke productgrens komt uit:

- `docs/requirements/reports/LIQUID_ANALYSE_V2_FOUNDATION.md` — gesloten
  productreview, V2-contractrichting, V2A-1 boundary en open engineering
  questions.
- `docs/requirements/reports/LIQUID_ANALYSE_AN6_CONTEXTUAL_DRILL_COMPARE.md`
  — bestaande V1 drill/compare/contextstack- en aggregate-only patronen.
- `docs/README.md`, `docs/delivery/CURRENT_CONTEXT.md` en
  `CODING_STANDARDS.md` — documentatie-index, delivery-context en dagelijkse
  technische regels.

### Current implementation evidence

| Seam | Huidige implementatie | Relevantie voor V2A-1 |
|---|---|---|
| V1 spec | `apps/hr-suite/lib/insights/analysis-spec.ts` | strict V1 shape: 1 measure, max 1 dimension, max 20 filters |
| V1 registry | `apps/hr-suite/lib/insights/analysis-semantic-layer.ts` | current workforce allowlist; geen V2 fields toevoegen zonder versioning |
| V1 engine | `apps/hr-suite/lib/insights/analysis-engine.ts` | authorization vóór retrieval, deduplicatie, current dimensions, V1 result |
| V1 result | `apps/hr-suite/lib/insights/analysis-result.ts` | KPI/table shape; geen period/comparison/history metadata |
| V1 errors | `apps/hr-suite/lib/insights/analysis-errors.ts` | typed HTTP error mapping; uitbreiden met snapshot/data-quality codes |
| V1 drill | `analysis-drill.ts`, `analysis-drill-runtime.ts` | bestaande contextstack; versie behouden, V2-adapter later hetzelfde patroon |
| V1 value compare | `analysis-comparison.ts` | AN-6 exact-two-value comparison; niet verwarren met V2 period comparison |
| V1 route | `app/api/insights/analysis/route.ts` | blijft endpoint; version dispatch bepaalt V1 versus V2 |
| V1 UI | `components/insights/analysis-explore.tsx`, `analysis-exploration.tsx`, `liquid-canvas.tsx` | hergebruik table/fallback; geen volledige Explore V2 in deze slice |
| V1 saved | `saved-analysis-definition.ts`, `saved-analysis-service.ts`, `saved-analysis-runtime.ts` | scoped definition-only storage; openen voert opnieuw uit |
| auth context | `lib/auth/permissions.ts` | tenant, HR-group, user, roles en permissions uit server context |
| Manager scope | `lib/organization/team-scope.ts` | current direct reports, current date en `limit(500)`; niet geschikt voor history |
| overview retrieval | `lib/employment/employee-overview.ts`, `employment-service.ts` | current/list projection, archive semantics en bestaande overviewgrens; niet als V2 snapshotbron gebruiken |
| overview RPC | latest local SQL in `supabase/migrations/20260805203000_hr_group_people_rpc_alignment.sql` | group boundary/authorization pattern; returns overview-shaped records, niet V2 effective data |
| employment source | `supabase/migrations/20260715071156_add_employment_core.sql` | confirmed/deleted/date range/type, employee-level workforce source |
| placement source | `employee_organizations` in organization/timeline migrations | effective department/job/manager placement, per employment where available |
| saved schema | `supabase/migrations/20260830143757_saved_analysis_definitions.sql` | JSONB physically flexible but DB validator/version constraint is V1-only |

## 3. Current architecture and identified gaps

### V1 request path

The current route parses JSON, calls `validateAnalysisSpec`, executes the V1
engine and maps `AnalysisEngineError` to a stable response. The V1 engine:

1. checks `dashboard:read` and employee data permission;
2. requires an HR-group context;
3. retrieves `list_employee_overviews` data;
4. checks tenant/HR-group scope again;
5. deduplicates by employee ID;
6. applies current-value filters and groups by at most one dimension; and
7. returns only aggregate rows and KPI/table hints.

This is a good security and result boundary, but not a snapshot engine:

- the current overview projection derives status using `today`;
- department/job are projected from the current/effective overview placement;
- `employment_type` is added by a current overview enrichment;
- V1 result has no `period`, `comparison`, two-dimensional key or delta;
- current Manager IDs use `listDirectTeamEmployeeIds`, which is today-bound;
- overview and related reads contain fixed collection limits in the existing
  surface, including the known 500-row boundary;
- current RLS/security helpers such as `can_manage_employee` are primarily
  current-date authorization helpers and must not silently authorize a past
  population.

### Design rule: one engine, versioned adapters

V2A-1 does not introduce a second public analytics engine. The implementation
must evolve the current analysis pipeline into a version-dispatching engine:

```text
route -> parse/validate by spec.version
      -> shared authorization/context boundary
      -> V1 current adapter OR V2 snapshot adapter
      -> versioned result renderer
```

V1 helper functions remain callable by V1 tests and saved V1 definitions.
V2-specific types/resolvers may be separate modules to keep the contracts
readable, but they are invoked by the same public route and saved runtime.

## 4. AnalysisSpec V2 contract

### Canonical serialized shape

The implementation should use this strict shape for V2A-1:

```json
{
  "version": 2,
  "source": "workforce",
  "entity": "employees",
  "measures": ["headcount"],
  "dimensions": ["department", "employment_type"],
  "filters": [
    {
      "dimension": "employment_status",
      "operator": "eq",
      "value": "ACTIVE_EMPLOYEE"
    }
  ],
  "period": {
    "kind": "snapshot",
    "asOf": "2026-09-01"
  },
  "comparison": {
    "kind": "explicit_period",
    "period": {
      "kind": "snapshot",
      "asOf": "2026-08-01"
    }
  },
  "sort": {
    "by": "measure",
    "measure": "headcount",
    "direction": "desc"
  },
  "limit": 25,
  "presentation": {
    "intent": "auto"
  }
}
```

The non-comparison form uses `"comparison": null`. Exact serialization rules:

- `version` is exactly `2`.
- `source` is exactly `workforce`; `entity` is exactly `employees`.
- `measures` is a non-empty tuple with a contract maximum of three. V2A-1
  registry capability is currently exactly `['headcount']`; unsupported
  future measures are rejected, not ignored.
- `dimensions` has zero, one or two unique allowlisted values. V2A-1 output
  dimensions are `department`, `job` and `employment_type`.
- `filters` has at most eight entries. Each entry has exactly
  `dimension`, `operator` and `value`. There is at most one filter per
  dimension. Filters are AND-combined; `in` values are OR-combined within
  their dimension.
- `period` is a snapshot object with a valid exact ISO date-only `asOf`.
  Date-only means `YYYY-MM-DD`; timestamps, timezone suffixes, expressions and
  relative presets are rejected at the API boundary.
- `comparison` is `null` or an `explicit_period` with another snapshot date.
  `previous_equal_period` is not valid for V2A-1 because it belongs to future
  event periods.
- `sort` is `null`, a label sort, or a selected-measure sort. The selected
  measure must be one of `measures`; V2A-1 therefore only allows
  `headcount`.
- `limit` is an integer in the existing bounded range `1..100` unless a
  separately approved V2 limit is chosen before implementation.
- `presentation` is an object with `intent` in `auto`, `kpi`, `table` or
  `comparison`. It is intent, not a permission or a query instruction.
- unknown fields are rejected recursively. No tenant, HR-group, user,
  employee, SQL, table, column, raw row or result fields are accepted.

### Typed filter values

V2 filters use semantic values rather than arbitrary database expressions:

| Dimension | Value kind | V2A-1 input | Resolution |
|---|---|---|---|
| `employment_status` | enum | `ACTIVE_EMPLOYEE` only in this slice | fixed invariant; non-active expansion is a later contract |
| `department` | authorized reference key | opaque department semantic key | match against the authorized snapshot option set; label is server-resolved |
| `job` | authorized reference key | opaque job semantic key | match against the authorized snapshot option set; label is server-resolved |
| `employment_type` | enum | `EMPLOYEE`, `INTERN`, `APPRENTICE`, `CONTRACTOR` | exact enum allowlist from the canonical employment source |

The registry may publish the complete employment-status enum for typed
compatibility, but V2A-1's default population and headcount invariant remain
active-only. A request for former/future/never status is rejected as outside
the V2A-1 capability, rather than returning a misleading zero-result analysis.
If the implementation review instead explicitly approves non-active status
filters, that must be a new versioned semantic rule with separate tests; it
cannot be inferred from V1.

For reference dimensions, an ID or semantic key is not an authorization grant.
The server resolves it only after authorization and complete population
retrieval. A key not present in the authorized option set receives a stable
invalid/not-authorized error without revealing whether it exists in another
tenant, HR group or Manager scope.

### Strict validation and dispatch

Recommended module split:

- keep the current V1 parser behavior intact in
  `lib/insights/analysis-spec.ts` or expose it as an explicit V1 parser;
- add `lib/insights/analysis-spec-v2.ts` for V2 Zod/raw parsing, normalized
  types and cross-field validation;
- add a small version dispatcher (in `analysis-spec.ts` or a new
  `analysis-spec-dispatch.ts`) that reads only the untrusted `version` tag and
  calls the correct strict parser;
- expose a discriminated union to the engine and saved runtime.

Validation order:

1. reject non-object, arrays, missing version or unknown top-level fields;
2. dispatch only on integer version `1` or `2`;
3. run the version-specific structural parser;
4. resolve the semantic entity/measure/dimension/filter registry;
5. apply cross-field rules and normalize immutable arrays/values;
6. freeze the returned validated object (or use immutable types); and
7. only then enter authorization/retrieval.

Validation errors should remain typed and stable. Suggested additions are:

| Code | HTTP | Use |
|---|---:|---|
| `ANALYSIS_UNSUPPORTED_SPEC_VERSION` | 400 | version is not 1 or 2 |
| `ANALYSIS_V2_PERIOD_INVALID` | 400 | malformed/non-snapshot period |
| `ANALYSIS_V2_COMPARISON_INVALID` | 400 | wrong comparison kind, same date or malformed second period |
| `ANALYSIS_V2_DIMENSION_LIMIT` | 400 | more than two dimensions |
| `ANALYSIS_V2_FILTER_LIMIT` | 400 | more than eight filters or duplicate dimension filter |
| `ANALYSIS_V2_PRESENTATION_INVALID` | 400 | incompatible presentation intent |
| `ANALYSIS_INVALID_FILTER_VALUE` | 400 | malformed or unsupported typed value |
| `ANALYSIS_V2_FILTER_VALUE_NOT_AUTHORIZED` | 400 | value is not in the authorized semantic option set |

Existing V1 callers must continue receiving the existing V1 error behavior.
The V2 parser must not accept V1 `presentation: 'table'` or treat absent V2
period fields as “today”.

## 5. Versioned semantic registry

The semantic registry remains the only allowlist. It must describe capability,
not SQL, table names or joins. The existing V1 registry test explicitly
ensures that query text does not appear; that invariant remains for V2.

Recommended registry entry for V2A-1:

```text
version: 2
source: workforce
entity: employees
permissions: employee:read | employee-directory:read
scope: HR_GROUP or proven historical DIRECT_REPORTS
measures: headcount(count_distinct employee)
dimensions: department, job, employment_type
filters: employment_status, department, job, employment_type
periods: snapshot
comparisons: explicit_period(snapshot)
presentations: auto, kpi, table, comparison
unknownPolicy: explicit bucket for dimensions that declare it
```

The single registry should be version-aware. It may preserve V1 convenience
exports such as `ANALYSIS_DIMENSIONS` for old UI/tests, but V2 lookups must
always pass a version and receive the corresponding entry. No V1 dimension
allowlist may accidentally make `employment_type` executable in V1, and no
V2 dimension may be executable without its V2 resolver metadata.

Each V2 dimension entry needs these semantic properties:

- stable semantic key and display label strategy;
- value kind (`enum`, `reference` or `derived-status`);
- allowed operators (`eq`, `in`);
- whether it can be output, filtered or both;
- unknown policy (`include` for a declared dimension, otherwise fail);
- effective-date source class (`employment`, `placement` or derived); and
- comparison/group key normalization rules.

No registry field may describe a raw SQL fragment, selected database columns,
arbitrary relation names or client-supplied table identifiers.

## 6. Snapshot population resolver

### Source rows and internal boundary

The server-only retrieval adapter may use an internal typed row containing IDs
solely for authorization, deduplication and effective resolution. A proposed
internal shape is:

```text
SnapshotSourceRow {
  employeeKey: string                 // server-only, never result/browser
  employmentKey: string               // server-only
  isPrimary: boolean
  employmentType: EmploymentType
  startsOn: DateOnly
  endsOn: DateOnly | null
  placement: {
    departmentKey: string
    departmentLabel: string
    jobKey: string | null
    jobLabel: string | null
    directManagerKey: string | null
    effectiveFrom: DateOnly
    effectiveTo: DateOnly | null
  } | null
}
```

This is an internal service type, not `AnalysisResult V2`. It must not be
serializable from an API route. A test should assert that JSON.stringify of
the public result contains no employee/tenant keys.

### Qualifying employment

For each requested snapshot date `D`, an employment is eligible only when all
of these conditions hold:

```text
tenant_id = authorized tenant
hr_group_id = authorized HR group
deleted_at is null
record_status = CONFIRMED
starts_on <= D
and (ends_on is null or ends_on >= D)
```

The employee must also be non-deleted and belong to the same tenant and
HR-group authorization boundary. The end date is inclusive, matching the
existing `deriveEmploymentStatus` behavior and the employment date contract.

The default V2A-1 population is the distinct set of employees with at least
one qualifying employment. It does not use `employees.is_active`, archive
state, current overview status or a browser list as a proxy for historical
qualification.

### Parallel employments and one employee count

The resolver first retains all qualifying employments for internal resolution,
then emits one `SnapshotEmployee` per employee. It must never sum employment
rows as headcount.

Representative selection for dimensions is deterministic and does not invent
a value:

1. If exactly one qualifying employment is `is_primary = true`, use it as the
   representative for employment-level dimensions and its placement as the
   primary placement.
2. If no qualifying employment is primary, compare effective values across
   qualifying employments. A single identical value (including all-null) may
   be used.
3. If more than one primary employment exists, or parallel qualifying
   employments have conflicting effective values for a requested output/filter
   dimension, fail the execution with a typed ambiguity/data-quality error.
4. Never count the employee once in every conflicting group and never choose
   the first row returned by the database.

This means an employee can still be counted in an undimensioned headcount
when a non-requested dimension is ambiguous. If a requested dimension cannot
be assigned safely, the engine returns a typed `ANALYSIS_SNAPSHOT_DATA_INVALID`
condition rather than producing a misleading grouped result. The exact
policy—fail the whole request versus a typed excluded-row diagnostic—must be
kept consistent across all groups and approved in the implementation review;
the recommended V2A-1 default is fail closed for the requested dimension.

### Edge-case matrix

| Case | Resolver behavior |
|---|---|
| no employment | not in default V2A-1 population |
| future-only employment | not in population at D |
| former-only employment | not in population at D |
| active employment | included once |
| re-entry after a former period | included at dates inside the later confirmed period; no event classification |
| parallel active employments | one employee; primary/common-value rule above |
| cancelled employment | excluded |
| soft-deleted employment/employee | excluded |
| invalid date or impossible period | typed data-quality failure; no partial result |
| employee outside tenant/HR group | not retrieved; never inferred from client input |
| incomplete page/cursor | typed retrieval-incomplete failure; never silently truncated |

## 7. Historical/effective dimension resolution

### Effective-date predicate

For a placement attached to employment `E` and snapshot date `D`, the
authoritative candidate predicate is:

```text
tenant/hr_group match
employee_id = E.employee_id
employment_id = E.id
effective_from <= D
and (effective_to is null or effective_to >= D)
```

Select exactly one candidate by the database's effective-date integrity
contract. Ordering by `effective_from desc, id` is only a deterministic
diagnostic order; it must not be used to hide overlapping valid candidates.

Legacy employee-level placement rows with `employment_id is null` are not
silently projected onto parallel employments. They can be used only when the
employee has exactly one qualifying employment at D, no employment-specific
candidate exists and the implementation explicitly accepts the legacy
compatibility rule. Otherwise the dimension is unresolved/ambiguous.

### Dimension rules

| Dimension | Source at D | Key | Label | Missing/invalid behavior |
|---|---|---|---|---|
| `department` | effective `employee_organizations.department_id` | stable department semantic key | resolved department label | no placement may become Unknown only if the dimension policy includes it; missing reference label is typed invalid |
| `job` | effective `job_id`/historical `job_title` on placement | stable job semantic key | placement's effective job title; reference metadata may enrich | null job is Unknown when allowed; inconsistent key/title or ambiguous rows is typed invalid |
| `employment_type` | selected qualifying `employments.employment_type` | enum code | localized UI label from messages | null/unknown is impossible under current DB contract; invalid source is typed invalid |
| `employment_status` filter | resolver-derived status at D | fixed `ACTIVE_EMPLOYEE` in V2A-1 | not an output dimension in this slice | non-active expansion rejected |

The analytic truth for historical department is membership at D, not the
employee's current department. Department master-data labels are presentation
labels; the stable historical assignment key is what grouping/filtering uses.
The current schema does not provide effective-dated department-name revisions.
If historical label-as-of semantics are later required, that is a separate
master-data decision and is not fabricated in V2A-1.

### Unknown policy

Unknown is a declared aggregate bucket, not a bypass of authorization. For
dimensions whose registry says `unknownPolicy: include`, missing assignment or
null value maps to an internal null key and the result renderer displays the
localized `Unknown / Niet toegewezen` label. Unknown participates in sorting,
comparison alignment and limits; it is not exempt from any future privacy
policy.

The following are not silently mapped to Unknown:

- two valid effective placements at D;
- a placement from another tenant/HR group;
- a reference key whose label cannot be safely resolved;
- malformed dates, enum values or identity scope;
- an incomplete retrieval page.

Those cases produce a typed error and no result.

## 8. Filters and grouping

Filtering happens after the same snapshot resolver has produced the effective
employee projection and before grouping. This prevents a current department
filter from being applied to a historical population.

Execution order:

1. authorize context and scope;
2. retrieve a complete population for each required date;
3. resolve active qualification and one employee projection;
4. resolve/validate reference filter options against the authorized set;
5. apply all normalized filters with AND semantics;
6. construct one or two dimension keys;
7. count distinct employee keys per group; and
8. sort and limit the aggregate rows.

With no output dimension, the result has one summary count and one KPI/table
row. With one dimension, each distinct semantic key is one group. With two
dimensions, the key is an ordered tuple `(dimension[0], dimension[1])`; there
is no matrix/crosstab and no implicit subtotal.

Canonical grouping key:

```text
encode([dimensionKeyOrNull, dimensionKeyOrNull])
```

The encoder must distinguish null from an empty/string key, be independent of
localized labels, and be stable between current and comparison snapshots.
Labels are carried only as sanitized display values; no employee data is
needed to render a group.

Sort rules:

- label sort uses locale-aware labels with a stable semantic-key tie-breaker;
- measure sort uses `headcount` and then the canonical group key;
- null/Unknown sorts after known labels for ascending and remains deterministic
  for descending according to one documented comparator;
- comparison sorting uses the current-period headcount as the selected measure
  unless a future comparison-specific sort is approved; limit is applied only
  after aligned comparison groups are formed.

No raw row, employee ID, database key used only for authorization, or SQL
fragment is present in the grouped result.

## 9. Comparison, delta and delta_pct

V2 comparison is part of the V2 `AnalysisSpec`; the existing `/compare`
endpoint remains the V1/AN-6 exact-two-value comparison contract.

For a V2 request:

1. validate both exact snapshot dates;
2. authorize once and capture one immutable server-owned scope;
3. resolve/filter/group the current snapshot at `period.asOf`;
4. resolve/filter/group the comparison snapshot at
   `comparison.period.asOf` with the same semantic spec and scope;
5. union groups by canonical ordered dimension keys;
6. fill a missing side with zero;
7. calculate `delta = current - comparison`; and
8. calculate `delta_pct = delta / comparison * 100` when comparison is not
   zero, otherwise `null`.

The two population reads must use the same tenant, HR-group and proven Manager
scope. A Manager may not receive a current-period side from one scope and a
historical side from a broader scope. If either side cannot prove scope or
completeness, the whole comparison fails.

Left/right-only groups remain visible with a zero side. Unknown is a normal
group and aligns by the null key. There is no employee-level diff, join,
membership list or explanation of who entered/left.

`delta_pct` is a numeric percent-change value, not a percentage-point label.
For example, 8 versus 10 gives `-20`; 0 versus 0 gives `null`. The renderer
must not substitute zero, infinity or a guessed percentage.

## 10. Minimal AnalysisResult V2

The result contract is aggregate-only and sufficient for KPI, table,
comparison, 0..2 dimensions and a later Canvas renderer:

```text
AnalysisResultV2 {
  version: 2
  source: 'workforce'
  entity: 'employees'
  measures: ['headcount']
  dimensions: DimensionKey[]                 // 0..2, ordered
  period: { kind: 'snapshot'; asOf: DateOnly }
  comparison: null | {
    kind: 'explicit_period'
    period: { kind: 'snapshot'; asOf: DateOnly }
  }
  metadata: {
    matchedEmployeeCount: number
    groupCount: number
    complete: true
  }
  columns: ResultColumn[]
  rows: ResultRow[]
  summary: {
    headcount: number
    delta?: number
    deltaPct?: number | null
  }
  presentationHints: {
    preferred: 'kpi' | 'table' | 'comparison'
    fallback: 'table'
  }
}

ResultRow {
  key: string
  dimensions: Array<{
    dimension: DimensionKey
    value: string | null
    label: string | null
  }>
  values: {
    headcount: number
    delta?: number
    deltaPct?: number | null
  }
}
```

The actual TypeScript representation may use readonly tuples and discriminated
unions, but it must preserve these invariants:

- result `version` never changes to match the request silently;
- `rows` contain no employee identity or source row;
- `matchedEmployeeCount` is an aggregate count, not a list;
- `complete` can only be `true` after all server pages/cursors are consumed;
- base results omit comparison fields or use the documented `undefined` shape;
- comparison fields are present for both summary and aligned rows;
- one-dimensional and two-dimensional rows remain table-renderable;
- unknown is a null semantic value with a renderer label, not a magic employee;
- presentation hints never cause the result to be recalculated in the browser.

`analysis-result.ts` should become a versioned result boundary or delegate to a
new `analysis-result-v2.ts`. Existing V1 result types and tests remain intact.

## 11. Authorization, scope and retrieval

### Authorization sequence

The request handler must enforce this order:

```text
parse JSON
  -> strict versioned validation
  -> read server auth context
  -> verify dashboard + analysis data permission
  -> require tenant and HR-group context
  -> resolve allowed population mode
  -> complete server retrieval
  -> aggregate
```

The client cannot provide or override tenant ID, HR-group ID, administration,
user ID, Manager ID, permission, population mode, RLS bypass or semantic
registry entry. A supplied field with any of those meanings is an unknown
field and is rejected.

The current `AuthContext` in `lib/auth/permissions.ts` is the source for
tenant, active HR group, actor, active roles and permissions. The server must
re-read or verify the authorization context once before retrieval and not
accept a context object serialized by the browser.

### HR Admin scope

An appropriately authorized HR Admin may use the complete authorized HR-group
population. The implementation must still constrain every source read by
tenant and HR group, verify returned rows, and keep RLS/service-role access
behind a narrow server-only seam.

### Manager scope

For current and historical dates, a Manager population is the distinct set of
employees whose qualifying employment has an effective placement at the
requested date with `direct_manager_id = context.employeeId` (excluding the
actor where applicable). The historical resolver must evaluate the placement
at each requested date, not call the current-date `listDirectTeamEmployeeIds`
and reuse its result.

If the historical direct-report relationship cannot be proven because the
required placement is missing, ambiguous, unavailable under the safe read
contract or incomplete, return a typed `ANALYSIS_SCOPE_NOT_PROVABLE`/snapshot
scope error. Do not broaden to HR_GROUP and do not return a partial team.

Department-management hierarchy is not automatically a historical Manager
scope. If it is later included, its role assignments and department tree must
both be resolved at the same `asOf`, with ambiguity failing closed. The
implementation review must not quietly reuse `can_manage_employee`, whose
existing semantics are current-date oriented, as proof for past analytics.

### Complete server-side retrieval solution

The known safe seam is a server-only, keyset-paginated snapshot retrieval
adapter. It may be implemented as a narrowly scoped SQL/RPC read seam or as a
server-only service-role repository, subject to the security review. The
recommended contract is:

```text
loadSnapshotSourcePage({
  serverAuthContext,      // never client input
  asOf,
  populationMode,         // derived server-side: HR_GROUP or DIRECT_REPORTS
  cursor,                 // opaque server cursor
  pageSize                // bounded constant
}) -> {
  rows: SnapshotSourceRow[]
  nextCursor: string | null
  complete: boolean
}
```

Requirements:

- authorization is checked before the first page and rechecked inside the
  narrow database/RPC seam;
- the cursor is keyset-based on a stable composite ordering, not browser
  pagination or client stitching;
- page size is bounded, but the server loops until `nextCursor` is null;
- a full page without a valid next cursor is not assumed complete;
- all qualifying employments and required effective placements are retrieved,
  not a `limit(500)` overview projection;
- if an upper safety budget is required, exceeding it rejects the request with
  a typed too-large error; it never truncates and returns a plausible result;
- the route returns only the final aggregate result;
- logs contain counts/timing/codes, never source rows or secrets.

The retrieval seam should prefer a single authorized, typed source contract
over several independently limited lists. If a new security-definer RPC is
chosen, it must use a fixed `search_path`, explicit argument checks,
`auth.uid()`/permission checks, tenant+HR-group predicates and narrow grants.
If an internal service-role repository is chosen, it must be server-only,
receive only the already verified context, post-validate every returned row,
and never be imported by client components or a generic query endpoint.

### Completeness and performance

The design must measure and test:

- page count, source row count and distinct employee count;
- no duplicate employee after page boundaries;
- no employee missing because of a 500-row boundary;
- query plan/index use for employment date and placement date predicates;
- Manager direct-report lookup by historical `direct_manager_id`; and
- failure behavior for cursor corruption, page error and oversized scope.

Existing indexes on employment employee/date and organization scope/date are a
useful baseline, but the implementation review must confirm the exact
historical query plan. An index migration is a performance decision, not a
reason to alter migration history or run `db push` during this design run.

## 12. V1/V2 coexistence and saved analyses

### Execution coexistence

V1 and V2 share the route and high-level engine boundary, but not semantics:

- `version: 1` dispatches to the existing V1 validator/engine/result;
- `version: 2` dispatches to the V2 validator/snapshot adapter/result;
- a V1 request never receives a hidden `asOf` or V2 active-only rewrite;
- a V2 request never falls back to current V1 overview semantics;
- V1 AN-6 drill/value-compare remains version 1 and its tests remain green;
- a V2 period comparison is not sent through the V1 value-comparison shape.

### Saved definition behavior

The saved service continues to store configuration only. It must:

- accept either a strict V1 or V2 validated spec at the server boundary;
- persist `definition_version` equal to the spec version;
- never accept a client owner, tenant or HR-group field;
- reauthorize current active context, owner, tenant and HR group on open;
- revalidate the stored JSON with the same dispatcher before execution;
- execute fresh data at the explicit V2 snapshot dates; and
- show a typed unavailable/error state if history, scope or data quality is
  no longer provable.

“Save as V2” creates a new V2 definition. It does not mutate or upgrade a V1
row. The existing owner-scoped list remains a list projection without spec or
result data.

The current `saved-analysis-runtime.ts` accepts a V1 `AnalysisResult` type. It
must be versioned so V1 and V2 opened results are represented by a typed union,
without serializing source rows into the page.

## 13. Canvas and Explore handoff

### Minimum V2A-1 UI integration

V2A-1 does not build the full guided Explore V2 experience. It does provide a
small, testable result handoff so the new engine is not verified only by unit
fixtures:

- keep `/api/insights/analysis` as the execution endpoint;
- render a V2 KPI or table through the existing Foundation `Surface`,
  `DataTableShell`, `EmptyState` and `SectionHeader` primitives;
- extend `LiquidCanvas` with an explicit version branch or add a narrow
  V2-table renderer, while leaving V1 markup and behavior stable;
- render 0, 1 and 2 dimension rows, Unknown, comparison summary, signed delta
  and null `delta_pct` without client calculation;
- use the existing table as the safe fallback for unsupported/invalid visual
  intent; and
- keep all visible text in the NL/EN `insights` message namespaces.

The V2 Canvas branch must be a renderer only. It cannot read Supabase,
retrieve employees, recalculate counts or infer missing comparison values.
V2B later owns richer visual auto-selection. V2C later owns question-led
controls, typed option loading, drill/compare interaction and complete V2
Explore UX. The handoff contract established here must allow V2C and future
AN-8 to submit the same strict V2 spec.

### Empty and error states

The UI must distinguish:

- valid zero groups after an authorized filter;
- incomplete/unavailable snapshot data;
- historical Manager scope not provable;
- invalid/tampered spec; and
- unsupported presentation fallback.

It must not show a zero KPI for a retrieval failure or an unauthorized
historical scope.

## 14. Security design and negative plan

### Threat/control matrix

| Threat | Required control | Negative proof |
|---|---|---|
| unauthenticated request | `getRequestAuthorizationContext`/auth boundary before retrieval | no source call; 401 |
| no dashboard access | require `dashboard:read` | no source call; 403 |
| no employee data access | require `employee:read` or `employee-directory:read` according to registry | no source call; 403 |
| missing HR group | `requireHrGroupId` | no source call; 403 |
| tenant tampering | tenant comes from server context; source predicates and row assertions | foreign tenant fixture never appears |
| HR-group tampering | group comes from active server context; no JSON field | foreign group fixture never appears |
| Manager broadening | derive direct-report scope at each `asOf`; no HR_GROUP fallback | former direct report/current outsider not returned |
| current helper used for history | explicit historical resolver seam | test changing manager relationship between dates |
| dimension injection | registry keys + strict identifier/value parser | SQL-like dimension rejected 400 |
| filter value probing | authorized option resolution with generic error | out-of-scope key does not reveal existence |
| `asOf` tampering | date-only parser, server uses validated period only | timestamp/relative/invalid date rejected |
| comparison tampering | exact second snapshot and same authorization | mismatched period/source rejected |
| version cross-contamination | discriminated version dispatch | V1 shape cannot execute V2; V2 cannot enter V1 engine |
| unknown fields | recursive strict schemas | employeeId/result/sql/tenant fields rejected |
| result leakage | result mapper allowlist | JSON result has no employee/tenant IDs or raw rows |
| saved owner tampering | server-derived owner and DB identity immutability | foreign saved ID is 404/not found |
| stale saved permission | reauthorize on list/open/execute | permission/context change fails closed |
| RLS bypass misuse | narrow server-only seam + source row assertions + RLS/definer checks | direct/browser access is absent/denied |
| partial retrieval | cursor completion invariant | injected page failure never returns partial aggregate |
| reference deletion/corruption | typed effective-value validation | no arbitrary label or group assignment |

### Aggregate-only boundary

`AnalysisResult V2`, saved JSON, browser state, Canvas props and future
conversation payloads contain only measures, semantic dimension values/labels,
period metadata, comparison metadata, counts and presentation hints. Employee
IDs may exist only in a server-only local map for distincting and are erased
before result construction. No API response exposes internal source pages.

### Suppression

No generic suppression code is added to Snapshot Core. V2A-1 headcount is an
ordinary workforce measure. A future sensitive entity must own its own semantic,
permission, RLS and suppression contract, including comparison-side handling.

## 15. Database and schema determination

### Existing data is sufficient for the core facts

Read-only migration/type evidence shows that the current schema already has:

- `employments` with tenant, HR-group, employee, `employment_type`, confirmed
  lifecycle status, `starts_on`, `ends_on`, deletion marker and indexes for
  employee/date access;
- `employee_organizations` with tenant, HR-group, employee, optional
  `employment_id`, department, job, manager and effective date columns;
- tenant/HR-group-scoped foreign keys and RLS policies for employment and
  organization data; and
- a current `employment_type` enum of `EMPLOYEE`, `INTERN`, `APPRENTICE` and
  `CONTRACTOR` in the canonical employment migration/typegen.

V2A-1 does not need a snapshot table or result cache. A snapshot is a fresh
execution at an explicit date.

### Conclusion: MIGRATION LIKELY REQUIRED

The `saved_analysis_definitions` table is JSONB, but its database contract is
not version-neutral:

- `definition_version` has `check (definition_version = 1)`;
- `internal_security.is_valid_saved_analysis_spec(jsonb)` requires the V1
  nine-key shape, `version = 1`, max one dimension, max 20 V1 filters and V1
  presentation values; and
- the column comment calls the value a closed V1 spec.

Therefore the physical JSONB type can hold V2 bytes, but a V2 save cannot be
accepted safely by the current database validator. A forward migration is
likely required before “Save as V2” is enabled. Conceptually it must:

1. make the version constraint accept the approved V1/V2 versions;
2. make the internal validator dispatch exact V1 and exact V2 allowlists,
   including the V2 period/comparison/presentation fields;
3. preserve identity immutability and tenant/HR-group/owner RLS;
4. keep results, snapshots and employee data excluded from storage; and
5. update comments and generated `packages/db/types.ts` through the normal
   typegen process.

If the implementation chooses a new historical snapshot RPC or adds indexes
for complete keyset reads, that is a separate forward migration candidate.
No schema, migration, RLS, grant, typegen or remote Supabase action is part of
this design run. Migration history drift is not to be repaired or replayed.

## 16. Ordered implementation slices

The following order keeps each boundary testable and follows schema/data
access before API/UI behavior:

1. **Types and version dispatch** — introduce readonly V2 types, date-only,
   period/comparison and result unions; preserve V1 exports.
2. **Strict V2 validator** — implement recursive unknown-field rejection,
   structural limits, cross-field compatibility and stable errors.
3. **Versioned semantic registry** — add V2A-1 measures/dimensions/filters,
   typed option metadata, unknown policy and no-query-text tests.
4. **Authorization contract** — define HR Admin versus proven historical
   Manager modes; add server-owned snapshot scope object and fail-closed codes.
5. **Complete retrieval seam** — implement the server keyset page contract,
   narrow SQL/RPC or repository boundary, cursor completion and performance
   instrumentation. Do not reuse overview pagination.
6. **Active population resolver** — implement confirmed/non-deleted/date
   qualification, re-entry, future/former/never and parallel-employment rules.
7. **Effective history resolver** — resolve placement/type at D, explicit
   Unknown, overlap/reference/data-quality failures and deterministic keys.
8. **Filters and grouping** — apply normalized filters to the effective
   projection, deduplicate employees, support 0..2 ordered dimensions and
   deterministic sort/limit.
9. **V2 result** — construct aggregate-only KPI/table result with period,
   complete metadata, fallback hints and no source fields.
10. **Snapshot comparison** — execute the same pipeline twice, align groups,
    zero missing sides and calculate signed delta/delta_pct.
11. **Saved compatibility** — versioned parse/open/execute and explicit
    Save-as-V2 path; only after the forward migration is approved/applied in a
    separate governed task.
12. **Minimal Canvas/table integration** — add a result-version branch or
    bounded V2 table renderer using existing Foundation primitives; no V2B
    chart work.
13. **Targeted/security tests** — complete unit, route, repository/RPC,
    saved-definition and negative tests below.
14. **Browser acceptance** — execute real HR Admin and Manager flows in the
    selected test environment after code and data gates are green.
15. **Final release review** — inspect diff, typegen/migration evidence,
    production-build implications and release authority separately. No merge,
    deploy or version bump is implied by this design.

## 17. Test matrix for implementation review

### Validator and registry

- V2 canonical KPI and one/two-dimension shapes pass.
- Snapshot date accepts exact valid date-only values and rejects timestamps,
  invalid calendar dates, relative values and unknown period kinds.
- Explicit second snapshot comparison passes; same date, event period,
  previous-equal period and malformed comparison fail.
- Max 3 measures contract is enforced; only headcount is currently executable.
- Max 2 dimensions, max 8 filters and one filter per dimension are enforced.
- `eq` and `in` normalize values; duplicate values normalize deterministically.
- Status filter permits the V2A-1 active invariant and rejects non-active
  expansion as unsupported.
- Department/job values require authorized semantic options.
- Unknown top-level/nested keys, employee IDs, tenant IDs, SQL-like values,
  result-shaped data and V1/V2 mixed presentation fields fail.
- Registry serialization contains no SQL/table/join internals.

### Population and history

- active confirmed employment is included;
- future-only, former-only, never-employed, cancelled and deleted rows are
  excluded;
- inclusive `ends_on = asOf` behavior is covered;
- re-entry is active at its later snapshot without event semantics;
- duplicate source pages and duplicate employment rows still count one
  employee;
- parallel employments with one primary resolve once;
- parallel employments with common dimension values resolve deterministically;
- multiple primary or conflicting parallel values fail typed;
- placement before/after/on effective boundaries resolves correctly;
- overlapping effective placements fail rather than choose first;
- no placement maps to Unknown only for a declared dimension policy;
- null job and missing reference behavior is explicit;
- deleted/mismatched department or job reference fails typed;
- invalid date, enum, scope or cursor data never produces partial output.

### Filters and grouping

- department/job/type/status filters use the same snapshot date as grouping;
- AND across dimensions and OR within `in` are correct;
- no-dimension result is one distinct employee count;
- one dimension groups stable semantic keys and labels;
- two dimensions return ordered tuple rows, not a matrix;
- Unknown sorts and limits deterministically;
- label and measure sorts use stable tie-breakers;
- rows contain no employee or tenant IDs.

### Comparison

- same effective query at two dates returns signed current-minus-previous delta;
- department/type/job group movements align by semantic key;
- left/right-only groups fill zero;
- Unknown aligns as one null key;
- zero comparison denominator returns `delta_pct: null`;
- non-zero denominator returns percent change in documented units;
- comparison limit is applied after group alignment;
- current and comparison sides use identical auth/scope and completeness;
- no employee membership diff is present.

### Authorization and security

- unauthenticated, no dashboard permission, no data permission and missing
  HR-group cases fail before source retrieval;
- tenant/group/dimension/filter/asOf/comparison/version tampering is rejected;
- HR Admin can read only the active tenant/HR group;
- Manager can read only proven direct reports at each requested date;
- Manager historical scope never falls back to HR-group;
- a relationship that changes between the two comparison dates is handled by
  two historical scope evaluations;
- out-of-scope semantic option does not reveal another scope's existence;
- saved owner/tenant/group tampering returns safe not-found/unavailable;
- direct browser access to internal retrieval is impossible;
- RLS/definer grant and fixed search path are covered if a database seam is
  introduced;
- source retrieval error, incomplete cursor and too-large scope fail closed.

### V1 regression

- all existing `analysis-spec`, semantic registry, engine, route, drill and
  AN-6 comparison tests remain green;
- V1 Explore still serializes the nine-key V1 spec;
- V1 saved definitions still parse/open/execute with V1 current semantics;
- V1 saved migration contract remains valid until its separately approved
  forward migration changes it;
- V1 Canvas KPI/table/fallback and unknown-row behavior remain unchanged;
- no V2 `asOf` is injected into an old V1 definition.

## 18. Browser acceptance design

This run performs no browser acceptance. The implementation review should use
the real application and persisted test fixtures, not a mock-only proof.

Minimum acceptance journeys:

1. HR Admin opens V2A-1 entry, executes a current KPI and a historical
   department/type table, and confirms displayed counts against the approved
   fixture readback.
2. HR Admin executes Q7 with two explicit dates and confirms current,
   comparison, signed delta, zero-denominator null percentage and aligned
   groups.
3. Manager executes a current direct-report snapshot and a historical snapshot
   where the direct-report membership differs; the result uses only the
   historically proven population.
4. Manager historical scope that cannot be proven receives a safe error state,
   never a broader HR-group result.
5. Save/open uses a fresh authorized execution; V1 saved analysis remains V1,
   and Save as V2 creates a separate versioned definition only when the DB
   forward migration is approved.
6. Tampered API payloads are rejected through the real route; the browser
   receives no source rows.

Viewport/evidence contract:

- desktop `1440x900`;
- mobile `390x844`;
- no page errors, no console errors, no page-wide horizontal overflow;
- visible loading, empty, invalid, unavailable and fallback states;
- accessible labels/focus and readable table rows;
- no screenshot noise from debug panels or raw data;
- verify network responses contain typed aggregate result only.

## 19. Evidence-based file plan

### CORE

| Path | State | Responsibility | Why |
|---|---|---|---|
| `apps/hr-suite/lib/insights/analysis-spec.ts` | existing/modify | version dispatch and preserved V1 API | one public spec boundary without V1 rewrite |
| `apps/hr-suite/lib/insights/analysis-spec-v2.ts` | new | V2 types, strict parser, normalization | isolates V2 contract and keeps V1 readable |
| `apps/hr-suite/lib/insights/analysis-semantic-layer.ts` | existing/modify | version-aware registry | one allowlist, no second semantic engine |
| `apps/hr-suite/lib/insights/analysis-snapshot-retrieval.ts` | new | complete authorized page/cursor seam | removes overview/500 dependency |
| `apps/hr-suite/lib/insights/analysis-snapshot.ts` | new | qualification, representative and effective history resolver | centralizes snapshot truth |
| `apps/hr-suite/lib/insights/analysis-engine.ts` | existing/modify | shared V1/V2 dispatch and authorization boundary | one public engine pipeline |
| `apps/hr-suite/lib/insights/analysis-result.ts` | existing/modify | versioned result union or delegation | preserves V1 while exposing V2 result |
| `apps/hr-suite/lib/insights/analysis-result-v2.ts` | new/optional | V2 result types and output invariant helpers | prevents result-shape cross-contamination |
| `apps/hr-suite/lib/insights/analysis-errors.ts` | existing/modify | snapshot, history, completeness and scope errors | stable route/UI behavior |
| `apps/hr-suite/lib/insights/saved-analysis-definition.ts` | existing/modify | V1/V2 stored-spec dispatch | revalidate saved V2 at open |
| `apps/hr-suite/lib/insights/saved-analysis-service.ts` | existing/modify | version-aware persistence | preserve owner/tenant/group server scope |
| `apps/hr-suite/lib/insights/saved-analysis-runtime.ts` | existing/modify | V1/V2 fresh execution | no result/snapshot persistence |
| `apps/hr-suite/app/api/insights/analysis/route.ts` | existing/modify | route dispatch to V1/V2 | same controlled endpoint |
| `apps/hr-suite/app/api/insights/saved-analyses/route.ts` | existing/modify if needed | accept validated V2 definition | no client-owned scope fields |
| `apps/hr-suite/app/api/insights/saved-analyses/[analysisId]/route.ts` | existing/modify if needed | version-aware open/update | safe reauthorization and errors |

Existing `employee-overview.ts`, `employment-service.ts` and
`organization/team-scope.ts` remain V1/reference seams. V2 must not silently
change their current behavior; a new snapshot adapter should own historical
semantics.

### TESTS

| Path | State | Coverage |
|---|---|---|
| `lib/insights/analysis-spec-v2.test.ts` | new | strict V2 parser and cross-field rules |
| `lib/insights/analysis-semantic-layer.test.ts` | existing/extend | V1/V2 registry allowlists and no SQL internals |
| `lib/insights/analysis-snapshot.test.ts` | new | status, parallel employment and history matrix |
| `lib/insights/analysis-snapshot-retrieval.test.ts` | new | page completion, keyset, scope and no truncation |
| `lib/insights/analysis-engine.test.ts` | existing/extend | V2 grouping/result and V1 regression |
| `lib/insights/analysis-result-v2.test.ts` | new/optional | aggregate-only result invariants |
| `app/api/insights/analysis/route.test.ts` | existing/extend | V2 dispatch, errors, no-store, tamper cases |
| `lib/insights/saved-analysis-definition.test.ts` | existing/extend | V1/V2 parse and no cross-contamination |
| `lib/insights/saved-analysis-service.test.ts` | existing/extend | scope and fresh versioned open |
| `lib/insights/saved-analysis-migration-contract.test.ts` | existing/extend | forward DB validator contract |
| `components/insights/liquid-canvas.test.tsx` | existing/extend | V2 KPI/table/comparison/Unknown fallback |
| browser acceptance suite | new/approved location | real HR Admin/Manager desktop/mobile journeys |

### UI and message files

| Path | State | Responsibility |
|---|---|---|
| `components/insights/liquid-canvas.tsx` | existing/modify | explicit V2 aggregate table/fallback branch |
| `components/insights/analysis-exploration.tsx` | existing/modify only if needed | typed result handoff, no source data |
| `components/insights/analysis-explore.tsx` | existing/limited modify | only minimum V2 entry/integration; full controls remain V2C |
| `apps/hr-suite/messages/nl/insights.ts` | existing/modify | Dutch V2 labels/errors |
| `apps/hr-suite/messages/en/insights.ts` | existing/modify | matching English keys |

### DOCS

| Path | State | Responsibility |
|---|---|---|
| `docs/requirements/reports/LIQUID_ANALYSE_V2A1_SNAPSHOT_CORE_DESIGN.md` | this document | authoritative implementation design |
| `docs/README.md` | minimal modify | surface design candidate |
| `docs/delivery/CURRENT_CONTEXT.md` | later implementation task | update only after material implementation delivery |

### MIGRATION/DB

| Candidate | State in this run | Concept |
|---|---|---|
| forward saved-definition migration | not created | V1/V2 JSON validator, version check and comments |
| snapshot retrieval RPC migration | not determined until implementation seam review | only if the chosen secure complete read needs a DB function |
| historical query indexes | not created | only after query-plan evidence |
| `packages/db/types.ts` | unchanged | regenerate only after an approved schema migration |

## 20. Technical questions by classification

### A — resolved from repository/product evidence

- V2A-1 is Q1/Q2/Q3/Q4/Q7 only.
- V1 and V2 require strict version separation.
- Current source facts and effective date columns exist in the employment and
  organization schema.
- V1 overview and Manager current scope are not safe V2 historical seams.
- Current saved schema is JSONB but validates only V1.
- Existing aggregate-only Canvas/table and saved fresh-execution patterns are
  reusable.
- No universal V2A-1 headcount suppression is needed.

### B — recommended engineering choices

- separate V2 parser/types and snapshot resolver modules while keeping one
  version-aware public engine;
- stable semantic reference keys plus labels, with option resolution after
  authorization;
- server keyset paging with a hard no-partial-result invariant;
- primary/common-value parallel-employment rule with typed ambiguity failure;
- one current/comparison resolver and one immutable authorization scope;
- V2 table fallback in existing Canvas primitives before V2B visuals.

### C — implementation approval gates, not product blockers

- approve whether the complete retrieval seam is a security-definer RPC or a
  narrow server-only repository after query-plan and security review;
- approve the forward saved-definition migration before enabling V2 persistence;
- approve any new historical-read index/RPC migration from read-only evidence;
- confirm that current master-data labels are acceptable presentation labels
  for historical department keys, since department names are not separately
  date-versioned in the current schema.

None of these reopens product discovery. If an implementation cannot prove
historical Manager scope or effective values, the correct outcome is a typed
failure and an implementation stop, not a new product interpretation.

## 21. Design verification boundary

This design run intentionally does not run TypeScript, ESLint, tests, build,
browser acceptance, Supabase advisors, typegen, migrations, remote reads or
deployments. Those are implementation/release checks, not evidence needed to
write this repository design. The documentation-only verification for this
run is:

- governing Foundation and relevant repository seams were read;
- the design worktree starts at the approved Foundation SHA;
- only this design document and the minimal documentation index entry are
  intended to change;
- no app code, migration, package, Supabase, Vercel or version file is part of
  the change;
- canonical `apps/hr-suite/.env.local` remains present and untouched; and
- `git diff --check`, changed-file scope and branch/HEAD are checked before
  commit.

## 22. Candidate conclusion

V2A-1 Snapshot Core is implementation-ready as a bounded versioned extension
of the existing analysis pipeline. The critical implementation risks are
explicitly contained: complete server-side retrieval, historical Manager
scope, deterministic parallel-employment/history handling and the saved V2
database validator migration. None requires changing the frozen product
direction. The implementation review may proceed from this document only
after the stated C approval gates are answered in the implementation task.

**DESIGN APPROVED CANDIDATE — READY FOR V2A-1 IMPLEMENTATION REVIEW**
