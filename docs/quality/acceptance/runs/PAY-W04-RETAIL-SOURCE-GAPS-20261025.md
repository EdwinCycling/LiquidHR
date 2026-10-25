# PAY-W04-RETAIL-SOURCE-GAPS-04 — Retail-context en werkintervallen

Datum: 25-10-2026.

**W04: PARTIAL. Reguliere Retail/R2-verwerking: HOLD.** De standaard Core Payroll-bronketen bevat geen gezaghebbende, versiegebonden `IN_STORE`/`ECOMMERCE`-bron en Actual Work levert geen klokintervallen. De normale Payroll-preflight weigert Retail-premieuren zonder intervalbewijs nu expliciet met `SOURCE_GAP`. De lokale Retail-context is aangescherpt op tenant, administratie, toegestane classificatie en effectieve datums. Er zijn geen databasewijzigingen, nieuwe bronwaarden of echte salarisruns uitgevoerd.

## Provenance en grenzen

- Repository: `EdwinCycling/LiquidHR`.
- Branch: `work/pay-w04-source-readiness-01-20261024`.
- Start-HEAD: `e8f40185355d474343a810ed321a1adbd6a85066`.
- Codecommit: `fee80170326ceaf8b22fb07abf1c4d42e7c831ce` (`fix(payroll): fail closed without Retail source evidence`).
- De volledige rootbuild op codecommit `fee8017` is geslaagd; buildprovenance noemt dezelfde code-SHA.
- Geen push, merge, deployment, migratie, databasewrite, payrollrun, review of finalisatie. W02 Draft PR #48 en Spoor A zijn ongemoeid.

## Broncontractmatrix

| Broncontract | Wat bestond | Wat is gerealiseerd | Wat ontbreekt / schema nodig | Bronhouderbevestiging |
| --- | --- | --- | --- | --- |
| Retail `IN_STORE` / `ECOMMERCE` | Core levert de effectieve arbeidsvoorwaardenset/CAO. Payroll kende al een optioneel `CaoRetailBusinessScope` in de snapshot en fixtures, maar de standaard `getEmploymentPayrollSourceProjection()` vult het niet. Er is geen expliciete Core-eigenschap of bestaande readroute voor dit bedrijfsmodel gevonden. De CAO-code bewijst geen winkel-/e-commercebedrijfsmodel. | De lokale context vereist nu tenant- en administratie-ID, `IN_STORE` of `ECOMMERCE`, bronclassificatie, referentie, versie en effectieve datums. Runtimevalidatie weigert een vreemde tenant/administratie, onbekende classificatie, ongeldige datums en een periode die niet volledig wordt gedekt. `effectiveTo` is inclusief; 31 juli dekt juli. De standaardservice blijft zonder bronbewijs `SOURCE_GAP`. | **Core-schema en readservice nodig** voordat officiële context kan worden geleverd. Bestaande Core-modellen hebben geen geschikte business-modelrij. Een enkel optioneel veld kan geen dubbele/overlappende classificaties detecteren; de toekomstige lezer moet alle effectieve rijen binnen scope ophalen en nul of meerdere passende rijen als `SOURCE_GAP` behandelen. Geen migratie gemaakt. | Bevestig bronhouder en bevoegd vaststeller; of classificatie werkgever- of vestigingsgebonden is; relatie met administratie/locatie; formele referentie; versie en geldigheid. Bevestig ook welke bestaande schrijfpermission en audit-event gelden voordat een schema/read/write-contract wordt gebouwd. Geen classificatie afleiden uit CAO, functienaam of branche.
| Goedgekeurde werkintervallen en overlap | `employment_work_hour_entries` bewaart datum, `DAY`/`PERIOD`, uren, status, goedkeuringstijd/-actor, bronsoort/-sleutel en `updated_at`. `actual_work_revisions` bewaart correctiehistorie. De Payroll-projectie leest echter geen begin-/eindtijd, tijdzone, bronvelden of revisierijen; zij bevat alleen dag-/periodegranulariteit en geaggregeerde uren. | De normale provider geeft `actualWork:SOURCE_GAP / ACTUAL_WORK_INTERVAL_SOURCE_UNAVAILABLE` bij goedgekeurde Retail-nacht-, zondag- of overwerkuren wanneer er geen intervalcontract beschikbaar is. De ontbrekende intervalbron wordt niet als overlap of als niet-overlap geïnterpreteerd. | **Actual Work-schema en readservice nodig.** Huidige tabellen hebben geen begin/einde en kunnen dag-, avond-, nacht- en overwerkintervallen noch hun snijvlakken herleiden. De numerieke R2-oracle blijft synthetisch; hij levert geen werkelijk rooster- of tijdregistratiebewijs. Geen migratie gemaakt. | Bronhouder bevestigt welke tijdregistratie gezaghebbend is, administratie-/werknemersscope, lokale tijdzone, over-middernacht- en DST-semantiek, onbetaalde pauzes, betekenis van `work_date`, goedkeuringsmoment en hoe correcties de intervalhistorie behouden. Daarna pas het minimale intervalcontract en de normale Payroll-readroute vastleggen.

## Contractontwerp voor latere schemawave

Dit is een ontwerpbesluit voor bronhouderreview, geen vrijgegeven schema of migratie.

1. Bewaar Retail-businessclassificatie in een expliciete Core-bron met tenant- en administratiescope en, alleen wanneer een bestaand vestigingsmodel wordt bevestigd, een foreign key naar die vestiging. Bewaar enumwaarde, `effective_from`/`effective_to`, bronreferentie, bronversie, bevestigingsstatus, actor en audit. Dwing eenduidige effectieve dekking per scope af. De readservice geeft alle geldige kandidaten terug; Payroll kiest niet stilzwijgend de nieuwste rij.
2. Bewaar goedgekeurde tijdsegmenten als expliciete, versieerbare bronregels gekoppeld aan de bestaande Actual Work-entry. Het contract moet start/einde, effectieve lokale datum en tijdzone, goedgekeurde betaalde duur, bronreferentie/versie en goedkeuringsstatus/-event bevatten. Correcties moeten herleidbaar blijven. Een Payroll-readprojectie filtert tenant, HR-groep, administratie, medewerker, dienstverband en periode, en bindt elke gebruikte segment-/revisieversie aan de snapshot-hash.
3. Segmentatie naar dag-, nacht-, zondag- en overwerkcomponenten moet uit de bevestigde tijdzone en toepasselijke geversioneerde regelset volgen. Overlappende segmenten worden eerst als tijd-unie gesneden; de bestaande premieformule mag niet op basis van twee geaggregeerde totalen aannemen dat uren samenvallen. Onbekende pauze-/tijdzone-/bronsemantiek blijft `SOURCE_GAP`.

Een migration, write-service, permissie of audit-event is in deze opdracht niet toegevoegd, omdat de gebruiker migraties en gedeelde TEST-writes expliciet uitsloot en de bronhoudersemantiek ontbreekt.

## Testmatrix

| Geval | Resultaat |
| --- | --- |
| Geldige versiegebonden Retail-context met juli-einddatum | PASS in synthetische contracttest; `31-07` dekt juli. Dit is geen Core/TEST-bronreadback. |
| Ontbrekende Retail-classificatie bij nachturen | PASS: `SOURCE_GAP`, bestaande standaardservice-contracttest. |
| Onbekende classificatie, datum buiten periode en einddatum vóór periode-einde | PASS: fail-closed contracttests. |
| Verkeerde administratiecontext | PASS: provider weigert met 403. Bestaande tests blijven vreemde tenant en werknemer weigeren. |
| Goedkeurde Retail-premieuren zonder intervalbron | PASS: standaard preflight geeft `ACTUAL_WORK_INTERVAL_SOURCE_UNAVAILABLE`; geen lifecycle-opslag geopend. |
| Werkelijke overlappende versus niet-overlappende tijdintervallen | **OPEN / niet testbaar tegen productbron**: er is geen intervalcontract of intervalreadroute. De bestaande synthetische engine-oracle test alleen categorie-totalen en rekent €15,44 premie / €1.621,23 bruto; dit bewijst geen werkelijke overlap. |
| Dubbele premie | Synthetische R2-regressie blijft PASS voor de bestaande best-of-formule. Voor bronuren blijft de provider fail-closed totdat intervallen aantoonbaar zijn. |

Gerichte regressies: **81/81 PASS, 6 bestanden** (`core-source-bridge`, `cao-payroll-integration`, `liquid-hr-source-provider`, `payd2-retail-source-case`, `employee-payroll-calculation-service`, Retail Mode rules). R1 bruto **€4.767,20** en synthetisch R2 bruto **€1.621,23** blijven bevestigd. Dit is geen echte salarisverwerking of bewijs van wettelijke toepasbaarheid.

- TypeScript: `npm run type-check` — PASS, alle workspaces.
- ESLint op vijf gewijzigde TypeScript-bestanden — PASS, nul errors; één bestaande warning `PayrollSetupRepository` unused in `liquid-hr-source-provider.ts`.
- Volledige root `npm run build`, Node `24.22.1`, npm `10.9.2` — PASS; HR Suite `339/339`, Control `12/12`, Payroll client-boundary scan en PDF function-trace-gate PASS.
- `git diff --check` — PASS.
- Buildgenereerde Focus-resource exact teruggezet naar de vooraf vastgelegde SHA-256; `next-env.d.ts` bleef gelijk aan de vooraf vastgelegde SHA-256.

## Gate

**W04 PARTIAL; reguliere Retail/R2: HOLD.** De lokale contractvalidatie en fail-closed intervalguard zijn gerealiseerd. Echte Core-Retail-context, interval- en overlapreadroute, ambigue-bronnegatieven en bronhouderbevestigingen blijven OPEN. Er is geen wettelijke Payroll-conformiteit vastgesteld.
