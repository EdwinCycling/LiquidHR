# PAY-W04-HR-HOURS-TO-PAYROLL-01 — lokaal acceptatierapport

**Datum:** 26-10-2026
**Branch:** `work/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026`
**Start/base:** `11ba924b4a726431ae7928cfd8d2201d738893b4` (PR #50, vanaf `origin/main`)
**Uitkomst:** **PARTIAL — integratie HOLD — TEST-release HOLD**

## Functionele closeout 26-10-2026

**Startpositie:** de bestaande featurebranch stond op verwachte W04-commit `8efaf0f68184c08b26e1af5ad0aeff19b57a7793`, vanaf `origin/main`/PR #50 `11ba924b4a726431ae7928cfd8d2201d738893b4`. De bestaande Actual Work-tabellen, de dag-/periode-invoer, CSV-preview/import, revisie-audit, HR Admin-review en eerste PAYFULL-02-mapping zijn behouden.

**Toegevoegd op dezelfde branch:**

- TVT gebruikt de bestaande koppeling `work_hour_types → leave_type_overtime_work_hours → leave_types(OVERTIME_HOURS)` en het bestaande `leave_balance_buckets`/`leave_accrual_transactions`-ledger. HR Admin-goedkeuring en eerste opbouw zijn één transactie; expliciete vervalmaanden kunnen op uurtype of medewerkeruitzondering worden ingericht. Zonder beleid boekt de RPC niet. Revisies verwerken uitsluitend het urenverschil, herhaalde verwerking is idempotent en type-/medewerker-/dienstverband-/opbouwjaarwijzigingen na TVT-opbouw blokkeren voor ledgerreview. TVT-opname blijft via bestaande verlofverwerking lopen; dat pad is niet in een lokale database uitgevoerd.
- HR Admin selecteert bestaande open Payroll Lab-kalenderperioden op hun ID. `MONTHLY` en 28-daagse `FOUR_WEEKLY`-perioden worden op exacte grenzen gevalideerd; vrijgaven bewaren periode-ID, begin/einddatum, periodiciteit, bronrevisie, mapping, fingerprint, actor en timestamp. Gesloten perioden blokkeren; vierwekenregistraties worden niet verdeeld. Een synthetische servicecase accordeert een periode van 2026-12-21 t/m 2027-01-17.
- De bestaande Payroll-sourceprovider accepteert alleen `(year, month)`. Vierwekenvrijgaven blijven daarom `SOURCE_GAP` met `ACTUAL_WORK_FOUR_WEEKLY_PAYROLL_CONSUMER_UNAVAILABLE`, totdat het Payroll-sourcecontract een periode-ID kan verwerken.
- De bestaande componentbron ondersteunt gewone uren via `PAYFULL02_VARIABLE_REGULAR_WAGE`. Uit te betalen meer-/overuren en toeslaguren, waaronder nachttoeslag, blijven `SOURCE_GAP`; de huidige bron kan geen afzonderlijke componentregels veilig consumeren. TVT- en informatieve typen worden niet automatisch uitbetaald. Geen kloktijden of automatische classificatie toegevoegd.

## Uitgevoerde gates

| Gate | Uitkomst |
| --- | --- |
| Volledige root `npm test` | HR Suite **3.803 PASS / 8 SKIP**, 4 testbestanden overgeslagen; Control **11/11 PASS**; NL-2026 **49/49 PASS**. Daarna is de nieuwe cross-year-periodetest toegevoegd en de volledige servicefile **9/9 PASS** gedraaid. |
| Gerichte W04-/TVT-/bron-/migratieregressies | **83/83 PASS** over 5 bestanden, plus Actual Work batch-/Payroll-fallback/server-only regressies **40/40 PASS**. Beide LF/CRLF-assertions slagen na normalisatie van alleen de ingelezen SQL-regelafbrekingen; inhoudelijke assertions zijn behouden. |
| Root TypeScript | **PASS** voor HR Suite, Control, Payroll Engine, CAO Bench en NL-2026. |
| Root ESLint | **PASS**, 0 fouten en 7 waarschuwingen in bestaande tests. |
| i18n | **PASS**, 43 NL/EN-namespaces met gelijke sleutels. |
| Rootbuild | **PASS** voor HR Suite en Control. HR Suite: 346 routes gegenereerd, Payroll-clientboundaryscan 177 browserassets PASS, PDF-route/function-tracechecks PASS. De buildprovenance registreerde de checkout-HEAD `8efaf0f...` vóór de closeoutcommit. |
| `git -c core.whitespace=cr-at-eol diff --check` | **PASS**; Git meldde verwachte CRLF-normalisatiewaarschuwingen op de bestaande Windows-checkout. |
| Secrets-/migratie-/RLS-/browsergate | Geen geheime waarden gevonden in de gewijzigde featurebestanden. Migratiecontracttests slagen; de migratie is niet toegepast. Lokale Supabase/Docker/Postgres-runtime, centrale TEST-config en bestaande persona-credentials ontbreken; RLS- en geauthenticeerde browseracceptatie zijn daarom **OPEN**. |

## Acceptatiescenario’s na closeout

| # | Resultaat | Bewijs / resterende grens |
| ---: | --- | --- |
| 1 | OPEN — browser/DB | Individuele invoer hergebruikt Actual Work; geen geauthenticeerde achturenregistratie uitgevoerd. |
| 2 | PARTIAL — unit | Dag-, maand- en periodevelden blijven op Actual Work; geen database-readback van maand-/dagregistraties. |
| 3 | PARTIAL — service | Expliciet Payroll-periode-ID, gesloten-period guard en cross-year vierwekenaccordering getest. Payroll-runconsumptie blijft `SOURCE_GAP` door het maand-only broncontract. |
| 4 | PASS — unit | CSV-preview behandelt meerdere medewerkers synthetisch; geen DB/browserimport uitgevoerd. |
| 5 | PASS — unit | Herhaalde CSV-bevestiging en bronreferenties zijn idempotent. |
| 6 | PASS — unit | Ongeldige medewerkers, perioden, uren, kolommen en conflicterende referenties worden afgewezen. |
| 7 | PASS — provider | Niet-geaccordeerde uren zijn geen definitieve Payroll-input. |
| 8 | PARTIAL — contract | HR Admin/RPC-audit en atomaire TVT-goedkeuring zijn statisch en service-side afgedekt; geen PostgreSQL/RLS-readback. |
| 9 | PARTIAL — contract | Correctiereden en revisie/fingerprint leiden tot herbeoordeling; type-/scope-/jaarherclassificatie na TVT-posting blokkeert voor ledgerreview. Ledgertransactie is niet tegen PostgreSQL uitgevoerd. |
| 10 | PARTIAL — provider | Gewone uren gebruiken de expliciet bestaande PAYFULL-02-component. Uitbetaalde meer-/overuren en premiums blijven `SOURCE_GAP`. |
| 11 | PARTIAL — migration contract | TVT-opbouw gebruikt expliciet vervalbeleid en bestaand ledger; geen expiry-default. Databaseopbouw niet live uitgevoerd. |
| 12 | PARTIAL — bestaand pad | TVT-opname blijft aan bestaande verlofaanvraag-/saldoverwerking gekoppeld; geen ledger-runtimeproef. |
| 13 | PARTIAL — classificatie | Door HR gekozen werkurentype wordt gevolgd zonder kloktijden; een aparte nacht-/toeslagcomponent ontbreekt en blijft `SOURCE_GAP`. |
| 14 | PASS — provider | Ontbrekende/conflicterende componentbron blokkeert fail-closed met `SOURCE_GAP`. |
| 15 | PARTIAL — regressie | Geen verlof-/ziektebron of rekenregel vervangen; volledige HR-/Payroll-suite slaagt. Geen geïsoleerde database-readback. |
| 16 | PASS — geen write | Geen Payroll-run, FINALIZED-record of PDF gewijzigd; een historische databasevergelijking is zonder runtime niet uitgevoerd. |
| 17 | PARTIAL — service/contract | Manager wordt server-side geweigerd; de nieuwe RPC vereist HR_ADMIN/TENANT_ADMIN. Employee-/Manager-RLS-sessies ontbreken. |
| 18 | PARTIAL — contract | Tenant-/groep-/administratiescope wordt server-/RPC-side gevalideerd; cross-tenant/-admin RLS-probes ontbreken. |

## Integratie- en releasestatus

- **Integratie: HOLD.** Lokale codekwaliteit slaagt, maar W04-Done is niet bereikt: vierwekenvrijgaven kunnen nog niet in Payroll-runinput worden geconsumeerd; componentmappings voor betaalde meer-/overuren en toeslagen ontbreken; migratieapply/readback, RLS en browseracceptatie ontbreken.
- **TEST-release: HOLD.** Geen migratie, deployment, Payroll-run, salarisbetaling of aangifte uitgevoerd.
- **Featurecommit en Draft PR:** worden na de geslaagde lokale quality gates op deze bestaande branch vastgelegd; er wordt geen nieuwe branch gemaakt.
- De lokale build heeft de gegenereerde Focus-widget tijdelijk gewijzigd. Het artefact is naar de ongewijzigde HEAD-inhoud teruggezet (SHA-256 `A8134B54351065DB6EFF5CBED717511A979AB85118810DA2941195DF8BAEEAEA`); `next-env.d.ts` bleef gelijk (SHA-256 `1B59D4C6B83807DB275D43F3CF2CC8E9323F465FAB764EEA091CC5BECD5BAD37`). Bestaande `apps/hr-suite/.tool-home/` is behouden en niet opgenomen.

**Conclusie:** TVT-ledgerposting, expliciete expiry, HR Admin-flow en periode-ID-vrijgave zijn lokaal geïmplementeerd en door service-/contracttests afgedekt. Payroll-finalisatie voor `FOUR_WEEKLY`, brede componentverwerking en DB-/browser-runtimeacceptatie blijven concrete vervolgblokkades. Geen main-push, merge, gedeelde databasewrite, deployment, historische wijziging of productieve Payroll-run.

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
