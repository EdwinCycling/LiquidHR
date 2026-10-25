# PAY-W02-W03-W04-INTEGRATION-01 — lokale integratie

Datum: 25-10-2026
Branch: `integration/PAY-W02-W03-W04-20261025`
Geïntegreerde code-HEAD: `3013b6d11a58dc4de03f296cbf71f4cee736d3b6`
Lokale werkboom: `PAY-W02-W03-W04-INTEGRATION-20261025`

## Provenance en actuele basis

De opgegeven baseline was `630df89c84bc2be4774072d387ecb5dc7df10f91`. W02 en W03 stonden exact op de verwachte remote heads; W04 stond exact op de verwachte lokale head. De oorspronkelijke worktrees en branches zijn niet gewijzigd.

| Bron | Geïntegreerde head | Herkomst |
| --- | --- | --- |
| W02 | `5e0697fb5bc74d40e16aaec5e8fb309233218772` | [Draft PR #48](https://github.com/EdwinCycling/LiquidHR/pull/48) |
| W03 | `a7a71c56b3bd5c80ee08d970e1a5668d7bd3fcaf` | [Draft PR #49](https://github.com/EdwinCycling/LiquidHR/pull/49) |
| W04 | `2e4b78a8ee58f580f2c03c09813c66f14324af10` | lokale branch `work/pay-w04-source-readiness-01-20261024` |

Tijdens deze opdracht schoof live `origin/main` op van de verwachte `630df89` naar `5ec09687a8394955f0445f931a337be8e9984829`, vier commits verder. De nieuwe head is een descendant van de opgegeven baseline. De 61-bestandsdiff bestond uit bestaande auth-/directoryscope-, P9- en work-calendarwijzigingen; tegenover Payroll was alleen `AA-CURRENT.md` overlappend. `git merge-tree` voorspelde geen contentconflict. De actuele main is opgenomen en alle hieronder genoemde gates zijn opnieuw op de uiteindelijke code-HEAD uitgevoerd. De nieuwe main-commits zijn lokaal geïntegreerd; er is geen migratie uitgevoerd.

Mergecommits: W02 `d5fd3fde`, W03 `acdc2fe9`, W04 `955e330e`, actuele `origin/main` `3013b6d1`. De W02-, W03- en W04-broncommits blijven als ancestors aanwezig.

## Opgelost providerconflict

Het enige echte tekstconflict was `apps/hr-suite/lib/payroll/source/liquid-hr-source-provider.ts`. W02/W03 zijn eerst zonder conflict samengevoegd; W04 raakte vervolgens dezelfde employment-/timelineketen. Er is nergens een volledig `ours`- of `theirs`-bestand gekozen.

De gecombineerde reader doet het volgende:

1. Autoriseert tenant-, HR-groep-, administratie- en werknemersscope.
2. Selecteert binnen die scope uitsluitend één bevestigd, niet-verwijderd dienstverband dat de effectieve Payroll-periode overlapt; een ontbrekende of ambigue match wordt geweigerd.
3. Voert de begrensde W03 timelinebatch binnen die selectie uit.
4. Controleert de teruggelezen timeline, effectieve datums en Retail-businesscontext vóór Actual Work-batching.
5. Stuurt alleen gevalideerde, herleidbare records naar de bestaande bronprojectie en Payroll-calculator.
6. Behoudt `SOURCE_GAP` bij ontbrekende/tegenstrijdige Retail-classificatie of ontbrekende Retail-klokintervallen. Mislukte of onvolledige batches vallen terug op de bestaande begrensde reader.

De provider-, source-readiness- en core-bridge-regressies bewijzen scopeweigering vóór ongeautoriseerde batches, batch/single-reader-equivalentie en de Retail-intervalgap na batchreads.

## Behouden garanties per wave

### W02 — synthetische rekenoracle

De exacte urenverhouding blijft `24/38`; `0.6316` blijft alleen de vierdecimalige weergave. De onafhankelijke BigInt-oracle en pure Payroll-engine berekening geven basisloon €1.605,79, overlapveilige premie €15,44, bruto €1.621,23, werknemerspensioen €39,48, fiscaal loon €1.581,75, loonheffing €41,42, netto €1.540,33 en werkgeverskosten €2.146,81. R1 blijft bruto €4.767,20, werknemerspensioen €198,65, loonheffing €1.107,17, netto €3.461,38 en werkgeverskosten €6.545,86.

De W04-intervalregel verandert de geïntegreerde service-uitkomst bewust: de R2-fixture met goedgekeurde Retail-premieuren maar zonder klokintervallen bevat nu `ACTUAL_WORK_INTERVAL_SOURCE_UNAVAILABLE`. De normale Payroll-service retourneert daarom `SOURCE_GAP` en maakt geen R2-run of artefact. De volledige R2-bedragen worden afzonderlijk, expliciet synthetisch, door de pure engine-oracle gecontroleerd; die helper opent geen service-, database- of lifecyclepad. De standaard onvolledige R2-bron blijft geblokkeerd en synthetische oracleparameters worden niet automatisch ingevuld.

### W03 — begrensde reads en snapshots

De 39 canonieke PayrollSourceSnapshots, tenant-/administratiebatches voor tax/IKV en Actual Work, timelinebatching, version vectors, hashes, effectieve perioden, autorisatie en `SOURCE_GAP`-semantiek blijven behouden. De actuele gecombineerde suite vergelijkt batchresultaten met de single-reader, inclusief scope en hashes. De bestaande meting 355 → 152 timeline-/taxreads blijft een readreductie; zij bewijst geen stabiele latencywinst. W03 LOCAL blijft **PARTIAL**; HOSTED en issue #39 blijven **OPEN**.

### W04 — Retail-bronreadiness

Kalenderdatums, tenant-/administratiebinding, classificatie, bronversie en effectieve dekking worden gevalideerd. Vreemde werknemer-, tenant- en administratiescopes worden geweigerd. Ontbrekende/ambigue `IN_STORE`/`ECOMMERCE`-bron en ontbrekende klokintervallen blijven `SOURCE_GAP`, inclusief via de batchreader. Historie is immutable. Er is geen Retail-/Actual Work-migratie of remote write gedaan.

De gezaghebbende Core-contracten voor Retail-bedrijfsclassificatie en Actual Work-intervallen, tijdzones, pauzes en correcties ontbreken nog. W04 blijft **PARTIAL**; reguliere Retail/R2-verwerking blijft **HOLD**.

## Gecombineerde regressies en kwaliteitsgates

Alle tellingen hieronder zijn nieuwe runs op code-HEAD `3013b6d11a58dc4de03f296cbf71f4cee736d3b6`, onder Node `24.22.1` / npm `10.9.2`.

| Gate | Resultaat |
| --- | --- |
| Gecombineerde Payroll/W02/W03/W04-regressies | **14 bestanden, 148/148 tests PASS** |
| NL-2026-regelpakket | **6 bestanden, 49/49 tests PASS** |
| Root TypeScript | **PASS**, alle workspaces |
| Gerichte ESLint | **PASS**, 59 gewijzigde HR Suite-bronbestanden |
| i18n | **PASS**, 43 namespaces met gelijke NL/EN-sleutels |
| Volledige rootproductiebuild | **PASS**; HR Suite 343/343 routes, Control 12/12; buildprovenance noemt exact deze code-HEAD |
| Payroll client-boundary / negatieve controle | **PASS**, scan van 176 browserassets |
| Function traces / PDF runtime-assets | **PASS**, 613 App Router traces en vereiste renderer-assets aanwezig |
| `git diff --check` | **PASS** na documentatieconsolidatie |

De gecombineerde Payroll-run dekt R1, de R2 BigInt-oracle en standaard-R2 `SOURCE_GAP`; batch/single-reader, hash-/version-vector-herhaalbaarheid, onmogelijke datums, ongeldige bronversies, buitenlandse scope, Retail-classificatie/intervalnegatieven en lifecycle-/PDF-immutability. De PDF- en lifecycleproef gebruikt uitsluitend de geïsoleerde lokale PGlite-testfixture. Er is geen gedeelde TEST-run, review, finalisatie of PDF gewijzigd.

## Lokale browseracceptatie

**BLOCKED vóór serverstart en browserlogin.** `scripts/check-test-personas.ps1 -SkipBrowser` bevestigde de persona-catalogus en gesloten role-switchallowlist, maar de bestaande launcher-preflight meldde dat de canonieke lokale TEST-config ontbreekt. Metadata-only controle bevestigde dat zowel `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local` als `%LOCALAPPDATA%\LiquidHR\TestRuntime\payroll-test-personas.env` ontbreken. Geen alternatieve config, account, grant, sessie of TEST-data is gemaakt/gebruikt.

Daarom zijn `/payroll/runs`, bestaande FINALIZED-PDF via HR Admin/Employee, Manager-/Employee-negatieven en de gevraagde drie desktop- plus drie mobiele werkplekloads niet browsermatig uitgevoerd. Er zijn hiervoor geen actuele dataset-, scope-, periode-, hash- of individuele tijdmetingen. Historische W01/W03-browsermetingen blijven uitsluitend historisch bewijs; er wordt geen hosted-PASS afgeleid.

## Crosswalk uitvoeringswaves naar productroadmap

De bestaande [commercial roadmap](../../../AA/AA-PAYROLL-COMMERCIAL-ROADMAP-20261019.md) blijft leidend en is niet vervangen. De uitvoeringwaves zijn technische/acceptatieslices onder die fasen, geen nieuwe productroadmap:

| Uitvoeringswave | Bestaande roadmapfase | Relatie |
| --- | --- | --- |
| W00 | D0 | lokale auth/persona- en TEST-toegangsreadiness |
| W01 | D0 / D1 | bestaande Payroll-defect- en bronreadiness; open persona-/sourcegates blijven zichtbaar |
| W02 | D2 | Retail R2 deeltijd-, premie- en synthetische bruto-netto-oracle |
| W03 | D2 / F0 | Retail-bronreadoptimalisatie en integratievoorbereiding; lokale performance blijft PARTIAL |
| W04 | D2 / F0 | Retail-source-readiness en providerconflict in deze lokale integratie |
| W05–W17 | P1 / P2 / P3 | toekomstige uitvoeringssplits onder de bestaande core-, wettelijke cyclus- en pilotgates; de repository definieert deze wave-ID's nog niet afzonderlijk en deze opdracht kent er geen scope aan toe |

D0 en D1 houden hun bestaande PARTIAL/OPEN-gates; deze integratie promoveert ze niet. D2 blijft synthetisch PARTIAL. F0 is lokaal geïntegreerd voor W02–W04, klaar voor code-review/integratievoorbereiding maar niet voor main-merge of release. P1/P2/P3 zijn geen claims over geïmplementeerde features.

## Restgates en besluit

| Onderwerp | Status |
| --- | --- |
| W01 LOCAL | **PARTIAL** |
| W01 HOSTED | **OPEN** |
| W02 | **PASS — synthetisch, technisch; normale Retail R2-service blijft interval-/source-gap geblokkeerd** |
| W03 LOCAL | **PARTIAL** |
| W03 HOSTED / issue #39 | **OPEN** |
| W04 | **PARTIAL** |
| Reguliere Retail/R2 | **HOLD** totdat bronhouder en Core-contracten beide bronhiaten sluiten |
| Payroll-release / echte Payroll / wettelijke conformiteit | **HOLD / OPEN** |

| Besluit | Status | Grens |
| --- | --- | --- |
| Lokale code-review / integratievoorbereiding | **GO** | Integratiebranch bevat actuele main plus exacte W02/W03/W04-heads; gates hierboven geslaagd. |
| PR-publicatie | **HOLD** | Geen push/PR-publicatie binnen mandaat. |
| Merge naar main | **HOLD** | Alleen lokaal geïntegreerd; geen merge naar main geautoriseerd. |
| TEST-release / deployment | **HOLD** | Geen deployment geautoriseerd; lokale browserconfig en bronreadiness ontbreken. |

Geen remote migratie/databasewrite, Payroll-run, review, finalisatie, push of deployment uitgevoerd. De actieve codecommit is `3013b6d11a58dc4de03f296cbf71f4cee736d3b6`; deze rapport- en AA-documentatie worden als afzonderlijke lokale documentatiecommit vastgelegd.
