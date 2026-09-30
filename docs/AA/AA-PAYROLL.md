# AA-PAYROLL — LiquidHR Payroll Development Standard

Status: **LEIDEND VOOR PAYROLL ZODRA GEMERGED OP `main`**  
Eerste opzet: 2026-09-30

Dit document legt de structurele product-, architectuur- en ontwikkelafspraken voor LiquidHR Payroll vast. Detailrequirements, fiscale bronbestanden en gedateerde acceptance evidence blijven elders staan.

## 1. Productgrens

Payroll is onderdeel van dezelfde LiquidHR-app en dezelfde repository.

- Gebruikers werken in de bestaande `apps/hr-suite`.
- Payroll krijgt een eigen hoofdmenu-item binnen de bestaande LiquidHR-sidebar.
- De eerste ingang is `Payroll → Payroll Lab`.
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

Eerste navigatie:

```text
Payroll
└── Payroll Lab
```

Later kan dit uitbreiden naar bijvoorbeeld Overzicht, Medewerkers, Mutaties, Runs, Componenten, Controles en Instellingen.

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

Na M0 is de eerstvolgende inhoudelijke payrollmijlpaal dus: de synthetische fiscale waarden vervangen door aantoonbare Nederlandse 2026-rule logic, zonder de generieke componentengine te omzeilen.
