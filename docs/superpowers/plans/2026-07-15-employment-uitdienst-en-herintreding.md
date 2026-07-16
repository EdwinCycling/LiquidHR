# Employment, uitdienst en herintreding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lever een tenantveilig effectief-gedateerd Employment-model met parallelle dienstverbanden, IKV, uitdiensttreding, herintreding en deduplicatie.

**Architecture:** Employee blijft de blijvende persoonskaart. Contractuele Employment, fiscale Income Relationship en organisatorische plaatsing zijn afzonderlijke modellen met samengestelde tenant/admin-FK’s. BSN-matching gebruikt een tenantgebonden HMAC; fuzzy matching blijft binnen de tenant en vereist een geaudite menselijke beslissing.

**Tech Stack:** PostgreSQL/Supabase RLS, Next.js App Router, Server Components/Actions, strict TypeScript, Zod, Vitest, SQL-isolatietests.

## Global Constraints

- Schema → API/server → UI.
- Parallelle Employments zijn toegestaan, ook binnen één administratie.
- Tijdsperioden zijn halfopen `[valid_from, valid_until)` en onderliggende tijdlijnen overlappen niet.
- Contract- en salarisrechten blijven gescheiden.
- Geen cross-tenant matching, logging van BSN of directe browsertoegang tot gevoelige velden.
- Exact 50 demo-Employees in tenant 1 en exact 10 in tenant 2.
- Git later; lokaal poort 3000 en publieke preview.

---

### Task 1: BSN-vingerafdruk en matchaudit

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260715120000_add_employee_identity_matching.sql`
- Create: `apps/hr-suite/supabase/tests/employee_identity_matching.sql`
- Create: `apps/hr-suite/lib/security/bsn-fingerprint.ts`
- Create: `apps/hr-suite/lib/security/bsn-fingerprint.test.ts`

**Interfaces:**
- Produces: `employees.bsn_fingerprint`, `identity_match_decisions`, `createBsnFingerprint(tenantId, bsn)`.

- [ ] **Step 1: Write failing fingerprint tests**

```ts
expect(normalizeBsn(' 1234 567 82 ')).toBe('123456782')
expect(createBsnFingerprint('tenant-a', bsn, key))
  .not.toBe(createBsnFingerprint('tenant-b', bsn, key))
```

Also test the eleven-proof and reject values other than exactly nine digits.

- [ ] **Step 2: Implement HMAC**

```ts
export function createBsnFingerprint(tenantId: string, bsn: string, key: string): string {
  const normalized = normalizeBsn(bsn)
  return createHmac('sha256', key).update(`${tenantId}:${normalized}`).digest('hex')
}
```

Require `BSN_HASH_KEY`; never return the normalized BSN from logging helpers.

- [ ] **Step 3: Add schema**

Add nullable fingerprint to Employee and a partial unique index on `(tenant_id, bsn_fingerprint)` where not deleted. Add `identity_match_decisions` with candidate Employee, decision enum, actor, rule summary and justification. Add same-tenant FKs, RLS and permission `employee:match`.

- [ ] **Step 4: Verify isolation**

SQL tests must prove same-tenant duplicate rejection, cross-tenant non-correlation and no unauthorized audit access. Regenerate DB types.

### Task 2: Employment en Income Relationship-kernschema

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260715121000_add_employment_core.sql`
- Create: `apps/hr-suite/supabase/tests/employment_core.sql`

**Interfaces:**
- Produces: `employments`, `income_relationships`, `employment_income_relationships`.

- [ ] **Step 1: Write failing SQL cases**

Cover zero Employments, two overlapping Employments in one administration, two in different administrations, mismatched tenant/admin/Employee rejection and overlapping link-period rejection.

- [ ] **Step 2: Add core tables**

```sql
create table public.employments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_number text not null,
  employment_type text not null,
  contract_type text not null,
  starts_on date not null,
  ends_on date,
  seniority_date date,
  probation_ends_on date,
  is_primary boolean not null default false,
  contract_document_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  unique (tenant_id, administration_id, employment_number),
  check (ends_on is null or ends_on >= starts_on),
  foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id),
  foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id)
);
```

Define typed enums instead of free text in the final migration. Add `income_relationships` and effective-dated junction with same-scope composite FKs. Permit parallel Employments and IKV’s; disallow overlapping duplicate junction ranges.

- [ ] **Step 3: Add RLS**

Employment uses contract permissions and management target scope. Income Relationship uses payroll/contract permissions. Every policy includes tenant and administration access; grants come after policies.

- [ ] **Step 4: Verify**

Reset, run SQL tests, advisors and regenerate types. Expected: PASS with no missing FK indexes.

### Task 3: Arbeidsvoorwaardentijdlijnen en stamtabellen

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260715122000_add_employment_timelines.sql`
- Create: `apps/hr-suite/supabase/tests/employment_timelines.sql`

**Interfaces:**
- Produces: `employment_labor_conditions`, `employment_schedules`, `employment_salaries`, `employment_cost_allocations`, `salary_scales`, `salary_scale_steps`, `cost_centers`, `employment_end_reasons`.

- [ ] **Step 1: Write failing overlap tests**

For every timeline insert adjacent periods successfully and overlapping periods unsuccessfully. Verify every master record belongs to the same administration as Employment.

- [ ] **Step 2: Add administration master data**

Each master table uses `(tenant_id, administration_id, id)` uniqueness and immutable tenant triggers. Salary steps use numeric amounts and currency codes, never floating point.

- [ ] **Step 3: Add effective timelines**

Use `valid_from`, nullable `valid_until`, checks and GiST exclusion constraints based on `daterange(valid_from, valid_until, '[)')`. Salary table has salary-specific RLS; other conditions use contract permissions.

- [ ] **Step 4: Verify**

Run reset/tests/advisors/type generation. Expected: PASS.

### Task 4: Uitdiensttreding en wettelijke codetabel

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260715123000_add_employment_terminations.sql`
- Create: `apps/hr-suite/supabase/tests/employment_terminations.sql`

**Interfaces:**
- Produces: `statutory_termination_reasons`, `employment_terminations`, RPC `confirm_employment_termination`.

- [ ] **Step 1: Write failing workflow tests**

Test draft→confirmed, invalid end before start, second active termination, cancellation, reported-record correction guard and Employee with another active Employment remaining active.

- [ ] **Step 2: Add versioned system codes**

Store code, NL/EN labels, `valid_from`, `valid_until` and source year. Seed the currently supported Belastingdienst set as immutable system data; do not let tenants edit it.

- [ ] **Step 3: Add termination workflow**

Create enum statuses and a table with internal and statutory reasons. The confirmation RPC locks Employment, validates scope/permission, applies `ends_on`, handles conflicting future timeline rows explicitly and writes audit data in one transaction.

- [ ] **Step 4: Verify**

Run database tests and negative RLS tests. Expected: PASS.

### Task 5: Arbeidsstatus, duplicaatmatching en domeinservices

**Files:**
- Create: `apps/hr-suite/lib/employment/employment-status.ts`
- Create: `apps/hr-suite/lib/employment/employment-status.test.ts`
- Create: `apps/hr-suite/lib/employment/identity-matching.ts`
- Create: `apps/hr-suite/lib/employment/identity-matching.test.ts`
- Create: `apps/hr-suite/lib/employment/employment-service.ts`
- Create: `apps/hr-suite/lib/employment/employment-service.test.ts`

**Interfaces:**
- Produces: `deriveEmploymentStatus`, `findIdentityCandidates`, `createEmployment`, `createRehireEmployment`.

- [ ] **Step 1: Write status tests**

```ts
expect(deriveEmploymentStatus([], today)).toBe('NEVER_EMPLOYED')
expect(deriveEmploymentStatus([{ startsOn: past, endsOn: past }], today)).toBe('FORMER_EMPLOYEE')
expect(deriveEmploymentStatus([{ startsOn: future, endsOn: null }], today)).toBe('FUTURE_EMPLOYEE')
```

Include parallel active and former-plus-future scenarios.

- [ ] **Step 2: Implement pure status function**

Use date-only comparison and return the four approved statuses; never inspect `employees.is_active`.

- [ ] **Step 3: Write matching tests**

Test hard BSN match, exact birthdate/name candidate, twins/ambiguous names, cross-tenant input rejection and required justification for `DIFFERENT_PERSON`.

- [ ] **Step 4: Implement services**

Use `requirePermission('employee:match')`, active context IDs and minimal projections. An unresolved match returns `resolutionRequired: true`; creation cannot continue until an audit decision exists.

- [ ] **Step 5: Verify**

Run focused tests and typecheck. Expected: PASS.

### Task 6: Schema-first server/API-routes

**Files:**
- Create: `apps/hr-suite/app/api/employees/matches/route.ts`
- Create: `apps/hr-suite/app/api/employees/[employeeId]/employments/route.ts`
- Create: `apps/hr-suite/app/api/employments/[employmentId]/route.ts`
- Create: `apps/hr-suite/app/api/employments/[employmentId]/termination/route.ts`
- Create: `apps/hr-suite/lib/employment/schemas.ts`
- Create: `apps/hr-suite/lib/employment/schemas.test.ts`

- [ ] **Step 1: Write failing Zod/request tests**

Cover date order, scope IDs being ignored from client payload, decimal salary, parallel Employment accepted, invalid role and match resolution required.

- [ ] **Step 2: Implement stable contracts**

Routes accept business fields only; tenant/admin are read from `requirePermission`. Return stable error codes such as `IDENTITY_MATCH_REQUIRED`, `EMPLOYMENT_NOT_FOUND`, `PERIOD_OVERLAP`, `TERMINATION_INVALID_STATE`.

- [ ] **Step 3: Implement routes**

Use Server-only services, explicit field projections and `permissionErrorResponse`. Never return BSN ciphertext/fingerprint or salary without salary permission.

- [ ] **Step 4: Verify**

Run route/domain tests, lint and typecheck. Expected: PASS.

### Task 7: Medewerkers- en Employment-UI

**Files:**
- Create: `apps/hr-suite/app/(dashboard)/employees/page.tsx`
- Create: `apps/hr-suite/app/(dashboard)/employees/new/page.tsx`
- Create: `apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx`
- Create: `apps/hr-suite/components/employment/employee-list.tsx`
- Create: `apps/hr-suite/components/employment/employee-or-rehire-form.tsx`
- Create: `apps/hr-suite/components/employment/employment-timeline.tsx`
- Create: `apps/hr-suite/components/employment/termination-dialog.tsx`
- Modify: `apps/hr-suite/components/layout/sidebar.tsx`

- [ ] **Step 1: Write component interaction tests**

Test status filters in URL, new-person matching pause, selecting herintreder, parallel Employment display, salary hidden without right and termination confirmation.

- [ ] **Step 2: Build Server Component pages**

Fetch directly server-side through domain queries, use URL search params for filter/sort/page and translate all copy from `employees`/`employment` namespaces.

- [ ] **Step 3: Build focused client forms**

Client components only manage form interaction. Server Actions/API own validation and mutation. Show candidate minimum data and require explicit decision.

- [ ] **Step 4: Verify responsive UI**

Run component tests, lint, typecheck and build. Verify 390px and desktop layouts.

### Task 8: Exact demo-seed

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260715124000_seed_employment_demo.sql`
- Create: `apps/hr-suite/supabase/tests/employment_demo_counts.sql`

- [ ] **Step 1: Write failing exact-count tests**

Assert exactly 50 nondeleted Employees for the main demo tenant and exactly 10 for tenant 2. Assert at least one case for every approved status, same-admin parallel Employment, cross-admin parallel Employment, herintreder and no-Employment external.

- [ ] **Step 2: Add deterministic idempotent seed**

Use stable UUIDs derived from fixed demo labels and `on conflict` handling. Populate Employment, IKV, timelines, terminations and assignments with fictitious values. Do not print BSN data.

- [ ] **Step 3: Verify reset reproducibility**

Run `supabase db reset` twice, run count/scenario tests both times. Expected: identical PASS.

### Task 9: Documentatie, volledige securitycontrole en preview

**Files:**
- Modify: `docs/requirements/employment/CONTRACT_EN_DIENSTVERBAND.md`
- Modify: `docs/requirements/core-hr/MEDEWERKER.md`
- Modify: `docs/architecture/BLUEPRINT.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `docs/README.md`
- Create: `docs/decisions/ADR-0003-employee-employment-ikv-en-herintreding.md`

- [ ] **Step 1: Reconcile documentation**

Record Employee identity permanence, optional/parallel Employment, separate IKV, tenant-only deduplication, status derivation and statutory/internal termination reasons.

- [ ] **Step 2: Run full verification**

Run all SQL tests, Supabase advisors, type generation, i18n check, lint, typecheck, Vitest and production build. Expected: all pass and no advisor security errors.

- [ ] **Step 3: Browser end-to-end scenarios on port 3000**

Test external without Employment, new Employee, hard duplicate, fuzzy doubt, herintreder, two parallel same-admin Employments, termination with another active Employment and final former status.

- [ ] **Step 4: Cross-tenant adversarial checks**

Repeat read/write requests with tenant 2 identifiers while authenticated only for tenant 1. Expected: zero data or typed 403; no candidate leak.

- [ ] **Step 5: Public preview**

Deploy, run desktop and iPhone smoke tests, record URL and test date.

- [ ] **Step 6: Final checkpoint without Git**

Report schema/API/UI completion, exact test counts, advisor results, public URL and any manual configuration still required.
