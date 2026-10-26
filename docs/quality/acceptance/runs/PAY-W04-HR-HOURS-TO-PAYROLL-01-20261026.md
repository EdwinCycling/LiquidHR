# PAY-W04-HR-HOURS-TO-PAYROLL-01 — lokaal acceptatierapport

**Datum:** 26-10-2026
**Branch:** `work/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026`
**Start/base:** `11ba924b4a726431ae7928cfd8d2201d738893b4` (PR #50, vanaf `origin/main`)
**Uitkomst:** **PARTIAL — integratie HOLD — TEST-release HOLD**

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
