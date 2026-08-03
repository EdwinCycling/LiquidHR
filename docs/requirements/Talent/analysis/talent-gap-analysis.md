# Talent-gap-analyse

## Uitgangspunt

De Product Blueprint definieert het gedrag. Mockups, bestaande WIP-tegels en oudere Liquid Display-voorbeelden leveren geen aanvullende productregels. De fase-1-scope blijft: configuratie, capabilitybibliotheek, functiehuis en profielversies, Workforce-inzage, Mijn Talent, autorisatie, audit en migratie.

## Capabilitymatrix

| Blueprint-capability | Huidige toestand met bewijs | Gap | Besluit voor implementatie |
|---|---|---|---|
| Tenant/module-gating | `lib/modules/module-catalog.ts`, `tenant_modules` en Talent-pagina's zijn aangesloten | Geen resterende codegap in de Foundation | `TALENT` blijft togglebaar; pagina's en API's controleren module plus permission.
| Rechtenmodel | `lib/auth/permissions.ts` en RLS-helpers bestaan; Talent-permissions zijn seeded | Managerscope moet smaller zijn dan tenantbeheer | Gebruik `talent:manage` voor configuratie, `talent:manager-read` voor actieve directe manager-scope, `talent:read` voor expliciete cataloguslezing en `self:talent:read` voor Mijn Talent. |
| Functiegroepen | `public.job_groups` en jobcatalogus-UI bestaan; `jobs.job_group_id` is verplicht | Oude administrationele kolommen en brede M:N-bron zijn verwijderd | Behoud `job_groups`, tenant-owned, en dwing exact Ã©Ã©n bestaande job-grouprelatie af. |
| Functies | `public.jobs`, `job_revisions` en `employee_organizations.job_id` bestaan | Geen senioriteitsniveau, profielstatus, unieke naam+senioriteit en tenant-owned bron | Breid de bestaande functiebron uit; migreer eigendom naar tenant en maak geen tweede functie-entiteit. |
| Senioriteitsniveaus | `public.talent_seniorities`, `jobs.seniority_id` en Settings-service bestaan | Inhoudelijke catalogus kan nog leeg zijn in demo | Bestaande tabel en job-FK blijven bron; geen tweede senioriteitsobject.
| Functiefamilies | `public.job_families` en `job_groups.job_family_id` bestaan | Demo-catalogus bevat nog geen familie | Behoud de optionele tenantbron; maak geen tweede familie-entiteit. |
| Schaalmodel | Geen Capability-schaalmodel | Volledig ontbrekend | Maak Ã©Ã©n tenantmodel met geordende `talent_levels`; structureel vergrendeld na eerste gebruik. |
| CapabilitycategorieÃ«n | Geen bestaande catalogus | Volledig ontbrekend | Voeg tenantbrede categorieÃ«n toe; lijst-eerst beheer. |
| Capabilities | Geen generieke capability-entiteit | Volledig ontbrekend | Voeg tenantbrede capabilities toe met type `SKILL`, `KNOWLEDGE`, `CERTIFICATE` en niveaubeschrijvingen. |
| Cloud Tags | `public.star_performer_tags` bestaat | Alleen star-performerrelaties en eigen permission | Hergebruik dezelfde tag-IDs; voeg Talent-relaties en Talent-leesbeleid toe, geen tweede tagcatalogus. |
| Functieprofiel | `public.job_profiles` en `job_profile_versions` bestaan naast `job_revisions` | Demo-profielen zijn Draft en inhoudelijk minimaal | Behoud 1:1 `job_profiles` per bestaande job; activeer alleen echte profielinhoud. |
| Concept/actief-historie | `job_profile_versions` en `activate_job_profile_version` bestaan | Demo bevat alleen Draft-profielen; actieve inhoud ontbreekt | Draft/active/inactive-invarianten en atomische activatie blijven leidend.
| Capabilityvereisten | Niet aanwezig | Volledig ontbrekend | Koppel profielversie, capability en vereist niveau; unieke combinatie per versie. |
| Tijdlijnreconstructie | `job_revisions` gebruikt halfopen perioden | Geen volledige profielhistorie | Gebruik eveneens `[valid_from, valid_until)` en sluit overlap in de database uit. |
| Workforce-profiel | `/workforce/talent` en `talent_job_profile_readmodel` bestaan | Authenticated browserbewijs ontbreekt | Managerquery blijft beperkt tot actieve directe placements.
| Mijn Talent | `/my-talent`, `/api/talent/my` en secure RPC bestaan | Authenticated browserbewijs ontbreekt | Employee-ID uitsluitend uit authcontext.
| Audit | Talent-tabellen hebben bestaande `audit_hr_change`-triggers | Correlation/source-channel zijn niet apart uitgebreid in deze slice | Geen tweede auditstroom; bestaande auditbron hergebruiken.
| Import/export | Geen Talent-import | Blueprint sluit dit uit in fase 1 | Geen implementatie. |
| AI-inhoud | HeRa bestaat, maar Talent-AI is buiten fase 1 | Geen gap binnen scope | Geen AI-generatie of inferentie toevoegen. |

## Oorspronkelijke conflicten en huidige oplossing

### 1. EÃ©n functiegroep versus meerdere groepen

`lib/master-data/schemas.ts`, `lib/master-data/service.ts` en `components/master-data/job-catalog-manager.tsx` behandelen `jobGroupIds` nu als exact Ã©Ã©n waarde. De Blueprint staat exact Ã©Ã©n groep toe. De directe, verplichte `jobs.job_group_id` is de enige domeinbron. `job_group_jobs` blijft alleen als bestaande relationele tabel bestaan, met een tenant-unieke jobrelatie; er is geen writeable backwards-compatibilitylaag.

### 2. Tenantbegrip versus administratiegebonden uitvoering

De nieuwe ownershipregel maakt `jobs`, `job_groups`, `job_revisions`, families en profielen tenant-owned. De bestaande administrationele opslag is migratiedrift. `employments` en `employee_organizations` blijven administration-owned koppelingen naar dezelfde tenantfunctie; de actieve administratie bepaalt uitvoering en toegang, niet functie-eigendom.

### 3. Huidige functierevisies zijn geen profielversies

`job_revisions` heeft alleen `name`, `description`, `valid_from` en `valid_until`. Dit blijft de bron voor functielabels. Een Talent-profielversie heeft andere invarianties en eigen requirements; die wordt gekoppeld aan dezelfde `jobs.id`, niet in `job_revisions` gepropt.

### 4. In-place wijzigen van functierevisie

`lib/master-data/service.ts` wijzigt de laatste functierevisie in-place. Dat is onvoldoende voor een historisch reconstrueerbare naam. De Talent-slice verandert dit gedrag naar het sluiten en toevoegen van functierevisies wanneer naam/omschrijving ingaat; bestaande IDs en relaties blijven behouden.

### 5. Cloud Tags-permission is star-performer-specifiek

`star_performer_tags` is tenantbreed maar RLS vereist `star-performer:read/write`. Talent mag geen tweede catalogus bouwen. Een aanvullende selectpolicy voor bestaande catalogusrechten en expliciete Talent-lezers maakt dezelfde tags zichtbaar via toegestane Talent-relaties; tagbeheer blijft onder de bestaande `star-performer:write`-bevoegdheid.

### 6. Auditcontract is te smal

`audit_logs.action` accepteert in de bestaande auditarchitectuur CREATE, UPDATE, ARCHIVE, DELETE en REVEAL. De Talent Foundation gebruikt die bestaande audittriggers; activatie/deactivatie, denied-events en correlation/source-channel zijn Blueprint-gaps voor een afzonderlijke vervolgslice en zijn niet als geïmplementeerd gedrag geclaimd.

### 7. Modulecatalogus en routegate

`lib/modules/module-catalog.ts` en de Settings-modulepagina kennen `TALENT` nu als beschikbaar togglebaar modulecode. Zonder activering geven pagina's geen menu-ingang en routes geen geautoriseerde toegang.

### 8. Bestaande 9-grid is buiten scope

`app/(dashboard)/workforce/page.tsx` toont 9-grid als WIP. Dit is geen halfgebouwd Talent-profiel; de aparte Talent-navigatie en `/workforce/talent` blijven read-only Foundation-inzage en activeren geen 9-gridlogica.

## Datagaps op de huidige remote omgeving

De actuele remote meting bevat 2 tenants, 4 administraties, 72 employees, 72 employments, 2 job groups, 6 jobs, 1 job revision, 16 plaatsingen met job-ID, 2 levelmodellen, 8 levels, 6 senioriteiten, 6 Draft-profielen en 6 readmodelrijen. Families en capabilities zijn bewust nog lege catalogi; er zijn geen nieuwe demo-employees, functies of tags aangemaakt.

De zes bestaande functies zijn niet vervangen en kregen idempotente Draft-profielen die naar de bestaande jobs en revisions verwijzen. Activatie vereist echte profielinhoud; synthetische namen of capabilities worden niet verzonnen.

## Niet bouwen

Fase 1 bevat geen performancecyclus, 9-gridlogica, succession planning, learning marketplace, AI-content, bulkimport/export, geavanceerde analytics of parallelle employee/function/tag/auditmodellen. Deze uitsluitingen komen rechtstreeks uit de Blueprint en zijn geen uitgestelde technische keuzes.
