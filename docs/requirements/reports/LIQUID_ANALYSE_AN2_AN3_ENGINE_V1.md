# Liquid Analyse AN-2/3 — Analysis Engine V1

**Status: LEIDEND — V1 APPLICATION CONTRACT**

Dit document beschrijft de eerste engine-slice achter Liquid Analyse. De AN-0/AN-1-hub blijft bewust ongewijzigd: de vier bestaande tegels blijven staan, alleen Rapporten is actief, en deze engine wordt niet als nieuwe hub-UX geactiveerd.

## Semantic Layer V1

De semantic layer bevat alleen de bewezen, groepsbrede medewerkerprojectie uit de bestaande employee-overviewservice:

- entity: `employees` uit source `workforce`;
- measure: `headcount`, met `count_distinct`-semantiek op employee-id;
- dimensions: `department`, `job` en `employment_status`;
- filters: dezelfde drie dimensions, met alleen `eq` en `in`; employment status gebruikt een vaste allowlist;
- relationship metadata: current department, current job en employment history;
- scope: `HR_GROUP` binnen de actieve tenant;
- presentation capabilities: `kpi` en `table`.

V1 staat maximaal één output-dimension toe. Daarmee blijft de result shape klein en wordt een niet-ondersteunde multi-dimensionele combinatie expliciet afgewezen. De semantic definitions bevatten geen databasekolommen, SQL, joins, functies of uitvoerbare querymetadata.

## AnalysisSpec V1

Een spec is een strikt, JSON-serialiseerbaar intentiecontract:

```json
{
  "version": 1,
  "source": "workforce",
  "entity": "employees",
  "measures": ["headcount"],
  "dimensions": ["department"],
  "filters": [
    { "dimension": "employment_status", "operator": "eq", "value": "ACTIVE_EMPLOYEE" }
  ],
  "sort": { "by": "value", "direction": "desc" },
  "limit": 25,
  "presentation": "auto"
}
```

De server valideert de shape met Zod en resolveert vervolgens iedere identifier via de allowlisted semantic layer. Typed errors dekken onder meer unsupported source/entity/measure/dimension/filter, invalid operator/value, unsupported version en incompatibele measure/dimension of presentation. Onbekende top-level velden en SQL-achtige identifiers worden niet geaccepteerd.

## Authorization en retrieval

De vaste volgorde is: spec valideren, semantic identifiers resolven, actor/context ophalen, `dashboard:read` plus `employee:read` of `employee-directory:read` controleren, actieve HR-groep vaststellen, daarna pas `listEmployeesOverview` aanroepen. De bestaande service gebruikt de vaste `list_employee_overviews`-RPC met tenant- en HR-groepcontext; er is geen generieke query builder en geen browser/client-toegang tot Supabase. De engine controleert de scope bovendien opnieuw voordat aggregatie plaatsvindt.

## AnalysisResult en Liquid Canvas

`AnalysisResult` geeft alleen version/source/entity, measure- en dimensionkeys, metadata, vaste kolommen, geaggregeerde rows, summary en presentation hints terug. Tenant-, actor-, employee-id-, SQL- en debuggegevens zitten niet in het resultaat.

`LiquidCanvas` ontvangt uitsluitend `AnalysisResult` en vertaalde labels. Zonder dimension wordt een KPI getoond; met dimension wordt de vaste Foundation `DataTableShell` gebruikt. Een unsupported presentation hint valt terug op dezelfde tabel en een lege grouped result gebruikt `EmptyState`. Er is geen nieuwe chartdependency.

## Bewust uitgesteld

Mijn Analyses, Liquid Explore, deep analysis, conversational/free-text analysis, AI-planning, Liquid Credits, provider/FUP-gebruik en result snapshots vallen buiten AN-2/3. Er is geen saved-analysis model en geen migration nodig.
