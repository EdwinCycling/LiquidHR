# Payroll Lab status — PAYLAB00 closed, PAYLAB01 partial

**PAYLAB00: ENVIRONMENT-GATED — database/isolation foundation accepted.** The
authorized Payroll Lab migration and schema/security readback were accepted in
the previous PAYLAB00 acceptance. The remaining authenticated context check is
blocked by the test environment rejecting a newly issued JWT with
`PGRST303: JWT issued at future`.

**PAYLAB01: PARTIAL.** The read-only source adapter, canonical snapshot,
runtime validation, scope checks, version vector and deterministic SHA-256 hash
are implemented. Local targeted verification is green. A live authenticated
Core-to-snapshot proof could not be completed because the same JWT clock
validation error prevents the local app from reading its authenticated
context. No PAYLAB02 work has started.

## PAYLAB00 root-cause analysis

- The local hr-suite reads Core through `NEXT_PUBLIC_SUPABASE_URL`; the local
  URL host resolves to the verified Core project ref
  `wnpfloqpjvaacobppbpk`. The test-role-switch guard is pinned to that same
  project ref. Secret values were not read or logged.
- `loadActiveContext` derives tenant, HR-group and administration options from
  the signed-in user's active access rows and current active Core records.
  Context cookies select among those freshly loaded options; they cannot add an
  arbitrary scope.
- Read-only Core checks found the fixed synthetic HR Admin fixture, three
  active HR-group access rows with active tenant/group matches, one active
  tenant-scope access row, and five active accessible administrations.
- A fresh local test-login request returned the expected redirect. Its first
  authenticated page read failed with PostgREST `PGRST303: JWT issued at
  future`, before a fresh context could be returned. This is an Auth/PostgREST
  token-time validation issue in the test environment, not evidence for a
  product-code defect. The earlier mismatched scope IDs could not be rematched
  during this failed read, so no application bug is claimed or patched.
- No Core business data was created or changed. PAYLAB00 is closed at the
  environment gate; there will be no further PAYLAB00 acceptance loop in this
  slice.

## PAYLAB01 source mapping

`LiquidHrPayrollSourceProvider` is a server-only adapter. It requires the
existing `salary:read` and `contract:read` checks, compares all requested scope
IDs to the authenticated context, then reads through the existing employment
services. It honors `PAYROLL_LAB_ENABLED` before authorization or source reads.
It performs no direct Core Supabase query and no writes.

The snapshot currently maps:

- tenant, HR-group, administration, employee, employment and payroll-period
  references;
- confirmed employment dates, original-hire/seniority dates, employment and
  contract types;
- effective-dated salary basis/route, payment type/frequency, currency,
  full-time/part-time amounts, hourly rate and validity dates;
- effective-dated average and full-time hours, days, part-time factor,
  schedule type, on-call flag and validity dates;
- `updated_at` versions for the selected employment, salary and schedule rows.

Personal names, birth data, BSN, IBAN, contact details, and unrelated HR fields
are excluded from the canonical snapshot. The source hash uses stable
key-sorted serialization over source scope, period, canonical payload, source
version vector and explicit gaps. Generated snapshot ID and creation time are
excluded from the hash.

Explicit gaps:

- IncomeRelationship remains `UNSUPPORTED` while CONTROL02 owns the accepted
  administration/IKV contract. Employment is not treated as an
  IncomeRelationship.
- Tax/fiscal profile remains `SOURCE_GAP` until a trusted existing source
  contract is available.
- Missing, incomplete or truncated salary/schedule timelines are
  recorded as `SOURCE_GAP` or `UNSUPPORTED`; the adapter does not calculate
  payroll.
- Overlapping salary/schedule timelines are marked `UNSUPPORTED`, including
  overlaps that occur after another row already covers the whole period.

## Verification and boundaries

- Targeted PAYLAB source/schema/auth/scope/route regressions: **12 files,
  62 tests passed**.
- Strict TypeScript: **passed** after wiring the existing workspace package.
- Changed-area ESLint: **passed**.
- Production build: **passed**, 300 pages generated. Its negative
  control and Payroll client-boundary scan passed across 143 assets. An exact
  scan of the local Payroll secret value found **0** asset matches; the value
  was not printed.
- PAYLAB00 remote foundation remains unchanged; no Payroll migration was added
  or applied in this slice.
- Core schema/config/migration delta: **0**. CONTROL02: **untouched**.
- No BSN, IBAN, or real payroll data was read into the snapshot; no Core data
  write occurred. No push or merge. PAYLAB02 was not started.
- Live authenticated source integration remains environment-gated by the JWT
  error. No full hr-suite run was repeated under bounded AA-TEST.

See [`PAYLAB00/PAYLAB01 acceptance evidence`](acceptance/PAYLAB00-01-20260930.md),
[`open issues`](OPEN_ISSUES.md) and the [`boundary ADR`](ADR-PAYLAB-001-BOUNDARY.md).
