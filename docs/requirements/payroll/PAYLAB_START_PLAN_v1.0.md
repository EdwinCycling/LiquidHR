# LiquidHR PAYLAB â€” Startplan v1.0

**Datum:** 30 september 2026  
**Status:** READY TO START  
**Doel:** Payroll Lab veilig naast LiquidHR bouwen zonder de bestaande HR-database of core-domeinen onnodig te vervuilen.

## 1. Architectuurbesluit

We kiezen:

> **EÃ©n LiquidHR-monorepo + een geÃ¯soleerd `packages/payroll-engine` package + een server-side HR Suite integration layer + een tweede Supabase-project voor Payroll Lab.**

Niet gekozen:

- aparte Payroll-repository;
- payrolltabellen in de bestaande LiquidHR Core database;
- volledige kopie van employees/employments naar Payroll;
- browser-toegang rechtstreeks tot Payroll Supabase;
- cross-database foreign keys;
- directe cross-database SQL-joins;
- core employee/employment/IKV schemawijzigingen voor PAYLAB00.

## 2. Bounded contexts

### LiquidHR Core

Is de actuele bron voor:

- persoon/medewerker;
- employment;
- HR-group;
- administratiecontext zodra beschikbaar;
- salaris-/contractdata;
- verlof/verzuim;
- andere HR-events.

### Payroll Lab

Is de bron voor:

- payroll administration configuration;
- immutable payroll source snapshots;
- calculation input sets;
- payroll periods;
- calculation runs;
- component results;
- calculation traces;
- payroll controls;
- rule usage snapshots;
- golden-case runs.

Payroll Lab wordt geen tweede HR-masterdatabase.

## 3. Belangrijke scheiding: Source Snapshot versus Calculation Input Set

### `PayrollSourceSnapshot`

Bevat uitsluitend de canonical bronwaarheid die uit LiquidHR is gelezen.

```text
snapshot_id
created_at

source_tenant_id
source_hr_group_id
source_administration_id
source_employee_id
source_employment_id
source_income_relationship_id

period_reference

source_payload
source_version_vector
source_hash
```

Een Source Snapshot bevat dus **geen** engine version of rule package.

### `CalculationInputSet`

Legt vast met welke berekeningscontext een Source Snapshot wordt uitgevoerd.

```text
calculation_input_set_id
source_snapshot_id
payroll_period_id
rule_package_composition_id
engine_version
created_at
input_hash
```

Waarom dit belangrijk is:

```text
dezelfde HR snapshot
        â”œâ”€â”€ rules 2026-v1
        â””â”€â”€ rules 2026-v2
```

kan zo opnieuw worden berekend zonder de historische HR-input te dupliceren.

### `CalculationRun`

```text
calculation_run_id
calculation_input_set_id
run_type
status
started_at
finished_at
result_hash
```

## 4. Monorepo-indeling

```text
packages/
  payroll-engine/
    src/
      domain/
      engine/
      graph/
      decimal/
      controls/
      trace/
    tests/
    golden-cases/

  payroll-rules-nl-2026/   # pas toevoegen zodra M1 start
    src/
      wage-tax/
      parameters/
      tables/
    tests/

apps/
  hr-suite/
    lib/
      payroll/
        contracts/
        source/
        application/
        server/
        infrastructure/

    app/
      (dashboard)/
        payroll-lab/
```

`packages/payroll-engine` mag NIET importeren uit Next.js, React, Supabase, LiquidHR application code of browser APIs.

## 5. Twee Supabase-projecten

```text
LIQUIDHR CORE SUPABASE
        â”‚
        â”‚ READ via bestaande server/domain layer
        â–¼
LiquidHrPayrollSourceProvider
        â”‚
        â–¼
Canonical PayrollSourceSnapshot
        â”‚
        â–¼
PAYROLL LAB SUPABASE
```

De databases joinen niet rechtstreeks. Core identifiers zijn external source references, geen cross-database foreign keys.

## 6. Payroll administratie als primaire scope

Canonical scope:

```text
tenant
  â””â”€â”€ hr_group
       â””â”€â”€ payroll_administration
             â””â”€â”€ employer / LhNr
```

Payroll Lab bewaart daarom minimaal:

```text
source_tenant_id
source_hr_group_id
source_administration_id
```

Voor PAYLAB00 mag `source_administration_id` een Payroll Lab-configuratie-id zijn zolang CONTROL02 de definitieve Core-identiteit nog niet heeft vastgelegd.

## 7. Security model

```text
Browser
   â†“
LiquidHR session
   â†“
Server authorization
   â†“
Payroll Application Service
   â†“
Scoped Payroll Repository
   â†“
Payroll Supabase
```

Alleen server-side:

```text
PAYROLL_SUPABASE_URL
PAYROLL_SUPABASE_SECRET_KEY
```

Nooit `NEXT_PUBLIC_PAYROLL_SUPABASE_*`.

Omdat service-role RLS kan omzeilen, accepteert een repository nooit alleen `runId`, maar altijd expliciete scope:

```ts
getRun({
  tenantId,
  hrGroupId,
  administrationId,
  runId
})
```

Vanaf PAYLAB00:

- scope columns verplicht;
- repository-contracttests tegen cross-scope access;
- auditvelden;
- geen persoonsgegevens in application logs;
- secrets uitsluitend server-side.

## 8. Feature flag / capability

Twee lagen:

1. globale kill switch: `PAYROLL_LAB_ENABLED`;
2. enabled/disabled capability op `payroll_administrations` in de Payroll Lab database.

Geen Core DB-wijziging nodig.

## 9. Data policy voor de POC

Gebruik bij voorkeur een **synthetische medewerker die wel echt in een LiquidHR test-HR-group staat**.

Dus echte Coreâ†’Payroll integratie, maar nog geen BSN/IBAN of echte salarisprivacydata zolang de milestone dat niet vereist.

## 10. Anti-corruption layer

```ts
interface PayrollSourceProvider {
  getPayrollSourceSnapshot(input: {
    tenantId: string
    hrGroupId: string
    administrationId: string
    employeeId: string
    payrollPeriod: PayrollPeriodRef
  }): Promise<PayrollSourceSnapshot>
}
```

De provider:

- leest via bestaande LiquidHR server/domain services;
- vertaalt naar payroll-canonical semantics;
- doet geen payroll writes in Core;
- leidt geen IKV-sematiek af zonder expliciete bron/configuratie.

## 11. Geen distributed transaction nodig

Core en Payroll zitten in verschillende databases.

We gebruiken daarom snapshots:

1. lees brondata;
2. normaliseer canonical payload;
3. leg source-version vector vast;
4. bereken source hash;
5. schrijf immutable PayrollSourceSnapshot;
6. revalidatie kan later bepalen of Core gewijzigd is.

Geen cross-database transaction simuleren.

# 12. Uitvoeringsroadmap

## PAYLAB00 â€” Isolation Foundation

### Doel

Bewijzen dat Payroll veilig als bounded context in dezelfde monorepo kan bestaan.

### Codex mag wijzigen

```text
packages/payroll-engine/**
apps/hr-suite/lib/payroll/**
apps/hr-suite/app/(dashboard)/payroll-lab/**
root workspace config uitsluitend indien noodzakelijk
.env.example uitsluitend voor nieuwe PAYROLL_* keys
```

### Codex mag NIET wijzigen

- bestaande LiquidHR employee/employment/IKV tabellen;
- Core Supabase migrations;
- bestaande HR services buiten minimaal benodigde wiring;
- production payroll menu voor alle tenants;
- bestaande authmodel;
- CONTROL02-contracten.

### Deliverables

1. `packages/payroll-engine` skeleton;
2. second-Supabase server client;
3. scoped PayrollRepository interface;
4. global kill switch;
5. administration capability check;
6. `/payroll-lab` protected shell page;
7. initial Payroll Lab migration/schema;
8. tests voor feature flag en repository scope;
9. documentation + ADR;
10. full repo regression suite.

### GREEN gate

- existing LiquidHR tests GREEN;
- build GREEN;
- lint/typecheck GREEN;
- Payroll Supabase secret nergens client-bundled;
- Payroll Lab disabled => route/nav inaccessible;
- unauthorized administration => inaccessible;
- cross-scope repository read/write => rejected;
- Core DB schema diff = **zero**.

## PAYLAB01 â€” Source Adapter

Doel: Ã©Ã©n echte LiquidHR testmedewerker canonical uitlezen.

Deliverables:

- `PayrollSourceSnapshot` schema;
- Zod/runtime validation;
- `LiquidHrPayrollSourceProvider`;
- canonical Employment + IncomeRelationship apart;
- version vector;
- deterministic source hash;
- snapshot preview;
- nog geen payroll calculation.

GREEN: dezelfde Core state â†’ dezelfde canonical hash; relevante wijziging â†’ nieuwe hash; geen Core writes.

## PAYLAB02 â€” Payroll Persistence

Eerste minimale tabellen:

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

Nog geen auto/pensioen/UPA/payment/declaration/loonbeslag-tabellen.

GREEN: snapshot immutable zodra een CalculationInputSet ernaar verwijst; scope tests GREEN.

## PAYLAB03 â€” Engine M0

Doel: GC-NL-001 synthetic draaien.

Engine:

- fixed decimal;
- ComponentDefinition;
- typed named input/output;
- graph;
- dependency validation;
- calculation result;
- trace;
- controls;
- deterministic hashing.

GREEN: `GC-NL-001-SYNTHETIC = GREEN`; same snapshot + same rules + same engine = exact same result; geen Supabaseimports in engine package.

## PAYLAB04 â€” NL Wage Tax 2026 / M1

Voeg hier pas `packages/payroll-rules-nl-2026` toe.

Bronnen:

- Rekenvoorschriften 2026 v2;
- parameterbijlage 2026;
- Handboek Loonheffingen 2026;
- Golden Cases.

Doel: synthetische loonheffing vervangen door officiÃ«le NL-2026 loonbelasting/PVV voor de eerste ondersteunde situatie.

GREEN: official reference/table match GREEN; volledige calculation trace.

## PAYLAB05 â€” Minimal Lab UI + Go/No-Go

Toon:

- werknemer;
- employment / IKV;
- payrollperiode;
- source snapshot;
- source hash;
- input/rule/engine versions;
- bruto;
- loonheffing;
- netto;
- calculation trace;
- controls;
- recalculate.

Nog niet: loonstroken publiceren, SEPA, aangifte verzenden, officiÃ«le finalization.

Go/No-Go:

> Een LiquidHR source record wordt zonder Core-copydatabase gelezen, als immutable canonical snapshot in Payroll Lab vastgelegd en door een geÃ¯soleerde engine met een officiÃ«le Nederlandse 2026-regel reproduceerbaar berekend.

# 13. Parallelstrategie

PAYLAB kan vanaf PAYLAB00 parallel lopen.

Nu veilig parallel:

- Track A: PAYLAB00 infra/package/database foundation;
- Track B: engine contracts + synthetic GC1 design/tests;
- Track C: NL 2026 source registry/rules research.

Wachten op CONTROL02 voor de definitieve Core `IncomeRelationship`/administration mapping in PAYLAB01.

# 14. Exit strategy

Bij NO-GO:

1. Payroll Lab Supabase verwijderen;
2. `/packages/payroll-engine` verwijderen;
3. `apps/hr-suite/lib/payroll` verwijderen;
4. `/payroll-lab` verwijderen;
5. PAYROLL env vars verwijderen;
6. minimale nav/wiring verwijderen.

Core database heeft geen PAYLAB-schemawijzigingen.

# 15. Promotion strategy bij GO

Blijft bruikbaar:

- PayrollSourceProvider;
- canonical snapshot model;
- Payroll DB;
- payroll-engine;
- rules packages;
- Golden Cases;
- traces;
- controls;
- UI components.

Later toevoegen/hardenen:

- event-driven updates;
- production security;
- additional rules;
- payroll outputs/adapters;
- compliance operations.

# 16. Eerste menselijke acties

1. architectuurbesluit accepteren;
2. tweede Supabase-project `LiquidHR-Payroll-Lab` aanmaken;
3. dezelfde/nabije regio als LiquidHR Core kiezen;
4. URL + service credential alleen in lokale/Vercel server env zetten;
5. aparte PAYLAB00 branch/worktree maken;
6. Codex PAYLAB00-orchestrator starten;
7. CONTROL02 expliciet als no-touch dependency markeren.

