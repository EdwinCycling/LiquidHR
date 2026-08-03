# Talent Management - uitgebreid functioneel testdocument

**Laatste controle-instructie:** 3 augustus 2026  
**Omgeving:** lokale/testomgeving, standaard `http://localhost:3000`  
**Tenant:** `Liquid HR Demo Holding` (`liquid-hr-demo-holding`)  
**Doel:** handmatig vaststellen wat een HR-admin, manager en medewerker kunnen openen, bekijken, wijzigen en juist niet mogen zien.

Dit document is de praktische testhandleiding voor de Talent Management-slice. Het is bedoeld om de test stap voor stap opnieuw uit te voeren en bevindingen vast te leggen. Een redirect naar een loginpagina of een HTTP 200 is op zichzelf geen bewijs dat de geauthenticeerde UI en autorisatie goed werken; controleer altijd de zichtbare pagina, de ingelogde rol en de inhoud.

## 1. Veilig gebruik van de testomgeving

- Gebruik uitsluitend de lokale/testtenant. Voer deze stappen niet uit op productie of met echte HR-data.
- Noteer nooit wachtwoorden, Supabase-tokens, sessiecookies of volledige API-responses met persoonsgegevens in dit document of in screenshots.
- De drie fixtureaccounts zijn testaccounts. Controleer na het inloggen de zichtbare naam en tenant voordat je data beoordeelt.
- Wijzig alleen data waar in deze handleiding expliciet **optioneel** bij staat. De seeddata is de vergelijkingsbasis voor de volgende testrun.
- Als verwachte seeddata ontbreekt, verzin dan geen record. Noteer `testdata ontbreekt`, de rol, route, datum/tijd en eventueel een geanonimiseerde screenshot.
- Verwijder geen bestaande medewerker, functie, functieprofiel, capability of doel als onderdeel van deze test. Gebruik voor een mutatietest een nieuw herkenbaar testrecord en archiveer/deactiveer het daarna volgens de bestaande UI-flow.

## 2. Accounts en rollen

Gebruik de e-mailadressen hieronder. De wachtwoorden staan uitsluitend lokaal in `.env.talent-auth.local` of in de afgesproken testpassword-manager en horen niet in dit document.

| Rol | Fixtureaccount | Scope die je moet testen | Wat deze rol in hoofdlijnen mag |
|---|---|---|---|
| HR Admin | `hradmin.fixture@liquidhr.test` | Hele demo-tenant | Talent Management configureren, tenantbrede talentdata bekijken en HR-opvolging uitvoeren |
| Manager | `manager.fixture@liquidhr.test` | Eigen directe medewerkers/team | Talentdata van de eigen scope bekijken en manager-check-ins uitvoeren |
| Medewerker | `employee.fixture@liquidhr.test` | Alleen eigen medewerkerrecord | Eigen talentprofiel, eigen doelen, eigen reflectie en eigen rapportage bekijken/bijwerken |

### Referentiepersonen in de data

Deze namen zijn selecties in bepaalde schermen en geen extra loginaccounts:

| Persoon | Referentie | Waarvoor gebruiken |
|---|---|---|
| Edwin Testbeheerder | `DEMO-001` | HR-admincontrole in Role Explorer |
| Noah Hendriks | P3-fixturemedewerker | Historische, actuele en toekomstige capability-/doeldata en check-ins |
| Lucas De Boer | `DEMO-029` | Managercontrole van een medewerker in de directe scope |

Als de fixtureaccount bij een andere medewerker hoort dan hierboven, gebruik dan de feitelijke gekoppelde medewerker die op het scherm staat en noteer dat verschil als bevinding. De accountnaam is leidend voor autorisatie; een handmatig gekozen `employeeId` mag de scope niet kunnen omzeilen.

## 3. Testomgeving voorbereiden

1. Start de app vanuit de repositoryroot met de afgesproken lokale ontwikkelopdracht, bijvoorbeeld `npm.cmd run dev`.
2. Open `http://localhost:3000/login` in een nieuwe browsersessie.
3. Gebruik per rol een aparte sessie of log volledig uit voordat je naar de volgende rol gaat. Gebruik geen gedeelde oude cookies.
4. Controleer na iedere login:
   - de zichtbare accountnaam;
   - de tenantnaam `Liquid HR Demo Holding`;
   - de beschikbare navigatie;
   - de landingsroute voor de rol.
5. Open bij browsercontrole de developer console alleen wanneer dat nodig is. Deel geen tokens of cookie-inhoud.
6. Noteer voor de test: datum/tijd, commit of lokale branch, browser, viewport en ingelogde rol.

### Optionele geautomatiseerde releasegate

De releasegate staat in `apps/hr-suite/scripts/talent-release-gate.mjs`. Deze gebruikt de volgende lokale environmentvariabelen:

```text
TALENT_RELEASE_BASE_URL
TALENT_HR_ADMIN_EMAIL
TALENT_HR_ADMIN_PASSWORD
TALENT_MANAGER_EMAIL
TALENT_MANAGER_PASSWORD
TALENT_EMPLOYEE_EMAIL
TALENT_EMPLOYEE_PASSWORD
TALENT_CROSS_TENANT_CAPABILITY_ID
TALENT_OTHER_EMPLOYEE_ID
TALENT_OUT_OF_SCOPE_JOB_CODE
```

Zet de waarden lokaal in de omgeving; zet wachtwoorden en fixture-ID's niet in Git en plak ze niet in dit document. Als een variabele ontbreekt, is de gate niet volledig uitgevoerd. Meld dat als `blocked: fixtureconfiguratie ontbreekt`, niet als een functionele pass.

## 4. Verwachte testdata

De volgende data hoort in de demo-tenant aanwezig te zijn wanneer de Talent-seedmigraties zijn toegepast.

### 4.1 Capabilityrecords van de P3-fixture

| Periode | Capability | Niveau | Bron | Verwacht gedrag |
|---|---|---:|---|---|
| 1 januari 2026 t/m 30 juni 2026 | `ADAPTABILITY` | L1 | HR | Alleen zichtbaar bij historische periode |
| Vanaf 1 juli 2026 | `COACHING` | L2 | Manager | Alleen zichtbaar bij actuele periode |
| 1 januari 2027 t/m 31 december 2027 | `LEADERSHIP` | L1 | HR | Alleen zichtbaar bij toekomstige periode |

De actuele records zijn released. Controleer ook dat de bron als bronlabel wordt getoond en niet wordt vervangen door een fictieve score of advies.

### 4.2 Ontwikkeldoelen van de P3-fixture

| Periode | Titel | Status | Voortgang | Verwacht gedrag |
|---|---|---|---:|---|
| 1 januari 2026 t/m 31 maart 2026 | `P3 historisch reflectiedoel` | `COMPLETED` | - | Historisch filterresultaat |
| 1 juli 2026 t/m 31 december 2026 | `P3 huidig ontwikkeldoel` | `ACTIVE` | 45% | Actueel doel met check-ins |
| 1 januari 2027 t/m 30 juni 2027 | `P3 toekomstig leerdoel` | `DRAFT` | - | Toekomstig concept; niet presenteren als afgerond |

### 4.3 Check-ins op het actuele doel

Het actuele doel hoort drie afzonderlijke check-in-typen te hebben:

| Check-in | Verwacht zichtbaar voor medewerker | Verwacht zichtbaar voor manager | Verwacht zichtbaar voor HR |
|---|---|---|---|
| Medewerkerreflectie | Ja, eigen reflectie | Nee, inhoud afgeschermd | Ja, in HR-scope |
| Managerobservatie | Nee | Ja | Ja |
| Follow-up/vervolgactie | Nee | Ja | Ja |

De afscherming geldt voor de inhoud, niet alleen voor het verbergen van een knop. Controleer zo nodig ook de API-response zonder gevoelige inhoud te bewaren.

### 4.4 Notificaties

| Ontvanger | Type | Titel |
|---|---|---|
| Medewerker | `GOAL_OPEN` | `Open ontwikkeldoel` |
| Manager | `ASSESSMENT_PENDING` | `Assessment opvolgen` |
| Manager | `IMPORT_COMPLETED` | `Import afgerond` |
| Medewerker | `QUALIFICATION_EXPIRING` | `Geldigheid controleren` |
| Manager | `CHECKIN_DUE` | `Opvolgactie gepland` |

De vervaldatum van de follow-up is relatief gezaaid op ongeveer 14 dagen vanaf de seedbewerking. Verwacht dus geen vaste kalenderdatum als de database opnieuw is gevuld.

### 4.5 Talentcatalogus en functieprofielen

De demo-catalogus bevat onder meer de jobcodes `M1`, `TEST-CUSTOMER`, `TEST-MANAGER`, `TEST-PLANNER`, `TEST-SUPERVISOR` en `TEST-WAREHOUSE`. Controleer dat een functieprofiel gekoppeld is aan het functiehuis en niet wordt verward met de bestaande inrichting van `Functies en functiegroepen`.

Belangrijke profielvereisten voor gerichte controle:

| Jobcode | Verplichte vereisten | Voorkeursvereisten |
|---|---|---|
| `TEST-CUSTOMER` | `CUSTOMER_FOCUS` L3, `STAKEHOLDER_COMMUNICATION` L2 | `NEGOTIATION` L2, `ENGLISH` CEFR B2 |
| `TEST-MANAGER` | `LEADERSHIP` L3, `COACHING` L3, `EMPLOYMENT_LAW` L2 | `ENGLISH` CEFR B2 |
| `TEST-PLANNER` | `PLANNING_PRIORITIZATION` L3, `DATA_ANALYSIS` L2 | `PROCESS_IMPROVEMENT` L2, `GERMAN` CEFR A2 |
| `TEST-SUPERVISOR` | `LEADERSHIP` L2, `SAFETY_AWARENESS` L3, `BHV` certificaat | `VCA` certificaat |
| `TEST-WAREHOUSE` | `SUPPLY_CHAIN` L2, `SAFETY_AWARENESS` L2 | `DIGITAL_TOOLS` L1, `BHV` certificaat |
| `M1` | `OWNERSHIP` L2, `QUALITY_AWARENESS` L2, `SAFETY_AWARENESS` L2, `DUTCH` | - |

Voor `TEST-MANAGER` bestaat naast versie 1 actief ook een versie 2 als concept met ingangsdatum 1 januari 2027. Controleer dat een conceptversie niet stilzwijgend als actuele versie wordt gebruikt.

## 5. Snelle definitie van geslaagd

Vink een item pas af als je de echte ingelogde pagina en inhoud hebt gecontroleerd.

| Controle | Pass-criterium | Pass |
|---|---|:---:|
| Startscherm Talent Management | Pagina opent met een duidelijke Start-sectie | [ ] |
| Accordiongedrag | Eén sectie opent en sluit; er zijn geen losse Talentknoppen buiten Start | [ ] |
| Performance | Eerste HR-load haalt geen zware Talentcatalogus op; data laadt pas bij openen van de sectie | [ ] |
| Naamgeving | `Talent Management`, `Functieprofielen - gekoppeld aan het functiehuis` en `Bestaande functie` zijn begrijpelijk | [ ] |
| HR-scope | HR ziet tenantbrede Talentdata en beheeropties | [ ] |
| Manager-scope | Manager ziet alleen eigen team/scope en geen HR-beheer | [ ] |
| Medewerker-scope | Medewerker ziet alleen eigen talentdata en eigen reflectie | [ ] |
| Check-in-privacy | Reflectie, observatie en follow-up hebben de juiste inhoudsgrenzen | [ ] |
| Periodefilters | Historisch, actueel en toekomstig tonen elk de juiste records | [ ] |
| API-beveiliging | Directe URL/API-aanroep omzeilt de rolgrenzen niet | [ ] |
| Geen fictieve beoordeling | Geen verborgen score, ranking, AI-advies of automatische loopbaanbeslissing | [ ] |

## 6. Test A - HR Admin

**Account:** `hradmin.fixture@liquidhr.test`  
**Hoofdroute:** `/settings/talent`

### A1. Talent Management en Start

1. Open `/settings/talent`.
2. Controleer dat de zichtbare titel **Talent Management** is.
3. Controleer dat **Start** standaard open is.
4. Controleer dat alle Talentlinks binnen Start staan en dat er geen Talentbeheerknop buiten de accordion staat.
5. Klik op de Start-header: de inhoud moet sluiten.
6. Klik opnieuw: de inhoud moet openen.
7. Open een andere hoofdsectie: de vorige sectie moet sluiten wanneer exclusieve accordionwerking is bedoeld.
8. Gebruik toetsenbordbediening: Tab naar de header, Enter/Space om te openen en Escape wanneer de component dit ondersteunt.
9. Controleer in Network/console alleen de requestnamen en timing, zonder responsegegevens te kopiëren:
   - eerste load: autorisatie, vertalingen en Start;
   - na openen: alleen de API's voor die sectie;
   - opnieuw openen: geen onnodige tweede identieke zware load.

**Verwacht:** de pagina is snel bruikbaar; zware profielen, capabilityrecords en fundamentdata worden niet allemaal op de eerste render opgehaald. Er staat geen verwarrende knop buiten Start.

### A2. Functieprofielen en functiehuis

1. Open **Functieprofielen - gekoppeld aan het functiehuis**.
2. Controleer de koppeling met het functiehuis en de aanwezige jobcodes uit paragraaf 4.5.
3. Open een profiel, bijvoorbeeld `TEST-MANAGER`.
4. Controleer actieve versie 1 en de vereisten `LEADERSHIP`, `COACHING`, `EMPLOYMENT_LAW` en `ENGLISH`.
5. Controleer dat versie 2 met ingangsdatum 1 januari 2027 als concept herkenbaar blijft.
6. Ga naar de HR-inrichting voor `Functies en functiegroepen` en vergelijk de context:
   - `Functies en functiegroepen` blijft de organisatorische/functionele stamdata;
   - Talent Management gebruikt functieprofielen en capabilityvereisten gekoppeld aan het functiehuis;
   - een gebruiker moet niet dezelfde beheeractie op twee plaatsen verwachten.
7. Controleer dat een beheeractie voor profieldata binnen de geopende sectie blijft.

**Verwacht:** de naamgeving maakt het onderscheid zichtbaar. Er wordt geen tweede losstaande lijst met dezelfde functiebetekenis gepresenteerd.

### A3. Persoonlijke capabilityregistraties

1. Open **Persoonlijke capabilityregistraties**.
2. Zoek de fixturemedewerker en controleer de drie records uit paragraaf 4.1.
3. Controleer bron, niveau, status en geldigheidsperiode.
4. Gebruik de historische periode 1 januari 2026 t/m 30 juni 2026: alleen `ADAPTABILITY` hoort in de historische set.
5. Gebruik de actuele periode 1 juli 2026 t/m 31 december 2026: alleen `COACHING` hoort in de actuele set.
6. Gebruik de toekomstige periode 1 januari 2027 t/m 30 juni 2027: alleen `LEADERSHIP` hoort in de toekomstige set.
7. Controleer dat filters niet alleen de tabel verbergen, maar ook de API-scope respecteren.

**Verwacht:** tenantbrede HR-scope, correcte periode- en bronlabels, geen gefingeerde score of automatisch advies.

### A4. Talentbibliotheek en niveaumodel

Open **Talentbibliotheek en niveaumodel** en controleer de onderdelen die zichtbaar zijn. De bestaande basis hoort in ieder geval herkenbaar te zijn:

- niveaumodel: Basis, Zelfstandig, Gevorderd, Expert;
- senioriteiten: Junior, Medior, Senior;
- jobgroep: HR Advies;
- functies: HR Adviseur Junior, HR Adviseur Medior, HR Adviseur Senior en Directeur zonder senioriteit;
- capabilitybibliotheek met onder andere Stakeholdermanagement, Data-analyse, Arbeidsrecht, Engels en Payroll Professional.

Controleer zoeken, filteren, selectie en de modal voor toevoegen/wijzigen. De beheersactie hoort binnen de geopende accordion te staan. Archiveer/deactiveer een bestaand catalogusrecord niet als onderdeel van deze controle.

### A5. Doelen, check-ins en meldingen

1. Open `/settings/talent/goals`.
2. Zoek het actuele doel en controleer status `ACTIVE`, voortgang 45% en de drie check-ins.
3. Controleer dat HR alle drie check-in-typen kan zien, inclusief de inhoud van de medewerkerreflectie.
4. Open `/settings/talent/reports` en controleer de drie periodefilters en CSV-export. De export moet dezelfde scope en periodefilters gebruiken als het scherm.
5. Open de Talentmeldingen vanuit de HR-route en controleer de vijf meldingen uit paragraaf 4.4.
6. Markeer desgewenst één melding als gelezen. Noteer vóór en na de actie welke status veranderde.
7. Controleer aanvullend, indien in de navigatie beschikbaar:
   - `/settings/talent/assessments`;
   - `/settings/talent/comparison`;
   - `/settings/talent/import`;
   - `/settings/talent/team`.

**Verwacht:** HR heeft tenantbrede opvolging en beheer, maar de inhoud blijft brongetrouw. Import en wijzigingen zijn geen manager- of medewerkerfunctie.

### A6. HR Role Explorer

1. Open `/settings/talent/role-explorer`.
2. Selecteer `Edwin Testbeheerder · DEMO-001`.
3. Selecteer `TEST-MANAGER · v1 · Binnendienst!`.
4. Controleer dat ongeveer 58 medewerkers in de HR-scope beschikbaar zijn.
5. Controleer de vier managervereisten uit de profieltabel.
6. Controleer dat per requirement bron, status en geldigheid zichtbaar zijn, maar geen verzonnen bewijsinhoud.
7. Controleer dat de URL na selectie `employeeId` en `profileVersionId` bevat zonder tokens of wachtwoorden.
8. Controleer radar en tabel: hetzelfde aantal assen/vereisten, legenda niet uitsluitend door kleur, en bediening met toetsenbord.

## 7. Test B - Manager

**Account:** `manager.fixture@liquidhr.test`  
**Hoofdroute:** `/workforce/talent`

### B1. Managerdashboard en team-scope

1. Open `/workforce/talent`.
2. Controleer de zichtbare titel en de team-/scopefilters.
3. Zoek een medewerker uit de eigen scope, bijvoorbeeld `Lucas De Boer · DEMO-029`.
4. Controleer dat alleen directe medewerkers of toegestane managerscope zichtbaar is.
5. Controleer dat HR-beheerknoppen, catalogusbeheer en importbeheer niet zichtbaar zijn.
6. Open `/workforce/talent/goals` en controleer het actuele doel en managercheck-ins.
7. Open `/workforce/talent/reports` en controleer dat rapportage alleen de managerscope bevat.

**Verwacht:** de manager kan operationeel opvolgen binnen de eigen scope, niet de Talentcatalogus of HR-inrichting beheren.

### B2. Check-ins

1. Open het actuele doel.
2. Controleer dat de managerobservatie en follow-up zichtbaar zijn.
3. Controleer dat de tekst van de medewerkerreflectie niet zichtbaar is.
4. Voeg alleen als mutatietest gewenst een nieuwe managerobservatie of follow-up toe.
5. Gebruik een duidelijk testlabel in de tekst, bijvoorbeeld `MANUAL-TEST - verwijderen na controle`, en leg de datum vast.
6. Controleer na opslaan dat de nieuwe tekst voor de manager zichtbaar is.
7. Controleer met het medewerkeraccount dat deze managertekst niet zichtbaar wordt.

### B3. Manager Role Explorer

1. Open `/workforce/talent/role-explorer`.
2. Selecteer `Lucas De Boer · DEMO-029`.
3. Selecteer `TEST-PLANNER · v1 · Binnendienst!`.
4. Controleer ongeveer 22 zichtbare medewerkers en vier requirements.
5. Controleer dat een medewerker buiten de managerscope niet als keuze verschijnt.
6. Controleer de URL-selectie, radar/tabel en keyboard-focus zoals bij A6.

### B4. Manager-denies

Open rechtstreeks:

- `/settings/talent`;
- `/settings/talent/import`;
- `/my-talent`.

**Verwacht:** de manager krijgt een nette login- of geen-toegang-flow en ziet geen HR-data. Probeer niet via een verborgen link of handmatig gewijzigde URL alsnog een beheeractie uit te voeren.

## 8. Test C - Medewerker

**Account:** `employee.fixture@liquidhr.test`  
**Hoofdroute:** `/my-talent`

### C1. Eigen talentdashboard

1. Log in met het medewerkeraccount.
2. Controleer dat de landing naar `/dashboard/start` gaat en niet naar een onbevoegde HR-/Workforce-pagina.
3. Open `/my-talent`.
4. Controleer dat alleen het eigen talentprofiel en eigen doelen zichtbaar zijn.
5. Controleer dat er geen HR-beheer-, import-, team- of tenantbrede knoppen zichtbaar zijn.
6. Open `/my-talent/goals` en controleer het actuele doel, de eigen reflectie en de periodegegevens.
7. Controleer `/my-talent/reports` en exporteer alleen wanneer dit onderdeel in de testrun wordt meegenomen. De export mag uitsluitend eigen scope bevatten.

### C2. Eigen check-in

1. Open het actuele doel en de check-ins.
2. Controleer dat de eigen reflectie zichtbaar is.
3. Controleer dat managerobservatie en follow-up niet zichtbaar zijn, ook niet in een samenvatting of verborgen detailpaneel.
4. Voeg desgewenst één eigen reflectie toe met een duidelijk testlabel.
5. Controleer opslaan, opnieuw openen en eventueel bewerken van de eigen reflectie.
6. Controleer daarna met manager en HR dat de juiste rolgrenzen blijven gelden.

### C3. Medewerker Role Explorer

1. Open `/my-talent/role-explorer`.
2. Kies `TEST-CUSTOMER · v1 · Binnendienst!`.
3. Controleer dat één medewerker zichtbaar is: de medewerker zelf.
4. Controleer de vier profileisen uit de profieltabel.
5. Controleer dat geen andere medewerker, managerobservatie of HR-beheerdata zichtbaar wordt.
6. Controleer tabel, radar, legenda, URL en keyboard-focus.

### C4. Medewerker-denies

Open rechtstreeks:

- `/workforce/talent`;
- `/settings/talent`;
- `/settings/talent/import`;
- `/departments` als algemene negatieve routecontrole.

**Verwacht:** de medewerker krijgt `/geen-toegang` of de afgesproken login-flow en ontvangt geen pagina- of API-data uit de andere scope.

## 9. Negatieve autorisatie- en privacytests

Voer deze controles per relevante rol uit. Bewaar geen gevoelige responsebody; noteer alleen statuscode, route en pass/fail.

| Test | Uitvoering | Verwacht |
|---|---|---|
| Manager naar HR-route | Open `/settings/talent` en `/settings/talent/import` | Geen toegang; geen HR-data |
| Medewerker naar manager/HR-route | Open `/workforce/talent` en `/settings/talent` | Geen toegang; geen team- of catalogusdata |
| Manager capability-mutatie | POST naar `/api/talent/capabilities` met een testpayload | `401` of `403`; geen record aangemaakt |
| Medewerker capability-mutatie | POST naar `/api/talent/capabilities` met een testpayload | `401` of `403`; geen record aangemaakt |
| Cross-tenant capability | Lees de door `TALENT_CROSS_TENANT_CAPABILITY_ID` aangewezen capability | `403` of `404`; nooit data uit tenant `noorderlicht-zorggroep` |
| Medewerker foreign employeeId | Vergelijk `/api/talent/my` zonder `employeeId` met een verzoek met een andere employee-ID | Zelfde eigen scope of afwijzing; nooit andermans record |
| Manager buiten scope | Kies een out-of-scope medewerker/jobcode | Niet beschikbaar of server-side geweigerd |
| UI-bypass | Open een verborgen beheer-URL rechtstreeks | Server-side geweigerd; alleen knop verbergen is onvoldoende |
| Tenantwissel in URL | Wijzig route-ID's of profiel-ID's handmatig | Geen cross-tenant of buiten-scope data |

## 10. Performancecontrole in de browser

Deze controle is bedoeld voor de recente start-first wijziging van `/settings/talent` en voor een brede sanitycheck van de hoofdrolroutes.

### HR-adminpagina

- [ ] Eerste paginaweergave toont Start zonder te wachten op alle Talentcatalogusdata.
- [ ] De browser maakt bij eerste render geen onnodige requests voor alle drie zware secties.
- [ ] Functieprofielen laden pas na openen van die accordion.
- [ ] Capabilityregistraties laden pas na openen van die accordion.
- [ ] Talentbibliotheek/niveaumodel laden pas na openen van die accordion.
- [ ] Terug openen gebruikt geladen data waar dat door de UI is bedoeld; er ontstaat geen request-loop.
- [ ] Een trage of lege optionele sectie blokkeert Start en de overige secties niet.
- [ ] Console bevat geen nieuwe React-warning, uncaught exception of herhaalde requestfout.

### Hoofdrollen

Meet per route minstens één koude load en één warme load:

| Route | Koud geladen | Warm geladen | Wat je beoordeelt |
|---|:---:|:---:|---|
| `/settings/talent` | [ ] | [ ] | Start-first, accordion en lazy data |
| `/workforce/talent` | [ ] | [ ] | Teamlijst, filters en scope |
| `/my-talent` | [ ] | [ ] | Eigen profiel, doelen en meldingen |
| `/settings/talent/reports` of rolvariant | [ ] | [ ] | Periodefilter, rapport en export |

Noteer geen precieze milliseconde als losse indruk. Leg bij een probleem vast: route, rol, koude/warme load, zichtbare wachttijd, request die traag is, consolefout en of de pagina bruikbaar blijft. Een onauthentieke HTTP-redirectmeting is alleen guard-performance en geen bewijs van geauthenticeerde UI-performance.

## 11. Wat mag je instellen of wijzigen?

Gebruik onderstaande volgorde zodat de basisdata intact blijft.

| Actie | Rol | Risico | Werkwijze |
|---|---|---|---|
| Accordion openen/sluiten | Alle relevante rollen | Geen datawijziging | Vrij uitvoeren; controleer exclusiviteit en keyboardbediening |
| Melding als gelezen markeren | HR/ontvanger volgens UI | Lage statewijziging | Noteer de melding vóór en na; reset alleen via afgesproken testdataflow |
| Eigen medewerkerreflectie toevoegen | Medewerker | Lage functionele mutatie | Gebruik duidelijk testlabel; controleer alleen eigen zichtbaarheid |
| Managerobservatie/follow-up toevoegen | Manager | Lage functionele mutatie | Gebruik duidelijk testlabel en controleer due date/scope |
| Nieuw capability-testrecord | HR Admin | Middel | Alleen met expliciete toestemming; code begint met `MANUAL-TEST-` |
| Nieuw profiel-/catalogustestrecord | HR Admin | Middel | Alleen via modal, niet activeren op bestaande productiebetekenis |
| Bestaand record archiveren/deactiveren | HR Admin | Hoog | Alleen als de test dit expliciet vraagt; nooit tijdens een gewone regressietest |

Verander voor deze herhaaltest geen actieve seedfunctie, actieve profileversie, bestaande medewerker, RLS-policy of tenantkoppeling.

## 12. Wat mag je beslist niet zien?

### Medewerker

- geen managerobservatie of follow-up-inhoud;
- geen andere medewerkers, teamlijst of tenantbrede rapporten;
- geen HR-instellingen, catalogusbeheer, import of beheerknoppen;
- geen andere tenantdata;
- geen verborgen gevoelige informatie wanneer een detailpaneel of export wordt geopend;
- geen automatische score, ranking, AI-advies of loopbaanbesluit.

### Manager

- geen HR-catalogusbeheer of importbeheer;
- geen tekst van de medewerkerreflectie;
- geen medewerkers buiten de eigen managerscope;
- geen andere tenantdata;
- geen capabilitybeheer dat alleen voor HR is toegestaan;
- geen automatische beoordeling die niet als brongegeven is ingevoerd.

### HR Admin

- geen data buiten de actieve tenant;
- geen fictieve evidence-inhoud of automatisch gegenereerde beoordelingen;
- geen verwarring tussen `Functies en functiegroepen` en Talent-functieprofielen;
- geen wachtwoorden, sessietokens of onnodige persoonsgegevens in de UI.

## 13. Dashboards en routekaart

| Doelgroep | Start/dashboard | Doelen en check-ins | Rapportage | Role Explorer |
|---|---|---|---|---|
| HR Admin | `/settings/talent` | `/settings/talent/goals` | `/settings/talent/reports` | `/settings/talent/role-explorer` |
| Manager | `/workforce/talent` | `/workforce/talent/goals` | `/workforce/talent/reports` | `/workforce/talent/role-explorer` |
| Medewerker | `/my-talent` | `/my-talent/goals` | `/my-talent/reports` | `/my-talent/role-explorer` |

Aanvullende HR/manager/medewerker-routes kunnen assessments, comparison, team en import bevatten. Beoordeel iedere aanvullende route vanuit de ingelogde rol; een route die technisch bestaat is niet automatisch voor iedere rol toegestaan.

## 14. Bewijs en bevindingen vastleggen

Gebruik per testactie één regel. Schrijf bij `Werkelijk` concreet wat je zag, zonder wachtwoorden, tokens of onnodige persoonsgegevens.

| Datum/tijd | Rol | Route | Stap | Verwacht | Werkelijk | Pass/fail | Bewijs/verwijzing |
|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |

Gebruik voor een defect minimaal deze gegevens:

- accountrol, niet het wachtwoord;
- route en eventueel niet-gevoelige recordcode;
- reproduceerstappen;
- verwacht gedrag;
- werkelijk gedrag;
- statuscode of consolefout als die relevant is;
- koude/warme load bij performanceproblemen;
- screenshot zonder persoonsgegevens of secrets;
- commit/branch en datum.

## 15. Bekende aandachtspunten bij deze testrun

- De actuele UI-naam is **Talent Management**. Een oudere releasegate kan nog zoeken naar `Talentfundament`; dat is een testautomatiseringslabel dat moet worden afgestemd en geen reden om de huidige UI terug te noemen.
- De drie-rollen browsergate kan niet volledig worden herhaald zolang de lokale fixturecredentials niet in de omgeving zijn geladen.
- De testdata is afhankelijk van de Talent-seedmigraties. Ontbrekende data is een omgevings-/seedbevinding, geen aanleiding om handmatig willekeurige data te verzinnen.
- De losse repository-typecheck heeft een bekende, niet aan deze Talentwijziging gerelateerde fout in `apps/hr-suite/lib/weather/open-meteo.ts:102`; de productiebuild en gerichte Talentchecks zijn daarvan te onderscheiden.
- Er is voor dit document geen remote databasewijziging, seedreset, deployment of commit uitgevoerd.

## 16. Bronnen voor herhaalbaarheid

- [P3 testplan en handoff](TALENT_P3_TESTPLAN_AND_HANDOFF_20260803.md)
- [Talent acceptance test pack](../requirements/Talent/05-LiquidHR-Acceptance-Test-Pack.md)
- [Talent releasegate](../../apps/hr-suite/scripts/talent-release-gate.mjs)
- [P3-fixturedata](../../apps/hr-suite/supabase/migrations/20260803091000_seed_talent_phase3_fixture_data.sql)
- [Talent demo-catalogus](../../apps/hr-suite/supabase/migrations/20260802061252_seed_talent_demo_catalog.sql)
- [Talent read-model/test assignments](../../apps/hr-suite/supabase/migrations/20260802123000_complete_talent_read_models.sql)
- [Cross-tenant negatieve fixture](../../apps/hr-suite/supabase/migrations/20260802160000_seed_talent_cross_tenant_release_fixture.sql)

