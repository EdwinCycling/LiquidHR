# Talent data- en migratieplan

## Actuele update 2026-08-02

De remote testmigraties `20260802061126`, `20260802061857` en `20260802063946` zijn toegepast op project `wnpfloqpjvaacobppbpk`. Voor `Liquid HR Demo Holding` zijn 7 categorieën, 9 tags, 34 capabilities, 92 levelinhouden, 20 tagrelaties, 24 profieleisen, 6 actieve profielversies en 16 functieplaatsingen gecontroleerd. De hardening verwijdert de dubbele capability-index, voegt Talent-leesrechten samen in de bestaande tagpolicy en trekt publieke uitvoerrechten van interne Talent-triggerfuncties in.

## Doel en actuele status

Deze slice voert de algemene eigendomsregel en de Talent Foundation uit zonder een parallel domein: functies, functiegroepen, functierevisies en hun bestaande koppelingen zijn tenant-owned; een employment en de medewerkerplaatsing blijven administration-owned. Bestaande demo-ID's blijven behouden. De Talent-profiel-, competentie- en audituitbreiding is geïmplementeerd met de bestaande functies, employees, tags en auditbron.

## Vastgestelde uitgangsdata en resultaat

De remote inventarisatie op 31 juli 2026 bevatte 2 tenants, 4 administraties, 72 employees, 72 employments, 2 job_groups, 6 jobs, 1 job_group_jobs-rij, 1 job_revision, 16 employee_organizations met job_id en 2.560 audit_logs. De bestaande jobs, groepen, revisie en plaatsings-ID's zijn behouden. De tenantafdelingen zijn genormaliseerd en er is ÃƒÂ©ÃƒÂ©n expliciete administratie-afdeling `LEGAL-DEMO` toegevoegd voor de testmatrix; tenantafdelingen hebben `scope_type = 'TENANT'` en `administration_id = null`.

De oude `administration_id`-kolommen op jobs, job_groups, job_revisions en job_group_jobs zijn met de cleanupmigratie verwijderd. Er is geen parallelle compatibilitybron; `tenant_id` en tenant-FK's zijn de enige catalogusscope. Demo-relaties en IDs zijn hergebruikt.

## Uitgevoerde migraties

### `apps/hr-suite/supabase/migrations/20260731130502_align_tenant_owned_job_catalog_and_departments.sql`

- behoudt alle bestaande job-, group-, revision- en placement-ID's;
- normaliseert departments naar een expliciete tenant/administration scope en herstelt de samengevoegde demo-ROOT-koppelingen;
- voegt tenant-unieke sleutels en tenant-FK's toe voor jobs, groepen, revisies, de junction en employee-organizations;
- vervangt job/group/revision/junction RLS door permissionchecks met tenantcontext;
- laat `create_job_with_revision` uitsluitend de tenant-ID accepteren en valideert tenant-owned catalogusdata;
- verwijdert de oude administratiekolommen, indexes en constraints.

### `apps/hr-suite/supabase/migrations/20260731131136_align_star_performer_job_catalog_scope.sql`

- maakt de bestaande `upsert_star_performer_assessment`-validatie tenantbreed voor job en job group;
- laat assessment-records zelf administrationeel blijven, omdat de beoordeling aan een concrete administratiecontext gekoppeld is.

### `apps/hr-suite/supabase/migrations/20260731132359_align_tenant_department_consumers.sql`

- vervangt reminder-, document-audience- en reminder-rule-FK's naar departments door `(tenant_id, department_id)`;
- valideert HR-reminderdoelen op tenant-afdeling, terwijl reminder en administrationele permissioncontext behouden blijven;
- maakt employment-organisatiebeheer tenantbreed voor de gekozen department en job, maar behoudt administrationele employments en placements;
- past `can_manage_employee` en `list_employee_overviews` aan zodat de afdelingboom tenantbreed wordt gelezen en de employee-/employment-scope administrationeel blijft.

### Cleanup- en Talent-migraties

`20260731135658_remove_job_catalog_compatibility_and_seed_admin_department` verwijdert de oude administrationele compatibilitykolommen, maakt de ene tenant-functiegroeprelatie database-uniek en seedt de vaste demo-afdeling `LEGAL-DEMO` met `scope_type = 'ADMINISTRATION'`.

De migraties `20260731140701` tot en met `20260731143627` voegen de tenant-owned Talent Foundation, RLS, grants, audittriggers, modulegate, self-profile-RPC en profielinvarianten toe. Zij hergebruiken de zes bestaande jobs en job revisions voor idempotente Draft-profielen; er zijn geen nieuwe functies, employees of tags aangemaakt.

`20260731144246_enforce_talent_manager_read_scope` verwijdert de brede `talent:read`-toekenning uit `DIRECT_MANAGER`, begrenst managerlezingen tot actieve directe `employee_organizations` en laat volledige Talent-configuratie uitsluitend via `talent:manage` lopen.

## Afgeronde migratie en vervolgstappen

1. Gebruik de bestaande `jobs`, `job_groups`, `job_revisions`, `departments`, `employees`, `employments` en `employee_organizations`; maak geen tweede Talent- of personeelsbron.
2. Gebruik de Talent Foundation via de bestaande Settings-, Workforce- en My Talent-paden; managers krijgen alleen hun actieve directe scope en HR-beheer gebruikt `talent:manage`.
3. De Talent Blueprint-fundering is nu uitgevoerd volgens schema naar API naar UI: modulegate, levels, senioriteit, competenties, families, profielen, Workforce-readmodel en audit. Er zijn geen capability-, tag-, profiel- of employee-demo-rijen buiten de bestaande zes functieprofielen aangemaakt.
4. Een volgende migratie moet opnieuw types, advisors, tests en een poort-3000-controle opleveren. Een geauthenticeerde browser-smoketest is de eerstvolgende implementatie-/verificatiestap.

## Datakwaliteits- en securitygate

- Een job en job_group zijn binnen ÃƒÂ©ÃƒÂ©n tenant uniek op code en kunnen door meerdere administraties worden gebruikt via placements.
- Een department is tenant-owned tenzij een expliciete `scope_type = 'ADMINISTRATION'`-rij met verplichte administratie-FK wordt gebruikt; de huidige demo bevat `LEGAL-DEMO` als zo'n testrecord.
- Employment, salary, payroll, leave, absence, expenses, reminders en documenten behouden hun administrationele eigendom; tenant-owned department/job is alleen een referentie.
- RLS en serverservices moeten dezelfde scope afdwingen. Een actieve administrationcontext is geen eigendomsbewijs.
- De huidige jobcatalogus bevat nog ÃƒÂ©ÃƒÂ©n bestaande revisie; ontbrekende functienamen worden niet uit codes, groepen of voorbeelddata verzonnen. De zes bestaande jobs hebben wel een idempotent Draft-profiel gekregen met hun bestaande revisionrelatie; activatie blijft afhankelijk van echte profielinhoud.

## Verificatie

- Remote migratieregistratie bevat de ownership-, cleanup-, Talent- en covering-indexmigraties t/m `20260731150748_add_tenant_fk_covering_indexes`.
- `packages/db/types.ts` is na de laatste remote wijziging opnieuw gegenereerd.
- 111 testbestanden/410 tests, lint, i18n-check en build slagen; strict typecheck meldt alleen de bestaande `timeFormat`-fout in de reminder-modal. Advisors zijn opnieuw gecontroleerd.
- `/login` op de lokale server retourneerde na iedere migratie/codecheck HTTP 200. Authenticated browserverificatie blijft apart: in deze run was geen ingelogde browsersessie beschikbaar.
