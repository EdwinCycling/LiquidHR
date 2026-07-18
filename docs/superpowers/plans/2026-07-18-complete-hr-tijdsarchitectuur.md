# Complete HR-tijdsarchitectuur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rond de dienstverbandflow af en lever administratiegebonden functies/salaristabellen, documentendossiers met reminders, een historische medewerkerkaart en een beveiligde HR-maandkalender.

**Architecture:** Bestaande HR-tabellen blijven de schrijfbron. Nieuwe beheer- en dossierentiteiten volgen dezelfde tenant-/administratiegrenzen en RLS-helpers; één getypeerde `HrChangeEvent`-projectie voedt tijdkaart en kalender. Iedere slice wordt schema → API → UI gebouwd en kritieke autorisatie-, salaris- en transactielogica volgt red-green-refactor.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Zod, Supabase Postgres/Storage/RLS/RPC, Tailwind v4, Vitest, next-intl-achtige repository-i18n.

## Global Constraints

- Werk uitsluitend inline; gebruik geen subagents.
- Gebruik nooit `any` en geen hardcoded zichtbare UI-tekst.
- Permissioncodes gebruiken `resource:action` of `self:resource:action`.
- Salarisdata vereist altijd een afzonderlijke salarispermission.
- Iedere publieke tabel krijgt RLS en policies in dezelfde migratie.
- Na iedere schemawijziging: databaseproef, advisors en `packages/db/types.ts` regenereren.
- Behoud de bestaande wijzigingen in `docs/delivery/HANDMATIGE_ACTIES.md` en `package-lock.json`.
- Valideer iedere afgeronde slice lokaal op poort 3000 en via een actuele publieke preview.

---

### Task 1: Complete dienstverbandpublicatie en mutaties

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260718090000_complete_employment_flow.sql`
- Create: `apps/hr-suite/supabase/tests/employment_complete_flow.sql`
- Modify: `apps/hr-suite/lib/employment/detail-schemas.ts`
- Modify: `apps/hr-suite/lib/employment/detail-schemas.test.ts`
- Modify: `apps/hr-suite/lib/employment/employment-service.ts`
- Modify: `apps/hr-suite/lib/employment/employment-detail-service.ts`
- Modify: `apps/hr-suite/app/api/employees/[employeeId]/employments/route.ts`
- Modify: `apps/hr-suite/app/api/employments/[employmentId]/changes/route.ts`
- Modify: `apps/hr-suite/components/employment/employment-create-form.tsx`
- Create: `apps/hr-suite/components/employment/employment-basics-form.tsx`
- Create: `apps/hr-suite/components/employment/employment-organization-form.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/employees/[employeeId]/employments/[employmentId]/page.tsx`
- Modify: `apps/hr-suite/messages/nl/employment.json`
- Modify: `apps/hr-suite/messages/en/employment.json`

**Interfaces:**
- Produces `completeEmploymentCreateSchema` with employee, employment, IKV, organization, labor, schedule, optional salary and allocations.
- Produces RPC `publish_complete_employment(requested_employee_id uuid, requested_payload jsonb) returns uuid`.
- Extends combined change domain with `EMPLOYMENT`, `INCOME_RELATIONSHIP`, and `ORGANIZATION`.

- [ ] **Step 1: Write failing schema and database tests**

Add tests proving an invalid 90% allocation fails, salary requires scale/amount, unauthorized salary publication fails, and a valid package creates one employment plus every selected child record atomically.

```ts
expect(() => completeEmploymentCreateSchema.parse({ ...validInput, allocations: [{ costCenterId, percentage: 90 }] })).toThrow()
expect(completeEmploymentCreateSchema.parse(validInput).employment.startsOn).toBe('2026-08-01')
```

Run: `npm test -- --run lib/employment/detail-schemas.test.ts -w @liquid-hr/hr-suite`
Expected: FAIL because `completeEmploymentCreateSchema` is missing.

- [ ] **Step 2: Implement schema and atomic RPC**

Use this discriminated mutation contract:

```ts
type ExtendedDomain = 'EMPLOYMENT' | 'INCOME_RELATIONSHIP' | 'ORGANIZATION' | 'LABOR_CONDITIONS' | 'SCHEDULE' | 'SALARY' | 'COST_ALLOCATION'
```

The RPC must lock the employee, validate context and domain permissions, insert a change set, create/split all requested records, reject partial packages and audit in the same transaction.

- [ ] **Step 3: Run focused tests green**

Run: `npm test -- --run lib/employment/detail-schemas.test.ts lib/employment/impact-rules.test.ts -w @liquid-hr/hr-suite`
Expected: PASS.

- [ ] **Step 4: Wire routes and forms**

The create route calls only `publish_complete_employment`; basics and organization forms call the combined changes route. Every client mutation refreshes the Server Component after success and maps typed codes through `employment.json`.

- [ ] **Step 5: Verify slice and commit**

Run: `npm run check:i18n -w @liquid-hr/hr-suite && npm run type-check -w @liquid-hr/hr-suite && npm run lint -w @liquid-hr/hr-suite`
Expected: all PASS.

Commit: `feat: complete employment publication flow`

### Task 2: Functiecatalogus en versieerbare salaristabellen

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260718100000_add_job_catalog_salary_revisions.sql`
- Create: `apps/hr-suite/supabase/tests/job_catalog_salary_revisions.sql`
- Create: `apps/hr-suite/lib/master-data/schemas.ts`
- Create: `apps/hr-suite/lib/master-data/schemas.test.ts`
- Create: `apps/hr-suite/lib/master-data/service.ts`
- Create: `apps/hr-suite/app/api/master-data/jobs/route.ts`
- Create: `apps/hr-suite/app/api/master-data/job-groups/route.ts`
- Create: `apps/hr-suite/app/api/master-data/salary-scales/route.ts`
- Create: `apps/hr-suite/app/api/master-data/salary-scales/[scaleId]/revisions/route.ts`
- Create: `apps/hr-suite/app/(dashboard)/master-data/jobs/page.tsx`
- Create: `apps/hr-suite/app/(dashboard)/master-data/salary-scales/page.tsx`
- Create: `apps/hr-suite/components/master-data/job-catalog-manager.tsx`
- Create: `apps/hr-suite/components/master-data/salary-scale-manager.tsx`
- Modify: `apps/hr-suite/components/layout/sidebar/nav-data.ts`
- Create: `apps/hr-suite/messages/nl/masterData.json`
- Create: `apps/hr-suite/messages/en/masterData.json`

**Interfaces:**
- Tables: `job_groups`, `jobs`, `job_revisions`, `salary_scale_revisions`.
- Migrates `salary_scale_steps` to `salary_scale_revision_id`, `sequence_number`, `hourly_amount`, `step_kind`.
- API returns amounts only when `salary:read` is present.

- [ ] **Step 1: Write failing validation tests**

```ts
expect(() => salaryRevisionSchema.parse({ validFrom: '2026-07-01', steps: [] })).toThrow()
expect(() => salaryRevisionSchema.parse({ ...revision, steps: [{ ...step, sequenceNumber: 1 }, { ...step, stepCode: '2', sequenceNumber: 1 }] })).toThrow()
```

Run: `npm test -- --run lib/master-data/schemas.test.ts -w @liquid-hr/hr-suite`
Expected: FAIL because the module is missing.

- [ ] **Step 2: Add schema, RLS and migration compatibility**

Create initial published revisions for existing scales and repoint existing step references without changing historical amounts. Enforce non-overlap per job/scale revision and immutable published revisions database-side.

- [ ] **Step 3: Add permission-aware services and routes**

`job-catalog:*` controls functions; `salary-structure:*` controls structures; amount columns are selected only with salary permission. All queries filter tenant plus active administration and have explicit limits.

- [ ] **Step 4: Build administration-scoped management UI**

Jobs support groups, revisions and archive state. Salary revisions support copy-latest, row editing, validation and explicit publication. New employment/organization forms select job IDs and salary revision steps.

- [ ] **Step 5: Verify slice and commit**

Run focused tests, i18n, type-check, lint and build.
Commit: `feat: add versioned job and salary master data`

### Task 3: Documentendossier en samengestelde reminderdoelgroepen

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260718110000_add_employee_document_dossiers.sql`
- Create: `apps/hr-suite/supabase/tests/employee_document_dossiers.sql`
- Create: `apps/hr-suite/lib/documents/schemas.ts`
- Create: `apps/hr-suite/lib/documents/schemas.test.ts`
- Create: `apps/hr-suite/lib/documents/audience-rules.ts`
- Create: `apps/hr-suite/lib/documents/audience-rules.test.ts`
- Create: `apps/hr-suite/lib/documents/document-service.ts`
- Create: `apps/hr-suite/app/api/employees/[employeeId]/documents/route.ts`
- Create: `apps/hr-suite/app/api/employees/[employeeId]/documents/[documentId]/route.ts`
- Create: `apps/hr-suite/app/api/employees/[employeeId]/documents/[documentId]/download/route.ts`
- Create: `apps/hr-suite/components/documents/employee-document-dossier.tsx`
- Create: `apps/hr-suite/components/documents/document-form.tsx`
- Modify: `apps/hr-suite/lib/reminders/schemas.ts`
- Modify: `apps/hr-suite/lib/reminders/schemas.test.ts`
- Modify: `apps/hr-suite/lib/reminders/reminder-service.ts`
- Modify: `apps/hr-suite/components/reminders/reminder-center.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx`
- Create: `apps/hr-suite/messages/nl/documents.json`
- Create: `apps/hr-suite/messages/en/documents.json`

**Interfaces:**
- Tables: `document_categories`, `employee_documents`, `document_audiences`, `reminder_target_rules`.
- Audience types: `EMPLOYEE | MANAGEMENT_ROLE | DEPARTMENT_BRANCH`.
- Route returns a signed URL only after permission plus audience checks.

- [ ] **Step 1: Write failing audience and metadata tests**

```ts
expect(canAccessDocument({ hasPermission: true, audienceMatches: false })).toBe(false)
expect(canAccessDocument({ hasPermission: false, audienceMatches: true })).toBe(false)
expect(canAccessDocument({ hasPermission: true, audienceMatches: true })).toBe(true)
```

Run: `npm test -- --run lib/documents -w @liquid-hr/hr-suite`
Expected: FAIL because document modules are missing.

- [ ] **Step 2: Add private storage metadata, RLS and soft delete**

Store `storage_key`, never a public URL. Add checksum, normalized `text[]` tags, expiry, remover and reason. Policies call internal permission-plus-audience helpers. Salary categories add salary permission checks.

- [ ] **Step 3: Generalize reminder targets**

Migrate each legacy reminder to one target rule. Publishing resolves the union of all rules into deduplicated recipients. A document owns at most one active expiry reminder and updates it idempotently.

- [ ] **Step 4: Build upload/download/delete/restore APIs and dossier UI**

Allow PDF, PNG, JPEG, WebP, DOCX and XLSX with a server-side size cap. On metadata failure remove the uploaded object. Delete is soft; restore requires `document:delete`. Show metadata, audiences, expiry and reminder state.

- [ ] **Step 5: Verify slice and commit**

Run unit, route, database/RLS, i18n, type, lint, build and browser checks.
Commit: `feat: add secure employee document dossiers`

### Task 4: Gedeelde HR-wijzigingenprojectie en tijdkaart

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql`
- Create: `apps/hr-suite/supabase/tests/hr_change_event_projection.sql`
- Create: `apps/hr-suite/lib/hr-events/types.ts`
- Create: `apps/hr-suite/lib/hr-events/projector.ts`
- Create: `apps/hr-suite/lib/hr-events/projector.test.ts`
- Create: `apps/hr-suite/lib/hr-events/service.ts`
- Create: `apps/hr-suite/app/api/hr-events/route.ts`
- Create: `apps/hr-suite/components/employment/employment-time-map.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/employees/[employeeId]/employments/[employmentId]/page.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx`
- Modify: `apps/hr-suite/messages/nl/employment.json`
- Modify: `apps/hr-suite/messages/en/employment.json`

**Interfaces:**

```ts
export interface HrChangeEvent {
  id: string
  eventDate: string
  eventType: HrChangeEventType
  employeeId: string
  employmentId: string | null
  titleKey: string
  titleValues: Record<string, string | number>
  sourceHref: string
  severity: 'INFO' | 'ATTENTION' | 'CRITICAL'
}
```

- [ ] **Step 1: Write failing projection and redaction tests**

Prove stable ordering, correct effective dates, no fictional gaps, and complete omission of salary events without salary capability.

- [ ] **Step 2: Add bounded database projection and service sanitation**

Union only explicit columns from employment, IKV, organization, labor, schedule, salary, costs, documents and reminders. The service removes forbidden event families before returning typed values.

- [ ] **Step 3: Build employee summary cards and responsive time map**

Use URL `date=YYYY-MM-DD`; desktop renders lanes and a cursor, mobile renders chronological cards. Every segment links to its source tab. No client data cache is introduced.

- [ ] **Step 4: Verify slice and commit**

Run projection/RLS tests and full frontend checks.
Commit: `feat: add employment time map`

### Task 5: Grote HR-maandkalender

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260718130000_add_hr_calendar_permission.sql`
- Create: `apps/hr-suite/supabase/tests/hr_calendar_authorization.sql`
- Create: `apps/hr-suite/lib/hr-calendar/schemas.ts`
- Create: `apps/hr-suite/lib/hr-calendar/schemas.test.ts`
- Create: `apps/hr-suite/lib/hr-calendar/calendar-model.ts`
- Create: `apps/hr-suite/lib/hr-calendar/calendar-model.test.ts`
- Create: `apps/hr-suite/app/(dashboard)/hr-calendar/page.tsx`
- Create: `apps/hr-suite/components/hr-calendar/hr-month-calendar.tsx`
- Create: `apps/hr-suite/components/hr-calendar/hr-month-agenda.tsx`
- Modify: `apps/hr-suite/components/layout/sidebar/nav-data.ts`
- Create: `apps/hr-suite/messages/nl/hrCalendar.json`
- Create: `apps/hr-suite/messages/en/hrCalendar.json`

**Interfaces:**
- Consumes the existing `/api/hr-events` projection.
- URL state: `month`, `q`, `department`, repeated `type`, `employee`.

- [ ] **Step 1: Write failing month-grid tests**

```ts
expect(buildMonthDays('2026-07')).toHaveLength(31)
expect(groupEventsByEmployee(events).get(employeeId)?.get('2026-07-15')).toHaveLength(2)
```

- [ ] **Step 2: Build server page and resource calendar**

Desktop uses sticky employee and day headers, one row per visible employee and compact accessible event buttons. Mobile uses grouped agenda cards. Filters update URL-state and server-rendered data.

- [ ] **Step 3: Add navigation, i18n and detail cards**

The route requires the new `hr-calendar:read` permission plus source permissions. Event clicks show sanitized details and a source link.

- [ ] **Step 4: Verify slice and commit**

Run calendar unit tests, i18n, type, lint, build, desktop and 390px browser checks.
Commit: `feat: add hr change month calendar`

### Task 6: Live database, volledige regressie en documentatie

**Files:**
- Regenerate: `packages/db/types.ts`
- Modify: `docs/README.md`
- Modify: `docs/requirements/employment/CONTRACT_EN_DIENSTVERBAND.md`
- Modify: `docs/requirements/documents/DOCUMENTEN_EN_AI_COMPLIANCE.md`
- Create: `docs/decisions/FDR-0001-document-en-reminderdoelgroepen.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `docs/delivery/CURRENT_CONTEXT.md`
- Modify: `apps/hr-suite/lib/app-version.ts`

- [ ] **Step 1: Apply migrations in order and regenerate types**

Apply only the five reviewed migrations to project `wnpfloqpjvaacobppbpk`, run security and performance advisors, fix every new warning, then regenerate `packages/db/types.ts`.

- [ ] **Step 2: Run all automated verification**

Run:

```powershell
npm test -w @liquid-hr/hr-suite
npm run check:i18n -w @liquid-hr/hr-suite
npm run type-check -w @liquid-hr/hr-suite
npm run lint -w @liquid-hr/hr-suite
npm run build -w @liquid-hr/hr-suite
```

Expected: all PASS with no warnings introduced by this work.

- [ ] **Step 3: Validate browser flows on port 3000**

Test complete employment publication, job/scale revision management, document upload/download/delete/restore/reminder, as-of time map, salary redaction and month calendar on desktop and 390px.

- [ ] **Step 4: Validate current public preview**

Start or verify a fresh preview/tunnel, repeat the critical happy paths and confirm there is no horizontal overflow or browser console error.

- [ ] **Step 5: Update durable documentation and final commit**

Record actual schema/API/UI status, test counts, advisor results, preview URL and remaining manual production actions. Do not claim a check that was not executed.

Commit: `docs: record complete hr time architecture delivery`
