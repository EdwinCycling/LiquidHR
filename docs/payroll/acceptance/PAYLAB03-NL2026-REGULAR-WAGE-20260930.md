# PAYLAB03 — eerste echte NL-2026 reguliere loonheffing

Datum: 2026-09-30. Status: fiscale implementatie, onafhankelijke oracle,
Lab-persistence en geauthenticeerde lokale browser **GREEN**.

## Baseline en governance

- Branch: `work/paylab00`; PAYLAB02 checkpoint `1918a7b2f94e6ad9c1544929a735b4d94a26a118`.
- AA-reference: `origin/docs/aa-foundation-20260929` op `b71d663` gelezen,
  inclusief AA-PAYROLL/AA-OP/AA-CURRENT/AA-ACCEPT; niet gemerged.
- Finale code-SHA: `5d7e9fc5e19ff4582787b51e0104c885ac83370a`. De opvolgende documentatiecommit
  registreert uitsluitend deze SHA; de geverifieerde implementatie blijft identiek.
- Geen push, merge, deployment, app-version bump, authwijziging, nieuwe gebruiker,
  gewijzigde permissions, Core-write of CONTROL02-schemawijziging.
- Bestaande goedgekeurde Planeten Lab-administratiekoppelingen hergebruikt.
  Alleen synthetische berekeningsartefacten naar LiquidHR-Payroll-Lab geschreven.
  Geen nieuwe migratie nodig; bestaande scoped FK en append-only artefacten behouden.

## Ondersteunde fiscale scope

CC-NL-2026-001: september 2026, volledige reguliere maand, WHITE/NL/STD,
jonger dan AOW gedurende de gehele betreffende maand, loonheffingskorting aan,
één synthetische werknemer, employment en afzonderlijke synthetische IKV.
LHK uit is dezelfde formule met expliciet uitgeschakelde kortingen en getest.
Bruto 4000.00 → afzonderlijke component fiscaal loon 4000.00 → loonheffing
818.67 → netto 3181.33. Geen pensioeninhouding of andere grondslagcorrectie.
De arbeidskorting per maand is 461.00; tabeljaarloon 47952, maandtabelrij 3996.00.

Geen AOW, groen, niet-NL, afwijkende herleiding/tijdvak, bijzondere beloning,
onvolledig tijdvak, negatieve bedragen, meerdere IKV's, bijzondere situaties
of jaarloon boven Lmax 133110. Deze situaties leveren expliciete
`NL2026_UNSUPPORTED_*` codes, geen nul of geschatte fiscale uitkomst.
Het bestaande run-lifecycle eindigt gecontroleerd FAILED; trace-uitkomst is
UNSUPPORTED met reden. De API/UI maakt die business-uitkomst zichtbaar.
Core IncomeRelationship blijft voor de source adapter UNSUPPORTED/SOURCE_GAP;
deze fixture is geen geïmproviseerde canonieke Core-entiteit.

GC-NL-001 blijft een aparte synthetische regressiecase met loonheffing 700.00,
netto 3175.00 en werkgeverskosten 4910.00. Die bedragen zijn geen fiscale
2026-acceptatie. De primaire Lab-pagina toont nu vier fiscale bedragen;
werkgeverspremies en pensioen worden niet als berekend getoond.

## Bronnen en onafhankelijke berekening

[Officiële analyse](../research/PAYLAB03-NL2026-REGULAR-WAGE-ALGORITHM.md)
bevat downloadlinks, paginaverwijzingen, actualiteitscontrole en SHA-256 voor
Rekenvoorschriften januari 2026 **versie 2**, parameterbijlage januari 2026
en Handboek maart 2026. Op 2026-09-30 was geen nieuwere 2026-correctie gevonden.
Rekenvoorschriften-SHA:
`283c1857d923e8cc9ed7d0a33ae6f6c0c8f35db6c886d67ee2289324cfe58a03`.

[Onafhankelijke oracle](../research/PAYLAB03-INDEPENDENT-ORACLE.md) is vóór de
productiecalculator geschreven in Python Decimal, zonder LiquidHR-imports.
21 verwachte cases zijn bevroren en gecontroleerd tegen 10 onafhankelijk
gelezen officiële witte-maandtabelankers. De parameterbijlage en v2-correctie
bepalen onder meer 37.56% in de tweede schijf. Alle cases hieronder PASS.

| Case | Fiscaal maandloon | LHK | Loonheffing | Netto |
| --- | ---: | --- | ---: | ---: |
| LOW | 500.00 | aan | 0.00 | 500.00 |
| LOW_TAX_POSITIVE | 1000.00 | aan | 13.83 | 986.17 |
| MID | 3000.00 | aan | 386.83 | 2613.17 |
| CC-NL-2026-001 | 4000.00 | aan | 818.67 | 3181.33 |
| HIGH | 9000.00 | aan | 3480.67 | 5519.33 |
| AHK_BOUNDARY_BELOW | 2477.99 | aan | 177.17 | 2300.82 |
| AHK_BOUNDARY_EQUAL | 2478.00 | aan | 177.17 | 2300.83 |
| AHK_BOUNDARY_ABOVE | 2478.01 | aan | 177.17 | 2300.84 |
| TABLE_STEP_BELOW | 4000.49 | aan | 818.67 | 3181.82 |
| TABLE_STEP_EQUAL | 4000.50 | aan | 820.92 | 3179.58 |
| TABLE_STEP_ABOVE | 4000.51 | aan | 820.92 | 3179.59 |
| NO_LHK | 4000.00 | uit | 1442.17 | 2557.83 |
| SECOND_BRACKET_BOUNDARY_BELOW | 6535.49 | aan | 2099.58 | 4435.91 |
| SECOND_BRACKET_BOUNDARY_EQUAL | 6535.50 | aan | 2099.58 | 4435.92 |
| SECOND_BRACKET_BOUNDARY_ABOVE | 6535.51 | aan | 2099.58 | 4435.93 |
| SECOND_BRACKET_STEP_BELOW | 6538.49 | aan | 2099.58 | 4438.91 |
| SECOND_BRACKET_STEP_EQUAL | 6538.50 | aan | 2101.92 | 4436.58 |
| SECOND_BRACKET_STEP_ABOVE | 6538.51 | aan | 2101.92 | 4436.59 |
| AHK_STEP_BELOW | 2479.49 | aan | 177.17 | 2302.32 |
| AHK_STEP_EQUAL | 2479.50 | aan | 178.83 | 2300.67 |
| AHK_STEP_ABOVE | 2479.51 | aan | 178.83 | 2300.68 |

## Engine-contract en precisie

NL-PAYROLL-2026 package 2026.1, engine 0.2.0. SYSTEM-definities zijn versioned en
effective-dated. Typed source/classification nodes → expliciete taxable wage →
SYSTEM registered wage-tax rule → veilige Expression voor netto. De registered
rule is alleen statisch server-side aangeleverd, met component/package/schema/
parameter/implementatiepins; geen clientcode, eval, dynamic imports of database-
of API-calls in de calculator. Een copied registered method werkt niet in een
CUSTOMER_FORK/CUSTOMER_CUSTOM; een fork moet een veilige ondersteunde methode
kiezen. Zie [enginecontract](../ENGINE_M0.md).

Implementatie-SHA (calculator UTF-8 met LF):
`ecbcb7aa47a15980d1da39673533bea3a0f6ab5af75b81a72ff5335e06ab2e56`.
Package-SHA:
`17ea6e7b7caa736c91f76ef23cbe8410d77d43a2d6c09d20038faa39514cc876`.

Geen binary floating point voor financiële berekeningen. Decimal en exacte
breuken behouden precisie; percentages bewaren officiële schalen. Geen
impliciete 18-decimalen-deling meer; niet-eindigende delen vereisen expliciete
rounding. Geen automatische afronding van iedere tussenstap of uitsluitend de
laatste stap. RoundingDefinition bevat stage, mode, decimalPlaces/targetMultiple,
effective dates, rule/packageversie en bronhash. Floor is niet truncate.
De trace bewaart unrounded/rounded/difference/mode/stage/scale/version/source;
voor /12 ook de exacte numerator/denominator. JSON-bedragen blijven strings;
de numerieke DB-bedragprojectie is geen bron voor herberekening of UI-bedragen.

Geen generieke YTD-berekening. Iteratieve clusters zijn een gereserveerd
versioned contract met tolerantie/comparison precision/iteration limits/selectors;
uitvoering is nu gecontroleerd unsupported. Scoped node identity en type-only
assessment-base group/membership/allocation-reference voorkomen een universele
DAG- of employment=IKV-aanname. Geen group execution of allocation uitgevoerd.
Deterministische restcentverdeling wordt pas getest wanneer allocation bestaat.

## Persistence en browserbewijs

Bestaande HR Admin Test Auth-sessie hergebruikt; geen credentials getoond.
Payroll hoofdmenu → Payroll Lab → Bereken NL-2026 test payroll → SUCCEEDED.
De aanvankelijke oude browser-tab had een CDP-timeout; een nieuwe tab in
hetzelfde in-app browserprofiel herstelde de verbinding. Geen auth-bypass.
De eerste resultaatweergave wees op een ontbrekende tracevertaling; die is
hersteld en voorzien van een targeted test op alle tracecodes van de main case.

Jupiter browserruns:
- `607afb87-632c-4d70-9286-2a01d48d2a39`
- `3124489e-8e64-4284-aff8-717ba5d6a014`

Beide SUCCEEDED; per run 4 componentresultaten, 1 trace, 4 PASS-controles.
Directe read-only Lab-query bevestigt deze artefacten en dezelfde hashes:
- bron `6e4e9e1c2d51eb4b06e28fc226a19a413b314b66c4cb7231b40d26be83c13d0c`
- input `47246b1f3e7037a11eb7ddd68303a9ed1625e5c62cf3fc4e4469d4833ff6c17a`
- resultaat `a2995a7af2a6b1876f5b5ccb21fb5db04a7f4a2ddfe190699cdda9f871e41cc5`

Vier controles: taxable wage reconciliation, net reconciliation, nonnegative tax,
nonnegative net. Een +0.01 netto-afwijking blokkeert de packageberekening.
Dit zijn aansluitcontroles; fiscale waarheid komt uit de onafhankelijke oracle.
De opt-in live-tests bevestigen daarnaast twee deterministische fiscale runs
én twee ongewijzigde M0-runs in de bestaande aparte synthetic testscope.

[Desktop](PAYLAB03-desktop.jpg) en [390px mobiel](PAYLAB03-mobile.jpg) opgeslagen.
Mobiel viewport/document scrollWidth beide 390, inclusief geopend trace.
Bruto/fiscaal 4.000,00, loonheffing 818,67 en netto 3.181,33 zichtbaar.
Trace toont onder meer 9824/12 → 818.67, arithmetic 2 decimalen en bronverwijzing.
Bestaande LiquidHR shell/sidebar/primitives/responsive/i18n/permissions gebruikt.

## Rollen en verificatie

Bronanalyse en onafhankelijke oracle zijn vóór implementatie onafhankelijk
uitgevoerd. Na de actuele operating rule zijn alle nieuwe/voortgezette agents
expliciet gpt-6-luna met reasoning-effort max gestart. Root bleef orchestrator.
Engine-review rechtvaardigt de smalle SYSTEM registered-rule grens voor de
staged statutory rounding/caps; eenvoudige nodes blijven generiek.
Security/persistence/scope review PASS: statische registry, scoped writes,
geen Core-write/client-scope/code injection. UI-review vond tekencodering,
ontbrekende controledetails en normale packageprovenance; alle drie hersteld
met bevestigde hercontrole. Browser- en DB-proof zijn apart hierboven vermeld.

- Engine + NL-package: 3 bestanden, 44 tests PASS (17 engine, 27 fiscale package).
- Applicatiegerichte Payroll/navigation-suite: 17 bestanden, 92 tests PASS;
  2 live-tests standaard opt-in overgeslagen en vervolgens beide expliciet PASS.
- Na tracevertalingsfix: service/page 11 tests PASS; na exact-bedrag-readback
  service 6 tests PASS. App typecheck PASS; engine/package typechecks PASS.
- Gerichte lint PASS; 39 i18n namespaces met gelijke NL/EN-sleutels.
- Finale webpack productiebuild PASS, TypeScript PASS, 300 pagina's gegenereerd.
  Client-boundary secretscan PASS: 628 browserassets; negatieve controle PASS.
- Geen volledige suite van circa 2000 tests gestart.

## Open en buiten scope

Geen complete Nederlandse payroll: werkgeverspremies, pensioen, VCR/YTD,
shared bases, multi-IKV, iteratie, reserveringen, loonaangifte en boven-Lmax zijn
niet geaccepteerd. PAYLAB01 live Core source proof blijft apart. Geen Production-
of hosted-proof, push/merge/deployment. Authomgeving is niet aangepast.
De gegenereerde `next-env.d.ts` en tijdelijke onderzoeksdownloads onder `tmp/`
blijven buiten de lokale featurecommit; beschermd env-bestand is niet gewijzigd.
