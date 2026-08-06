# Uitvoeringsplan voor Luna — HR-groepen, administraties, verlof en verzuim

Status: **STAP 1 T/M 9 FUNCTIONEEL UITGEVOERD; INTEGRALE EINDVERIFICATIE AFGEROND**
Datum: **2026-08-05**
Repository: LiquidHR
Doel: de bestaande testdatabase en applicatie ombouwen naar het afgesproken HR-groepmodel.

Dit plan is uitvoerbaar vanaf de repositoryroot. Luna voert de stappen in volgorde uit en rapporteert na iedere stap: gewijzigd, getest, geblokkeerd en nog open.

## 0. Niet-onderhandelbare werkwijze

- Lees eerst [AGENTS.md](../../AGENTS.md), [docs/README.md](../README.md), [CURRENT_CONTEXT.md](CURRENT_CONTEXT.md) en [CODING_STANDARDS.md](../../CODING_STANDARDS.md).
- Bewaar alle bestaande wijzigingen van Edwin. Gebruik geen `git reset --hard`, `git checkout --`, brede delete of ongeautoriseerde restore.
- Gebruik geen subagents tenzij Edwin dat expliciet vraagt.
- Werk steeds in deze volgorde: `schema → RLS/permissions → server/API → UI → tests → delivery-documentatie`.
- Gebruik strict TypeScript en geen `any`.
- Iedere nieuwe publieke tabel krijgt RLS, policies, indexes, grants en audit in dezelfde migratie.
- Geen productie- of remote writes zonder expliciete opdracht. De huidige data is testdata; een testmigratie mag later gecontroleerd worden uitgevoerd.
- Werkafspraak vanaf 2026-08-05: een Luna-stap geldt pas als afgerond wanneer schema/Supabase (migratie, RLS, grants, audit en gecontroleerde testdata), API, UI, tests, documentatie en de relevante lokale, remote en browserverificatie zijn uitgevoerd. Open onderdelen of blokkades worden expliciet gemeld en blokkeren de afronding.
- Deactiveer-, verwijder-, merge- en splitgedrag wordt niet in deze eerste slice gebouwd.
- Alle huidige databasegegevens zijn synthetische testdata. Bouw daarom geen fallback, compatibiliteitslaag, dual-read, dual-write of legacy-pad voor bestaande records.
- Bestaande testrecords mogen in een gecontroleerde, reproduceerbare migratie worden aangepast, opnieuw gekoppeld of opnieuw geseed. Zij mogen geen belemmering vormen voor het nieuwe model.
- Oude administratie-/tenant-scopekolommen, filters, RPC-parameters en constraints mogen worden vervangen of verwijderd zodra de nieuwe testmigratie en tests dit dekken.

## Doelmodel

Lees vóór iedere technische beslissing [HR_GROEP_SCOPE_EN_INRICHTING.md](../requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md), [ADR-0009](../decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md) en [FDR-0006](../decisions/FDR-0006-parallel-verzuim-per-dienstverband.md).

De primaire context is:

```text
HR-groep → eventueel administratie → onderdeel
```

Een persoon bestaat één keer binnen een HR-groep en heeft nul of meerdere dienstverbanden. Een dienstverband hoort bij één administratie, afdeling en functie. Bedrijf, locaties, afdelingen, functies, rollen, verlofregels en verzuiminstellingen zijn groepsbreed. Salaris, payroll, CAO, verlofsaldo en verzuimcasus blijven gekoppeld aan het dienstverband of de administratie zoals in de ownershipmatrix is vastgelegd.

Verzuim mag gelijktijdig bestaan op verschillende dienstverbanden en HR-groepen. Alleen overlap binnen hetzelfde dienstverband wordt geblokkeerd.

## Stap 1 — Documentatie, ADR’s en domeinbaseline

**Status: UITGEVOERD op 2026-08-05.** Deze stap is door Codex uitgevoerd. Luna moet de documenten hieronder lezen en op eventuele resterende tegenstrijdigheden controleren, maar hoeft geen tweede ontwerp voor deze baseline te maken.

### Doel

Maak de repositorydocumentatie de bron van waarheid voordat schema- of codewijzigingen beginnen.

### Te lezen en bij te werken documenten

- [HR-groep scope](../requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md)
- [Multitenancy](../requirements/multitenancy/MULTITENANCY_EN_MULTI_ADMINISTRATIE.md)
- [Entiteiteigendom](../requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md)
- [Contract en dienstverband](../requirements/employment/CONTRACT_EN_DIENSTVERBAND.md)
- [Bedrijf en locaties](../requirements/employment/BEDRIJF_EN_LOCATIE_PER_DIENSTVERBAND.md)
- [Afdelingen en rollen](../requirements/organization/AFDELINGEN_EN_ROLLEN.md)
- [Verlof-engine](../requirements/leave/VERLOF_OPBOUW_ENGINE.md)
- [Verlof aanvragen](../requirements/leave/VERLOF_AANVRAAG_HR_ADMIN.md)
- [Verzuim](../requirements/absence/VERZUIM_EN_HERSTEL.md)
- [Verzuiminstellingen](../requirements/absence/VERZUIM_INSTELLINGEN.md)
- [ADR-0009](../decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md)
- [FDR-0006](../decisions/FDR-0006-parallel-verzuim-per-dienstverband.md)

### Werkzaamheden

1. Markeer de oude `SEPARATE`/`COMBINED`-documentatie als historische baseline.
2. Verwijder geen historische besluiten, maar verwijs overal naar het nieuwe HR-groepdocument.
3. Corrigeer `Employee` naar HR-groep-scope.
4. Corrigeer CAO naar vast per dienstverband.
5. Corrigeer bedrijf en locaties naar HR-groep-scope.
6. Corrigeer verlofregels naar HR-groep-scope en saldo naar dienstverband-scope.
7. Corrigeer verzuim naar employment-scope met parallel verzuim over employments heen.
8. Voeg de nieuwe scope- en keuzecriteria toe aan `docs/README.md`, `CURRENT_CONTEXT.md` en `IMPLEMENTATION_STATUS.md`.

### Resultaat

De actuele documentatie staat in [HR_GROEP_SCOPE_EN_INRICHTING.md](../requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md), [ADR-0009](../decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md), [FDR-0006](../decisions/FDR-0006-parallel-verzuim-per-dienstverband.md) en dit plan. Luna moet deze documenten rechtstreeks volgen.

### Klaar wanneer

- Geen leidend document zegt nog dat HR-groepen ontbreken.
- Geen leidend document blokkeert verzuimoverlap over verschillende dienstverbanden.
- De nieuwe ADR/FDR en dit plan zijn gelinkt vanuit de documentatie-index.

## Stap 2 — Code-, schema- en testinventarisatie

**Status: UITGEVOERD op 2026-08-05.** De scope-inventarisatie en ownershipmapping zijn vastgelegd in de HR-groepdocumentatie en gecontroleerd tegen context, schema, services, API-routes, UI-schermen en tests voordat de migrations van stap 3 en verder zijn uitgevoerd.

### Doel

Breng de huidige administratiegebonden implementatie volledig in kaart voordat er een migratie wordt geschreven. De inventarisatie is bedoeld om te bepalen wat vervangen moet worden, niet om het oude model blijvend te ondersteunen.

### Te onderzoeken code

- Context: `apps/hr-suite/lib/context/*`
- Autorisatie: `apps/hr-suite/lib/auth/*`, `user_access` en policies
- Control Plane: `apps/liquidhr-control/*`
- Administraties: `apps/hr-suite/lib/administration/*` en relevante API-routes
- Personen/dienstverbanden: `apps/hr-suite/lib/employment/*`
- Organisatie/rollen: `apps/hr-suite/lib/organization/*`
- Bedrijf/locaties: `apps/hr-suite/lib/company-data/*`
- Verlof: `apps/hr-suite/lib/leave/*`, `/api/leave` en `/settings/leave-accrual`
- Verzuim: `apps/hr-suite/lib/absence/*`, `/api/absence` en `/settings/absence`

### Inventarisatie-output

Maak een tabel met per tabel en service:

- huidige eigenaar/scope;
- gewenste eigenaar/scope;
- bestaande foreign keys en constraints;
- bestaande RLS/policies/grants;
- betrokken API-routes;
- betrokken UI-schermen;
- testbestanden die moeten wijzigen.

Controleer specifiek of verzuimoverlap nu op `employee_id` of op `employment_id` wordt geblokkeerd. Een blokkade op alleen `employee_id` moet worden gemarkeerd als fout voor dit doelmodel en vervangen. Er mag geen fallback blijven bestaan voor oude records.

### Klaar wanneer

- Er is een expliciete mapping van huidige naar gewenste scope.
- Iedere bestaande administratiegebonden tabel heeft een migratiebesluit.
- Er is geen onbekende route die nog rechtstreeks tenantbrede gegevens leest.

## Stap 3 — Schema, foreign keys, RLS en testmigratie

**Status: UITGEVOERD op 2026-08-05.** De schema-, RLS-, permissions- en testdata-migraties zijn lokaal versioneerbaar en remote op het gekoppelde Supabase-testproject toegepast. De officiële DB-types zijn opnieuw gegenereerd. De lokale pgTAP-runner blijft geblokkeerd door een niet-actieve Docker Linux Engine; de equivalente remote structurele, RLS- en transactietests zijn wel geslaagd.

### Doel

Leg HR-groepen en de nieuwe eigendomsgrenzen database-side vast.

### Datamodel

Voeg of wijzig minimaal:

- `hr_groups` met tenant, naam, omschrijving en auditvelden;
- HR-groepkoppeling op `administrations` met naam en administratienummer;
- groepsgebonden persoon en eventueel een technische login-/identiteitskoppeling;
- groepsgebonden bedrijf en locaties;
- groepsgebonden afdelingen, functies, roltoewijzingen en organisatiecatalogi;
- groepsgebonden verlofregels, profielen, medewerker sets en instellingen;
- groepsgebonden verzuiminstellingen;
- employment-scoped verlofsaldi, boekingen en verzuimcasussen.

### Constraints

- Een administratie hoort bij precies één HR-groep.
- Een bestaande administratie kan niet worden verplaatst via normale writes.
- Een administratie wordt niet verwijderd; deactivering wordt als latere lifecyclefase voorbereid maar niet in deze slice gebouwd.
- Een HR-groep wordt niet verwijderd zolang er administraties of historische gegevens aan gekoppeld zijn.
- Een dienstverband en zijn administratie hebben dezelfde HR-groep.
- Een afdeling, functie, locatie en roltoewijzing horen bij de geselecteerde HR-groep.
- Een CAO op een bestaand dienstverband kan niet worden gewijzigd.
- Maximaal drie actieve CAO’s per administratie.
- Verzuimoverlap wordt alleen op hetzelfde `employment_id` geweigerd.
- Verzuim op verschillende employments, administraties en HR-groepen blijft toegestaan.

### Testdata

Gebruik een gecontroleerde, idempotente migratie of seed voor de huidige testdata. Maak een expliciete mapping van bestaande administraties naar HR-groepen. Omdat alle data testdata is, mag de migratie bestaande records aanpassen, opnieuw koppelen of vervangen. Bouw geen productiecompatibiliteit en geen fallback voor het oude model.

### Verificatie

- migratie dry-run;
- RLS-policycontrole;
- foreign-key- en indexcontrole;
- Supabase advisors;
- regeneratie van `packages/db/types.ts`;
- database-integratietests;
- negatieve cross-group tests.

### Klaar wanneer

De database kan geen cross-group write accepteren en blokkeert geen legitiem parallel verzuim op twee verschillende dienstverbanden.

## Stap 4 — Context, autorisatie en Control Plane

**Status: VOLLEDIG UITGEVOERD op 2026-08-05.** De primaire HR-groepcontext, optionele administratiecontext, switchers, HR-groepbeheer en Control-Plane-API/UI zijn lokaal én remote doorgetrokken. De context-RLS, permissions, remote contractcontrole en geauthenticeerde browseracceptatie zijn uitgevoerd.

### Doel

Maak HR-groep de eerste switch en houd administratie optioneel.

### Servercontext

Vervang de huidige contextgedachte door:

```text
tenant
hrGroups
activeHrGroup
administrationsInActiveHrGroup
activeAdministration?
```

De server moet bij iedere request controleren:

- gebruiker heeft toegang tot de tenant;
- gebruiker heeft toegang tot de HR-groep;
- gekozen administratie behoort tot de HR-groep;
- onderdeel gebruikt groeps- of administratiecontext volgens de ownershipmatrix.

### Rechten

- Edwin/Control Plane: HR-groepen aanmaken en initiële inrichting.
- HR-admin: switchen tussen toegestane HR-groepen, groepsinrichting beheren en administraties binnen de gekozen groep aanmaken.
- Niemand: bestaande administratie naar een andere groep verplaatsen.
- Normale gebruikers: alleen hun toegewezen groeps- en managementscope.

### Verificatie

- contextwissel groep A/B;
- poging om administratie van B in A te selecteren;
- HR-admin mag nieuwe administratie in actieve groep maken;
- normale gebruiker mag geen HR-groep aanmaken;
- RLS weigert gemanipuleerde group- en administration-ID’s.

### Uitgevoerde lokale slice

- `loadActiveContext` leest alleen toegestane tenant-, HR-groep- en administratiecontext en valt bij gemanipuleerde cookies terug op een toegestane context;
- de HR-groep is de primaire switch; de administratiekeuze wordt gewist bij een groepswissel en wordt alleen binnen de actieve groep geaccepteerd;
- HR-admins kunnen binnen de actieve groep een administratie aanmaken en naam/omschrijving van de groep wijzigen; bestaande administratie-groepkoppelingen blijven immutable;
- HR-groepen worden uitsluitend via de aparte Control Plane aangemaakt; de database blokkeert directe groepsverwijdering en audit dekt groepswijzigingen;
- server-side `AuthContext` en RLS gebruiken de actieve groepsrelatie voor rol- en scopecontrole.

### Speccontrole Stap 4

Stap 4 is voor de eigen specificatie **100% gevolgd en vastgesteld**: de primaire groepscontext, optionele administratiecontext, contextwissel, server-side autorisatie, RLS, Control-Plane-grens, immutable administratie-groepkoppeling, lokale/remote tests en geauthenticeerde groep-A/B-browsercontrole zijn groen. De latere ownershipstappen vervangen deze contextbasis niet; zij gebruiken haar voor bedrijf, locaties, personen, verlof en verzuim.

## Stap 5 — Bedrijf, administraties en locaties

**Status: VOLLEDIG UITGEVOERD op 2026-08-05.** Schema/Supabase, API, UI, testdata, tests, documentatie en lokale, remote en geauthenticeerde browserverificatie zijn uitgevoerd. Stap 6 is aansluitend volledig uitgevoerd; zie de Step-6-sectie hieronder.

### Doel

Maak het onderscheid tussen groepsbrede bedrijf/locaties en administratiegebonden administratiegegevens zichtbaar.

### UX

Onder de geselecteerde HR-groep:

- Bedrijf;
- Locaties;
- Administraties.

Onder een administratie:

- naam;
- administratienummer;
- externe/salariskoppeling;
- administratiegebonden gegevens.

### Regels

- HR-admin mag administratienaam en -nummer wijzigen.
- Het interne administratie-ID blijft stabiel.
- Een locatie kan door alle employments in dezelfde HR-groep worden gebruikt.
- Een employment mag nooit een locatie uit een andere HR-groep krijgen.
- Een wijziging van locatie op een employment blijft een employment-plaatsing/tijdlijn, maar verandert de eigendom van de locatie niet.

### Verificatie

- bedrijf uit groep A niet zichtbaar in B;
- locatie uit A niet selecteerbaar voor employment in B;
- administratie A-nummer wijzigen zonder bestaande foreign keys te breken;
- bedrijf en locaties zonder administratiekeuze kunnen beheren.

### Uitvoering en bewijslast Stap 5

- `administration_company_data` en `administration_locations` zijn van administratie-scope naar HR-groep-scope gebracht. Beide tabellen hebben `hr_group_id`, RLS, policies, grants, audittriggers en de juiste groepsforeign keys; de legacy `administration_id`-eigenaarskolommen zijn verwijderd.
- `employee_organizations` gebruikt een composite foreign key naar de locatie binnen dezelfde tenant én HR-groep. De locatie-RPC weigert een locatie uit `TEST-BOUNDARY` voor een employment in `DEFAULT` met `LOCATION_NOT_FOUND`; bestaande plaatsingen hebben geen groepsmismatch.
- Administraties behouden hun interne ID en groepskoppeling. Naam en `administration_number` zijn wijzigbaar voor HR-admins, worden geaudit en zijn via de HR-groep-pagina zonder foreign-keybreuk gewijzigd en teruggezet. De gecontroleerde testadministratie staat terug op `TEST-BOUNDARY-001` met stabiel ID `0ad929be-8dbf-4b8f-884e-46852f182512`.
- De serverservice en API lezen en muteren bedrijf en locaties uitsluitend via de actieve HR-groep. De `/settings/company-data`-UI toont geen administratiekeuze; de HR-groepbeheerpagina toont naam, nummer, code en stabiel intern ID in een lijst-eerst beheerflow.
- De idempotente testmigratie seedt `TEST-BOUNDARY` met één bedrijf, één administratie (`TEST-BOUNDARY-ADMIN`), één locatie (`Testgroep B locatie`) en bewust nul medewerkers. De bestaande demo-tenant behoudt één groepsbreed bedrijf, vier locaties, drie administraties en 62 medewerkers in `DEFAULT`; de remote controle vond nul cross-group placement-mismatches.
- Remote RLS-controle: met de boundary-toegang tijdelijk uitgeschakeld waren voor de geauthenticeerde HR-admin één `DEFAULT`-bedrijf en vier `DEFAULT`-locaties zichtbaar, terwijl `TEST-BOUNDARY` nul bedrijf- en locatierijen opleverde. Anon had geen directe leesrechten; authenticated had alleen de RLS-begrensde rechten.
- Lokale gate: hr-suite 128 testbestanden/474 tests, i18n-pariteit, strict typecheck, volledige lint en productiebuild geslaagd; Control Plane strict typecheck, lint, i18n en productiebuild geslaagd. De lokale SQL-contractproef telt 35 assertions; uitvoeren via pgTAP blijft Docker-afhankelijk.
- Remote migrations: `hr_group_schema_and_test_data`, `hr_group_schema_finalize`, `hr_group_context_and_control_plane`, `hr_group_company_administration_locations`, `hr_group_company_location_privileges`, `hr_group_scope_column_privileges`, `hr_group_admin_role_permissions`, `hr_group_admin_read_permission` en `hr_group_fk_indexes` zijn toegepast. De Supabase advisors tonen geen nieuwe security- of HR-groep-FK-waarschuwing; resterende projectbrede security/performance-meldingen zijn bestaande baseline-meldingen of ongebruikte index-INFO's op de kleine fixturedataset.

### Speccontrole Stap 5

Alle Step5-specificaties zijn **100% gevolgd en vastgesteld**. Bedrijf en locaties zijn groepsbreed, administraties zijn vaste groep-entiteiten met wijzigbare naam/nummer en stabiel intern ID, cross-group zichtbaarheid en locatiegebruik zijn server-side/RLS/database-side geblokkeerd, de UI werkt zonder administratiekeuze voor groepsbrede gegevens, de testdata is gecontroleerd en reproduceerbaar gemigreerd, en de lokale/remote/browserbewijslast is vastgelegd. De algemene Definition of Done voor het volledige Luna-plan blijft uiteraard open voor de nog niet uitgevoerde stappen 6–9.

## Stap 6 — Personen, dienstverbanden, organisatie en rollen

**Status: VOLLEDIG UITGEVOERD op 2026-08-05.** De volledige verticale slice is uitgevoerd: schema/Supabase, RLS, grants, audit, testdata, API/services, UI, tests, documentatie en lokale, remote en geauthentiseerde controles.

### Doel

Maak personen en operationele organisatie groepsgebonden, terwijl dienstverbanden administratiegebonden blijven.

### Personen en employments

- persoon: nul of meerdere employments;
- employment: administratie, afdeling, functie en vaste CAO;
- meerdere actieve employments zijn toegestaan;
- hoofddienstverband is uitsluitend een UX-keuze;
- dezelfde persoon kan per HR-groep eigen persoons- en zakelijke e-mailgegevens hebben.

### Organisatie

- afdelingen en functies binnen HR-groep;
- plaatsing van employment naar afdeling/functie;
- meerdere leidinggevenden per afdeling;
- één leidinggevende voor meerdere afdelingen;
- aparte autorisatie als dezelfde persoon in meerdere HR-groepen leidinggevende is.

### Roltoewijzing

De roltoewijzing moet eerst HR-groep en daarna afdeling bepalen. De lijsten voor:

- toewijzen vanaf medewerker;
- toewijzen vanaf afdeling;
- afdelingen zonder leidinggevende;
- bestaande roltoewijzingen;

moeten dezelfde groepsscope gebruiken.

### Verificatie

- afdeling A verschijnt niet in groep B;
- twee leidinggevenden op één afdeling;
- één leidinggevende over twee administraties binnen één groep;
- één leidinggevende in twee groepen met aparte autorisatie;
- medewerker met meerdere employments wordt per employment correct getoond.

### Uitvoering en bewijs

- De groepsgebonden persoons-, organisatie- en rolgrens staat in `apps/hr-suite/supabase/migrations/20260805200000_hr_group_people_organization_roles.sql`. Oude administratie-/tenantpolicies op de Step-6-tabellen zijn vervangen door groepspolicies; composite foreign keys, indexes, audittrigger voor `employments`, scopeguards en `create_job_with_revision` zijn opgenomen.
- `apps/hr-suite/supabase/migrations/20260805203000_hr_group_people_rpc_alignment.sql` brengt `list_employee_overviews` naar `tenant + hr_group` en voorkomt persoons- of administratiebrede directoryresultaten buiten de actieve groep.
- `apps/hr-suite/supabase/migrations/20260805203100_hr_group_complete_employment.sql` bevat de groepsconsistente atomische complete-employmentpublicatie. De remote DDL is uitgevoerd; de lokale fixturemigratie is `apps/hr-suite/supabase/migrations/20260805203200_hr_group_step6_cross_admin_fixture.sql`.
- De services voor context, medewerkers, employments, organisatie, managementrollen, jobcatalogus, organogram, startpagina en directory gebruiken dezelfde actieve HR-groep. De UI toont de administratie per employment en laat groepsbrede afdelingen, functies en roltoewijzingen niet uit andere groepen door.
- De reproduceerbare fixtures blijven synthetisch: `TEST-BOUNDARY` heeft nul personen; `TEST-MULTIGROUP` heeft één groepspersoon; dezelfde manager-login bestaat afzonderlijk in `DEFAULT` en `TEST-MULTIGROUP`; `DEMO-028` heeft twee actieve employments in `OPERATIONS` en `SERVICES`; `RICH-02` heeft minimaal twee leidinggevenden over twee administraties.
- Remote geslaagd: `hr_group_people_organization_roles.sql`, `employee_overview.sql`, `employee_document_dossiers.sql`, `employment_complete_flow.sql` en `hr_group_step6_contract.sql`. De contractproef controleert kolommen, RLS, policies, grants, composite relaties, audit, fixtures en cross-groupgrenzen; de complete-employmenttest controleert de geldige atomische flow en rollback bij 90%-kostenverdeling.
- Browser op `http://localhost:3000`: HR-admin wisselde tussen `DEFAULT`, `TEST-MULTIGROUP` en `TEST-BOUNDARY` en zag respectievelijk 58, 1 en 0 medewerkers; organogram en roltoewijzingen bleven groepsgebonden. De manager zag zijn directe team in `DEFAULT` en geen personen in de testgroep zonder eigen teamscope. De medewerkerdirectory blijft in een geldige administratiecontext beschikbaar; zonder eigen administratiecontext wordt nu server-side naar normale toegang geweigerd in plaats van een runtime-500.
- Lokale gate na de laatste fix: 128 testbestanden/474 tests, strict typecheck, volledige ESLint, i18n-pariteit met 28 namespaces, productiebuild met 170 pagina's en `git diff --check` zijn groen.
- De officiële `packages/db/types.ts` is opnieuw gegenereerd vanaf de remote database. Supabase-advisors zijn na de Step-6-DDL uitgevoerd; de laatste projectbrede stand na de aansluitende hardening is security 1 INFO/19 WARN en performance 340 INFO/0 WARN. Dit zijn projectbrede/inherente advisorbevindingen (onder andere bestaande en nieuwe permission-checked `SECURITY DEFINER`-RPC's, `platform_support_sessions` en ongebruikte index-INFO's), geen ontbrekende Step-6-RLS-policy. De remote `pgtap`-extensie is versioneerbaar geïnstalleerd voor de contractrunner; de pgTAP-tests zijn daarna rechtstreeks uitgevoerd.

Alle Step-6-eigen specificaties zijn **100% gevolgd en vastgesteld**. De verlofdocumentatie is opnieuw volledig gelezen voordat Step 7 is uitgevoerd.

## Stap 7 — Verlofregels op HR-groep, saldo op dienstverband

### Doel

Voorkom dubbel beheer door verlof één keer per HR-groep in te richten.

### Datamodel en regels

- verloftypen, profielen en opbouwregels: HR-groep;
- medewerker sets: HR-groep;
- uitzonderingen: gekoppeld aan een dienstverband;
- saldo, buckets, grootboek en aanvragen: dienstverband;
- geen persoonsbreed verlofsaldo;
- CAO-filtering mag een medewerker set gebruiken, maar wijzigt de vaste CAO van het dienstverband niet.

Voorrang:

```text
dienstverbanduitzondering → medewerker set → HR-groepstandaard
```

### Dienstverbandkeuze

- bij één actief passend employment automatisch;
- bij meerdere employments keuze met afdeling/functie/administratie;
- vanuit een leidinggevende-afdeling automatisch wanneer exact één match;
- anders altijd expliciete keuze.

### Verificatie

- twee employments hebben twee saldi;
- groepsregel wordt voor alle administraties gebruikt;
- medewerker set wijkt af;
- individuele employment-uitzondering wint;
- verlof uit groep A verschijnt niet in B;
- managerflow kiest employment via afdeling/functie.

### Uitvoering en bewijs Stap 7

**Status: VOLLEDIG UITGEVOERD op 2026-08-05; 100% van de eigen Step-7-specificaties gevolgd en vastgesteld.**

- Verloftypen, profielen, opbouwregels, bonusregels, voorrangsregels, jaarsturing, employee sets en overwerkcatalogi zijn HR-groepgebonden. `employment_leave_profiles`, uitzonderingen, buckets, transacties, rollovers, allocaties en aanvragen blijven employmentgebonden; er is geen persoonsbreed verlofsaldo.
- De lokale en remote migraties `20260805210000_hr_group_leave_scope.sql` t/m `20260805210800_hr_group_anon_privilege_hardening.sql` bevatten groepsforeign keys, RLS, policies, grants, audittriggers, unieke groepssleutels, FK-indexen, pgtap-testinfrastructuur en least-privilege grants.
- De resolver legt `employment exception → employee set → HR-group default` vast, met expliciete employmentprofielresolutie volgens de requirements. De service/API valideert tenant, groep, medewerker, employment, geldigheidsdatums en dubbele keuzes server-side.
- De group-RPC's voor opbouwregel, bonusregel, opening balance, handmatige correctie, jaarafsluiting en aanvraag zijn permission-checked, atomic en waar relevant idempotent. Oude administration-RPC's zijn niet meer uitvoerbaar voor `authenticated`.
- `/settings/leave-accrual` bevat lijst-eerst employee sets met zoeken/filteren en modals. De uitzonderingsflow toont per persoon afzonderlijke employment-keuzes met employmentnummer en organisatiecontext. NL/EN i18n-pariteit blijft intact.
- De gecontroleerde fixture bevat in `TEST-MULTIGROUP` `Stap 7 testverlof`, een groepsstandaard van 1.5u, een employee-setprofiel van 2.5u en één setlid. `TEST-BOUNDARY` heeft geen Step-7-catalogusrecords; `DEMO-028` heeft twee 2026-employment-buckets.
- Remote groen: de drie pgTAP-contracten (37/37, 23/23, 35/35), Step-6-contracten, employmenttests en de verlof-/overurentests (12/12 relevante contract- en functionele SQL-tests). RLS gaf multigroup 1 verloftype/1 set, boundary 0, twee DEMO-028-balances en resolverbron `EMPLOYEE_SET`.
- De remote `pgtap`-extensie is versioneerbaar geïnstalleerd. Verouderde testqueries (`min(uuid)`) en de niet-bestaande helper `row_security_active` zijn vervangen door geldige PostgreSQL-contractchecks; alle tests zijn daarna rechtstreeks opnieuw uitgevoerd.
- Lokale eindgate: 128 testbestanden/475 tests, strict typecheck, volledige lint, i18n-pariteit met 28 namespaces, productiebuild met 170 pagina's en `git diff --check` zijn groen. Officiële DB-types zijn opnieuw remote gegenereerd.
- Laatste advisors: security 1 INFO/19 WARN, performance 340 INFO/0 WARN en 0 Step-7-ongeïndexeerde foreign keys. De security-WARNs zijn bestaande/inherente en bewust permission-checked `SECURITY DEFINER`-RPC's; performance-INFOs zijn projectbrede ongebruikte indexen op de kleine testdataset.
- Browser op `http://localhost:3000`: HR Admin zag multigroup, de employee-set met één lid en beide profielversies. De uitzonderingsmodal toonde `EMP-DEMO-028-A` en `EMP-DEMO-028-SERVICES`; het tweede employment is expliciet geselecteerd zonder opslaan. Manager werd voor HR-verlofbeheer naar de startpagina gestuurd; medewerker kreeg `Nog geen toegang`.

### Speccontrole Stap 7

Alle eigen Step-7-specificaties zijn **100% gevolgd en vastgesteld**: group-owned catalogi en employee sets, employment-owned saldo/grootboek/aanvragen, resolvervoorrang, expliciete employmentselectie, cross-group RLS, group-RPC's, testdata, API, UI, i18n, lokale gates, remote contracttests, advisors en geauthentiseerde browserflows. Stap 8 en Stap 9 zijn daarna functioneel uitgevoerd; de integrale eindverificatie en handoff zijn afgerond.

## Stap 8 — Verzuim per dienstverband, parallel toegestaan

### Doel

Ondersteun het praktijkgeval waarin iemand voor één functie hersteld is en voor een andere functie ziek blijft.

### Regels

- verzuiminstellingen: HR-groep;
- casus en ziekteperiode: employment;
- overlap binnen hetzelfde employment: blokkeren;
- overlap tussen verschillende employments: toestaan;
- overlap tussen verschillende HR-groepen: toestaan;
- herstel op employment 1 verandert employment 2 niet;
- vierwekenketen per employment;
- geen persoonsbrede verzuimstatus.

### Shared resolver

Gebruik dezelfde employment resolver als bij verlof:

1. geselecteerde HR-groep;
2. medewerker;
3. afdeling/functie vanuit managercontext;
4. één match automatisch;
5. meerdere matches keuze tonen;
6. geen match blokkeren;
7. server valideert opnieuw.

### Verplichte tests

1. Zelfde employment, overlappende ziekteperioden: weigeren.
2. Twee employments, overlappende ziekteperioden: accepteren.
3. Twee HR-groepen, overlappende ziekteperioden: accepteren.
4. Portier 50% hersteld, badmeester 50% ziek: accepteren.
5. Herstel op employment 1 laat employment 2 onveranderd.
6. Manager met één afdelingsmatch: automatisch kiezen.
7. Manager met meerdere matches: keuze tonen.
8. Employment uit andere groep: weigeren zonder groepsgegevens te onthullen.

### Speccontrole Stap 8

Stap 8 is functioneel uitgevoerd op 2026-08-06. De remote migration, RLS/policies, groepsgescopeerde verzuim-RPC's, employmentresolver, API/service/UI, i18n, lokale tests, remote contracttest, typegeneratie, advisors en geauthentiseerde browsercontroles zijn uitgevoerd. De browsercontrole bevestigde HR-groepwissel, expliciete keuze tussen twee employments, herstelisolatie, partial capacity, manager één-match en medewerker-self-service op mobiel.

De Step-9-fixture bevat nu Omar (`DEMO-037`) met twee bevestigde actieve employments en twee actuele plaatsingen onder Yara (`DEMO-028`). De manager multiple-match-browservariant is geauthentiseerd uitgevoerd met beide opties zichtbaar en één expliciete keuze; de ziekmelding is niet opgeslagen.

## Stap 9 — Integrale verificatie, browserbewijs en handoff

**Status: UITGEVOERD op 2026-08-06.** De remote fixture, de minimaal gescopeerde RLS-correctie, de remote contract-/RLS-controle, de volledige lokale gates, typegeneratie, advisors en de geauthentiseerde HR Admin-/Manager-browserflows zijn groen. Alleen de latere deactivatie-, verwijder-, merge- en splitfase blijft buiten deze eerste slice.

De lokale migrations `20260806101419_hr_group_step9_manager_multiple_employment_fixture.sql`, `20260806133314_hr_group_absence_employment_read_scope.sql` en `20260806133600_consolidate_employments_absence_read_policy.sql` zijn remote toegepast; remote registreerde zij als respectievelijk `20260806130420_hr_group_step9_manager_multiple_employment_fixture`, `20260806133414_hr_group_absence_employment_read_scope` en `20260806133633_consolidate_employments_absence_read_policy`. De tweede RLS-migration consolideert de selectpolicy en voorkomt dubbele permissieve policies zonder `contract:read` breed toe te kennen.

De lokale gate omvat 129 testbestanden/478 tests, strict TypeScript, lint, 28 gelijke NL/EN-i18n-namespaces, productiebuild met 171 routes en `git diff --check`. Advisors tonen security 1 INFO/19 WARN en performance 342 INFO/0 WARN als bestaande projectbaseline. De browser toont HR Admin Omar tweemaal en Manager beide employmentopties; één optie is geselecteerd zonder opslag en de console eindigt op 0 errors/0 warnings.

### Technische verificatie

Voer na de volledige slice uit:

- gerichte unit- en integratietests;
- RLS- en negatieve autorisatietests;
- `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite`;
- strict typecheck;
- gerichte en volledige lintcontrole;
- productiebuild;
- Supabase advisors;
- `packages/db/types.ts` opnieuw genereren;
- `git diff --check`.

### Browserflows op poort 3000

Controleer ingelogd met HR-admin:

1. groep A selecteren;
2. bedrijf, locaties en administraties van A bekijken;
3. naar groep B switchen;
4. bevestigen dat de inhoud volledig wisselt;
5. administratie toevoegen met naam en nummer;
6. naam en nummer wijzigen;
7. verlofregel op groepsniveau beheren;
8. medewerker met twee employments openen;
9. employment kiezen via afdeling/functie;
10. verlofsaldo per employment bekijken;
11. ziekmelding op employment 1 doen;
12. herstel op employment 1 registreren;
13. ziekmelding op employment 2 laten bestaan;
14. managerflow vanuit afdeling testen;
15. roltoewijzing met meerdere leidinggevenden testen.

Controleer ook 390px-weergave, URL-state, foutmeldingen en browserconsole.

### Handoff

Werk na afronding bij:

- [CURRENT_CONTEXT.md](CURRENT_CONTEXT.md);
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md);
- [docs/README.md](../README.md).

Noteer daar:

- welke migraties zijn gemaakt en uitgevoerd;
- welke tests geslaagd zijn;
- welke browserflows zijn gecontroleerd;
- welke open punten naar de latere deactivatiefase gaan;
- dat merge, push en deployment niet automatisch zijn uitgevoerd.

## Definition of Done

De slice is pas klaar wanneer schema, RLS, API, UI, tests en documentatie hetzelfde model beschrijven:

- HR-groep is de primaire switch en zichtbaarheidgrens;
- administratie is een vaste groepstoewijzing met naam en nummer;
- bedrijf en locaties zijn groepsbreed;
- verlofregels zijn groepsbreed en saldo employmentgebonden;
- verzuim is employmentgebonden en parallel over employments toegestaan;
- CAO is vast binnen een employment;
- roltoewijzingen zijn groepsgebonden;
- testdata is gecontroleerd gemigreerd;
- er is browserbewijs voor HR-admin, manager en meerdere actieve employments;
- de code bevat geen legacy fallback, dual-read, dual-write of uitzonderingspad voor de oude tenant-/administratiescope;
- bestaande testdata is geen reden om oude scope-semantiek in stand te houden;
- de nieuwe testmigratie is reproduceerbaar en alle relevante testrecords zijn naar HR-groep-scope gebracht.
