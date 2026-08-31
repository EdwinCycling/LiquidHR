# Liquid Analyse — AN-6 Contextual Drill & Compare

**Status:** LEIDEND — AN-6 V1 implementation contract
**Scope:** deterministic contextual exploration over AnalysisSpec V1
**Baseline:** `origin/main` `0121ff13cb8693687d873b4d33930cd2ec18e35c`

## Doel

AN-6 maakt Liquid Explore een doorlopende verkenning. Een gebruiker voert een
analyse uit, selecteert een betekenisvolle aggregate-resultaatrij, gebruikt die
rij als context, kiest een volgende ondersteunde dimensie en kan teruggaan of
resetten. Twee waarden van dezelfde semantische dimensie kunnen daarnaast in
dezelfde autoritatieve context worden vergeleken.

AN-6 blijft volledig deterministisch en gebruikt uitsluitend de bestaande
semantic layer en Analysis Engine V1. De Analyse-hub, Explore en Mijn Analyses
blijven één productflow; er komt geen tweede querytaal of losstaand
analyseproduct.

## Ondersteunde intentie

De enige execution-bron blijft de gesloten `AnalysisSpec` V1:

- source `workforce` en entity `employees`;
- measure `headcount` met `count_distinct`-semantiek;
- nul of één outputdimensie uit `department`, `job` en `employment_status`;
- alleen de bestaande allowlisted `eq`/`in`-filters;
- bestaande sortering, limiet en `kpi`/`table`-presentatie.

Een drill transformeert een gevalideerde spec als volgt:

```text
resultaatrij → allowlisted contextfilter → volgende dimensie → AnalysisSpec V1
             → bestaande authorization-first engine → LiquidCanvas
```

De geselecteerde rij moet onderdeel zijn van het actuele geautoriseerde
resultaat. De volgende dimensie moet semantisch ondersteund zijn en mag niet
de huidige outputdimensie zijn. Een bestaande identieke contextfilter wordt
hergebruikt en dubbele filters worden verwijderd. Een andere waarde op dezelfde
dimensie is een conflict en wordt geweigerd; de server overschrijft geen
bestaande gebruikersintentie.

## Exploration state en navigatie

De browser houdt alleen een typed stack van `{ AnalysisSpec, AnalysisResult,
context }` bij. De stack is sessiestaat en bevat geen employee-, tenant- of
HR-group-identifiers. De server en de actieve `AuthContext` blijven de bron van
waarheid voor autorisatie; URL-queryparameters en browser history zijn geen
execution-authoriteit.

De contextnavigatie toont de workforce-root, elke gekozen context en de nieuwe
outputdimensie. `Back` verwijdert exact één stackstap. `Reset` behoudt alleen de
eerste analyse. Een drilled resultaat is altijd een gewone geldige AnalysisSpec
V1 en kan opnieuw als zodanig worden opgeslagen.

## ComparisonRequest en ComparisonResult

AN-6 accepteert exact twee waarden van één vergelijkingdimensie. De request
heeft deze vorm en wordt strict gevalideerd:

```json
{
  "analysisSpec": "validated base intent",
  "comparisonDimension": "department",
  "comparisonValues": ["Sales", "Engineering"]
}
```

De base intent bepaalt optioneel één breakdown-dimensie. De
comparisondimensie mag niet tegelijk output- of filtercontext van de base intent
zijn. De server valideert de waarden tegen de actuele, geautoriseerde
semantische records; statuswaarden blijven allowlisted en department/job-
waarden kunnen niet als willekeurige database-identifiers worden aangeleverd.

De server bouwt twee strikte specs met elk één `eq`-contextfilter, voert beide
uit met dezelfde actor-, tenant- en actieve HR-group-context en lijnt daarna de
al geaggregeerde resultaten uit. Ontbrekende breakdown-rijen krijgen waarde
`0`. Het signed difference is steeds `left - right`.

`ComparisonResult` bevat alleen version, semantische dimensies, de twee
allowlisted labels, aggregate rows en drie aggregate summarywaarden. Het bevat
geen tenant-ID, HR-group-ID, employee-ID, SQL, databasekolommen, joins,
providerinformatie of debugvelden. Zonder breakdown wordt een Foundation
KPI-vergelijking getoond; met breakdown een Foundation `DataTableShell`.

## Autorisatie en privacy

De bestaande volgorde blijft onveranderd:

```text
strict intent → semantic resolution → actor/context
→ dashboard:read → employee:read of employee-directory:read
→ actief HR-group → authorized retrieval → aggregate → render
```

Drill controleert eerst opnieuw dat de contextwaarde in het actuele
geautoriseerde resultaat staat. Comparison laadt één geautoriseerde recordset
en gebruikt die gedeelde context voor beide engine-executies. Er is geen
service-role bypass, browser-Supabasepad, clienttenant, client-HR-group,
employee-level drill of vrije SQL.

## Mijn Analyses

Het bestaande saved-definitionmodel blijft ongewijzigd. Een drilled state kan
via het bestaande save-pad als gewone AnalysisSpec V1 worden opgeslagen; bij
openen wordt de spec opnieuw tegen actuele geautoriseerde data uitgevoerd. De
saved definition wordt niet automatisch gemuteerd.

Comparison blijft in AN-6 V1 sessie-/exploration state. Zij wordt niet
persisted: het bestaande schema bewaart alleen AnalysisSpec V1, en een nieuwe
migration om een tijdelijke vergelijking op te slaan zou geen betekenisvolle
reproduceerbare definitie opleveren.

## API-contract

| Route | Doel |
|---|---|
| `POST /api/insights/analysis` | Bestaande strict AnalysisSpec-executie |
| `POST /api/insights/analysis/drill` | Geselecteerde resultcontext transformeren en uitvoeren |
| `POST /api/insights/analysis/compare` | Twee contexten valideren, uitvoeren en aggregate-only alignen |

De nieuwe routes zijn geen generieke query-endpoints. Malformed JSON, unknown
keys, unsupported dimensions/values, conflicts, identical comparison values en
scope-/permissionfouten krijgen typed, no-store responses.

## UX-contract

Explore blijft de entry point:

```text
Analyse → Verkennen → Run → result row → Drill → Compare → optioneel Save
```

De LiquidCanvas-tabel maakt betekenisvolle dimensionrijen keyboard-toegankelijk
selecteerbaar. Een compacte contextbreadcrumb biedt Back en Reset. De drill-
selector gebruikt de Foundation searchable choice control. Compare gebruikt
twee zichtbare waarde-keuzes, een optionele breakdown-keuze en Foundation
KPI/table surfaces. De vergelijking wordt expliciet als niet-opgeslagen
sessiestaat aangeduid. Saved Analyses gebruikt exact dezelfde acties op de verse
resultaatweergave.

De layout moet bruikbaar blijven op desktop en `390x844`, met keyboard/focus-
states, geen horizontale overflow, geen gradients/glass/neon, geen chart-
dependency en geen legacy dashboard-widgetpatroon.

## Niet in AN-6

- AN-7 Explain, AN-8 Conversational Analysis, AN-9 Certified Reports of AN-10;
- AI, OpenAI, Liquid Credits, prompts, provider calls of vrije tekst;
- arbitrary SQL, arbitrary query builders of multi-query AnalysisSpec-syntax;
- employee-level/raw dataset drill, snapshots, result cache of comparison-
  persistence;
- nieuwe database-entiteiten, migration, RLS/grants, browser-Supabase of
  dashboard-widgetruntime;
- salaris- of andere niet-analysisdomeinen.

## Verificatiecontract

De AN-6 tests moeten minimaal drillen department→job,
department→employment_status en job→department, filterdeduplicatie en
conflictvalidatie, deterministic Back/Reset, strict spec-validatie, fresh
saved-analysis execution, twee-department KPI/table comparison,
job→employment_status comparison, zero/missing-side alignment, signed
difference, invalid/identical values, authorization vóór retrieval,
tenant/HR-group isolation en aggregate-only privacy afdekken.

De slice eindigt met relevante AN-2/3/4/5/6 tests, strict TypeScript, ESLint
0/0, NL/EN i18n-pariteit, `git diff --check`, Webpack production build en één
volledige suite. Er is geen remote schemaactie; migration required: **NO**.
