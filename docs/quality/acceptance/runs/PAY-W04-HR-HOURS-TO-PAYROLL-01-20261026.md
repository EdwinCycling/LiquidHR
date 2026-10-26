# PAY-W04-HR-HOURS-TO-PAYROLL-01 — lokaal acceptatierapport

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
