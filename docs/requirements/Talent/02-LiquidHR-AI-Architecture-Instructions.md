# LiquidHR Workforce & Talent Management
## AI Architecture Instructions v1.0

**Auteur:** Edwin Dingjan  
**E-mail:** edwin@editsolutions.nl  
**Datum:** 31 juli 2026  
**Bron:** `01-LiquidHR-Workforce-Talent-Product-Blueprint-v2.0.md`

---

## 1. Doel van dit document

Dit document instrueert een AI-ontwikkelagent, zoals Codex, hoe de LiquidHR Talent Foundation technisch moet worden geanalyseerd, ontworpen en voorbereid voordat functionele implementatie begint.

De AI mag in deze fase:

- de bestaande repository onderzoeken;
- architectuur en conventies documenteren;
- een impactanalyse maken;
- een technisch ontwerp voorstellen dat de Product Blueprint volledig uitvoert;
- databasemigraties, services, componentgrenzen en tests plannen;
- risico’s signaleren.

De AI mag in de architectuurfase niet:

- productfunctionaliteit toevoegen;
- business rules wijzigen;
- UI-mockups als autoritatieve requirements behandelen;
- code implementeren voordat het technische ontwerp is beoordeeld;
- bestaande functionaliteit refactoren zonder directe noodzaak;
- aannemen dat een library, framework, tabel of patroon bestaat zonder dit in de repository te verifiëren.

---

## 2. Autoritatieve bronnen

Gebruik deze volgorde:

1. Product Blueprint v2.0;
2. Acceptance Test Pack;
3. dit architectuurdocument;
4. Codex Implementation Plan;
5. Codex Prompt Library;
6. UI-reference mockups;
7. bestaande code, voor zover deze niet strijdig is met de Product Blueprint.

Wanneer bestaande code en productbeschrijving botsen:

- wijzig niet direct;
- beschrijf de afwijking;
- bepaal of migratie, compatibiliteit of gefaseerde vervanging nodig is;
- behoud bestaande productiefunctionaliteit totdat een gecontroleerd pad is vastgesteld.

---

## 3. Verplichte werkwijze voor de AI

### 3.1 Begin altijd met repositoryanalyse

Voer vóór ieder ontwerp of iedere implementatie minimaal uit:

1. identificeer package manager, frameworkversies en buildcommando’s;
2. lees repository-instructies zoals `AGENTS.md`, `README`, `CONTRIBUTING`, `CLAUDE.md` en relevante projectdocumentatie;
3. inventariseer applicatieroutes en modulegrenzen;
4. identificeer authenticatie, tenantcontext en autorisatie;
5. identificeer database, migratiesysteem en datatoegangspatroon;
6. identificeer bestaande componentbibliotheek en design tokens;
7. identificeer testframeworks en CI-pipeline;
8. zoek bestaande concepten voor functies, functiegroepen, medewerkers, tags, audit en instellingen;
9. controleer of er al Talent-tabellen of half geïmplementeerde schermen bestaan;
10. rapporteer risico’s, duplicaten en afhankelijkheden.

Lever daarna een korte `repository-analysis.md` op met feiten uit de code. Geen aannames.

### 3.2 Werk in kleine, reviewbare veranderingen

- Eén domeinonderdeel per branch of logisch commitcluster.
- Iedere taak eindigt met werkende tests.
- Geen omvangrijke “big bang”-migratie.
- Geen massale formattering of ongerelateerde refactor.
- Behoud backwards compatibility alleen wanneer echte bestaande klantdata of een externe contractgrens dat vereist. In de expliciete LiquidHR-testfase met uitsluitend demo-data mogen foutieve compatibilitykolommen, oude scopefilters en tijdelijke RPC-signatures in een voorwaartse migratie worden verwijderd zodra bestaande demo-relaties aantoonbaar zijn genormaliseerd; houd geen parallelle writeable bron in stand.

### 3.3 Productgedrag niet improviseren

Wanneer een detail ontbreekt:

1. zoek eerst in de Product Blueprint en Decision Register;
2. zoek daarna in bestaande LiquidHR-patronen;
3. kies alleen een technische invulling die geen nieuw productgedrag introduceert;
4. noteer een technische aanname in het implementatierapport;
5. stop bij een echte productbeslissing in plaats van deze zelf te verzinnen.

---

## 4. Aanbevolen architectuurgrenzen

De exacte mappenstructuur moet aansluiten op de repository, maar de volgende domeingrenzen moeten herkenbaar blijven.

### 4.1 Talent Configuration

Verantwoordelijk voor:

- instellingenlanding;
- configuratiegezondheid;
- read models voor tellingen en aandachtspunten;
- toegang tot onderliggende beheerfuncties.

Niet verantwoordelijk voor:

- persoonlijke medewerkerbeoordelingen;
- Workforce-processen;
- AI;
- imports in fase 1.

### 4.2 Capability Library

Verantwoordelijk voor:

- generieke Capability-entiteit;
- types Competency, Skill, Knowledge, Language, Certificate;
- categorieën;
- typespecifieke validatie;
- levelcontent voor relevante typen;
- zoeken, filteren, activeren en inactiveren;
- gebruikstellingen.

### 4.3 Talent Level Model

Verantwoordelijk voor:

- één model per tenant;
- geordende levels;
- configuratie vóór gebruik;
- atomair vergrendelen bij eerste gebruik;
- dynamische niveaukeuzes.

Deze grens moet voorkomen dat losse schermen eigen hardcoded niveaus definiëren.

### 4.4 Seniority

Verantwoordelijk voor:

- tenantbrede senioriteiten;
- initiële seed Junior, Medior, Senior;
- sortering;
- status;
- impactqueries voor gekoppelde functies.

Seniority mag geen afhankelijkheid op capabilityniveaus krijgen.

### 4.5 Job Architecture

Verantwoordelijk voor:

- optionele Job Family;
- Job Group;
- Job Function;
- hiërarchie/explorer;
- zakelijke uniciteit;
- status en impact.

De minimale hiërarchie is Job Group → Job Function. Job Family is optioneel.

### 4.6 Job Profile

Verantwoordelijk voor:

- één logisch profile per function;
- profile versions;
- date-effective validity;
- status Draft, Active, Inactive;
- inhoudssecties;
- capability requirements;
- activeringstransactie;
- historie.

### 4.7 Talent Read Models

Verantwoordelijk voor:

- Workforce-profielraadpleging;
- managerzicht binnen bestaande scope;
- My Talent voor de ingelogde medewerker;
- samengestelde, read-only projecties.

Deze laag mag geen nieuwe brondata bezitten.

### 4.8 Audit

Gebruik de bestaande platformaudit als deze voldoet. Breid deze uit waar nodig. Bouw geen tweede losstaande auditoplossing zonder aantoonbare reden.

### 4.9 Ownershipgrens

Volg voor Talent én iedere toekomstige module [`requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md`](../multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md) en ADR-0006.

- Het functiehuis, functiegroepen, functies, families, senioriteiten, levels, capabilities, Cloud Tags en functieprofielen zijn tenant-owned.
- `employees` is de tenantbrede persoon; `employments` en concrete employee-organization-plaatsingen zijn administration-owned.
- Contract, payroll, salaris, CAO/pensioen, verlof, verzuim, declaraties, roosters, feestdagen en kosten zijn administration-owned.
- Een tenant-owned functie wordt vanuit een administrationeel employment gekoppeld; een tweede job/function-tabel is verboden.
- Een afdeling/divisie is tenant-owned tenzij zij expliciet juridisch exclusief is. Gemengde scope vereist een expliciet `scope_type` en een databasecheck; een lege `administration_id` mag niet als impliciete tenant-scope fungeren.
- Ownership scope en access scope zijn gescheiden. De actieve administratiecookie is nooit voldoende bewijs voor ownership of autorisatie.

Voor elke module moet het ontwerp vóór de tabeldefinitie een ownershipmatrix, koppelrelatie, permissiongrens en twee-administratie-testcase benoemen. Bij conflict met bestaande code is de ownershipmatrix leidend en wordt migratiedrift gedocumenteerd.

---

## 5. Databaseregels

### 5.1 Tenantisolatie

Elke tenantgebonden tabel bevat of erft een betrouwbare tenantidentifier. Foreign keys moeten waar mogelijk tenantconsistentie afdwingen.

Tenantisolatie alleen is niet genoeg: iedere tabel moet ook expliciet aangeven of zij tenant-owned, administration-owned of een gemengde `scope_type` is. Een tenant-owned catalogus mag niet door de actieve administratiecookie worden beperkt; een administration-owned transactie mag niet via tenantbrede catalogustoegang uitlekken.

Verboden:

- tenant-ID vertrouwen die uitsluitend door de browser wordt aangeleverd;
- cross-tenant joins zonder interne validatie;
- brede service-role queries voor normale gebruikersflows;
- generieke RPC’s die alleen op UI-validatie vertrouwen.

### 5.2 Row-Level Security

Wanneer Supabase/PostgreSQL wordt gebruikt:

- schakel RLS in op alle tenant- en persoonsgebonden tabellen;
- definieer afzonderlijke policies voor select, insert, update en delete;
- gebruik bestaande helpers voor tenant en rollen wanneer veilig;
- test positieve én negatieve scenario’s;
- verifieer managerscope server-side;
- gebruik geen `SECURITY DEFINER` als gemakssnelkoppeling.

Voor iedere `SECURITY DEFINER`-functie moet het ontwerp bevatten:

- waarom gewone policies of transacties onvoldoende zijn;
- expliciete `search_path`;
- controle van actor en tenant;
- minimale execute grants;
- negatieve tests voor directe RPC-aanroep;
- auditgedrag.

### 5.3 Migraties

Iedere schemawijziging:

- staat in een versiebeheerbare migratie;
- is herhaalbaar in schone omgevingen;
- bevat constraints en indices;
- vermijdt destructieve wijzigingen zonder backfillpad;
- wordt getest op bestaande data;
- heeft een rollback- of herstelstrategie.

### 5.4 Date-effective profile versions

Gebruik intern bij voorkeur halfopen perioden:

```text
valid_from inclusief
valid_to exclusief
```

Dit voorkomt dagrekenfouten en overlappende grenzen. De UI mag een einddatum als de voorafgaande kalenderdag presenteren.

Database-integriteit moet garanderen:

- geen overlappende actieve perioden voor hetzelfde profiel;
- maximaal één actuele actieve versie per datum;
- Draft mag geen operationele periode claimen;
- activering en afsluiting van de vorige versie gebeuren in één transactie.

Wanneer PostgreSQL beschikbaar is, overweeg een exclusion constraint op dateranges, mits dit past bij de bestaande migratiestandaard.

### 5.5 Unieke namen

Gebruik een consistente normalisatiefunctie, bijvoorbeeld trimmen, whitespace normaliseren en case-insensitive vergelijken. Vermijd losse client-side normalisatie.

Zakelijke constraints:

- capability: tenant + type + normalized_name voor actieve records;
- seniority: tenant + normalized_name voor actieve records;
- job group: tenant + normalized_name;
- job function: tenant + job_group + normalized_name + nullable seniority;
- job family: tenant + normalized_name.

### 5.6 Soft delete en status

Gebruik geen generieke `deleted_at` én `status` zonder duidelijke semantiek. Volg bestaande projectconventies. Functioneel moeten Active/Inactive en profile Draft/Active/Inactive eenduidig blijven.

---

## 6. Service- en transactieregels

### 6.1 Server is autoritatief

De server controleert:

- tenant;
- rol;
- objectstatus;
- referentie-integriteit;
- duplicaten;
- geldigheidsperioden;
- locked level model;
- concurrency.

Clientvalidatie is alleen gebruikersondersteuning.

### 6.2 Commands en queries

Houd schrijfoperaties expliciet. Een command zoals `activateJobProfileVersion` moet alle businesslogica uitvoeren in plaats van meerdere losse clientcalls.

Een activeringscommand:

1. autoriseert HR Admin;
2. laadt profile en relevante versions met lock/concurrencycontrole;
3. valideert draftinhoud;
4. valideert period overlap;
5. sluit vorige active version af;
6. activeert nieuwe version;
7. schrijft audit;
8. commit atomair;
9. retourneert het nieuwe read model.

### 6.3 Idempotentie

Commands die door retry dubbel kunnen worden verstuurd, gebruiken waar passend idempotency keys of controle op gewenste eindstatus.

### 6.4 Optimistic concurrency

Gebruik een bestaande projectconventie zoals `updated_at`, version integer of ETag. Een conflict resulteert in een herkenbare domeinfout, niet in last-write-wins.

### 6.5 Foutmodel

Definieer stabiele foutcodes, bijvoorbeeld:

- `TALENT_FORBIDDEN`
- `TALENT_DUPLICATE_NAME`
- `TALENT_LEVEL_MODEL_LOCKED`
- `TALENT_REFERENCE_IN_USE`
- `TALENT_PROFILE_PERIOD_OVERLAP`
- `TALENT_PROFILE_ACTIVATION_INVALID`
- `TALENT_CONCURRENCY_CONFLICT`
- `TALENT_NOT_FOUND`

De UI vertaalt deze naar duidelijke Nederlandse meldingen.

---

## 7. Front-endarchitectuur

### 7.1 Gebruik bestaand Design System

Herbruik bestaande:

- page shells;
- sidebar/topbar;
- cards;
- tables;
- forms;
- dialogs;
- badges;
- tabs;
- toasts;
- empty states;
- loading skeletons;
- error boundaries;
- accessibility helpers.

Maak geen parallel “Talent Design System”.

### 7.2 Featuregrenzen

Een mogelijke indeling, alleen toepassen wanneer deze past bij de repository:

```text
features/
  talent-configuration/
  capability-library/
  talent-level-model/
  seniority/
  job-architecture/
  job-profiles/
  workforce-talent/
  my-talent/
```

Binnen iedere feature:

- routes/pages;
- UI-components die alleen daar horen;
- queries/commands;
- schemas/types;
- tests.

Generieke componenten gaan pas naar shared wanneer ten minste twee echte consumers bestaan.

### 7.3 Server state

Gebruik het bestaande datafetchingpatroon. Introduceer geen nieuwe state library uitsluitend voor Talent.

- cache keys bevatten tenant en relevante filters;
- mutaties invalideren gerichte queries;
- geen brede “invalidate everything” tenzij noodzakelijk;
- dashboardtellingen en lijsten mogen niet zichtbaar uit elkaar lopen na mutatie.

### 7.4 Formulieren

- schemas worden gedeeld waar mogelijk tussen client en server zonder security te verzwakken;
- dynamic Talent Levels worden uit data geladen;
- status- en typeopties zijn gecontroleerd;
- unsaved changes worden beschermd bij navigatie;
- submit is disabled tijdens verwerking;
- dubbele submits worden voorkomen;
- fouten worden op veld- en formulierniveau weergegeven.

### 7.5 Machtigingen in de UI

Gebruik centrale permission helpers. Verspreid geen losse rolvergelijkingen door componenten.

Voorbeeldconcept:

```ts
canManageTalentConfiguration(actor)
canReadJobProfile(actor, context)
canReadEmployeeTalent(actor, employeeId)
```

De exacte namen volgen bestaande conventies.

### 7.6 UI-referencegebruik

De mockups zijn visueel richtinggevend. Implementeer geen:

- fake health score;
- hardcoded 1–5 niveauknoppen;
- importbutton in fase 1;
- AI analytics;
- persoonlijke matchpercentages;
- approvalteksten;
- verplichte functiefamilie;
- “default seniority”-radio die niet in de Blueprint staat.

---

## 8. Read models en performance

### 8.1 Configuration summary

Bouw een efficiënte query/projectie voor:

- tellingen per capabilitytype;
- aantal groups/functions/profiles;
- status level model;
- aantal seniorities;
- actionable quality issues;
- recent audit events.

Iedere telling gebruikt dezelfde tenant- en statusdefinitie als de onderliggende lijst.

### 8.2 Job House Explorer

- laad eerste niveau efficiënt;
- gebruik lazy loading of een compacte tree-query bij grote datasets;
- geef elke node een stabiel type en ID;
- ondersteun tenants zonder families;
- zoekresultaten geven ancestor-context terug;
- voorkom dat de volledige profielinhoud in de tree-query wordt geladen.

### 8.3 Profile detail

Splits read models indien nodig:

- profile header/version metadata;
- content sections;
- capability requirements;
- usage/impact;
- audit history.

Laad geen zware audit- of usagegegevens wanneer het tabblad niet zichtbaar is, tenzij de bestaande architectuur server-side samenvoeging efficiënter maakt.

### 8.4 My Talent

My Talent resolveert:

1. ingelogde employee identity;
2. actuele employment/function relation;
3. geldige active profile version op de relevante datum;
4. read-only profile content.

Ontbrekende stappen leveren een duidelijke lege toestand, geen 500-fout en geen data van een andere medewerker.

---

## 9. Testarchitectuur

### 9.1 Testpiramide

Gebruik:

- unit tests voor pure normalisatie, periode- en validatielogica;
- database/integration tests voor constraints, RLS en transacties;
- service tests voor commands en permissions;
- component tests voor formulieren en toestanden;
- beperkte end-to-end tests voor kritieke journeys.

### 9.2 Verplichte negatieve securitytests

Minimaal:

- medewerker kan Settings niet lezen;
- manager kan configuratie niet muteren;
- manager kan data buiten scope niet lezen;
- gebruiker van tenant A kan geen object van tenant B lezen of muteren;
- directe API/RPC-call omzeilt UI niet;
- service key is niet in clientbundle aanwezig;
- inactieve capability kan niet nieuw worden gekoppeld;
- locked level model kan niet via directe API worden gewijzigd.

### 9.3 Date-effective tests

Minimaal:

- eerste versie activeren;
- opvolgende versie vandaag;
- toekomstige versie plannen;
- overlappende periode weigeren;
- eerdere open periode correct sluiten;
- query op historische datum;
- timezonegrenzen;
- concurrency bij gelijktijdige activering.

### 9.4 UI-toestanden

Iedere hoofdroute test:

- loading;
- success;
- empty;
- validation error;
- authorization denied;
- server error;
- concurrency conflict waar relevant.

### 9.5 Geen overmatig testen

Test gewijzigde functionaliteit gericht en draai daarnaast relevante regressiesuites. Draai niet bij iedere kleine wijziging onnodig alle zware end-to-end suites. De Implementation Plan specificeert per taak welke tests noodzakelijk zijn.

---

## 10. Migratie- en compatibiliteitsstrategie

### 10.1 Bestaande functiegegevens

Wanneer LiquidHR al Functions en Function Groups bevat:

- hergebruik deze als bron waar semantisch passend;
- maak geen duplicerende Talent-tabellen zonder migratieanalyse;
- map bestaande identifiers stabiel;
- behoud bestaande medewerkersrelaties;
- voeg seniority en profile relation gecontroleerd toe.

### 10.2 Bestaande competenties of tags

- inventariseer bestaande tabellen en UI;
- bepaal of deze naar Capability kunnen migreren. In de testfase mag een foutieve oude catalogus worden opgeschoond; maak geen tweede writeable catalogus en laat geen compatibilitylaag bestaan zonder expliciete klantdata- of contractreden;
- voorkom dat oude en nieuwe bibliotheken gelijktijdig schrijfbaar zijn zonder synchronisatieregels.

### 10.3 Seeds

Senioriteitseed Junior/Medior/Senior wordt tenantveilig en idempotent aangemaakt. Maak geen demo-capabilities, functies of medewerkers aan in productie.

### 10.4 Feature flags

Gebruik bestaande feature-flag- of tenantmodulemechanismen. Minimaal:

- Talent Settings zichtbaar voor bevoegde tenants;
- Workforce Talent zichtbaar volgens moduleconfiguratie;
- My Talent pas zichtbaar wanneer function/profile-resolution betrouwbaar werkt;
- toekomstige modules blijven uit of disabled.

---

## 11. Observability en operationeel beheer

Log minimaal:

- commandnaam;
- actor en tenant in veilige identifiers;
- correlatie-ID;
- uitkomst;
- domeinfoutcode;
- duur;
- objecttype en ID indien toegestaan.

Log niet standaard:

- volledige profielteksten;
- persoonlijke medewerkerdata;
- tokens of secrets;
- ruwe databasefouten naar client.

Definieer dashboards/alerts voor:

- activatiefouten;
- permission failures met onverwachte piek;
- querylatency;
- RLS-fouten;
- migratiefouten;
- My Talent resolution failures.

---

## 12. Vereiste architectuuroutput vóór bouwen

De AI levert eerst de volgende bestanden op:

1. `repository-analysis.md` — feitelijke huidige situatie;
2. `talent-gap-analysis.md` — verschil tussen repository en Blueprint;
3. `talent-technical-design.md` — gekozen architectuur;
4. `talent-data-migration-plan.md` — wanneer bestaande data geraakt wordt;
5. `talent-security-design.md` — rollen, RLS/policies, threat cases;
6. `talent-test-strategy.md` — mapping naar Acceptance Test Pack;
7. `talent-file-map.md` — te creëren/wijzigen bestanden en verantwoordelijkheden.

Deze documenten bevatten geen open invulmarkeringen. Onzekerheden worden als verifieerbare repositoryvragen geformuleerd en vóór implementatie opgelost.

---

## 13. Architectuurreview-checklist

Een ontwerp is pas akkoord wanneer alle vragen met ja kunnen worden beantwoord:

- Is de Product Blueprint volledig gedekt?
- Is de minimale hiërarchie Group → Function zonder Family mogelijk?
- Is Seniority optioneel en onafhankelijk van Talent Levels?
- Is één dynamisch Talent Level Model centraal afgedwongen?
- Wordt het model na eerste gebruik betrouwbaar gelockt?
- Is Capability intern generiek en extern typespecifiek?
- Heeft iedere Function één logisch Profile met datumversies?
- Zijn activeringsperioden niet-overlappend en transactioneel?
- Zijn Settings, Workforce en My Talent technisch én qua rechten gescheiden?
- Zijn managers en medewerkers read-only in fase 1?
- Is tenantisolatie op database- en servicelaag bewezen?
- Wordt bestaande HR-data hergebruikt zonder duplicatie?
- Gebruikt de UI het bestaande LiquidHR Design System?
- Zijn mockupfuncties buiten scope verwijderd?
- Zijn tests gericht, reproduceerbaar en gekoppeld aan acceptatie-ID’s?
- Is het plan klein genoeg om in reviewbare Codex-stappen uit te voeren?

---

## 14. Masterprompt voor de architectuurfase

Gebruik de volgende prompt als startpunt in Codex:

```text
Je werkt in de bestaande LiquidHR-repository voor Edwin Dingjan.

Lees eerst volledig:
1. 01-LiquidHR-Workforce-Talent-Product-Blueprint-v2.0.md
2. 02-LiquidHR-AI-Architecture-Instructions.md
3. 05-LiquidHR-Acceptance-Test-Pack.md
4. repository-instructies zoals AGENTS.md, README en CONTRIBUTING.

Opdracht:
Voer uitsluitend een repository- en architectuuranalyse uit. Implementeer nog niets.

Lever:
- repository-analysis.md
- talent-gap-analysis.md
- talent-technical-design.md
- talent-data-migration-plan.md
- talent-security-design.md
- talent-test-strategy.md
- talent-file-map.md

Randvoorwaarden:
- De Product Blueprint is autoritatief.
- UI-mockups zijn ondersteunend, niet leidend.
- Verzin geen productgedrag.
- Behoud bestaande LiquidHR-conventies.
- Controleer bestaande tabellen voor functions, groups, employees, tags en audit voordat je nieuwe structuren voorstelt.
- Lees en pas `docs/requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md` en ADR-0006 toe; classificeer ieder object als tenant-owned, administration-owned of expliciete scopevariant vóór je schema ontwerpt.
- Modelleer de persoon tenantbreed en employment/contract administrationeel; koppel beide aan één tenant-owned functiebron.
- Identificeer expliciet iedere mogelijke duplicatie of migratie.
- Bouw geen AI, import, assessments, approvals, profile comparison of team analytics.
- Lever concrete bestandspaden, databasemigraties, policies, interfaces en testlocaties op basis van wat werkelijk in de repository bestaat.
- Stop na de documenten en geef een korte samenvatting van risico’s en aanbevolen implementatievolgorde.
```

---

**Einde AI Architecture Instructions**
