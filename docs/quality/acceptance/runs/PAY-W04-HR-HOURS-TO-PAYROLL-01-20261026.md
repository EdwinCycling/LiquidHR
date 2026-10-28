# PAY-W04-HR-HOURS-TO-PAYROLL-01 — lokaal acceptatierapport

## PAY-W04-PAYROLL-COMPONENT-FINAL-08 — actuele component- en runtimeacceptatie (2026-10-28)

**Uitkomst: PARTIAL; HR Admin-vrijgave inclusief revisiegebonden TWK-correctie live bewezen; Payroll-consumptie en negatieve persona-/RLS-runtimeproeven OPEN; integratie PR #51 HOLD en TEST-release HOLD.** Dit is de actuele stand. Eerdere blokken hieronder blijven historische snapshots.

### Migraties, bronregistratie en vrijgave

- Core TEST `wnpfloqpjvaacobppbpk` bevat de approval-migratie `20261027163113_actual_work_payroll_revision_approval` als databaseversie `20261028130821` en de PAYFULL02-mappingcompatibiliteitsmigratie als `20261028162054`. Alleen read-only migration-history-readback is uitgevoerd; geen migratie of repair is herhaald. De approval-schema-readback van deze migratie omvat tabel, RPC, releaseguard, audit-/immutability-triggers, RLS en grants.
- In de bestaande lokale HR Admin-sessie (Maya, Mars BV) is registratie `a742b81a-0f51-44cb-b47a-ed8b4b0104fd` voor de OPEN maandperiode 2026-10-01 t/m 2026-10-31 (`83ce4ce4-35cc-445f-8e7d-265099f12977`) vrijgegeven. Revisie 4, 1,7500 uur, kreeg de INITIAL-vrijgave `edf6b329-4d41-4bf8-932f-cb87e83bda2d`, fingerprint `61dcde9f4df05db671f7aec2cd1ea974d80e6460ae0d92ebf7b05ca5a7f43a20`.
- Na die vrijgave is via de normale urenroute een redenplichtige correctie vastgelegd als revisie 5 (uren bleven 1,7500; delta 0). HR Admin keurde revisie 5 opnieuw goed met fingerprint `1ebb9c2fdf967fdaf74d37171322815e11d3a90ab74312d65824bd06240dfb83`. De oude goedkeuring volstond niet. De supersederende vrijgave is `0f4d5efe-31ad-463d-ad06-72d0dbf0104f`, klasse `TWK_REQUIRED`, periode-ID ongewijzigd, supersedes de INITIAL-vrijgave, fingerprint `437ee18ede839c9523cace1d2faa5a8e328b68fdf1d5468cb55460080e9aed99`, timestamp `2026-10-28T17:02:09.45713Z`. De browser toont `Correctie na eerdere vrijgave · wacht op TWK-verwerking`.
- Dit bewijst de daadwerkelijke HR Admin-vrijgave en herbeoordeling. Het bewijst **geen** Payroll-sourceproviderconsumptie: er is na de vrijgaven geen Payroll-bronsnapshot opgeslagen en er is geen live herhaalde sourceprovider-opvraag uitgevoerd. Er is geen Payroll-run, FINALIZED-run of salarisstrook gewijzigd.

### Component, customer-versies en uurloonbron

- De codecatalogus bevat nu het bestaande PAYFULL02-systeemcomponent `PAYFULL02_VARIABLE_REGULAR_WAGE`, component-ID `system:payfull02:payfull02_variable_regular_wage`, versie `2026.1`, output `amount` (`MONEY`) uit de bestaande `CUSTOMER_STANDARD` PAYFULL02-regelpakketdefinitie. Dit is een systeemcomponent uit het Payroll-codecontract, geen Mars-customer-componentversie.
- Core bewaart voor `AW_WORK` mapping `ff08d3a7-3a76-4b6e-b231-5e5f19e46046`, versie 1, doel `PAYMENT`, factor 1, geldig vanaf 2026-10-01; de mapping verwijst naar de PAYFULL02-systeemcomponent. De code- en migratiecontracttests controleren de exacte componentversie `2026.1`.
- Read-only Payroll Lab-inspectie vond voor Mars drie customer-componentversies, alle `DRAFT`, geen PAYFULL02 regular-wage customer-versie en geen arrangementtoewijzing voor de eerdere testdienstbetrekking. Geen DRAFT-versie is geactiveerd. Deze customer-versies vervangen de aanwezige PAYFULL02-systeemdefinitie niet.
- De Payroll-sourceprovider vereist daarnaast één effectieve `HOURLY_VARIABLE`-loonbron met een expliciet `hourly_rate`; zonder die bron geeft de provider `ACTUAL_WORK_HOURLY_RATE_REQUIRED` en blijft de projectie `SOURCE_GAP`. De tien bestaande Mars-salarisregels voor de relevante datum zijn `PERIODIC_FIXED`; binnen Mars/tenant is geen effectieve variabele uurloonafspraak gevonden. De daarvoor gepubliceerde schalen zijn niet passend voor de synthetische oproepkracht en zijn niet gebruikt.
- Via de reguliere HR Admin-medewerkerwizard is synthetische werknemer `W04-TEST-20261028-01` / `7249fe3c-b4cc-4ef0-a467-8a6f12d06572` aangemaakt in Core TEST, zonder BSN, contactgegevens of Auth-link. Er is **geen dienstverband of salarisafspraak** aangemaakt. De record blijft als herkenbare synthetische TEST-persoonskaart bestaan. Er is geen bedrag, CAO-afspraak of vaste salarisregel verzonnen of gewijzigd. Een geldig uurlooncontract ontbreekt dus nog; de provider moet `SOURCE_GAP` blijven geven.

### Rechten, runtime en gerichte verificatie

- De bestaande `TestRuntime`-launcher meldt dat de centrale lokale TEST-configuratie ontbreekt; persona-preflight kon daardoor niet slagen. De reeds actieve geauthenticeerde HR Admin-browser bleef wel beschikbaar en is gebruikt voor de hierboven beschreven handelingen. Live Manager-, Employee-, vreemde-tenant- en Postgres-RLS-weigeringen zijn in deze run niet uitgevoerd. Contracttests blijven geen vervanging voor die runtimeproeven.
- PAYFULL02/W04-gerichte regressies: **118/118 PASS** in 8 testbestanden, inclusief UI-releaseherbeoordeling, urenmapping, PAYFULL02-catalogus, bronprovider, berekeningsservice en beide migratiecontracten. HR Suite TypeScript **PASS**, gewijzigde-bestanden-ESLint **PASS**, i18n **PASS** (43 gelijke NL/EN-namespaces). De eerste Vitest-run strandde vóór collectie op Windows-temp-`EPERM`; rechtstreekse Vitest met tijdelijke map in `node_modules/.cache/w04-test-tmp` slaagde. Geen volledige 3.810-suite of rootbuild herhaald; het eerdere groene resultaat blijft baselinebewijs, niet een nieuwe run.
- Payroll Lab-run-detailread was read-only; één bestaande rundetailroute gaf `GENERIC_PAYSLIP_ARTIFACT_BINDING_INVALID`. Er is geen poging gedaan die run of artifact aan te passen.
- **Integratie PR #51: HOLD** tot er een bevoegde geldige uurloonafspraak voor een synthetische Mars-oproepkracht bestaat, de echte sourceprovider de vrijgegeven revisie met mapping/fingerprint consumeert en de negatieve autorisatie/RLS-runtimeproeven slagen. **TEST-release: HOLD.** Vierwekenbrutonetberekening blijft `FOUR_WEEKLY_PAYROLL_CALCULATION_NOT_VALIDATED`.

## PAY-W04-UNBLOCK-07 — historische tussenstand vóór revision-releaseacceptatie (2026-10-28)

## PAY-W04-UNBLOCK-07 — 28-10-2026

**Uitkomst: PARTIAL; Core TEST-migratie en runtimeacceptatie HOLD; PR #51 blijft Draft.** Bestaande lokale branch-HEAD bij start van deze afsluiting: `340bfd54d16cdad52326c668540af6c224aa3fcd`; de remote branch stond op `ceeaa5897ed96337317da4fce6ea0db56f800c0a`. De bestaande Core TEST (`wnpfloqpjvaacobppbpk`) en Payroll Lab TEST (`jhgeriucbkfarxiudzfy`) zijn niet vervangen of geconsolideerd.

### Migratiecontrole en veilige vervolgstap

- De exacte bron `apps/hr-suite/supabase/migrations/20261027163113_actual_work_payroll_revision_approval.sql` is opnieuw gehasht: SHA-256 `400fff4c24e68fe6bf7c06190bf493428c4913d3087e543117c9de25563856bf`. De SQL is transactioneel begrensd met `BEGIN`/`COMMIT` en maakt een revisiegebonden approval-tabel, SHA-256-fingerprint/RPC/releaseguard, RLS/policy en audit-/immutable triggers aan. Tabelselectie vereist zowel `salary:read` op HR-groep als administratie; directe tabelrechten worden eerst ingetrokken en daarna uitsluitend `SELECT` aan `authenticated` verleend. De approval-RPC krijgt `EXECUTE` uitsluitend voor `authenticated` en controleert server-side `salary:write` plus `HR_ADMIN`/`TENANT_ADMIN`. Er is geen businessdata-DELETE/TRUNCATE of wijziging van bestaande bronregels. De enige `DROP` is `DROP TRIGGER IF EXISTS actual_work_payroll_release_requires_approval`; preflight bevestigde dat deze trigger nog niet bestond. Vereiste FK-tabellen, unieke revisiesleutel, permissie-/TVT-/auditfuncties en schemarechten bestaan; nieuwe approval-objecten en de migratiehistory-entry ontbraken vooraf.
- De eerder afgewezen officiële migratieaanvraag is niet herhaald. Eenmalig is een alternatieve transactionele schrijfpoging via `supabase_execute_sql` gedaan; ook die werd vóór uitvoering afgewezen met `Invalid or expired requestState`. De direct daaropvolgende read-only databasecontrole bevestigde: approval-tabel, RPC, releaseguardfunctie en release-trigger ontbreken; de migratierecord ontbreekt; Actual Work bleef op 22 entries, 34 revisies en 0 vrijgaven. Er is dus geen gedeeltelijke DDL-, businessdata- of migration-history-write vastgesteld. De Supabase CLI en `psql` zijn niet beschikbaar in deze lokale omgeving; de interactieve SQL Editor is niet gebruikt.
- **Gecontroleerde handmatige route indien een bevoegde beheerder de migratie uitvoert:** open in Supabase Dashboard uitsluitend project Core TEST met ref `wnpfloqpjvaacobppbpk`; open SQL Editor; voer de volledige, ongewijzigde SQL uit het hierboven genoemde migratiebestand in één keer uit, inclusief de bestaande transactieranden. Voer geen losse statements of history-insert uit. Lees daarna tabel, RPC, trigger, RLS/policy, grants, migratiehistory en de bestaande entry-/revision-/release-aantallen terug. Pas uitsluitend na geslaagde schema-readback de versie in de officiële Supabase migration history aan. Vanuit de repository moet de CLI hiervoor aan Core TEST zijn gekoppeld (`supabase link --project-ref wnpfloqpjvaacobppbpk`); voer daarna uit: `supabase migration repair 20261027163113 --status applied --project-ref wnpfloqpjvaacobppbpk`, en lees de history opnieuw terug. De officiële [Supabase migration-repair guidance](https://supabase.com/docs/reference/cli/supabase-migration-repair) vereist een gekoppeld project en beschrijft dat `applied` een history-record toevoegt. Dit is een uitvoerinstructie; in deze run is de SQL niet toegepast en is niets als toegepast geregistreerd.

### Component- en runtimeblokkades

- Read-only Payroll Lab-readback: zeven `customer_component_versions`, alle zeven `DRAFT`; geen actieve Mars `PAYFULL02_VARIABLE_REGULAR_WAGE`-componentversie of effectieve variabele-urenbron. Er is geen ondersteund looninputcontract om te koppelen. `AW_WORK` blijft `SOURCE_GAP`; er is geen tarief, mapping of Payroll-run verzonnen.
- Omdat de approval-relatie ontbreekt, is de HR Admin-browserketen niet hervat: geen invoer/import, revisiegebonden goedkeuring, stale-approval-weigering, heraccordering of Payroll-vrijgave uitgevoerd. De Manager-, Employee-, vreemde-tenant-, RLS- en Payroll-sourceproviderproeven voor deze nieuwe approval-tabel/RPC zijn evenmin uitgevoerd. Er zijn geen W04-datamutaties gedaan.
- Bestaande periodecontracttests blijven bewijs voor exacte maand-/vierwekenidentiteit, maar geen live consumptiebewijs. `FOUR_WEEKLY_PAYROLL_CALCULATION_NOT_VALIDATED` blijft fail-closed. Historische Payroll-runs en salarisstroken zijn niet benaderd of gewijzigd.

### Publicatie en besluit

- De documentatiecommit `340bfd54d16cdad52326c668540af6c224aa3fcd` is al lokaal aanwezig en wordt samen met deze closeout uitsluitend via een normale fast-forward naar dezelfde W04-branch en Draft PR #51 gepubliceerd. Er worden geen productcode-, migration- of gebruikersconfiguratiebestanden toegevoegd.
- **Integratie: HOLD. TEST-release: HOLD.** De harde resterende voorwaarden zijn een geldige bevoegde Core TEST-migratie met schema/history-readback, daarna HR Admin- en negatieve RLS/runtimeacceptatie. `AW_WORK` blijft daarnaast `SOURCE_GAP` tot een bestaande actieve Payroll-loonbron en componentversie beschikbaar zijn.

## PAY-W04-FINAL-CLOSEOUT-06 — 28-10-2026

**Uitkomst: PARTIAL; integratie PR #51 HOLD; TEST-release HOLD.** Geteste productcode-HEAD: `ceeaa5897ed96337317da4fce6ea0db56f800c0a`; `origin/main`: `11ba924b4a726431ae7928cfd8d2201d738893b4`. De bestaande databases blijven gescheiden: Core TEST `wnpfloqpjvaacobppbpk` voor HR/Actual Work en Payroll Lab TEST `jhgeriucbkfarxiudzfy` voor Payroll-contracten.

### Migratie en database

- SHA-256 van `20261027163113_actual_work_payroll_revision_approval` is gecontroleerd en komt overeen met `400fff4c24e68fe6bf7c06190bf493428c4913d3087e543117c9de25563856bf`.
- De read-only preflight vond de migratie en approval-tabel nog niet in Core TEST. De bestaande W04-migraties blijven behouden; de preflight telde 22 Actual Work-entries, 34 revisies en 0 Payroll-releases.
- De enige officiële `supabase_apply_migration`-aanvraag in deze closeout is geweigerd met `Invalid or expired requestState`. De read-only postcheck bevestigde dat er geen gedeeltelijke schema- of datamutatie was: de approval-relatie/RPC/guard ontbreken nog en de genoemde aantallen bleven gelijk. Er is niet opnieuw geprobeerd, geen gedeelde database gewijzigd en Payroll Lab is niet beschreven of gewijzigd.

### Lokale TEST- en browseracceptatie

- De centrale TEST-configuratie is via de bestaande hardlink en de vereiste configuratievelden gecontroleerd zonder waarden te tonen. De officiële launcher preflight slaagde; de lokale app is via die launcher op loopback gestart.
- Via de bestaande lokale HR Admin Test Auth-flow is de context `De Sterren holding · Planeten` gekozen en daarna `Mars BV`. Bij openen van `/actual-work/payroll?periodStart=2026-10-01` faalde de W04-review met `PGRST205`: de Core-relatie `actual_work_payroll_approvals` ontbreekt. Dit is een schema-/migratieblokkade, geen bewijs van een geslaagde HR Admin-werkplek.
- Daardoor zijn invoer, CSV-preview/bevestiging, accordering, correctie/heraccordering, vrijgavefingerprint, bronconsumptie en W04-runtime-RLS niet uitgevoerd. Deze browserpoging heeft geen Actual Work-, Payroll-, TVT- of auditmutatie gedaan.
- De bestaande algemene Payroll-personacheck is afzonderlijk uitgevoerd en is geen W04-workflowbewijs: Lisa `BLOCKED`, Jaap `READY_WITH_EXPECTED_GAP`, Frits `BLOCKED`. Manager-, Employee-, vreemde-tenant- en database-RLS-proeven voor W04 blijven OPEN.

### Payroll-bron, TVT en perioden

- De read-only Payroll Lab-inventaris vond geen effectieve Mars-variabele-urenrelatie of toepasbare reguliere-urencomponentversie; aangetroffen `customer_component_versions` zijn DRAFT. `AW_WORK` blijft daarom `SOURCE_GAP`. Er is geen vast salaris omgezet en geen mapping of componentversie aangemaakt.
- Er was voor Mars geen geconfigureerde TVT-keten om live te beproeven. TVT-ledgeropbouw, opname en runtime-idempotentie zijn in deze closeout niet bewezen. De bestaande TVT-contracttests zijn wel in de gerichte lokale testbatch opgenomen.
- De exacte maand-/vierwekenperiode-identiteit en jaargrens blijven contractueel gedekt door bestaande tests. Vierweken-brutonetberekening blijft bewust `FOUR_WEEKLY_PAYROLL_CALCULATION_NOT_VALIDATED`; er is geen Payroll-run gestart.

### Verificatie en resterende gates

- Gerichte W04/Actual Work/Payroll/TVT/migratiecontracten: **126/126 unieke tests PASS**. Eén migratiecontracttest overschreed de 5-seconden time-out in de parallelle batch en slaagde vervolgens **5/5** in de geïsoleerde rerun; er zijn geen assertions verwijderd of versoepeld.
- Eerder gevalideerde volledige suite **3.810 PASS / 8 SKIP**, Control **11/11**, NL-2026 **49/49**, TypeScript, ESLint, i18n en rootbuild zijn hergebruikt; ze zijn in deze documentatie-/runtime-closeout niet opnieuw uitgevoerd.
- Live migratie-apply/readback, HR Admin-mutaties en heraccordering, Payroll-vrijgave/consumptie, W04-RLS en negatieve API/autorisatieproeven zijn niet geslaagd of niet uitgevoerd. Het huidige Vercel-projectreadback bevat geen effectieve Git-/Preview-triggerinstellingen; het branchpush-risico is daarom niet bevestigd.
- Geen Vercel-deployment, Payroll-run, FINALIZED-wijziging, gedeelde databasewrite of lokale featurebranchcodewijziging uitgevoerd. De geteste productcode blijft HEAD `ceeaa5897ed96337317da4fce6ea0db56f800c0a`.

**Besluit:** PR #51 blijft Draft en **HOLD** voor integratie; TEST-release **HOLD**. Sluiten vereist een reguliere geautoriseerde apply/readback van de exacte Core-migratie, daarna W04-browser-/RLS-acceptatie met de bestaande persona's en een geldige normale Payroll-componentconfiguratie voor `AW_WORK`. Geen autorisatie-omzeiling, artificiële fixture of nieuwe Payroll-engine is toegestaan.

## Architectuurcorrectie en actuele integratieacceptatie — 26-10-2026

- De geldende architectuur is één LiquidHR-applicatie met twee bestaande TEST-databases: Core TEST voor HR/Actual Work en Payroll Lab TEST voor Payroll-administraties, kalenders, componenten en runs. W04 gebruikt de bestaande Core-client plus Payroll-repositories. De twee W04-migraties waren al op Core TEST toegepast; deze acceptatieronde voerde geen migratie of databasewrite uit.
- De bestaande lokale launcher startte de HR Admin-werkplek `/actual-work/payroll` met actieve administratie Jupiter. De pagina laadde Payroll-periodes uit Payroll Lab en Actual Work-registraties uit Core. Het bestaande overzicht toont 3 registraties / 14 uur; geen daarvan is voor Payroll vrijgegeven en alle drie blijven `SOURCE_GAP`.
- De beschikbare Payroll-kalender toont oktober 2026 als gesloten en november 2026 als open; in de geladen opties staat geen vierwekenperiode. De bestaande Actual Work-regel weigert toekomstige gewerkte uren voor november. Er is daardoor geen veilige periodecombinatie om nieuwe synthetische uren te importeren, accorderen of vrij te geven. De mislukte toekomstige invoerpoging is niet opgeslagen; geen bestaande registratie, TVT-saldo, Payroll-run, FINALIZED-record of salarisstrook is gewijzigd.
- Een echte W04-defect in de bestaande CSV-service is hersteld: `payrollPeriodStart` wordt nu tegen de Payroll Lab-kalender gematcht, moet naar precies één geldige open periode verwijzen en de registratie moet binnen de periodegrenzen vallen. Gesloten, ontbrekende, ambigue of afwijkende perioden falen gesloten. Een exacte vierwekenstart hoeft geen maandstart te zijn; een test over de jaargrens verifieert de bestaande startdatumdoorgifte naar Core. Er is geen migratie of nieuwe database voor nodig.
- De serviceproef dekt ook dat een gesloten periode vóór de Core-save-RPC wordt geweigerd. Gerichte W04/Actual Work-tests: **28/28 PASS**; relevante migratie-/TVT-contracttests: **11/11 PASS**; HR Suite TypeScript en ESLint voor de gewijzigde bestanden: **PASS**; `git diff --check`: **PASS**.
- Browseracceptatie bevestigde de geauthenticeerde HR Admin-werkplek en cross-database reads. De lokale browser koppelde het synthetische CSV-previewbestand niet aan de file-input, dus de CSV-preview/import is niet als browserflow bewezen. Door de periodeconfiguratie zijn browserinvoer, accordering, correctie, TVT-ledger en Payroll-vrijgave niet uitgevoerd. De bestaande persona-check laat Lisa en Frits geblokkeerd en Jaap met de vastgelegde verwachte gap; medewerker-, Manager- en cross-tenant runtimeproeven blijven OPEN.
- De bestaande Core-readback na de twee W04-migraties liet RLS/policies op de W04-tabellen en beperkte directe grants zien; geen directe client-write is gebruikt. Nieuwe runtime-RLS/persona-proeven zijn in deze ronde niet uitgevoerd.

**Actuele uitkomst: HOLD voor integratie en TEST-release.** De tweedatabase-integratie is in de lokale HR Admin-werkplek bewezen als read-only bronprojectie; volledige W04-gebruikersacceptatie vereist een bestaande, open Payroll-periode die overlapt met een door Actual Work toegestane periode en een werkende bestaande persona/browserflow. De gesloten oktoberperiode wordt niet heropend en er wordt geen toekomstige gewerkte tijd gefabriceerd.

## PAY-W04-FINAL-ACCEPTANCE-AND-PR51 — runtime- en pushgates 26-10-2026

**Lokale kandidaat:** `4e53844fe0a4244c75932c86439820ca5da1250c` op `work/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026`; `origin/main` blijft `11ba924b4a726431ae7928cfd8d2201d738893b4`.

### Omgevingsgates

- De bestaande launcher en persona-preflight zijn uitgevoerd met de canonieke `%LOCALAPPDATA%`-locatie `C:\Users\Edwin\AppData\Local`, omdat deze PowerShell-sandbox `LOCALAPPDATA` naar een geïsoleerd sandboxpad omleidt. De procesvariabele is alleen voor de preflight gezet; geen configuratiebestand is gewijzigd of gekopieerd.
- `start-test-worktree.ps1 -Mode Development -PayrollAcceptance -PayrollPersonaAcceptance -PreflightOnly` **PASS**: centrale runtimevariabelen en persona-credentialvelden zijn geldig; de launcher startte geen server en toonde geen waarden.
- `check-test-personas.ps1 -SkipBrowser`: statische catalogus, allowlist, configuratie en persona-velden **PASS**; Lisa, Jaap en Frits blijven **BLOCKED** omdat browseracceptatie expliciet is overgeslagen.
- Er was geen listener op lokale app-/Postgres-/Supabase-poorten 3000, 3010, 3011, 5432, 54321 of 54322. `supabase`- en `psql`-CLI's ontbreken. De bestaande persona/catalogusconfiguratie wijst naar Core TEST en Payroll Lab TEST; er is geen geïsoleerde lokale database aangetoond. Daarom zijn migratie-toepassing, DB/RLS-readback, HR Admin/Employee-browserwrites, TVT-ledgerreadback en negatieve Manager/tenant-sessieproeven **niet uitgevoerd**. Geen gedeelde databasewrite gedaan.
- Dit vervangt de eerdere preflightmelding dat persona-configuratie ontbrak: die melding kwam door de omgeleide sandbox-`LOCALAPPDATA`; de bestaande canonieke runtime- en persona-configuratie zelf is aanwezig en valide.

### Effectieve Vercel-pushgate

- De geautoriseerde Vercel-projectreadback en Vercel CLI JSON-inspectie bevestigen project `liquidhr` en rootdirectory `apps/hr-suite`, maar bevatten geen Git-repositorybinding, productiebranch, Preview-deploymenttoggle of build-ignore-instelling. `vercel.json` is niet als bewijs voor deze instellingen gebruikt.
- De bestaande Vercel-dashboardtab kon niet worden gelezen: de CDP-binding gaf driemaal `Emulation.setFocusEmulationEnabled`-timeout, ook na een sessieherstel. Er is niet genavigeerd of iets gewijzigd.
- De effectieve instellingen laten dus niet toe een automatische Preview bij push uit te sluiten. Er is niet gepusht en er zijn geen Vercel-instellingen gewijzigd.
- GitHub-readback: PR #51 is **open / Draft / mergeable** op remote HEAD `0f440757905cbc7c7d454bec789a4b27dd6125a1`. De PR-body en diff beschrijven de oudere kandidaat; deze bevatten lokale HEAD `4e53844fe0a4244c75932c86439820ca5da1250c` niet.

### Definitief besluit

- **PR #51 integratie: HOLD.** De lokale kandidaat is niet remote beschikbaar; er ontbreekt geïsoleerde lokale DB/RLS- en browseracceptatie, en de Vercel Git-/Preview-pushtrigger blijft onzichtbaar. Verantwoordelijke acties: lokale TEST-infrastructuurbeheerder levert een geïsoleerde lokale Supabase/Postgres-runtime voor de bestaande persona-workflow; projectbeheerder levert de effectieve Vercel Git/Preview/build-ignore-instellingen of geeft expliciet toestemming voor de mogelijke Preview die een branchpush start.
- **TEST-release: HOLD.** Geen migratie, deployment, Payroll-run, FINALIZED-run-/salarisstrookwijziging of gedeelde databasewrite uitgevoerd.
- De eerder uitgevoerde groene W04-/Payroll-/NL-2026-testset en rootbuild zijn hergebruikt; deze ronde heeft geen productcode gewijzigd en heeft de 3.810-testsuite niet herhaald.

## PAY-W04-INTEGRATION-READY-01 — eindverificatie 26-10-2026

**Branch:** `work/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026`

**Geteste basis:** `47f45fdbf43af630c9fe718d9b0ed5b7dff8caa2`; `origin/main`: `11ba924b4a726431ae7928cfd8d2201d738893b4`.
**Draft PR #51:** remote HEAD `0f440757905cbc7c7d454bec789a4b27dd6125a1` (GitHub-readback: open, draft, mergeable). De PR-body is verouderd en beschrijft de vierwekenconsumer nog als volledig `SOURCE_GAP`; de kandidaat bevat onderstaande lokale W04-fix nog niet.

### Functionele uitkomst en delta

- De bestaande W04-keten blijft leidend: Actual Work invoer/import/revisies, HR Admin-vrijgave, TVT-ledger en bronprojectie zijn niet vervangen. De maandelijkse gewone-urenbron blijft gekoppeld aan de bestaande `PAYFULL02_VARIABLE_REGULAR_WAGE`-verwerking.
- De enige codefix in deze verificatieronde verplaatst exacte, open Payroll-periode-ID-controle achter de bestaande server-only `payroll-setup-service`. Zo blijft de Payroll-sourceprovider binnen de bestaande goedgekeurde server-only importgrens. Een contracttest controleert ID, periodetype, jaar/nummer, periodiciteit en exacte start/einddatum voor een vierwekenperiode die 2026 en 2027 overspant.
- De vierwekenbron blijft aan de exacte kalenderperiode gekoppeld en verschijnt eenmaal met dezelfde bronregistratie/fingerprint. Er is geen maandtoerekening of verdeling. De daadwerkelijke vierwekenberekening blijft `UNSUPPORTED: FOUR_WEEKLY_PAYROLL_CALCULATION_NOT_VALIDATED`.
- Bestaande TVT-opbouw/-opname blijven verlofledgertransacties, geen loonbetaling. Ontbrekende of ambigue betaalcomponentinput blijft fail-closed als `SOURCE_GAP`; er zijn geen tarieven, fiscale regels of nieuwe componentmappingaannames toegevoegd.

### Verificatie

| Gate | Resultaat |
| --- | --- |
| Gerichte regressies na de server-only fix | **118/118 PASS in 12 bestanden**, inclusief Payroll source/provider, periode-identiteit, Actual Work, TVT/migratiecontracten en server-only-boundary. |
| Bestaande HR Suite-testset | **3.810 PASS, 8 SKIP, 0 FAIL**; 757 bestanden geslaagd, 4 overgeslagen. |
| Control | **11/11 PASS**. |
| NL-2026-regels | **49/49 PASS**. |
| Root TypeScript | **PASS** voor HR Suite, Control, Payroll Engine, CAO bench en NL-2026. Payroll Engine typecheck: **PASS**. |
| ESLint | Root lint exit **0**, 0 errors en 7 bestaande warnings in ongewijzigde distributie-/importtests. |
| i18n | **PASS**, 43 NL/EN-namespaces gelijk. |
| Migratie-eol-contract | **5/5 PASS**; de test normaliseert CRLF naar LF vóór vergelijking. De SQL-contractblob bleef ongewijzigd. Geen assertion verwijderd. |
| Volledige rootbuild | Eerste sandboxrun kon geen Windows-junction/Control-buildmap maken. Dezelfde rootbuild is daarna met toegestane lokale uitvoeringsrechten **PASS** voor HR Suite en Control, inclusief trace-/PDF-runtimecontroles. |
| Beschermde lokale bestanden | Focus-widget na build teruggezet naar de vooraf bestaande SHA-256 `A8134B54351065DB6EFF5CBED717511A979AB85118810DA2941195DF8BAEEAEA`; `next-env.d.ts` bleef `1B59D4C6B83807DB275D43F3CF2CC8E9323F465FAB764EEA091CC5BECD5BAD37`; fingerprint van 801 `.tool-home`-bestanden vóór/na build gelijk. Geen van deze bestanden is onderdeel van de W04-commit. |
| Lokale TEST / RLS / browser | **OPEN, niet uitgevoerd**: bestaande persona-preflight mist de centrale TEST-config en persona-credentialfile; er is geen lokale Payroll/Postgres-listener en `supabase`/`psql` zijn niet beschikbaar. Geen credentialwaarden gelezen en geen remote/databasewrites gedaan. |
| Diff-/secretcontrole | `git -c core.whitespace=cr-at-eol diff --check`: **PASS**; gerichte scan van de vier geselecteerde W04-bestanden: **PASS**, geen credential literals. Geen secrets/configbestanden behoren tot de W04-delta. |

### Besluit

- **Integratie PR #51: HOLD.** Lokale tests en rootbuild zijn groen, maar lokale geïsoleerde DB/RLS/browserreadback ontbreekt. Bovendien vereiste het repositorybeleid verificatie van de effectieve Vercel Git-/Preview-triggers vóór push. De bevoegde projectreadback retourneerde project-/deploymentmetadata maar geen Git-triggerinstelling; `vercel.json` volstaat niet. Daarom is niet gepusht en blijft PR #51 op remote HEAD `0f440757905cbc7c7d454bec789a4b27dd6125a1`; ook de PR-body is nog niet op de lokale kandidaat bijgewerkt.
- **TEST-release: HOLD.** Geen migratie, deployment, Payroll-run, FINALIZED-wijziging, salarisstrookwijziging, betaling of aangifte uitgevoerd.
- Deze gates bevestigen W04 als betrouwbare urenbron met bestaande maandverwerking en een exact geïdentificeerde vierwekenbron; ze maken geen betaalde overuren-/toeslagberekening of vierweken-bruto/nettoverwerking vrij.

**Datum:** 26-10-2026
**Branch:** `work/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026`
**Start/base:** `11ba924b4a726431ae7928cfd8d2201d738893b4` (PR #50, vanaf `origin/main`)
**Uitkomst:** **PARTIAL — integratie HOLD — TEST-release HOLD**

## PAY-W04-COMPLETE-PAYROLL-INTEGRATION-02 — closeout 26-10-2026

**Startpositie:** branch `work/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026`, HEAD/basis `0f440757905cbc7c7d454bec789a4b27dd6125a1`, Draft PR #51. De verwachte oudere featurecommits, UI, migrations, TVT-ledger, tests, revisie-audit, HR Admin-review en bestaande PAYFULL02-koppeling zijn behouden.

**Toegevoegd op dezelfde branch in deze closeout:**

- Het bestaande `PayrollSourceProviderInput`/snapshot-contract accepteert nu aanvullend een exacte `payrollPeriodIdentity` (Payroll Lab-ID, kalenderjaar/-nummer, `REGULAR`, periodiciteit, start/eind). De normale serverprovider verifieert deze identiteit tegen de bestaande scoped Payroll-kalender en weigert onbekende/gesloten perioden vóór verdere bronreads.
- De bestaande Actual Work-reader haalt `employment_work_hour_entries` voor `FOUR_WEEKLY` op via Core-vrijgaven met dezelfde periode-ID; zij valideert administratie, start/eind en periodiciteit en filtert daarna op exact medewerker/dienstverband. Herhaalde componentreleases voor één bronentry geven `ACTUAL_WORK_PAYROLL_MAPPING_AMBIGUOUS`. Geen kunstmatige periodeverdeling.
- De bronhash bevat de volledige periodidentiteit en de bestaande releasefingerprint/revisie/mapping. De cross-year test 2026-12-21 t/m 2027-01-17 toont de vrijgegeven uren exact eenmaal in de source snapshot en verwijdert alleen `ACTUAL_WORK_FOUR_WEEKLY_PAYROLL_CONSUMER_UNAVAILABLE` wanneer ID en grenzen exact kloppen.
- Payroll-run-, inputset- en fiscale berekening blijven maand-only. Een vierwekenbron blijft daarom expliciet geblokkeerd met `UNSUPPORTED: FOUR_WEEKLY_PAYROLL_CALCULATION_NOT_VALIDATED`; er wordt geen bruto/netto-/pensioen-/SV- of FINALIZED-runuitkomst gemaakt. De maandelijkse normale urenroute gebruikt het bestaande `PAYFULL02_VARIABLE_REGULAR_WAGE` en de bestaande PAYFULL02-berekening. Betaalde meer-/overuren en toeslagen blijven `SOURCE_GAP` bij afwezigheid van geschikte bestaande Payroll-componentinvoer. TVT- en informatieve typen worden niet uitbetaald.
- TVT-ledger, expliciet vervalbeleid, idempotente delta-/revisieverwerking, CSV-preview/import en HR Admin-vrijgave zijn bestaande W04-implementatie op deze branch en blijven ongewijzigd. Geen kloktijden of automatische classificatie toegevoegd.

## Uitgevoerde gates

| Gate | Uitkomst |
| --- | --- |
| Gerichte huidige W04-/Payroll-/periode-/migratiecontracten | **104/104 PASS in 9 bestanden**: Actual Work source-readers, Payroll-source provider/schema, Payroll-kalender, bestaande work-hours service, W04-periode/TVT-migratiecontract en bestaande release-, leave-ledger- en correctieauditcontracten. Bevat cross-year exact-ID-projectie, fail-closed periodecontrole en de bestaande maandelijkse PAYFULL02 source → `calculatePayroll` proef. |
| TypeScript | Payroll Engine **PASS** en HR Suite **PASS** op de huidige code. |
| ESLint | **PASS** op alle 7 gewijzigde HR Suite source-/testbestanden. Payroll Engine contract-/exportbestanden zijn buiten de HR Suite ESLint-base; die bestanden zijn niet door deze lint-run gecontroleerd. |
| Root suite/build/i18n | Niet opnieuw uitgevoerd in deze closeout; de eerdere baseline-uitkomsten hierboven in de historische initiële acceptatie zijn geen bewijs op de nieuwe code. Er zijn geen zichtbare tekst-/taalbestanden gewijzigd, dus i18n-pariteit is niet opnieuw gedraaid. |
| `git diff --check` | **PASS** met `git -c core.whitespace=cr-at-eol diff --check`; deze CRLF-check voorkomt dat de bestaande checkout de CR-byte van gewijzigde regels als trailing whitespace rapporteert. Alleen line-ending-normalisatiewaarschuwingen blijven zichtbaar op bestaande bestanden. |
| Migratie/RLS/browser | W04-migratie niet toegepast; migratiecontracttest PASS. De persona-preflight bevestigde statische catalogus/allowlist, maar het bestaande script strandde op `$credentialsReady`; metadata-only inspectie vond geen centrale TEST-config of persona-credentialfile en geen lokale Payroll-serverlistener. DB/RLS/browser-runtime blijft **OPEN**. Geen secretwaarden gelezen. |

## Acceptatiescenario’s na closeout

| # | Resultaat | Bewijs / resterende grens |
| ---: | --- | --- |
| 1 | OPEN — browser/DB | Individuele invoer hergebruikt Actual Work; geen geauthenticeerde achturenregistratie uitgevoerd. |
| 2 | PARTIAL — unit | Dag-, maand- en periodevelden blijven op Actual Work; geen database-readback van maand-/dagregistraties. |
| 3 | PARTIAL — source/provider | Exacte cross-year Payroll-ID-vrijgave wordt eenmaal opgenomen in de Payroll-bronprojectie met bronhash. De daadwerkelijke vierweken-run blijft `UNSUPPORTED` omdat de berekenings-/fiscale contracts maand-only zijn. |
| 4 | PASS — unit | CSV-preview behandelt meerdere medewerkers synthetisch; geen DB/browserimport uitgevoerd. |
| 5 | PASS — unit | Herhaalde CSV-bevestiging en bronreferenties zijn idempotent. |
| 6 | PASS — unit | Ongeldige medewerkers, perioden, uren, kolommen en conflicterende referenties worden afgewezen. |
| 7 | PASS — provider | Niet-geaccordeerde uren zijn geen definitieve Payroll-input. |
| 8 | PARTIAL — contract | HR Admin/RPC-audit en atomaire TVT-goedkeuring zijn statisch en service-side afgedekt; geen PostgreSQL/RLS-readback. |
| 9 | PARTIAL — contract | Correctiereden en revisie/fingerprint leiden tot herbeoordeling; type-/scope-/jaarherclassificatie na TVT-posting blokkeert voor ledgerreview. Ledgertransactie is niet tegen PostgreSQL uitgevoerd. |
| 10 | PARTIAL — provider + engine | Maandelijkse gewone variabele uren bereiken de bestaande PAYFULL02-berekening. Uitbetaalde meer-/overuren en premiums blijven `SOURCE_GAP` door ontbrekende bestaande componentinputs. |
| 11 | PARTIAL — migration contract | TVT-opbouw gebruikt expliciet vervalbeleid en bestaand ledger; geen expiry-default. Databaseopbouw niet live uitgevoerd. |
| 12 | PARTIAL — bestaand pad | TVT-opname blijft aan bestaande verlofaanvraag-/saldoverwerking gekoppeld; geen ledger-runtimeproef. |
| 13 | PARTIAL — classificatie | Door HR gekozen werkurentype wordt gevolgd zonder kloktijden; een aparte nacht-/toeslagcomponent ontbreekt en blijft `SOURCE_GAP`. |
| 14 | PASS — provider | Ontbrekende/conflicterende componentbron blokkeert fail-closed met `SOURCE_GAP`. |
| 15 | PARTIAL — regressie | Geen verlof-/ziektebron of rekenregel vervangen; volledige HR-/Payroll-suite slaagt. Geen geïsoleerde database-readback. |
| 16 | PASS — geen write | Geen Payroll-run, FINALIZED-record of PDF gewijzigd; een historische databasevergelijking is zonder runtime niet uitgevoerd. |
| 17 | PARTIAL — service/contract | Manager wordt server-side geweigerd; de nieuwe RPC vereist HR_ADMIN/TENANT_ADMIN. Employee-/Manager-RLS-sessies ontbreken. |
| 18 | PARTIAL — contract | Tenant-/groep-/administratiescope wordt server-/RPC-side gevalideerd; cross-tenant/-admin RLS-probes ontbreken. |

## Integratie- en releasestatus

- **Integratie: HOLD.** De bronprovider consumeert nu een exact gescopeerde vierwekenvrijgave en de maandelijkse gewone-urenroute heeft een bestaande PAYFULL02-berekeningsproef. W04-Done is niet bereikt: FOUR_WEEKLY payroll-runs zijn niet fiscaal gevalideerd en blijven `UNSUPPORTED`; geschikte bestaande uitbetaalcomponenten voor meer-/overuren en toeslagen ontbreken; live schema/RLS/browserreadback is niet bewezen.
- **TEST-release: HOLD.** Geen migratie, deployment, Payroll-run, salarisbetaling of aangifte uitgevoerd.
- **Featurecommit:** de broncode-, test- en documentatiewijzigingen zijn lokaal vastgelegd op dezelfde branch; geen nieuwe branch. **Draft PR #51:** [W04 closeout](https://github.com/EdwinCycling/LiquidHR/pull/51) staat remote nog op head `0f440757905cbc7c7d454bec789a4b27dd6125a1`. De repository-/AA-policy vereist bevestiging van de effectieve Vercel Git-/Preview-triggers vóór branchpush; de Vercel projectreadback bevat die instelling niet, dus de remote PR-head wordt niet bijgewerkt.
- De lokale build heeft de gegenereerde Focus-widget tijdelijk gewijzigd. Het artefact is naar de ongewijzigde HEAD-inhoud teruggezet (SHA-256 `A8134B54351065DB6EFF5CBED717511A979AB85118810DA2941195DF8BAEEAEA`); `next-env.d.ts` bleef gelijk (SHA-256 `1B59D4C6B83807DB275D43F3CF2CC8E9323F465FAB764EEA091CC5BECD5BAD37`). Bestaande `apps/hr-suite/.tool-home/` is behouden en niet opgenomen.

**Conclusie:** W04-vrijgaven zijn lokaal controleerbaar via het bestaande Payroll-sourcecontract voor zowel maand- als exact geïdentificeerde vierwekenperioden; cross-year vierwekenuren worden niet verdeeld en verschijnen eenmaal in de snapshot. Een definitieve vierwekenberekening, uitbetaling via nieuwe meer-/overuren- of toeslagcomponenten, en live DB/RLS/browseracceptatie zijn niet aangetoond. Volledige Definition of Done en integratie-GO zijn daarom niet bereikt. Geen main-push, merge, gedeelde databasewrite, deployment, wijziging aan FINALIZED-run/PDF of productieve Payroll-run.

---

## Initiële baseline-acceptatie op featurecommit 8efaf0f (historisch; opgevolgd door de closeout hierboven)

## Bestaande basis en delta

| Onderdeel | Bevinding |
| --- | --- |
| Urenbron en historie | `work_hour_types`, `employment_work_hour_entries`, `actual_work_periods` en append-only `actual_work_revisions` bestonden. De huidige dag-/periode-invoer, correctieredenen, revisiehistorie en bestaande bulk-/team-/kalender-/instellingenroutes zijn hergebruikt. De routes verdelen perioderegistraties niet over dagen. |
| Operationele configuratie | `overtime_type_settings` en `overtime_type_exceptions` blijven bestaande invoerbeperkingen; zij classificeren geen loon. De bestaande medewerkeruren-, bulk-, team-, HR-kalender- en uurtype-instellingenroutes zijn behouden. |
| TVT en verlof | De koppeling `work_hour_types → leave_type_overtime_work_hours → leave_types(OVERTIME_HOURS)` bestaat, maar `leave/accrual-service.ts` selecteert uitsluitend `ACCRUAL` en `post_group_leave_accrual` weigert andere entitlement modes. Er is geen bewezen TVT-posting naar `leave_balance_buckets`/`leave_accrual_transactions`. De ledger vereist ook een vervaldatum waarvoor de TVT-configuratie geen beleid bevat. W04 markeert TVT daarom als `SOURCE_GAP`; het schrijft geen saldo en geen loon. |
| Payroll-bron | De bestaande PAYFULL-02-composition/provider heeft voor deze bron alleen `PAYFULL02_VARIABLE_REGULAR_WAGE` met een expliciet uurtarief × uren × factor-input. Deze component verwerkt alleen gewone uren met doel `PAYMENT`. Doel `PREMIUM` en betaalmapping van `OVERTIME`-typen zijn fail-closed `SOURCE_GAP`, zodat die bedragen niet als regulier loon worden geboekt. Vrije of meervoudige componentregels, een aparte nacht-/toeslagcomponent en de volledige componentcatalogus zijn niet beschikbaar via dit broncontract. |
| Verlof, ziekte en ziektepercentage | De bestaande Payroll-broncontracten en leave-/ziekteregistraties zijn niet vervangen of uitgebreid met een tweede berekening. Betaald/onbetaald verlof, ziekte in uren/dagen en gedeeltelijke arbeidsongeschiktheid zijn niet end-to-end door W04 herberekend. |
| Toegevoegd | CSV-preview en idempotente import via de canonieke Actual Work-savefunctie; HR Admin-review, operationele goedkeuring en aparte Payroll-vrijgave; effectieve mappingversies; onveranderlijke vrijgave met revisie, mapping, fingerprint, actor en tijd; bronproviderpoort voor actuele vrijgaven; W04-werkplek op `/actual-work/payroll`; NL/EN-teksten en service-/contracttests. Correcties van bestaande dag- of periodefeiten vereisen ook in open perioden een niet-lege reden. De server dwingt dit af en een uitgestelde databaseconstraint weigert wijzigingen zonder bijbehorende append-only correctierevisie met actor, timestamp, periode en oude/nieuwe uren. Een PGlite-contracttest voert zowel weigering als geldige correctie uit. |

De migratie voegt W04-mapping-/vrijgavetabellen, een correctie-auditconstraint en afgeschermde RPC’s toe. Een vrijgave wijzigt geen Payroll-run. De bestaande Payroll-kalendercontracten ondersteunen versioned `FOUR_WEEKLY`-kalenders en onveranderlijke `payroll_periods`; W04 koppelt Actual Work-vrijgaven nog niet aan die periode-ID’s. De huidige vrijgave accepteert alleen kalendermaandstarts; de expliciete koppeling van de oorspronkelijke Actual Work-periode aan een bestaand salarisperiode-record en ondersteuning daarvan in de source-provider ontbreken. Een wijziging na een eerdere vrijgave levert herbeoordeling/TWK-required op; een historische release wordt niet herschreven. PAYMENT en PREMIUM worden beide geblokkeerd als hetzelfde overwerktype aan TVT is gekoppeld. Er zijn geen kloktijd-, begin-/eindtijd-, pauze-, tijdzone- of nachturenvelden toegevoegd. De CAO-code leidt geen nacht-/zondag-/overwerkclassificatie af uit naam of code.

## Acceptatiescenario’s

| # | Resultaat | Bewijs / resterende grens |
| ---: | --- | --- |
| 1 | OPEN | De bestaande individuele urenroute is hergebruikt; geen geauthenticeerde achturenregistratie met TEST-persoon uitgevoerd. |
| 2 | OPEN | Dag-/periodecontracten en bestaande invoer zijn behouden; maand- en dagregistratie niet met een geïsoleerde database doorlopen. |
| 3 | PARTIAL | Vierwekenfeiten blijven als oorspronkelijke periode intact en worden niet verdeeld. De Payroll-kalender kan vierwekenperiodes vastleggen, maar W04 verbindt die periode-ID nog niet aan de vrijgave; de vrijgave/source-provider accepteren alleen de huidige maandreferentie. Geen run-readback uitgevoerd. |
| 4 | PARTIAL | Synthetische service-preview dekt meerdere medewerkers. Browser-/DB-import ontbreekt. |
| 5 | PARTIAL | Unittest bevestigt herhaalde bevestiging en gelijke bronreferenties als idempotent; de migratiecontracttest controleert de advisory lock en canonieke save. Niet tegen PostgreSQL uitgevoerd. |
| 6 | PASS — unit | Ongeldige medewerkers, datums, hoeveelheden, kolommen en tegenstrijdige bronreferenties worden in preview afgewezen; geen import-RPC voor zulke regels. |
| 7 | PASS — unit | Payroll-sourceprovider blokkeert niet-goedgekeurde uren en vereist een actuele HR-vrijgave voor betaalbare uren. |
| 8 | PARTIAL | Migratiecontract en provider binden vrijgave aan actor/tijd, revisie, mapping en SHA-256-fingerprint. RPC/RLS niet live uitgevoerd. |
| 9 | PARTIAL | Niet-lege reden voor wijzigingen aan bestaande feiten wordt schema-/server-side afgedwongen; de deferred databaseconstraint weigert een wijziging zonder corresponderende correctierevisie (PGlite 2/2). Revisie-/vrijgavecontract leidt verouderde vrijgaven naar herbeoordeling en `TWK_REQUIRED`; geen browser- of bestaande run-integratie uitgevoerd. |
| 10 | PARTIAL | Synthetische provider-test verwerkt expliciet gemapte gewone uren met het bestaande variabele uurloon. Toeslagmapping en betaalde overuren blijven `SOURCE_GAP` totdat een passend bestaand component/source-inputcontract beschikbaar is. |
| 11 | HOLD — SOURCE_GAP | De OVERTIME_HOURS-cataloguslink boekt niet naar het bestaande leave-ledger. Er is geen veilige bestaande verval-/boekingsregel om op te roepen. |
| 12 | HOLD — SOURCE_GAP | TVT-opname kan niet vanuit W04 aan TVT-opbouw worden gekoppeld zolang geen TVT-ledgerboeking bestaat. De uren worden niet als Payroll-loon aangeboden. |
| 13 | PARTIAL | Een door HR gekozen uurtype kan expliciet worden gemapt; er is geen kloktijd/nachtinference. De bedoelde aparte nachttoeslagcomponent ontbreekt in het huidige broncontract en blijft SOURCE_GAP. |
| 14 | PASS — unit | Een ontbrekende/ongeldige vrijgave- of componentmapping blijft fail-closed als SOURCE_GAP; unsupported componentregels zijn door migratie en service geweigerd. |
| 15 | OPEN | W04 heeft bestaande verlof-/ziekteregistraties niet gewijzigd; brede tests slagen behoudens de twee EOL-assertions. Geen TEST-ledgerreadback uitgevoerd. |
| 16 | OPEN | Deze run heeft geen Payroll-run, FINALIZED-record of PDF geschreven. Historische waarden zijn niet live vergeleken doordat de geïsoleerde runtime ontbreekt. |
| 17 | PARTIAL | HR Admin/Tenant Admin en `salary:write` worden server-side/RPC vereist; managerweigering is unit-tested en Payroll-RPC’s hebben rolcontracttests. Geen Employee/Manager sessie- of RLS-probe uitgevoerd. |
| 18 | PARTIAL | Tenant-/groep-/administratie-ID’s worden in service, RPC en FK-contract begrensd. Cross-tenant- en cross-administratie RLS-probes zijn OPEN zonder lokale Supabase-runtime. |

## Kwaliteitsgates

| Gate | Resultaat |
| --- | --- |
| Gerichte W04-/Actual Work-/Payroll-/CAO-/migratiecontracttests | **123/123 PASS** in 10 bestanden, inclusief PGlite-deferred-auditcontract en regressies die premium-/overurenmapping als `SOURCE_GAP` blokkeren. |
| Volledige HR Suite | De volledige suite is vóór de laatste fail-closed wijziging uitgevoerd: **3.789 PASS, 8 skipped, 2 FAIL** in één ongewijzigde `20261024150000_employee_directory_scope_hardening.contract.test.ts`. De asserts vergelijken LF-literals met CRLF-bestanden; die test en migratie zijn onveranderd (`git diff --quiet` bevestigd). Na de wijziging slagen de relevante W04-regressies afzonderlijk met **123/123**. |
| Control | **11/11 PASS**. |
| NL-2026 Payroll-regels | **49/49 PASS**. |
| TypeScript | `npm run type-check` root: **PASS** voor HR Suite, Control, Payroll Engine en NL-2026. |
| ESLint | `npm run lint` root: **exit 0**, 0 errors en 7 bestaande waarschuwingen in ongewijzigde tests. |
| i18n | **PASS** — 43 NL/EN namespaces met gelijke sleutels. |
| Rootbuild | **PASS** — `npm run build` slaagde voor HR Suite en Control, inclusief client-boundary-/function-tracechecks. De eerste sandboxpoging kon door Windows-junction-/`.next`-schrijfrechten niet afronden; dezelfde rootbuild slaagde daarna met workspace-buildschrijfrechten. De rootbuild draaide vóór de lokale featurecommit en de buildprovenance noemt daarom de start/base-SHA `11ba924b4a726431ae7928cfd8d2201d738893b4`. De applicatiecode wijzigde tussen build en commit niet, maar het build-artifact is formeel niet aan de featurecommit-SHA gepind. De door de build gegenereerde focus-widgetresource is naar de eerder gehashte HEAD-inhoud hersteld. |
| Diff whitespace | `git -c core.whitespace=cr-at-eol diff --check`: **PASS**. De gewone check telt in de bestaande CRLF-documentcheckout de CR-byte van toegevoegde regels als whitespace. |
| Secretpatronen | Gerichte scan van nieuwe migration/service/API-bestanden: **geen matches**. |
| Supabase migration / RLS runtime | **OPEN** — Docker CLI aanwezig maar daemon niet bereikbaar; Supabase CLI/`psql` ontbreken; localhost-poorten 54321/54322 zijn gesloten. |
| Lokale HR Admin-/Employee-browserflow | **OPEN** — officiële runtime-preflight en persona-preflight uitgevoerd. De centrale lokale TEST-configuratie en payroll-personacredentialbron ontbreken; de launcher meldt `BLOCKED` en alle drie gecatalogiseerde personas zijn niet beschikbaar. Geen configuratie geprovisioneerd of alternatieve omgeving gebruikt. |

## Integratie- en releasestatus

- **Integratie: HOLD.** TVT mist de bestaande-ledger-posting en geldige vervalregel; de provider heeft alleen de bestaande variabele uurlooncomponent, niet de gevraagde algemene componentmapping; de koppeling van Actual Work aan de bestaande `FOUR_WEEKLY`-Payroll-perioden en RLS/browser/migratiebewijs ontbreken. Bovendien is de volledige suite niet groen door de twee CRLF-contractfailures.
- **TEST-release: HOLD.** De migration is niet uitgevoerd, geen Payroll-run is aangemaakt en geen TEST-release/deployment uitgevoerd.
- Er is geen commit boven de start-HEAD en geen Draft PR gemaakt. De `.git/worktrees/.../index.lock` is binnen deze workspace read-only; een poging tot `git restore` kreeg `Permission denied`. De buildgegenereerde focus-widget is buiten Git naar de HEAD-inhoud hersteld. De bestaande untracked `apps/hr-suite/.tool-home/` is behouden en niet opgenomen.
- Geen push, merge, gedeelde/remote migration, historische FINALIZED-/PDF-mutatie, payrollrun, uitbetaling of aangifte.

**Conclusie:** de lokaal typecheck-/build-/gerichte-testbare verbinding is gedeeltelijk geïmplementeerd, maar Definition of Done is niet bereikt. Heropen integratie pas nadat de TVT-ledgerregel, aanvullende bestaande Payroll-componentbron, lokale PostgreSQL/RLS- en browseracceptatie, en de volledige testmatrix zonder de EOL-failures zijn bewezen.

## PAY-W04-END-TO-END-ACCEPTANCE-03 — 26-10-2026

**Uitkomst: PARTIAL — integratie HOLD, TEST-release HOLD.** Getest op branch `work/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026`, HEAD `50fd2b71795c451fee71b62069c16e0be9c8d5ff`. Er zijn geen productbestanden gewijzigd. De bestaande LiquidHR-app op `http://localhost:3010` gebruikte Core TEST `wnpfloqpjvaacobppbpk` als HR-bron en Payroll Lab TEST `jhgeriucbkfarxiudzfy` als afzonderlijke periodebron. Er is geen databaseconsolidatie, SQL-write of migratie uitgevoerd.

### Browser- en applicatiebewijs

- De HR Admin selecteerde in Mars de bestaande OPEN maandperiode `83ce4ce4-35cc-445f-8e7d-265099f12977`, 2026-10-01 t/m 2026-10-31. Hetzelfde geauthenticeerde review-endpoint retourneerde de periode uit Payroll Lab en de Actual Work-bronnen uit Core.
- Handmatig is `AW_WORK` geregistreerd voor `PAYCASE-03B-005`: 8 uur op 2026-10-20, gekoppeld aan de salarisperiode vanaf 2026-10-01. Bronrecord-ID: `6b290235-774e-472a-a13b-1479535260fe`; omschrijving: `PAY-W04 synthetische acceptatie 2026-10-20`.
- De CSV-import voegde `PAYCASE-03B-004` toe met 2 uur op 2026-10-21 (`sourceReference=w04-20261026-emma-001`, record-ID `a7f966a1-96e4-4c82-8b7b-db5ffa1f4d33`) en `PAYCASE-03B-005` met oorspronkelijk 1 uur op 2026-10-22 (`sourceReference=w04-20261026-noah-001`, record-ID `a742b81a-0f51-44cb-b47a-ed8b4b0104fd`). De twee geldige regels zijn geaccordeerd. Dezelfde CSV is opnieuw bevestigd; preview meldde twee al geïmporteerde regels. Readback bleef drie registraties, uiteindelijk 11,5 uur.
- De 1-uursregistratie is met reden `PAY-W04 synthetische correctie: gecorrigeerd naar de aangeleverde testbron` gecorrigeerd naar 1,5 uur. Readback bevat de reden en revisie 3. De registratie bleef echter `APPROVED` met de eerdere goedkeuringsactor/tijd; de vereiste herbeoordeling na correctie is niet bewezen en blijft een integratieblokker.
- Ongeldige CSV-regels zijn in preview afgewezen: onbekend medewerker, `INVALID_W04_TYPE` en `payrollPeriodStart=2026-10-02` zonder overeenkomstige periode. Preview van Jupiter-periode 2026-10-01 (`DRAFT`, dus niet OPEN) gaf 0 geldige en 1 ongeldige regel. Een onbekende Payroll-periode-ID gaf `ACTUAL_WORK_PAYROLL_PERIOD_UNAVAILABLE`. Deze previews zijn niet geïmporteerd.
- Alle drie de Mars-registraties bleven `APPROVED`, maar hadden `release=null`; er was geen versiegebonden vrijgave of runtime-fingerprint. Mars had geen effectieve AW_WORK-componentmapping, de review toonde `SOURCE_GAP` en geen vrijgave was beschikbaar. Er is geen Payroll-run gestart.
- Voor Mars toonde de API `tvtConfigured=false` en `tvtAccrued=false`. Er is geen geldige lokale overwerk-/TVT-regeling voor deze administratie gebruikt. TVT-opbouw, saldoafname en verval zijn daarom niet live bewezen; de bestaande ledger- en migratiecontracttests zijn wel meegenomen in de gerichte tests.
- Bestaande lokale Manager- en Medewerker-persona’s kregen op `GET /api/actual-work/payroll` respectievelijk een expliciete HR Admin-weigering en onvoldoende-rechtenmelding. De lokale contextselector bood alleen de tenant De Sterren holding met drie HR-groepen; een vreemde-tenantpersona ontbrak. Dit is geen live cross-tenant-RLS-bewijs.
- Er is geen bevestigde oproepkracht in de gebruikte Mars-fixture vastgesteld. De handmatige 8 uur is dus een bewijs voor HR Admin-invoer, niet voor de specifieke oproepkrachtacceptatie.

De bron-/periodedetails, goedkeuringen en correctierevisie zijn gecontroleerd via de bestaande applicatie-API. Er is geen Payroll-sourceprovider-run of definitieve componentconsumptie: de ontbrekende mapping houdt de bron terecht fail-closed. De bestaande tests bewijzen de exacte FOUR_WEEKLY-ID, de datums over 2026/2027 en de bronhashbinding contractueel; in de live Mars-/Jupiter-keuze is geen bruikbare historische vierwekenperiode aangetroffen. De bruto-nettoberekening blijft `FOUR_WEEKLY_PAYROLL_CALCULATION_NOT_VALIDATED`.

### Gerichte kwaliteitscontrole

| Gate | Resultaat |
| --- | --- |
| W04/Actual Work/Payroll/TVT/migratiecontracten | **104/104 PASS in 9 bestanden.** Eerste uitvoering stopte vóór teststart door Windows-`EPERM` in de sandbox-Temp-map; dezelfde tests slaagden met een tijdelijke map binnen de checkout. |
| App-level autorisatie | Employee- en Manager-GET geweigerd; Manager-service- en tenant-scopegevallen opgenomen in de geslaagde tests. |
| PostgreSQL RLS/grants/runtime | **OPEN.** Geen directe databaseverbinding of RLS-sessieproef gebruikt. De migratiecontracttests zijn geen runtime-RLS-bewijs. |
| Vierwekenperiode | Cross-year identiteit en providerprojectie **contractueel PASS**; live kalender-/berekeningsproef **OPEN / bewust fail-closed**. |
| Volledige suite/rootbuild/i18n | Niet herhaald; er is geen productcode gewijzigd en eerdere geldige basisresultaten zijn behouden. |
| Historische Payroll | Geen Payroll-run, FINALIZED-run, salarisstrook of PDF gewijzigd. |

 De drie goedgekeurde Actual Work-registraties zijn synthetische append-only auditdata in Core TEST en blijven behouden: IDs `6b290235-774e-472a-a13b-1479535260fe` (8 uur op 20-10), `a7f966a1-96e4-4c82-8b7b-db5ffa1f4d33` (2 uur op 21-10) en `a742b81a-0f51-44cb-b47a-ed8b4b0104fd` (gecorrigeerd 1,5 uur op 22-10), alle `AW_WORK` en toegewezen aan periode 2026-10-01. Ze zijn niet opgeschoond omdat de correctie-/goedkeuringsrevisies append-only audithistorie vormen. Er is geen mapping, TVT-transactie, release of Payroll-run toegevoegd.

**Besluit:** PR #51 wordt niet bijgewerkt of gepusht, omdat de volledige acceptatie niet slaagde. Integratie blijft **HOLD** totdat herbeoordeling van correcties, een bewezen oproepkrachtflow, bestaande componentinput/vrijgave, TVT-runtime en toepasselijke vierweken-/RLS-acceptatie beschikbaar zijn. TEST-release blijft **HOLD**. Er is geen commit, merge, deployment of nieuwe omgeving gemaakt.

## PAY-W04-FUNCTIONAL-FIX-AND-CLOSEOUT-04 — 27-10-2026

**Uitkomst: codecontracten PASS; live acceptatie en integratie HOLD.** De bestaande branch bouwt op HEAD `50fd2b71795c451fee71b62069c16e0be9c8d5ff`; de lokale W04-wijzigingen zijn na de groene codegates als lokale, niet-gepushede commit vastgelegd. Core TEST (`wnpfloqpjvaacobppbpk`) en Payroll Lab TEST (`jhgeriucbkfarxiudzfy`) zijn als afzonderlijke projecten bevestigd. De open maandperiode `83ce4ce4-35cc-445f-8e7d-265099f12977` blijft 2026-10-01 t/m 2026-10-31. Er is geen databasewrite, release, run, FINALIZED-mutatie of deployment uitgevoerd.

### Revisiegebonden HR Admin-accordering

- De lokale kandidaat voegt een append-only `actual_work_payroll_approvals`-contract toe. De accordering legt de exacte Actual Work-revisie, Payroll-periode-ID en -grenzen, actor en SHA-256-fingerprint vast; de algemene operationele `APPROVED`-status wordt niet meer als Payroll-accordering beschouwd.
- De review/service/UI vraagt opnieuw om HR Admin-accordering wanneer de actuele revisie geen passende goedkeuring heeft. De approval-RPC valideert de verwachte revisie onder `FOR UPDATE`, herhaalde aanvragen zijn idempotent en de vrijgave-trigger weigert ontbrekende, stale of afwijkende goedkeuringen/fingerprints. Correcties na eerdere vrijgave blijven onder de bestaande TWK-route.
- Geïsoleerde PGlite-migratiecontracttests controleren het volledige DDL tegen de bestaande sleutels, RLS/grants, immutable approvals, revision guard en geldige/ongeldige vrijgave. Dit bewijst geen uitvoering op PostgreSQL/Core TEST en geen geauthenticeerde runtimehandeling.

### AW_WORK en Payroll-bron

- Read-only Core TEST-readback vond voor Mars op 2026-10-27 10 effectieve salarisregels van type `PERIODIC_FIXED` en **0** effectieve `HOURLY_VARIABLE`-regels met uurtarief. Daarom is geen AW_WORK-mapping naar `PAYFULL02_VARIABLE_REGULAR_WAGE` aangemaakt: zo'n mapping zou vaste loonbetaling kunnen dubbelen. De bron blijft veilig `SOURCE_GAP`.
- De bestaande provider-/rekencontracten blijven leidend. Er is geen nieuwe Payroll-componentverwerking, tarief, factor of fiscale/pensioenaannname geïntroduceerd. FOUR_WEEKLY-bronidentiteit blijft contractueel ondersteund; de brutonetberekening blijft `FOUR_WEEKLY_PAYROLL_CALCULATION_NOT_VALIDATED`.
- TVT blijft via de bestaande verlofledger begrensd. In deze administratie is geen toepasselijke overwerk/TVT-regeling bewezen; geen TVT-opbouw, opname of verval is live getest.

### Uitgevoerde checks en blokkades

| Gate | Resultaat |
| --- | --- |
| W04-, Actual Work-, Payroll-source-, Payroll-calculation-, correctie- en TVT-contracttests | **136/136 PASS**, 12 bestanden; nieuwe revisieapproval-migratiecontracttest **5/5 PASS**. Herhaalde approval en stale revision zijn getest op API/service-contractniveau; een correctie-race levert contractueel HTTP 409. Gelijktijdige PostgreSQL-transacties zijn niet live getest. |
| TypeScript HR Suite | **PASS** (`npm run type-check -w @liquid-hr/hr-suite`). |
| ESLint gewijzigde HR Suite-bestanden | **PASS**. |
| i18n | **PASS**, 43 NL/EN namespaces. |
| Rootbuild HR Suite + Control | **PASS** (`npm run build`); ook client-boundary- en function-tracechecks PASS. Focus en `next-env.d.ts` zijn gehashd hersteld en byte-identiek behouden. |
| Volledige HR Suite-suite | Niet herhaald; AA-TEST vraagt voor een feature-closeout gerichte feature-/integratiegates en geen automatische full suite. De eerder gevalideerde brede suite is niet als nieuw bewijs voorgesteld. |
| Core TEST-migratie | **Niet toegepast.** Read-only preflight bevestigde dat tabel/RPC/trigger nog ontbreken, dat er 0 bestaande Payroll-vrijgaven zijn en dat de nieuwe FK's passen bij bestaande unieke sleutels. Drie `supabase_apply_migration`-aanroepen eindigden met `Invalid or expired requestState`; readback bevestigde dat de Core-schema's ongewijzigd zijn. |
| HR Admin-browser, RLS- en persona-negatieven | **OPEN.** De bestaande lokale launcher mist de centrale TEST-configuratie en persona-credentialbron; de HR Admin-flow en negatieve Employee/Manager/foreign-tenant calls zijn niet opnieuw uitgevoerd. De vorige browserproef is alleen historisch bewijs voor de ongewijzigde codebasis. |
| AW_WORK-bronconsumptie | **HOLD / SOURCE_GAP.** Er is geen passende variabele-loonbron, dus geen Payroll-vrijgavehash of bronprovider-readback voor Mars aangemaakt. |

De synthetische Core-records en hun append-only correctie-/revisiehistorie zijn behouden. Focus, `.tool-home`, `next-env.d.ts` en lokale configuratie zijn buiten de W04-commit gehouden.

**Besluit:** PR #51 blijft **HOLD** en is niet bijgewerkt/gepusht. De lokale code- en buildgates zijn groen, maar de niet-toegepaste Core-migratie, ontbrekende HR Admin-persona/browser/RLS-proef en ontbrekende geschikte AW_WORK-salarisbron verhinderen de gevraagde volledige Payroll-keten. TEST-release blijft **HOLD**. Geen merge, deployment, Payroll-run, wijziging aan historische loonstrook, nieuwe branch of nieuwe PR.

### Aanvullende afsluitcontrole — 27-10-2026

- Core TEST bleef `ACTIVE_HEALTHY`. De twee bestaande W04-migraties staan geregistreerd; de nieuwe migratie `20261027163113_actual_work_payroll_revision_approval` ontbreekt. De officiële derde migratiepoging eindigde met `Invalid or expired requestState`. Post-readback bevestigde dat de approval-tabel, RPC en release-trigger ontbreken en dat de data onveranderd bleef: 0 releases, 21 bronentries en 33 revisies.
- De bestaande `scripts/start-test-worktree.ps1 -Mode Development -PreflightOnly` meldde dat de centrale lokale TEST-configuratie ontbreekt. `scripts/check-test-personas.ps1` meldde dezelfde blokkade voor de persona-credentials; Lisa, Jaap en Frits staan daardoor als `BLOCKED`. Er zijn geen configuratiebestanden of credentials aangemaakt of gelezen.
- De bestaande gehoste browser is ingelogd als Maya in Manager-context; geen HR Admin-schrijfproef is via die sessie uitgevoerd. `gh pr view` kon door ontbrekende GitHub CLI-authenticatie (HTTP 401) geen metadata leveren; de verbonden GitHub-readback bevestigde PR #51 als **open, Draft en mergeable**, base `main` op `11ba924b4a726431ae7928cfd8d2201d738893b4`, head `work/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026` op `50fd2b71795c451fee71b62069c16e0be9c8d5ff`. De PR-body noemt nog de oudere kandidaat. Lokale codecandidate blijft `8ba0e46de6e09211598e2697bfbc72a4c0650784`. Er is niet gepusht en PR #51 is door deze run niet aangepast.
- De lokale contract-/buildresultaten hierboven zijn hergebruikt; deze afsluitcontrole wijzigde geen productcode en voegde geen nieuw testresultaat toe. Integratie en TEST-release blijven **HOLD**.

### PAY-W04-INTEGRATION-RELEASE-CANDIDATE-05 — 27-10-2026

**Stand:** PARTIAL; PR-integratie HOLD; LiquidHR TEST-release afzonderlijk HOLD. De codekandidaat vóór deze documentatie-update was `a158b60671d556d010ec58ba8ce1d757cf6f3e16`, op de bestaande branch `work/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026`. Sinds de geteste productcode is alleen documentatie gewijzigd.

#### Databases en migratie

- De read-only projectlijst bevestigde Core TEST `wnpfloqpjvaacobppbpk` en afzonderlijk Payroll Lab TEST `jhgeriucbkfarxiudzfy`, beide `ACTIVE_HEALTHY`; de scheiding is behouden.
- Core-migratie `20261027163113_actual_work_payroll_revision_approval.sql` heeft SHA-256 `400fff4c24e68fe6bf7c06190bf493428c4913d3087e543117c9de25563856bf`. Vooraf ontbraken de migratieregistratie, approval-tabel/RPC en releaseguard; de nieuwe objecten waren afwezig en de bestaande bron had 21 entries, 33 revisies en 0 vrijgaven.
- De officiële `supabase_apply_migration`-aanroep is in deze run eenmaal uitgevoerd na een geslaagde geautoriseerde host-preflight. Die call eindigde met `Invalid or expired requestState`. Volgens de stopregel is de call niet herhaald. Read-only postcheck bevestigde opnieuw: migratie ontbreekt, approval-tabel/RPC/releaseguard ontbreken, 21 entries, 33 revisies, 0 vrijgaven. Geen Core- of Payroll Lab-schema-/datamutatie door deze run.

#### Runtime en browser

- De officiële launcher bevestigde dat de bestaande centrale Core/Payroll TEST-configuratie en Lisa/Jaap/Frits-persona-credentialvelden aanwezig en geldig zijn; waarden zijn verborgen gebleven. De eerdere sandboxmelding dat ze ontbraken was een environment-probe false negative.
- De bestaande Next-server op `127.0.0.1:3010` is aantoonbaar gestart vanuit precies deze W04-worktree. Een tweede start op vrije poort 3012 stopte zelf toen Next de bestaande devserver-lock voor deze worktree aantrof; geen bestaand proces is gestopt.
- Lokale browsernavigatie naar `/actual-work/payroll?periodStart=2026-10-01` renderde de werkcontextkiezer. Dit bewijst geen HR Admin-identiteit of W04-write. De officiële persona-wrapper voltooide de config/persona-preflights maar gaf geen browserassertions terug; de rechtstreeks gestarte bestaande browsercheck liep vast zonder resultaat. Er zijn geen W04-browserwrites, rol-/scopeproeven of HR Admin-accorderingen uitgevoerd.
- Daardoor blijven database-RLS, HR Admin-invoer/CSV/import/correctie/heraccordering/vrijgave, Manager/Employee/foreign-tenant-negatieven en live Payroll-sourceconsumptie **OPEN**. Geen salarisrun, FINALIZED-run of PDF is gewijzigd.

#### Mars-componentvoorwaarde

- Read-only Payroll Lab-check bevestigde dat `PAYLAB GC-NL-001 — Mars BV` actief is. De huidige Mars-readback bevat geen arrangement-assignmentregels en geen `PAYFULL02_VARIABLE_REGULAR_WAGE`-versie in `customer_component_versions`; de eerdere effectieve loonbronreadback toonde 10 `PERIODIC_FIXED`-relaties en 0 effectieve `HOURLY_VARIABLE`-relaties. Geen variabele casus of mapping is aangemaakt.
- De bestaande bron blijft daarom `SOURCE_GAP`. Zonder geldige variabele-urenrelatie, gekoppelde uurloonbron en toepasselijke bestaande componentconfiguratie kan geen juiste input, periode-output of geen-dubbele-betalingclaim worden bewezen. De vaste Mars-salarisregels zijn niet gewijzigd.

#### Verificatie en besluit

| Gate | Resultaat |
| --- | --- |
| Gerichte W04-heraccorderings-, sourceprovider-, Payroll-kalender- en migratiecontracttests | **81/81 PASS in 4 bestanden**, uitgevoerd op code-HEAD `a158b60671d556d010ec58ba8ce1d757cf6f3e16`. |
| Bestaande featurekwaliteit | Eerder op dezelfde, ongewijzigde productcode: **136/136 gerichte tests**, TypeScript, ESLint, i18n, rootbuild HR Suite + Control en migratiecontracten PASS. Niet opnieuw uitgevoerd omdat daarna alleen docs veranderden. |
| Vierweken-/jaargrens en salarisbroncontract | Bestaande contracttests blijven PASS; geen live Payroll-consumptie of fiscale vierwekenberekening. `FOUR_WEEKLY_PAYROLL_CALCULATION_NOT_VALIDATED` blijft fail-closed. |
| Supabase apply/RLS | **HOLD** — de nieuwe Core-migratie kon niet worden toegepast; geen live RLS/autorisatiebewijs voor de nieuwe tabel/RPC/releaseguard. |
| Geauthenticeerde browser/persona-acceptatie | **OPEN** — geen W04-actie/assertions ontvangen uit de bestaande persona-browsercheck. |
| Mars `AW_WORK`-output | **SOURCE_GAP** — geen valide variabele looncasus of effectieve componentversie; er is geen fallbackmapping geschreven. |
| PR #51 | Een normale fast-forward push naar dezelfde branch slaagde (`50fd2b7` → `25d00cf`). De PR-body is bijgewerkt; PR blijft open Draft en API-mergeability is `true`. GitHub retourneert geen checks of statuscontexten, dus dit is geen CI-bewijs. GitHub compare bevestigt 12 commits ahead, 0 behind `main` (`11ba924b`) en 58 PR-bestanden; er zijn geen Focus-, `.tool-home`- of `next-env.d.ts`-bestanden opgenomen. Vercel gaf geen deployment terug voor de gepushte SHA; er is geen handmatige deployment gedaan. |

**Integratieadvies: HOLD. TEST-release: HOLD.** De codecontracten en relevante lokale regressies zijn groen, maar heraccordering is niet geactiveerd op Core TEST, de geauthenticeerde W04-browserketen is niet bewezen en er is geen ondersteunde Mars `AW_WORK`-Payroll-input. Geen merge, handmatige deployment, nieuwe branch/database, Payroll Lab-write of echte/definitieve Payroll-run.


### PAY-W04-INTEGRATION-RELEASE-CANDIDATE-05 — geauthenticeerde live follow-up, 27-10-2026

**Uitkomst: PARTIAL; integratie HOLD; TEST-release HOLD.** De productcode is ongewijzigd ten opzichte van de eerder geteste kandidaat (`a158b60671d556d010ec58ba8ce1d757cf6f3e16`); branch-HEAD vóór deze documentupdate was `d14a453c4df2a2abb68ba651ea4341f7946d4e1b`.

- **Omgeving:** de bestaande lokale TEST-app op `http://localhost:3010` is geopend in echte Chrome. Via de officiële lokale HR Admin-login en bestaande contextkeuze is Mars BV geselecteerd. De bestaande Payroll Lab-open maandperiode was oktober 2026, `83ce4ce4-35cc-445f-8e7d-265099f12977` (1 t/m 31 oktober). Geen kalender- of periodefixture is aangemaakt.
- **Reviewblokkade:** de Payroll-urenpagina bereikte de reviewservice, maar `GET /api/actual-work/payroll?period=83ce4ce4-35cc-445f-8e7d-265099f12977` gaf HTTP 400 `ACTUAL_WORK_PAYROLL_OPERATION_FAILED`. Read-only schema-readback bevestigde dat de Core-migratie `20261027163113_actual_work_payroll_revision_approval` en de approval-tabel/RPC ontbreken. De officiële migratieaanroep eindigde met `Invalid or expired requestState`; volgens de stopregel is deze niet opnieuw geprobeerd. Daarom zijn reviewlijst, accordering, correctie/heraccordering en Payroll-vrijgave in deze run niet via de UI bewezen.
- **CSV API-acceptatie met HR Admin-sessie:** preview van één geldige synthetische regel plus een niet-bestaande medewerker gaf HTTP 200; de ongeldige regel werd afgewezen met `ACTUAL_WORK_CSV_EMPLOYEE_NOT_FOUND`. Bevestiging maakte één `PENDING`-registratie aan: ID `04545e82-5ae8-4e57-bb1a-815a66a72d8b`, 0,25 uur `AW_WORK` op 24-10-2026, expliciet toegewezen aan 2026-10-01, bronreferentie `PAY-W04-RC05-20261027-CSV-001`. Herhaling gaf dezelfde entry-ID en `duplicate=true`; er ontstond geen tweede boeking. De bestaande revision-audit bevat CREATE/revisie 1. Deze geautoriseerde synthetische Core TEST-data is append-only en blijft behouden.
- **Database- en Payroll-controle:** Core TEST readback veranderde van 21 entries/33 revisies/0 releases naar 22 entries/34 revisies/0 releases. Approval-objecten blijven afwezig. Payroll Lab TEST is alleen gelezen en ongewijzigd. Mars heeft geen effectieve variabele-urencomponent; er is geen mapping of Payroll-release geschreven en `AW_WORK` blijft `SOURCE_GAP`. Vierwekenberekening blijft `FOUR_WEEKLY_PAYROLL_CALCULATION_NOT_VALIDATED`. In deze Mars-administratie is geen toepasbare TVT-regeling bewezen; TVT-runtime is niet getest.
- **Autorisatie:** de positieve proef gebruikte de bestaande geauthenticeerde HR Admin-sessie zonder rolbypass. Negatieve Manager-, Employee- en vreemde-tenantproeven voor de nieuwe approval-RPC/RLS zijn niet uitgevoerd; dit blijft OPEN. Bestaand app-level testbewijs is geen live database-RLS-bewijs.
- **Kwaliteit:** de gerichte contractset blijft 81/81 PASS op code-HEAD `a158b60671d556d010ec58ba8ce1d757cf6f3e16`; de eerder gerapporteerde 136/136 regressies, TypeScript, ESLint, i18n en rootbuild zijn hergebruikt omdat geen productcode veranderde. Geen Payroll-run, release, FINALIZED-record of salarisstrook gewijzigd.
- **PR #51:** bestaande Draft PR is open en GitHub rapporteert `mergeable=true`; vóór deze documentupdate remote HEAD was `d14a453c4df2a2abb68ba651ea4341f7946d4e1b`. GitHub retourneert geen checks/statuscontexts; mergeability is geen CI-bewijs.

**Besluit:** integratie HOLD totdat de approval-migratie via de officiële geldige geautoriseerde route is toegepast en nagelezen, en HR Admin-review/goedkeuring/correctieherbeoordeling plus RLS-negatieven slagen. AW_WORK-consumptie blijft afzonderlijk SOURCE_GAP wegens ontbrekende geldige variabele-looncomponent. TEST-release HOLD. Geen merge of handmatige deployment.


### PAY-W04 — aanvullende persona-autorisatieproef, 27-10-2026

Via dezelfde lokale TEST-app en de bestaande afgeschermde `/local/personas`-wisselaar is HR Admin teruggezet en daarna zijn de bestaande Manager- en Employee-persona's gebruikt. Er zijn geen credentials getoond of accounts aangemaakt.

- Manager: `GET /api/actual-work/payroll?period=83ce4ce4-35cc-445f-8e7d-265099f12977` leverde de expliciete weigering “Payroll uren beheren is alleen beschikbaar voor HR Admin.”
- Employee: dezelfde review-GET leverde “Je hebt onvoldoende rechten voor deze actie.” Direct openen van de Payroll-urenwerkplek toonde “Nog geen toegang”.
- Dit zijn live app-layer weigeringen voor leesverzoeken. Er is geen POST-accordering/vrijgave als Manager of Employee gedaan en geen database-RLS/RPC-proef uitgevoerd. Buiten-tenant- en buiten-administratie-negatieven blijven OPEN.
- De proef veranderde geen Actual Work-, Payroll- of verlofdata. De openstaande Core-migratie blijft de HR Admin-review blokkeren; eerdere synthetische CSV-entry blijft PENDING.

**Bewijskracht:** Manager/Employee kunnen via de geteste GET-route de Payroll-urenreview niet lezen; dit bewijst op zichzelf niet de POST-vrijgaveguard of Postgres RLS. Integratie en TEST-release blijven HOLD.


### PAY-W04 — administratie-scopeproef, 27-10-2026

De bestaande lokale HR Admin-owner (`TENANT_ADMIN`) is in HR-groep Planeten actief gemaakt met Jupiter BV. Een read-only request naar de W04-review met het open Mars-periode-ID `83ce4ce4-35cc-445f-8e7d-265099f12977` werd geweigerd als `ACTUAL_WORK_PAYROLL_PERIOD_UNAVAILABLE`. De service controleert eerst of de periode-ID in de periodelijst van de actuele administratie bestaat; bij afwezigheid stopt de request vóór de Actual Work-entryquery. Er zijn dus geen Mars-bronregels gelezen of gewijzigd vanuit Jupiter. Dit bewijst de applicatiescope voor een vreemde administratie binnen de groep, niet de onderliggende database-RLS. De beschikbare contextkiezer toonde alleen contexten binnen De Sterren holding; een vreemde-tenantpersona/context was niet beschikbaar en blijft OPEN.


### PAY-W04 — service-autorisatietest voor Payroll-mutaties, 27-10-2026

- De bestaande `payroll-work-hours-service.test.ts` bevat nu vier gerichte gevallen: Manager/Employee × approve/release. Elk gebruikt een geldig request en een gemockte permissieprojectie die zelfs `salary:write` bevat, zodat de expliciete HR Admin/TENANT_ADMIN-rolguard wordt getest.
- De tests eisen status 403 en nul Supabase `from`-/RPC-calls vóór weigering. Dit is servicecontractbewijs; het vervangt geen live POST- of PostgreSQL-RLS-proef.
- Resultaat: **19/19 PASS** in het servicebestand; HR Suite TypeScript **PASS**; ESLint op het gewijzigde testbestand **PASS**. De eerste teststart stopte vóór collectie met Windows `EPERM` in de sandbox-Temp-map; de gerichte rerun verzamelde en slaagde voor alle tests.
- Er is geen productcode gewijzigd. De nieuwe tests bewijzen geen toepassing van de ontbrekende Core-migratie, geen runtime-heraccordering en geen Payroll-consumptie.


### PAY-W04 — Payroll Lab-componentpreflight, 27-10-2026

Een read-only inventaris bevestigde dat `public.customer_component_versions` RLS heeft en zeven klantcomponentversies bevat. Alle zeven staan op `DRAFT`; de zes aanwezige componentcodes zijn `CUSTOM_*`. Er is geen `PAYFULL02_VARIABLE_REGULAR_WAGE`-klantcomponentversie aangetroffen. De bestaande Payroll-code ondersteunt deze reguliere variabele-urencomponent met `HOURLY_RATE_X_HOURS`, maar dit is geen bewijs van een effectieve Mars-configuratie.

De eerdere read-only Mars-inspectie vond geen geschikt variabel-urencontract of effectief uurloon. Er is geen fictief uurloon, componentmapping, medewerker of dienstverband aangemaakt. De W04-review-/mappingwerkplek kan door de ontbrekende Core approval-migratie niet normaal worden gebruikt. Daarom blijft `AW_WORK` `SOURCE_GAP`; er is geen Payroll-berekening of consumptie bewezen.
