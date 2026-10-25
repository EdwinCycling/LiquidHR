# PAY-W04-CORE-SOURCE-BRIDGE-03 — technische bronketen

Datum: 25-10-2026.

**W04: PARTIAL. Reguliere R2-salarisverwerking: HOLD.** De normale Payroll-service is al aangesloten op de bestaande Core HR-readservices. Voor medewerker, dienstverband, salaris/rooster, IKV/fiscaal, pensioen, werkgeversconfiguratie, openingscumulatieven en het bestaande goedgekeurde-urencontract is geen nieuwe productadapter nodig. Twee Retail-beperkingen blijven concreet OPEN: een Core-broncontract voor het bedrijfsmodel en bronbewijs van werkelijk overlappende/tijdvakgebonden toeslaguren. Deze invoer mag niet worden afgeleid uit de synthetische R2-case.

Er is geen productiecode gewijzigd. Zes nieuwe integratieproeven gebruiken de standaard providerassembly en de normale read-only Payroll-preflight, met uitsluitend lokale vervanging van de bestaande Core-readservice- en repositorygrenzen. De proeven sluiten een bewijsleemte tussen de bestaande providerfixtures en de normale serviceassembly.

## Provenance en afbakening

- Branch: `work/pay-w04-source-readiness-01-20261024`.
- Start-HEAD: `2d6fb631284414f6eeca149cad78bd6a4645131f`; schone werkboom bevestigd.
- Testcommit: `9500a7c05469788af80c150a760c064958b78214`.
- Actuele remote `main` read-only geverifieerd: `630df89c84bc2be4774072d387ecb5dc7df10f91`.
- W02 [Draft PR #48](https://github.com/EdwinCycling/LiquidHR/pull/48): open, niet gemerged; HEAD `5e0697fb5bc74d40e16aaec5e8fb309233218772`, basis dezelfde `630df89c`. Alleen PR-metadata, bestandslijst en commitobject-diff gelezen.
- Geen nieuwe Core/Payroll TEST-readback in deze engineeringtaak. De gegevensstatus verwijst naar de [readback van 24-10-2026](PAY-W04-LIVE-SOURCE-READBACK-20261024.md); actuele R2-bronwaarden zijn niet alsnog bevestigd.
- Geen shared TEST-write, schema/migratie, Auth-user/grant, echte berekening, nieuwe gedeelde run, review, finalisatie, wijziging aan FINALIZED-historie, push, merge of deployment. W02 en Spoor A zijn niet gewijzigd.

## Normale serviceketen

`createEmployeePayrollCalculationService()` gebruikt standaard `createLiquidHrPayrollSourceProvider()`. Zowel `inspectEmployeePayrollSource()` als de normale calculatie lezen via diezelfde provider; de inspectie maakt geen snapshot, inputset, run of lifecycle-event aan. De oudere PAYRUN01-service gebruikt eveneens deze providerfactory.

De standaard provider vraagt werknemergebonden permissions, haalt dienstverbanden op, controleert tenant/HR-groep/administratie/werknemer/dienstverband vóór de tijdlijnread en controleert de teruggeleverde tijdlijn nogmaals. Daarna bindt `payroll-source-contract-v1` effectieve bronrijen en bronversies aan de bronhash. De bestaande Core-services gebruiken de normale serverclient en hun scopefilters/RLS; er is geen nieuwe databaseclient of alternatieve autorisatieroute toegevoegd.

## Bronmatrix

`PASS` betekent dat de technische reader voor het vermelde bestaande contract aanwezig is en lokaal is onderzocht/getest. Het betekent geen wettelijke toepasselijkheid. `NOT_VERIFIED` betreft een aan de reguliere R2-case gekoppelde daadwerkelijke TEST-bron; de eerder gelezen synthetische Lab-case en Frits-records bewijzen die koppeling niet.

| Bron | Technische koppeling | Werkelijke TEST-data voor R2 | Ontbrekende actie |
| --- | --- | --- | --- |
| Medewerker/dienstverband | **PASS.** Provider → `listEmployeeEmployments()` → `getEmploymentPayrollSourceProjection()`. Core `employments`; werknemergebonden permissions en hercontrole van alle scopevelden. | **NOT_VERIFIED.** De bestaande R2-Lab-case heeft synthetische employee-/employmentreferenties. | Bevoegde Core-bronhouder wijst de bestaande juiste R2-medewerker, dienstverband en juridische administratie aan en bevestigt ingangsdatum/status. Geen account of grant nodig. |
| Contract/salaris | **PASS.** De Core-projectie levert `employment_contracts`, `employment_salaries`, `employment_schedules`, arbeidsvoorwaardenset en effectieve organisatie-/functiegegevens. Provider bewaart datums, rij-ID's en `updated_at` in contract/hash. | **NOT_VERIFIED.** 24/38 en €1.605,79 zijn voor R2 alleen synthetisch teruggelezen. | Via normale Employment-bronhouder contractnorm, uren, schaal/trede, salarisafspraak en effectieve segmenten bevestigen. Exacte R2-factorcorrectie blijft afhankelijk van PR #48. |
| IKV/fiscaliteit | **PASS.** `getEmploymentIncomeRelationshipProjection()` en `getEmploymentPayrollTaxSourceProjection()` leveren afzonderlijk gekoppelde IKV-/linkversies, effectieve tax profiles, leeftijdscategorie en kortingsclaims. Geen BSN in de Payroll-snapshot. | **NOT_VERIFIED.** Geen reguliere R2-IKV of werknemersverklaring bevestigd. | Bevoegde fiscale bronhouder bevestigt de juiste IKV, verklaring, woonland-/leeftijdscategorie en loonheffingskorting voor de periode; alleen aanwezigheid/status lezen waar voldoende. |
| CAO | **OPEN voor Retail-bedrijfsmodel; primaire koppeling PASS.** Core contract/arbeidsvoorwaardenset + salarisrij → `calculateCaoPayroll()`. De optionele `retailBusinessScope` wordt door de standaard Core-loader niet geleverd en bestaat niet in het huidige typed Core-projectiecontract. | **NOT_VERIFIED.** Gepinde Retail-regels en synthetische C/1-selectie bestaan; werkgeverstoepasselijkheid en `IN_STORE`/`ECOMMERCE` niet bevestigd. | Binnen W04 een bevoegd, effectief en geversioneerd werkgevers-/CAO-broncontract voor het bedrijfsmodel vastleggen en via de bestaande Core-projectie aan de provider koppelen. Huidige Core-services bieden hiervoor geen typed bron; geen waarde uit CAO-naam, sectorcode of fixture afleiden. Schema-/bronwrites vallen buiten deze taak. |
| Pensioen | **PASS voor bestaande ondersteunde pensioencontracten.** Core-projectie leest assignments, arbeidsvoorwaardensetmapping, effectieve arrangementversies en staffels; provider verwerkt deelname, salarisbasis, bronversies en provenance. | **NOT_VERIFIED.** W02 BPF-Detailhandel-deelname is synthetisch; bestaande Jupiter/Frits/PFZW-keuze is een andere case. | Werkgever/fonds bevestigt verplichtstelling, deelname, regeling, franchise, grondslag, premie(verdeling), effectieve versie en toepasselijke deelmaandmethode voor R2. |
| Werkgeverspremies | **PASS.** Provider → bestaande `PayrollSetupRepository`: actieve, gescopeerde Payroll-administratie en effectieve configuratieversies met configuratiehash. Deze bron is Payroll-owned, geen ontbrekende Core-reader. | **NOT_VERIFIED.** Jupiter v5 is expliciet synthetic-only voor Frits en wijkt af van de W02-R2-fixture. | Bevoegde werkgever bevestigt sector, AWf/Aof/Wko/Zvw-classificaties, Whk-beschikking en effectieve tarieven/reserveringen via normale Payroll-instellingen. Geen fictieve percentages overnemen. |
| Cumulatieven | **PASS voor bestaande openingssnapshotcontracten.** Dezelfde repository leest tenant-/administratie-/employment-gebonden `payroll_opening_cumulative_snapshots`, op datum/versie geselecteerd en gehashd. Geen automatische import van bewezen betaalhistorie geïntroduceerd. | **NOT_VERIFIED.** R2-nulopeningen zijn oraclepremissen; Frits v311 is expliciet synthetisch en niet R2. | Bevoegde loonbron levert gecontroleerde historische loon-/heffings-/SV-/Zvw-/pensioen-/reservebedragen met bronperiode en openingsdatum. Continuïteit en eventuele betaald-/aangiftehistorie afzonderlijk bevestigen. |
| Gewerkte uren | **PASS voor het bestaande goedgekeurde dag-/postingperiodecontract; OPEN voor R2-overlap/tijdvakken.** `getActualWorkPayrollProjection()` leest werknemer-/dienstverbandgebonden entries, perioden en uurtypen; pending betaalbare uren blijven geblokkeerd en goedkeuring wordt getraceerd. De CAO-interface ontvangt familie/type/uren/status, geen bewijs van exacte overlappende tijdvensters. | **NOT_VERIFIED.** De R2-premieoverlap en nacht-/zondag-/overuren zijn expliciete synthetische premissen. | Tijdbronhouder bevestigt goedgekeurde R2-events. Voor generieke echte overlap/e-commerce-nachtbanden is een expliciet broncontract met interval-/overlaprelatie en provenance nodig, aangesloten op de bestaande Actual Work-service. Geen overlap uit gelijke totaalaantallen afleiden. |

De laatste twee technische OPEN-punten zijn broncontractbeperkingen, geen ontbrekende aanroep naar een reeds beschikbare Core-reader. Daarom is geen fictieve adapter, nieuw schema of vrije-tekstinterpretatie toegevoegd. Ontbrekende bronnen blijven `SOURCE_GAP`; bestaande conflictcodes blijven blokkerend (`SOURCE_GAP` bij versieconflict, `UNSUPPORTED` bij onder meer overlappende salaristijdlijnen, 409 bij ambigue dienstverbandselectie). Er wordt geen kandidaat stilzwijgend gekozen om calculatie mogelijk te maken.

## Geïntegreerd bewijs

Nieuw: `apps/hr-suite/lib/payroll/core-source-bridge.integration.test.ts`:

1. Standaard provider leest via de bestaande Core-services, bindt salaris/uren aan bronversies en reproduceert de bronhash.
2. Normale read-only Payroll-preflight gebruikt dezelfde standaardbridge en weigert ontbrekende fiscale, pensioen- en werkgeversbronnen; lifecycleopslag wordt niet geopend.
3. Vreemde tenant wordt geweigerd vóór iedere werknemersbronread.
4. Dienstverband van een andere werknemer wordt geweigerd vóór de tijdlijnread.
5. Afwijkende werknemer in de teruggeleverde Core-tijdlijn wordt opnieuw geweigerd vóór Payroll-setupreads.
6. Retail-nachturen zonder Core-bedrijfsmodelbron leveren via de normale preflight `SOURCE_GAP` / `CAO_RETAIL_BUSINESS_SCOPE_UNVERIFIED`.

Deze tests vervangen de bestaande Core-readservices/repositories aan de buitenste grens door lokale testdata. Zij bewijzen de assembly, broncontracten en applicatiescope; zij zijn geen nieuwe live RLS- of wettelijke acceptatie. Bestaande provider-, fiscale-, Actual Work-, setup-, K2- en Retail-service/oracletests leveren de positieve complete en negatieve ontbrekende/conflicterende-bronnencontroles.

## W02-afhankelijkheid en R1/R2

PR #48 verandert de exacte deeltijdreconciliatie, de volledige synthetische R2-fixture/oracle en fiscale bronvalidatie. De standaard Core-readerassembly en het ontbrekende Retail-bedrijfsmodelcontract worden er niet door ingevuld. De nieuwe bridge-testfile overlapt geen W02-bestand.

De eerdere W04-datumvalidatie en W02 wijzigen wel beide provider/readinessbestanden; bij latere integratie moeten beide controles behouden blijven. `AA-PAYROLL.md` overlapt eveneens documentair. Er is geen integratie/merge uitgevoerd.

R1 blijft volledig synthetisch bevestigd: bruto €4.767,20, netto €3.461,38, werkgeverskosten €6.545,86. R2-bruto blijft €1.621,23. Op deze W04-basis blijft de bestaande R2-serviceproef terecht geblokkeerd door `SALARY_DOES_NOT_RECONCILE_TO_PART_TIME_FACTOR`; de correctie en volledige synthetische netto-oracle zitten alleen in de ongemergede W02-PR. De geslaagde regressie bewijst behoud van deze bestaande grens, geen nieuwe R2-nettovrijgave.

## Kwaliteitsgates

- Node `24.22.1`, npm `10.9.2`; repositorydependencies en lockfile ongewijzigd.
- HR Suite: **97/97 tests PASS in 12 bestanden**, inclusief de zes nieuwe standaardbridgeproeven, bronprovider/readiness, normale Payroll-service, Retail source/flow, K2, CAO-integratie, fiscale bronservice, Actual Work en werkgevers-/cumulatieconfiguratie.
- Retail R1/R2-regeltests: **6/6 PASS**; totaal **103/103 in 13 bestanden**.
- Root `npm run type-check`: **PASS** voor alle workspaces.
- ESLint op het nieuwe testbestand: **PASS, nul errors/warnings**.
- Volledige root `npm run build`: **PASS** — HR Suite en Control inclusief prerendering, Payroll-clientboundaryscanner en PDF/function-tracechecks. Buildprovenance vermeldt testcommit `9500a7c05469788af80c150a760c064958b78214`; de finale documentatiecommit verandert geen geteste code.
- `git diff --check`: **PASS**, inclusief de finale staged documentatiecontrole.

De eerste sandbox-testpoging strandde op Vite-temp-`EPERM` vóór testcollectie; de acceptatieset draaide vervolgens buiten die Windows-beperking op Node 24.22.1. Een eerste losse Retail-regeltest vond een ongerelateerde ancestor-`vite.config.ts`; met de expliciete bestaande repository-Vitestconfig slaagden de zes tests. Geen dependency/config is hiervoor aangepast. Een voorafgaande vijf-testproef op een andere cache-runtime is niet als finale gate gebruikt.

De rootbuild draaide op de bestaande lockfile/dependencies, met proceslokale `NODE_ENV=production`. Het gegenereerde Focus-widgetbestand is daarna exact hersteld naar zijn vooraf vastgelegde SHA-256; het is niet opgenomen. `next-env.d.ts` behield eveneens zijn oorspronkelijke hash. Geen Focus-/PMUX-code of runtimeconfiguratie gewijzigd.

**Advies: PARTIAL voor W04; HOLD voor reguliere R2-verwerking.** De technische readerketen voor bestaande ondersteunde gegevens is aangetoond. Werkelijke R2-bronhouders, wettelijke toepasselijkheid en de benoemde Retail-broncontracten blijven open binnen W04. Geen W05/W06 gestart.
