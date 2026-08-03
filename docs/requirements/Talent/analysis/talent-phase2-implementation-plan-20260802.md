# LiquidHR Talent — implementatieplan fase 2

## Besluitupdate 2026-08-03

De fase-2-functies en applicatieve rollback zijn in de lokale/testscope afgerond. Provider snapshot/restore via een tijdelijke branch wordt bewust niet uitgevoerd en is geen actieve releasevoorwaarde. LMS/P3.6 wordt niet gebouwd zonder nieuw productbesluit. De gerichte Supabase-timeout is aangepakt met Talent-scope-indexen, RLS-short-circuiting en het overslaan van onnodige rapportopties. De eerste `TALENT-NEXT-01`-spiderwebslice is gebouwd buiten P4-P6; de actieve details staan in de requirementsanalyse en de delivery-handoff.

## Actuele uitvoeringsstatus 2026-08-02

M2.0 t/m M2.8 zijn in de testfase geïmplementeerd. M2.7 bevat ontwikkeldoelen/POP met statusmachine, scope, versioning en audit. M2.8 bevat read-only rapportage en CSV-export met allowlisted kolommen en exportaudit. M2.6 preview, commit en rollback zijn met HR Admin bewezen; rollback archiveert het aangemaakte record. De drie-fixture-role-/scope-gate is groen. De grote-dataset-baseline en axe/keyboard-herhaling zijn uitgevoerd. Een provider snapshot/restore wordt niet uitgevoerd en is geen releasevoorwaarde binnen de afgesproken lokale/testscope.

**Status:** M2 functioneel afgerond in de lokale/testfase. P3.0, P3.1, P3.2 en P3.4 zijn functioneel afgerond in de lokale/testfase; P3 release-hardening en P3.7 eigenaaracceptatie blijven apart zichtbaar.  
**Datum:** 2 augustus 2026  
**Bron:** `01-LiquidHR-Workforce-Talent-Product-Blueprint-v2.0.md`, vooral §4.2 en §65  
**Uitgangspunt:** de fase-1 Foundation en de geauthenticeerde rol-gate zijn aanwezig; databaseherstel via een externe providerbranch valt bewust buiten de afgesproken testscope.

## 1. Doel en scope

Fase 2 maakt Talent operationeel voor drie rollen, zonder de scheiding **Instellingen → Workforce → Medewerker** te doorbreken:

1. persoonlijke capabilityregistraties met herkomst, geldigheid en historie;
2. HR-beheerde medewerkerkwalificaties;
3. self- en manager-assessments met een expliciete beoordelingscyclus;
4. Team Talent en Skills Matrix;
5. vergelijking binnen functiegroepen;
6. import en gecontroleerde bulkmutaties met preview, validatie en rollback;
7. ontwikkeldoelen en POP;
8. rapportage en export.

AI, automatische loopbaanadviezen, succession, 9-grid, LMS en automatische besluitvorming blijven buiten deze fase tenzij de Blueprint later expliciet wordt gewijzigd.

## 2. Huidige uitgangspositie

Afgerond in fase 1:

- tenant-owned Talent Level Model, levels, senioriteiten, categorieën, capabilities, tags en functiehuis;
- versieerbare functieprofielen met type-specifieke vereisten;
- HR-beheer onder `/settings/talent`;
- read-only Workforce onder `/workforce/talent`;
- beperkt eigen functieprofiel onder `/my-talent`;
- server-side permissions, RLS, tenantisolatie en audit voor de fase-1-objecten;
- testfixtures voor HR Admin, manager en medewerker in de testadministratie;
- geauthenticeerde gate: 3 rollen, 4 toegestane routes, negatieve route-/mutatie-/tenanttests, manager-scope en medewerker-self-bound test.

Nog niet formeel gesloten voor productie-release:

- provider snapshot/restore is bewust uitgesloten; applicatieve rollback en migratiecontracten blijven de relevante lokale/testcontroles;
- de drie-rollen axe/keyboard-gate en de veilige representatieve performance-baseline zijn gesloten; een gedeelde themed color-contrastcheck blijft als handmatig beoordeelde axe-`incomplete` traceerbaar.

Fase 2 mag functioneel worden ontwikkeld in de testadministratie, maar iedere slice houdt deze release-open punten zichtbaar.

## 3. Niet-onderhandelbare ontwerpregels

- Volgorde: **Supabase-schema/migratie → RLS en permissions → server/API → UI → tests**.
- Hergebruik `employees`, `employments`, tenantcontext, bestaande functieprofielen, capabilities, tags en audit; maak geen tweede persoon-, functie- of tagwereld.
- Bepaal vóór iedere migratie de eigendom: tenant-owned, administration-owned of expliciete managementscope.
- De client bepaalt nooit autoritatief tenant, administratie, medewerker of manager-scope.
- HR Admin beheert organisatiebrede Talentdata; managers krijgen uitsluitend hun bestaande medewerkersscope; medewerkers krijgen uitsluitend eigen data.
- Privé-notities, managerobservaties, concepten en nog niet vrijgegeven scores zijn niet zichtbaar voor een rol die daar geen expliciet recht op heeft.
- Iedere mutatie is auditbaar met actor, tenant, object, actie, tijdstip en correlatie-ID; hard delete is alleen voor ongebruikte niet-historische testrecords.
- Geen percentages of dashboardscores zonder definieerbare bron en expliciete productdefinitie.
- Alle zichtbare tekst en foutmeldingen zijn NL/EN i18n-klaar; UI voldoet aan de bestaande lijst-eerst-, modal-, focus- en harmonica-conventies.

## 4. Rollen- en dataminimalisatiematrix

| Onderdeel | HR Admin | Manager | Medewerker |
|---|---|---|---|
| Eigen capabilityregistraties | tenantbreed lezen/beheren | lezen binnen managementscope | eigen lezen en, indien toegestaan, eigen concept opslaan |
| HR-kwalificaties | tenantbreed beheren | lezen binnen scope | eigen vrijgegeven gegevens lezen |
| Self-assessment | proces en cyclus beheren, resultaten lezen volgens beleid | eigen teamresultaten volgens cyclus | eigen assessment invullen en eigen resultaat lezen |
| Manager-assessment | proces beheren en audit lezen | eigen team beoordelen binnen cyclus | eigen vrijgegeven uitkomst lezen; geen privé-notities |
| Team Talent / Skills Matrix | tenantbreed, filters volgens recht | uitsluitend eigen team/scope | geen teamoverzicht |
| Vergelijking | tenantbreed binnen expliciete functiegroep | alleen geautoriseerde scope en minimum groepsgrootte volgens beleid | niet beschikbaar |
| Import/bulkmutatie | preview, validatie, commit, rollback | niet in fase 2A; later alleen expliciet toegewezen scope | niet beschikbaar |
| Doelen/POP | beleid en beheer | doelen voor eigen team volgens beleid | eigen doelen en voortgang binnen zichtbare scope |
| Export | alleen toegestane tenantdata, auditbaar | alleen toegestane scope, auditbaar | alleen eigen gegevens, indien geactiveerd |

Deze matrix is een productbesluit voor de UX, maar elke rij moet vóór implementatie worden vertaald naar een canonieke permission en een RLS-/serverregel. “Niet in de UI tonen” is nooit de beveiliging.

## 5. Fase-2-milestones

### M2.0 — contracten en gegevensbescherming

**Doel:** de ontbrekende domeinbesluiten vastleggen voordat nieuwe tabellen ontstaan.

- leg ADR/FDR vast voor eigendom, assessment-cycli, zichtbaarheid van scores en evidence;
- inventariseer bestaande permissions, managementscope, audit en notificaties;
- definieer status-, datum-, herkomst-, vertrouwelijkheids- en archiveringssemantiek;
- bepaal de exacte canonieke permissions; voeg geen rolnaamchecks in componenten toe;
- voeg databasecontracttests en de fase-2-traceabilitymatrix toe.

**Gate:** geen open beslissing die RLS of zichtbaarheid kan veranderen; schema-ontwerp reviewed.

**Uitvoering 2 augustus 2026:** de zeven M2.0-beslispunten zijn voor de M2.3/M2.4-slices vastgelegd als veilige defaults. Assessments, antwoordinhoud en Team Talent zijn tenant-owned; eigen invoer blijft `DRAFT`, HR geeft vrij, manageruitkomsten worden pas bij `FINALIZED` zichtbaar voor de medewerker, evidence blijft metadata-only, archiveren verwijdert niets, aggregaten zijn uitgeschakeld en automatische fase-2-notificaties zijn niet toegevoegd.

### M2.1 — persoonlijke capabilityregistraties

**Doel:** een medewerker kan persoonlijke capabilities hebben naast functievereisten.

**Uitvoering 2 augustus 2026:** de eerste slice is uitgevoerd met de veilige defaults uit FDR-0003 en op expliciete instructie doorgezet voordat alle overige M2.0-beslispunten zijn gesloten. Eigen invoer blijft `DRAFT`, HR bepaalt `RELEASED`/`ARCHIVED`, evidence is alleen een gecontroleerde referentie en records zijn tenant-owned. Assessmentcycli, private managerdata, Team Talent, import, doelen en exports zijn niet meegenomen.

Voorgestelde verticale slice:

- record op bestaande tenant-employee met capability, niveau/waarde volgens type, herkomst, geldig vanaf/tot, status, evidence-verwijzing en audit;
- onderscheid tussen self-entered, HR-entered en imported records;
- geen automatische matchscore en geen impliciete afleiding uit functieprofiel;
- HR beheert tenantbreed; medewerker ziet eigen data; manager ziet alleen geautoriseerde records binnen scope en zonder private evidence tenzij beleid dat toestaat.

**Supabase:** migratie, constraints, tenant/employee-FK's, indexes, RLS policies, audittrigger en eventueel beperkte RPC voor datum-/statuslogica. Genereer `packages/db/types.ts` opnieuw en draai advisors.

**API/UI:** lijst, filters, lege/laad/fouttoestand, detailmodal, bron en geldigheid duidelijk zichtbaar; self-bound `/my-talent` mag geen `employeeId` uit query of body vertrouwen.

**Gate:** databasecontract, RLS/grants, service/API scope, allowlisted DTO's, typecheck, volledige tests/build en de employee-browserflow zijn geslaagd. De bestaande drie-rollen-gate dekt route-/mutatie-/cross-tenant-/manager-scope/self-bound gedrag; een aparte interactieve HR-create- en manager-read browserherhaling blijft afhankelijk van de lokale fixture-login in de browser. Performance op representatieve data en rollback blijven release-open.

### M2.2 — HR-beheerde kwalificaties

**Doel:** kwalificaties, certificaten en bewijsstukken beheerst registreren.

- gebruik capabilitytype `Certificate` en bestaande capabilitybibliotheek;
- leg issuing body, certificaatcode, geldigheid, permanentie, verlenging, bewijsstatus en verantwoordelijke vast;
- toon verlopen en bijna-verlopen records als echte, filterbare toestand;
- archiveer met impactinformatie; verwijder historische kwalificaties niet stil.

**Gate:** geen ongerechtvaardigde inzage in bewijsstukken; datumlogica, duplicaatpreventie, audit en manager-scope bewezen.

**Uitvoering 2 augustus 2026:** M2.2 is doorgetrokken op de bestaande M2.1-records. De migratie voegt certificaatmetadata, evidence-status, een tenant-/medewerker-/capability-gebonden unieke actieve certificaatcode en een actieve verantwoordelijke toe. Databaseguards normaliseren permanente certificaten, blokkeren tegenstrijdige datum/evidence-combinaties, beperken de verantwoordelijke tot HR en een actieve gebruiker binnen dezelfde tenant en zetten ontbrekende HR-verantwoordelijkheid veilig op de actor. De service retourneert uitsluitend een allowlisted `qualificationResponsibleAssigned`-booleaan; bewijsinhoud en gebruikers-ID's komen niet in het DTO.

De HR-lijst/modal ondersteunt registratie, zoeken op uitgever/code, bijna-verlopen (30 dagen), evidence-status en expliciet archiveren met historische impactinformatie. Archiveren verwijdert het record niet en wordt geaudit. Remote contractproef, typecheck, lint, i18n, tests, productiebuild en advisors zijn uitgevoerd. De huidige interne-browserrun kon alleen de anonieme redirects op poort 3000 herhalen; de eerder geslaagde drie-rollen-gate blijft het referentiebewijs voor route- en scopegrenzen. Een nieuwe interactieve HR-modalrun met drie loginrollen blijft afhankelijk van beschikbare fixture-logincredentials.

### M2.3 — self- en manager-assessment

**Doel:** een gecontroleerde beoordelingscyclus, niet alleen losse scores.

- configureer cyclusnaam, scope, openings-/sluitdatum, schaal en beoordelingsonderdelen;
- self-assessment schrijft alleen de eigen conceptantwoorden;
- manager-assessment schrijft alleen medewerkers binnen de actuele managementscope;
- statusmachine: Draft → Submitted → Locked/Finalized volgens expliciet beleid; geen stille overschrijving;
- scheid self-score, manager-score, evidence en private managernotitie;
- leg vast wanneer de medewerker de manageruitkomst ziet en welke wijziging opnieuw openen vereist;
- audit iedere submit, lock, reopen en finale wijziging.

**Gate:** dubbele submit, gesloten cyclus, foreign employee, cross-tenant en buiten-scope manageracties zijn server-side geblokkeerd; alle zichtbaarheid is getest met drie fixtures.

**Uitvoering 2 augustus 2026:** de schema/API/UI-slice is toegevoegd. Er zijn cycli, onderdelen, self- en managerresponses, antwoorden en afgeschermde managernotities met status- en versiebewaking. HR beheert cycli en kan `LOCKED`, `FINALIZED` en gecontroleerd `DRAFT`-heropenen; medewerker en manager schrijven alleen hun toegestane concept/submit. RLS, databaseguards, auditmetadata en allowlisted DTO's bewaken tenant-, self- en managerscope. De drie-rollen browserherhaling is in deze run geblokkeerd door een ingelogde sessie zonder klantomgeving; de bestaande geauthenticeerde rol-gate blijft referentiebewijs.

### M2.4 — Team Talent en Skills Matrix

**Doel:** operationeel teamoverzicht met echte persoonlijke data.

- Team Talent toont uitsluitend medewerkers uit de managementscope;
- Skills Matrix toont capability × medewerker met expliciete status/bron, niet een onverklaard percentage;
- filters op team, functie, functiegroep, capabilitytype, status en geldigheid;
- toon neutrale empty state bij onvoldoende of niet-vrijgegeven data;
- HR kan tenantbreed zoeken binnen recht; manager nooit buiten scope; medewerker krijgt geen teamdata.

**Gate:** scope- en minimum-groepsgroottebeleid, queryplan en paginering zijn vastgelegd; geen N+1-query’s.

**Uitvoering 2 augustus 2026:** Team Talent en Skills Matrix zijn toegevoegd voor HR Admin en manager. Het readmodel gebruikt batchqueries voor actuele plaatsingen, medewerkers, persoonlijke capabilityrecords en capabilities; er is geen N+1-pad. HR ziet tenantbreed, manager alleen directe actuele medewerkers en medewerker heeft geen teamroute. De matrix toont individuele capabilityregels met status, bron, geldigheid en evidence-status zonder onverklaarde percentages; aggregaten zijn bewust uitgeschakeld en een toekomstige groepsvergelijking blijft minimaal vijf personen vereisen.

### M2.5 — profiel- en medewerkersvergelijking

**Doel:** gecontroleerde vergelijking binnen een functiegroep.

- vergelijk alleen actieve, toegestane functieprofielen en vrijgegeven persoonlijke data;
- definieer `match`, `gap`, ontbrekend bewijs en onbekend afzonderlijk vóór UI-bouw;
- toon geen totaalscore zolang de definitie en weging niet als productbesluit zijn goedgekeurd;
- respecteer dezelfde scope op zoekresultaat, detail en export.

**Gate:** elke weergegeven uitkomst is herleidbaar naar bronrecords en versie; IDOR/cross-tenant/manager-scope negatieve tests slagen.

**Uitvoering 2 augustus 2026:** M2.5 is toegevoegd met een tenant-owned, server-side gescopeerde vergelijkingsservice en routes voor HR Admin (`/settings/talent/comparison`) en manager (`/workforce/talent/comparison`). De selectie gebruikt alleen actieve, datumgeldige functieprofielversies en medewerkers uit de toegestane tenant- of directe managerscope. Resultaten gebruiken geen totaalscore en onderscheiden `MATCH`, `GAP`, `MISSING_EVIDENCE` en `UNKNOWN`. Alleen actuele, vrijgegeven capabilityrecords krijgen een bronrecord-ID; concepten, verlopen of niet-vrijgegeven gegevens blijven zonder bron-ID. De querycontracten en negatieve scopegrenzen zijn vastgelegd; interactieve fixtureherhaling volgt zodra de drie browserrollen beschikbaar zijn.

### M2.6 — import en gecontroleerde bulkmutaties

**Doel:** schaalbare invoer zonder onomkeerbare verrassingen.

- uploadbestand is eerst een immutable importbatch;
- preview toont mapping, nieuwe records, updates, fouten en waarschuwingen;
- commit is expliciete tweede stap met idempotency key;
- validatie gebruikt dezelfde domeinregels als handmatige invoer;
- rollback herstelt uitsluitend deze batch en laat auditdata intact;
- HR Admin only in eerste release; geen directe import door manager/medewerker.

**Uitvoering 2 augustus 2026:** M2.6 is toegevoegd voor HR Admin via `/settings/talent/import`. De immutable batch- en row-tabellen hebben RLS, authenticated-only grants, statusguards, gesaneerde auditmetadata, idempotente commit/rollback-RPC's en batchspecifieke rollback zonder hard delete. De UI werkt als preview → expliciete commit → rollback; CSV-rijen worden gevalideerd op bestaande medewerker/capability/levelcodes, datum, evidence-status, dubbele rijen en conflicten met niet-geïmporteerde records. De preview controleert bovendien dezelfde typegebonden waardecombinaties als de database-trigger. Geïmporteerde capabilityrecords starten als `DRAFT`; rollback archiveert nieuwe records en behoudt auditdata. Parsercontracten, remote securitycontract en de HR-fixture-gate slagen.

**Gate:** snapshot/dry-run, partiële fout, dubbele import, rollback en audit zijn getest op representatieve testdata.

### M2.7 — ontwikkeldoelen en POP

**Doel:** persoonlijke ontwikkeling koppelen zonder automatisch advies te simuleren.

- doel, eigenaar, periode, status, voortgang, bron en optionele gekoppelde capability;
- medewerker beheert eigen doelen; manager kan doelen voor eigen scope ondersteunen volgens beleid; HR kan beleid/audit beheren;
- geen automatische carrièrestap, AI-advies of score-afleiding;
- afsluiten/archiveren bewaart historie.

**Gate:** doelprivacy, scope, statusovergangen, audit en notificatiegedrag zijn getest.

**Uitvoering 2 augustus 2026:** M2.7 is toegevoegd met `talent_development_goals`, tenant-/employee-/capability-FK's, datum- en voortgangsconstraints, bron (`SELF_ENTERED`, `MANAGER_ENTERED`, `HR_ENTERED`), optimistic versioning, statusguards, audittrigger en RLS voor HR, directe manager en medewerker-self. De pagina's `/settings/talent/goals`, `/workforce/talent/goals` en `/my-talent/goals` ondersteunen toevoegen, wijzigen, afronden, annuleren en HR-archiveren. Er is geen automatische score, carrièrestap, AI-advies of notificatieservice toegevoegd. De browserflow medewerker `ACTIVE -> COMPLETED` is met remote statusbewijs uitgevoerd.

### M2.8 — rapportage en export

**Doel:** bruikbare rapporten met expliciete scope en bron.

- begin met read-only lijst/export van echte records;
- exportkolommen zijn per rol allowlisted, niet gebaseerd op `select *`;
- exportactie, filters, scope en recordaantal worden geaudit;
- maak onderscheid tussen actuele stand, historie en verlopen data;
- geen fictieve KPI’s of verborgen aggregaties.

**Gate:** rolmatrix, tenantgrens, managergrens, medewerker-self-bound, grote dataset en exportdata-minimalisatie bewezen.

**Uitvoering 2 augustus 2026:** M2.8 is toegevoegd als read-only report-service met `/settings/talent/reports`, `/workforce/talent/reports` en `/my-talent/reports`, plus `/api/talent/reports` en `/api/talent/reports/export`. Doelen en capabilityrecords worden via allowlisted DTO's samengevoegd; filters onderscheiden doelstatus en recordstatus/geldigheid. CSV gebruikt vaste kolommen en bevat geen gebruikers-ID's, evidence-inhoud, private notities of verborgen aggregaten. `EXPORT` wordt auditbaar vastgelegd met `admin`, `manager` of `self`, filters en recordaantal. De drie scopes zijn browsermatig aangeroepen en remote in `audit_logs` bevestigd. De download zelf blijft in de in-app browser een client-downloadbeperking; endpoint-HTTP 200 en audit zijn bewezen.

### M2.9 — fase-2 hardening en release

- volledige geauthenticeerde matrix voor alle fase-2-routes, API’s en mutaties;
- cross-tenant en foreign-employee negatieve tests;
- RLS-/RPC-/permissionsreview en Supabase advisors;
- typecheck, i18n, lint, tests, productiebuild, axe en keyboard-only;
- performance-baseline op vastgelegde testdataset;
- migratievolgorde en applicatieve rollback-oefening;
- update Blueprint-traceability, `IMPLEMENTATION_STATUS.md` en `CURRENT_CONTEXT.md`.

**Uitvoering 2 augustus 2026:** de drie-rollenroute-/scope-gate voor M2.6-M2.8 is groen. Remote contracts, RLS/grants/permissions en de HR-fixture importflow zijn uitgevoerd. De performanceproef gebruikt tijdelijke tabellen met 20.000 synthetische rijen en wordt volledig teruggedraaid; de zwaarste importselectie bleef onder 8 ms. De axe/keyboard-herhaling is groen met 0 violations. Alleen een provider snapshot/restore moet nog met expliciete kosten- en hersteltoestemming worden uitgevoerd. Detailbewijs staat in `docs/delivery/TALENT_M2_RELEASE_HARDENING_20260802.md`.

### Actieve besluitnotitie

De applicatieve rollback is bewezen. Provider snapshot/restore via een tijdelijke Supabase-branch is op verzoek uitgesloten en wordt niet uitgevoerd; de oudere tekst hierboven is historische context. De gerichte Supabase-timeout is in de daaropvolgende Talent-slice aangepakt.

## 6. Test- en releasecontract

Elke milestone levert minimaal:

1. databasecontracttest voor constraints, indexes, RLS en grants;
2. unit/integratietests voor status-, datum-, scope- en zichtbaarheidlogica;
3. API-tests met 401/403/404 en fout zonder interne details;
4. browsertest in drie geïsoleerde sessies: HR Admin, manager, medewerker;
5. positieve routecheck én negatieve routecheck;
6. cross-tenant read/mutation-denial;
7. manager buiten-scope denial en medewerker foreign-ID/self-bound check;
8. axe scan, keyboard focus, labels, fout- en lege toestand;
9. controle dat response-DTO’s geen niet-toegestane velden bevatten;
10. `git diff --check` en actuele delivery-documentatie.

De minimale fase-2-fixtures zijn:

- drie bestaande rolgebruikers in `Liquid HR Demo Holding`;
- minimaal twee tenants;
- manager met minstens één toegewezen en één niet-toegewezen medewerker;
- medewerkers met verschillende functies, capabilitytypes, geldigheid en assessmentstatussen;
- één private evidence/notitie, één verlopen kwalificatie en één historische versie;
- importdataset met geldige, dubbele, ongeldige en cross-tenant rijen zodra M2.6 start.

## 7. Definition of Ready voor een nieuwe slice

Een slice start pas wanneer scope, rolmatrix, eigenaar, dataclassificatie, statusmachine, auditbehoefte, migratiepad, rollback en acceptatietests in het slice-document staan. Ontbreekt één daarvan, dan blijft de slice in ontwerp.

## 8. Nieuwe-thread handoff

Start een nieuwe thread met:

> Lees `AGENTS.md`, `docs/README.md` en `docs/delivery/CURRENT_CONTEXT.md`. Gebruik daarna `docs/requirements/Talent/analysis/talent-phase2-implementation-plan-20260802.md` als uitvoeringsplan. Begin uitsluitend met M2.0 en lever eerst de rolmatrix, dataclassificatie, ADR/FDR-open punten, Supabase-schemaontwerp en acceptatietests op. Voer nog geen UI- of databasewijziging uit totdat M2.0 als reviewed is vastgelegd.

De nieuwe thread moet vóór uitvoering opnieuw controleren: `git status`, lokale server op poort 3000, remote Supabase-project, aanwezige fixturecredentials en de actuele inhoud van `CURRENT_CONTEXT.md`. Geheimen mogen nooit in documentatie, logs of chat terechtkomen.

## 9. Beslispunten vóór M2.1

1. Mag een medewerker eigen capabilityrecords direct publiceren, of alleen als concept indienen?
2. Welke evidence is privé voor HR/manager en welke is zichtbaar voor de medewerker?
3. Wanneer worden manageruitkomsten vrijgegeven aan de medewerker?
4. Is de capabilityregistratie tenant-owned zonder administratiecontext, of is een administratiegebonden bron nodig?
5. Welke bewaartermijn en archiveringsregels gelden voor assessments, evidence en doelen?
6. Welke minimumgroepsgrootte geldt voor Team Talent en vergelijking?
7. Welke notificaties zijn verplicht en welke bestaande LiquidHR-notificatieservice wordt gebruikt?

Zonder deze beslissingen geen fase-2-migratie toepassen.

## Uitvoeringsupdate 2026-08-02: M2.5/M2.6 drie-fixture-gate

De lokale fixturecredentials uit `.env.talent-auth.local` zijn gebruikt in de Codex-browser op poort 3000. HR Admin bereikte vergelijking en importpreview; manager bereikte de directe-scopevergelijking met scope 22 en twee functieprofielen en kreeg geen HR-importtoegang; employee bereikte `/my-talent` en kreeg geen vergelijking/importtoegang. Ongeldige en geldige importpreviews zijn getest.

De geldige import is in de Codex-browser gecommit en daarna teruggedraaid. De demo-tenant heeft daarvoor uitsluitend op `TENANT_ADMIN` de canonieke rechten `talent-import:manage` en `talent-record:write` gekregen. Manager en medewerker blijven zonder importschrijfrecht. De batch eindigde als `ROLLED_BACK`, de rij als `ROLLED_BACK` en het aangemaakte capabilityrecord als `ARCHIVED`; auditdata bleef behouden.
