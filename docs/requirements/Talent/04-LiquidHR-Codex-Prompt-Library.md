# LiquidHR Workforce & Talent Management
## Codex Prompt Library v1.0

**Auteur:** Edwin Dingjan  
**E-mail:** edwin@editsolutions.nl  
**Datum:** 31 juli 2026

---

## Gebruik

Gebruik deze prompts in volgorde. Voer per prompt eerst de gevraagde analyse uit, laat Codex de relevante bestanden en tests benoemen en controleer de output voordat de volgende prompt wordt gestart.

Alle prompts veronderstellen dat de volgende bestanden in de repository of werkmap beschikbaar zijn:

- `01-LiquidHR-Workforce-Talent-Product-Blueprint-v2.0.md`
- `02-LiquidHR-AI-Architecture-Instructions.md`
- `03-LiquidHR-Codex-Implementation-Plan.md`
- `05-LiquidHR-Acceptance-Test-Pack.md`
- `06-LiquidHR-Decision-Register-Glossary.md`
- `07-LiquidHR-UI-Reference-Library.md`

Vervang productbeslissingen nooit door aannames uit de mockups.

---

# Prompt 00 — Repositoryanalyse en technische baseline

```text
Je werkt aan de bestaande LiquidHR-repository van Edwin Dingjan.

Lees volledig:
- 01-LiquidHR-Workforce-Talent-Product-Blueprint-v2.0.md
- 02-LiquidHR-AI-Architecture-Instructions.md
- 03-LiquidHR-Codex-Implementation-Plan.md
- 05-LiquidHR-Acceptance-Test-Pack.md
- alle repository-instructies zoals AGENTS.md, README, CONTRIBUTING en package scripts.

Voer nog geen functionele implementatie uit.

Onderzoek feitelijk:
1. framework, package manager en versies;
2. routes en modulegrenzen;
3. authenticatie, tenantcontext en rollen;
4. database, migraties, ORM/querylaag en RLS;
5. bestaande employees, employments, functions, function groups, tags en audit;
6. bestaande Settings-, Workforce- en employee-dashboardpatronen;
7. design system en componentbibliotheek;
8. testframeworks, CI en bestaande failures;
9. bestaande of half gebouwde Talent-code;
10. migratierisico’s en mogelijke duplicatie.

Lever zonder placeholders:
- repository-analysis.md
- talent-gap-analysis.md
- talent-technical-design.md
- talent-data-migration-plan.md
- talent-security-design.md
- talent-test-strategy.md
- talent-file-map.md

Geef per document concrete repositorypaden en bewijs uit de code.
Verzin geen productgedrag.
Stop na deze documenten en geef een samenvatting van maximaal 20 regels met risico’s en aanbevolen starttaak.
```

---

# Prompt 01 — Security- en permissionfundament

```text
Lees de Product Blueprint hoofdstukken Rollen, Security, Audit en BR-011 t/m BR-018 en BR-085 t/m BR-093. Lees daarna talent-security-design.md en talent-file-map.md.

Implementeer uitsluitend het centrale security- en permissionfundament voor Talent.

Vereisten:
- HR Admin: configuration manage en alle profile reads.
- Manager: read-only binnen bestaande managementscope.
- Medewerker: uitsluitend eigen My Talent.
- Geen UI-only security.
- Tenantisolatie server-side en op datalaag.
- Gebruik bestaande permissionconventies; introduceer geen losse rolchecks door componenten.
- Audit denied privileged actions volgens bestaande auditarchitectuur.

Werkwijze:
1. noem eerst exact welke bestanden je wijzigt en waarom;
2. schrijf eerst failing tests voor positieve en negatieve scenario’s;
3. implementeer minimaal om tests te laten slagen;
4. draai alleen relevante securitytests plus bestaande auth-smoke tests;
5. geef diff-samenvatting, testoutput en resterende risico’s.

Bouw nog geen Talent-schermen of datamodellen behalve wat strikt voor permissions nodig is.
```

---

# Prompt 02 — Auditfundament

```text
Implementeer de auditdekking voor toekomstige Talent-commands op basis van Product Blueprint hoofdstuk 46 en BR-017, BR-087 en BR-088.

Gebruik de bestaande platformaudit. Bouw geen tweede auditwereld.

Audit moet minimaal ondersteunen:
- create
- update
- activate
- inactivate
- profile version creation
- profile version activation
- relation add/remove
- denied privileged action

Iedere event bevat tenant, actor, timestamp, objecttype, object-ID, action, relevante before/after, correlation ID en source channel.

Schrijf tests dat:
- events append-only zijn;
- alleen bevoegde HR Admin audit kan lezen;
- cross-tenant audit niet zichtbaar is;
- gevoelige volledige profieltekst niet in standaard operationele logs terechtkomt.

Noem vooraf bestanden en interfaces. Stop na auditfundament en tests.
```

---

# Prompt 03 — Talent Level Model

```text
Implementeer het tenantbrede Talent Level Model volgens Product Blueprint hoofdstuk 12, BR-031 t/m BR-038 en UI-009.

Functioneel:
- precies één model per tenant;
- dynamisch aantal levels;
- name, description, code en sort order;
- vóór gebruik toevoegen, verwijderen en herschikken;
- status Configurable of In Use;
- atomair vergrendelen zodra een level voor het eerst in een relevante profielvereiste wordt gebruikt;
- na lock geen structurele wijziging via UI, API of directe RPC;
- nergens hardcoded vijf levels;
- geen fictieve organisatiedistributiegrafiek.

Werkwijze:
1. schrijf database- en servicetests;
2. voeg migraties en constraints toe;
3. implementeer commands/queries;
4. bouw Settings UI met loading, empty, success, error en locked state;
5. schrijf componenttests;
6. draai gerichte tests en migratietest.

Gebruik het bestaande Design System. UI-009 is alleen visuele richting.
```

---

# Prompt 04 — Senioriteit

```text
Implementeer Senioriteit volgens Product Blueprint hoofdstuk 13, BR-039 t/m BR-047 en UI-010.

Vereisten:
- tenantbreed stamgegeven;
- initiële idempotente startset Junior, Medior, Senior;
- HR Admin kan naam, beschrijving, volgorde en status beheren;
- geen hardcoded systeemwaarden;
- geen verplicht default seniority en geen default-radio;
- later optioneel koppelbaar aan meerdere functions;
- impactquery voor gekoppelde functions;
- inactieve seniority niet selecteerbaar voor nieuwe relaties;
- tenantisolatie en audit.

Schrijf eerst tests voor seed, meerdere tenants, duplicate names, ordering, status, permissions en directe API-calls.
Bouw daarna de beheerweergave volgens bestaand Design System.
Stop na werkende Senioriteit en geef testoutput.
```

---

# Prompt 05 — Capability Library basis

```text
Implementeer de generieke Capability Library volgens Product Blueprint hoofdstukken 10 en 11 en BR-019 t/m BR-030.

Interne types:
- Competency
- Skill
- Knowledge
- Language
- Certificate

Gemeenschappelijk:
- tenant
- type
- name en normalized name
- descriptions
- category optional
- status Active/Inactive
- bestaande Cloud Tags relation
- audit fields

Typespecifiek:
- Competency, Skill en Knowledge ondersteunen level content uit het tenantmodel;
- Language gebruikt CEFR A1-C2 en optioneel mother tongue-indicator, niet Talent Level;
- Certificate gebruikt eigen metadata en geen Talent Level.

Vereisten:
- duplicate active name per tenant/type blokkeren;
- inactieve items niet nieuw selecteerbaar;
- historische referenties behouden;
- usage count en impact voor inactivation;
- geen parallel tagsysteem.

Bouw eerst schema, constraints, services en tests. Bouw in deze prompt nog geen volledige UI; alleen noodzakelijke API/querycontracten.
```

---

# Prompt 06 — Capability Library UI

```text
Gebruik de werkende Capability Library uit de vorige stap. Bouw nu de Talentbibliotheek-UI volgens Product Blueprint hoofdstukken 10, 11, 24 en 25 en UI-003/UI-004.

Vereisten:
- één bibliotheekcontainer;
- herkenbare typeweergaven voor Competenties, Skills, Kennis, Talen en Certificaten;
- lijst/search/filter/pagination;
- filters status, category en tags;
- echte tellingen;
- create/edit/detail/inactivate voor HR Admin;
- dynamische levelaccordions voor relevante types;
- usage list met echte profile references;
- geen analytics/trends zonder bron;
- loading, empty, error, conflict en permission states;
- manager en medewerker hebben geen configuration routes.

Gebruik bestaande tables/forms/dialogs. Schrijf component- en integratietests. Geef na afloop een lijst van alle routes en permissions.
```

---

# Prompt 07 — Functiegroepen en optionele functiefamilies

```text
Lees Product Blueprint hoofdstukken 14 en 15, BR-048 t/m BR-052 en UI-012.

Onderzoek eerst opnieuw of bestaande LiquidHR Function Groups of Families veilig herbruikbaar zijn. Implementeer geen duplicerende tabellen zonder het goedgekeurde migration plan.

Vereisten:
- Job Group is verplichte container voor functions;
- Job Family is optioneel;
- tenant zonder families moet volledig werken;
- group name uniqueness in juiste family-context;
- Active/Inactive lifecycle;
- delete geblokkeerd bij relaties;
- audit en tenantisolatie;
- bestaande employment/functionrelaties blijven intact.

Bouw schema/migratie, services, tests en beheer-UI.
UI-012 is alleen een hiërarchische referentie; neem geen skill coverage of unfilled roles KPI’s over.
```

---

# Prompt 08 — Functies en senioriteitsrelatie

```text
Implementeer Job Function volgens Product Blueprint hoofdstuk 16 en BR-053 t/m BR-058.

Vereisten:
- precies één Job Group;
- optioneel één Senioriteit;
- meerdere functions mogen dezelfde basisnaam hebben wanneer seniority verschilt;
- unique business key: tenant + group + normalized name + nullable seniority;
- function zonder seniority toegestaan;
- presentatienaam mag “Naam — Senioriteit” tonen zonder basisnaam te wijzigen;
- Active/Inactive;
- impact op bestaande employments zichtbaar;
- employee assignment blijft eigendom van bestaand HR-domein;
- geen automatische profile requirements op basis van seniority.

Schrijf tests voor:
- Junior/Medior/Senior varianten met dezelfde naam;
- één variant zonder seniority;
- duplicaatblokkade;
- inactieve group/seniority;
- cross-tenant;
- bestaande employment references.

Bouw daarna beheer-UI volgens bestaande LiquidHR-patronen.
```

---

# Prompt 09 — Functiehuis Explorer

```text
Bouw de Functiehuis Explorer volgens Product Blueprint hoofdstuk 26 en UI-005, met UI-012 uitsluitend als aanvullende hiërarchiereferentie.

Vereisten:
- minimale boom: Functiegroep → Functie;
- optionele Functiefamilie-root alleen wanneer tenant families gebruikt;
- seniority is property/badge van Function, niet verplichte tree node;
- search met ancestor context;
- gelijknamige functions onderscheidbaar op group en seniority;
- detailpaneel met group, function, seniority, status, current profile status en relaties;
- lazy loading of efficiënte tree-query voor grote datasets;
- HR Admin beheeracties; Manager alleen read-only wanneer route onder Workforce wordt hergebruikt;
- loading, empty, error en no-results states.

Schrijf query-, component- en permissiontests. Bouw geen profile editing in deze prompt.
```

---

# Prompt 10 — Functieprofiel en datumversies: datalaag

```text
Implementeer het Job Profile-domein volgens Product Blueprint hoofdstuk 17 en BR-059 t/m BR-078.

Vereisten:
- één logisch profile per function;
- één of meer versions;
- statuses uitsluitend Draft, Active, Inactive;
- date-effective validity;
- UI primair datums, intern version number toegestaan;
- Active-periods mogen niet overlappen;
- future activation toegestaan;
- historical versions read-only;
- nieuwe Draft kan inhoud kopiëren;
- activation sluit vorige open period atomair af;
- geen approval/review/publish;
- audit en optimistic concurrency.

Profile content ondersteunt:
- summary/description
- purpose
- organizational context
- tasks
- responsibilities
- result areas
- tags waar bestaande engine dit ondersteunt.

Schrijf eerst uitgebreide unit-, database- en servicetests, inclusief timezone en concurrent activation. Bouw nog geen volledige editor.
```

---

# Prompt 11 — Capabilityvereisten in functieprofielen

```text
Implementeer Profile Capability Requirements volgens Product Blueprint hoofdstukken 17.7-17.8, BR-071 t/m BR-075 en UI-011.

Vereisten:
- relation naar één Capability;
- importance Required, Important of Optional;
- Competency/Skill/Knowledge: dynamisch Talent Level verplicht;
- Language: CEFR, geen Talent Level;
- Certificate: eigen requirement metadata, geen Talent Level;
- rationale/toelichting optioneel;
- sort order;
- duplicate capability binnen dezelfde version blokkeren;
- inactieve capability niet nieuw koppelbaar;
- existing references naar later inactieve capability zichtbaar met status.

Bouw command/querylaag en Add/Edit-dialog.
De level selector moet tenantdata gebruiken en mag nooit hardcoded 1-5 zijn.
Schrijf tests per capabilitytype en directe API-validatie.
```

---

# Prompt 12 — Functieprofiel editor, detail en historie

```text
Bouw de HR Admin profile UX volgens Product Blueprint hoofdstukken 27 en 34 en UI-006/UI-013.

Vereisten:
- header met function, group, seniority, profile status en geldigheidsdatums;
- tabs/sections voor algemeen, competencies, skills, knowledge, languages, certificates, tasks, responsibilities, result areas en history;
- Save alleen voor Draft;
- New Version vanuit bestaande version;
- Activate met impactbevestiging en ingangsdatum;
- historical version read-only;
- optimistic concurrency conflict UX;
- deterministic activation checklist, geen arbitraire completeness score;
- geen import, AI, bezettingsanalytics, ontwikkeladvies of approvals;
- role-aware read-only mode.

Gebruik bestaande components. Schrijf componenttests en één E2E-journey: function → draft → capabilities → activate → historical query.
```

---

# Prompt 13 — Talent Configuratie landing en dashboard

```text
Bouw Settings → Talent landing en configuration dashboard volgens Product Blueprint hoofdstukken 18, 23 en 24 en UI-002/UI-003.

Landing:
- groepeer Bibliotheek, Framework & Functiehuis en Beheer;
- echte tellingen;
- families alleen indien gebruikt/ingeschakeld;
- import/templates niet actief in fase 1.

Dashboard:
- object counts;
- level model status;
- seniority configured count;
- Draft profiles;
- functions zonder geldig active profile;
- invalid/inactive references;
- recent changes uit audit;
- actionable links met dezelfde filterscope als de telling.

Verboden:
- fake data;
- arbitrary health score;
- trends zonder historische bron;
- AI insights;
- demo employees.

Schrijf tests dat iedere kaarttelling overeenkomt met de gefilterde doellijst.
```

---

# Prompt 14 — Workforce Talent en Manager read-only

```text
Bouw Workforce Talent volgens Product Blueprint hoofdstukken 19 en 22 en UI-001.

Vereisten:
- operational entry onder Workforce;
- configuration blijft uitsluitend onder Settings;
- HR Admin en Manager kunnen active profiles zoeken en lezen;
- Manager alleen binnen bestaande managementscope;
- geen mutation actions voor Manager;
- Draft en historical versions niet standaard zichtbaar;
- toekomstige modules alleen disabled/coming soon volgens bestaand platformpatroon;
- geen schijnfunctionaliteit.

Test:
- directe API mutation door Manager wordt geweigerd;
- Manager buiten scope krijgt geen data;
- HR Admin kan read-only operationele view gebruiken;
- Workforce en Settings gebruiken dezelfde profile source of truth.
```

---

# Prompt 15 — Mijn Talent

```text
Bouw Mijn Talent volgens Product Blueprint hoofdstuk 20 en UI-007.

Resolveer:
1. ingelogde gebruiker naar bestaand employee record;
2. actuele employment/function relation;
3. geldige Active profile version voor huidige datum;
4. read-only profile content en requirements.

Toon in fase 1:
- function;
- group;
- seniority indien aanwezig;
- profile version en effective date;
- description, purpose, tasks, responsibilities en result areas;
- required competencies, skills, knowledge, languages en certificates als functievereisten.

Niet tonen:
- persoonlijke scores;
- matchpercentages;
- progress bars;
- development journey;
- recommended next role;
- persoonlijke certificaatstatus zonder bestaande betrouwbare bron.

Schrijf negative tests voor andere employee en andere tenant. Bouw responsive en toegankelijk.
```

---

# Prompt 16 — Security, performance en accessibility hardening

```text
Voer een gerichte hardeningronde uit op de complete fase 1 Talent Foundation.

Security:
- alle RLS/policies/RPC’s reviewen;
- cross-tenant en role-negative suite draaien;
- security-definer functions rechtvaardigen en hardenen;
- secrets/clientbundle controleren;
- auditdekking controleren.

Performance:
- dashboard counts;
- capability lists;
- function tree;
- profile detail;
- My Talent resolution;
- query plans en indices;
- N+1 detectie.

Accessibility:
- keyboard-only;
- focus;
- labels;
- dialogs;
- tables;
- status niet alleen door kleur;
- error association;
- responsive My Talent.

Verander geen productscope. Lever een hardening report met gevonden problemen, fixes, testoutput en resterende non-blocking risks.
```

---

# Prompt 17 — Volledige acceptatie en release candidate

```text
Gebruik 05-LiquidHR-Acceptance-Test-Pack.md als autoritatieve checklist.

Voer uit:
1. database/migration tests;
2. unit tests;
3. service/integration tests;
4. component tests;
5. kritieke E2E journeys;
6. negative security suite;
7. productieachtige migration dry run;
8. lint/typecheck/build;
9. accessibility smoke;
10. performance baseline.

Maak `talent-release-readiness.md` met:
- requirement/test mapping;
- pass/fail per critical test;
- bekende afwijkingen;
- security findings;
- migration/rollback status;
- performancewaarden;
- feature flags en rolloutvolgorde;
- expliciete bevestiging dat geen fase 2-functionaliteit is geactiveerd.

Repareer failures alleen binnen de goedgekeurde scope. Verzin geen nieuwe functionaliteit om een test te omzeilen.
Maak pas een release candidate wanneer alle critical tests slagen.
```

---

# Prompt 18 — Gerichte code review na iedere milestone

```text
Review uitsluitend de wijzigingen van de huidige Talent-milestone tegen:
- Product Blueprint-requirements en BR-ID’s;
- AI Architecture Instructions;
- Acceptance Test Pack;
- bestaande repositoryconventies.

Controleer specifiek:
- productscope en out-of-scope leakage;
- tenantisolatie en permissions;
- dataintegriteit en concurrency;
- migratieveiligheid;
- duplicate domain logic;
- hardcoded levels/statussen;
- fake UI data;
- toegankelijkheid;
- testkwaliteit en ontbrekende negatieve tests;
- ongerelateerde refactors.

Rapporteer findings op severity: Blocker, High, Medium, Low.
Geef per finding exact bestand, regel/context, geschonden requirement en concrete correctie.
Maak geen codewijzigingen in deze reviewprompt.
```

---

# Prompt 19 — Fix alleen goedgekeurde reviewfindings

```text
Implementeer uitsluitend de expliciet goedgekeurde findings uit de laatste milestone review.

Voor iedere finding:
1. citeer finding-ID en geschonden requirement;
2. schrijf of corrigeer eerst de test die het probleem reproduceert;
3. voer de minimale fix uit;
4. draai gerichte tests;
5. rapporteer resultaat.

Voer geen opportunistische refactor of nieuwe productfunctionaliteit uit.
Stop wanneer alle goedgekeurde findings zijn opgelost of wanneer een finding een nieuwe productbeslissing vereist.
```

---

## Compacte sessiestarter

Gebruik bij een nieuwe Codex-sessie vóór een specifieke prompt:

```text
Context: LiquidHR Talent Foundation voor Edwin Dingjan.
De Product Blueprint v2.0 is autoritatief. Mockups zijn ondersteunend.
Werk uitsluitend aan [PROMPT/TAKENUMMER].
Lees eerst de genoemde documenthoofdstukken en repository-instructies.
Noem vóór wijzigingen de relevante bestanden, tests en scope.
Verzin geen productgedrag en bouw niets uit fase 2.
```

---

**Einde Codex Prompt Library**
