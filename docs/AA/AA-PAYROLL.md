# AA-PAYROLL — LiquidHR Payroll Development Standard

Status: **LEIDEND VOOR PAYROLL ZODRA GEMERGED OP `main`**  
Eerste opzet: 2026-09-30

Dit document legt de structurele product-, architectuur- en ontwikkelafspraken voor LiquidHR Payroll vast. Detailrequirements, fiscale bronbestanden en gedateerde acceptance evidence blijven elders staan.

## 1. Productgrens

Payroll is onderdeel van dezelfde LiquidHR-app en dezelfde repository.

- Gebruikers werken in de bestaande `apps/hr-suite`.
- Payroll heeft **precies één** sidebar-ingang: `Payroll Lab`.
- `/payroll-lab` is de centrale overzichtspagina met bestaande LiquidHR-dashboardvensters/tegels, géén uitklapbare Payroll-submenu's.
- PAYLAB04 maakt de tegels `Berekeningen` en `Salariscomponenten` functioneel; toekomstige functies zoals `Cao's en regelingen`, `Controles` en `Historie` worden later als venster toegevoegd wanneer ze echt werken.
- Payroll gebruikt dezelfde app-shell, styles, tokens, componenten, responsive patterns, i18n en authorization-aware UI-patronen als de rest van LiquidHR.
- Er komt geen afzonderlijk Payroll design system of losse gebruikersapp voor deze productlijn.

Technische isolatie blijft wel expliciet:

- `packages/payroll-engine` bevat de pure calculation engine;
- LiquidHR Core blijft bron voor HR-data;
- Payroll gebruikt een aparte Supabase-database voor payroll snapshots, runs, resultaten, trace en controls;
- integratie verloopt server-side via application/service/repository boundaries;
- geen browser → Payroll Supabase;
- geen cross-database foreign keys of SQL-joins;
- Payroll bewaart Core-identiteiten als opaque source references.

Een aparte worktree, zoals `LiquidHR-Payroll`, is alleen een ontwikkelwerkplek voor dezelfde repository en geen aparte productapp.

## 2. Payroll Component Graph Engine

De technische kern is een generieke **Payroll Component Graph Engine**.

Een Payroll Component heeft minimaal:

- stabiele componentcode;
- ownership/type;
- versie;
- `effectiveFrom` / `effectiveTo`;
- processing scope;
- typed inputs;
- typed outputs;
- dependencies;
- calculation method;
- rounding;
- trace/provenance.

De engine bepaalt de uitvoervolgorde uit dependencies en rekent deterministisch.

Verspreide hardcoded payrollberekeningen zijn niet het primaire architectuurmodel wanneer dezelfde logica als component kan worden gemodelleerd.

De engine zelf bevat zo min mogelijk Nederlandse payrollkennis. Nederlandse payrollkennis zit in versioned componentdefinitions, parameters, tabellen en rule packages.

## 3. Calculation methods en expression engine

Minimaal ondersteunde calculation methods:

- `PassThrough`;
- `Expression`;
- `Aggregate`;
- later `Lookup/Table`.

`Expression` gebruikt een beperkte, veilige expression engine. Geen vrije JavaScript- of andere willekeurige code-uitvoering.

Minimaal toegestaan:

- `+`, `-`, `*`, `/`;
- `=`, `!=`, `>`, `>=`, `<`, `<=`;
- `AND`, `OR`, `NOT`;
- `IF(condition, then, else)`;
- `MIN`, `MAX`, `ROUND`, `ABS`;
- vaste waarden;
- percentages;
- typed component-inputs;
- outputs van andere componenten;
- parameters.

Niet toegestaan:

- loops;
- vrije `eval`/code-execution;
- databasecalls vanuit formules;
- externe API-calls vanuit formules;
- impliciete toegang tot data buiten gedeclareerde inputs.

Typed payrollwaarden onderscheiden minimaal geld, percentage, number/quantity, uren, dagen, datum en boolean waar relevant.

## 4. Component ownership

Er zijn drie componentsoorten.

### SYSTEM

- eigendom van LiquidHR;
- klant kan deze niet in-place wijzigen;
- immutable/versioned;
- effective-dated;
- historische versies worden nooit overschreven;
- nieuwe LiquidHR-versies mogen naast oude versies bestaan.

### CUSTOMER_FORK

Ontstaat wanneer een klant een SYSTEM-component kopieert.

Bewaar minimaal provenance:

- origin component id/code;
- origin component version;
- fork timestamp.

Na de fork is de component volledig detached:

- geen automatische synchronisatie;
- geen inheritance;
- geen merge met latere SYSTEM-versies;
- toekomstig onderhoud is verantwoordelijkheid van de klant.

Een latere LiquidHR-versie van het broncomponent wijzigt de fork nooit automatisch.

### CUSTOMER_CUSTOM

- volledig door klant gemaakt;
- geen system origin vereist;
- gebruikt hetzelfde veilige runtime-contract als SYSTEM en CUSTOMER_FORK.

Een customer component mag nooit een SYSTEM-component in-place wijzigen of dezelfde systeemidentiteit overnemen.

## 5. Fiscale verantwoordelijkheid

De klant mag eigen berekeningslogica configureren binnen het veilige componentcontract, maar fiscale/system-owned classificaties en officiële Nederlandse rule packages worden niet stilzwijgend door customer logic overschreven.

Wanneer een klant een system component forkt, is die fork niet langer de door LiquidHR onderhouden officiële systeemvariant.

Officiële NL-regels worden versioned en effective-dated gepubliceerd en getest tegen bronjaar/tijdvak.

Een unsupported of nog niet bewezen scenario wordt expliciet `UNSUPPORTED` of `SOURCE_GAP`; nooit ongeveer goed gerekend.

## 6. Source snapshots en inputsets

LiquidHR Core blijft actuele HR-bronwaarheid.

Payroll rekent op immutable canonical source snapshots.

Onderscheid:

- `PayrollSourceSnapshot`: canonieke bronwaarheid voor scope/periode + source version vector/hash;
- `CalculationInputSet`: snapshot reference + periode + rule package composition + engine version + input hash;
- `CalculationRun`: uitvoeringsinstantie die naar het inputset verwijst.

Dezelfde source snapshot mag later opnieuw worden berekend met een andere engine- of ruleversie zonder de bronhistorie te herschrijven.

Employment en IncomeRelationship/IKV zijn niet automatisch hetzelfde begrip. Nog niet geaccepteerde Core-contracten worden niet geraden.

## 7. Persistence en reproduceerbaarheid

Payroll Lab persistente artefacten omvatten minimaal:

- source snapshots;
- calculation input sets;
- calculation runs;
- component results;
- calculation trace;
- payroll controls.

Run lifecycle volgt de expliciete statusovergangen van Payroll Lab.

Definitieve historische inputs/resultaten worden niet stilzwijgend overschreven.

Voor dezelfde fixture + engine/rule/inputversie moeten minimaal stabiel zijn:

- source hash;
- input hash;
- componentresultaten;
- result hash.

Een nieuwe run mag een nieuwe run-id/timestamp hebben.

## 8. Payroll development mode

Zolang Payroll uitsluitend intern/test is:

- synthetische testdata is toegestaan;
- zichtbare verticale slices krijgen voorrang boven langdurige tussenarchitectuur zonder payrollresultaat;
- niet-kritieke issues mogen als `KNOWN ISSUE / LATER CHECK` worden geregistreerd;
- werkcyclus: implementeren → targeted test → onafhankelijke review waar nuttig → fix → retest → verder;
- subagents mogen bij grotere runs expliciet worden ingezet voor parallelle implementatie, onafhankelijke review, security/scope, database/migrations, UI-consistentie en payrollregelcontrole;
- wanneer subagents worden ingezet en modelkeuze beschikbaar is, gebruiken zij altijd **LUNA MAX**; geen automatische of lagere alternatieve subagentconfiguratie;
- als LUNA MAX niet beschikbaar/selecteerbaar is, niet stilzwijgend substitueren maar aan de orchestrator melden;
- de hoofdagent blijft orchestrator en integreert de resultaten.

Hard stop alleen bij onder meer:

- vereiste Core-schemawijziging buiten expliciete scope;
- vereiste CONTROL02-contractwijziging buiten expliciete scope;
- mogelijke cross-tenant/cross-administration exposure;
- secret exposure;
- destructieve dataactie of datacorruptierisico;
- grote moeilijk terug te draaien architectuurafwijking.

Kleine forward-only migrations mogen alleen autonoom naar de expliciet bedoelde Payroll Lab-projectomgeving wanneer de run dat toestaat; nooit stilzwijgend naar Core.

## 9. Testbeleid

Volg `AA-TEST.md`.

Tijdens normale Payroll-featureontwikkeling:

- targeted engine/component tests;
- Golden Cases;
- relevante scope/security negatives;
- persistence/readback bij databaseflows;
- lifecycle/immutability/repeatability;
- typecheck;
- changed-area lint;
- i18n wanneer UI wijzigt;
- production build wanneer runtime/UI wijzigt;
- client secret-boundary scan wanneer de Payroll boundary wordt geraakt.

Geen volledige ~2.000-test suite als ritueel.

Een full suite hoort bij convergence/release of aantoonbare brede shared-core blast radius.

Browseracceptatie gebruikt bestaande testidentities en normale bestaande authflows. Geen extra rol, gebruiker of bypass creëren om een test groen te krijgen.

## 10. UI

Payroll moet eruitzien en werken als LiquidHR.

Gebruik bestaande:

- app-shell;
- sidebar/navigation;
- page headers;
- typography;
- spacing;
- cards;
- buttons;
- forms;
- tables;
- statuscomponenten;
- loading/error/empty states;
- responsive patterns;
- i18n;
- permission patterns.

Payroll-specifieke UI-componenten zijn toegestaan wanneer ze echte domeinweergave bieden, maar bouwen op bestaande LiquidHR-primitives.

Definitieve navigatie vanaf PAYLAB04:

```text
Sidebar:
  Payroll Lab

/payroll-lab (centrale overzichtspagina met bestaande dashboardtegels)
  ├── Berekeningen      → bestaande berekeningsfunctionaliteit
  └── Salariscomponenten → componentenbibliotheek

Later als werkende overzichtstegels:
  Cao's en regelingen
  Controles en historie
```

**Geen afzonderlijke Payroll-submenu's in de sidebar.** Onderliggende routes mogen bestaan achter de overzichtstegels; voeg een terugnavigatie naar Payroll Lab toe en behoud bestaande berekeningsflows en backward compatibility waar nodig. Toon geen niet-functionele navigatie-acties. Dezelfde server-side autorisatie- en NL/EN-i18n-patronen gelden voor overzicht en bestemmingen.

## 11. Bewezen M0-baseline

PAYLAB02 M0 heeft op 2026-09-30 lokaal/authenticated bewezen:

- bestaande HR Admin Test Auth → Payroll → Payroll Lab;
- echte engine execution;
- run `SUCCEEDED`;
- 9 componentresultaten;
- trace;
- 7 passing controls;
- netto € 3.175,00 voor GC-NL-001;
- totale werkgeverskosten € 4.910,00;
- herhaalrun met identieke source/input/result hashes;
- ownership/provenance voor SYSTEM, CUSTOMER_FORK en CUSTOMER_CUSTOM;
- bounded typed expression engine;
- separate Payroll Lab persistence;
- geen Core-write of permissionwijziging;
- UI hergebruikt bestaande LiquidHR-shell/styles/componenten.

Deze baseline bewijst **synthetic M0**, niet fiscale NL-2026-correctheid en niet de nog open live Core employment/IKV-sourceketen.

## 12. Ontwikkelvolgorde

Voorkeursroute:

1. isolation/boundary;
2. source adapter;
3. component engine M0;
4. zichtbare synthetische payrollberekening;
5. echte Nederlandse 2026 fiscale regels;
6. verdere payrollcomponenten, grondslagen en wettelijke packages;
7. Continuous Payroll / Payroll by Exception;
8. aangifte-, payment-, accounting- en overige adapters.

Na M0 is PAYLAB03 lokaal geaccepteerd voor uitsluitend de eerste NL-2026 WHITE/NL/STD/onder-AOW reguliere maandcase, met versioned SYSTEM statutory rules, oracle, rounding trace en persistent browserbewijs. Verdere fiscale scope blijft afzonderlijk te plannen.

## 13. Future engine invariants — iteraties, IKV's en gedeelde grondslagen

Deze capabilities hoeven niet in iedere vroege payrollslice volledig te worden gebouwd, maar de architectuur mag ze niet blokkeren.

### Circulaire / iteratieve berekeningen

Niet iedere componentgrafiek blijft altijd een DAG.

De engine moet later expliciete iteratieve/convergence-clusters kunnen ondersteunen:

- detecteer strongly-connected component clusters;
- alleen expliciet als iterative/convergence gemarkeerde clusters zijn geldig;
- iteration policy is versioned;
- policy kan minimaal tolerance, maximum iterations, eventueel minimum iterations en de relevante convergence outputs bevatten;
- trace legt iteraties en de uiteindelijke convergence/non-convergence uit;
- non-convergence wordt een gecontroleerde calculation failure/control result;
- de engine rondt iteratieve tussenwaarden niet impliciet op 2 decimalen af om convergence te forceren.

Vroege acyclische slices hoeven deze capability niet volledig te implementeren, maar hardcode nergens de aanname dat iedere toekomstige graph DAG-only is.

### Employment versus IncomeRelationship / IKV

Employment en IncomeRelationship/IKV zijn verschillende domeinconcepten.

Nooit aannemen:

```text
employmentId == incomeRelationshipId
```

Toekomstig canoniek model:

```text
Employee
→ 1..* Employment
→ per Employment 0..* IncomeRelationship
```

Een Employment kan meerdere opeenvolgende of gelijktijdige IKV's hebben.

De definitieve Core IncomeRelationship/IKV-entiteit wordt niet geïmproviseerd zolang het Core/CONTROL02-contract niet expliciet is vastgesteld. Payroll bewaart in de tussentijd een opaque `source_income_relationship_id` in canonical snapshots.

### Gedeelde assessment bases

Een grondslag hoort niet automatisch bij één IKV.

De engine moet later componentnodes kunnen uitvoeren op scopes zoals:

- `IncomeRelationship`;
- `Employment`;
- `AssessmentBaseGroup`;
- `EmployeeEmployer`;
- `EmployeeLegalEntity`;
- `EmployeePensionScheme`;
- `Employee`;
- `PayrollRun`.

Een `AssessmentBaseGroup` bepaalt voor één specifieke grondslag welke IKV's gezamenlijk worden behandeld. Verschillende grondslagen mogen verschillende group membership hebben.

Conceptuele flow:

```text
IKV A local nodes ──→ contribution ──┐
                                     │
                                 Base Group
                                     │
IKV B local nodes ──→ contribution ──┘
                                     ↓
                       maximum/franchise/cumulative
                                     ↓
                                 allocation
                              ↙             ↘
                         IKV A             IKV B
```

Een wijziging aan één IKV kan daardoor resultaten op andere IKV's binnen dezelfde geraakte grondslaggroep beïnvloeden.

Data ownership blijft:

**LiquidHR Core**
- Employee;
- Employment;
- later canonical IncomeRelationship/IKV identity + versions.

**Payroll**
- opaque source references;
- immutable snapshots;
- IncomeRelationshipCalculation;
- assessment-base definitions/groups;
- contributions;
- allocations;
- cumulatives;
- calculated results.

Geen cross-database foreign keys.

## 14. Rounding, precision en statutory calculation stages

Afronding is payroll business logic, geen formattering.

### 14.1 Hoofdregel

Gebruik geen generieke regel "alles onder water onbegrensd exact en alleen aan het einde naar 2 decimalen".

De juiste regel is:

> **Rond alleen wanneer de actieve payrollregel dat expliciet voorschrijft, precies op die rekenstap, met de voorgeschreven schaal en afrondingsmethode. Rond op alle andere stappen niet impliciet.**

Dit is essentieel omdat wettelijke rekenvoorschriften juist tussentijdse afrondingen kunnen voorschrijven.

### 14.2 Numerieke representatie

- Gebruik nooit binary floating point (`float`/`double`/JavaScript `number`) als financiële rekenrepresentatie voor payrollbedragen, percentages en factoren.
- Gebruik een exacte decimal/fixed-decimal representatie.
- Leg geen globale regel vast dat 4-6 decimalen altijd voldoende zijn. De engine moet voldoende schaal behouden om de actieve regel exact uit te voeren.
- Parameters bewaren hun officiële/publiceerde schaal en provenance.
- Ongeafronde tussenwaarden mogen een grotere technische schaal gebruiken dan de uiteindelijke output.
- De opslagrepresentatie mag geen precisie verliezen bij persistence, hashing of serialisatie.

### 14.3 Rounding policy is versioned data

Een financiële output of wettelijke tussenstap kan een expliciete `RoundingDefinition` hebben met minimaal:

- `stage`;
- `decimalPlaces` of target multiple;
- `mode`;
- `effectiveFrom/effectiveTo`;
- rule/package version;
- officiële bron/provenance waar wettelijk;
- traceability.

Ondersteun conceptueel afzonderlijke modes zoals:

- arithmetic / half-up wanneer de bron "rekenkundig" voorschrijft;
- floor / naar beneden;
- ceiling / naar boven;
- truncate-toward-zero alleen wanneer expliciet vereist;
- round-down-to-multiple, bijvoorbeeld een wettelijke tabelstap;
- no-rounding.

Verwar `floor` en `truncate toward zero` niet bij eventuele negatieve waarden.

### 14.4 Rounding stages

Rounding moet per stap kunnen worden vastgelegd, bijvoorbeeld:

- input normalization;
- statutory intermediate step;
- component output;
- assessment-base/group result;
- allocation/distribution;
- period total;
- annual/YTD total;
- payment;
- declaration projection.

Niet iedere component gebruikt al deze stages.

### 14.5 Officiële NL-2026 regels hebben voorrang op generieke conventies

Voor de Belastingdienst Rekenvoorschriften 2026 geldt bijvoorbeeld dat verschillende symbolen verschillende regels hebben. Voor de huidige standaardscope zijn onder meer relevant:

- jaarloon `L` wordt tot `Lmax` naar beneden op een veelvoud van `Lv` gebracht; boven `Lmax` wordt `L` volgens de voorschriften op 5 decimalen rekenkundig bepaald;
- `X1` bij `L ≤ Lmax` wordt naar beneden op hele euro's afgerond;
- bepaalde heffingskortingen zoals AHK worden bij afbouw naar boven op hele euro's afgerond;
- het tijdvakbedrag `x` van de in te houden LB/PH wordt rekenkundig op 2 decimalen afgerond;
- boven `Lmax` bestaan expliciete stappen op 2 en 5 decimalen;
- bij het zelf herleiden van standaardparameters gelden onder meer hele euro's in het voordeel van de werknemer, percentages op 3 decimalen en factoren op 5 decimalen, precies voor de scope waarin de officiële voorschriften dat bepalen.

Daarom is de uitspraak "de uiteindelijke loonheffing wordt per werknemer op hele euro's afgerond" **niet** als algemene regel toegestaan. Het jaarbedrag en het uiteindelijke tijdvakbedrag hebben verschillende afrondingsregels.

### 14.6 Trace en audit

Bewaar voor iedere relevante afgeronde stap waar praktisch:

- unrounded value;
- rounded value;
- rounding difference;
- rounding mode;
- scale/target multiple;
- rounding stage;
- rounding rule/package version;
- bronverwijzing bij wettelijke SYSTEM-rules.

Een wijziging in een rounding rule vereist een nieuwe rule/component/package version en regressietests.

### 14.7 Cumulatief rekenen

Cumulatief rekenen is geen universele anti-afrondingsregel die op iedere payrollcomponent moet worden toegepast.

Gebruik cumulatieve/YTD-methoden alleen wanneer de betreffende regeling, component of grondslag dat vereist, bijvoorbeeld bij wettelijke voortschrijdend-cumulatieve grondslagen of een expliciete reserverings-/balansregel.

De engine moet cumulatieve balances versioned, scoped en reproduceerbaar bewaren. Een generieke "reken vanaf januari en trek eerdere afgeronde betalingen af"-regel mag niet stilzwijgend op alle componenten worden toegepast.

### 14.8 Allocatie en restcenten

Wanneer een afgerond groepsbedrag over meerdere IKV's, componenten of betalingen wordt verdeeld:

- de som van allocaties moet exact aansluiten op het afgeronde groeps-/eindbedrag;
- eventuele restcenten worden deterministisch volgens een expliciete, versioned allocation policy verdeeld;
- nooit afhankelijk van databasevolgorde;
- trace legt vast waar het afrondingsverschil terechtkwam.

### 14.9 Convergence

Iteratieve berekeningen vergelijken ongeafronde of expliciet voor convergence genormaliseerde waarden op een versioned comparison precision/tolerance.

Rond iteratieve bedragen niet standaard op 2 decimalen voordat convergence wordt vastgesteld. Een wettelijke component mag wel expliciete afrondingsstappen binnen de iteratie bevatten wanneer de betreffende regel dat vereist.

## 15. PAYLAB03 — eerste fiscale referentiecase (lokaal geaccepteerd)

Volgens het lokale acceptance report van 2026-09-30 is CC-NL-2026-001 GREEN binnen WHITE/NL/STD, onder AOW, volledige reguliere maand, loonheffingskorting aan. Fiscaal loon € 4.000,00 → loonheffing € 818,67 → netto € 3.181,33. Er zijn 21 onafhankelijke rekengevallen, 10 officiële maandtabelankers, 2 geauthenticeerde persisted browserruns met identieke hashes en rounding trace. Code-SHA: `5d7e9fc5e19ff4582787b51e0104c885ac83370a` (lokaal; geen push/deploy).

Deze status wijzigt niets aan de toekomstige invarianten: geen automatische employment=IKV-aanname, geen impliciete twee-decimaalafronding, geen generieke YTD, geen veronderstelde DAG-only engine. Iteratieve clusters, shared bases en multi-IKV zijn nog niet uitgevoerd/accepted. Raadpleeg het lokale `docs/payroll/acceptance/PAYLAB03-NL2026-REGULAR-WAGE-20260930.md` voordat nieuwe scope wordt gepland.

## 17. Pro Forma / What-if — gereserveerde scenarioarchitectuur

De pro-formamodule wordt geen tweede engine of parallelle bronadministratie. Een scenario is een immutable canonical baseline + gestructureerde tijdelijke delta's + versiegebonden rule-/cao-/bedrijfspakketcompositie. Berekening loopt via dezelfde Payroll Component Graph Engine in een strict `SIMULATION` context, **zonder** echte HR/Payroll-writes, betaling, aangifte, journaalpost of wijziging van productiecumulatieven.

HR Admin kan eerst een synthetische werknemer gebruiken; pas na live Core-sourceacceptatie en server-side salary-permissions een bestaande medewerker kopiëren. Medewerkers zien alleen de eigen toegestane gegevens en houden hun simulaties privé totdat ze bewust delen. Bied alleen scenario's aan waarvoor de betrokken componenten, wettelijke regels en cao-behandeling daadwerkelijk getest en ondersteund zijn; geen onjuiste ziekengeld-, pensioen-, werkgeverskosten- of netto-uitkomst verzinnen.

Netto-naar-bruto is een **bounded inverse search over de bestaande forward engine**, geen eigen belastingformule. Definieer doelnetto, zoekvariabele, brutoband/salarisstap en overige bevroren arbeidsvoorwaarden expliciet. Houd rekening met discontinuïteiten, loonbelastingtabelstappen, afronding en mogelijk onbereikbare exacte nettodoelen; rapporteer controleerbaar doelbereik of dichtstbijzijnde uitkomst.

UX: zodra functioneel een `Pro Forma`-tegel op het enkele `Payroll Lab`-overzicht; toekomstig ESS onder `Mijn salaris → Wat als`. Geen extra Payroll-sidebaronderdelen. Detailconcept en fasering: [PROFORMA01-WHAT-IF-PRODUCT-ARCHITECTURE](../requirements/payroll/PROFORMA01-WHAT-IF-PRODUCT-ARCHITECTURE.md). Dit is gepland ontwerp, niet geïmplementeerd of geaccepteerd door PAYLAB03/04.

## 18. Payrolldocumenten: loonstrook, jaaropgaaf en gecontroleerde templates

Voorgesteld, **nog niet geïmplementeerd**: één documentpipeline over **immutable finalized payroll-/loonstaatprojecties**, géén tweede rekenengine. Documenttypes `PAYSLIP` en `ANNUAL_STATEMENT`; modes `LIQUIDHR_STANDARD`, `CUSTOMIZED_STANDARD`, later `CUSTOM_DESIGNER`.

Een LiquidHR Standard is door LiquidHR onderhouden, **niet** door de Belastingdienst gecertificeerd. Klanten mogen in de aangepaste standaard het logo, vooraf als optioneel geclassificeerde blokken en beperkte eigen velden instellen; wettelijke verplichte velden, bedragen en betekenis blijven beschermd. De optionele vrije designer bouwt op een typed read-only datafieldregister en een server-side wettelijke veldvalidator: eigen risico ontslaat klanten niet van wettelijke vereisten en is geen toestemming om wettelijk verplichte gegevens te verwijderen.

Jaaropgaaf gebruikt **loonstaat-/jaaraggregatie** en correcte werkgever-, dienstbetrekking- en IKV-groepering, niet simpelweg een optelsom van PDF-loonstroken. Digitale loonstroken vereisen instemming en duurzame inzage/bewaarbaarheid. ESS-toegang is strikt employee-scoped; BSN op jaaropgaaf wordt alleen in het afgeschermde document getoond. Eenmaal uitgegeven PDF's en hun template-/bronversies blijven auditeerbaar en worden bij correcties niet stilzwijgend overschreven.

Navigatie: pas zodra functioneel de tegel `Loonstroken & Jaaropgaven` onder het enkele `Payroll Lab`-overzicht; medewerker ziet PDF's onder eigen ESS-ingang. De toekomstige eenvoudige salaris-cockpit is een **apart uit te werken** productonderdeel. Geen extra Payroll-sidebar-item.

Details en gefaseerde acceptatie: [PAYDOC01-PAYSLIP-ANNUAL-STATEMENT-AND-DESIGNER](../requirements/payroll/PAYDOC01-PAYSLIP-ANNUAL-STATEMENT-AND-DESIGNER.md). Huidige PAYLAB03-jaar- en premiegegevens zijn onvoldoende voor een echte, wettelijk volledige jaaropgaaf; geen premature uitgifteclaim.

## 19. Salary/tax payments — separate payment orchestration (planned)

Geen eigen payroll-/belastinggeld door LiquidHR laten lopen. De engine maakt immutable gefinaliseerde resultaten; `PayableProjection` bepaalt het daadwerkelijk verschuldigde bedrag en is bewust onderscheiden van `NET_WAGE`. Een aparte, streng gescopeerde payment domain layer maakt `PaymentInstruction`, `PaymentOrder/Batch`, `PaymentAttempt/ExportArtifact`, status-/reconciliationevents, en later afzonderlijke `TaxPaymentObligation` en `RecoveryCase`. Renderer/bankexport rekent niet opnieuw.

Betalingsgoedkeuring staat los van HR-/payrollrollen en payrollfinalisatie. Batchinhoud/IBAN/bedrag/datum wordt bij goedkeuring vastgezet met immutable hash; inhoudelijke wijziging vereist nieuwe revisie en goedkeuring. Download betekent alleen EXPORTED, API-submission alleen submitted/accepted wanneer bevestigd; nooit SETTLED zonder betrouwbare reconciliatie/verklaring. UNKNOWN status is veilig af te handelen vóór fallback om dubbele salarisbetaling te voorkomen.

Eerste kanaal: versie-/bankprofielgebonden, volledig gevalideerde SEPA Credit Transfer XML-export. Later optionele bank-/PSP-adapter die een batch klaarzet voor bankautorisatie bij de klant. Behoud altijd gecontroleerde SEPA-fallback; directe koppeling introduceert geen eigen betaalinstellingsclaims. EU SCT rulebook en EPC customer-to-PSP IG op uitvoerdatum opnieuw verifiëren, inclusief name/IBAN-check (VOP) die door bank/PSP wordt uitgevoerd.

Loonheffingenbetaling komt uit het **eindbedrag van een werkelijk geaccepteerde aangifte**, heeft periodiek betalingskenmerk, deadline en actueel officieel rekeningprofiel; fiscale periodebetaling is onderscheiden van werknemerbetalingen. Geen negatieve SEPA-instructie voor een netto-terugvordering. Werknemerloonstrook gebruikt dezelfde pinned payableprojection, bankstatus verandert geen historische PDF.

Navigatie: `Betalingen` wordt pas bij werkende module een overzichtstegel onder het **enige** `Payroll Lab`-sidebaritem. Details/fasering: [PAYMENT01-SALARY-AND-TAX-PAYMENTS-ARCHITECTURE](../requirements/payroll/PAYMENT01-SALARY-AND-TAX-PAYMENTS-ARCHITECTURE.md). Dit is gepland, niet op basis van PAYLAB03 geaccepteerde betaalfunctionaliteit.
