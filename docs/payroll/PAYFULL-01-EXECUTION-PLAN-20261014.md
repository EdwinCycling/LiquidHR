# PAYFULL-01 — eerste geïntegreerde, volledige Payroll-verwerkingsflow

**Status per 14 oktober 2026: IN PROGRESS / LOKAAL UI BEREIKBAAR.** De gebruiker heeft PAYFULL-01 expliciet gestart en via screenshots aangetoond dat de lokale HR Suite op `127.0.0.1:3010` het Payroll Lab en salarisadministratieschermen toont. Dit bewijst **niet** dat batchberekening, integratie of live payrollacceptatie voltooid is. Dit plan is geen zelfstandig remote-write-mandaat of releasebesluit.

**Besluit:** grotere verticale bouwslagen in plaats van steeds één losse migration/service/test. Eén Payroll-werkstroom binnen `apps/hr-suite`, lokaal zichtbaar en te accepteren vóór een gezamenlijke Vercel TEST-release. Geen Docker, geen tweede Payroll-productapp. Leidende architectuur: [AA-PAYROLL](../AA/AA-PAYROLL.md); uitvoering en gates: `AGENTS.md`, [AA-OP](../AA/AA-OP.md), [AA-TEST](../AA/AA-TEST.md), [AA-REL](../AA/AA-REL.md). Dit plan vervangt geen gedateerde acceptance evidence.

## 1. Wat nu feitelijk bewezen is

| Spoor | Laatst gecontroleerd bewijs | Huidige grens |
| --- | --- | --- |
| Payroll Component Graph Engine en NL-2026-package | Versie `NL-PAYROLL-2026@2026.1` en een beperkte witte-maandtabelcase draaien in integratietests. Bruto € 4.000, loonheffing € 818,67, € 3.181,33 **na loonheffing**. | Dat bedrag is **geen volledig netto**. Pensioen, overige inhoudingen, werkgeverslasten/reserveringen en bredere fiscaliteit zijn niet integraal bewezen. |
| Generieke Core-backed berekening | `work/PAYCALC-REAL-01-20261013`, geverifieerde head `432acdf7c0d42423d1a8b2b5bc04e1eaabe4bdc0`; server-only `calculateEmployeePayroll`, hashgebonden Core-broncontrole, conceptrevisie-/idempotentiepaden en gescheiden-database-SQL-tests. Codex rapporteerde 3.027 tests PASS / 8 SKIP. | **BUILT ON BRANCH / LIVE TEST HOLD**. Nog geen daadwerkelijk opgeslagen nieuwe generieke Core-berekening; geen Payroll Professional-schermactie. Branch kan na dit verslag veranderen. |
| Schema | Core `20261013150000_core_employment_payroll_tax_profiles.sql` en Payroll Lab `20261013120000_paycalc_real01_generic_input_reference.sql`, afzonderlijk getest met PGlite. | Op 14 oktober vóór dit plan **niet** remote toegepast. Core en Payroll Lab zijn aparte Supabase-projecten: geen cross-database foreign keys/SQL-joins. |
| Bestaande Payroll-historie | Lisa heeft een persisted `FINALIZED`-run, Jaap `CONCEPT`, Frits drie historische `FINALIZED`-runs; source employee/employment-ID's zijn read-only bevestigd. | Bestaande historie is **regressiereferentie, geen vrij mutatiecohort**. Frits' trace-label 'Jan'/PFZW-brongat blijft OPEN. |
| Permanente lokale TEST-persona's | PR [#31](https://github.com/EdwinCycling/LiquidHR/pull/31), PAYTEST-AUTH-01B; bestaande Lisa-Auth/ESS-link en lokale credentialvoorziening deels bewezen. | **PARTIAL/BLOCKED**: Jaap en Frits missen nog Auth-user/employee-link; Lisa's negatieve cross-employee-salarisprobe en PDF-flow zijn OPEN. Controleer de actuele PR-head voordat dit als afgerond geldt. |
| Product-UI | Bestaande Payroll Lab, PAYRUN01-documentketen en ESS-componenten kunnen als basis worden hergebruikt. | Multi-employee-generieke berekenactie, volledige review/finalize en aantoonbare end-to-end PDF→ESS moeten nog geïntegreerd worden. |

Deze momentopname is geen allesomvattende lijst van wettelijke NL-payrolldekking. Werkelijke acceptatie moet steunen op bron- en berekeningsevidence uit de dan actuele code en databases.

## 2. Wat we met PAYFULL-01 werkelijk opleveren

Eén **volledig ondersteunde en correct afgebakende** NL-2026-verwerking voor een synthetische administratie/periode:

1. Payroll Professional kiest geautoriseerde administratie, tijdvak en meerdere dienstverbanden; opent één idempotente periode.
2. Een server-side orkestrator leest per medewerker zijn geldige Core-bron, fiscale bron en IKV-koppeling; onbekende bron/regeling = zichtbaar `SOURCE_GAP` of `UNSUPPORTED`, **geen verzonnen nul**.
3. De generieke engine berekent de wettelijke en contractuele componenten van de gekozen ondersteunde case: bruto, inhoudingen, fiscaal correcte loonheffing, toepasselijke pensioen-/werknemerspremies, netto, werkgeverslasten en relevante reserveringen/cumulatieven. Een component die niet van toepassing is, vereist expliciet bewezen niet-toepasselijkheid; ontbrekende parameters blokkeren een volledige claim.
4. Persisteer per dienstverband immutable source snapshot, inputset, run, componentresultaten, controls en trace, mét versie-, input- en resulthash. Retry met dezelfde inputs is idempotent; bronwijziging leidt naar een nieuwe conceptrevisie.
5. De professional ziet een werklijst, totalen, uitzonderingen, voor/na revisies en geldige `CONCEPT → REVIEWED → FINALIZED`-overgangen. Een medewerkerfout besmet de andere resultaten niet; partiële verwerking en herstelpad worden inzichtelijk geregistreerd.
6. Alleen volledig gecontroleerde `FINALIZED`-resultaten genereren de correcte Standard A4-loonstrook. De geautoriseerde medewerker ziet zijn **eigen** definitieve gegevens en document in ESS. Dossier-/PDF-autorisatie sluit cross-employee-toegang uit.
7. Na finalisatie blijft historie immutable; opvolgende wijzigingen vereisen een expliciete correctieroute. Geen betalingen/SEPA, echte loonaangifte, klantproductie of impliciete finalisatie in PAYFULL-01.

**Definitie 'volledige run':** volledige reken- en verwerkingsketen voor het **bewezen ondersteunde scenario**, niet volledige Nederlandse landelijke dekking. `bruto - loonheffing` zonder bevestigde overige componenten mag niet als volledig nettoloon worden verkocht.

## 3. Grotere geïntegreerde uitvoeringsblokken (bouwslag gestart; deelstappen vereisen de passende gates)

### A — Engineering-integratie en gecontroleerde TEST-foundation

- Laat de nog lopende PAYCALC-REAL-01-run tot een veilig checkpoint komen; neem commits en open gates over, **onderbreek niet zonder noodzaak**.
- Integreer benodigde code uit bestaande Payroll/PAYCALC-, PAYDOC-/PAYESS- en personea-sporen op een nieuwe gecontroleerde PAYFULL-integratiebranch vanaf actuele `main`; cherry-pick of merge niet blind en raak beschermde andere worktrees niet aan.
- Kies een **aantoonbaar** synthetisch cohort. **Nieuwe read-only Core/Payroll Lab-bevinding, 14 oktober:** PAYCALC-REAL-01C is als docs-checkpoint gepusht op `c0c7f1faf782e75073e5ee4681ebf1047f168842` zonder TEST-writes. Noah UUID `22222222-2222-4222-8222-222222222222` bestaat in De Sterren holding / Planeten en heeft een bevestigd oktober-dienstverband, één READY-IKV met geldige employment-link en een ACTIVE Payroll Lab-administratie; een directe database-inventaris toont **nul** Payroll Lab-source snapshots/runs voor hem. Zijn in oktober geldige EUR-maandsalarisregel gebruikt echter `MINIMUM_WAGE`, met **geen expliciet fulltime-/parttimebedrag**. De oudere `SCALE_WITH_STEPS`-salarisregel met expliciet bedrag dekt oktober niet. **Noah is daardoor geen geschikte ongewijzigde eerste generieke rekenfixture voor de huidige vaste-maandsalarisscope.** Selecteer een andere **aantoonbaar synthetische** medewerker met één passende IKV, geldig vast EUR-maandloon en een bewezen bevoegd HR Admin-/fiscaal-broncontract. De read-only database-inventaris vond technisch mogelijke alternatieven, maar heeft hun herkomst en volledige fiscale geschiktheid niet bewezen. Dit is database-metadata/evidence en vervangt geen ingelogde, geautoriseerde Core-servicetest.
- Niet-.test-e-maildomeinen bewijzen geen echte personen, maar projectnaam 'TEST' bewijst ook niet dat **alle** data synthetisch is. Schemawijzigingen hebben projectbrede impact. Voer Core- of Lab-migraties uitsluitend uit wanneer het concrete geautoriseerde omgeving-/datamandaat en securitypreflight dat dekken; anders parallel ontwikkelen met geïsoleerde synthetische schema-/datasettests.
- Apply en readback van beide gescheiden forward-only migraties vormen één afgebakende gecontroleerde acceptatiestap; werkelijke toepassing is bij dit document **niet geautoriseerd of uitgevoerd**.

### B — Fiscale volledigheid + batchberekening + professional-UX

- Bouw voor een afgebakende NL-2026-case de ontbrekende, officieel herleidbare componenten en onafhankelijke golden/oracle-cases, met geldbedragen op exacte decimalen en wettelijke afrondmomenten.
- Lever een admin-/periode-gebaseerde batchrun die meerdere employments rekent en per medewerker `CALCULATED`, `INCOMPLETE`, `SOURCE_GAP`, `UNSUPPORTED` of `BLOCKED` toont, inclusief gerichte herstelactie.
- Werk vanaf bestaande LiquidHR-primitives, één sidebar-entry `Payroll Lab`, heldere runstatus, afwijkingen, detailtrace, idempotent revisiebeheer en expliciete goedkeuringsrechten.
- Voeg revalidatie en foutafhandeling toe voor de aparte Core/Lab-schrijfgrens en gelijktijdige runs. Bewijs failure/retry-scenario's; geen stille partiële 'SUCCESS'.

### C — Lifecycle, loonstrook, ESS en echte acceptatie

- Toon een exacte salarisberekening en teruggelezen opgeslagen bedragen voor ten minste **twee** aantoonbaar ondersteunde synthetische varianten plus één expliciet geblokkeerde uitzondering.
- Doorloop `CONCEPT → REVIEWED → FINALIZED` uitsluitend met geautoriseerde reviewer en **complete** scenario's; bewijs een PDF en de eigen ESS-ervaring zonder extra rechten.
- Test desktop en mobiel, self-only/Manager/Admin-scope, negatieve cross-employee en cross-administratieprobes, bestaande Lisa/Jaap/Frits-historie read-only en correcte onvolledigheidslabels.
- Houd een onafhankelijk acceptance-verslag aan met precieze Core/Lab-objecten, migratieversies, gekozen synthetische bron, regelpakket, input-/resultaat-hashes, amounts, PDF/ESS en blocking gaps.

### Vervolg — niet in PAYFULL-01 als vanzelfsprekend inbegrepen

**PAYFULL-02:** bredere pensioen-/cao-regelingen, variabele mutaties, meerdere IKV's, bijzonder loon, werkgeverspremies/VCR en aanvullende NL-fiscale situaties. **PAYFULL-03:** Continuous Payroll / Payroll by Exception met bron-events, opnieuw rekenen, uitzonderingenbak, correcties en serverless scheduling. Die opvolgers zijn **gepland, niet gestart**.

## 4. Lokale live-meekijkafspraak (zonder Vercel per codewijziging)

De gebruiker hoeft geen PowerShell-commando's handmatig te bedienen. **Na expliciete start van PAYFULL-01** start Codex zelf in zijn Windows-worktree de bestaande beveiligde lokale launcher in een **blijvende terminal**:

```powershell
.\scripts\start-test-worktree.ps1 -Mode Development -PayrollAcceptance -Port 3010
```

- Verwacht lokaal `http://127.0.0.1:3010` **alleen als de launcher werkelijk op 3010 luistert**; bij conflict kies Codex bewust een vrije poort (`-Port`) en meldt de exacte URL, worktree en head-SHA. Poort 3000 kan eveneens, mits vrij.
- Development gebruikt de bestaande Next.js-devserver met code-refresh; dezelfde app toont Payroll Lab, Payroll Professional en ESS zodra deze routes werken. Geen Docker, geen afzonderlijke Payroll-app, geen Vercel-deploy voor elke iteratie.
- De launcher leest uitsluitend de centrale, beveiligde lokale TEST-runtimeconfig. Secrets blijven verborgen; de twee Supabase-projecten blijven **remote**. Lokaal draaien geeft géén toestemming voor willekeurige remote databasewrites.
- Laat serverproces draaien zolang een beheerde Windows-terminal/sessie actief is. Codex kan niet garanderen dat een tool-/agentproces blijft bestaan nadat de terminal wordt gesloten. Nooit een andere agentserver/poort stilzwijgend beëindigen of hergebruiken zonder eigenaarschapscontrole.
- De bestaande lokale Test Auth/role-switch werkt alleen onder de expliciete Development-, loopback- en projectguards; hosted Vercel Preview en Production blijven gesloten voor Test Auth.
- Controleer `/login`, relevante Payroll-routes, statuscode en geautoriseerde context vóór een gebruiker wordt gevraagd mee te testen. **Er is bij het schrijven van dit plan geen lokale PAYFULL-server gestart.**

Zie [lokale TEST-runtime](../delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md) en de dan actuele TEST-personacatalogus in PR #31.

## 5. Acceptatie-/besluitgates

**Code-review:** integratiebranch, gerichte unit/integratie/golden tests, typecheck, changed-area ESLint, i18n, build en relevante server-/client-boundary/securitytests. Grotere Controlled integration/release-gate bij eindkandidaat, niet per kleine wijziging.

**Data- en securitygate:** project/tenant-provenance, expliciete source-owner en synthetische herkomst, scope en RLS, migratie-readback, fiscale verklaring met aantoonbare bron, autorisatieverschillen, geen mutaties op eerdere runs.

**Productgate:** multi-employee-calculatie echt opgeslagen en leesbaar; twee volledige nauw omschreven nettoresultaten, één blocked case; stabiele idempotentie en revisie; expliciete review/finalisatie; juiste PDF; ESS per eigen medewerker; desktop/mobiel; aantoonbare regressie.

**Besluit:** `GREEN` alleen bij alle in-scope kritieke gates. Anders `PARTIAL`/`HOLD` met bewijs en concreet vervolg. Geen merges, deploys of echte klant-/loonbetalingswrites zonder apart passend mandaat.

## 6. Handoff en documentatie-eigenaarschap

- PAYFULL-01 is door de gebruiker gestart en de lokale app is zichtbaar. Dit is **geen** bewijs van volledige batchrun of fiscale acceptatie. PAYCALC-REAL-01 is als apart docs-checkpoint afgerond.
- Bewijs van uitgevoerde slices hoort in `docs/quality/acceptance/runs/`, niet als achteraf herschreven 'GREEN' in dit plan.
- Gedateerde PAYRUN01-, PAYESS-, PAYCALC- en PAYTEST-acceptatierapporten blijven de waarheid voor hun eigen branch/commit.
- De bestaande Draft [Payroll-roadmap PR #28](https://github.com/EdwinCycling/LiquidHR/pull/28) is een eerdere momentopname; deze nieuwe planstatus is een aanvulling. Reconcileer de roadmap bij latere integratie, zonder een lopende Codex-run te overschrijven.
