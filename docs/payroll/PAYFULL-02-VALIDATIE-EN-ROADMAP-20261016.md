# PAYFULL-02 — handmatige looncontrole en volgende productstappen

**Status 2026-10-16: TWEE VOLLEDIGE TEST-MAANDBEREKENINGEN FINALIZED; TOTALE NL-PAYROLL-DEKKING EN VOLLEDIGE ESS-ACCEPTATIE OPEN.** Dit is een werkdocument, geen release-/compliancecertificaat. Bron: [PAYFULL-02 acceptance](../quality/acceptance/runs/PAYFULL-02-20261015.md), [closeout](../quality/acceptance/runs/PAYFULL-02-20261016-CLOSEOUT.md), actuele read-only Payroll Lab TEST-controle op 2026-10-16.

## PAY-W04 Actual Work → Payroll (26-10-2026)

**Lokale featurebranch: PARTIAL; integratie en TEST-release HOLD.** De geïsoleerde branch vanaf PR #50 implementeert een HR Admin-werkplek bovenop de bestaande Actual Work-opslag: individuele/bulkregistratie wordt behouden, CSV-preview bevestigt alleen geldige regels als `PENDING`, operationele goedkeuring blijft onderscheiden van HR Admin-vrijgave, en de vrijgave bindt revisie + effectieve mapping + inhoudsfingerprint + actor/timestamp. De Payroll-kalendercontracten ondersteunen versioned `FOUR_WEEKLY`-kalenders en onveranderlijke `payroll_periods`; W04 koppelt Actual Work-vrijgaven nog niet aan de periode-ID’s en accepteert alleen de maandreferentie van de huidige source-provider. Vierwekenfeiten worden niet over kalenderdagen of maanden verdeeld. TVT en informatieve types worden niet als loonbetaling vrijgegeven. Omdat de huidige source-input alleen regulier variabel loon kent, worden `PREMIUM` en betaalmapping van `OVERTIME`-typen expliciet als `SOURCE_GAP` geweigerd. Correcties na eerdere vrijgave krijgen `TWK_REQUIRED` en de historische release wordt niet aangepast.

Een correctie van een bestaande registratie vereist ook in een open periode een niet-lege reden. De server controleert individuele en bulkrequests; een deferred databaseconstraint weigert een gewijzigde urenbron zonder corresponderende append-only correctierevisie met actor, timestamp, periode en oude/nieuwe uren.

**Bevestigde bestaande contracten:** `work_hour_types`, `employment_work_hour_entries`, `actual_work_periods` en append-only `actual_work_revisions` blijven de bron en historie. Bestaande invoer-/bulk-/team-, medewerkeruren-, kalender- en instellingroutes zijn hergebruikt. `overtime_type_settings` en `overtime_type_exceptions` blijven de operationele invoerbeperkingen; zij zijn geen loonclassificatie. De koppeling `leave_type_overtime_work_hours → leave_types(OVERTIME_HOURS)` bestaat, maar de huidige `leave/accrual-service.ts` selecteert alleen `entitlement_mode = ACCRUAL` en `post_group_leave_accrual` weigert andere typen. Er bestaat dus geen bewezen TVT-boeking naar `leave_balance_buckets`/`leave_accrual_transactions`; W04 markeert TVT als `SOURCE_GAP` en boekt geen saldo of loon. Een expliciete ledger-/vervalregel en een idempotente TVT-postingroute zijn nog nodig. Betaald/onbetaald verlof, ziekte en gedeeltelijke arbeidsongeschiktheid blijven de bestaande afzonderlijke Payroll-broncontracten; W04 introduceert hiervoor geen nieuwe loonberekening.

**Beperking / SOURCE_GAP:** de bestaande Payroll-composition/provider heeft één expliciet ondersteunde variabele-uurlooncomponent (`PAYFULL02_VARIABLE_REGULAR_WAGE`, `HOURLY_RATE_X_HOURS`). De UI en migratie staan geen vrije selectie van willekeurige componenten toe; unsupported/ambigue component mapping blijft geblokkeerd. De werkgeverscomponentconfiguratie bepaalt fiscale, SV-, pensioen-, vakantiegeld-, reserve- en cumulatieve gevolgen. Er is geen vaste fiscale/pensioenaannname toegevoegd. De bredere multi-component, premium-/toeslagcomponent- en uitbetalingsvarianten zijn dus niet volledig bewezen.

**Nog te bewijzen:** de nieuwe migratie is niet uitgevoerd; Docker CLI bestaat maar de daemon is onbereikbaar, Supabase CLI/`psql` ontbreken en lokale DB-poorten luisteren niet. De officiële TEST-runtime- en persona-preflight is `BLOCKED` omdat de centrale runtimeconfiguratie en Payroll-personacredentials ontbreken. RLS/cross-tenant/cross-administratie en lokale browseracceptatie voor HR Admin/Employee blijven OPEN. Rootbuild, TypeScript, i18n en ESLint slagen; de volledige regressietest heeft twee LF/CRLF-contractfailures in een ongewijzigde directory-migratietest. Zie [PAY-W04-acceptatierapport](../quality/acceptance/runs/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026.md). Geen TEST/remote migration, payrollrun, FINALIZED/PDF-mutatie, merge of deployment vanuit deze branch.

## 1. Wat is echt berekend?

| Scenario (Mars BV, 2026-10) | Bruto | Werknemerspensioen | Fiscaal loon | Loonheffing | Nettovergoeding | Nettoloon | Totale werkgeverskosten | Lifecycle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| DEMO-001, vaste maand | €3.517,00 | €191,93 | €3.325,07 | €1.188,58 | €45,00 | **€2.181,49** | €4.876,74 | FINALIZED |
| DEMO-002, vaste maand | €3.534,00 | €251,72 | €3.282,28 | €1.173,42 | €32,50 | **€2.141,36** | €4.836,83 | FINALIZED |
| DEMO-001, +€500 *regulier* variabel loon | €4.017,00 | €241,93 | €3.775,07 | €1.357,67 | €45,00 | €2.462,40 | €5.592,64 | CONCEPT (niet ESS-definitief) |

De twee FINALIZED-runs zijn `731e2a73-af7c-59d6-af88-5d0455c68374` en `48f47ffd-191c-5cbb-a22a-9061a2b7e5c3`; derde CONCEPT-revisie `ab47136a-a62f-5866-a0d0-3e74b1f1bff4`. Alle drie hebben een opgeslagen `SUCCEEDED`-berekening en resultaat-hash. De twee definitieve runs hebben elk CONCEPT → REVIEWED → FINALIZED en 32/32 PASS-runcontroles. Originele PAYFULL-01-CONCEPT-historie is intact.

**PDF-readback geverifieerd in Payroll Lab TEST op 2026-10-16** (zonder documentbytes/identiteiten bloot te leggen):
- DEMO-001: `PAYSLIP_PDF`, 513.704 bytes, SHA-256 `6d1499151d79ea1ea470dfe5bac1a73b0cecbd34a3ae41ded48acefefe108a2b`.
- DEMO-002: `PAYSLIP_PDF`, 513.406 bytes, SHA-256 `51b8c513b4c6f9b0c5a9e74e36086099d493ec08b9228b997779ae6cee56d977`.

De eerdere 'nul PDF-artifactrecords' in een tussentijdse closeout was een afwijkende momentopname en is **niet** de huidige read-only database-uitkomst. De oorspronkelijke acceptance-documenten blijven historisch ongewijzigd; noteer actuele verificatie apart.

## 2. Hoe zelf bekijken (lokale TEST-app)

Gebruik de werkelijk lopende `127.0.0.1:<poort>`-URL van de PAYFULL-worktree. Een eerdere sessie werkte op poort 3022; **die poort is niet gegarandeerd actief**. Start zo nodig de bestaande beschermde TEST-launcher volgens [runtimehandleiding](../delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md). Vermijd een tweede server op een bezette poort.

1. Open `http://127.0.0.1:<poort>/local/sign-in`, log normaal in met de bevoegde Mars HR Admin.
2. Open `/payroll/runs?period=2026-10`, kies **Mars BV** en oktober 2026. De historische/nieuwe revisies staan naast elkaar.
3. Open de exacte run-details `/payroll/runs/731e2a73-af7c-59d6-af88-5d0455c68374` en `/payroll/runs/48f47ffd-191c-5cbb-a22a-9061a2b7e5c3`. Controleer bruto, alle werknemerscomponenten, netto, werkgeverskosten, cumulatieven, trace, 32/32 controles en FINALIZED.
4. Kies op de run-detailpagina **Opgeslagen PDF downloaden**. De bestaande beveiligde artifactroute is `/api/payroll/runs/<runId>/artifact/PAYSLIP_PDF`; gebruik de normale UI/auth in plaats van een losse ongeauthenticeerde aanroep.
5. Voor ESS: vanuit de lokale Test HR Admin naar `/local/personas`, kies `payroll-demo-002` (beschikbaar), open `/my-salary`; oktober 2026 toont DEMO-002 €2.141,36 en de knop **Downloaden**. De eerdere ESS-download was 513.406 bytes en byte-identiek aan de toenmalige HR Admin-PDF, maar gebruikte volgens PAYFULL-02D nog de dynamische renderer en bewijst niet de nieuwe persistente artifactroute. In PAYFULL-02D levert de route opgeslagen bytes volgens 61 geslaagde gerichte tests; live download/inline preview werd in de ondersteunde in-app browser geblokkeerd. De viewer toont nu na timeout een foutmelding met **Opnieuw proberen**. **Bekijken** blijft dus OPEN; DEMO-001 heeft geen zelfstandige Employee-persona, omdat diens Core-employee al gekoppeld is aan een bestaand account met TENANT_ADMIN-rechten. Die identiteit nooit automatisch vervangen.
6. Het extra €500-geval is **CONCEPT**: alleen via HR Admin-runinformatie beoordelen, niet als definitieve ESS-strook.

Dit is lokale branchfunctionaliteit; PR #33 is Draft, niet naar `main` gemerged en niet opnieuw op Vercel gedeployed.

## 3. Dekkingsgrens

- **Voor twee specifieke scenario's ja:** reguliere volledige maand, witte tabel, standaard Nederland/onder AOW, geen LHK, versiebewuste synthetische pensioen- en werkgeverslasten, cumulatieven en PDF.
- **Voor derde variabele testcase gedeeltelijk:** berekening is opgeslagen maar alleen CONCEPT, geen geaccepteerde definitieve loonstrook.
- **Voor Lisa/Jaap/Frits (Jupiter): niet bewezen als PAYFULL-02 full-net cases.** Bestaande HR/IKV/ESS- en historische runs vormen niet automatisch een volledige nettoloonacceptatie.
- **Nog geen generieke NL-complianceclaim:** deeltijd/gebroken tijdvak, andere tabellen, LHK aan, bijzondere beloning, CAO, ziekte/ZW, oproep, meer IKV's, correctie/TWK, jaaropgaaf, wettelijke aangiften en betalingen missen op deze nieuwe verticale keten brede onafhankelijke end-to-end acceptatie. 2027 heeft geen actief rule package.

## 4. Roadmap na PAYFULL-02 (afgebakend, Luna-Max/één agent)

| Prio | Wave | Resultaat en exit |
| --- | --- | --- |
| P0 | **PAYFULL-02D — ESS/PDF-closeout (PARTIAL)** | Twee persistente artifactrecords geverifieerd. Route levert opgeslagen PDF-bytes en viewer toont bij timeout een foutmelding met retry; echte inline PDF-render en live downloadgelijkheid van de nieuwe route blijven OPEN door browserbeperking. DEMO-001 eigen ESS-identiteit is een apart besluit, geen admin-omkoppeling. |
| P1 | **PAYCASE-03 — variaties** | Nieuwe gecontroleerde TEST-medewerkers/cases: LHK aan/uit, deeltijd/gebroken tijdvak, reguliere variabele beloning en bijzondere beloning, meerdere IKV's; officiële onafhankelijke fiscale oracles en run-/PDF-regressies. |
| P1 | **PAYRUN-03 — payroll by exception** | Herhaalbare maandcyclus, controles/werkvoorraad, correcties en revisies; stabiele manager-/HR Admin-/ESS-grenzen. |
| P2 | **PAYDOC-02 en fiscale jaarafsluiting** | Jaaropgaaf, periodeoverstijgende cumulatieven en 2027-regels na officiële bronset/independent oracle. |
| Later | **Betalingen en loonaangifte** | Alleen na afzonderlijke product-/compliancebesluiten; CONTROL02 XML-import blijft CANCELLED. Geen echte betalings- of aangiftestroom in TEST. |

**Besluit:** niet wachten op volledige fiscale vulling van Mercurius/Noorderlicht/DGA/Hoofdadministratie om de Mars-engine verder te valideren. Blijf ontbrekende autorisaties en ongebruikelijke medewerkerssituaties wel als expliciete OPEN-gevallen registreren. Geen merge/deployment uit deze doc-update.
