# AA-PAYROLL — LiquidHR Payroll Development Standard

> **PAY-W04-COMPLETE-PAYROLL-INTEGRATION-02 lokaal 26-10-2026 — PARTIAL; integratie en TEST-release HOLD:** Actual Work blijft de registratiebron. De W04-werkplek biedt CSV-preview/import, HR Admin-review, accordering en versiegebonden Payroll-vrijgave. TVT boekt naar het bestaande leave-ledger bij HR Admin-accordering, gebruikt uitsluitend expliciet ingestelde vervalmaanden en corrigeert het saldo idempotent via de append-only ledger. De periode-ID-contractuitbreiding controleert de open periode in de bestaande Payroll-kalender; de bronprovider leest vrijgegeven registraties via die exacte ID, datumgrenzen en periodiciteit en bindt de identiteit aan de bronhash. Een synthetische vierwekenperiode over de jaargrens verschijnt nu in de Payroll-bronprojectie zonder de oude `ACTUAL_WORK_FOUR_WEEKLY_PAYROLL_CONSUMER_UNAVAILABLE`-bronfout. De definitieve berekening blijft fail-closed met `FOUR_WEEKLY_PAYROLL_CALCULATION_NOT_VALIDATED`, want de bestaande run-/berekenings-/fiscale contracten zijn maandelijks. Gewone variabele uren gebruiken alleen de bestaande `PAYFULL02_VARIABLE_REGULAR_WAGE`; uitbetaalde meer-/overuren en toeslagen (zoals nachturen) blijven `SOURCE_GAP` zonder passend bestaand componentinputcontract. Geen vaste fiscale of pensioenmapping, kloktijden of automatische classificatie. Lokale migratie/RLS/browserruntime en live TEST-readback zijn niet uitgevoerd; zie [W04-acceptatierapport](../quality/acceptance/runs/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026.md).

> **PAY-W04-HR-HOURS-TO-PAYROLL-01 initiële acceptatie 26-10-2026 — historische tussenstand, opgevolgd door FUNCTIONAL-CLOSEOUT-02 — implementatie PARTIAL, integratie/TEST-release HOLD:** Actual Work blijft de registratiebron; deze branch voegt CSV-import, HR Admin-review/accordering, immutable release-fingerprints en een Payroll-sourceproviderpoort toe. Iedere wijziging aan een bestaande registratie vereist server-side een reden; een deferred databaseconstraint koppelt de wijziging aan een append-only correctierevisie met dezelfde actor, timestamp, periode en uren. De Payroll-vrijgave is nu op kalendermaand begrensd; een expliciete toewijzing van vierwekenregistraties aan de bedoelde salarisrun ontbreekt. De cataloguskoppeling `work_hour_types → leave_type_overtime_work_hours → leave_types(OVERTIME_HOURS)` bestaat, maar de bestaande verlofopbouwservice/RPC boekt geen OVERTIME_HOURS-uren naar `leave_balance_buckets`/`leave_accrual_transactions`. W04 houdt goedgekeurde TVT-uren daarom zichtbaar als `SOURCE_GAP`; er wordt geen loonbetaling of saldo geboekt en er wordt geen vervaldatum verzonnen. De huidige Payroll-composition accepteert voor deze bron alleen gewone uren via `PAYFULL02_VARIABLE_REGULAR_WAGE`; `PREMIUM` en betaalde `OVERTIME` worden fail-closed als `SOURCE_GAP` om verkeerde verwerking als regulier loon te voorkomen. De officiële TEST-preflight blokkeert op ontbrekende centrale runtimeconfiguratie en Payroll-personacredentials. De code gebruikt geen kloktijden of naam-/code-inferentie voor CAO-classificatie. Migratie is lokaal niet toegepast en browser-/RLS-runtimebewijs ontbreekt; zie [acceptatierapport](../quality/acceptance/runs/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026.md).


> **PAY-W02-W03-W04-INTEGRATION-01 / PR #50 — PARTIAL/HOLD, 25-10-2026:** `integration/PAY-W02-W03-W04-20261025` is bijgewerkt met actuele `origin/main` `d53580860d9f97ec6b9da32d9d36edb68805d8da`; de oorspronkelijke merge-base vóór deze main-integratie was `5ec09687a8394955f0445f931a337be8e9984829`; de actuele merge-base na integratie is `d53580860d9f97ec6b9da32d9d36edb68805d8da`. Main voegde geen Payroll-codewijzigingen toe t.o.v. de geteste Payroll-code-HEAD `3013b6d11a58dc4de03f296cbf71f4cee736d3b6`. De volledige merge-tree wees alleen `AA-CURRENT.md` en `AA-OPEN.md` aan; beide conflicten zijn inhoudelijk opgelost. Payroll 148/148 (14 bestanden), NL-2026 49/49 (6 bestanden), TypeScript, ESLint, i18n, rootbuild en lokale browseracceptatie PASS op de eerder geteste code-HEAD. W02 technisch PASS, synthetisch; W01 LOCAL PARTIAL; W03 LOCAL PARTIAL; W01/W03 HOSTED en issue #39 OPEN; W04 PARTIAL. Reguliere Retail/R2 en TEST-release HOLD. Draft PR #50 is bijgewerkt, niet gemerged. Zie [integratierapport](../quality/acceptance/runs/PAY-W02-W03-W04-INTEGRATION-20261025.md).

## Uitvoeringswaves gekoppeld aan de bestaande productroadmap

W00–W17 zijn uitvoerings-/acceptatieslices onder de bestaande fasering; zij vervangen de productroadmap niet. De repository specificeert W05–W17 nog niet als individuele Payroll-scopes.

| Uitvoeringswave | Roadmapfase | Koppeling |
| --- | --- | --- |
| W00 | D0 | Lokale auth-, persona- en TEST-toegangsreadiness. |
| W01 | D0 / D1 | Bestaande Payroll-defect- en bronreadiness; resterende persona-/sourcegates blijven OPEN. |
| W02 | D2 | Retail R2 deeltijd-, premie- en synthetische bruto-netto-oracle. |
| W03 | D2 / F0 | Retail-bronreadoptimalisatie en integratievoorbereiding; performance blijft PARTIAL. |
| W04 | D2 / F0 | HR Admin Actual Work-invoer, correctie, CSV-import, TVT-ledger en periodegebonden Payroll-vrijgave; exacte vierwekenbronprojectie is contractueel beschikbaar, maar fiscale perioderekenregels en componenten voor betaalde meer-/overuren en toeslagen blijven integratiegates. |
| W05–W17 | P1 / P2 / P3 | Toekomstige slices onder de bestaande core-, wettelijke cyclus- en pilotgates; individuele inhoud vereist een afzonderlijk vastgelegde scope. |

> **Laatste vastgelegde shared TEST-/runtimeopname — 24 oktober 2026 (historische snapshot, geen actuele lokale code-HEAD).** Edwin heeft één gedeelde synthetische LiquidHR TEST-app; Vercel gebruikt hiervoor technisch het target `production`, maar dit is geen commerciële payroll-GA. Op die datum stonden GitHub en de gerapporteerde lokale `main` op `1c4eb3d1bfe75d8145b87484125fcfcb6605aacf` (PR #45 productintegratie, PR #46 documentatie). Op 25-10-2026 bereikte `origin/main` de basis `5ec09687a8394955f0445f931a337be8e9984829`; de actuele `origin/main` is verdergegaan naar `d53580860d9f97ec6b9da32d9d36edb68805d8da` en is in de merge hierboven opgenomen. Appversie `1.20261023.1` was op 24-10-2026 daadwerkelijk uitgerold: Vercel deployment `dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K` READY, toen op dezelfde SHA en met alle drie bestaande aliassen; anonieme homepage-smoke HTTP 200. Vorige `dpl_CuyAgvBwHr5z9bXNv52Np7SaTxb9` was READY als rollback. Deze runtime/deploymentstatus is in deze integratietaak niet opnieuw gecontroleerd of gewijzigd.

> De volgende database-, technische-gate- en postreleasegegevens zijn onderdeel van die opname van 24-10-2026; de actuele lokale integratiestatus staat hierboven.

> **Database:** Supabase LiquidHR Core bevat **578 geregistreerde migraties**: PMUX-03A en alle acht daaropvolgende PMUX 03B/05/05C/06A/06B/06B.1/06C/07A eenmaal toegepast en read-only gecontroleerd. De vijf bestaande HR-groepen gebruiken `Europe/Amsterdam`. Payroll Lab blijft een afzonderlijke database met 17 migraties, zonder extra Payroll D2 SQL. Edwin heeft deze synthetische TEST-migraties uitdrukkelijk toegestaan **zonder voorafgaande backup**; dit is bewust aanvaard herstelrisico, niet een algemeen veiligheidsbeleid. De eerdere database-/release-HOLD is hiermee afgesloten voor deze versie.
>
> **Technische gate (stand van die runtimeopname):** finale HR Suite 3.652 PASS, 8 SKIP; TypeScript en beide productiebuilds PASS. Payroll D2 Retail R1 en PMUX 02–07A zijn geïntegreerd, ook onderdelen waarvan de volledige geauthenticeerde desktop-/390px-browseracceptatie nog OPEN is. W02b bewijst op een lokale featurebranch de synthetische R2 bruto-nettoketen; echte fiscale, pensioen-, werkgevers- en cumulatieve bronnen blijven SOURCE_GAP en reële salarisverwerking/commerciële payroll-GA blijft OPEN/HOLD. SLA's met `businessDays: true` bleven fail-closed; de bestaande Leave-recipe met twee werkdagen bleef ongewijzigd in afwachting van **PMUX-06A.1 canonieke werkkalender**. Dagelijkse cron: recruitment `0 3 * * *`, PMUX-reminders `0 6 * * *` UTC; `CRON_SECRET` stond als geheime Vercel Production-variabele. Maximaal vijf reminderjobs per run; echte cronafleverproef OPEN.
>
> **Postrelease:** CLEANUP-11 is door Edwin gestart en **loopt nog**; claim geen verwijdering van branches/PR's/worktrees zonder eindbewijs. Bescherm unieke ref/stashes, de dirty AI/MCP Focus-wijziging, historische acceptance evidence en de rollback-deployment. De aparte Payroll/Nmbrs-herstelwerkboom mist de historische 519-byte `.env.local` en blijft daarvoor een eigen herstelpunt. In *nieuwe* besluiten, opdrachten en statuskoppen: noem de opdrachtgever **Edwin** in plaats van ‘de eigenaar’. Historische originele rapportteksten blijven onveranderd.
>
> **Bronnen:** [PR #45](https://github.com/EdwinCycling/LiquidHR/pull/45), [PR #46](https://github.com/EdwinCycling/LiquidHR/pull/46), [03B-evidence](../quality/acceptance/runs/LIQUIDHR-RELEASE-03B-20261023.md); Vercel deployment `dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K` en de afzonderlijke Supabase-migratiereadback (24-10-2026).


> **Visie en fasering 19-10-2026:** [AA-PAYROLL-COMMERCIAL-ROADMAP-20261019](AA-PAYROLL-COMMERCIAL-ROADMAP-20261019.md) beschrijft de commerciële Payroll Core/Plus/Intelligence-positionering, wettelijke P1/P2 vrijgavecriteria en differentiatoren Flightdeck / Evidence Graph / Cao Autopilot / Time Machine / AI Copilot. Bestaande engine-, bron-, afrondings- en immutability-contracten in dit document blijven leidend. “Loonstrook demonstreren” is **niet** gelijk aan “commerciële live-loonadministratie gecertificeerd”.

> **Actueel uitvoeringsbesluit 18-10-2026:** gewone LiquidHR Payroll-UI is de enige klantgerichte invoer-, berekenings- en documentroute; de oude Payroll Lab-stappen hieronder zijn historische ontwikkelfasen, **niet** een nog gewenste parallelle klantarchitectuur. Voor volledige productstatus, Core-readback, bewezen Emma/Noah FINALIZED, bedrijfseigen pensioen, cao-bronvulling en vier acceptatiecases zie [AA-PAYROLL-CONVERGENCE-20261018](AA-PAYROLL-CONVERGENCE-20261018.md).
>
> **Postrelease 21-10-2026:** Payroll-code inclusief branch a9697537 is opgenomen in live productcode `1.20261021.1` / `c0fa2369` (Vercel READY). De gerichte Frits/Jupiter november-2026 run `d8508395-2e25-59be-bc0b-ff2f0b83f7dc` is een opgeslagen, gesimuleerde **CONCEPT** (bruto € 1.879,33, na pensioen en loonheffing € 1.710,84: **geen definitief nettoloon**, geen FINALIZED/PDF). **`/payroll/runs` hangt op een laadscherm**; dit is de eerste hosted Payroll-bugfix. De beschermde `work/payroll-p0-p1`-runtime mist na cleanup zijn originele unieke 519-byte `.env.local` en mag niet worden gebruikt vóór herstel uit originele secretopslag. Zie [postrelease status](../quality/acceptance/runs/LIQUIDHR-POSTRELEASE-STATUS-20261021.md).\n>\n> **PAYD1-K2-01 lokaal 22-10-2026 — BLOCKED:** de historische Frits/Jupiter CONCEPT-run blijft ongewijzigd; geen nieuwe berekening of CONCEPT gemaakt. De opgeslagen 24/36-urenbasis wijkt af van het actuele rooster 32 uur/week; een actuele salarisregel ontbreekt. Werkgeversconfiguratie v5 en openingscumulatief v311 zijn synthetisch, en de runtrace bindt geen exacte actuele Core-row-versies. Gerichte bron-/berekenings-/scopegates: 130 tests PASS; zij valideren geen nieuwe Frits-uitkomst. Zie [PAYD1-K2-01](../quality/acceptance/runs/PAYD1-K2-01-20261022-BLOCKED.md).
> **PAYD1-K2-03 lokaal 22-10-2026 — ONAFHANKELIJKE SYNTHETISCHE CONTROLE PASS:** de generieke opt-in PAYRUN01-componenten zijn onafhankelijk geverifieerd tegen de officiële cao-, PFZW-, PAWW- en Belastingdienst-bronnen. De vorige fixture-VCR-opening € 5,02 was onjuist voor cumulatief loon € 5.027,56; de geïsoleerde testinvoer is hersteld naar € 5,03. De bronberekende fixture geeft bruto € 2.513,78, netto € 2.188,61, werkgeverskosten € 3.520,32. Echte Frits-salarisregel/inschaling, Core-administratie-ID, werkgeversconfiguratie, wettelijke PFZW-koppeling en betaalde cumulatieven blijven OPEN. Geen nieuwe run/PDF of remote write. Zie [PAYD1-K2-03](../quality/acceptance/runs/PAYD1-K2-03-20261022.md); de oorspronkelijke pure fixture staat in [PAYD1-K2-02](../quality/acceptance/runs/PAYD1-K2-02-20261022.md).
> **PAYD1-K2-04 lokaal 22-10-2026 — BRONREADINESS IMPLEMENTATIE PASS; ECHTE FRITS-RUN OPEN:** de dienstverbandpagina toont voor november 2026 effectieve, versiegebonden bronstatussen en links naar bestaande HR Admin-invoer. Laatst bewezen Frits-Core heeft schaal 6/12-regel 24/36 effectief 2026-11-01 tegenover 32/36-rooster effectief 2026-09-01: bronconflict. De bestaande PFZW-toepasselijkheid/typed loonbasis blijft onbevestigd, werkgeversconfiguratie v5 heeft geen onafhankelijke werkgeversbeslissing en een geldig cumulatief per 2026-10-31 ontbreekt. Versies voor IKV en fiscaal profiel zijn nu afzonderlijke `payroll-source-contract-v1`-verwijzingen; hiaten blijven `SOURCE_GAP`. Alleen-lezen implementatie, 54 gerichte tests en typecheck/i18n PASS. Live readback/browser is geblokkeerd door ontbrekende centrale lokale TEST-config. Geen Core-write, run/PDF, migratie, grant of deployment. Zie [PAYD1-K2-04](../quality/acceptance/runs/PAYD1-K2-04-20261022.md).
> **PAYD1-K2-05 lokaal 22-10-2026 — BRONRECONCILIATIE PARTIAL:** geen bronmutaties of berekening. Een historische HR Admin-read vond Frits-salaris 24/36 effectief 2026-11-01; K2-02 registreerde rooster 32/36 vanaf 2026-09-01. K2-reports spreken elkaar tegen over actuele salary-row aanwezigheid; de eerdere 6/20/€3.425-waarden horen bij synthetische benchmarkdata. Zonder getekende arbeidsovereenkomst/wijziging kan niet worden gekozen tussen huidig contract, toekomstige wijziging of TEST-datafout. PFZW-planversies, employer v5, IKV-koppeling en cumulatieven blijven OPEN. De browserbrug gaf geen actuele readback; K2-04 had eerder de centrale TEST-config als ontbrekend gemeld. Geen SQL-bypass gebruikt. Zie [PAYD1-K2-05](../quality/acceptance/runs/PAYD1-K2-05-20261022.md).
>
> **PAYD1-K2-06 lokaal 22-10-2026 — COMPLETE SYNTHETISCHE TESTCASE PASS; FRITS/PRODUCTIE OPEN:** een in-memory set levert 17 `BOUND` refs over 16 bronsoorten aan `payroll-source-contract-v1`; de generieke engine reproduceert K2-03 bruto/netto/kosten (€2.513,78 / €2.188,61 / €3.520,32) met onafhankelijke oracle, bronversies en componenttrace. De bestaande renderer geeft lokale CONCEPT-PDF-bytes met niet-definitief-waarschuwing. Een generieke classificatiekoppeling voorkomt dat vaste bruto-aanvullingen ontbreken of dubbel in loonheffing-/werknemersverzekerings-/Zvw-bases komen. 72 gerichte HR Payroll-/provider-/scope-/repositorytests, 37 PFZW/NL-regeltests en beide workspacetypechecks PASS; exacte overige gates in [K2-06](../quality/acceptance/runs/PAYD1-K2-06-20261022.md). Geen databasewrite, opgeslagen run/PDF of FINALIZED-status. Synthetische fiscale, werkgever-, Whk-, PFZW-deelname-, premieallocatie- en cumulatievenkeuzes blijven niet-gevalideerd voor productie; echte Frits-bronnen blijven open uit K2-05. D0-live-persona en full-suite-timeouts blijven afzonderlijk OPEN.
> **PAY-W04-SOURCE-READINESS-01 lokaal 24-10-2026 — PARTIAL; echte bronnen OPEN:** op eigen branch vanaf geverifieerde `origin/main` is de effectieve datumvalidatie van het bestaande `payroll-source-contract-v1` aangescherpt; onmogelijke kalenderdatums leveren nu `SOURCE_GAP`. 49 gerichte readiness-, K2- en Retail R1/R2-tests, volledige workspace-TypeScript, lint op gewijzigde bestanden en root productiebouw PASS. Geen echte Core-read, payrollrun, wijziging aan R1/R2-rekenregels of remote write. De reguliere R2-bronnen voor salaris/uren, IKV/fiscaal, CAO-toepasselijkheid, pensioen, werkgever/Whk en cumulatieven zijn in deze wave niet live geverifieerd en blijven open; geen wettelijke of commerciële payrollvrijgave. Zie [PAY-W04-SOURCE-READINESS-01](../quality/acceptance/runs/PAY-W04-SOURCE-READINESS-20261024.md).
> **PAY-W04-LIVE-SOURCE-READBACK-02 lokaal 24-10-2026 — PARTIAL; echte R2-bronnen NOT VERIFIED / HOLD:** via de bestaande TEST-launcher en geautoriseerde Planeten/Jupiter HR Admin-context zijn `/payroll`, `/payroll/settings` en de bestaande Payroll Lab-R2-readroute read-only gecontroleerd. De opgeslagen R2-case is een synthetische juli-2026 bruto-only testcase (€1.621,23), zonder Core-medewerkerlink; inhoudingen/netto/pensioen/werkgeverskosten zijn niet berekend. De bestaande Jupiter werkgeversconfiguratie v5 en openingsbalans v311 zijn expliciet synthetic-only voor Frits en niet overdraagbaar naar R2. W02 Draft PR #48 blijft synthetisch testbewijs met `SOURCE_GAP` voor de incomplete standaardcase; geen echte werkgever-, IKV/fiscale, pensioen-, Whk- of cumulatieve bronset is aangetoond. Geen Payroll-write, run, review of finalisatie. W04 blijft **PARTIAL**; echte R2-verwerking **HOLD** en wettelijke toepasbaarheid OPEN. Zie [PAY-W04-LIVE-SOURCE-READBACK-02](../quality/acceptance/runs/PAY-W04-LIVE-SOURCE-READBACK-20261024.md).
> **PAY-W04-CORE-SOURCE-BRIDGE-03 lokaal 25-10-2026 — PARTIAL; reguliere R2 HOLD:** de standaard Payroll-service en sourceprovider gebruiken al de bestaande gescopeerde Core-readservices voor dienstverband, contract/salaris/uren, IKV/fiscaal, primaire arbeidsvoorwaardenset en pensioen, plus Payroll-owned werkgeversconfiguratie/openingscumulatieven en goedgekeurde Actual Work-dagentries. Zes nieuwe integratieproeven controleren die standaardassembly, read-only preflight, ontbrekende bronnen en tenant-/werknemerweigering. Nog OPEN: typed Core-bron voor Retail `IN_STORE`/`ECOMMERCE` en bronbewijs voor werkelijke R2-overlap/tijdvakken; zonder bedrijfsmodel blijft Retail-nachtwerk `SOURCE_GAP`. Geen productiecode, bronwaarde, gedeelde data of W02/Spoor A gewijzigd. Werkelijke R2-bronnen en wettelijke toepasselijkheid blijven NOT_VERIFIED. Zie [bronmatrix en gates](../quality/acceptance/runs/PAY-W04-CORE-SOURCE-BRIDGE-20261025.md).
> **PAY-W04-RETAIL-SOURCE-GAPS-04 lokaal 25-10-2026 — PARTIAL; reguliere Retail/R2 HOLD:** de lokale Retail-context valideert nu tenant/administratie, classificatie, versie en datumdekking. De normale Core-projectie levert nog geen officiële `IN_STORE`/`ECOMMERCE`-bron. Actual Work bevat alleen datum/uren en geen intervallen; Payroll geeft voor Retail-premieuren zonder intervalbewijs `SOURCE_GAP`. Werkelijke overlap, ambigue classificatie en bronhouderbevestiging blijven OPEN en vereisen expliciete schema/readservice-contracten; er is geen migratie gemaakt. Gerichte regressies 81/81, TypeScript en volledige rootbuild PASS. Codecommit `fee80170326ceaf8b22fb07abf1c4d42e7c831ce`; geen TEST-write, payrollrun, push, merge, deployment, W02- of SpoorA-wijziging. Zie [matrix, ontwerp en gates](../quality/acceptance/runs/PAY-W04-RETAIL-SOURCE-GAPS-20261025.md).
>
> **PAY-INTEGRATE-01 lokaal 22-10-2026 — GO WITH CONDITIONS, geen release:** Payroll `86386eed` is al ancestor van D1 `0c16aab2`; de featurecommits zijn niet dubbel overgenomen. De integratiebranch bevat één bewezen JSX/try-catch-lintfix (`0d21f028`). Gerichte Payroll/API/D0/K2/autorisatietests, NL-regelpakket, typechecks, ESLint (0 errors/8 waarschuwingen), i18n en productiebuild PASS. Full Suite: 3.466 PASS, 8 SKIP, 12 time-outs; browser/live RLS en een actuele Mars-artifactreadback ontbreken. PMUX blijft apart en buiten de branch. Zie [PAY-INTEGRATE-01](../quality/acceptance/runs/PAY-INTEGRATE-01-20261022.md).
>
> **Historische integratiecontext:**  De onderstaande open punten over officiële cao-/pensioenbrondata, effectieve toewijzingen en volledige K2/R1/R2-runs blijven gelden totdat afzonderlijk bewezen. Bescherm historische FINALIZED-runs, PDF-hashes en audits. **Voor klantgericht product nooit LAB-, fixture- of synthetische provenance-labels tonen.**
>
> **PAY-POSTMERGE-R2-FACTOR-01 lokaal 24-10-2026 — R2-DEELTIJDRECONCILIATIE PASS; BUILD OPEN DOOR BASELINEBLOCKER:** code-SHA `cee92fa5efaa801e8ce94f42d2c2e78a2c276857` op feature HEAD `c8c066b2e1e9cecccb5b6870b528798b9ea132f5`. R2-salaris gebruikt exacte uren en factor `0.6316` is apart gevalideerd als afgeronde weergave van `24/38`. R2-oracle behoudt €1.605,79 basis, €15,44 éénmalige overlapveilige premie en €1.621,23 bruto; R1-output blijft €4.767,20 / €3.461,38 / €6.545,86. 87 gerichte tests en TypeScript PASS. Next 16.4.2 faalt identiek op ongewijzigde `origin/main` 630df89 en feature tijdens prerender van `/_global-error` in `OuterLayoutRouter.useContext`; Node 24.22.1 reproduceert de baselinefout. Geen Payroll-regressie aangetoond en geen Payroll-code gewijzigd. Fiscale, pensioen-, werkgevers- en cumulatieve bronhiaten blokkeren een echte R2-run/netto. Geen gedeelde write, migratie, finalisatie, PDF-wijziging of release. Zie [acceptatierapport](../quality/acceptance/runs/PAY-POSTMERGE-R2-FACTOR-01-20261024.md).

> **PAY-W02B-R2-NET-ORACLE-01 standalone branch-evidence (24-10-2026):** die wave vergeleek de normale Payroll-calculatieservice met een onafhankelijke BigInt-cent-oracle: bruto €1.621,23, werknemerspensioen €39,48, fiscaal loon €1.581,75, loonheffing €41,42, netto €1.540,33 en werkgeverskosten €2.146,81. De geïntegreerde W04-code houdt de normale service voor deze dagentries geblokkeerd op ontbrekende klokintervallen; de actuele pure-engine-synthetische oracle zonder run/lifecycle en alle gecombineerde gates staan in het [integratierapport](../quality/acceptance/runs/PAY-W02-W03-W04-INTEGRATION-20261025.md). De oorspronkelijke branchacceptatie blijft historisch behouden in [W02b](../quality/acceptance/runs/PAY-W02B-R2-NET-ORACLE-01-20261024.md).
>
> **PAYDOC-D0 lokaal / CLOSEOUT 21-10-2026 — PARTIAL, productcode-SHA 568ffc38b4abec9366c52a4e88791c979674eb88:** de bestaande Mars DEMO-002 2026-10 FINALIZED-artifact behoudt de eerdere HR Admin/Employee-bytepariteit (513.406 bytes; SHA-256 51b8c513b4c6f9b0c5a9e74e36086099d493ec08b9228b997779ae6cee56d977); geen berekening, review, finalisatie of PDF-creatie uitgevoerd. Tenantcontext bevestigt één actieve tenantgebonden TENANT_ADMIN-scope binnen De Sterren holding (3 HR-groepen, 5 administraties, nul andere-tenant-grants); het oude Mars-only-testcontract is vervallen. Employee mobiel 390×1079 PASS, inclusief inline viewer, download en terugnavigatie. Gerichte negative tests PASS, maar live Manager/Lisa/foreign-tenant-probes en full suite blijven OPEN. Negen brongecorreleerde timeoutkandidaten slaagden 9/9 geïsoleerd onder 5s; de exacte historische negen IDs ontbreken. Zie D0-acceptatie.

Status: **LEIDEND — Payroll-code geïntegreerd op `main`; wettelijke/commerciële productacceptatie blijft gedeeltelijk OPEN**
Eerste opzet: 2026-09-30

## CAO-BENCH02 Phase 1 execution boundary — 2026-10-03

Voor de kandidaatbranch `work/cao-bench02-20261003` geldt de actuele scope van [CAO-BENCH02 acceptance](../payroll/acceptance/CAO-BENCH02-20261003.md): uitsluitend synthetische arrangementconfiguratie en versiecompositie in de aparte Payroll Lab-database. Dit geeft geen autorisatie voor Core-reads/writes, CONTROL02, echte salarisruns, version bump, merge, push of deployment.

Hoofdstuk 13 hieronder blijft de gezaghebbende vaststelling van de oorspronkelijke QA-groep: Planeten → Jupiter BV → Directie. De groep is niet gebruikt als Payroll Phase 1-fixture en geen van de hier beschreven bronrecords is gewijzigd. §13 vervangt oudere, onjuiste Test Operations-selecties.

Dit document legt de structurele product-, architectuur- en ontwikkelafspraken voor LiquidHR Payroll vast. Detailrequirements, fiscale bronbestanden en gedateerde acceptance evidence blijven elders staan.

Voor alle Payroll- en pensioenflows geldt daarnaast de leidende [regel voor productwerking per omgeving](../architecture/PRODUCT_ENVIRONMENT_PARITY.md). Productbediening en presentatie zijn niet TEST-specifiek; interne dataherkomst, wettelijke onderbouwing en externe-actiesafety blijven afzonderlijk aantoonbaar.

## 1. Productgrens

Payroll is onderdeel van dezelfde LiquidHR-app en dezelfde repository.

- Gebruikers werken in de bestaande `apps/hr-suite`.
- Payroll heeft **precies één** sidebar-ingang: `Payroll Lab`.
- `/payroll-lab` is de centrale overzichtspagina met bestaande LiquidHR-dashboardvensters/tegels, géén uitklapbare Payroll-submenu's.
- PAYLAB04 maakt de tegels `Berekeningen` en `Salariscomponenten` functioneel; toekomstige functies zoals `Cao's en regelingen`, `Controles` en `Historie` worden later als venster toegevoegd wanneer ze echt werken.
- Payroll gebruikt dezelfde app-shell, styles, tokens, componenten, responsive patterns, i18n en authorization-aware UI-patronen als de rest van LiquidHR.
- Er komt geen afzonderlijk Payroll design system of losse gebruikersapp voor deze productlijn.
- Core-pensioeninrichting en toepasselijke werknemerskoppeling volgen de normale beheerflow; requirements staan in [PAYPENS01](../requirements/payroll/PAYPENS01-CORE-PENSION-PRODUCT-DESIGN.md).
- TEST beperkt geen reguliere Payroll- of pensioenfunctionaliteit. Klantinrichting, berekenen, controleren, herberekenen, finaliseren en documentproductie volgen dezelfde productservices en normale rechten in iedere omgeving; externe acties worden op omgevings-/distributieniveau geblokkeerd waar nodig.

Technische isolatie blijft wel expliciet:

- `packages/payroll-engine` bevat de pure calculation engine;
- LiquidHR Core blijft bron voor HR-data;
- Payroll gebruikt een aparte Supabase-database voor payroll snapshots, runs, resultaten, trace en controls;
- integratie verloopt server-side via application/service/repository boundaries;
- geen browser → Payroll Supabase;
- geen cross-database foreign keys of SQL-joins;
- Payroll bewaart Core-identiteiten als opaque source references.

Een aparte worktree, zoals `LiquidHR-Payroll`, is alleen een ontwikkelwerkplek voor dezelfde repository en geen aparte productapp.

## 2. Payroll Component Graph Engine

De technische kern is een generieke **Payroll Component Graph Engine**.

Een Payroll Component heeft minimaal:

- stabiele componentcode;
- ownership/type;
- versie;
- `effectiveFrom` / `effectiveTo`;
- processing scope;
- typed inputs;
- typed outputs;
- dependencies;
- calculation method;
- rounding;
- trace/provenance.

De engine bepaalt de uitvoervolgorde uit dependencies en rekent deterministisch.

Verspreide hardcoded payrollberekeningen zijn niet het primaire architectuurmodel wanneer dezelfde logica als component kan worden gemodelleerd.

De engine zelf bevat zo min mogelijk Nederlandse payrollkennis. Nederlandse payrollkennis zit in versioned componentdefinitions, parameters, tabellen en rule packages.

## 3. Calculation methods en expression engine

Minimaal ondersteunde calculation methods:

- `PassThrough`;
- `Expression`;
- `Aggregate`;
- later `Lookup/Table`.

`Expression` gebruikt een beperkte, veilige expression engine. Geen vrije JavaScript- of andere willekeurige code-uitvoering.

Minimaal toegestaan:

- `+`, `-`, `*`, `/`;
- `=`, `!=`, `>`, `>=`, `<`, `<=`;
- `AND`, `OR`, `NOT`;
- `IF(condition, then, else)`;
- `MIN`, `MAX`, `ROUND`, `ABS`;
- vaste waarden;
- percentages;
- typed component-inputs;
- outputs van andere componenten;
- parameters.

Niet toegestaan:

- loops;
- vrije `eval`/code-execution;
- databasecalls vanuit formules;
- externe API-calls vanuit formules;
- impliciete toegang tot data buiten gedeclareerde inputs.

Typed payrollwaarden onderscheiden minimaal geld, percentage, number/quantity, uren, dagen, datum en boolean waar relevant.

## 4. Component ownership

Er zijn drie componentsoorten.

### SYSTEM

- eigendom van LiquidHR;
- klant kan deze niet in-place wijzigen;
- immutable/versioned;
- effective-dated;
- historische versies worden nooit overschreven;
- nieuwe LiquidHR-versies mogen naast oude versies bestaan.

### CUSTOMER_FORK

Ontstaat wanneer een klant een SYSTEM-component kopieert.

Bewaar minimaal provenance:

- origin component id/code;
- origin component version;
- fork timestamp.

Na de fork is de component volledig detached:

- geen automatische synchronisatie;
- geen inheritance;
- geen merge met latere SYSTEM-versies;
- toekomstig onderhoud is verantwoordelijkheid van de klant.

Een latere LiquidHR-versie van het broncomponent wijzigt de fork nooit automatisch.

### CUSTOMER_CUSTOM

- volledig door klant gemaakt;
- geen system origin vereist;
- gebruikt hetzelfde veilige runtime-contract als SYSTEM en CUSTOMER_FORK.

Een customer component mag nooit een SYSTEM-component in-place wijzigen of dezelfde systeemidentiteit overnemen.

## 5. Fiscale verantwoordelijkheid

De klant mag eigen berekeningslogica configureren binnen het veilige componentcontract, maar fiscale/system-owned classificaties en officiële Nederlandse rule packages worden niet stilzwijgend door customer logic overschreven.

Wanneer een klant een system component forkt, is die fork niet langer de door LiquidHR onderhouden officiële systeemvariant.

Officiële NL-regels worden versioned en effective-dated gepubliceerd en getest tegen bronjaar/tijdvak.

Een unsupported of nog niet bewezen scenario wordt expliciet `UNSUPPORTED` of `SOURCE_GAP`; nooit ongeveer goed gerekend.

## 6. Source snapshots en inputsets

LiquidHR Core blijft actuele HR-bronwaarheid.

Payroll rekent op immutable canonical source snapshots.

Onderscheid:

- `PayrollSourceSnapshot`: canonieke bronwaarheid voor scope/periode + source version vector/hash;
- `CalculationInputSet`: snapshot reference + periode + rule package composition + engine version + input hash;
- `CalculationRun`: uitvoeringsinstantie die naar het inputset verwijst.

Dezelfde source snapshot mag later opnieuw worden berekend met een andere engine- of ruleversie zonder de bronhistorie te herschrijven.

Employment en IncomeRelationship/IKV zijn niet automatisch hetzelfde begrip. Nog niet geaccepteerde Core-contracten worden niet geraden.

## 7. Persistence en reproduceerbaarheid

Payroll Lab persistente artefacten omvatten minimaal:

- source snapshots;
- calculation input sets;
- calculation runs;
- component results;
- calculation trace;
- payroll controls.

Run lifecycle volgt de expliciete statusovergangen van Payroll Lab.

Definitieve historische inputs/resultaten worden niet stilzwijgend overschreven.

Voor dezelfde fixture + engine/rule/inputversie moeten minimaal stabiel zijn:

- source hash;
- input hash;
- componentresultaten;
- result hash.

Een nieuwe run mag een nieuwe run-id/timestamp hebben.

## 8. Productwerking en development mode

De productworkflow is gelijk in TEST en Production. De huidige technische/legal-readinessstatus wordt apart beoordeeld en mag niet worden verward met een TEST-only productvariant. Voor intern ontwikkelen en accepteren:

- is gecontroleerde synthetische testdata toegestaan; de data staat via de normale productservices in de normale administratiecontext;
- blijven fixture- en provisioningsflows afgeschermde interne hulpmiddelen en geen vereiste klantstap;
- zichtbare verticale slices krijgen voorrang boven langdurige tussenarchitectuur zonder payrollresultaat;
- niet-kritieke issues mogen als `KNOWN ISSUE / LATER CHECK` worden geregistreerd;
- werkcyclus: implementeren → targeted test → onafhankelijke review waar nuttig → fix → retest → verder;
- subagents mogen bij grotere runs expliciet worden ingezet voor parallelle implementatie, onafhankelijke review, security/scope, database/migrations, UI-consistentie en payrollregelcontrole;
- wanneer subagents worden ingezet en modelkeuze beschikbaar is, gebruiken zij altijd **LUNA MAX**; geen automatische of lagere alternatieve subagentconfiguratie;
- als LUNA MAX niet beschikbaar/selecteerbaar is, niet stilzwijgend substitueren maar aan de orchestrator melden;
- de hoofdagent blijft orchestrator en integreert de resultaten.

Hard stop alleen bij onder meer:

- vereiste Core-schemawijziging buiten expliciete scope;
- vereiste CONTROL02-contractwijziging buiten expliciete scope;
- mogelijke cross-tenant/cross-administration exposure;
- secret exposure;
- destructieve dataactie of datacorruptierisico;
- grote moeilijk terug te draaien architectuurafwijking.

Kleine forward-only migrations mogen alleen autonoom naar de expliciet bedoelde Payroll Lab-projectomgeving wanneer de run dat toestaat; nooit stilzwijgend naar Core.

## 9. Testbeleid

Volg `AA-TEST.md`.

Tijdens normale Payroll-featureontwikkeling:

- targeted engine/component tests;
- Golden Cases;
- relevante scope/security negatives;
- persistence/readback bij databaseflows;
- lifecycle/immutability/repeatability;
- typecheck;
- changed-area lint;
- i18n wanneer UI wijzigt;
- production build wanneer runtime/UI wijzigt;
- client secret-boundary scan wanneer de Payroll boundary wordt geraakt.

Geen volledige ~2.000-test suite als ritueel.

Een full suite hoort bij convergence/release of aantoonbare brede shared-core blast radius.

Browseracceptatie gebruikt bestaande testidentities en normale bestaande authflows. Geen extra rol, gebruiker of bypass creëren om een test groen te krijgen.

## 10. UI

Payroll moet eruitzien en werken als LiquidHR.

Gebruik bestaande:

- app-shell;
- sidebar/navigation;
- page headers;
- typography;
- spacing;
- cards;
- buttons;
- forms;
- tables;
- statuscomponenten;
- loading/error/empty states;
- responsive patterns;
- i18n;
- permission patterns.

Payroll-specifieke UI-componenten zijn toegestaan wanneer ze echte domeinweergave bieden, maar bouwen op bestaande LiquidHR-primitives.

Definitieve navigatie vanaf PAYLAB04:

```text
Sidebar:
  Payroll Lab

/payroll-lab (centrale overzichtspagina met bestaande dashboardtegels)
  ├── Berekeningen      → bestaande berekeningsfunctionaliteit
  └── Salariscomponenten → componentenbibliotheek

Later als werkende overzichtstegels:
  Cao's en regelingen
  Controles en historie
```

**Geen afzonderlijke Payroll-submenu's in de sidebar.** Onderliggende routes mogen bestaan achter de overzichtstegels; voeg een terugnavigatie naar Payroll Lab toe en behoud bestaande berekeningsflows en backward compatibility waar nodig. Toon geen niet-functionele navigatie-acties. Dezelfde server-side autorisatie- en NL/EN-i18n-patronen gelden voor overzicht en bestemmingen.

Gebruik in normale schermen en klantdocumenten geen TEST-, fixture-, demo- of synthetische labels enkel vanwege de omgeving. Een conceptstatus blijft wel zichtbaar wanneer de document- of runstatus daadwerkelijk CONCEPT is. Interne provenance wordt auditbaar opgeslagen, niet in de klantpresentatie.

## 11. Bewezen M0-baseline

PAYLAB02 M0 heeft op 2026-09-30 lokaal/authenticated bewezen:

- bestaande HR Admin Test Auth → Payroll → Payroll Lab;
- echte engine execution;
- run `SUCCEEDED`;
- 9 componentresultaten;
- trace;
- 7 passing controls;
- netto € 3.175,00 voor GC-NL-001;
- totale werkgeverskosten € 4.910,00;
- herhaalrun met identieke source/input/result hashes;
- ownership/provenance voor SYSTEM, CUSTOMER_FORK en CUSTOMER_CUSTOM;
- bounded typed expression engine;
- separate Payroll Lab persistence;
- geen Core-write of permissionwijziging;
- UI hergebruikt bestaande LiquidHR-shell/styles/componenten.

Deze baseline bewijst **synthetic M0**, niet fiscale NL-2026-correctheid en niet de nog open live Core employment/IKV-sourceketen.

## 12. Ontwikkelvolgorde

Voorkeursroute:

1. isolation/boundary;
2. source adapter;
3. component engine M0;
4. zichtbare synthetische payrollberekening;
5. echte Nederlandse 2026 fiscale regels;
6. verdere payrollcomponenten, grondslagen en wettelijke packages;
7. Continuous Payroll / Payroll by Exception;
8. aangifte-, payment-, accounting- en overige adapters.

Na M0 is PAYLAB03 lokaal geaccepteerd voor uitsluitend de eerste NL-2026 WHITE/NL/STD/onder-AOW reguliere maandcase, met versioned SYSTEM statutory rules, oracle, rounding trace en persistent browserbewijs. Verdere fiscale scope blijft afzonderlijk te plannen.

## 13. Future engine invariants — iteraties, IKV's en gedeelde grondslagen

Deze capabilities hoeven niet in iedere vroege payrollslice volledig te worden gebouwd, maar de architectuur mag ze niet blokkeren.

### Circulaire / iteratieve berekeningen

Niet iedere componentgrafiek blijft altijd een DAG.

De engine moet later expliciete iteratieve/convergence-clusters kunnen ondersteunen:

- detecteer strongly-connected component clusters;
- alleen expliciet als iterative/convergence gemarkeerde clusters zijn geldig;
- iteration policy is versioned;
- policy kan minimaal tolerance, maximum iterations, eventueel minimum iterations en de relevante convergence outputs bevatten;
- trace legt iteraties en de uiteindelijke convergence/non-convergence uit;
- non-convergence wordt een gecontroleerde calculation failure/control result;
- de engine rondt iteratieve tussenwaarden niet impliciet op 2 decimalen af om convergence te forceren.

Vroege acyclische slices hoeven deze capability niet volledig te implementeren, maar hardcode nergens de aanname dat iedere toekomstige graph DAG-only is.

### Employment versus IncomeRelationship / IKV

Employment en IncomeRelationship/IKV zijn verschillende domeinconcepten.

Nooit aannemen:

```text
employmentId == incomeRelationshipId
```

Toekomstig canoniek model:

```text
Employee
→ 1..* Employment
→ per Employment 0..* IncomeRelationship
```

Een Employment kan meerdere opeenvolgende of gelijktijdige IKV's hebben.

De definitieve Core IncomeRelationship/IKV-entiteit wordt niet geïmproviseerd zolang het Core/CONTROL02-contract niet expliciet is vastgesteld. Payroll bewaart in de tussentijd een opaque `source_income_relationship_id` in canonical snapshots.

### Gedeelde assessment bases

Een grondslag hoort niet automatisch bij één IKV.

De engine moet later componentnodes kunnen uitvoeren op scopes zoals:

- `IncomeRelationship`;
- `Employment`;
- `AssessmentBaseGroup`;
- `EmployeeEmployer`;
- `EmployeeLegalEntity`;
- `EmployeePensionScheme`;
- `Employee`;
- `PayrollRun`.

Een `AssessmentBaseGroup` bepaalt voor één specifieke grondslag welke IKV's gezamenlijk worden behandeld. Verschillende grondslagen mogen verschillende group membership hebben.

Conceptuele flow:

```text
IKV A local nodes ──→ contribution ──┐
                                     │
                                 Base Group
                                     │
IKV B local nodes ──→ contribution ──┘
                                     ↓
                       maximum/franchise/cumulative
                                     ↓
                                 allocation
                              ↙             ↘
                         IKV A             IKV B
```

Een wijziging aan één IKV kan daardoor resultaten op andere IKV's binnen dezelfde geraakte grondslaggroep beïnvloeden.

Data ownership blijft:

**LiquidHR Core**
- Employee;
- Employment;
- later canonical IncomeRelationship/IKV identity + versions.

**Payroll**
- opaque source references;
- immutable snapshots;
- IncomeRelationshipCalculation;
- assessment-base definitions/groups;
- contributions;
- allocations;
- cumulatives;
- calculated results.

Geen cross-database foreign keys.

## 14. Rounding, precision en statutory calculation stages

Afronding is payroll business logic, geen formattering.

### 14.1 Hoofdregel

Gebruik geen generieke regel "alles onder water onbegrensd exact en alleen aan het einde naar 2 decimalen".

De juiste regel is:

> **Rond alleen wanneer de actieve payrollregel dat expliciet voorschrijft, precies op die rekenstap, met de voorgeschreven schaal en afrondingsmethode. Rond op alle andere stappen niet impliciet.**

Dit is essentieel omdat wettelijke rekenvoorschriften juist tussentijdse afrondingen kunnen voorschrijven.

### 14.2 Numerieke representatie

- Gebruik nooit binary floating point (`float`/`double`/JavaScript `number`) als financiële rekenrepresentatie voor payrollbedragen, percentages en factoren.
- Gebruik een exacte decimal/fixed-decimal representatie.
- Leg geen globale regel vast dat 4-6 decimalen altijd voldoende zijn. De engine moet voldoende schaal behouden om de actieve regel exact uit te voeren.
- Parameters bewaren hun officiële/publiceerde schaal en provenance.
- Ongeafronde tussenwaarden mogen een grotere technische schaal gebruiken dan de uiteindelijke output.
- De opslagrepresentatie mag geen precisie verliezen bij persistence, hashing of serialisatie.

### 14.3 Rounding policy is versioned data

Een financiële output of wettelijke tussenstap kan een expliciete `RoundingDefinition` hebben met minimaal:

- `stage`;
- `decimalPlaces` of target multiple;
- `mode`;
- `effectiveFrom/effectiveTo`;
- rule/package version;
- officiële bron/provenance waar wettelijk;
- traceability.

Ondersteun conceptueel afzonderlijke modes zoals:

- arithmetic / half-up wanneer de bron "rekenkundig" voorschrijft;
- floor / naar beneden;
- ceiling / naar boven;
- truncate-toward-zero alleen wanneer expliciet vereist;
- round-down-to-multiple, bijvoorbeeld een wettelijke tabelstap;
- no-rounding.

Verwar `floor` en `truncate toward zero` niet bij eventuele negatieve waarden.

### 14.4 Rounding stages

Rounding moet per stap kunnen worden vastgelegd, bijvoorbeeld:

- input normalization;
- statutory intermediate step;
- component output;
- assessment-base/group result;
- allocation/distribution;
- period total;
- annual/YTD total;
- payment;
- declaration projection.

Niet iedere component gebruikt al deze stages.

### 14.5 Officiële NL-2026 regels hebben voorrang op generieke conventies

Voor de Belastingdienst Rekenvoorschriften 2026 geldt bijvoorbeeld dat verschillende symbolen verschillende regels hebben. Voor de huidige standaardscope zijn onder meer relevant:

- jaarloon `L` wordt tot `Lmax` naar beneden op een veelvoud van `Lv` gebracht; boven `Lmax` wordt `L` volgens de voorschriften op 5 decimalen rekenkundig bepaald;
- `X1` bij `L ≤ Lmax` wordt naar beneden op hele euro's afgerond;
- bepaalde heffingskortingen zoals AHK worden bij afbouw naar boven op hele euro's afgerond;
- het tijdvakbedrag `x` van de in te houden LB/PH wordt rekenkundig op 2 decimalen afgerond;
- boven `Lmax` bestaan expliciete stappen op 2 en 5 decimalen;
- bij het zelf herleiden van standaardparameters gelden onder meer hele euro's in het voordeel van de werknemer, percentages op 3 decimalen en factoren op 5 decimalen, precies voor de scope waarin de officiële voorschriften dat bepalen.

Daarom is de uitspraak "de uiteindelijke loonheffing wordt per werknemer op hele euro's afgerond" **niet** als algemene regel toegestaan. Het jaarbedrag en het uiteindelijke tijdvakbedrag hebben verschillende afrondingsregels.

### 14.6 Trace en audit

Bewaar voor iedere relevante afgeronde stap waar praktisch:

- unrounded value;
- rounded value;
- rounding difference;
- rounding mode;
- scale/target multiple;
- rounding stage;
- rounding rule/package version;
- bronverwijzing bij wettelijke SYSTEM-rules.

Een wijziging in een rounding rule vereist een nieuwe rule/component/package version en regressietests.

### 14.7 Cumulatief rekenen

Cumulatief rekenen is geen universele anti-afrondingsregel die op iedere payrollcomponent moet worden toegepast.

Gebruik cumulatieve/YTD-methoden alleen wanneer de betreffende regeling, component of grondslag dat vereist, bijvoorbeeld bij wettelijke voortschrijdend-cumulatieve grondslagen of een expliciete reserverings-/balansregel.

De engine moet cumulatieve balances versioned, scoped en reproduceerbaar bewaren. Een generieke "reken vanaf januari en trek eerdere afgeronde betalingen af"-regel mag niet stilzwijgend op alle componenten worden toegepast.

### 14.8 Allocatie en restcenten

Wanneer een afgerond groepsbedrag over meerdere IKV's, componenten of betalingen wordt verdeeld:

- de som van allocaties moet exact aansluiten op het afgeronde groeps-/eindbedrag;
- eventuele restcenten worden deterministisch volgens een expliciete, versioned allocation policy verdeeld;
- nooit afhankelijk van databasevolgorde;
- trace legt vast waar het afrondingsverschil terechtkwam.

### 14.9 Convergence

Iteratieve berekeningen vergelijken ongeafronde of expliciet voor convergence genormaliseerde waarden op een versioned comparison precision/tolerance.

Rond iteratieve bedragen niet standaard op 2 decimalen voordat convergence wordt vastgesteld. Een wettelijke component mag wel expliciete afrondingsstappen binnen de iteratie bevatten wanneer de betreffende regel dat vereist.

## 15. PAYLAB03 — eerste fiscale referentiecase (lokaal geaccepteerd)

Volgens het lokale acceptance report van 2026-09-30 is CC-NL-2026-001 GREEN binnen WHITE/NL/STD, onder AOW, volledige reguliere maand, loonheffingskorting aan. Fiscaal loon € 4.000,00 → loonheffing € 818,67 → netto € 3.181,33. Er zijn 21 onafhankelijke rekengevallen, 10 officiële maandtabelankers, 2 geauthenticeerde persisted browserruns met identieke hashes en rounding trace. Code-SHA: `5d7e9fc5e19ff4582787b51e0104c885ac83370a` (lokaal; geen push/deploy).

Deze status wijzigt niets aan de toekomstige invarianten: geen automatische employment=IKV-aanname, geen impliciete twee-decimaalafronding, geen generieke YTD, geen veronderstelde DAG-only engine. Iteratieve clusters, shared bases en multi-IKV zijn nog niet uitgevoerd/accepted. Raadpleeg het lokale `docs/payroll/acceptance/PAYLAB03-NL2026-REGULAR-WAGE-20260930.md` voordat nieuwe scope wordt gepland.

## 17. Pro Forma / What-if — gereserveerde scenarioarchitectuur

De pro-formamodule wordt geen tweede engine of parallelle bronadministratie. Een scenario is een immutable canonical baseline + gestructureerde tijdelijke delta's + versiegebonden rule-/cao-/bedrijfspakketcompositie. Berekening loopt via dezelfde Payroll Component Graph Engine in een strict `SIMULATION` context, **zonder** echte HR/Payroll-writes, betaling, aangifte, journaalpost of wijziging van productiecumulatieven.

What-if-scenario's mogen een expliciet fictieve invoer gebruiken als normale simulatie-inhoud, maar vereisen geen synthetisch medewerkerstype of TEST-only route. Bestaande medewerkers zijn alleen via de normale server-side bron- en salarisrechten toegankelijk. Medewerkers zien alleen de eigen toegestane gegevens en houden hun simulaties privé totdat ze bewust delen. Bied alleen scenario's aan waarvoor de betrokken componenten, wettelijke regels en cao-behandeling daadwerkelijk getest en ondersteund zijn; geen onjuiste ziekengeld-, pensioen-, werkgeverskosten- of netto-uitkomst verzinnen.

Netto-naar-bruto is een **bounded inverse search over de bestaande forward engine**, geen eigen belastingformule. Definieer doelnetto, zoekvariabele, brutoband/salarisstap en overige bevroren arbeidsvoorwaarden expliciet. Houd rekening met discontinuïteiten, loonbelastingtabelstappen, afronding en mogelijk onbereikbare exacte nettodoelen; rapporteer controleerbaar doelbereik of dichtstbijzijnde uitkomst.

UX: zodra functioneel een `Pro Forma`-tegel op het enkele `Payroll Lab`-overzicht; toekomstig ESS onder `Mijn salaris → Wat als`. Geen extra Payroll-sidebaronderdelen. Detailconcept en fasering: [PROFORMA01-WHAT-IF-PRODUCT-ARCHITECTURE](../requirements/payroll/PROFORMA01-WHAT-IF-PRODUCT-ARCHITECTURE.md). Dit is gepland ontwerp, niet geïmplementeerd of geaccepteerd door PAYLAB03/04.

## 18. Payrolldocumenten: loonstrook, jaaropgaaf en gecontroleerde templates

Voorgesteld, **nog niet geïmplementeerd**: één documentpipeline over **immutable finalized payroll-/loonstaatprojecties**, géén tweede rekenengine. Documenttypes `PAYSLIP` en `ANNUAL_STATEMENT`; modes `LIQUIDHR_STANDARD`, `CUSTOMIZED_STANDARD`, later `CUSTOM_DESIGNER`.

Een LiquidHR Standard is door LiquidHR onderhouden, **niet** door de Belastingdienst gecertificeerd. Klanten mogen in de aangepaste standaard het logo, vooraf als optioneel geclassificeerde blokken en beperkte eigen velden instellen; wettelijke verplichte velden, bedragen en betekenis blijven beschermd. De optionele vrije designer bouwt op een typed read-only datafieldregister en een server-side wettelijke veldvalidator: eigen risico ontslaat klanten niet van wettelijke vereisten en is geen toestemming om wettelijk verplichte gegevens te verwijderen.

Jaaropgaaf gebruikt **loonstaat-/jaaraggregatie** en correcte werkgever-, dienstbetrekking- en IKV-groepering, niet simpelweg een optelsom van PDF-loonstroken. Digitale loonstroken vereisen instemming en duurzame inzage/bewaarbaarheid. ESS-toegang is strikt employee-scoped; BSN op jaaropgaaf wordt alleen in het afgeschermde document getoond. Eenmaal uitgegeven PDF's en hun template-/bronversies blijven auditeerbaar en worden bij correcties niet stilzwijgend overschreven.

Navigatie: pas zodra functioneel de tegel `Loonstroken & Jaaropgaven` onder het enkele `Payroll Lab`-overzicht; medewerker ziet PDF's onder eigen ESS-ingang. De toekomstige eenvoudige salaris-cockpit is een **apart uit te werken** productonderdeel. Geen extra Payroll-sidebar-item.

Dezelfde professionele PDF-inhoud, bedragen, werkgevergegevens en layout gelden lokaal, op TEST en in Production. Voeg geen TEST-/fixturewatermerk of disclaimer toe enkel op grond van de omgeving. Toon de echte documentstatus, bijvoorbeeld Concept, en behoud bronversies, hashes, controles, immutable historie en audittrail. Interne herkomst en beperkingen worden in gecontroleerde audit- en acceptatiedocumentatie vastgelegd. TEST houdt aangifte, SEPA, externe distributie en productie-integraties tegen in de omgeving-/distributielaag; een technisch TEST-document mag buiten de gecontroleerde omgeving niet als authentiek betaaldocument worden uitgegeven.

Details en gefaseerde acceptatie: [PAYDOC01-PAYSLIP-ANNUAL-STATEMENT-AND-DESIGNER](../requirements/payroll/PAYDOC01-PAYSLIP-ANNUAL-STATEMENT-AND-DESIGNER.md). Huidige PAYLAB03-jaar- en premiegegevens zijn onvoldoende voor een echte, wettelijk volledige jaaropgaaf; geen premature uitgifteclaim.

## 19. Salary/tax payments — separate payment orchestration (planned)

Geen eigen payroll-/belastinggeld door LiquidHR laten lopen. De engine maakt immutable gefinaliseerde resultaten; `PayableProjection` bepaalt het daadwerkelijk verschuldigde bedrag en is bewust onderscheiden van `NET_WAGE`. Een aparte, streng gescopeerde payment domain layer maakt `PaymentInstruction`, `PaymentOrder/Batch`, `PaymentAttempt/ExportArtifact`, status-/reconciliationevents, en later afzonderlijke `TaxPaymentObligation` en `RecoveryCase`. Renderer/bankexport rekent niet opnieuw.

Betalingsgoedkeuring staat los van HR-/payrollrollen en payrollfinalisatie. Batchinhoud/IBAN/bedrag/datum wordt bij goedkeuring vastgezet met immutable hash; inhoudelijke wijziging vereist nieuwe revisie en goedkeuring. Download betekent alleen EXPORTED, API-submission alleen submitted/accepted wanneer bevestigd; nooit SETTLED zonder betrouwbare reconciliatie/verklaring. UNKNOWN status is veilig af te handelen vóór fallback om dubbele salarisbetaling te voorkomen.

In TEST worden payment instructions en externe submission fail-closed geblokkeerd door environment-aware orchestration; de klantworkflow en documentpresentatie blijven hetzelfde. Maak geen klantgerichte TEST-labels om een uitgeschakelde externe actie te vervangen.

Eerste kanaal: versie-/bankprofielgebonden, volledig gevalideerde SEPA Credit Transfer XML-export. Later optionele bank-/PSP-adapter die een batch klaarzet voor bankautorisatie bij de klant. Behoud altijd gecontroleerde SEPA-fallback; directe koppeling introduceert geen eigen betaalinstellingsclaims. EU SCT rulebook en EPC customer-to-PSP IG op uitvoerdatum opnieuw verifiëren, inclusief name/IBAN-check (VOP) die door bank/PSP wordt uitgevoerd.

Loonheffingenbetaling komt uit het **eindbedrag van een werkelijk geaccepteerde aangifte**, heeft periodiek betalingskenmerk, deadline en actueel officieel rekeningprofiel; fiscale periodebetaling is onderscheiden van werknemerbetalingen. Geen negatieve SEPA-instructie voor een netto-terugvordering. Werknemerloonstrook gebruikt dezelfde pinned payableprojection, bankstatus verandert geen historische PDF.

Navigatie: `Betalingen` wordt pas bij werkende module een overzichtstegel onder het **enige** `Payroll Lab`-sidebaritem. Details/fasering: [PAYMENT01-SALARY-AND-TAX-PAYMENTS-ARCHITECTURE](../requirements/payroll/PAYMENT01-SALARY-AND-TAX-PAYMENTS-ARCHITECTURE.md). Dit is gepland, niet op basis van PAYLAB03 geaccepteerde betaalfunctionaliteit.

## 20. Benchmark minimaal twee cao's op bestaande gescopeerde testdata

De afgesproken cao-proef omvat **twee** echte publiek verkrijgbare sets: Kinderopvang 2025–2026 en Retail Non-Food 2026–2027 (**alleen** branchemodule Mode als eerste variant). Laat Codex de beide bronpakketten en componentconfiguraties zelfstandig samenstellen; Edwin voert geen salaristabellen/percentages handmatig in. Alle subagents gebruiken LUNA MAX als modelselector dat ondersteunt.

Op 2026-10-01 is read-only vastgesteld: Planeten → Test Operations → Jupiter BV beschikt over vier testprofielen met salaris, rooster, employment, IKV-link en Core-arbeidsvoorwaardenset; een toegewezen direct manager is gekoppeld aan een auth user. De daadwerkelijke payrollautorisatie van manager en PAYLAB01 live Core source proof zijn nog open. Gebruik uit deze profielen uitsluitend gescopeerd gelezen data om **synthetische en gepseudonimiseerde Payroll Lab-snapshots** te maken: K1/K2 op Kinderopvang, R1/R2 op Retail Mode. Alle afwijkingen van originele data worden expliciete synthetic scenario-overrides, geen wijzigingen van Core-verplichtingen.

Test beide packageversies per werknemer/contract, niet globaal voor de hele afdeling; breng officiële bronwijzigingen, schaal-/uren-/deeltijdberekening, toeslagoverlap en onderliggende NL-fiscale compatibiliteit aan het licht. Documenteer per cao welke bepaling daadwerkelijk SUPPORTED, PARTIAL of UNSUPPORTED is. Een interne benchmark is geen wettelijke validatie van beide cao's en geen productierelease.

Detail: [CAO-BENCH02](../payroll/research/CAO-BENCH02-TWO-CAO-TEST-EMPLOYEE-EXECUTION-PLAN.md). Uitvoering pas na PAYLAB04; geen aanpassingen aan bestaande Core-medewerkers of managerrechten in een benchmarkrun.

## 21. Administratie- en dienstverbandcao: salary models en selectieregels (ontwerp)

Er is **geen universele verplichte schaal-/tredestructuur**. Ondersteun discrete schaal + salarisnummer/ervaringsjaar, open schaalband met individueel overeengekomen loon, en vrij loon met toepasselijke wettelijke/cao-garanties. De twee eerste benchmark-cao's (Kinderopvang 2025–2026, Retail Non-Food 2026–2027 module Mode) gebruiken allebei tabellen met stappen, maar Retail vereist apart feitelijk loon vs garantieloon en overgangs-/beoordelingsregels; neem geen universele automatisering van periodieken aan.

Per juridische administratie stelt de HR Admin beschikbare, door LiquidHR gepubliceerde **primaire** cao-/bedrijfsarrangementen in. Per employment selecteert een bevoegd persoon daaruit precies één primaire regeling of expliciet een wettelijke/no-cao-basis als geen cao van toepassing is. Aanvullende fonds-/pensioenpakketten zijn afzonderlijke assignments met compatibility checks. Niet aan de hele afdeling of tenant forceren.

Een primaire cao-wisseling midden in hetzelfde employment is in V1 niet vrij uitvoerbaar: later expliciet wijzigings-/retroproces. Een nieuwe gepubliceerde versie van **dezelfde** cao is geen cao-wissel: versioned effective dates en gepinde historische snapshots blijven gelden. Schaal/trede hoort bij geversioneerde employment-salarissegmenten, niet bij Employee-masterdata.

Core heeft reeds `labor_condition_sets`, `employment_contracts.labor_condition_set_id` en salaris-/schaal-/IKV-entiteiten. Dat bewijst nog niet de geaccepteerde mapping naar Payroll ArrangementPackage, of berekening door de engine; ontwerp het service-/ownershipcontract zonder impliciete Core-schemawijziging.

Let bij testgebruik op persoonsidentiteit: de vier complete profielen uit Planeten/Test Operations/Jupiter zijn **niet bevestigd** als de elf Planeten-profielen met 'test' in de achternaam; een read-only naamcontrole vond 0 dergelijke namen in Test Operations. Codex moet eerst de door Edwin bedoelde profielen gescopeerd identificeren of de vier bestaande profielen uitsluitend als benoemde synthetische Lab-varianten gebruiken. Zie [CAO-BENCH02](../payroll/research/CAO-BENCH02-TWO-CAO-TEST-EMPLOYEE-EXECUTION-PLAN.md), paragrafen 8–9.

## 22. Testset met bedrijfseigen open-schaalbanden en compa-ratio

De twee cao-benchmarkpakketten (Kinderopvang en Retail Non-Food Mode) worden aangevuld met **één synthetische bedrijfseigen primaire regeling zonder treden**, uitsluitend met schaal, min/midpoint/max-band, vrij overeengekomen salaris en `compaRatio` als analytische waarde: `fullTimeEquivalentSalary / sameBasisReferenceMidpoint * 100`. Midpoint is beleidsmatig configureerbaar en hoeft niet het rekenkundig midden te zijn; expliciet versie-/geldigheidsdatums, grenzen en risicocontroles. Bij deeltijd nooit raw parttime salaris met fulltime midpoint vergelijken. De ratio is geen automatische payrollmutatie of fiscale grondslag.

Vanaf nu **minimaal zes** synthetic benchmarkpersona's: twee voor Kinderopvang, twee voor Retail Mode, twee voor open-bands bedrijfseigen. Codex maakt alle arrangementen/configuraties zelf; de vier eerder ontdekte complete Jupiter Test Operations-profielen blijven maximaal de reeds aangetoonde Core-bronset, aanvullende cases mogen volledig synthetic zijn. Geen Core-salaris/contract-/cao-/managerwrites in de benchmark. Voorlopig administratie→selecteerbare regelingen→één primaire regeling per employment; een actieve cao-wissel tijdens hetzelfde employment blijft een latere expliciete wijzigingsflow. Bewijsmatrix en details: [CAO-BENCH02](../payroll/research/CAO-BENCH02-TWO-CAO-TEST-EMPLOYEE-EXECUTION-PLAN.md) §10.

## 23. Reële open bands en gerichte testdatareset

Voor de 3-arrangementbenchmark wordt `LHR_DEMO_OPEN_BANDS_2026` gevuld met authentieke gepubliceerde **januari- en juli-2026 bruto-uurbanden A–J** uit [Staatscourant 2026 nr. 11183, cao Passagiers- en Bagageafhandeling Luchtvaart](https://zoek.officielebekendmakingen.nl/stcrt-2026-11183.html). Dit is een brongebonden **bedrijfseigen demonstratieregeling**, **geen** derde juridisch ondersteunde cao: midpoint en compa-ratio zijn uitdrukkelijk fictief LiquidHR-beleid, gebaseerd op de bronminima/maxima. Houd uurloon, fulltime equivalent, bandversies, policyrounding en bronprovenance gescheiden.

Edwin heeft gerichte herinrichting van bestaande **testloondata/-structuren** voor deze benchmark toegestaan. Eerst PAYLAB04 afronden, dan alle gekozen Core-salariskoppelingen/dependencies read-only inventariseren en een beperkte veilige back-up/rollback vastleggen. Hergebruik bestaande `salary_structures`/`salary_bands`/`salary_band_values`/`salary_structure_revisions` en contract-/salarisservices; voeg geen onnodig tweede schema toe. Alleen **geraakte geselecteerde testloon-/regeling-/assignmentrecords** mogen gericht worden gewijzigd om tot de schone benchmarkinrichting te komen. Andere Core-data, auth/roles, secrets en CONTROL02 blijven onaangeroerd. Exacte bronwaarden en acceptatiematrix staan in [CAO-BENCH02](../payroll/research/CAO-BENCH02-TWO-CAO-TEST-EMPLOYEE-EXECUTION-PLAN.md), §11.


## 24. Hoger Personeel en werknemers buiten cao — aparte toepasselijkheid

Naast de 2 officiële cao-benchmarks plus eigen bedrijfsregeling testen we expliciet de **toepasselijkheid/uitzondering** van een aparte Hoger Personeel-cao versus een CEO/direct beleidsbepaler buiten cao. Officiële Metalektro HP 2026 (Staatscourant 14650) gebruikt L–Q ISF-groepsgrenzen. Het gewijzigde werkingssfeerartikel van 16 juli 2026 (Staatscourant 22083) sluit bestuurders en directe beleidsbepalers expliciet uit; een CEO hoort dus niet **automatisch** in HP, en een hoog salaris maakt niemand vanzelf cao-vrij.

Binnen **dezelfde** `LHR_DEMO_OPEN_BANDS_2026` bedrijfseigen primaire regeling kan een afzonderlijk `DIRECTIE_INDIVIDUEEL` salary policy met `FREELY_NEGOTIATED` bestaan voor fictieve CEO C1, naast gewone OPEN_SALARY_BAND-medewerkers. Vrij loon betekent niet dat wettelijke/cao-verplichtingen vervallen; bepaal echte applicability uit werkgever/functie/overeenkomst/peildatum. Voor onze Jupiter-demo geen valse Metalektro-toepasselijkheid claimen.

Jupiter heeft in Directie/BOARD vijf organisatorisch gekoppelde actieve profielen maar geen als zodanig benoemde CEO in de geïnspecteerde functietitelkolom. Selecteer na inventarisatie één geschikte testmedewerker of een volledig synthetisch profiel en benoem die **uitsluitend binnen testcohort/benchmark-functie**, zonder auth-, formele KvK-/bestuurders- of DGA-writes. Een fictief HP-geschikt senior specialist H1 in aparte synthetische Metalektro-werkgever is voorlopig **eligibility-only**, géén derde uitgegeven/volledig doorgerekende cao.

Totaal: 3 primaire geconfigureerde arrangementen, 7 payrollscenario's (2 Kinderopvang, 2 Retail, 3 bedrijfseigen incl. CEO) en 1 optionele/referentie HP-toepasselijkheidstest. Zie [CAO-BENCH02 §12](../payroll/research/CAO-BENCH02-TWO-CAO-TEST-EMPLOYEE-EXECUTION-PLAN.md).

## 25. Geverifieerde oorspronkelijke Test-medewerkers voor benchmark (2026-10-02)

De bedoelde oorspronkelijke testgroep is nu read-only **met naam, afdeling, administratie en managerrelatie** geverifieerd: **Jan Test, Frank Test, Piet Test en Lisa Test** zijn onderdeel van **Planeten → Jupiter BV → Directie**. Jan/Frank/Piet rapporteren organisatorisch aan **Lisa Test** (Piet heeft daarnaast een tweede employment/organisatielink met manager Edwin Testbeheerder); Lisa rapporteert aan Edwin Testbeheerder en heeft een gekoppeld auth-useraccount. **Eric Oproeper** rapporteert ook aan Lisa, maar mist een aangetoond salarisrecord.

De eerste vier hebben allen salaris-, rooster- en IKV-records. **Jan** heeft een salaris- en roosterwisseling met grensdatum 2026-10-01: vóór volledige loonverwerking moet het tijdsintervalcontract worden getest. **Piet** heeft twee gelijktijdige bevestigde employments/IKV-links: kies in beperkte cao-benchmark één expliciet dienstverband en behandel multi-IKV apart. **Frank** eindigt volgens Core-dienstverband op 2026-10-01. Alle vier gebruiken momenteel de `MANUAL` salary route en `COMPANY` Core-arbeidsvoorwaardenset, niet reeds cao-schalen/-treden.

**Lisa's organisatorische rol/login is geen bewijs van salaris-/Payroll-managerautorisatie**; er is geen eigen `department_management`-record voor haar gevonden. Test permissies zoals werkelijk aanwezig. De vier eerst gevonden andere complete Test Operations/Jupiter-profielen waren **niet** deze Jan/Lisa-groep; baseer de bench op de originele groep met uitsluitend synthetisch/gepseudonimiseerd Lab-bewijs. Gerichte wijzigingen aan hun bekende testloon-/assignments zijn toegestaan na inventarisatie/back-up; geen auth-/security- of CONTROL02-automatisering. Details: [CAO-BENCH02 §13](../payroll/research/CAO-BENCH02-TWO-CAO-TEST-EMPLOYEE-EXECUTION-PLAN.md).
