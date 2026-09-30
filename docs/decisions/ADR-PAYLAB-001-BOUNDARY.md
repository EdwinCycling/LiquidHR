# ADR-PAYLAB-001 â€” Payroll Lab Boundary

**Status:** Proposed / ready for acceptance  
**Date:** 30 September 2026

## Decision

LiquidHR Payroll Lab will be implemented in the existing LiquidHR monorepo as an isolated bounded context.

Architecture:

- `packages/payroll-engine`: pure TypeScript engine/domain package;
- `apps/hr-suite/lib/payroll`: LiquidHR integration/application/infrastructure layer;
- `apps/hr-suite/app/(dashboard)/payroll-lab`: experimental UI;
- separate Supabase project for Payroll Lab persistence;
- LiquidHR Core remains the source of current HR data;
- Payroll stores immutable canonical source snapshots needed for historical reproducibility;
- browser never connects directly to Payroll Supabase;
- no cross-database foreign keys/joins;
- no Core DB schema changes in PAYLAB00.

## Rationale

This maximizes:

- experiment isolation;
- code reuse;
- exitability;
- payroll historical integrity;
- security boundary;
- future production viability.

## Important model decision

`PayrollSourceSnapshot` stores source data only.

Engine/rule versions belong to `CalculationInputSet`, not to the source snapshot.

This permits the same source snapshot to be recalculated with another approved rule package or engine version without duplicating source history.

## Security

Payroll server credentials may bypass database RLS. Therefore application authorization is explicit and every repository operation is scoped by tenant + HR group + payroll administration.

Service-role possession is never considered authorization.

## Consequences

Positive:

- PAYLAB can run largely in parallel;
- engine can later be extracted without rewrite;
- experiment can be removed cleanly;
- Payroll DB can remain a valid future production bounded datastore.

Negative:

- two databases cannot participate in one transaction;
- no database-level foreign keys to Core;
- source freshness/version handling becomes mandatory;
- application/repository scope checks become security-critical.

## Dependency

CONTROL02 remains owner of the canonical Core administration/IKV import contract.

PAYLAB00 may create interfaces/placeholders but must not modify CONTROL02-owned Core contracts.

