# Entiteiteigendom en koppeling tussen tenant en administratie

**Status:** LEIDEND voor nieuwe en gewijzigde modules  
**Datum:** 31 juli 2026  
**Reikwijdte:** alle LiquidHR-domeinen, inclusief Talent

## Doel

Dit document legt vast waar een entiteit eigendom is en hoe tenantbrede bedrijfsdata wordt gekoppeld aan administratiegebonden juridische data. Een `tenant_id` is de absolute klant- en RLS-grens. Een `administration_id` is de juridische, fiscale en financiële grens binnen die tenant.

Ownership en access zijn verschillende begrippen:

- **Ownership scope** bepaalt waar de brondata wordt beheerd en welke tenantbrede betekenis zij heeft.
- **Access scope** bepaalt welke gebruiker of administratie de data mag lezen of wijzigen.
- De actieve administratiecookie is nooit een bewijs dat een entiteit administratie-eigendom is.

Een module mag niet zelf opnieuw bepalen dat een algemene catalogus administratiegebonden is. Zij gebruikt onderstaande matrix of legt vóór implementatie een expliciet ADR vast.

## Normatieve ownershipmatrix

### Tenantniveau: `tenant_id`

Deze entiteiten gelden over de administraties en juridische entiteiten binnen één tenant heen. Een medewerker die van BV wisselt, houdt dezelfde tenantbrede brondata.

| Domein | Tenant-eigendom |
|---|---|
| Persoon | `employees` en de persoonsidentiteit; één persoon kan meerdere dienstverbanden hebben. |
| Functiehuis | Functiefamilies, functiegroepen, functies, functieniveaus, senioriteiten en het competentie-/capabilitywoordenboek. |
| Talent | Talent Level Model, capabilities, categorieën, Cloud Tags-relaties, talent pools en opleidingscatalogus. |
| Performance | Beoordelingsformulieren, cyclusdefinities en herbruikbare performance-/developmenttemplates. |
| Organisatie | Bedrijfshiërarchie en afdelingen/divisies die niet exclusief aan één juridische entiteit zijn gekoppeld. |
| Centrale referenties | Tenantbrede moduleconfiguratie, tenantinstellingen, gedeelde tags en globale catalogusmetadata. |

Tenant-eigendom betekent niet dat iedere gebruiker automatisch mag lezen of wijzigen. Permissions, employee-managementscope, RLS en eventuele administrationele filter blijven verplicht.

### Administratieniveau: `tenant_id` + `administration_id`

Deze entiteiten horen bij één juridische, fiscale of financiële entiteit. Bij een overgang van een medewerker naar een andere BV ontstaat of wijzigt een administratiegebonden record.

| Domein | Administratie-eigendom |
|---|---|
| Juridisch/fiscaal | KvK, RSIN, loonheffingennummer, statutaire naam, bezoek-/factuuradres en juridische administratiegegevens. |
| Financieel | IBAN voor uitbetaling, kostenplaatsen, kostendragers, kostenallocatie en administratiegebonden financiële instellingen. |
| Arbeidsvoorwaarden | CAO-koppeling, pensioenuitvoerder/regelingen, bedrijfseigen regelingen en mobiliteitsbudgetten. |
| Employment | Het daadwerkelijke contract tussen persoon en administratie: start/eind, uren/FTE, proeftijd, concurrentiebeding en contractreeks. |
| Payroll | Brutosalaris, schaal/trede-inpassing, loonstroken, jaaropgaven, loonbeslagen en inkomen-/loonrelaties. |
| Verlof | Saldi, ledgermutaties en opbouwregels wanneer deze op de CAO of regeling van de administratie berusten. |
| Verzuim | Verzuimdossier, ziekteperioden, arbodienstkoppeling, casemanagement en WvP-verplichtingen. |
| Declaraties | Expense claims die voor boekhoudkundige verwerking bij de administratie worden ingediend. |
| Werkuitvoering | Dienstverbandroosters, werkpatronen, feestdagenkalenders en andere periodieke uitvoering die aan een werkgever is gebonden. |

Een administratiegebonden record draagt altijd een samengestelde tenant/admin-FK of erft deze aantoonbaar via een parent. Een `administration_id` mag niet leeg zijn als dat de enige scopecontrole zou zijn.

## Koppelentiteiten

De kernrelatie is:

```text
[Tenant]
  ├── Person / User (tenant-owned)
  ├── Job / Function (tenant-owned)
  └── Administration A (administration-owned)
        └── Employment ──> Person + Function
  └── Administration B (administration-owned)
        └── Employment ──> Person + Function
```

Een persoon is dus niet opnieuw aangemaakt wanneer die persoon voor een tweede administratie werkt. Jan Jansen heeft één `employees.id` en twee `employments.id`-records met verschillende `administration_id`-waarden. Iedere employment mag naar dezelfde tenant-owned functie verwijzen.

De bestaande LiquidHR-vertaling is:

- `public.employees`: persoon, tenant-owned;
- `public.employments`: employment, administration-owned;
- `public.employee_organizations`: administration-owned plaatsing/tijdlijn die naar een tenant-owned functie verwijst;
- `public.jobs`, `public.job_groups`, `public.job_revisions`: na de functiehuismigratie tenant-owned;
- `public.audit_logs`: centrale auditbron; de administratiekolom is context van het event, niet een tweede audit-eigendom.

## Grijs gebied: expliciete scopevariant, nooit impliciete null

Sommige entiteiten kunnen in de productcontext tenantbreed of administratiegebonden zijn. Dit wordt per record expliciet gemodelleerd:

| Entiteit | Regel |
|---|---|
| Afdeling/divisie | Standaard tenant-owned. Alleen een juridisch exclusieve afdeling krijgt expliciet `scope_type = 'ADMINISTRATION'` en een verplichte administratie-FK. |
| Bedrijfshiërarchie | Tenant-owned; een juridische entiteit blijft een afzonderlijke `administrations`-node. |
| Kostenplaats/kostendrager | De codecatalogus kan tenant-owned zijn; activatie, beschikbaarheid en boekhoudkundige mapping zijn administration-owned. |
| Functie-/capabilitytag | Bestaande Cloud Tags-catalogus tenant-owned; gebruiksrelatie wordt tenant-owned of via een administrationele read-scope gefilterd, nooit een tweede tagcatalogus. |
| Verlofcatalogus | De catalogus kan later een tenantbreed template zijn, maar effectieve regels en saldi blijven administration-owned totdat een expliciet besluit dat splitst. |

Een nullable `administration_id` zonder `scope_type`, constraint en policy is verboden als generiek multi-scope-mechanisme. Voor een gemengde tabel moet de database minstens afdwingen:

```text
scope_type = TENANT          -> administration_id IS NULL
scope_type = ADMINISTRATION  -> administration_id IS NOT NULL
```

De RLS-policy leest de scopevariant en controleert daarna tenant- of administratie-toegang. Parent- of holdingrelaties geven geen automatische overerving van stamdata.

## Bestaande code die moet worden aangepast

### Functiehuis en Talent

De huidige implementatie wijkt af van deze norm:

- `apps/hr-suite/supabase/migrations/20260718100000_add_job_catalog_salary_revisions.sql` maakt `job_groups`, `jobs` en `job_revisions` administratiegebonden;
- `apps/hr-suite/supabase/migrations/20260726093311_custom_fields_and_job_catalog_management.sql` maakt een administratiegebonden `job_group_jobs`-junction;
- `apps/hr-suite/lib/master-data/service.ts` filtert alle functiedata op `context.administrationId`;
- `apps/hr-suite/app/api/master-data/jobs/route.ts` en `[jobId]/route.ts` gebruiken administratie als catalogusscope;
- `apps/hr-suite/components/master-data/job-catalog-manager.tsx` toont de catalogus als administratie-instelling;
- `apps/hr-suite/lib/star-performers/service.ts` leest jobs en groepen administratiegebonden;
- `apps/hr-suite/lib/organization/management-service.ts` en employee-organizationroutes koppelen plaatsingen administratiegebonden, maar moeten de functie-FK tenantbreed valideren.

De aanpassing is geen tweede Talent-functietabel. De bestaande job-ID's blijven behouden; de migratie maakt `jobs`, `job_groups`, `job_revisions` en familie/profielcatalogus tenant-owned, normaliseert de bestaande records en koppelt iedere employment/plaatsing via `tenant_id + job_id`. De actieve administratie blijft de scope voor de plaatsing, niet voor de functie-eigendom.

### Organisatie

`apps/hr-suite/lib/organization/management-service.ts` en `apps/hr-suite/app/api/departments/route.ts` filteren afdelingen momenteel op de actieve administratie. Dit moet worden gesplitst:

1. tenantbrede afdelingen/divisies worden vanuit tenantcontext beheerd en zijn in meerdere administraties bruikbaar;
2. juridisch exclusieve afdelingen krijgen expliciete administrationele scope;
3. `department_management` en `employee_organizations` blijven administrationele koppelingen wanneer zij een concrete employment/werkgever beschrijven;
4. manager- en rapportagequeries combineren tenant-owned departmentdata met administrationele plaatsingsdata.

### Administrationele modules

De huidige code volgt voor de volgende domeinen al grotendeels de gewenste administrationele eigendom en moet dit behouden:

- `public.employments` en `public.employment_contracts` in `apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql` en `20260729084046_restructure_employment_contracts.sql`;
- salaristijdlijnen, loonrelaties, roosters, kosten en CAO/arbeidsvoorwaarden in dezelfde employmentmigraties;
- `public.absence_settings`, `absence_cases` en `absence_spells` in `20260726150000_add_absence_core.sql`;
- verlof- en werkurenconfiguratie in `20260722142551_add_leave_engine_foundation.sql` en `20260718121308_add_settings_modules_work_patterns_holidays.sql`;
- administratiegebonden modules, feestdagen en werkpatronen in `apps/hr-suite/lib/modules/`, `lib/leave/` en `lib/absence/`.

De codechecks moeten voortaan aantonen dat tenant-owned catalogi niet onbedoeld door de administratiecookie worden weggefilterd, en dat administratie-owned transacties nooit door tenantbrede catalogustoegang worden opengezet.

## Verplichte implementatieregels voor iedere nieuwe module

1. Voeg in het requirementsdocument vóór schemaontwerp een ownershipregel toe: tenant, administratie of expliciete scopevariant.
2. Benoem de koppeling tussen persoon, tenant-catalogus en administratie-transactie.
3. Ontwerp samengestelde FKs en RLS voor de gekozen eigenaar; vertrouw geen client-ID.
4. Scheid cataloguspermission van transactionele administratiepermission wanneer de eigendom verschilt.
5. Gebruik de actieve administratie alleen waar het gedrag juridisch/operationeel administratiegebonden is.
6. Test minstens: twee administraties in dezelfde tenant, één persoon met twee employments, gedeelde tenantfunctie, administrationele contract-/salary-/leave-data en cross-tenant denial.
7. Migreer bestaande administratiegebonden tabellen naar tenant-eigendom alleen met behoud van IDs, expliciete conflictregels, dry-runrapport en backwards-compatible API-rollout.
8. Documenteer codepaden en afwijkingen in `docs/delivery/IMPLEMENTATION_STATUS.md` en de actuele handoff.

## Releasegate

Een module is niet klaar wanneer ownership alleen in UI of routecode is geregeld. De schema-constraints, RLS, API/servicecontext, tests, gegenereerde DB-types, advisorcontrole en een twee-administratie browser-/API-flow moeten dezelfde ownershipbeslissing bewijzen.

## Testfase: geen compatibilitylaag voor de oude scope

In de huidige LiquidHR-testfase zijn alle databasegegevens demo-data. Bij een ownershipcorrectie mogen de oude, foutieve scopekolommen, filters en tijdelijke RPC-signatures worden verwijderd zodra bestaande demo-relaties aantoonbaar zijn genormaliseerd. Houd geen parallelle functiecatalogus of writeable compatibilitylaag in stand. Hergebruik bestaande IDs en relaties waar de semantiek klopt; pas demo-waarden aan of voeg een expliciet demo-record toe wanneer dat nodig is om tenant- en administratie-scope samen te testen. Iedere verwijdering staat in een versiebeheerbare migratie en wordt gevolgd door typegeneratie, advisors, relevante tests en een lokale browsercontrole op poort 3000.
