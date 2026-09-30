# Payroll Engine M0 — ontwikkelcontract

Datum: 2026-09-30. Scope: eerste synthetische berekening GC-NL-001 en het
ownership-addendum van Edwin. Geen fiscale Nederlandse 2026-regels.

## Keten

Canonical `PayrollSourceSnapshot` → getypeerde engine-input → immutable
`CalculationInputSet` → `CalculationRun` PENDING → RUNNING → componentresultaten,
trace en controls → SUCCEEDED. Berekenings- of opslagfouten eindigen in FAILED.
De bestaande PAYLAB00-tabellen, scopefilters en lifecycletriggers blijven de
opslaggrens. React doet geen databasecalls.

Bedragen gebruiken vaste decimalen en bigint-rekenwerk. Hashes bevatten
inhoud en berekeningsversies; nieuwe technische snapshot-, inputset- en run-ID's
en aanmaaktijden veranderen de inhoudshashes niet.

## Componentcontract

Elke component heeft een stabiele identiteit/code, versie, effectiveFrom en
effectiveTo, getypeerde inputs/outputs, afhankelijkheden, calculation method,
afronding, trace en processing scope.

- SYSTEM: LiquidHR-eigendom; klantconfiguratie kan de component niet wijzigen.
  Nieuwe versies bestaan naast historische immutable versies.
- CUSTOMER_FORK: een kopie met een eigen klantidentiteit en origin component
  id/code, origin version en forked timestamp. De kopie is vanaf dat moment
  volledig detached. Geen inheritance, automatische updates of merge.
- CUSTOMER_CUSTOM: klantidentiteit zonder system origin.

Fork/custom kunnen geen SYSTEM-identiteit overnemen of een SYSTEM-versie
in-place wijzigen. Alle drie gebruiken hetzelfde veilige runtimecontract.
Een Component Designer UI valt buiten M0.

## Veilige berekening

M0 ondersteunt PassThrough, Expression en Aggregate. Expressions zijn
getypeerde AST-nodes, geen JavaScript en geen vrije code. Alleen rekenkundige
operators (+, -, *, /), vergelijkingen (=, !=, >, >=, <, <=), AND/OR/NOT,
IF, MIN/MAX, ROUND en ABS zijn beschikbaar. Waarden, percentages,
componentinputs, expliciete componentoutputreferences en parameters zijn
toegestaan. Geen loops, databasecalls, externe API-calls of eval.

## GC-NL-001

Bruto 4000.00, werknemerspensioen 125.00, synthetische loonheffing 700.00,
netto 3175.00. Werkgeverspensioen 250.00, verzekeringen 400.00, Zvw 260.00,
vakantiegeldopbouw 320.00. Totale werkgeverskosten 4910.00.

De expliciete formule uit de opdracht is leidend: totale werkgeverskosten
zijn bruto + werkgeverspensioen + verzekeringen + Zvw. Vakantiegeldopbouw
wordt als aparte component getoond en niet bij die 4910.00 opgeteld.
Expected uitkomsten worden niet gewijzigd om tests te laten slagen.

## Lokale browseracceptatie

Uitsluitend de bestaande LiquidHR HR-admin Test Auth-identiteit wordt gebruikt.
Geen nieuwe Auth-gebruiker, permissionwijziging, persoonlijke credentials of
OAuth-login. De dashboard-shell, serverpermissions en Payroll-capability
blijven verplicht. De server bepaalt de scope; browserinput kan geen tenant,
administratie of actor instellen. Als de bekende JWT/clock-blokkade optreedt,
is browseracceptatie ENVIRONMENT-GATED; engine-, persistence- en technische
UI-verificatie lopen door zonder auth-bypass of nieuwe auth-RCA.

De databaseclient is vastgezet op het geverifieerde Payroll Lab-project
`jhgeriucbkfarxiudzfy`; Core blijft onaangeraakt. Gerichte serververificatie kan
de aparte synthetische Payroll Lab-scope gebruiken zonder een Auth-user aan te
maken. Opaque audit-UUID's in Payroll-testrecords zijn geen loginidentiteiten.

Verificatie en live resultaten staan in het afzonderlijke acceptatierapport.


## PAYLAB03 uitbreidingen (2026-09-30)

Engineversie 0.2.0 houdt de GC-NL-001-bedragen als synthetische regressiecase.
NL-PAYROLL-2026 versie 2026.1 bevat de afzonderlijke fiscale CC-NL-2026-001.
De geregistreerde SYSTEM-rule wordt statisch server-side geleverd; package,
component, schema, implementatie en parameters zijn gepind. Deze functiegrens
is geen sandbox. Klantcomponenten kunnen geen geregistreerde SYSTEM-rule
uitvoeren; een detached fork moet een ondersteunde veilige methode kiezen.

Rond alleen wanneer de actieve payrollregel dit expliciet voorschrijft,
precies op die calculation stage, met de voorgeschreven schaal en methode.
Versioned/effective-dated rounding definitions bevatten stage, schaal of
veelvoud, mode en wettelijke provenance. Ondersteund: arithmetic, floor,
ceiling, truncate, round-down-to-multiple en no-rounding. Floor en truncate
verschillen bij negatieve waarden. Niet-eindigende delingen vragen een
expliciete regel; wettelijke tijdvakdelingen ronden rechtstreeks vanuit een
exacte breuk. Decimal bewaart officiële parameterschalen; de veiligheidsgrens
van 36 decimalen weigert overflow en is geen impliciete afrondingsregel.
Serialization weigert verlies van niet-nul decimalen. Trace bewaart invoer,
uitvoer, exact verschil, mode/stage/schaal/versie en bron. Breuken blijven
exact als numerator/denominator bewaard. Geen generieke YTD-regel.

Node-identiteit bevat componentcode/versie, processing scope en opaque scope
instance ID. Employment en IKV zijn afzonderlijke identiteiten. Types reserveren
assessment-base scopes/groepen, grondslagspecifieke IKV-membership en een
versioned allocation-policy reference. Shared bases en restcentverdeling worden
nog niet uitgevoerd. Geen Core-IKV-schema of cross-database FK toegevoegd.

De huidige executor ondersteunt acyclische berekeningen. Expliciete iteratieve
clusters en versioned tolerance/comparison precision/max/min iterations/output
selectors zijn gereserveerd; uitvoering levert gecontroleerd
ITERATIVE_CLUSTER_UNSUPPORTED. Dit verklaart de huidige beperking zonder alle
toekomstige graphs universeel als DAG te definiëren. Geen iteration of
allocation calculation wordt in PAYLAB03 geïmplementeerd.
