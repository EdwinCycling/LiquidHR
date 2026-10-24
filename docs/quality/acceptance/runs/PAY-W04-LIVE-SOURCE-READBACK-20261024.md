# PAY-W04-LIVE-SOURCE-READBACK-02 — local TEST source readiness

**Datum:** 24-10-2026
**Verdict:** **PARTIAL voor W04; HOLD voor reguliere R2-bronreadiness en payroll.** Een bestaande, geautoriseerde lokale TEST-sessie kon de normale Payroll-readroutes en één al bestaande Retail R2-testcase lezen. De R2-case blijkt een synthetische Payroll Lab-case zonder koppeling naar een Core-medewerker of echte werkgever. Geen R2-gerelateerde echte bronset is hiermee geverifieerd.

## Scope en provenance

- Repository: `EdwinCycling/LiquidHR`
- Branch: `work/pay-w04-source-readiness-01-20261024`
- HEAD vóór deze documentatiewijziging: `f5dbb23af5d94f913e19fb0c3c0c814b2dae8e3e`
- Bij aanvang geverifieerde `origin/main`: `630df89c84bc2be4774072d387ecb5dc7df10f91`
- W02: Draft PR [#48](https://github.com/EdwinCycling/LiquidHR/pull/48), kandidaat `5e0697fb5bc74d40e16aaec5e8fb309233218772`. Alleen read-only geraadpleegd.
- Spoor A en de W02-branch/worktree zijn niet gewijzigd.

De bestaande `scripts/start-test-worktree.ps1 -Mode Development -PayrollAcceptance -Port 3111`-launcher slaagde voor de centrale TEST-config-preflight; waarden bleven verborgen. De app draaide alleen lokaal op loopback. Via de bestaande lokale HR Admin-aanmelding is de toegankelijke context `De Sterren holding · Planeten` gekozen; de Payroll-UI toonde Jupiter BV als actieve administratie. De normale, scope-beveiligde schermen zijn gebruikt:

1. `GET /payroll` — alleen opgeslagen Payroll-resultaten gelezen.
2. `GET /payroll/settings` — bestaande loonperioden, configuratieversies en openingsbalansen gelezen; geen formulierveld gewijzigd of opgeslagen.
3. `GET /payroll/runs/c1b92c72-210a-4c68-8e29-71b33e277bad` — deze R2-run is niet aanwezig als normale Payroll-run; de UI toont de 404-pagina.
4. `GET /payroll-lab/calculations?case=CAO-BENCH02-R2&run=c1b92c72-210a-4c68-8e29-71b33e277bad` — bestaande, opgeslagen synthetische R2-benchmark gelezen.

Geen BSN of ander direct gevoelig persoonsgegeven is geopend. De enige mutaties waren de geautoriseerde lokale TEST-aanmelding en normale afmelding; er zijn geen Payroll-/Core-bronmutaties, runs, reviews, finalisaties, migrations, grants of gedeelde databasewrites uitgevoerd. De sessie is via **Uitloggen** beëindigd en de lokale server is gestopt.

## Readinessmatrix

De status in de tweede kolom gaat over een **R2-gerelateerde echte bron**, niet over het bestaan van synthetische testwaarden. `NOT_VERIFIED` betekent dat de bestaande R2-case niet aan een echte Test Core-medewerker/dienstverband is gekoppeld; het is geen bewering dat er nergens in de tenant bronrecords bestaan. `NOT_APPLICABLE` is nergens gebruikt.

| Bron | Status echte R2-bron | Bestaande TEST-readback, bronhouder en route | Effectieve datum / versie | Bewijs en ontbrekende actie |
| --- | --- | --- | --- | --- |
| Werkgever en administratie | **NOT_VERIFIED** | Payroll Lab toont `PAYLAB GC-NL-001 — Jupiter BV` als synthetische administratie op de bestaande R2-case. Payroll-instellingen tonen voor de actieve Jupiter BV een aparte, Frits-gerelateerde werkgeverconfiguratie. | R2-case: juli 2026, arrangementselectie `2026.07`; Jupiter werkgeversconfiguratie v5, actief 2026-01-01 t/m 2026-12-31. | R2-case noemt uitdrukkelijk een synthetische administratie en synthetisch dienstverband. Er is geen R2-gekoppelde werkgeversregistratie, sectorbeslissing of bedrijfsactiviteit gelezen. Een bevoegde werkgever/administratiehouder moet de juiste juridische entiteit en scope bevestigen. |
| Medewerker en dienstverband | **NOT_VERIFIED** | Bestaande Payroll Lab-run `c1b92c72-210a-4c68-8e29-71b33e277bad`; server-scope via de geselecteerde Planeten/Jupiter-context. | Synthetische testcase `CAO-BENCH02-R2`, juli 2026; synthetisch dienstverband `CAO-BENCH02-RETAIL-MODE`. | UI labelt de werknemer als `R2 · Retail toeslaguren` en de administratie als synthetisch. Geen Core-employee-, employment- of IKV-link in dit bewijs. Een bestaande, expliciet aan R2 gekoppelde Test-medewerker moet door de bevoegde bronhouder worden aangewezen. |
| Contract, uren en salarisafspraak | **NOT_VERIFIED** | Payroll Lab R2-readback; normale Payroll-pagina bevat geen gekoppelde normale R2-run. | Synthetisch: 24/38 uur, functie-/salarisrij C/1, uurtarief €15,44, basis €1.605,79, premie €15,44. W02-oracle gebruikt daarnaast fulltime maandloon €2.542,50, factor `24/38` (weergave 0,6316) en bruto €1.621,23. | De oude testcase bevat scenario-invoer, geen live arbeidsovereenkomst of salarissegment. Geen echte contractnorm, ingangsdatum, uren, schaal/trede of salarisrecord is voor R2 bevestigd. Laat die via de bestaande Employment-readroute en bevoegde bronhouder verifiëren. |
| IKV, fiscale verklaring en loonheffingskorting | **NOT_VERIFIED**; **MISSING** in de oude bruto-only R2-run | Payroll Lab R2-scherm meldt inhoudingen, netto en werkgeverskosten expliciet als `NIET BEREKEND`. W02 PR #48 beschrijft alleen een synthetische tax profile/IKV voor de oracle. | W02-fixture: fictieve IKV/tax-profile v1, effectieve datum 2026-07-01; NL witte maandtabel `NL-2026-01`; fictief onder AOW en loonheffingskorting op één IKV. | Geen echte IKV-link, werknemersverklaring, leeftijds-/woonplaatsclassificatie of keuze loonheffingskorting is aan R2 gekoppeld. Bevoegde bronhouder moet fiscale verklaring en juiste IKV-status bevestigen. BSN is daarvoor niet in deze readback nodig of geopend. |
| CAO en toepasselijkheid | **NOT_VERIFIED** voor echte werkgever; **AVAILABLE** als synthetische regelinput | Bestaande R2 Lab-run en regelspoor noemen Retail Non-Food, module Mode; bronhouder is de gepinde CAO-regelset, niet de werkgeverbeslissing. | Arrangement `2026.07`, selectie vanaf 2026-07-01; pakket `CAO-RETAIL-NON-FOOD-2026` versie `2026.7`, officiële bronpin juli 2026, SHA-256 `ec6fd7a8ee7c3b1f18f58ac6cc5081d6a72e053405480e346eb8a4c7d1e1d2cc`. | De historische synthetische case selecteert rij C/1; dit bewijst geen Retail-activiteit, werkingssfeer of toepasselijkheid bij een echte R2-werkgever. Een bevoegde werkgever moet toepasselijkheid en effectieve schaal/trede bevestigen. |
| Pensioenplicht, regeling, deelname en premie | **NOT_VERIFIED**; **MISSING** in de oude bruto-only R2-run | Het historische R2-scherm berekent geen pensioen. In het W02-oraclebewijs staat uitsluitend een synthetische pensioenbronset. Jupiter-instellingen bevatten een andere, expliciet synthetische Frits/PFZW-keuze; die is niet aan R2 gekoppeld. | W02-fixture `BPF-DETAILHANDEL-2026-v1`: jaarfranchise €18.680, totale premie 24,75%, werknemersmaximum 6,1875%, werkgeversdeel rest, loonmaximum €79.409; synthetic mapping 2026. | Geen R2-deelname, verplichtstelling, grondslag, franchisekeuze of werknemers-/werkgeversverdeling uit een echte bron gelezen. Werkgever/fonds moet regeling, deelneming en geldigheid voor deze werkgever/werknemer bevestigen. |
| Werkgeversclassificatie, premies en Whk | **NOT_VERIFIED**; **MISSING** in de oude bruto-only R2-run | `/payroll/settings` toont voor Jupiter alleen actieve werkgeversconfiguratie v5 met bronreferentie `PAYROLL-FRITS-ACCEPTANCE-01`, expliciet synthetic-only. Geen van deze waarden is R2-bewijs. | Jupiter v5 geldig 2026-01-01 t/m 2026-12-31: synthetic AWf hoog 7,74%, Aof 6,27%, Wko 0,50%, Whk 1,52%, Zvw 6,10%; fictieve Whk-referentie. W02 R2-fixture gebruikt andere synthetic AWf 2,74% en Whk 1,93% (plus Aof 6,27%, Wko 0,50%, Zvw 6,10%). | De bestaande Jupiter-waarden verschillen van de W02-fixture en zijn expliciet geen echte beschikking/registratie. Geen echte sector-, AWf/Aof-, Wko-, Zvw- of Whk-beslissing voor R2 gelezen. Werkgever moet classificatie en beschikking uit geldige bron bevestigen. |
| Cumulatieven en openingsbalansen | **NOT_VERIFIED**; **MISSING** in de oude bruto-only R2-run | `/payroll/settings` toont geen R2-openingsbalans. De zichtbare versie 311 betreft Frits, 2026-09-01 t/m 2026-10-31, met expliciete notitie dat bedragen aannames uit immutabele tests zijn en geen betalingsbewijs. | W02-oracle legt voor de synthetische eerste periode nul-openingen vast vanaf 2026-07-01. Frits v311 opent 2026-11-01; niet overdraagbaar naar R2. | Geen R2-loonstaat-, loonheffing-, SV/Zvw-, pensioen/VCR- of reservecumulatief teruggelezen. Vorige perioden en betalings-/aangiftebewijs van de bevoegde loonbron zijn nodig; geen nullen of Frits-waarden overnemen. |
| Werkelijke uren en toeslaggebeurtenissen | **NOT_VERIFIED**; **AVAILABLE** als synthetische scenario-input | R2 Lab-trace toont 1 weekday-nightuur, 1 zondaguur, 2 overuren, e-commerce `false` en overlapscenario; geen Core/Actual Work-bronrecord. | Scenario `CAO-BENCH02-R2:v1`, pakketversie 2026.7, peildatum 2026-07-01. | De uren en overlap zijn expliciete testpremissen, geen ingelezen tijdregistratie. Bevoegde tijdbron/werkgever moet de werkelijk gewerkte en overlappende uren bevestigen. |

## W02-vergelijking en fail-closed

De lokaal opgeslagen historische Lab-run is de oude bruto-only testcase, geen run uit W02b. De pagina toonde bronmomentopname `b07d3af3-f544-4cce-9ae4-c0bfe064bdd3`, inputset `33c7b0ea-5c27-462c-9324-067d11e9911e`, pakket `RETAIL_NON_FOOD_MODE_2026_2027`, regel `retail-non-food.2026.gross-mode-r1-r2@2026.7`, en hashes voor bron, input en resultaat. De trace identificeert `CAO-BENCH02-R2` en `CAO-BENCH02-RETAIL-MODE` als fixture-/scenario-versies. Het bruto €1.621,23 is bevestigd als bestaand **synthetisch** testresultaat; inhoudingen, fiscaal loon, netto, pensioen en werkgeverskosten staan in deze oude run niet berekend.

Draft PR #48 bevat een afzonderlijke volledige, uitsluitend synthetische R2-oracle: werknemerspensioen €39,48, fiscaal loon €1.581,75, loonheffing €41,42, netto €1.540,33 en werkgeverskosten €2.146,81. De PR-beschrijving meldt dat de standaard onvolledige R2-bronset `SOURCE_GAP` blijft en verwijst naar negatieve regressietests. Dat is bewijs uit de W02 testkandidaat, geen live berekening of readback van volledige R2-bronnen. De W02-tests zijn in deze read-only wave niet opnieuw uitgevoerd.

**Conclusie:** de normale TEST-omgeving levert een opgeslagen synthetische R2-bruto-case en afzonderlijke synthetische Jupiter/Frits-configuratie. Er is geen R2-gekoppelde volledige bronset aangetroffen of bevestigd. Gebruik de synthetic oracle-waarden niet om echte R2-bronnen aan te vullen. De bestaande fail-closed `SOURCE_GAP`-bescherming blijft vereist; deze readback heeft haar niet omzeild of opnieuw berekend.

## Veilige voorbereiding, afzonderlijke autorisatie en gates

Veilig voor verdere voorbereiding via normale productroutes is uitsluitend het verzamelen en laten bevestigen van bronstukken en effectieve datums voor: dienstverband/contract/salaris/uren, IKV en werknemersverklaring, CAO-werkingssfeer, pensioenplicht en deelname, werkgeversclassificaties/Whk, werkelijke uren en cumulatieven. Gebruik daarvoor de bestaande Employment-, IKV/fiscaal-, pensioen-, Payroll-instellingen- en urenroutes binnen de juiste Tenant/HR-groep/administratie. Vul geen velden vanuit deze synthetische R2- of Frits-configuraties in.

Opslaan of activeren van salaris-/contractgegevens, IKV/fiscale verklaringen, CAO- of pensioenassignments, werkgeverspremies/Whk, werkelijke uren of openingsbalansen schrijft gedeelde Test-bronnen en vereist afzonderlijke autorisatie én bronhouderbewijs. Nieuwe testidentiteiten, grants, berekeningen, Payroll-runs en finalisaties zijn niet nodig voor deze readback.

| Gate | Status |
| --- | --- |
| Geautoriseerde lokale TEST-launcher en Payroll-readroutes | **PASS** — preflight, bestaande aanmelding, actieve Planeten/Jupiter-scope en read-only pagina's zichtbaar |
| Bestaande synthetische R2-data teruggelezen | **PASS** — bestaande CAO-BENCH02-R2 bruto-only testcase, geen nieuwe berekening |
| R2-gekoppelde Core/Payroll-bronnen volledig beschikbaar | **HOLD / NOT VERIFIED** |
| Volledige R2-bronset en wettelijke toepasselijkheid | **HOLD** — geen echte R2-medewerker-/werkgeverslink of bevoegde bronbesluiten vastgesteld |
| W02 standaard incomplete-source `SOURCE_GAP` | **PASS als PR #48 testbewijs; niet opnieuw uitgevoerd of live berekend** |
| Writes, migraties, nieuwe run/finalisatie, push/merge/deploy | **NONE** |

Geen aanvullende tests zijn uitgevoerd omdat geen productcode is gewijzigd. Gerichte `git diff --check` en branch-/HEAD-controle zijn uitgevoerd voor deze documentatiewijziging.
