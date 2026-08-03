# Talent technisch ontwerp

## Ontwerpprincipes

1. Bestaande `employees`, `employments`, `employee_organizations`, `jobs`, `job_groups`, `job_revisions`, `star_performer_tags` en `audit_logs` blijven de canonieke objecten.
2. `jobs`, `job_groups`, `job_revisions`, families en profielen zijn tenant-owned; `employments` en `employee_organizations` blijven administration-owned koppelingen.
3. Iedere verticale slice volgt `schema Ã¢â€ â€™ API-route/service Ã¢â€ â€™ UI`.
4. Server-side permissionchecks en RLS gelden beide; tenant- en administratie-IDs komen uit de actieve context waar de eigendom/access-scope dat vereist.
5. Actieve versies zijn immutable. Een wijziging ontstaat als nieuwe conceptversie.
6. Datums zijn ISO-datums met halfopen geldigheid `[valid_from, valid_until)`.
7. De implementatie voegt geen productgedrag toe buiten de Blueprint.

## Domeinmodel

### Bestaande tabellen die zijn uitgebreid

`public.jobs`

- `seniority_id` verwijst tenant-scoped naar `talent_seniorities`;
- `job_group_id` blijft verplicht en canoniek;
- de oude administrationele compatibilitykolommen zijn verwijderd.

`public.job_groups`

- `job_family_id` verwijst tenant-scoped naar `job_families`;
- de groep blijft tenant-owned en kan door meerdere administrationele placements worden gebruikt.

`public.job_group_jobs`

- blijft als bestaande relationele tabel behouden voor bestaande consumers;
- een tenant-unieke `job_id`-index verhindert meerdere groepen per functie;
- nieuwe servicewrites gebruiken het ene `jobs.job_group_id`-contract.

`public.audit_logs`

- blijft de enige auditbron;
- Talent-tabellen gebruiken de bestaande `internal_security.audit_hr_change()`-trigger zonder tweede auditmodel;
- de administratiecontext blijft optioneel en bepaalt geen tenant-owned Talent-eigendom.

### Nieuwe tenantbrede configuratietabellen

`talent_level_models`: tenant-level modellen met code, naam, status en locktijd; maximaal Ã©Ã©n actief model per tenant wordt door een unieke index/invariant afgedwongen.

`talent_levels`: tenant- en modelgebonden niveaus met code, naam en sorteerorde; model- en levelwijzigingen worden gelockt zodra requirements het model gebruiken.

`talent_seniorities`: tenantbrede senioriteiten met code, naam, status en sorteerorde.

`job_families`: optionele tenantbrede families die via `job_groups.job_family_id` worden hergebruikt.

`talent_categories`, `talent_capabilities` en `talent_capability_level_content`: tenantbrede categorieÃ«n, competenties/skills/kennis/talen/certificaten en niveau-indicatoren met samengestelde tenant-FK's.

### Profieltabellen

`job_profiles`: exact Ã©Ã©n logisch profiel per bestaande tenant-owned functie via unieke `(tenant_id, job_id)`.

`job_profile_versions`: oplopende versies met `DRAFT`, `ACTIVE` of `INACTIVE`, inhoudsvelden en geldigheidsdatums. De activatie-RPC sluit eerdere actieve versies atomair af; databaseguards beschermen structurele invarianten.

`job_profile_capability_requirements`: profielversie-competentievereisten met required/preferred, doel-niveau en volgorde; uniek per profielversie en capability.

`talent_job_profile_readmodel`: security-invoker view die bestaande jobs, groepen, families, senioriteiten en actieve profielversies samenbrengt; manager-RLS beperkt de zichtbare rijen tot actieve directe placements.

Er is in deze slice geen tweede tagcatalogus of `talent_tag_relations`-tabel toegevoegd. Bestaande `star_performer_tags` blijft de herbruikbare tenantbron; relaties worden pas toegevoegd wanneer de Blueprint-scope dat vereist.
## Naam- en senioriteitsuniciteit

Een huidige functienaam staat in `job_revisions`. De databasefunctie `internal_security.normalize_catalog_name(text)` gebruikt `lower(regexp_replace(btrim(value), '\s+', ' ', 'g'))`. Triggers op `job_revisions` onderhouden `jobs.normalized_current_name`. Een unieke index met `nulls not distinct` op scope+naam+senioriteit voorkomt de Blueprint-duplicatie binnen het bestaande functieobject; een functie zonder geldige naam blijft door de migratie-issueview geblokkeerd voor profielactivatie.

## Versieactivatie

De uniqueness-scope van de functie-identiteit is tenant + functienaam + optionele senioriteit; administratie is geen onderdeel van de functie-eigendom.

`public.activate_job_profile_version(requested_tenant_id uuid, requested_version_id uuid)` is de tenant-scoped activatie-RPC. De service controleert `talent:manage` en de module; de RPC sluit eerdere actieve versies atomair af en retourneert de geactiveerde versie-ID. Status- en levelinvarianten worden door databaseguards afgedwongen.

## Services en API-contracten

Alle routes gebruiken Zod, `requirePermission()` en een `requireTalentModule()`-helper. Responses bevatten `{ data }`; bekende domeinfouten krijgen stabiele codes en gelokaliseerde UI-tekst.

| Route | Permission | Huidig gedrag |
|---|---|---|
| `/api/talent` | `talent:manage` | Leest de volledige tenantbrede Foundation voor Settings/API-beheer. |
| `/api/talent/seniorities` | `talent:manage` | Voegt tenant-senioriteit toe. |
| `/api/talent/capabilities` | `talent:manage` | Voegt tenant-capability toe. |
| `/api/talent/job-families` | `talent:manage` | Voegt tenant-job family toe. |
| `/api/talent/job-profiles` | `talent:manage` | Maakt één Draft-profiel voor een bestaande job. |
| `/api/talent/profile-versions/[versionId]` | `talent:manage` | Wijzigt een Draft en activeert via de atomische RPC. |
| `/api/talent/my` | `self:talent:read` | Leest uitsluitend het eigen actieve profiel via authcontext. |

De services staan onder `apps/hr-suite/lib/talent/` en gebruiken de bestaande server-Supabaseclient. Zij geven nooit tenant-ID, actor-ID of employee-ID uit de requestbody door als bron van waarheid.

## Readmodellen

- Workforce resolveert functie via de actuele `employee_organizations.job_id`, vervolgens de profielversie die op de peildatum geldig is.
- Mijn Talent resolveert eerst `AuthContext.employeeId`. Zonder gekoppelde employee ontstaat een gelokaliseerde lege toestand, geen zoekmogelijkheid.
- Functienaam komt uit de geldige `job_revisions`-rij; `job_title` is alleen een legacy fallback in migratierapportage, niet in het definitieve profielreadmodel.
- Zoekresultaten zijn gepagineerd, standaard 50, maximum 100; filters draaien server-side.
- Managers zien alleen jobs/profielen met een actieve `employee_organizations`-rij waarin `direct_manager_id = current_employee_id()` staat. Tenant Admin gebruikt `talent:manage` voor de volledige tenantcatalogus.

## UI-integratie

- Settings krijgt een Talent-sectie onder `app/(dashboard)/settings/talent/` met lijst-eerst schermen en bestaande header/accordion/modalpatronen.
- Workforce krijgt `app/(dashboard)/workforce/talent/` voor profielzoeker en detail.
- Mijn Talent komt op `app/(dashboard)/my-talent/page.tsx`; de route gebruikt uitsluitend selfcontext.
- `components/layout/sidebar.tsx` en dashboardlayout tonen ingangen alleen bij module+permission.
- Alle teksten komen uit nieuwe `messages/nl/talent.json` en `messages/en/talent.json` met sleutelpariteit.
- Keuzes voor groep, familie, capability, niveau en tags zijn zoekbare toegankelijke keuzecomponenten, geen vrije ID-velden.

## Modulegedrag

`TALENT` staat geregistreerd in `ToggleableModuleCode` en aan `public.tenant_modules`. Nieuwe tenants krijgen Talent niet impliciet actief; activering gebeurt via het bestaande Settings-modulescherm door een bevoegde gebruiker. Bestaande tenants behouden hun huidige moduletoestand. Pagina, API en RLS helper controleren dezelfde modulebron zodat alleen menuverbergen nooit als beveiliging geldt.

## Foutcontract

De vaste domeincodes zijn: `TALENT_MODULE_DISABLED`, `TALENT_FORBIDDEN`, `LEVEL_MODEL_LOCKED`, `LEVEL_IN_USE`, `CAPABILITY_IN_USE`, `JOB_PROFILE_NOT_FOUND`, `PROFILE_VERSION_NOT_DRAFT`, `PROFILE_ACTIVATION_OVERLAP`, `PROFILE_REQUIREMENTS_INVALID`, `JOB_GROUP_REQUIRED`, `DUPLICATE_JOB_IDENTITY` en `MISSING_CANONICAL_JOB_NAME`. NL/EN-teksten staan uitsluitend in de Talent-namespace.

