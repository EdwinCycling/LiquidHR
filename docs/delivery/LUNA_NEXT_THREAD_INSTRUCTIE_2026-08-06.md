# Luna-instructie voor de volgende thread

Datum: **2026-08-06**
Repository: `C:\Users\Edwin\Documents\Apps\LiquidHR`
Volgende actieve scope: **Stap 9 — integrale verificatie, browserbewijs en handoff**

## Startinstructie voor Luna

Begin in de repositoryroot en lees volledig:

1. `AGENTS.md`;
2. `docs/README.md`;
3. `docs/delivery/CURRENT_CONTEXT.md`;
4. dit document;
5. `docs/delivery/LUNA_HR_GROEP_IMPLEMENTATIEPLAN.md`;
6. `docs/requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md`;
7. `docs/decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md`;
8. `docs/decisions/FDR-0006-parallel-verzuim-per-dienstverband.md`;
9. `docs/requirements/absence/VERZUIM_EN_HERSTEL.md`;
10. `docs/requirements/absence/VERZUIM_INSTELLINGEN.md`.

Ga daarna verder vanaf de actuele openstaande stap, nu **Stap 9**, niet vanaf Stap 0. Controleer eerst de actuele filesystem-, Git-, lokale server-, remote migration- en teststatus. Vertrouw geen oude browser-URL, tijdelijke poort, fixture-login of chatclaim zonder actuele controle.

Gebruik voor iedere schemawijziging de volgorde **schema → API/service → UI**. Gebruik strict TypeScript, geen `any`, bestaande context/resolvers en bestaande audit/RLS-patronen. Voer Supabase-acties volgens de Supabase-skill uit. Maak geen commit, push, merge of deployment zonder afzonderlijke opdracht.

## Wat in de vorige thread is uitgevoerd

### Stap 0 en 1: bronnen en controle

- De leidende documentatie, requirements, ADR/FDR, implementatieplan en testdata zijn gelezen.
- De werkafspraak is vastgelegd: een stap is pas klaar na schema/Supabase, RLS, grants, audit, testdata, API, UI, tests, documentatie en relevante lokale/remote/geauthentiseerde browsercontrole.
- De oorspronkelijke melding dat de remote Stap-3/4-migraties nog ontbraken was verouderd. De remote migrations zijn toegepast en opnieuw gecontroleerd.

### Stap 3–5: HR-groepfundering, context, bedrijf en locaties

- HR-groep is de primaire zichtbaarheid- en inrichtingsgrens.
- Context is `tenant → hr_group → optionele administration`.
- Bedrijven en locaties zijn groepsbreed.
- Een administratie kan niet naar een andere HR-groep worden verplaatst; naam en nummer zijn wijzigbaar, intern ID blijft stabiel.
- Cross-group gebruik wordt door API/RPC, composite foreign keys en RLS geweigerd.
- `TEST-BOUNDARY` is de negatieve fixture met één bedrijf, administratie en locatie, maar zonder medewerkers.
- Stap 4 en Stap 5 zijn per alle eigen specs 100% vastgesteld.

### Stap 6: personen, employments, organisatie en rollen

Lokaal en remote zijn uitgevoerd:

- `20260805200000_hr_group_people_organization_roles.sql`;
- `20260805203000_hr_group_people_rpc_alignment.sql`;
- `20260805203100_hr_group_complete_employment.sql`;
- `20260805203200_hr_group_step6_cross_admin_fixture.sql`.

Personen, afdelingen, functies, rollen en organisatieplaatsingen zijn HR-groepgebonden. Employments blijven administratiegebonden en dragen dezelfde `hr_group_id`. `DEMO-028` heeft twee actieve employments over `OPERATIONS` en `SERVICES`. De directory en organisatie-/managementservices gebruiken groepscontext; een ongeldige administratiecontext geeft een normale toegangweigering in plaats van een runtime-fout.

### Stap 7: verlof per HR-groep en employment

Lokaal en remote zijn uitgevoerd:

- `20260805210000_hr_group_leave_scope.sql`;
- `20260805210100_hr_group_leave_catalog_keys.sql`;
- `20260805210200_hr_group_leave_resolvers_and_fixture.sql`;
- `20260805210300_hr_group_leave_rpc_operations.sql`;
- `20260805210400_hr_group_leave_fk_indexes.sql`;
- `20260805210500_hr_group_leave_fk_index_followup.sql`;
- `20260805210600_hr_group_leave_fk_index_followup.sql`;
- `20260805210700_enable_pgtap_test_extension.sql`;
- `20260805210800_hr_group_anon_privilege_hardening.sql`.

De ownershipgrens is:

- HR-groep: verloftypen, profielen, opbouwregels, bonusregels, voorrang, jaarsturing, employee sets en overwerkcatalogi;
- employment: uitzonderingen, profielkeuzes, saldo, buckets, transacties, rollovers, allocaties en aanvragen;
- geen persoonsbreed verlofsaldo.

De resolver gebruikt:

`employment exception → employee set → HR-group default`.

De group-RPC's zijn permission-checked, atomair en waar nodig idempotent. De server controleert tenant, groep, medewerker, employment, datums en dubbele keuzes opnieuw. `packages/db/types.ts` is officieel opnieuw gegenereerd.

De Stap-7-fixture bevat:

- `TEST-MULTIGROUP` met `Stap 7 testverlof`;
- groepsprofiel van 1,5 uur;
- employee-setprofiel van 2,5 uur;
- één setlid;
- `TEST-BOUNDARY` zonder Stap-7-catalogusrecords;
- twee 2026-buckets voor `DEMO-028`.

## Uitgevoerde verificatie

### Lokaal

- 128 testbestanden / 475 tests groen;
- strict typecheck groen;
- lint groen;
- i18n-check groen met 28 gelijke namespaces;
- productiebuild groen met 170 pagina's/routes;
- `git diff --check` groen.

### Remote Supabase

- De drie pgTAP-contracttests zijn rechtstreeks uitgevoerd: 37/37, 23/23 en 35/35 assertions.
- De relevante Step-6/7-contract-, employment-, leave- en overtime-tests zijn groen.
- RLS-resultaat: multigroup 1 verloftype en 1 employee set; boundary 0; `DEMO-028` 2 buckets; resolverbron `EMPLOYEE_SET`.
- Advisors na de laatste DDL: security 1 INFO/19 WARN en performance 340 INFO/0 WARN.
- Er zijn 0 Stap-7-specifieke ongeïndexeerde foreign keys.
- Security-WARNs zijn beoordeelde projectbrede/inherente meldingen rond permission-checked `SECURITY DEFINER`-RPC's en Auth-configuratie; zij vormen geen ontbrekende Stap-7-RLS-policy.

### Geauthentiseerde browser op poort 3000

- HR Admin zag de multigroup-catalogus, employee set, setlid en beide profielversies.
- De uitzonderingsmodal toonde beide `DEMO-028`-employments en liet een expliciete employmentkeuze zien; er is geen ongewenste testmutatie opgeslagen.
- Manager werd buiten HR-verlofbeheer naar de startpagina gestuurd.
- Medewerker kreeg `Nog geen toegang`.
- De boundary-isolatie is rechtstreeks met remote RLS en contracttests vastgesteld. Een afzonderlijke UI-switch naar de boundary-groep bleef niet persistent; claim dit niet als geslaagd browserbewijs, maar ook niet als open Stap-7-specificatie zolang de vereiste RLS-/contractacceptatie groen is.

## Waar de volgende thread verdergaat: Stap 9

### Doel

Ondersteun parallel verzuim wanneer één persoon meerdere employments heeft: herstel op employment 1 mag verzuim op employment 2 niet wijzigen.

### Verplichte domeinregels

- verzuiminstellingen zijn HR-groepgebonden;
- `absence_case` en `absence_spell` zijn altijd aan exact één employment gekoppeld;
- overlap binnen hetzelfde employment wordt geblokkeerd;
- overlap over verschillende employments wordt toegestaan;
- overlap over verschillende HR-groepen wordt toegestaan;
- herstel op één employment wijzigt geen ander employment;
- de vierwekenketen wordt per employment/casus berekend;
- er bestaat geen persoonsbrede verzuimstatus;
- medische diagnoses, oorzaken, behandelingen of vrije medische tekst worden niet opgeslagen.

### Verplichte implementatievolgorde

1. Inventariseer bestaande `absence`-tabellen, migrations, services, API-routes, UI, permissions, tests en huidige RLS.
2. Ontwerp en implementeer schema, constraints, RLS, grants, audit, indexes en gecontroleerde testdata.
3. Genereer `packages/db/types.ts` opnieuw en draai Supabase advisors na de DDL.
4. Hergebruik `apps/hr-suite/lib/leave/employment-resolver.ts` of trek alleen een gedeelde resolver uit als dat aantoonbaar nodig is.
5. Bouw API/service en typed Zod-validatie voor ziekmelding, gedeeltelijk herstel en volledig herstel.
6. Bouw daarna de UI in bestaande medewerker-, kalender- en verzuiminstellingenflows; alle zichtbare tekst moet uit NL/EN-berichten komen.
7. Test lokaal, remote en met de drie testrollen op `http://localhost:3000`.
8. Werk daarna `CURRENT_CONTEXT.md`, `IMPLEMENTATION_STATUS.md`, `docs/README.md` en de relevante requirements bij.

### Verplichte Stap-8-tests

1. Overlap op hetzelfde employment wordt geweigerd.
2. Overlap op twee employments van dezelfde persoon wordt geaccepteerd.
3. Parallel verzuim in twee HR-groepen wordt geaccepteerd.
4. Portier 50% hersteld en badmeester 50% ziek blijft geldig.
5. Herstel op employment 1 laat employment 2 onveranderd.
6. Manager met één afdeling-match kiest automatisch.
7. Manager met meerdere matches krijgt een expliciete keuze.
8. Employment uit een andere groep wordt geweigerd zonder gegevenslek.

### Browseracceptatie Stap 8

Controleer minimaal met HR Admin, Manager en Medewerker:

- groep A openen en verzuimactie uitvoeren;
- naar groep B switchen en inhoud volledig zien wisselen;
- medewerker met twee employments openen;
- employment expliciet kiezen;
- ziekmelding, gedeeltelijk herstel en volledig herstel uitvoeren;
- parallelle casus op het tweede employment laten bestaan;
- manager één-match en meerdere-match flow controleren;
- 390px-weergave, URL-state, foutmeldingen en console controleren.

## Openstaande punten

1. **Stap 8 is functioneel uitgevoerd.** Remote schema/RLS/RPC's, API/service/UI, i18n, lokale gates, remote contracttests, typegeneratie, advisors en geauthentiseerde browserflows zijn uitgevoerd. De bestaande managerfixture bevat geen teamlid met meerdere geldige employments; die ene browservariant blijft als fixturepunt open voor Stap 9, terwijl de typed resolverregel wel groen is getest.
2. **Stap 9 is nog open.** Dit is de integrale eindverificatie en formele handoff van het volledige plan.
3. De lokale pgTAP-runner blijft afhankelijk van Docker Desktop Linux Engine. Gebruik remote pgTAP/SQL als Docker niet beschikbaar is en rapporteer die grens expliciet.
4. Security-advisor-WARNs blijven als beoordeelde baseline bestaan. Los ze alleen op wanneer de concrete scope van de melding in Stap 8 ligt; maak geen brede security-refactor zonder opdracht.
5. De Auth-dashboardinstelling voor leaked-password protection kan als platformbeheeractie openstaan; dit is geen reden om Stap 8-resultaten als groen te markeren zonder het apart te rapporteren.
6. De werkboom is dirty met wijzigingen uit deze en eerdere slices. Niet resetten, niet checkouten en geen ongerelateerde wijzigingen overschrijven.

## Hervatting na onderbroken Step-9-remote-call 2026-08-06

De lokale relatie-fix in `apps/hr-suite/lib/employment/employment-detail-service.ts` is handmatig gecontroleerd; de volledige gates na die fix ontbreken nog. De lokale fixturemigration `apps/hr-suite/supabase/migrations/20260806101419_hr_group_step9_manager_multiple_employment_fixture.sql` staat klaar voor de manager-multiple-match-browserflow, maar is na een onderbroken remote apply-call niet remote geregistreerd. Controleer vóór iedere apply de remote migrationlijst opnieuw en pas de fixture hoogstens één keer toe op project `wnpfloqpjvaacobppbpk`. Controleer vervolgens de twee actieve Omar-employments en twee employmentgebonden plaatsingen, herhaal de gates en voer de authenticated managerflow met expliciete employmentkeuze uit. Geen commit, push, merge of deployment uitvoeren.

## Aanbevelingen

- Begin Stap 9 met read-only eindinventaris en een compact verificatieplan; leg aannames en fixturegrenzen expliciet vast.
- Gebruik bestaande absence-entiteiten en services waar de semantiek klopt; maak geen parallelle verzuimbron.
- Test overlap op `employment_id`, nooit alleen op `employee_id`.
- Houd de privacyregel strikt: geen medische inhoud opslaan of teruggeven in foutmeldingen/logs.
- Gebruik alleen synthetische bestaande fixtures of reproduceerbare nieuwe fixturedata.
- Claim een stap pas als 100% wanneer schema, remote database, API, UI, tests, documentatie en relevante browserflows allemaal bewijs hebben.
- Sluit de thread af met een expliciete tabel van geslaagd, geblokkeerd, open en aanbevolen vervolg. Vermeld altijd dat commit, push, merge en deployment niet automatisch zijn uitgevoerd.

## Leidende bestanden

- `docs/delivery/LUNA_HR_GROEP_IMPLEMENTATIEPLAN.md`
- `docs/delivery/CURRENT_CONTEXT.md`
- `docs/delivery/IMPLEMENTATION_STATUS.md`
- `docs/README.md`
- `docs/requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md`
- `docs/decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md`
- `docs/decisions/FDR-0006-parallel-verzuim-per-dienstverband.md`
- `docs/requirements/absence/VERZUIM_EN_HERSTEL.md`
- `docs/requirements/absence/VERZUIM_INSTELLINGEN.md`
- `apps/hr-suite/supabase/tests/hr_group_leave_step7_contract.sql`
- `packages/db/types.ts`

De eerstvolgende chat kan starten met:

> Lees `AGENTS.md`, `docs/README.md`, `docs/delivery/CURRENT_CONTEXT.md` en `docs/delivery/LUNA_NEXT_THREAD_INSTRUCTIE_2026-08-06.md`. Controleer de actuele repository-, Supabase- en browserstatus. Stap 6, 7 en 8 zijn functioneel afgerond; voer nu Stap 9 uit als integrale eindverificatie en handoff. Claim geen 100% zonder alle verplichte bewijsstukken en rapporteer de ontbrekende manager-multiple-match browserfixture expliciet.
