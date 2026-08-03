# Repositoryanalyse LiquidHR Talent

## Onderzoeksbasis

Deze analyse is gestart op `main` op commit `d9baecb54cf6a52e8a573c34847bcb6f2ed1d140` op 31 juli 2026. Tijdens de ownershipslice zijn drie append-only Supabase-migraties en bestaande consumers aangepast; er is niet gedeployed of gecommit. De Product Blueprint `docs/requirements/Talent/01-LiquidHR-Workforce-Talent-Product-Blueprint-v2.0.md` is leidend. De overige Talent-documenten, `AGENTS.md`, `docs/README.md`, `docs/delivery/CURRENT_CONTEXT.md`, de vijf architectuurdocumenten en de relevante domeindocumenten zijn volledig gelezen.

In de repository bestaan geen rootbestanden `README.md` en `CONTRIBUTING.md`. Het feitelijke documentatie-ingangspunt is `docs/README.md`; ontwikkelregels staan in `AGENTS.md`. Er is geen `.github/`-workflow aanwezig. Dit is een feitelijke afwezigheid, geen Talent-failure.

## Technische stack

| Onderdeel | Repositorybron | Vastgestelde versie of keuze |
|---|---|---|
| Monorepo | `package.json`, `package-lock.json` | npm workspaces; lockfileversie 3 |
| Runtime | lokale baseline | Node.js `22.14.0`, npm `10.9.2` |
| Webframework | `apps/hr-suite/package.json`, `apps/hr-suite/next.config.ts` | Next.js `16.2.12`, App Router, React `19.2.7` |
| Taal | `apps/hr-suite/tsconfig.json` | TypeScript `5.9.3`, `strict: true`, `noEmit: true` |
| Styling | `apps/hr-suite/app/globals.css`, `apps/hr-suite/postcss.config.mjs` | Tailwind CSS `4.3.2`, CSS-variabelen |
| Databaseclient | `apps/hr-suite/lib/supabase/*.ts` | `@supabase/ssr 0.12.0`, `@supabase/supabase-js 2.110.2` |
| Validatie | `apps/hr-suite/package.json` | Zod `4.4.3` |
| Tests | `apps/hr-suite/vitest.config.ts` | Vitest `4.1.10`, Node-omgeving |
| Database | `apps/hr-suite/supabase/migrations/`, remote read-only inspectie | Supabase/PostgreSQL 17.6, regio `eu-west-3` |

`react`, `react-dom`, TypeScript, Tailwind en Supabase staan deels als `latest` in `apps/hr-suite/package.json`; de tabel vermeldt de werkelijk geÃ¯nstalleerde lockfileversies. Er zijn tijdens deze analyse geen dependencies geÃ¯nstalleerd of bijgewerkt.

## Architectuur en modulegrenzen

- Pagina's staan onder `apps/hr-suite/app/(dashboard)/`; API-routes onder `apps/hr-suite/app/api/`.
- Server Components laden initiÃ«le data; interactieve beheerschermen gebruiken clientcomponenten die eigen API-routes aanroepen. Voorbeelden zijn `apps/hr-suite/app/(dashboard)/master-data/jobs/page.tsx`, `apps/hr-suite/components/master-data/job-catalog-manager.tsx` en `apps/hr-suite/app/api/master-data/jobs/route.ts`.
- Domeinlogica staat per onderwerp onder `apps/hr-suite/lib/`, onder andere `lib/master-data`, `lib/employment`, `lib/organization`, `lib/star-performers`, `lib/modules` en `lib/auth`.
- Supabase-migraties zijn append-only onder `apps/hr-suite/supabase/migrations/`; gegenereerde databasetypen staan in `packages/db/types.ts`.
- Zichtbare tekst staat per namespace in `apps/hr-suite/messages/nl/` en `apps/hr-suite/messages/en/`. `apps/hr-suite/lib/i18n/server.ts` registreert de namespaces.
- De repository gebruikt geen React Query of SWR. Tenant- en administratiescope worden server-side afgeleid, niet uit clientpayloads vertrouwd.

## Authenticatie, context en autorisatie

`apps/hr-suite/lib/auth/permissions.ts` gebruikt Supabase `getClaims()`, laadt daarna de actieve context via `apps/hr-suite/lib/context/server-context.ts` en levert een `AuthContext` met `tenantId`, `administrationId`, `userId`, `employeeId`, rollen en permissions. `requirePermission()` is de centrale server-side poort. Sinds `20260724103939_simplify_roles_and_insights_events.sql` zijn de canonieke rollen `TENANT_ADMIN` (weergavenaam HR Admin), `DIRECT_MANAGER` en `EMPLOYEE`; oudere migraties die nog `HR_ADMIN` noemen leveren in de actuele rolset geen toekenning op.

De context ondersteunt `SEPARATE` en `COMBINED` via `apps/hr-suite/lib/context/administration-context.ts`. De actieve administratie is een UX- en querycontext; de echte beveiliging komt uit serverchecks en RLS. SQL-functies als `internal_security.current_user_has_permission(...)` en `internal_security.can_manage_employee(...)` vormen de databasegrens. Rolnamen mogen daarom niet in Talent-code worden hardgecodeerd.

Supabaseclients zijn gescheiden:

- `apps/hr-suite/lib/supabase/server.ts`: cookiegebonden serverclient;
- `apps/hr-suite/lib/supabase/client.ts`: browserclient;
- `apps/hr-suite/lib/supabase/admin.ts`: `server-only` service-roleclient voor expliciete verhoogde workflows.

## Bestaande domeinobjecten die Talent moet hergebruiken

| Productbegrip | Bestaande bron | Betekenis voor Talent |
|---|---|---|
| Medewerker | `public.employees`; `apps/hr-suite/lib/employees/` | Canonieke persoon; geen Talent-medewerkertabel maken. |
| Arbeidsrelatie | `public.employments`; `apps/hr-suite/lib/employment/` | Canonieke dienstverbandcontext; `seniority_date` betekent anciÃ«nniteit, niet functieniveau. |
| Organisatieplaatsing | `public.employee_organizations` | Koppelt medewerker aan afdeling, managercontext en `job_id`; dit bepaalt het actuele functieprofiel. |
| Functie | `public.jobs` en `public.job_revisions` | Canonieke functie-ID en tijdgebonden naam/omschrijving; niet dupliceren als Talent-job. |
| Functiegroep | `public.job_groups` | Canonieke groep; het bestaande M:N-hulpmiddel `job_group_jobs` moet naar exact Ã©Ã©n groep worden begrensd. |
| Tags | `public.star_performer_tags` | Bestaande tenantbrede Cloud Tags-catalogus; Talent legt relaties naar deze IDs en maakt geen tweede tagcatalogus. |
| Audit | `public.audit_logs`, `internal_security.audit_hr_change()` | Bestaande auditstroom uitbreiden; geen parallel Talent-auditlog. |
| Rollen/permissions | `public.management_roles`, `permissions`, `role_permissions` | Bestaande permission-resolutie uitbreiden met canonieke Talent-permissions. |
| Modulecatalogus | `apps/hr-suite/lib/modules/module-catalog.ts`, `public.tenant_modules` | Bestaande feature/module-gating uitbreiden met `TALENT`; geen tweede flagsysteem. |

## Huidige functiecatalogus

`apps/hr-suite/supabase/migrations/20260718100000_add_job_catalog_salary_revisions.sql` maakt `job_groups`, `jobs` en `job_revisions` administratiegebonden. `jobs.job_group_id` is verplicht. De latere migratie `20260726093311_custom_fields_and_job_catalog_management.sql` voegt echter `job_group_jobs` toe en `create_job_with_revision(...)` accepteert meerdere `jobGroupIds`.

De meervoudigheid loopt door in:

- `apps/hr-suite/lib/master-data/schemas.ts`: array van 1 tot 50 groepen;
- `apps/hr-suite/lib/master-data/service.ts`: lezen, verwijderen en opnieuw invoegen van meerdere relaties;
- `apps/hr-suite/components/master-data/job-catalog-manager.tsx`: meervoudige groepsselectie.

De Blueprint vereist exact één functiegroep. `jobs.job_group_id` blijft daarom de canonieke relatie. De cleanupmigratie verwijdert de oude administrationele compatibilitykolommen en maakt de bestaande `job_group_jobs`-relatie tenant-uniek; er is geen tweede writeable catalogus.

De remote read-only inventarisatie vond 6 functies, 2 functiegroepen, 1 `job_group_jobs`-rij, 1 `job_revisions`-rij en 16 actieve organisatieplaatsingen met `job_id`. Geen functie heeft meer dan Ã©Ã©n groepsrelatie. Vijf bestaande functies hebben wel een directe `job_group_id`, maar geen relationele rij en geen revisie. Dit is migratiedrift die vÃ³Ã³r profielactivatie deterministisch moet worden hersteld.

De nieuwe algemene ownershipregel in `docs/requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md` maakt het onderscheid expliciet: functies en groepen worden tenant-owned; `employee_organizations` en `employments` blijven administration-owned koppelingen. De huidige administratiefilters in `lib/master-data/service.ts`, de job-API's en de Star Performer-projectie moeten daarom worden gesplitst in tenantcatalogusqueries en administrationele plaatsingsqueries.

## Bestaande UI-patronen

- Settings-ingang: `apps/hr-suite/app/(dashboard)/settings/page.tsx`, `apps/hr-suite/components/settings/admin-settings-page-header.tsx` en `apps/hr-suite/components/settings/settings-accordion.tsx`.
- Lijst-eerst beheer: `apps/hr-suite/components/master-data/job-catalog-manager.tsx` met zoeken, sorteren, statusfilter en modalacties.
- Workforce-ingang: `apps/hr-suite/app/(dashboard)/workforce/page.tsx`. Functioneringsgesprekken zijn zichtbaar; 9-grid en opvolgingsplanning zijn bewust WIP en blijven buiten Talent fase 1.
- Medewerkerdashboard: `apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx` laadt per tab alleen benodigde projecties.
- Navigatie en autorisatie: `apps/hr-suite/components/layout/sidebar.tsx` en `apps/hr-suite/app/(dashboard)/layout.tsx`.
- Modalpatroon: `apps/hr-suite/components/layout/settings-modal.tsx`; keuzecomponent met zoekfunctie: `apps/hr-suite/components/ui/country-picker.tsx`.
- Design tokens: `apps/hr-suite/app/globals.css`; bestaande klassen zijn onder andere `button-primary`, `button-secondary`, `status-chip`, `eyebrow` en `form-field`.

Er is geen brede, zelfstandige UI-componentbibliotheek. De ownershipslice hergebruikt de genoemde patronen en CSS-variabelen; er is geen nieuwe UI gebouwd. Een generieke toegankelijke entiteitskiezer mag later uit het bestaande pickerpatroon worden geÃ«xtraheerd, maar er wordt geen parallel design system gebouwd.

## Bestaande en uitgevoerde Talent-functionaliteit

De Talent Foundation staat nu in `apps/hr-suite/lib/talent/service.ts`, `apps/hr-suite/components/talent/talent-foundation-manager.tsx`, de routes onder `apps/hr-suite/app/api/talent/` en de pagina's `/settings/talent`, `/workforce/talent` en `/my-talent`. De databaseobjecten staan in migraties `20260731140701` tot en met `20260731144246`, inclusief levels, senioriteiten, families, categorieën, capabilities, profielversies, readmodel, self-profile-RPC, invarianten en manager-RLS. De zes bestaande demo-jobs zijn hergebruikt voor Draft-profielen; er zijn geen nieuwe employees, functies of tags aangemaakt.

De bestaande Star Performer-code blijft `star_performer_tags`, assessments en administratiecontext gebruiken. 9-grid, performancecycli, succession, learning marketplace en Talent-AI zijn bewust buiten deze Foundation-slice gehouden.

