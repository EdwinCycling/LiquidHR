# Uitvoeringsplan: herstructurering medewerker, dienstverband, contract en tijdlijnen

Status: **PLAN — nog niet uitgevoerd**

Datum: **2026-07-29**

Beoogde applicatieversie na volledige implementatie: **`1.20260729.4`**, mits er vóór afronding geen andere versieverhoging plaatsvindt. De versie wordt pas verhoogd nadat schema, gecontroleerde testdatareset/herinrichting, API, UI en browsercontrole groen zijn.

Bronnen:

- opdracht van de gebruiker van 2026-07-29;
- `Screenshot 2026-07-29 084013.png` — medewerker type;
- `Screenshot 2026-07-29 084129.png` — flexfase;
- `docs/requirements/core-hr/MEDEWERKER.md`;
- `docs/requirements/employment/CONTRACT_EN_DIENSTVERBAND.md`;
- `docs/requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md`;
- `docs/requirements/authorization/AUTORISATIE_EN_RECHTEN.md`;
- `docs/decisions/ADR-0003-employee-employment-ikv-en-herintreding.md`;
- bestaande implementatie en ingelogde nulmeting op `http://localhost:3000`.

Databesluit gebruiker 2026-07-29:

- de huidige data is testdata;
- bestaande testrecords mogen worden verwijderd of gewijzigd;
- behoud van bestaande Employment-, Contract-, IKV-, rooster-, salaris-, organisatie- en kostenfixtures is daarom geen acceptatiecriterium;
- de uitvoering moet wel een coherent, reproduceerbaar testscenario achterlaten en mag geen verweesde referenties in andere modules veroorzaken.

## 1. Doel en gebruikersuitkomst

De bestaande structuur wordt aangepast van:

`Employee → Employment met contractvelden → losse tijdlijnen`

naar:

`Employee → één of meer Employments → één of meer aansluitende Contracts`

met daarnaast per Employment onafhankelijke, aansluitende tijdlijnen voor:

1. rooster en uren;
2. salaris;
3. organisatieplaatsing;
4. kostenverdeling.

Na afronding kan een bevoegde HR-gebruiker:

- meerdere parallelle en sequentiële dienstverbanden voor dezelfde medewerker beheren;
- per Employment precies één overlappend primair Employment hebben;
- een IKV-nummer van 1 tot en met 99 vastleggen;
- het contractland per Employment vastleggen en landafhankelijke uitdienstredenen gebruiken;
- meerdere volledig aansluitende contracten onder één Employment beheren;
- een nieuw Employment en het eerste Contract in één wizard publiceren;
- later een opvolgend Contract via dezelfde contractwizard toevoegen;
- ontbrekende verplichte persoonsgegevens aanvullen voordat publicatie mogelijk is;
- contracten, roosters, salarissen, organisatieplaatsingen en kostenverdelingen als selecteerbare tijdlijnkaarten bekijken en wijzigen;
- alle stamgegevens vanuit HR-instellingen beheren.

## 2. Vastgestelde domeingrenzen

### 2.1 Employee

`employees` blijft de blijvende persoonsidentiteit binnen de tenant.

- Een Employee kan nul, één of meerdere Employments hebben.
- Parallelle Employments zijn toegestaan, ook binnen dezelfde administratie.
- Uitdiensttreding archiveert de Employee niet.
- Herintreding maakt een nieuw Employment onder dezelfde Employee.
- Personeelsnummer, nationaliteit, geboortedatum en geslacht blijven Employee-gegevens.
- BSN blijft uitsluitend versleuteld in `employee_secure_identifiers`.

### 2.2 Employment

Een Employment is de arbeidsrechtelijke relatie met de administratie.

De Employment bevat na de herstructurering:

- `employment_number`;
- `is_primary`;
- `starts_on`;
- `ends_on`, uitsluitend gevuld via de uitdienstworkflow;
- `seniority_date`;
- `country_code`;
- status als afleiding, niet als handmatig actief-vinkje;
- de fiscale IKV-koppeling;
- de bevestigde uitdienstmelding en uitdienstreden.

`contract_type`, `employment_type`, `probation_ends_on` en contractdocumentvelden worden niet langer als actuele bron op `employments` gebruikt. Ze verhuizen naar de contractlaag. Oude kolommen worden pas verwijderd nadat alle lezers en historische data aantoonbaar zijn gemigreerd.

### 2.3 Income Relationship / IKV

De bestaande scheiding tussen Employment en `income_relationships` blijft leidend.

- IKV-nummer is een geheel getal tussen **1 en 99**.
- De wizard stelt het eerste beschikbare nummer binnen de administratie en het payrollsubnummer voor; hij gebruikt niet simpelweg `max + 1`.
- De bestaande effective-dated koppeling `employment_income_relationships` blijft behouden.
- Basis- en IKV-gegevens worden in het Employment-overzicht getoond; er komt geen afzonderlijke tab **Basis & IKV** meer.

### 2.4 Employment Contract

Nieuwe tabel: `employment_contracts`.

Een Contract bevat:

- `tenant_id`, `administration_id`, `employee_id`, `employment_id`;
- automatisch `sequence_number`;
- `worker_type`;
- optioneel `flex_phase_id`, verplicht voor uitzendkrachten;
- `labor_condition_set_id`;
- `duration_type`: `INDEFINITE` of `DEFINITE`;
- `starts_on`;
- `ends_on`, verplicht bij bepaalde tijd en leeg bij onbepaalde tijd;
- `has_probation`;
- `probation_ends_on`, alleen bij proeftijd;
- document-/auditmetadata;
- created/updated-at en actorvelden.

Contracten binnen één Employment:

- overlappen nooit;
- hebben nooit een gat;
- staan altijd in datumvolgorde;
- het eerste Contract start exact op `employments.starts_on`;
- een opvolgend Contract start exact één dag na het vorige contracteinde;
- een nieuw opvolgend Contract sluit een huidig onbepaald Contract atomair af op de dag vóór de nieuwe startdatum;
- een Contract ligt volledig binnen de Employment-periode;
- na uitdiensttreding eindigt het laatste Contract uiterlijk op de laatste werkdag.

`seniority_date` blijft uitsluitend op Employment. Het veld wordt niet dubbel op Contract opgeslagen, omdat anciënniteit over opvolgende contracten binnen hetzelfde Employment doorloopt.

### 2.5 Arbeidsvoorwaarden

Arbeidsvoorwaarden worden in de UI onderdeel van het Contract en verdwijnen als zelfstandige hoofdtab.

Nieuwe administratiegebonden stamtafel: `labor_condition_sets`.

Minimale velden:

- code;
- Nederlandse en Engelse naam;
- standaard voltijduren per week;
- actief/inactief;
- effective-dated revisie wanneer uren of payrollregels veranderen.

Seed per administratie:

- `Bedrijfseigen regeling`.

Voor bestaande `employment_labor_conditions` geldt:

- bruikbare testrecords mogen deterministisch aan een nieuw Contract worden gekoppeld;
- niet-deterministische of onderling strijdige testrecords mogen samen met hun afhankelijke testfixtures worden verwijderd en opnieuw opgebouwd;
- meerdere bewust behouden historische arbeidsvoorwaarden binnen hetzelfde Contract blijven als contractdetailhistorie beschikbaar;
- nieuwe contractpublicaties schrijven altijd een initiële arbeidsvoorwaarderegel met dezelfde startdatum als het Contract;
- de zelfstandige UI-tab vervalt pas nadat de nieuwe contractprojectie werkt.

### 2.6 Medewerker type en flexfase

Contractveld `worker_type` gebruikt een gesloten semantische enum:

- `EMPLOYEE` — Medewerker;
- `STUDENT_INTERN` — Student / Stagiair;
- `TEMPORARY_AGENCY` — Uitzendkracht in dienstverband;
- `EXTERNAL_NO_PAYROLL` — Externe medewerker / geen verloning.

`DGA` wordt niet aangeboden en niet geseed.

Nieuwe te onderhouden administratiegebonden stamtafel: `flex_phases`.

Seednamen uit de aangeleverde screenshot:

1. Fase A met uitzendbeding;
2. Fase B;
3. Fase C;
4. Fase 3;
5. Fase A zonder uitzendbeding, met uitsluiting van loondoorbetaling;
6. Fase 4;
7. Fase A zonder uitzendbeding;
8. Wettelijk regime;
9. Ketensysteem.

Alleen `TEMPORARY_AGENCY` toont en vereist `flex_phase_id`. Andere typen moeten dit veld leeg hebben.

### 2.7 Landinstelling en uitdienstreden

Nieuwe administratiegebonden instelling:

- `administration_hr_settings.default_employment_country_code`.

Nieuwe Employment-kolom:

- `employments.country_code`.

Regels:

- HR-instellingen krijgen in de sectie HR-inrichting een venster **Algemeen**;
- het eerste veld is **Standaardland voor nieuw dienstverband**;
- nieuwe Employments krijgen dit land als default, maar een bevoegde gebruiker mag het in de wizard wijzigen;
- de uitdienstworkflow gebruikt `employments.country_code` om de geldige redenen te laden;
- `ends_on` en de reden worden alleen samen via de bestaande bevestigde uitdienstworkflow gezet;
- de actuele landgebonden `employment_end_reasons`-inrichting wordt hergebruikt.

### 2.8 Rooster en werkuren

De formele urenafspraak blijft een effective-dated tijdlijn op Employment.

Per roosterblok worden toegevoegd of expliciet gemaakt:

- `is_on_call`;
- `on_call_obligation`, alleen relevant bij oproepmedewerker, default `true`;
- `work_scope`: `FULL_TIME` of `PART_TIME`, alleen relevant wanneer geen oproepmedewerker;
- `average_hours_per_week`;
- `part_time_factor`;
- gekoppeld werkpatroon/rooster.

Validatie:

- oproepuren: geheel getal 0 tot en met 50;
- niet-oproepuren: 0 tot en met 50, met de voor payroll benodigde precisie;
- voltijd: factor exact `1.000000`;
- deeltijd: factor = uren per week / standaard voltijduren van de gekozen arbeidsvoorwaarden;
- de gemiddelde roosteruren zijn exact gelijk aan de urenafspraak;
- rooster en urenafspraak worden in één transactie gepubliceerd;
- alle blokken zijn halfopen `[valid_from, valid_until)` en overlappen niet.

### 2.9 Salaris

De salarisbasis in de UI wordt:

- Handmatig;
- Minimumsalaris;
- Salaristabel.

Technische mapping:

- `MANUAL`;
- `MINIMUM_WAGE`;
- `CUSTOM_SCALE` voor Salaristabel.

`CAO_SCALE` wordt niet als vierde losse keuze in de nieuwe wizard aangeboden. Bestaande records blijven leesbaar en worden niet stil geconverteerd.

Nieuwe administratiegebonden stamtafel: `salary_frequencies`, initieel:

- Maand — 12 perioden per jaar;
- 4-weken — 13 perioden per jaar.

Handmatig salaris:

- bruto voltijds bedrag per gekozen frequentie;
- bij afwijkende contracturen tevens bruto deeltijds bedrag;
- de gebruiker mag één van beide als bron wijzigen;
- de andere waarde wordt deterministisch berekend met de deeltijdfactor;
- server en client gebruiken dezelfde decimalen- en afrondingsregel;
- de server herberekent en valideert altijd opnieuw.

Salaristabel:

- gebruikt bestaande salarisschalen en revisies;
- het voltijdbedrag komt uit de geldige schaal/trede;
- het deeltijdbedrag wordt met dezelfde factor afgeleid.

Minimumsalaris:

- krijgt een versiegebonden wettelijke bron per land en ingangsdatum;
- voor Nederland wordt een uurminimum gebruikt en omgerekend met contracturen en frequentie;
- als voor het Employment-land geen geldige wettelijke bron bestaat, blokkeert publicatie met een concrete melding;
- bedragen worden nooit uit browsercopy of een hardcoded component afgeleid.

Nieuwe salarisvelden:

- `salary_frequency_id`;
- `fulltime_amount`;
- `parttime_amount`;
- `calculation_source_amount` of equivalent auditveld om vast te leggen welk veld de gebruiker als bron wijzigde.

### 2.10 Organisatie en kosten

Organisatie blijft een eigen Employment-tijdlijn:

- functie via de bestaande jobcatalogus/revisie;
- afdeling;
- leidinggevende waar van toepassing.

Kostenverdeling blijft een eigen Employment-tijdlijn en wordt uitgebreid:

- bestaande kostenplaats;
- nieuwe kostendrager;
- percentage;
- totaal per tijdblok exact 100%.

Nieuwe administratiegebonden stamtafel: `cost_carriers`.

De bestaande `cost_centers`-stamtafel krijgt dezelfde lijst-eerst beheer-UI als de overige stamtabellen.

Een verdelingsregel verwijst naar een combinatie van:

- `cost_center_id`;
- optioneel `cost_carrier_id`;
- percentage.

De contractwizard maakt het initiële organisatie- en kostenblok aan, maar deze gegevens blijven daarna onafhankelijke Employment-tijdlijnen.

## 3. Benodigde functionele besluiten vóór schemafreeze

Deze punten moeten vóór de uitvoeringsmigratie expliciet worden bevestigd of als FDR worden vastgelegd:

1. **Standaard voltijduren Bedrijfseigen regeling:** voorstel `40,00` uur per week.
2. **Minimumsalaris buiten Nederland:** voorstel om alleen landen met een ingerichte wettelijke tariefbron toe te staan; geen fictieve fallback.
3. **Proeftijd en contractgrenzen:** voorstel dat `probation_ends_on` binnen hetzelfde Contract moet vallen.
4. **Opvolger van een onbepaald Contract:** voorstel om in de contractwizard een ingangsdatum te vragen en het oude Contract atomair één dag eerder te sluiten.
5. **Kostendrager:** voorstel om kostendrager per percentageverdelingsregel naast kostenplaats op te slaan, niet als één vast Contractveld.
6. **Arbeidsvoorwaardenhistorie:** voorstel om bestaande historie aan Contracten te koppelen en in het contractvenster te tonen, zonder een zelfstandige tab.

## 4. Migratiestrategie met gecontroleerde testdatareset

De huidige applicatie- en databaserows zijn testdata. De migratie hoeft bestaande fixtures niet één-op-één te behouden. Een gerichte reset is toegestaan en heeft de voorkeur boven complexe compatibiliteitslogica of het verzinnen van ontbrekende contractgegevens.

Guardrails:

- bepaal vóór iedere delete exact tenant, administratie, tabellen en afhankelijke records;
- verwijder geen Supabase Auth-gebruikers, tenants, administraties, rollen, permissions of platforminstellingen tenzij dat aantoonbaar nodig is voor deze herstructurering;
- inventariseer FK-afhankelijkheden vanuit onder meer verlof, verzuim, reminders, documenten, werkuren en rapportagefixtures;
- reset een afhankelijk fixturecluster in één gecontroleerde transactie of migratie;
- laat geen verweesde `employment_id`, `contract_id`, IKV- of tijdlijnreferenties achter;
- bouw de demo-/testset daarna idempotent opnieuw op met vaste, herkenbare testidentiteiten;
- gebruik geen echte BSN's, contactgegevens of andere productieachtige persoonsgegevens;
- voer destructive SQL alleen uit tegen het expliciet geverifieerde LiquidHR-testproject en de geselecteerde testtenant/-administratie.

### 4.1 Voorcontrole

Voor de eerste remote write:

- lokale en remote migratiehistorie vergelijken;
- aantallen per bestaande Employment-tabel en afhankelijke moduletabel vastleggen als controlebasis;
- controleren op `TEMPORARY_AGENCY`, `ON_CALL`, `EXTERNAL`, meerdere arbeidsvoorwaardenblokken en ongeldige IKV-nummers;
- huidige primary-overlap detecteren;
- tijdlijngaten en overlappen inventariseren;
- alle FK-verwijzingen naar de te resetten Employments inventariseren;
- expliciet vastleggen welke fixtures behouden, geconverteerd of opnieuw geseed worden;
- bestaande gebruikerswijzigingen en migraties buiten deze slice uitsluiten van staging.

Bij een niet-deterministisch testrecord kiest de migratie niet stil een flexfase, land, CAO, salarisfrequentie of kostendrager. Het betreffende testfixturecluster wordt verwijderd en met volledige geldige gegevens opnieuw opgebouwd.

### 4.2 Additieve migratie 1 — instellingen en stamgegevens

Nieuwe migratie:

- `administration_hr_settings`;
- `flex_phases`;
- `labor_condition_sets` en revisies;
- `salary_frequencies`;
- `cost_carriers`;
- ontbrekende CRUD-/auditondersteuning voor `cost_centers`.

Iedere tabel krijgt:

- samengestelde tenant-/administratie-FK's;
- RLS;
- expliciete grants;
- passende indexen;
- audittrigger;
- immutable scopevelden;
- actief/inactief in plaats van destructief verwijderen wanneer al in gebruik.

### 4.3 Additieve migratie 2 — Employment en Contract

- `employments.country_code` toevoegen;
- geldige eenvoudige testrecords desgewenst converteren, maar incomplete fixtures gericht resetten en opnieuw seeden;
- IKV-check aanscherpen naar 1–99; ongeldige test-IKV's mogen worden vervangen;
- primary-overlap met een GiST-exclusion constraint blokkeren;
- `employment_contracts` maken;
- Contract-FK toevoegen aan `employment_labor_conditions`;
- voor bewust behouden Employments een initieel Contract maken;
- overige Employment-/IKV-/arbeidsvoorwaardenfixtures als coherent cluster opnieuw opbouwen;
- indexes en RLS toevoegen.

### 4.4 Additieve migratie 3 — rooster, salaris en kosten

- oproep-/arbeidsomvangvelden aan `employment_schedules`;
- `salary_frequency_id` en `parttime_amount` aan `employment_salaries`;
- behouden enumfrequenties deterministisch koppelen aan de twee seeds; overige salarisfixtures opnieuw seeden;
- `cost_carrier_id` aan `employment_cost_allocations`;
- contractsleutel toevoegen aan initiële records waar dit nodig is voor herkomst/audit, zonder de onafhankelijke Employment-tijdlijn te veranderen;
- databasechecks voor uurgrenzen, voltijdfactor, conditionele velden en 100%-verdeling.

### 4.5 Testfixtures opnieuw opbouwen

Maak één idempotente testfixturemigratie of expliciet testscriptscenario met minimaal:

- één Employee zonder Employment;
- één Employee met één actief primair Employment en één Contract;
- één Employee met twee parallelle Employments waarvan precies één primair;
- één herintreder met twee sequentiële Employments;
- één Employment met twee volledig aansluitende Contracten;
- één uitzendkrachtcontract met flexfase;
- één niet-NL Employment zonder BSN-verplichting;
- rooster-, salaris-, organisatie- en kostenhistorie met minimaal een huidig en toekomstig blok;
- één bevestigde uitdiensttreding met landgebonden reden;
- coherente verlof-/verzuimfixtures waar die modules een Employment vereisen.

Vaste UUID's zijn toegestaan voor idempotente testfixtures. De tweede uitvoering moet dezelfde aantallen en relaties opleveren.

### 4.6 Transactionele publicatie-RPC's

Nieuwe of vervangen RLS-gebonden RPC's:

- `complete_employment_prerequisites(...)`;
- `publish_employment_with_initial_contract(...)`;
- `append_employment_contract(...)`;
- `apply_employment_schedule_block(...)`;
- `apply_employment_salary_block(...)`;
- `apply_employment_organization_block(...)`;
- `apply_employment_cost_block(...)`.

Iedere RPC:

- leidt tenant, administratie en actor af uit de sessie;
- vergrendelt het Employment en relevante tijdlijnen;
- valideert permissions én scope;
- schrijft alle gerelateerde records atomair;
- schrijft auditdata;
- retourneert typed foutcodes;
- is niet uitvoerbaar door `anon` of `PUBLIC`.

### 4.7 Compatibiliteitsfase en opschoning

Oude kolommen en routes blijven tijdens de overgang alleen-lezen beschikbaar.

Pas nadat alle code en data de nieuwe bron gebruiken:

- oude `employments.contract_type`, `employment_type`, `probation_ends_on` en vergelijkbare contractvelden niet meer lezen;
- de oude complete-publicatie-RPC uitfaseren;
- oude kolommen in een afzonderlijke latere migratie verwijderen;
- gegenereerde types opnieuw maken.

## 5. Serverlaag en API

### 5.1 Services en schema's

Wijzigen:

- `apps/hr-suite/lib/employment/schemas.ts`;
- `apps/hr-suite/lib/employment/detail-schemas.ts`;
- `apps/hr-suite/lib/employment/employment-service.ts`;
- `apps/hr-suite/lib/employment/employment-detail-service.ts`;
- `apps/hr-suite/lib/employment/timeline-rules.ts`;
- `apps/hr-suite/lib/employment/impact-rules.ts`;
- `apps/hr-suite/lib/employment/chain-assessment.ts`.

Nieuw:

- `apps/hr-suite/lib/employment/contract-schemas.ts`;
- `apps/hr-suite/lib/employment/contract-service.ts`;
- `apps/hr-suite/lib/employment/employment-prerequisites.ts`;
- `apps/hr-suite/lib/employment/salary-calculation.ts`;
- `apps/hr-suite/lib/employment/schedule-validation.ts`;
- `apps/hr-suite/lib/settings/hr-settings-service.ts`;
- catalogusservices voor flexfasen, arbeidsvoorwaarden, salarisfrequenties, kostenplaatsen en kostendragers.

Kernregels worden test-first gebouwd:

- contractaansluiting;
- primary-overlap;
- IKV 1–99 en eerst beschikbare nummer;
- landafhankelijke BSN-verplichting;
- proeftijdgrenzen;
- uren/factor/roostergelijkheid;
- voltijd/deeltijd salarisomrekening;
- 100% kostenverdeling;
- permission- en administratiescope.

### 5.2 Routes

Nieuw of aangepast:

- `GET/POST /api/settings/hr-general`;
- CRUD-routes onder `/api/master-data/flex-phases`;
- CRUD-routes onder `/api/master-data/labor-conditions`;
- CRUD-routes onder `/api/master-data/salary-frequencies`;
- CRUD-routes onder `/api/master-data/cost-centers`;
- CRUD-routes onder `/api/master-data/cost-carriers`;
- `GET/POST /api/employees/[employeeId]/employment-prerequisites`;
- `POST /api/employees/[employeeId]/employments`;
- `GET/POST /api/employments/[employmentId]/contracts`;
- `PATCH /api/employments/[employmentId]/contracts/[contractId]`;
- bestaande tijdlijnroutes uitbreiden met de nieuwe payloadcontracten;
- uitdienstopties filteren op `employments.country_code`.

Mutatieroutes starten met de canonieke permissions:

- `employee:write` voor ontbrekende persoonsgegevens;
- `employee-bsn:write` voor BSN;
- `contract:write` voor Employment en Contract;
- `work-schedule:write` voor rooster;
- `salary:write` voor salaris;
- `organization-placement:write` voor functie/afdeling;
- passend bestaand instellingen-/stamdatarecht voor catalogi.

Geen salarisbedragen worden via een route teruggegeven zonder `salary:read`.

## 6. Instellingen-UI

### 6.1 HR-inrichting — Algemeen

Nieuwe route:

- `apps/hr-suite/app/(dashboard)/settings/hr-general/page.tsx`.

Nieuwe component:

- `apps/hr-suite/components/settings/hr-general-settings-form.tsx`.

Toevoegen aan `/settings`, sectie HR-inrichting:

- tegel/venster **Algemeen**;
- eerste veld **Standaardland voor nieuw dienstverband**.

### 6.2 Stamtabellen

`/master-data` krijgt lijst-eerst onderdelen voor:

- Flexfasen;
- CAO / Arbeidsvoorwaarden;
- Salarisfrequenties;
- Kostenplaatsen;
- Kostendragers;
- bestaande Redenen uitdienst.

Ieder onderdeel:

- zoeken;
- sorteren;
- statusfilter;
- volledig klikbare rij;
- modal voor toevoegen/wijzigen;
- activeren/deactiveren;
- verwijderguard bij gebruik;
- NL/EN-sleutelpariteit.

## 7. Wizard Nieuw dienstverband

De flow wordt één composietwizard met een Employment-deel en aansluitend een Contract-deel.

### Stap 0 — land en controle basisset

1. Laad het standaard Employment-land.
2. Toon land als eerste keuze.
3. Bepaal daarna de ontbrekende Employee-gegevens.

Altijd vereist:

- nationaliteit;
- medewerkernummer;
- geboortedatum;
- geslacht.

Alleen voor land `NL`:

- BSN aanwezig in `employee_secure_identifiers`.

Als iets ontbreekt, verschijnt vóór de rest van de wizard exact de titel:

> Vooraleer we het dienstverband kunnen aanmaken, gelieve de volgende data in te vullen.

Het scherm toont uitsluitend ontbrekende velden, bewaart via één transactionele serverflow en onthult nooit een bestaand BSN.

Bij een wijziging van land:

- naar `NL`: BSN-controle opnieuw uitvoeren;
- van `NL` naar een ander land: BSN niet als blokkade gebruiken;
- nationaliteit blijft altijd vereist.

### Stap 1 — Employment

Velden:

- land;
- primair ja/nee;
- begindatum;
- anciënniteitsdatum;
- IKV-nummer.

Defaults:

- begindatum = eerste dag van de volgende kalendermaand;
- anciënniteitsdatum = begindatum;
- primair = ja wanneer geen overlappend primair Employment bestaat;
- primair = nee wanneer op de voorgestelde datum al een primair Employment bestaat;
- IKV = eerste vrije waarde 1–99.

De wizard toont een duidelijke fout als alle 99 IKV-nummers bezet zijn.

### Stap 2 — Contract, basis

Velden:

- medewerker type;
- flexfase, conditioneel;
- CAO / Arbeidsvoorwaarden;
- contractduur;
- startdatum;
- einddatum bij bepaalde tijd;
- proeftijd ja/nee;
- einde proeftijd;
- snelkeuzes `+4 weken`, `+1 maand`, `+2 maanden`.

In de gecombineerde nieuwe-Employment-flow:

- contractstart is read-only en exact gelijk aan de Employment-start.

Validatie:

- bepaalde tijd vereist einddatum;
- einddatum ligt niet vóór startdatum;
- onbepaalde tijd heeft geen contracteinddatum;
- proeftijdeinde ligt niet vóór start en niet na contracteinde;
- uitzendkracht vereist flexfase;
- andere typen mogen geen flexfase bewaren.

### Stap 3 — Rooster en werkuren

Eerste keuze:

- oproepmedewerker ja/nee.

Bij ja:

- oproepverplichting ja/nee, default ja;
- uren per week, geheel getal 0–50.

Bij nee:

- voltijd/deeltijd;
- uren per week;
- deeltijdfactor;
- voltijd zet factor vast op 100%.

Daaronder:

- invoer van het bestaande 1–4-weekse werkpatroon;
- zichtbare som en gemiddelde uren;
- blokkade totdat gemiddelde roosteruren exact gelijk zijn aan uren per week.

### Stap 4 — Salaris

Keuze:

- Handmatig;
- Minimumsalaris;
- Salaristabel.

Handmatig:

- frequentie uit stamtafel;
- bruto voltijds per frequentie;
- bruto deeltijds per frequentie wanneer factor niet 100% is;
- laatste gewijzigde bedrag is de bron voor herberekening.

Minimumsalaris:

- toon gebruikte land-, datum- en tariefbron;
- toon berekening;
- blokkeer als geen geldige bron beschikbaar is.

Salaristabel:

- schaal;
- revisie/trede op contractstart;
- voltijd- en berekend deeltijdbedrag.

Salarisstap wordt alleen getoond en geschreven wanneer de gebruiker `salary:write` heeft. Zonder dit recht kan de gebruiker het Employment niet stil met een leeg salaris publiceren; de productflow toont dat salaris door een bevoegde gebruiker moet worden aangevuld of gebruikt een expliciet goedgekeurde salarisloze worker type.

### Stap 5 — Overige

Velden:

- functie uit jobcatalogus;
- afdeling;
- kostenplaats;
- kostendrager;
- initiële kostenverdeling exact 100%.

### Stap 6 — Controle en publiceren

Toon:

- Employee-basischeck;
- Employment;
- IKV;
- Contract;
- rooster;
- salaris, alleen geautoriseerd;
- organisatie;
- kosten.

Publicatie gebeurt in één transactie. Bij een fout ontstaat geen half Employment.

## 8. Wizard Nieuw contract

De contractwizard wordt hergebruikt vanuit het Employment-overzicht.

Verschillen met de gecombineerde flow:

- Employment-gegevens staan read-only bovenaan;
- Employment-tab is niet bewerkbaar vanuit de contractwizard;
- bij een bestaand contract kiest de gebruiker een opvolgdatum;
- het vorige Contract wordt atomair op de voorafgaande dag afgesloten;
- reeds geplande latere Contracten worden niet overschreven;
- de wizard weigert gaten en overlap;
- de stappen Contract, Rooster, Salaris en Overige worden hergebruikt;
- rooster, salaris, organisatie en kosten krijgen ieder een nieuw tijdlijnblok vanaf de contractstart, tenzij de gebruiker expliciet en geldig kiest de bestaande tijdlijn door te laten lopen.

Een contractwijziging opent als gecentreerde viewportmodal of ruime dialoog/side-panel volgens de bestaande formulierconventies; geen klein formulier in de sidebar.

## 9. Employment-detail en tijdlijn-UX

### 9.1 Tabs na herstructurering

Nieuwe tabset:

1. Overzicht;
2. Rooster;
3. Salaris;
4. Organisatie;
5. Kostenverdeling;
6. Historie.

Verwijderen:

- Basis & IKV;
- Arbeidsvoorwaarden.

### 9.2 Overzicht

Bovenaan read-only Employment-gegevens:

- dienstverbandnummer;
- primair;
- IKV;
- begin;
- anciënniteit;
- land;
- afgeleide status;
- einddatum en reden bij bevestigde uitdienst.

Daaronder:

- contractkaarten op volgorde;
- kerninformatie per Contract;
- volledige kaart klikbaar met handcursor;
- geselecteerd Contract opent detail/wijzigmodal;
- knop **Contract toevoegen**;
- arbeidsvoorwaarden zichtbaar binnen de Contractkaart/modal.

### 9.3 Uniform tijdlijnpatroon

Rooster, Salaris, Organisatie en Kostenverdeling gebruiken dezelfde componentfamilie:

- compacte kaart per tijdblok;
- geldigheidsperiode;
- status huidig/toekomstig/historisch;
- belangrijkste velden;
- volledige kaart selecteerbaar;
- handcursor;
- modal voor bekijken/wijzigen;
- duidelijke knop **Toevoegen**;
- ingangsdatum en reden;
- TWK-waarschuwing;
- alleen het geraakte tijdblok splitsen;
- latere geplande blokken behouden;
- laatste toekomstige blok kan gecontroleerd worden teruggedraaid;
- geen overlap;
- tijdlijn blijft binnen de Employment-periode.

Herbruik bestaande:

- `EmploymentTimeMap`;
- `ConfirmationDialog`;
- mutatie- en rollbackcontracten;
- URL-state per tab;
- tabgerichte serverprojecties.

Vervang het huidige lange inline mutatieformulier door kaartselectie plus modal, zonder server-side autorisatie te verzwakken.

## 10. Belangrijkste bestanden

### Documentatie

- `docs/requirements/employment/CONTRACT_EN_DIENSTVERBAND.md`;
- `docs/requirements/core-hr/MEDEWERKER.md`;
- `docs/requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md`;
- nieuwe FDR voor de contractlaag en de zes besluiten uit hoofdstuk 3;
- `docs/README.md`;
- `docs/delivery/IMPLEMENTATION_STATUS.md`;
- `docs/delivery/CURRENT_CONTEXT.md`.

### Database

- nieuwe migraties onder `apps/hr-suite/supabase/migrations/`;
- nieuwe SQL-tests onder `apps/hr-suite/supabase/tests/`;
- `packages/db/types.ts`.

### Employment

- `apps/hr-suite/lib/employment/schemas.ts`;
- `apps/hr-suite/lib/employment/detail-schemas.ts`;
- `apps/hr-suite/lib/employment/employment-service.ts`;
- `apps/hr-suite/lib/employment/employment-detail-service.ts`;
- nieuwe contract-, prerequisiet-, salaris- en roostermodules;
- `apps/hr-suite/app/api/employees/[employeeId]/employments/route.ts`;
- routes onder `apps/hr-suite/app/api/employments/[employmentId]/`;
- `apps/hr-suite/components/employment/employment-create-form.tsx`, op te splitsen in een wizard-shell en stapcomponenten;
- `apps/hr-suite/components/employment/employment-mutation-panel.tsx`;
- `apps/hr-suite/components/employment/employment-time-map.tsx`;
- nieuwe contractkaarten en modals;
- `apps/hr-suite/app/(dashboard)/employees/[employeeId]/employments/[employmentId]/page.tsx`;
- `apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx`.

### Instellingen en stamdata

- `apps/hr-suite/app/(dashboard)/settings/page.tsx`;
- nieuwe `/settings/hr-general`;
- `apps/hr-suite/app/(dashboard)/master-data/page.tsx`;
- `apps/hr-suite/lib/master-data/`;
- `apps/hr-suite/components/master-data/`;
- routes onder `apps/hr-suite/app/api/master-data/`.

### i18n en versie

- `apps/hr-suite/messages/nl/employment.json`;
- `apps/hr-suite/messages/en/employment.json`;
- `apps/hr-suite/messages/nl/masterData.json`;
- `apps/hr-suite/messages/en/masterData.json`;
- `apps/hr-suite/messages/nl/settings.json`;
- `apps/hr-suite/messages/en/settings.json`;
- `apps/hr-suite/lib/app-version.ts`;
- `apps/hr-suite/lib/app-version.test.ts`;
- `apps/hr-suite/package.json`.

## 11. Uitvoeringsvolgorde

1. Besluiten uit hoofdstuk 3 vastleggen in FDR en leidende requirements bijwerken.
2. Remote en lokale datakwaliteit read-only inventariseren.
3. Test-first SQL-cases voor primary, IKV, Contract en tijdlijnen schrijven.
4. Instellingen- en stamdatamigratie bouwen.
5. Contract- en Employment-migratie plus gecontroleerde testdatareset/herseed bouwen.
6. Rooster-, salaris- en kostenmigratie bouwen.
7. RLS, grants, audit, advisors en DB-types afronden.
8. Pure domeinvalidatie en berekeningsmodules test-first bouwen.
9. Transactionele RPC's en services bouwen.
10. API-routes bouwen en route-/servicetests uitvoeren.
11. HR Algemeen en stamtabellen-UI bouwen.
12. Employment-/Contractwizard bouwen.
13. Employment-overzicht en Contractmodal bouwen.
14. Vier uniforme tijdlijntabs bouwen.
15. i18n, documentatie en status bijwerken.
16. Versie verhogen.
17. Volledige releasegate en ingelogde browsercontrole op poort 3000.

## 12. Verificatie en acceptatiecriteria

### 12.1 Database

- migratievoorcontrole toont aantallen en afwijkingen;
- de geselecteerde testfixtures zijn gecontroleerd geconverteerd of opnieuw opgebouwd;
- er bestaan geen verweesde verwijzingen vanuit verlof, verzuim, reminders, documenten, werkuren of rapportages;
- het idempotente fixturescript geeft bij een tweede uitvoering dezelfde aantallen en relaties;
- parallelle niet-primaire Employments zijn toegestaan;
- overlappende primaire Employments worden geweigerd;
- sequentiële primaire Employments zijn toegestaan;
- IKV 0 en 100 worden geweigerd; 1 en 99 zijn geldig;
- Contracten met gat of overlap worden geweigerd;
- proeftijd buiten Contract wordt geweigerd;
- uitzendkracht zonder flexfase wordt geweigerd;
- niet-uitzendkracht met flexfase wordt geweigerd;
- tijdlijnoverlap wordt geweigerd;
- kosten totaal anders dan 100% wordt geweigerd;
- cross-tenant en cross-administration FK-manipulatie wordt geweigerd;
- anon heeft geen toegang;
- Supabase security- en performance-advisors hebben geen nieuwe bevindingen;
- `packages/db/types.ts` is opnieuw gegenereerd.

### 12.2 TypeScript en tests

- gerichte unit-tests voor alle nieuwe Zod-schema's;
- salarisomrekening met decimalen en afronding;
- uren/factor/roostergelijkheid;
- eerst vrije IKV 1–99;
- Employee-prerequisites NL versus niet-NL;
- contractaansluiting en opvolging;
- permission-negatieve tests;
- route- en servicetests;
- volledige Vitest-suite;
- strict TypeScript;
- ESLint;
- `check:i18n`;
- productiebuild.

### 12.3 Ingelogde browsercontrole op poort 3000

Gebruik de bestaande ingelogde Chrome-sessie.

Desktop:

- `/settings` → HR-inrichting → Algemeen;
- standaardland opslaan en opnieuw laden;
- alle vijf nieuwe/uitgebreide stamtabellen openen;
- medewerker met ontbrekende basisgegevens: tussenscherm en exacte titel;
- NL vereist BSN; niet-NL niet;
- nieuw Employment: defaults datum, primair en IKV;
- Contractstappen met alle conditionele velden;
- oproep en niet-oproep;
- roosteruren exact gelijk;
- handmatig salaris beide richtingen herberekenen;
- Minimumsalaris en Salaristabel;
- functie, afdeling, kostenplaats en kostendrager;
- publiceren en detail openen;
- tweede aansluitend Contract toevoegen;
- contractkaart selecteren en modal openen;
- tabs Basis & IKV en Arbeidsvoorwaarden ontbreken;
- Rooster, Salaris, Organisatie en Kostenverdeling hebben dezelfde kaart-/modalopzet;
- uitdienstredenen volgen Employment-land;
- geen console-errors of onverwachte netwerkfouten.

Responsive:

- 390 × 844 voor wizard, contractmodal en alle vier tijdlijntabs;
- geen horizontale overflow;
- acties blijven bereikbaar;
- datum-, select- en salarisvelden blijven leesbaar.

Performance:

- eerste Employment-detail p75 maximaal 1.500 ms;
- warme tabwissel p75 maximaal 1.000 ms;
- alleen de actieve tabprojectie wordt geladen.

### 12.4 Versie en handoff

Pas bij volledig groen:

- versie verhogen van de dan actuele versie naar de eerstvolgende patchversie, momenteel beoogd `1.20260729.4`;
- zichtbare versie op poort 3000 bevestigen;
- `docs/README.md`, `IMPLEMENTATION_STATUS.md` en `CURRENT_CONTEXT.md` bijwerken;
- exact vastleggen wat remote is gemigreerd, wat alleen lokaal staat en welke handmatige acties open zijn.

## 13. Niet stil meenemen

Niet zonder aparte requirement toevoegen:

- verwijderen van records buiten de vooraf geselecteerde testtenant/-administratie;
- verwijderen van Auth-gebruikers, tenants, administraties, rollen of permissions als onderdeel van de Employment-reset;
- fictieve flexfase voor bestaande uitzendkrachten;
- fictieve CAO-uren;
- minimumloonfallback zonder officiële landbron;
- DGA als medewerker type;
- persoonsbreed rooster, salaris of kosten buiten `employment_id`;
- salariszichtbaarheid zonder `salary:read`;
- deployment, commit of push voordat de volledige schema-/releasegate groen is.
