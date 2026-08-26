# LiquidHR — R6-1 Insights query- en navigatieseam

Status: frozen contract for R6-2 and new report adapters.

Deze slice centraliseert uitsluitend de gedeelde identiteit, URL-codec, navigatie en terugcontext van Insights. Rapport-specifieke periodebetekenis, filters, sortering, privacyregels, berekeningen, loader en export blijven eigenaar van het rapport.

## Adaptercontract

`apps/hr-suite/lib/insights/query-seam.ts` exporteert `InsightReportAdapter<TQuery, TReport>` en `defineInsightReportAdapter`. Iedere toekomstige adapter definieert:

- `id`, `audience`, `permissions`;
- typed `query` met `parse`, `serialize`, `defaults` en `canonicalize`;
- `ownedQueryKeys`;
- `filters` als descriptor-seam, zonder een nieuwe gedeelde controlfamilie te veronderstellen;
- `loader`, `exporter`, `activeFilterLabels`, `drilldown` en `view`.

Bestaande reports hoeven in R6-1 niet volledig te worden herschreven. Hun bestaande parsers, services en views blijven report-owned; de gedeelde `query-seam`-helpers worden gebruikt voor URL-normalisatie, report switching, Apply en drilldowncontext.

## Canonical URL

De URL bevat de applied state. De canonical report-identiteit is `report=<kebab-case-id>`.

| Onderdeel | Canonical | Legacy input |
| --- | --- | --- |
| Groepering | `groupBy` | `group` |
| Sortering | `sortBy` | `sort` |
| Single department | `departmentId` | `department` |
| Multi department | herhaalde `departmentIds` | `departments`, komma-lijst |
| Andere arrays | herhaalde keys | komma-lijst blijft parsebaar |
| Upcoming report | `upcoming-events` | `upcomingEvents` |

Serializers schrijven de canonical vorm. Parsers accepteren canonical en legacy input; waarden worden getrimd, gededupliceerd en blijven als afzonderlijke waarden behouden. Daardoor blijft bijvoorbeeld `IT & Development` één label/waarde en wordt het niet door URL-encoding of comma-splitting verminkt.

`canonicalInsightHref` normaliseert aliases en verwijdert bekende report-keys die niet bij het gevraagde report horen. Een onbekend report verwijdert het report en alle bekende report-state, maar laat niet-report queryparameters ongemoeid.

## Query ownership en report switching

`reportQueryKeys` in `query-seam.ts` is de centrale ownershipregistry voor cleanup. Bij switching via `buildInsightReportNavigationHref` worden alle bekende report-keys verwijderd en wordt daarna alleen de nieuwe `report` geplaatst. Hiermee kunnen salary-parameters niet naar Upcoming, employee-parameters niet naar Absence en Upcoming-parameters niet naar Salary lekken. Presentation state zoals `view` blijft behouden.

Nieuwe report adapters voegen hun report-id en owned keys toe aan dezelfde registry voordat ze aan de catalogus worden gekoppeld.

## Apply en Back/Forward

- Filterwijzigingen zijn draft state totdat het report een Apply uitvoert.
- Apply serialiseert de typed query canonical en commit met `router.push`.
- Back/Forward herstelt daardoor de vorige applied URL en laat de server opnieuw die query laden.
- `router.replace` is uitsluitend voor presentation state, zoals de employee distribution/trend-weergave en URL-normalisatie; het maakt geen nieuwe applied data history entry.

De employee-workspace initialiseert controls uit de expliciete URL-query. Alleen wanneer die state ontbreekt, mogen preferences/defaults als fallback worden gebruikt. Salary remount zijn query state bij een nieuwe canonical applied query; Upcoming en absence lezen hun typed query uit de server-URL.

## Drilldown return context

`insightEmployeeDrilldownHref` en `insightEmploymentDrilldownHref` schrijven:

```text
from=insights
returnTo=/insights?<canonical-query>
```

`normalizeInsightReturnPath` accepteert uitsluitend een interne `/insights`-path en canonicaliseert die opnieuw. Externe, protocol-relative, andere-route of ongeldige waarden vallen terug op `/insights`. De employee detailpagina gebruikt deze context alleen wanneer `from=insights`; anders blijft de bestaande `/employees`-backlink gelden.

## Security boundary

De catalogus en de bestaande server-side permissionchecks blijven leidend. `/insights?report=upcoming-events` laadt Upcoming alleen wanneer de catalogus het report voor de actieve context bevat; anders wordt geen Upcoming-service aangeroepen. Er zijn geen permissions, RLS-policies, migrations of remote schemawijzigingen toegevoegd.

## R6-2 handoff

R6-2 mag concrete shared controls en adapterregistraties op dit contract aansluiten. R6-2 introduceert geen alternatieve URL-codec, lokale report-switch cleanup, directe `router.replace` voor applied filters of onveilige vrije return-URL’s.
