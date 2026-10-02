# Codex Orchestrator Brief â€” PAYLAB00 Isolation Foundation

## Mission

Implement **PAYLAB00 â€” Isolation Foundation** for the LiquidHR Payroll Lab.

This is an experimental bounded context inside the existing LiquidHR monorepo.

The objective is isolation and safety â€” **not payroll calculation yet**.

## Architecture

```text
packages/payroll-engine
        +
apps/hr-suite/lib/payroll
        +
apps/hr-suite/app/(dashboard)/payroll-lab
        +
separate Supabase project: LiquidHR-Payroll-Lab
```

LiquidHR Core remains the source HR system. Payroll Lab uses its own Supabase project. The browser must never access Payroll Supabase directly.

## Hard constraints

### DO NOT modify

- existing Core employee schema;
- existing Core employment schema;
- existing Core IKV/import schema;
- CONTROL02 contracts;
- existing Core Supabase migrations;
- LiquidHR authorization model;
- unrelated modules.

### DO NOT

- create a second HR master database;
- copy all employees/employments;
- create cross-database foreign keys;
- perform cross-database SQL joins;
- expose PAYROLL Supabase secrets to the browser;
- add `NEXT_PUBLIC_` payroll credentials;
- put Supabase/Next/React imports inside `packages/payroll-engine`;
- implement Dutch tax calculation yet;
- implement pension/car/payment/declaration yet.

If a requirement appears to need a Core schema modification, STOP and report it as an architecture dependency rather than changing Core.

## Allowed paths

Primary ownership:

```text
packages/payroll-engine/**
apps/hr-suite/lib/payroll/**
apps/hr-suite/app/(dashboard)/payroll-lab/**
```

Minimal shared edits only when required:

```text
root workspace/package config
.env.example
one guarded navigation entry
```

Before touching any other path, explain why and check conflict risk.

## Security

Server flow:

```text
Browser
 â†’ LiquidHR authenticated request
 â†’ existing server authorization
 â†’ Payroll application service
 â†’ scoped Payroll repository
 â†’ Payroll Supabase
```

PAYROLL Supabase credentials are server-only.

Repository APIs MUST be scoped.

Bad:

```ts
getPayrollRun(runId)
```

Required pattern:

```ts
getPayrollRun({
  tenantId,
  hrGroupId,
  administrationId,
  runId
})
```

Service-role access must never imply authorization.

Add tests proving another administration cannot be read or mutated.

## Feature gating

Implement:

1. global `PAYROLL_LAB_ENABLED`;
2. Payroll Lab administration capability in Payroll Lab DB.

Do not add a capability column/table to LiquidHR Core for PAYLAB00.

## Initial Payroll Lab data model

Implement:

```text
payroll_administrations
payroll_periods
source_snapshots
calculation_input_sets
calculation_runs
component_results
calculation_traces
payroll_controls
golden_case_runs
```

Financial/runtime rows must carry explicit scope:

```text
source_tenant_id
source_hr_group_id
source_administration_id
```

No foreign keys to LiquidHR Core.

## Model distinction

`PayrollSourceSnapshot` stores canonical source data only.

`CalculationInputSet` references:

```text
source_snapshot_id
payroll_period_id
rule_package_composition_id
engine_version
```

`CalculationRun` references one CalculationInputSet.

This distinction is mandatory.

## `packages/payroll-engine`

Create only clean skeleton/contracts.

Pure TypeScript. No Next.js, React, Supabase, LiquidHR Core or browser APIs.

No real payroll calculation in PAYLAB00.

## Payroll Lab UI

Create only a protected shell page proving:

- auth;
- capability gating;
- server connectivity;
- current administration identity/status.

Do not build payroll UX yet.

## Environment variables

Document:

```text
PAYROLL_LAB_ENABLED
PAYROLL_SUPABASE_URL
PAYROLL_SUPABASE_SECRET_KEY
```

No secrets in repo. No `NEXT_PUBLIC_` equivalent.

## Orchestration

You are the orchestrator.

Use sub-agents where useful for architecture, security, migration and test review.

Do not let the implementation path be the only reviewer of its own security assumptions.

Run review/fix/test loops until GREEN or a genuine blocker is reached.

## Required tests

At minimum:

1. existing LiquidHR regression suite;
2. typecheck;
3. lint;
4. production build;
5. payroll-engine package boundary;
6. global flag disabled;
7. administration capability disabled;
8. authorized administration allowed;
9. cross-administration read rejected;
10. cross-administration write rejected;
11. no Payroll Supabase secret in client output/import graph;
12. no Core schema migration introduced.

## GREEN gate

```text
existing tests                  GREEN
typecheck                       GREEN
lint                            GREEN
build                           GREEN
Payroll package isolation       GREEN
server-only secret check        GREEN
feature gating                  GREEN
repository scope isolation      GREEN
Core DB schema delta            ZERO
```

## Documentation

Create/update:

```text
docs/payroll/ADR-PAYLAB-001-BOUNDARY.md
docs/payroll/PAYLAB_STATUS.md
docs/payroll/OPEN_ISSUES.md
```

`PAYLAB_STATUS.md` must contain:

- implemented;
- tests run;
- GREEN/RED;
- shared files modified;
- Core files modified;
- outstanding risks;
- exact next milestone.

## Stop conditions

STOP and report rather than improvising if:

- CONTROL02/core IKV contract must be modified;
- Core DB schema appears necessary;
- authorization cannot be enforced without redesign;
- Payroll credential would need browser exposure;
- existing tests regress for unclear reasons;
- shared-file conflict with another active track is detected.

Do not work around these stop conditions.

## Final response

Report:

1. summary;
2. architecture created;
3. files changed;
4. database migrations;
5. tests/results;
6. security review findings;
7. deviations;
8. GREEN/RED;
9. recommended PAYLAB01 handoff.

Do not start PAYLAB01 automatically.

