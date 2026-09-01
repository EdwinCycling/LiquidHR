# Liquid Analyse V2 Foundation

**Status: DRAFT — PRODUCT/ARCHITECTURE DISCOVERY**

**Discovery-baseline:** actuele `origin/main` op 2026-09-01

**Main SHA:** `155ccbde373a06684e37d9746b01dd65931c870b`

**Zichtbare versie:** `1.20260901.1`
**AN-6:** RELEASED — PRODUCTION GREEN

Dit document definieert de product- en architectuurrichting vóór de bouw van
Conversational Analysis. Het is geen implementatieplan en activeert geen nieuwe
capability. De voormalige AN-7 `Explain`/`Waarom?` blijft uitgesteld en is geen
voorwaarde voor deze richting.

De voorgestelde volgorde is:

```text
rijkere Semantic Layer → AnalysisSpec/Engine V2 → Liquid Canvas V2
                                                   ↓
                                             Liquid Explore V2
                                                   ↓
                                      AN-8 Conversational Analysis
```

Explore en AN-8 zijn twee invoerkanalen voor dezelfde gecontroleerde
analyse-intentie. Geen van beide krijgt directe database- of medewerkerdata.

## 1. Productdoel

Liquid Analyse moet een HR Admin of Manager helpen om betrouwbare, concrete
workforcevragen te beantwoorden zonder BI-querytaal te leren. De gebruiker
kiest een betekenisvolle vraagvorm; LiquidHR bepaalt de toegestane semantiek,
scope, tijdsbetekenis, aggregatie en presentatie. De uitkomst is reproduceerbaar
en opnieuw uitvoerbaar tegen actuele geautoriseerde data.

## 2. Huidige V1-capabilitymatrix

De matrix hieronder beschrijft de actuele code, niet de roadmap.

| Onderdeel | Vandaag ondersteund | Grenzen / precieze betekenis |
|---|---|---|
| Source | `workforce` | Eén allowlisted source. |
| Entity | `employees` | Eén HR-group-brede medewerkerprojectie; geen vrije tabellen of joins. |
| Retrieval | `listEmployeesOverview` via de vaste `list_employee_overviews`-RPC | Server-side authorization-first; actuele implementatie gebruikt de vaste RPC-resultaatgrens van 500 records. |
| Scope | `HR_GROUP` binnen de actieve tenant | Context komt uit de server-side `AuthContext`; Manager-scope blijft server-side bepaald. |
| Measure | `headcount` | `count_distinct` op employee-id na deduplicatie; zonder statusfilter telt de huidige default alle niet-gearchiveerde projectierijen, dus niet impliciet alleen `ACTIVE_EMPLOYEE`. |
| Dimensions | `department`, `job`, `employment_status` | Maximaal één outputdimensie na semantische validatie. Department/job zijn huidige waarden; status wordt uit employment history afgeleid voor vandaag. |
| Filters | `eq`, `in` | De spec valideert maximaal 20 filterobjecten; operators en values zijn typed/allowlisted waar nodig. Explore toont slechts één filter en gebruikt alleen `eq`. Filters combineren met AND; V1 verbiedt geen dubbele dimensionfilters op specniveau. |
| Filterwaarden | Status heeft vaste allowlist: `NEVER_EMPLOYED`, `FUTURE_EMPLOYEE`, `ACTIVE_EMPLOYEE`, `FORMER_EMPLOYEE` | Department/job-values zijn strings die tegen de geautoriseerde records matchen; zij zijn geen database-identifiers. |
| Sortering en limiet | Sort op `label` of `value`, `asc`/`desc`; limiet 1–100 | Limiet geldt voor resultaatgroepen, niet voor de vaste retrievalgrens. |
| Tijd | Impliciete huidige datum | Geen expliciete `as_of`, datumrange, eventperiode, historie, trend of periodevergelijking in AnalysisSpec V1. De retrieval gebruikt vandaag als ISO-datum. |
| Presentation | `kpi`, `table`, `auto` | KPI zonder dimensie; één-dimensionale tabel met `dimension` en `headcount`; empty state en tabel-fallback bestaan. Geen echte chartcatalogus. |
| Resultaat | Typed `AnalysisResult` | Alleen vaste kolommen, geaggregeerde rows, summary en presentatiehint; geen employee-id, tenant-id, SQL of debugdata. |
| Drill | AN-6: selecteer een zichtbare aggregate-row en kies een andere bestaande dimensie | Context wordt een allowlisted filter en opnieuw uitgevoerd door dezelfde engine. Geen employee-level drill. |
| Compare | AN-6: exact twee waarden van één huidige dimensie; optionele breakdown op een andere dimensie | Aggregate-only KPI/table-resultaat, signed difference `left - right`, missing-side alignment; vergelijking is sessiestaat en wordt niet opgeslagen. Geen period-over-period compare. |
| Navigatie | AN-6 contextstack met `Back` en `Reset` | Stack bevat specs/results/context, geen tenant-, HR-group- of employee-identifiers. |
| Mijn Analyses | Eigen saved definitions opsommen, openen, vers heruitvoeren, opslaan, hernoemen en verwijderen | Alleen gevalideerde versioned `AnalysisSpec` wordt opgeslagen; nooit result rows, snapshots, cache of medewerkerdata. |
| Liquid Explore | Guided V1-formulier met vaste source/measure, optionele dimensie, één optionele `eq`-filter, presentation, sort en limiet | Geen vrije vraag, meerdere zichtbare filters, tijd, vergelijking of chartkeuze. |
| Hub | Exact vier tegels: `Nieuwe analyse` gepland; `Verkennen`, `Mijn analyses`, `Rapporten` actief | AN-6 heeft de bestaande Explore-flow verdiept, maar heeft de hub niet verbreed. |
| Cross-domain | Niet ondersteund | Bestaande losse Insights-rapporten zijn geen semantische entities van Liquid Analyse V1. |

### Codebasis voor de inventaris

- Semantic Layer en allowlists: `apps/hr-suite/lib/insights/analysis-semantic-layer.ts`.
- Strict spec-validatie: `apps/hr-suite/lib/insights/analysis-spec.ts`.
- Authorization, vaste retrieval, filtering en aggregatie:
  `apps/hr-suite/lib/insights/analysis-engine.ts`.
- Typed resultaatcontract: `apps/hr-suite/lib/insights/analysis-result.ts`.
- AN-6 drill/compare: `analysis-drill.ts`, `analysis-comparison.ts` en
  `components/insights/analysis-exploration.tsx`.
- Renderer: `components/insights/liquid-canvas.tsx`.
- Explore en persistence: `components/insights/analysis-explore.tsx`,
  `components/insights/my-analyses.tsx` en
  `lib/insights/saved-analysis-runtime.ts`.

## 3. Werkelijke data- en domeininventaris

### Classificatie

- **A — DATA + SAFE APPLICATION RETRIEVAL EXISTS NOW:** er is al een
  server-side, gescopeerde applicatieservice die de bron voor een bestaand
  productrapport of de huidige analyseprojectie leest.
- **B — DATA EXISTS, BUT NO SAFE ANALYSIS SEAM YET:** de bronvelden of een
  gespecialiseerde leesseam bestaan, maar er is nog geen herbruikbare,
  analysis-safe semantiek met uniforme tijd-, scope- en aggregatieregels.
- **C — PARTIAL DATA / DOMAIN WORK REQUIRED:** er zijn gegevens, maar de
  businessdefinitie, gebeurtenisclassificatie of betrouwbare historische
  interpretatie is nog niet voldoende scherp.
- **D — NOT CURRENTLY ANALYTICS SCOPE:** de gegevens of productbetekenis
  horen nu niet in de generieke Liquid Analyse-scope.

| Concept | Classificatie | Feitelijke bron/seam | Consequentie voor V2 |
|---|---|---|---|
| Headcount en huidige employee-scope | A | `analysis-engine.ts` gebruikt `listEmployeesOverview`; bron is de vaste employee-overview-RPC. | V1-basiscapability behouden; V2 moet een expliciete peildatum en een oplossing voor de 500-recordgrens krijgen. |
| Huidige afdeling en functie | A | `EmployeeOverview` projecteert `departmentName` en `jobTitle`; `employee_organizations` en `departments` zijn de bron. | V1 dimensions behouden; V2 kan maximaal twee outputdimensions toestaan. |
| Employment status | A | `deriveEmploymentStatus` gebruikt de geprojecteerde employment history; statuswaarden zijn vaste enums. | V2 behoudt de allowlist en moet de status op een expliciete peildatum berekenen. |
| Employment type / contracttype | A voor gespecialiseerde employee/employment-read | `listEmployeesOverview` leest `employments.employment_type`; `employments.contract_type` en `employment_contracts.duration_type` bestaan ook. De huidige analysis-record laat deze waarden weg. | Eerst taxonomy kiezen: `employment_type` en `contract_type` zijn niet hetzelfde. Daarna één canonieke dimension per vraagvorm. |
| Employment start/end en seniority date | A voor bestaande employee/termination/upcoming seams; B voor generieke analyse | `employee-report-service.ts`, `upcoming-events.ts` en `employments` lezen `starts_on`, `ends_on`, `seniority_date`. | V2 heeft een typed event-/tenure-seam nodig; bepaal hoe rehires en meerdere Employments tellen. |
| Hires / instroom | B | `employments.starts_on` en Upcoming bestaan, maar er is geen generieke `hires`-measure met vastgelegde distinctness en eventregels. | Nieuwe eventsemantiek; onderscheid unique employee, employment start en rehire. |
| Leavers / uitstroom | A voor het bestaande terminationrapport | `employee-report-service.ts` leest bevestigde `employment_terminations.last_working_day` en termination-reasons. | Herbruikbare aggregate-measure ontbreekt nog; V2 moet status/workflow en periodegrenzen vastleggen. |
| FTE / arbeidsuren | B | `employment_schedules` bevat `average_hours_per_week`, `part_time_factor` en effective dates; absence en salary hebben gespecialiseerde berekeningen. | Eén autoritatieve FTE-definitie en effective-dated readmodel nodig; niet afleiden uit employee rows in Canvas. |
| Seniority / functieniveau | B | `employments.seniority_date`; `jobs.seniority_id`; Talent job-profile readmodel. | Tenure is plausibel, maar `seniority` als dimension vraagt een expliciete bron en scopebesluit. |
| Interne transfers | C | Effective-dated `employee_organizations`, `hr_change_events` met `ORGANIZATION_CHANGED` en process-automation internal-transfer bestaan. | Een transfer vereist betrouwbare vorige/nieuwe waarde, effectieve periode en distinctness; niet gelijkstellen aan iedere organization-row. |
| Toekomstige employment changes | C | `employment_change_sets` heeft `effective_on`, `status`, `domains` en gekoppelde effective-dated contract/schedule/salary/organization-data; Upcoming leest slechts beperkte gebeurtenissen. | Eerst bepalen welke statuses zichtbaar zijn en wat “gepland” betekent; geen analyse op draft of onbevestigde gevoelige waarden zonder guardrails. |
| Salary / compensation | A voor het gespecialiseerde salary-insightsrapport | `salary-insights-service.ts` gebruikt de gescopeerde `get_salary_insights_projection` en vereist `salary:read`; de projection bevat FTE, salary, bands en peer-metrics. | Niet automatisch opnemen in de generieke layer. Eerst HR Admin/Manager-scope, suppression en salary-permission contractueel vastleggen. |
| Absence | A voor gespecialiseerde rapporten | `absence-report.ts` en Bradford/frequent-absence services lezen cases, spells, capacity, schedules en organization, met `report-absence:read` plus `employee:read`. | Een period-aggregate entity is waardevol, maar mag geen medische oorzaken of employee-level data naar Canvas/AI brengen. |
| Leave | B | `getLeaveBalanceReport` en de leave-ledger bestaan per employment; catalogus `leave` is nog niet beschikbaar als geaggregeerd Insights-report. | Alleen opnemen na een expliciete aggregate-projection, privacydrempel en permission/RLS-contract. |
| Demografie: gender en leeftijd | A voor bestaande employee Insights-projecties | `employee-report-service.ts` gebruikt `employees.gender` en `birth_date`; bestaande reports zijn live, maar privacydrempel staat nog als vervolgwerk geregistreerd. | P2/gated. Leeftijd/gender nooit als vrije cross-filter zonder suppression en doelbinding. |
| Locatie, manager en cost bearer | B | `employee_organizations` bevat `location_id`, `direct_manager_id` en `cost_bearer`; organization-chart en salary-insights hebben gespecialiseerde reads. | V2-dimensions zijn mogelijk, maar naamresolutie, manager-scope en historische placement moeten één seam delen. |
| Talent/performance, survey-uitkomsten en vrije custom fields | D voor de generieke V2-foundation | Er bestaan afzonderlijke Talent-, research- en custom-field-domeinen, maar geen enkel uniforme, privacy-veilige workforce-analyticsbetekenis voor deze foundation. | Geen generieke cross-domain query. Elk later domein krijgt een eigen requirement, semantic seam en privacybesluit. |

### Privacy- en scope-observaties

Salary, absence, gender, leeftijd, leave balances en sommige manager-/location-
combinaties kunnen indirect gevoelige informatie onthullen. “Er is een tabel”
is daarom onvoldoende bewijs voor opname in de semantic layer. Iedere nieuwe
entity moet een eigen permission-, RLS-, scope- en aggregatecontract hebben.

## 4. Canonical HR-vragen voor V2

De volgende vijftien vragen zijn de voorgestelde productdoelen. De vraagvorm
blijft deterministic: ieder item verwijst naar vaste measures, dimensions,
filters en tijdsemantiek. `V1 support` beschrijft de huidige Liquid Analyse-
engine, niet een los bestaand Insights-rapport.

| ID / prioriteit | Canonical question en user value | Measures | Dimensions | Filters | Tijd | Resultaat / voorkeur | V1 support | Ontbrekende capability |
|---|---|---|---|---|---|---|---|---|
| Q1 P0 | Hoeveel medewerkers hebben we op peildatum X? Basis voor workforce planning. | `headcount` | Geen | Status, type, afdeling of functie optioneel | Snapshot `as_of` | KPI; eventueel KPI + delta | PARTIAL — vandaag kan, expliciete peildatum niet | Snapshot-period en heldere headcountdefinitie. |
| Q2 P0 | Hoe is de workforce op X verdeeld over afdelingen? Geeft direct zicht op organisatieomvang. | `headcount` | `department` | Status/type optioneel | Snapshot | Horizontal/vertical bar plus tabel | PARTIAL — department vandaag, één dim | Expliciete snapshot, multi-dimension result-contract en chart. |
| Q3 P0 | Hoe is de workforce op X verdeeld over jobs/functies? Ondersteunt capaciteit en job architecture. | `headcount` | `job` | Status, afdeling/type optioneel | Snapshot | Horizontal bar plus tabel | PARTIAL — job vandaag, één dim | Snapshot en job-value resolution buiten V1. |
| Q4 P0 | Hoeveel medewerkers vallen op X onder elk employment type? Ondersteunt payroll- en workforceplanning. | `headcount` | `employment_type` | Afdeling/status optioneel | Snapshot | Bar/table | NONE | Canonieke employment taxonomy en dimension. |
| Q5 P0 | Hoeveel nieuwe medewerkers zijn in periode X gestart, totaal en per afdeling? Meet instroom. | `hires` | Optioneel `department` | Employment type, job, administration waar toegestaan | Eventperiode, inclusief startdatum | KPI + delta/trend of bar/table | NONE | Distinct hire-event measure en period semantics. |
| Q6 P0 | Hoeveel medewerkers zijn in periode X uitgestroomd, totaal en per afdeling? Ondersteunt retention en planning. | `leavers` | Optioneel `department` | Reason, type, job optioneel | Eventperiode op confirmed `last_working_day` | KPI + trend/bar/table | NONE | Reusable termination aggregate met workflow- en rehire-regels. |
| Q7 P0 | Welke afdelingen zijn sinds de vorige vergelijkbare periode gegroeid of gekrompen? Geeft prioriteit aan actie. | `headcount`, derived `headcount_delta`, eventueel `headcount_delta_pct` | `department` | Status/type optioneel | Twee gelijke snapshotperioden | Diverging/vertical bar + comparison table | PARTIAL — AN-6 vergelijkt waarden, niet perioden | Period comparison, derived delta en top/bottom N. |
| Q8 P0 | Wat is de gemiddelde tenure op X, totaal en per afdeling? Ondersteunt succession en retention. | `average_tenure_months` | Optioneel `department`/`job` | Status/type optioneel | Snapshot `as_of`, berekend vanaf `seniority_date` | KPI + bar/table | NONE | Tenure measure, missing-date policy en aggregation rules. |
| Q9 P0 | Hoeveel FTE en geplande arbeidsuren hebben we op X per afdeling? Ondersteunt capaciteit. | `fte`, `scheduled_hours` | `department` | Status/type/job optioneel | Snapshot met effective-dated schedule | KPI + bar/table | NONE | Canonieke FTE/urenmeasure en schedule read seam. |
| Q10 P1 | Wat is het verzuimpercentage en hoeveel verzuimuren waren er per afdeling in periode X? Ondersteunt HR-capacity en signalering. | `absence_rate`, `sick_hours` | `department` | Status/type optioneel; geen medische oorzaak | Event-/measurement period | KPI + trend + table/bar | NONE — apart verzuimrapport is niet V1-engine | Aggregate absence entity, privacydrempel en period alignment. |
| Q11 P1 | Hoe is de workforce op X verdeeld over locaties? Ondersteunt spreiding en workplace planning. | `headcount`, eventueel `fte` | `location` | Afdeling/type/status optioneel | Snapshot | Bar/table | NONE | Location name resolution, scope en null bucket. |
| Q12 P1 | Hoeveel interne organisatieveranderingen vonden plaats in periode X en tussen welke afdelingen? Ondersteunt reorganisatie-impact. | `internal_transfers` | `from_department`, `to_department` | Job/manager/location optioneel | Eventperiode op effective date | Comparison table; matrix alleen na besluit | NONE | Transfer classifier, twee bronwaarden en privacyregels. |
| Q13 P1 | Welke employment changes staan gepland in periode X, uitgesplitst naar change-domain? Ondersteunt voorbereiding. | `planned_changes` | `change_domain`, optioneel `department` | Status, type, domain | Eventperiode op `effective_on` | KPI + table/bar | NONE | Lifecycle/statussemantics, safe projection en draft suppression. |
| Q14 P2 | Hoe is de workforce verdeeld over leeftijdsbanden op X? Ondersteunt generatiewerkforceplanning. | `headcount` | `age_band` | Afdeling/type optioneel | Snapshot, leeftijd op `as_of` | Bar/table met suppressed cells | NONE in Liquid Analyse V1; apart age-report bestaat | Privacy threshold, band policy en no re-identification. |
| Q15 P2 | Hoe positioneert compensation zich ten opzichte van salary bands per job/afdeling? Ondersteunt beloningsgovernance. | `compa_ratio`, `range_penetration`, `salary_band_status` | `job`, `department` of salary band | Alleen geautoriseerde salary filters | Snapshot `as_of` | Table/bar; geen employee-level default | NONE in Liquid Analyse V1; apart salary-report bestaat | Salary-specific authorization, suppression, currency/rounding en manager policy. |

### Prioritering

- **P0 — 9 vragen:** Q1–Q9 vormen één coherent workforce-planningfundament:
  omvang, mix, instroom, uitstroom, verandering, tenure en capaciteit.
- **P1 — 4 vragen:** Q10–Q13 verbreden naar verzuim, locatie en gecontroleerde
  change-planning zodra de benodigde seams klaar zijn.
- **P2 — 2 vragen:** Q14–Q15 zijn waardevol maar privacy- en
  permission-zwaarder; zij mogen de foundation niet blokkeren.

## 5. Semantic Layer V2 — voorstel

### Ontwerpregels

De Semantic Layer blijft een compile-time allowlist van betekenisvolle
capabilities. Definities bevatten geen databasekolommen, SQL, joins, RPC-namen,
providergegevens of uitvoerbare metadata. De server resolveert een semantic
identifier naar een interne typed retrieval adapter; de client ziet alleen de
allowlist en labels.

Eén spec heeft één primaire semantic entity. “Cross-domain” betekent dus niet
dat de gebruiker willekeurige joins kan maken. Een combinatie zoals
`headcount` + `absence_rate` komt pas beschikbaar als één expliciet ontworpen
aggregate-projection dit veilig ondersteunt.

### Entities en status

| Semantic entity | Betekenis | Fase |
|---|---|---|
| `employees` | Workforce-snapshot met current/effective-dated dimensions | V2A-kern; V1-compatibel uitgebreid |
| `employment_events` | Typed hires en leavers uit bevestigde employment/termination-events | V2A na vastlegging distinctness/re-hire-regels |
| `workforce_capacity` | Effective-dated FTE en scheduled hours | V2A/V2A.1, na één FTE-definitie |
| `absence_summary` | Geaggregeerde absence-rate, sick hours/days per toegestane periode | V2A.2/P1; apart permission- en privacycontract |
| `employment_changes` | Geclassificeerde applied/planned organization/contract/schedule changes | V2A.3/P1; pas na domainbesluit |
| `demographics` | Age bands en eventueel gender | P2/gated; nooit default beschikbaar |
| `compensation` | Salary band/compa/range metrics | P2/gated; mag gespecialiseerde salary-insights niet omzeilen |

De entities na `employees` zijn geen bewezen V2-capabilities. Zij zijn
allowlisted ontwerpdoelen die alleen mogen worden geactiveerd nadat een typed
retrieval seam, autorisatie en privacycontract bestaan.

### Measures

De minimale V2-measurecatalogus is:

- `headcount`: distinct employees in een snapshot.
- `hires`: distinct employees met een canoniek bevestigd hire-event.
- `leavers`: distinct employees met een canoniek bevestigd vertrek-event.
- `fte` en `scheduled_hours`: effective-dated capacitymaten.
- `average_tenure_months`: gemiddelde tenure vanaf `seniority_date` op de
  peildatum, met expliciet beleid voor ontbrekende data.
- `absence_rate` en `sick_hours`: alleen in `absence_summary`, met de bestaande
  roostergewogen definitie als vertrekpunt.
- `internal_transfers` en `planned_changes`: pas na de domain-classifiers uit
  de inventory.
- Derived comparison measures `headcount_delta` en `headcount_delta_pct` zijn
  engine-uitkomsten van twee compatibele periods, geen vrije formules.
- Salary measures blijven gated en worden niet onderdeel van de eerste
  V2A-release.

### Dimensions

V2 kan naast de drie V1-dimensions de volgende allowlisted dimensions
introduceren, telkens alleen voor de entities waar zij betekenisvol zijn:

- `employment_type`;
- `location`;
- `age_band` (gated);
- `change_domain`, `from_department` en `to_department` (alleen voor
  classified changes);
- een expliciet gekozen `contract_type` of `duration_type`, maar niet beide
  zonder duidelijke gebruikersbetekenis.

De V2-engine ondersteunt maximaal twee outputdimensions. `null`/`unknown` is
een expliciete, opt-in bucket. De engine mag een onbekende waarde niet
stilzwijgend als een echte organisatie-eenheid labelen.

### Filters

V2 ondersteunt maximaal acht genormaliseerde filters, AND-gecombineerd, met
maximaal één filter per semantic dimension. Het minimale operatorcontract is:

- `eq` voor één typed value;
- `in` voor een typed allowlisted set;
- `is_null` en `is_not_null` uitsluitend voor dimensions die nullability
  expliciet toelaten.

Operator en value worden per dimension gevalideerd. Er komen geen vrije
numeric/date expressions, regex, SQL-fragmenten of door de browser aangeleverde
kolomnamen. Filterwaarden worden uit de geautoriseerde semantic options
afgeleid; onbekende of niet-zichtbare waarden worden geweigerd.

### Tijd- en periodemodel

V2 heeft één expliciet typed model met drie betekenissen:

1. **Snapshot:** `as_of` voor state measures zoals headcount, FTE, type en
   tenure.
2. **Event period:** inclusieve ISO-datumrange `start`/`end` voor hires,
   leavers, transfers, absence en changes.
3. **Comparison period:** een tweede period van dezelfde soort en maatstaf,
   expliciet gekozen of server-side afgeleid als `previous_equal_period`.

Snapshot en event period zijn mutually exclusive. De default wordt door de
gekozen vraagtemplate bepaald; voor een directe headcountvraag is dat vandaag,
maar de uiteindelijke spec bevat altijd een expliciete datum. Period boundaries
zijn calendar-date boundaries in de tenant/HR-group business timezone; de
server normaliseert deze naar ISO-dates. De eerste V2-versie doet geen
rolling-window-mix, onregelmatige period lengths of forecast.

### Comparison model

Naast AN-6's bestaande value comparison ondersteunt V2 een typed
period comparison:

```text
comparison:
  kind: previous_equal_period | explicit_period
  primary: <snapshot or event period>
  secondary: <same semantic period kind>
```

De engine levert alleen compatibele measures/dimensions aan beide kanten. Het
resultaat mag `delta` en, wanneer de noemer niet nul is, `delta_pct` bevatten.
Bij een nul- of suppressed denominator is `delta_pct` `null`; de engine
verzint geen percentage. AN-6's exact-two-value comparison blijft beschikbaar
als een afzonderlijk typed comparisonkind.

## 6. AnalysisSpec V2 — voorstel

### Minimal evolution

V2 behoudt de herkenbare top-level intent en maakt alleen de noodzakelijke
uitbreidingen:

```json
{
  "version": 2,
  "source": "workforce",
  "entity": "employees",
  "measures": ["headcount", "fte"],
  "dimensions": ["department", "employment_type"],
  "filters": [
    { "dimension": "employment_status", "operator": "eq", "value": "ACTIVE_EMPLOYEE" }
  ],
  "period": { "kind": "snapshot", "asOf": "2026-09-01" },
  "comparison": { "kind": "previous_equal_period" },
  "sort": { "by": "measure", "measure": "headcount", "direction": "desc" },
  "limit": 25,
  "presentation": { "intent": "auto" }
}
```

Het voorbeeld is een ontwerpillustratie; het impliceert niet dat `fte`,
`employment_type` of period comparison al uitvoerbaar zijn.

V2 moet ondersteunen:

- maximaal drie allowlisted measures, waarbij elke combinatie door de
  semantic registry wordt toegestaan of geweigerd;
- maximaal twee outputdimensions;
- maximaal acht normalized, typed filters;
- typed `period`, typed `comparison` en presentation intent;
- deterministic sort op label of één geselecteerde measure;
- top/bottom N via `limit` plus sort, zonder aparte vrije querytaal;
- expliciete null/unknown-group policy;
- server-owned authorization/context die niet in de JSON kan worden
  overschreven.

Strict validation, semantic resolution, authorization vóór retrieval,
versionability en reproducibility blijven ongewijzigd. `AnalysisSpec` blijft
een intentcontract, geen queryplan.

### Representative examples

**1. Headcount per department op peildatum**

```json
{
  "version": 2,
  "source": "workforce",
  "entity": "employees",
  "measures": ["headcount"],
  "dimensions": ["department"],
  "filters": [{ "dimension": "employment_status", "operator": "eq", "value": "ACTIVE_EMPLOYEE" }],
  "period": { "kind": "snapshot", "asOf": "2026-09-01" },
  "comparison": null,
  "sort": { "by": "measure", "measure": "headcount", "direction": "desc" },
  "limit": 25,
  "presentation": { "intent": "auto" }
}
```

**2. Headcountverandering per department**

```json
{
  "version": 2,
  "source": "workforce",
  "entity": "employees",
  "measures": ["headcount"],
  "dimensions": ["department"],
  "filters": [],
  "period": { "kind": "snapshot", "asOf": "2026-09-01" },
  "comparison": { "kind": "previous_equal_period" },
  "sort": { "by": "measure", "measure": "headcount", "direction": "desc" },
  "limit": 25,
  "presentation": { "intent": "comparison" }
}
```

**3. Instroom per periode**

```json
{
  "version": 2,
  "source": "workforce",
  "entity": "employment_events",
  "measures": ["hires"],
  "dimensions": ["department"],
  "filters": [],
  "period": { "kind": "event", "start": "2026-01-01", "end": "2026-03-31" },
  "comparison": null,
  "sort": { "by": "measure", "measure": "hires", "direction": "desc" },
  "limit": 25,
  "presentation": { "intent": "trend" }
}
```

**4. FTE en uren per department**

```json
{
  "version": 2,
  "source": "workforce",
  "entity": "workforce_capacity",
  "measures": ["fte", "scheduled_hours"],
  "dimensions": ["department"],
  "filters": [{ "dimension": "employment_type", "operator": "in", "value": ["EMPLOYEE", "CONTRACTOR"] }],
  "period": { "kind": "snapshot", "asOf": "2026-09-01" },
  "comparison": null,
  "sort": { "by": "measure", "measure": "fte", "direction": "desc" },
  "limit": 25,
  "presentation": { "intent": "auto" }
}
```

**5. Verzuimrate per department**

```json
{
  "version": 2,
  "source": "absence",
  "entity": "absence_summary",
  "measures": ["absence_rate", "sick_hours"],
  "dimensions": ["department"],
  "filters": [],
  "period": { "kind": "event", "start": "2026-01-01", "end": "2026-03-31" },
  "comparison": { "kind": "previous_equal_period" },
  "sort": { "by": "measure", "measure": "absence_rate", "direction": "desc" },
  "limit": 25,
  "presentation": { "intent": "trend" }
}
```

### V1 → V2 compatibility

- Iedere opgeslagen V1-definition blijft leesbaar en uitvoerbaar met de V1
  semantics. V1 heeft geen verborgen datum die achteraf wordt ingevuld.
- V2 krijgt `version: 2` en een eigen strict validator. Onbekende fields,
  oude/nieuwe identifiers en incompatibele measures worden geweigerd.
- Het saved-definitionmodel bewaart de definitie, niet het resultaat. Een V2
  definition wordt bij openen opnieuw geautoriseerd en vers uitgevoerd.
- Er is geen silent rewrite van V1 naar V2. Een expliciete human/Explore-actie
  kan een nieuwe V2-definition opslaan; de oude definitie blijft intact.
- Een eventuele database-validatorwijziging voor V2 JSON is een aparte forward
  migration met dezelfde allowlist als de servervalidator. Deze discovery
  voegt geen migration toe en past niets remote toe.

## 7. Liquid Canvas V2 — resultaatrenderer

Canvas blijft een renderer van `AnalysisResult`, geen BI-editor. De engine
levert de result shape, measures, dimensions, period/comparison metadata,
privacystatus en presentation hints. Canvas leest geen employee source rows en
berekent geen business facts.

| Visual | Compatible result shape | Incompatible shape / fallback | Auto-selection | Mobile |
|---|---|---|---|---|
| KPI | Geen outputdimension; één measure en één summary | Meerdere dimensions, grouped rows of period series → table/appropriate chart | Default voor één snapshot summary | Full-width surface; comparison KPIs stapelen. |
| KPI + delta | Eén snapshot/event measure plus één compatibele comparison summary | Geen compatible comparison of suppressed denominator → KPI zonder percentage | Voor expliciete period/value comparison | Twee waarden en delta onder elkaar, geen horizontale overflow. |
| KPI + small trend | Eén measure plus 6–12 typed time points | Geen time axis of te veel/ongelijke points → KPI/table | Voor trend-intent met compacte periodreeks | Grafiek schaalt naar container; tekstueel alternatief blijft zichtbaar. |
| Tabel | Eén/twee dimensions, meerdere measures, comparison rows, unknown bucket | Onbekende result columns → safe empty/fallback | Altijd beschikbaar als canonical fallback | Lokale table-scroll of compacte stacked rows; nooit page-wide overflow. |
| Vertical bar | Eén korte categorical dimension + één numeric measure | Twee dimensions, te veel labels of meerdere incompatible measures → horizontal/table | Korte labels en beperkte cardinaliteit | Full-width responsive bars; labels krijgen accessible volledige naam. |
| Horizontal bar | Eén categorical dimension + één numeric measure, langere labels | Time series of matrix-shape → line/table | Lange labels, top/bottom N | Hoogte groeit gecontroleerd; geen vaste desktopbreedte. |
| Line/trend | Typed time dimension + één of meerdere compatible measures | Geen tijdas, event rows zonder period aggregation → table | Period/trend intent met chronologische points | Horizontaal scrollen alleen binnen de chart indien nodig; table alternative blijft. |
| Stacked bar | Eén primary dimension, één series dimension, één measure | Meer dan twee dimensions of mixed units → table | Alleen als stack total en series semantisch gelijk zijn | Legend onder/naast chart; bij krappe ruimte automatisch tabel. |
| Comparison visual | Exact twee compared values en één measure, optioneel één breakdown | Meer/minder values, mixed measures of suppressed sides → comparison table | AN-6 value comparison of V2 period comparison | Comparison cards/table stacken. |

**Niet in de minimale V2-catalogus:** donut en matrix/crosstab. Donut voegt
voor de gekozen vragen geen noodzakelijke semantiek toe en kan kleine
proporties misleidend presenteren. Een matrix wordt pas toegevoegd als Q12's
from/to-transfervraag na domainbesluit echt een matrixresultaat vereist. In de
tussentijd is een comparison table de veilige fallback.

Auto-selection wordt uitsluitend gestuurd door typed result metadata:
cardinality, number/type of measures, number/type of dimensions, time axis,
comparison en privacy state. Bij ontbrekende of unsupported hints kiest Canvas
een tabel/empty state en niet een eigen interpretatie.

## 8. Liquid Explore V2

Explore V2 is progressive guided analysis, geen query builder. Alleen stappen
die voor de gekozen question template betekenisvol zijn worden getoond.

1. **Wat wil je begrijpen?** Kies een vraagvorm, bijvoorbeeld omvang, mix,
   instroom/uitstroom, verandering, capaciteit of verzuim. Dit is geen vrije
   prompt.
2. **Maatstaf** Kies één of meer compatible measures; `headcount` is de default
   voor workforce-vragen.
3. **Uitsplitsing** Kies nul, één of maximaal twee dimensions. De UI toont
   alleen dimensions die de gekozen entity/measure ondersteunt.
4. **Filters** Voeg meerdere filters toe via searchable, accessible choice
   controls. Elke gekozen dimension kan maar één normalized filter krijgen;
   selections zijn visible chips en server-side opnieuw gevalideerd.
5. **Periode** Kies snapshot/peildatum of eventperiode. De vraagtemplate geeft
   een begrijpelijke default; de uiteindelijke spec bevat de expliciete datum.
6. **Vergelijk** Kies vorige gelijke periode, expliciete comparison period of
   bij AN-6 exact twee toegestane values. Incompatible comparisons worden niet
   aangeboden.
7. **Presentatie** `auto` is de default. Sort, limit en eventuele advanced
   options staan onder een compacte advanced disclosure.
8. **Uitvoeren** Maak de strict V2-spec en stuur die naar dezelfde analysis
   route/engine. De client aggregeert geen data.
9. **Drill / Compare** Behoud de AN-6 row selection, contextstack, Back, Reset,
   aggregate-only compare en fresh execution.
10. **Opslaan** Bewaar alleen de server-gevalideerde V2-definition onder de
    bestaande saved-analysis-eigenaarschap- en scopecontracten.

### UX-guardrails

- Een KPI zonder breakdown wordt standaard geselecteerd voor snapshot summary;
  bij een breakdown wordt een grouped table/bar voorgesteld.
- Event measures vereisen een eventperiode; snapshot measures vereisen een
  peildatum. De UI laat ongeldige combinaties niet kiezen.
- Twee dimensions zijn het maximum. Een derde dimension, vrije SQL,
  calculated expression of arbitrary field blijft onbeschikbaar.
- Filters verschijnen pas nadat entity/measure/dimension bekend zijn; opties
  komen uit de geautoriseerde semantic options.
- Advanced sort/limit en null-policy blijven uit de primaire flow totdat zij
  nodig zijn.
- Op `390x844` is de flow één kolom met één actieve stap tegelijk, lokale
  disclosure voor advanced options en een zichtbare uitvoeractie; tables en
  comparison cards mogen geen horizontale page overflow veroorzaken.
- AN-6 interaction patterns worden hergebruikt; V2 introduceert geen tweede
  exploration state of parallelle navigatielogica.

## 9. Contract met AN-8 Conversational Analysis

Explore V2 en AN-8 moeten dezelfde `AnalysisSpec V2` produceren en dezelfde
typed intent-operaties kunnen toepassen:

```text
create analysis
set/add/remove measure
set/add/remove dimension
add/remove filter
set period
set comparison
set presentation
drill
compare
back / reset
save
```

AN-8 mag later natuurlijke taal vertalen naar deze gecontroleerde operaties.
Elke operatie gaat door dezelfde servervalidator, semantic resolver,
authorization/context-opbouw, retrieval adapter, `AnalysisResult` en
Liquid Canvas. Een conversatie krijgt hoogstens aggregate-only resultdata die
voor de gebruiker nodig is; een model/provider krijgt geen raw employee rows,
employee-identifiers, SQL, tenantcontext of Supabase-client.

De architectuur wordt daarmee:

```text
Explore V2 ───────┐
                  ├─> controlled intent / AnalysisSpec V2
AN-8 conversation ┘          ↓
                     Analysis Engine V2
                             ↓
                     AnalysisResult V2
                             ↓
                       Liquid Canvas V2
```

`Explain`/`Waarom?` is geen verborgen stap in dit contract. Het blijft een
optionele latere capability die alleen kan werken op geautoriseerde
aggregate-resultaten en verklaarbare engine-metadata.

## 10. Security en privacy

### Nieuwe risico's

- Twee dimensions en meerdere measures maken kruisingen mogelijk die een
  kleine groep herkenbaar maken.
- Perioden en historische placements kunnen oude scope, voormalige werknemers
  of managerrelaties zichtbaar maken die niet automatisch gelijk zijn aan de
  huidige scope.
- Salary, absence, age, gender en leave balances zijn gevoelig; deltas en
  percentages kunnen ondanks aggregatie terugrekenen naar een individu.
- Manager-scope kan onbedoeld uitbreiden als een V2-adapter `HR_GROUP` leest
  terwijl de actor alleen direct reports mag zien.
- Saved V2 definitions kunnen identifiers of oude context impliciet bewaren;
  openen mag nooit een oude autorisatie hergebruiken.
- AN-8 verhoogt exfiltratie- en prompt-injectionrisico als semantische
  metadata of resultaten buiten de controlled intent boundary komen.

### Voorgestelde guardrails

1. Validate version, entity, measures, dimensions, filters, period en
   comparison vóór actor/context of retrieval; authorize daarna server-side en
   controleer RLS via de bestaande scoped seams.
2. Houd tenant, actieve HR-group, administration en manager-scope volledig
   server-owned. Een client- of conversation-field kan deze context niet
   bepalen.
3. Maak iedere aggregate-adapter permission-aware. Salary vereist minimaal
   `salary:read`; absence vereist het bestaande absence-reportcontract;
   demographic entities krijgen een eigen beslissing.
4. Introduceer een minimum-cohort/suppression policy voor sensitive measures.
   De werkbare productaanbeveling is `k=5` per uiteindelijke cel en per
   comparison-side; suppress count, percentage, delta en afleidbare totals
   samen. Het exacte getal en eventuele strengere regels voor salary/absence
   vereisen Edwin/privacy-review.
5. Pas suppression toe ná alle filters en dimensions, ook op `unknown` en
   comparison rows. Toon geen “total” waarmee een suppressed groep kan worden
   terugberekend.
6. Gebruik alleen aggregate result fields in Canvas en AN-8. Geen employee-id,
   naam, raw row, SQL, databasekolom of debugveld in `AnalysisResult V2`.
7. Herautoriseer elke saved definition bij open/execute. V1- en V2-definitions
   zijn immutable als scope-eigenaarschap; versie-upgrade is expliciet en
   reproduceerbaar.
8. Beperk history tot de periodes en dimensions waarvoor de actor werkelijk
   bevoegd is. Leg voormalige, toekomstige en draft-statussemantiek vast vóór
   de eerste event-adapter.
9. Log alleen technische execution outcome en een opaque definition/result
   reference; geen HR values of model prompts.

Minimum-cohort suppression is voor Q14/Q15 en waarschijnlijk Q10 noodzakelijk;
voor gewone headcount is het een product- en privacybesluit, geen reden om een
algemene onbeperkte suppression aan te nemen.

## 11. Delivery slicing

De onderstaande slices zijn voorstelbaar en afzonderlijk testbaar. Zij zijn
geen autorisatie om te bouwen, migreren of deployen.

### V2A — Semantic Layer + AnalysisSpec/Engine

**Exacte scope**

- V2 registry en strict `AnalysisSpec` naast V1, met één entity per spec,
  maximaal drie measures, twee dimensions, typed filters en explicit periods.
- Eerst de `employees` snapshot-seam: expliciete `as_of`, headcount,
  `employment_type`, twee dimensions en period comparison.
- Daarna afzonderlijke typed adapters voor hires/leavers, tenure en capacity
  volgens de open domainbesluiten; bestaande V1 saved definitions blijven
  uitvoerbaar.
- Bestaande AN-6 compare/drill semantics behouden en alleen naar V2 intent
  uitbreiden nadat result shapes vaststaan.
- Reuse van V1 Canvas als table/KPI fallback, zodat V2A zonder nieuwe
  presentatielaag waarde kan bewijzen.

**Niet-doelen**

- Geen conversational UX, chartcatalogus, free SQL, arbitrary fields,
  employee-level result, salary, demographics of cross-domain joins.
- Geen implicit migration van bestaande saved analyses.

**Dependencies en security**

- Headcount moet de retrievalgrens van 500 oplossen via een veilige paged of
  server aggregate seam; geen client-side stitching.
- FTE, absence, transfer en planned-change adapters wachten op hun eigen
  domain-contracten. RLS, permission en manager-scope worden per adapter
  server-side getest.
- V2 saved definitions kunnen een narrowly scoped forward migration nodig
  hebben voor de JSON allowlist; verwacht geen schemawijziging voor pure
  application aggregation, maar beslis dit pas na schema/typegen-preflight.

**Acceptance scenarios**

- HR Admin maakt headcount op twee peildata, per afdeling/type, en krijgt een
  deterministic delta; een V1-saved definition opent nog correct.
- Een Manager ziet alleen de toegestane directe scope; fake tenant/group,
  client period en unknown semantic identifiers worden geweigerd.
- Hires/leavers tellen rehires en meerdere Employments volgens het vastgelegde
  contract; incomplete/unsupported records fail closed.
- Multiple filters, two dimensions, null bucket, zero denominator en limit
  geven typed, reproduceerbare results zonder raw records.

### V2B — Liquid Canvas V2

**Exacte scope**

- Renderer voor de vastgestelde V2 result shapes: KPI, KPI + delta, small
  trend, table, bars, line, stacked bar en comparison.
- Typed auto-selection, accessible text alternatives, table fallback,
  suppression state en mobile layout.

**Niet-doelen**

- Geen nieuwe enginesemantiek, raw-data lezen, chart designer, donut/matrix in
  de minimumcatalogus, export- of dashboard-widgetruntime.

**Dependencies en security**

- V2A `AnalysisResult` is authoritative; Canvas ontvangt alleen sanitized
  aggregate data. Geen nieuwe permission of database-seam.

**Acceptance scenarios**

- Elke compatible result shape kiest de verwachte visual; malformed,
  unsupported en suppressed shapes vallen veilig terug.
- KPI/delta/trend/comparison blijven inhoudelijk gelijk aan de engine;
  table fallback toont alle niet-gevoelige data.
- Desktop en `390x844` hebben geen page-wide overflow, zichtbare focus en een
  leesbare tekstuele fallback.

### V2C — Liquid Explore V2

**Exacte scope**

- Progressive question-led flow die exact dezelfde V2-spec produceert als
  server- of conversation-generated intent.
- Multi-measure/two-dimension/filter/period/comparison controls met
  invalid-combination prevention.
- AN-6 drill, compare, Back, Reset en Mijn Analyses versioned save/open
  behouden.

**Niet-doelen**

- Geen BI query builder, vrije vraag, AI/provider, SQL, sharing,
  collaboration, snapshots, result cache, scheduling of report export.

**Dependencies en security**

- V2A moet de spec/route/result contracten leveren; V2B bepaalt alleen de
  rendering. Saved V2 JSON-validatie kan een aparte migration vereisen.
- UI-verberging is alleen UX; servervalidator, authorization en RLS blijven
  de security boundary.

**Acceptance scenarios**

- Een niet-technische gebruiker maakt Q2, Q5 en Q7 zonder raw fields te zien;
  de execution payload is een strict V2-spec.
- Ongeldige measure/dimension/filter/period combinations zijn niet kiesbaar en
  worden server-side alsnog geweigerd bij tampering.
- Explore en later AN-8 leveren dezelfde intent/result shape; saved V1 en V2
  worden vers en scoped geopend.
- HR Admin en Manager worden getest op desktop en `390x844`, met focus,
  overflow, suppression en aggregate-only negative cases.

## 12. Roadmapvoorstel

Historische nummers worden niet hernoemd:

```text
AN-0 t/m AN-6       historisch / current delivered roadmap
AN-7 Explain        DEFERRED / BACKLOG

Liquid Analyse V2 Foundation
  V2A Semantic Layer / Engine
  V2B Liquid Canvas
  V2C Liquid Explore

AN-8 Conversational Analysis
AN-9 Certified Reports Integration
AN-10 Final Security & Acceptance
```

AN-8 start pas wanneer Explore V2, AnalysisSpec V2, Engine V2 en Canvas V2
één stabiel controlled-intent contract delen. AN-9 en AN-10 mogen geen
onbewezen privacy- of reportcapabilities stilzwijgend in V2A trekken.

## 13. Open productbesluiten voor review

1. Is `headcount` standaard alleen `ACTIVE_EMPLOYEE`, of blijft “alle
   niet-gearchiveerde employees” een expliciete vraagoptie?
2. Tellen hires/leavers unieke employees of employment events? Hoe behandelen
   we rehires, parallelle Employments en cross-administration movement?
3. Welke taxonomie krijgt prioriteit: `employment_type`, `contract_type`,
   `duration_type` of een bewuste combinatie met verschillende labels?
4. Moeten historische department/job/type-values altijd de value op de
   peildatum zijn, en hoe wordt een ontbrekende placement gegroepeerd?
5. Is FTE `part_time_factor`, hours gedeeld door fulltime reference, of een
   andere canonical measure? Welke schedule wint bij overlap?
6. Wat is de formele interne-transferdefinitie en welke `from`/`to`-waarden
   zijn betrouwbaar genoeg voor Q12?
7. Welke `employment_change_sets.status`-waarden zijn analyticswaardig:
   alleen `APPLIED`, ook `DRAFT`, of een aparte geplande publicatiestatus?
8. Welke manager/history scope is toegestaan voor snapshots en events, en
   blijft de HR-group de maximale analysis boundary?
9. Welke minimum-cohortwaarde(n) en rounding/suppressionregels gelden voor
   absence, demographics en salary? Is het voorgestelde `k=5` acceptabel?
10. Blijft compensation volledig in het gespecialiseerde Salary Insights-pad,
    of komt er later een apart gated `compensation` entity-contract?
11. Welke period defaults en trendgrain zijn productmatig gewenst: maand,
    kwartaal, jaar of alleen expliciete datums in V2A?
12. Is de V2 minimumvisualcatalogus zonder donut/matrix voldoende voor de eerste
    canonical questions?
13. Mogen users V1 saved definitions expliciet converteren naar V2, of blijven
    V1 en V2 altijd gescheiden definitions?
14. Welke question templates krijgen de eerste Explore V2-release: alle P0's,
    of eerst Q1/Q2/Q5/Q6/Q7 als kleinste coherent bewijs?

## 14. Expliciete non-goals

- Geen AN-7 Explain/`Waarom?` in V2A/B/C.
- Geen implementatie, migration, Supabase mutation, Vercel mutation,
  version bump, deploy, merge of main-integratie als gevolg van dit document.
- Geen free SQL, arbitrary query builder, browser SQL, AI-generated SQL,
  direct Supabase access of raw employee-data exposure.
- Geen tweede analytics engine voor Explore of AN-8.
- Geen employee-level drill, row export, result snapshot, cache, sharing,
  collaboration, scheduling, widgets of certified reports in de foundation.
- Geen automatische opname van salary, demographics, leave, absence,
  Talent, surveys, WvP of custom fields zonder afzonderlijk semantic,
  permission/RLS en privacycontract.
- Geen nieuwe productclaims op basis van losse bestaande Insights-rapporten;
  een report-service is pas Liquid Analyse-capability na een expliciete,
  allowlisted aggregate seam.

## Discovery conclusion

De kleinste geloofwaardige V2 is niet “meer filters” maar een gecontroleerd
period- en measuremodel rond echte workforcevragen. De eerste productreview
moet daarom de negen P0-vragen, de headcount/re-hire/FTE-definities en de
minimum-cohort policy bevestigen. Pas daarna is V2A klaar om als afzonderlijke
verticale engineering-slice te worden gespecificeerd.
