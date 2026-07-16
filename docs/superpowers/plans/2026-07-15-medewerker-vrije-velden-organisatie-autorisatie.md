# Medewerker, vrije velden en organisatie/autorisatie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voltooi medewerker-CRUD, administratiegebonden vrije velden en volledig organisatie-/rollen-/autorisatiebeheer als drie veilige verticale slices.

**Architecture:** Bestaande tenantbrede Employee-identiteit blijft leidend. Nieuwe subresources en definities krijgen samengestelde tenant-/administratie-FK's, RLS en audit. Functiepunten bepalen acties, rollen bundelen functiepunten en toewijzingen bepalen tenant-, administratie- of afdelingsscope.

**Tech Stack:** PostgreSQL/Supabase RLS, Next.js 16 App Router, strict TypeScript, Zod, Server Components/Actions, Tailwind v4, Vitest.

## Global Constraints

- Bouwvolgorde per slice: `schema → server/API → UI`.
- Geen `any`, React Query of SWR.
- Iedere publieke tabel krijgt RLS en policies in dezelfde migratie.
- Database-identifiers Engels; UI en comments Nederlands met verplichte NL/EN-pariteit.
- Geen hardcoded kleuren buiten `globals.css`.
- Iedere nieuwe behavior start met een falende test.
- Geen Git-commit of push; Git volgt later op verzoek van Edwin.
- Lokale runtime blijft poort 3000; eindresultaat krijgt opnieuw een publieke HTTPS-preview.

---

### Task 1: Medewerker-schema, nummering, subresources en audit

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260715101500_complete_employee_core.sql`
- Create: `apps/hr-suite/supabase/tests/employee_core_crud_isolation.sql`
- Modify: `packages/db/types.ts` na remote migratie

**Interfaces:**
- Produces RPC `reserve_employee_number(p_tenant_id uuid) returns text`.
- Produces tables `employee_addresses`, `employee_bank_accounts`, `employee_relations`, `audit_logs`.
- Renames `employees.bsn` to `bsn_ciphertext`; behoudt `bsn_fingerprint`.

- [ ] Schrijf eerst een database-isolatietest die tenantoverschrijding, dubbele tenantnummers, overlappende adressen, twee primaire bankrekeningen en auditmutaties verwacht te blokkeren.
- [ ] Voer de test uit en bevestig dat hij faalt omdat schema/RPC ontbreken.
- [ ] Maak de migratie met tenantgebonden unieke index `(tenant_id, employee_number)`, atomaire nummerreeks en samengestelde foreign keys.
- [ ] Voeg RLS toe met afzonderlijke read/write policies op basis van exacte functiepunten en selfscope.
- [ ] Voeg gesaneerde audittriggers toe; sluit BSN-ciphertext/fingerprint en volledige IBAN uit van `changes`.
- [ ] Pas de migratie remote toe, draai de database-test en controleer security/performance advisors.
- [ ] Regenereer `@scope/db` types.

### Task 2: Medewerkervalidatie, cryptografie en services

**Files:**
- Create: `apps/hr-suite/lib/employees/schemas.test.ts`
- Create: `apps/hr-suite/lib/employees/schemas.ts`
- Create: `apps/hr-suite/lib/security/pii-crypto.test.ts`
- Create: `apps/hr-suite/lib/security/pii-crypto.ts`
- Create: `apps/hr-suite/lib/employees/employee-service.test.ts`
- Create: `apps/hr-suite/lib/employees/employee-service.ts`

**Interfaces:**
- `employeeCreateSchema`, `employeeUpdateSchema`, `addressSchema`, `bankAccountSchema`, `relationSchema`.
- `encryptPii(plaintext, tenantId): string`, `decryptPii(ciphertext, tenantId): string` met AES-256-GCM.
- `getNextEmployeeNumber()`, `createEmployee()`, `updateEmployee()`, `archiveEmployee()`, `revealEmployeeBsn()` en CRUD per subresource.

- [ ] Schrijf falende Zod-tests voor verplichte velden, ISO-landcodes, e-mail, IBAN, datums en concurrency token.
- [ ] Implementeer minimale schemas en maak de tests groen.
- [ ] Schrijf falende cryptotests voor roundtrip, tenantscheiding en tamper-detectie.
- [ ] Implementeer AES-256-GCM met `EMPLOYEE_PII_ENCRYPTION_KEY`; log nooit input/output.
- [ ] Schrijf falende servicetests voor automatisch/handmatig nummer, 409-conflict, identity-match, scoped detail en gemaskeerde payloads.
- [ ] Implementeer de services met ingelogde Supabase-client, expliciete selects en optimistic concurrency via `updated_at`.
- [ ] Draai alle module- en regressietests.

### Task 3: Medewerker-API

**Files:**
- Create: `apps/hr-suite/app/api/employees/route.ts`
- Create: `apps/hr-suite/app/api/employees/next-number/route.ts`
- Create: `apps/hr-suite/app/api/employees/[employeeId]/route.ts`
- Create: `apps/hr-suite/app/api/employees/[employeeId]/bsn/route.ts`
- Create: `apps/hr-suite/app/api/employees/[employeeId]/addresses/route.ts`
- Create: `apps/hr-suite/app/api/employees/[employeeId]/bank-accounts/route.ts`
- Create: `apps/hr-suite/app/api/employees/[employeeId]/relations/route.ts`
- Create: `apps/hr-suite/lib/employees/http-errors.test.ts`
- Create: `apps/hr-suite/lib/employees/http-errors.ts`

**Interfaces:** Consistente `{ data }`/`{ error, code, details? }` responses; 400/401/403/404/409/500.

- [ ] Schrijf falende tests voor typed foutmapping en het nooit serialiseren van BSN/IBAN.
- [ ] Implementeer foutmapping minimaal.
- [ ] Bouw routes met permissioncheck als eerste semantische stap, Zod-validatie en begrensde GET-resultaten.
- [ ] Verifieer anonieme 401, manager-BSN 403, HR scoped success en cross-tenant 404.

### Task 4: Medewerker-UI

**Files:**
- Modify: `apps/hr-suite/app/(dashboard)/employees/page.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/employees/new/page.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx`
- Create: `apps/hr-suite/components/employees/employee-wizard.tsx`
- Create: `apps/hr-suite/components/employees/employee-profile.tsx`
- Create: `apps/hr-suite/components/employees/address-editor.tsx`
- Create: `apps/hr-suite/components/employees/bank-account-editor.tsx`
- Create: `apps/hr-suite/components/employees/relation-editor.tsx`
- Create/Modify: `apps/hr-suite/messages/{nl,en}/employees.json`

- [ ] Schrijf falende tests voor pure wizardstap- en form-statehelpers.
- [ ] Bouw de aanmaakwizard met identity check, optionele plaatsing en serverbevestiging.
- [ ] Bouw detailsecties, editvormen, BSN reveal en archiveren; acties volgen server-side capabilities.
- [ ] Controleer desktop en 390px mobiel zonder horizontale overflow.

### Task 5: Vrije-velden-schema en permissions

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260715102000_add_custom_field_definitions.sql`
- Create: `apps/hr-suite/supabase/tests/custom_fields_isolation.sql`
- Modify: `packages/db/types.ts`

**Interfaces:**
- Tables `custom_field_definitions`, `custom_field_select_options`, `custom_field_counters`.
- Enums voor entity, type en audience access (`HIDDEN`, `READ`, `WRITE`).
- RPC voor atomair volgend AUTO_INCREMENT-nummer.

- [ ] Schrijf de falende database-test voor administratie-isolatie, immutable key, counterconcurrency en audience/RLS.
- [ ] Maak de migratie, permissions en TENANT_ADMIN-seeds.
- [ ] Activeer RLS en blokkeer cross-tenant/administration references met constraints.
- [ ] Pas remote toe, draai tests/advisors en regenereer types.

### Task 6: Vrije-veldenvalidatie, services en API

**Files:**
- Create: `apps/hr-suite/lib/custom-fields/validation.test.ts`
- Create: `apps/hr-suite/lib/custom-fields/validation.ts`
- Create: `apps/hr-suite/lib/custom-fields/audience.test.ts`
- Create: `apps/hr-suite/lib/custom-fields/audience.ts`
- Create: `apps/hr-suite/lib/custom-fields/custom-field-service.ts`
- Create: `apps/hr-suite/app/api/custom-fields/route.ts`
- Create: `apps/hr-suite/app/api/custom-fields/[definitionId]/route.ts`
- Create: `apps/hr-suite/app/api/employees/[employeeId]/custom-fields/route.ts`

**Interfaces:**
- `validateCustomFieldValues(definitions, values)` retourneert typed normalized JSON.
- `resolveCustomFieldAccess(definition, context)` retourneert `HIDDEN | READ | WRITE`.

- [ ] Schrijf falende tests voor ieder veldtype, required, selectopties, URLs, currencyprecisie, onbekende keys en audiencecompositie.
- [ ] Implementeer minimale pure validators/resolvers en maak tests groen.
- [ ] Bouw services en routes met administratiecontext en optimistic concurrency.
- [ ] Verifieer HR/manager/self en cross-administration negatieve paden.

### Task 7: Vrije-velden-UI

**Files:**
- Create: `apps/hr-suite/app/(dashboard)/settings/custom-fields/page.tsx`
- Create: `apps/hr-suite/components/custom-fields/definition-editor.tsx`
- Create: `apps/hr-suite/components/custom-fields/custom-fields-form.tsx`
- Create: `apps/hr-suite/messages/{nl,en}/custom-fields.json`
- Modify: medewerkerdetail en dashboardnavigatie

- [ ] Schrijf falende tests voor pure sorteer- en inputnormalisatiehelpers.
- [ ] Bouw administratiegebonden definitiebeheer inclusief opties, audiences, sortering en deactiveren.
- [ ] Render dynamische velden in medewerkerdetail met serverberekende access.
- [ ] Controleer NL/EN en zes thema's op desktop/mobiel.

### Task 8: Autorisatieschema en beschermde rollen

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260715102500_add_authorization_management.sql`
- Create: `apps/hr-suite/supabase/tests/authorization_management_isolation.sql`
- Modify: `packages/db/types.ts`

**Interfaces:** Permission `authorization:write`; tenantrol lifecycle; role assignments via bestaand `user_access` en `department_management`.

- [ ] Schrijf falende database-tests voor protected system roles, tenantrolisolatie, matrixmutaties en scope-overgangen.
- [ ] Voeg `is_active`/concurrencyvelden en ontbrekende samengestelde constraints toe.
- [ ] Maak least-privilege RLS-policies voor roles, role_permissions, user_access, departments, placements en management assignments.
- [ ] Seed `authorization:write` uitsluitend naar TENANT_ADMIN.
- [ ] Pas remote toe, test, run advisors en regenereer types.

### Task 9: Rollen, matrix en scopetoewijzingen server/API

**Files:**
- Create: `apps/hr-suite/lib/authorization/management-schemas.test.ts`
- Create: `apps/hr-suite/lib/authorization/management-schemas.ts`
- Create: `apps/hr-suite/lib/authorization/authorization-service.ts`
- Create: `apps/hr-suite/app/api/roles/route.ts`
- Create: `apps/hr-suite/app/api/roles/[roleId]/route.ts`
- Create: `apps/hr-suite/app/api/roles/[roleId]/permissions/route.ts`
- Create: `apps/hr-suite/app/api/role-assignments/route.ts`

- [ ] Schrijf falende tests voor code-normalisatie, system-roleblokkade, permissionmatrix en tenant/admin/department scope.
- [ ] Implementeer schemas, service en routes achter `authorization:write`.
- [ ] Verifieer dat permissiondefinities read-only blijven en cross-tenant IDs 404 geven.

### Task 10: Afdelingen, plaatsingen en managementtoewijzingen server/API

**Files:**
- Create: `apps/hr-suite/lib/organization/organization-schemas.test.ts`
- Create: `apps/hr-suite/lib/organization/organization-schemas.ts`
- Create: `apps/hr-suite/lib/organization/organization-service.ts`
- Extend: `apps/hr-suite/app/api/departments/route.ts`
- Create: `apps/hr-suite/app/api/departments/[departmentId]/route.ts`
- Create: `apps/hr-suite/app/api/organization-placements/route.ts`
- Create: `apps/hr-suite/app/api/management-assignments/route.ts`

- [ ] Schrijf falende tests voor cycles, parent scope, perioden, overlap en manager/selfregels.
- [ ] Implementeer schemas/services/routes met `department:write` en gerichte employee-permissions.
- [ ] Verifieer create/update/move/deactivate en typed conflicts.

### Task 11: Organisatie- en autorisatie-UI

**Files:**
- Modify: `apps/hr-suite/app/(dashboard)/departments/page.tsx`
- Create: `apps/hr-suite/app/(dashboard)/settings/roles/page.tsx`
- Create: `apps/hr-suite/components/organization/department-editor.tsx`
- Create: `apps/hr-suite/components/organization/placement-editor.tsx`
- Create: `apps/hr-suite/components/organization/management-assignment-editor.tsx`
- Create: `apps/hr-suite/components/authorization/role-editor.tsx`
- Create: `apps/hr-suite/components/authorization/permission-matrix.tsx`
- Create/Modify: `apps/hr-suite/messages/{nl,en}/{departments,authorization,navigation}.json`

- [ ] Schrijf falende tests voor pure tree move- en matrix-statehelpers.
- [ ] Bouw CRUD rond de bestaande afdelingenboom, met veilige deactivatie.
- [ ] Bouw rollenlijst, editor, rechtenmatrix en scopeassignments.
- [ ] Bouw plaatsings- en managementtoewijzingsbeheer.
- [ ] Controleer responsive UX, keyboardgebruik, loading/error/empty states en permission-hidden acties.

### Task 12: Documentatie, regressie, browser en uitrol

**Files:**
- Modify: `docs/README.md`
- Modify: relevante requirements en ADR's
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `AGENTS.md` indien een blijvende regel is toegevoegd

- [ ] Werk requirements bij met de definitieve fysieke tabellen, functiepunten, selfservicegrens en latere mobile-first ESS.
- [ ] Controleer querybegrenzing, auditredactie, secrets en i18n-pariteit.
- [ ] Draai alle database-isolatietests en beide Supabase advisors.
- [ ] Draai `npm test`, i18n-check, strict TypeScript, ESLint, `npm audit --omit=dev` en productiebuild.
- [ ] Start/behoud de app op poort 3000 en test kernflows in een echte browser op desktop en 390px mobiel.
- [ ] Vernieuw de publieke HTTPS-preview en documenteer eventuele handmatige Supabase-/secretstappen zonder ze als gereed voor te stellen.
