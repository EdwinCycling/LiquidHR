# Talent bestandskaart

Deze kaart onderscheidt de bestaande canonieke bronnen, de bestanden die in de ownershipslice zijn aangepast en de grenzen voor een latere Talent-uitbreiding. Niet-bestaande Talent-bestanden worden niet als bestaande implementatie gepresenteerd.

## Bestaande bronnen die worden hergebruikt

| Productbegrip | Canoniek pad | Scope |
|---|---|---|
| Persoon/medewerker | `public.employees`, `apps/hr-suite/lib/employees/` | tenant |
| Aanstelling/contract | `public.employments`, `apps/hr-suite/lib/employment/` | administration |
| Plaatsing | `public.employee_organizations` | administrationele employment-koppeling |
| Functie en functierevisie | `public.jobs`, `public.job_revisions` | tenant |
| Functiegroep en junction | `public.job_groups`, `public.job_group_jobs` | tenant |
| Afdeling/division | `public.departments` | tenant tenzij expliciete administrationele scope |
| Tags | `public.star_performer_tags` | tenant |
| Audit | `public.audit_logs`, `internal_security.audit_hr_change()` | bestaande auditstroom |
| Rollen en permissions | `public.management_roles`, `public.permissions`, `public.role_permissions` | bestaande autorisatie |

## Aangepaste schema- en databasebestanden

| Pad | Verantwoordelijkheid |
|---|---|
| `apps/hr-suite/supabase/migrations/20260731130502_align_tenant_owned_job_catalog_and_departments.sql` | Tenant-FK's, scope_type voor departments, demo-merge en tenant-RLS voor jobcatalogus en afdelingen. |
| `apps/hr-suite/supabase/migrations/20260731131136_align_star_performer_job_catalog_scope.sql` | Tenantvalidatie van bestaande Star Performer job/group-referenties. |
| `apps/hr-suite/supabase/migrations/20260731132359_align_tenant_department_consumers.sql` | Tenant-department-FK's voor reminder/documentdoelen en tenant-consumerfuncties. |
| `packages/db/types.ts` | Gegenereerd na de actuele remote schemawijzigingen; niet handmatig modelleren. |

## Aangepaste services, routes en pagina's

| Pad | Scope-aanpassing |
|---|---|
| `apps/hr-suite/lib/master-data/service.ts` | Jobcatalogus tenant-owned; salary structures blijven administration-owned. |
| `apps/hr-suite/app/api/master-data/jobs/route.ts` en `apps/hr-suite/app/api/master-data/jobs/[jobId]/route.ts` | Bestaande job-API's gebruiken de tenantcatalogusservice. |
| `apps/hr-suite/components/master-data/job-catalog-manager.tsx` | Bestaand lijst-eerst jobcataloguspatroon blijft bron; geen parallel Talent-catalogus. |
| `apps/hr-suite/lib/star-performers/service.ts` | Jobs, revisions, groups en departments tenant; assessments administrationeel. |
| `apps/hr-suite/lib/organization/management-service.ts` en `apps/hr-suite/app/api/departments/route.ts` | Departments tenant; department-management en placements blijven administrationeel gekoppeld. |
| `apps/hr-suite/app/(dashboard)/departments/page.tsx` | Tenantbrede departmentweergave. |
| `apps/hr-suite/lib/organization-chart/service.ts` | Tenantcatalogi gecombineerd met administrationele placements. |
| `apps/hr-suite/lib/employment/employment-service.ts` en `apps/hr-suite/lib/employment/employment-detail-service.ts` | Organization options tenant; contract/cost/salary options administrationeel. |
| `apps/hr-suite/lib/hr-calendar/calendar-service.ts` | Department/job catalogus tenant; employment, holiday en remindercontext administrationeel. |
| `apps/hr-suite/lib/documents/document-service.ts`, `lib/reminders/reminder-service.ts`, `lib/hr-events/service.ts` | Tenant department-keuzes; document/reminder/event record blijft administrationeel. |
| `apps/hr-suite/lib/insights/*`, `lib/hera/read-tools.ts`, `lib/dashboard/widget-loaders.ts` | Tenant department lookups met behoud van administrationele employee-scope. |

## Bestaande UI- en securitypatronen

- Lijst-eerst beheer: `apps/hr-suite/components/master-data/job-catalog-manager.tsx`.
- Settings- en modalpatronen: `apps/hr-suite/app/(dashboard)/settings/page.tsx`, `apps/hr-suite/components/settings/` en `apps/hr-suite/components/layout/settings-modal.tsx`.
- Serverauth: `apps/hr-suite/lib/auth/permissions.ts` en `apps/hr-suite/lib/context/server-context.ts`.
- Supabase clients: `apps/hr-suite/lib/supabase/server.ts`, `client.ts` en expliciete `admin.ts`-workflows.
- RLS en databasefuncties: `internal_security.current_user_has_permission`, `can_manage_employee` en de policies op de tenantcatalogus.
- i18n: `apps/hr-suite/messages/nl/`, `messages/en/` en `apps/hr-suite/lib/i18n/server.ts`.

## Latere Talentgrenzen

De Blueprint-fasen voor modulegate, functieniveaus, competentiewoordenboek, functieprofielen, Workforce/self-readmodels en Talent-audit zijn in deze checkout aangesloten op `apps/hr-suite/lib/talent/`, `apps/hr-suite/app/api/talent/`, de drie Talent-pagina's en de zes tenant-owned Talent-migraties. De bestaande `jobs`, `job_groups`, `employees`, `employments`, departments, tags en audit blijven de bronnen; er is geen tweede persoon-, functie- of tagwereld. Performancecycli, succession, learning en AI blijven buiten deze Foundation-slice.
