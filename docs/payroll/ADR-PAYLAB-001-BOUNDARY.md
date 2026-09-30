# ADR-PAYLAB-001 — Payroll Lab Boundary

This is the PAYLAB00 implementation companion to the canonical decision in
[`docs/decisions/ADR-PAYLAB-001-BOUNDARY.md`](../decisions/ADR-PAYLAB-001-BOUNDARY.md).
The canonical ADR remains authoritative.

## PAYLAB00 realization

- `packages/payroll-engine` contains only pure TypeScript contracts. It has no
  runtime dependencies and does not import Next.js, React, Supabase, LiquidHR
  Core modules, or browser APIs.
- `apps/hr-suite/lib/payroll` owns the server-only Payroll client, auth-facing
  access service, source-scope validation, and repository.
- `apps/hr-suite/app/(dashboard)/payroll-lab` is a protected shell. It requires
  the existing `salary:read` permission, `PAYROLL_LAB_ENABLED=true`, and an
  active enabled Payroll administration capability.
- Payroll persistence uses its own Supabase CLI configuration and migration
  directory under `apps/hr-suite/lib/payroll/supabase`. This directory is not
  part of LiquidHR Core's migration stream.
- Each Payroll row carries opaque source tenant, HR-group, and administration
  IDs. Foreign keys are limited to tables in the Payroll Lab database.
- The Payroll service-role key is read only from `PAYROLL_SUPABASE_SECRET_KEY`
  by a `server-only` module. Browser output is checked after production build
  with a non-secret sentinel.
- Source snapshots are immutable. Rule composition and engine version are
  recorded on immutable calculation input sets. Runs may progress only from
  `PENDING` to `RUNNING` and then to `SUCCEEDED` or `FAILED`; terminal runs and
  their result artifacts cannot be changed.

## Explicitly outside PAYLAB00

No Core employee, employment, IKV/import, or CONTROL02 schema/contract changes;
no Core-to-Payroll joins or foreign keys; no Dutch payroll calculation; and no
remote migration application without explicit user authorization.

## PAYLAB01 source adapter — 2026-09-30

The first source adapter is `LiquidHrPayrollSourceProvider`, a server-only
implementation of the pure `PayrollSourceProvider` contract. It validates its
request at runtime, requires existing `salary:read` and `contract:read`
authorization, and compares tenant, HR-group and administration IDs against
the authenticated server context before reading source records. It checks
`PAYROLL_LAB_ENABLED` before authorization or source reads. Employee and
employment reads use existing employment services; the provider does not
query Core Supabase directly.

The canonical snapshot contains source scope IDs, payroll period, employment
dates/types, effective-dated salary inputs and effective-dated weekly-hours
inputs. Its version vector contains the selected employment, salary and
schedule row versions. A stable key-sorted serialization over those values and
explicit source gaps produces the SHA-256 source hash. Snapshot IDs and
creation timestamps are excluded from the hash.

IncomeRelationship remains `UNSUPPORTED` until CONTROL02's accepted contract
is available; Employment is not a substitute. Tax/fiscal fields remain
`SOURCE_GAP`. The adapter excludes names, birth data, BSN, IBAN and contact
details, marks overlapping timelines `UNSUPPORTED`, performs no Core writes,
and does not persist snapshots or calculate payroll. Those persistence and
calculation steps remain later milestones.

PAYLAB00's database/isolation foundation was accepted. Its remaining live
authenticated context evidence is environment-gated: a fresh local test login
was followed by PostgREST `PGRST303: JWT issued at future`. PAYLAB01's local
tests and typecheck do not replace the missing live integration proof. See
[`acceptance evidence`](acceptance/PAYLAB00-01-20260930.md).
