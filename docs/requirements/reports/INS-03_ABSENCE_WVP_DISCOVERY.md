# INS-03 — Verzuim & WVP Insights | discovery en implementatiecontract

**Datum:** 2026-10-29  
**Issue:** [#62](https://github.com/EdwinCycling/LiquidHR/issues/62)  
**Baseline:** GitHub `main` `5b3c445359d2c304fdb94d73b19786e56a8111c4` (INS-01 #57, INS-02 #60 en documentatie #61 gemerged)  
**Status:** **SOURCE-REVIEW PARTIAL — IMPLEMENTATIE NOG NIET VRIJGEGEVEN**  
**Scope:** uitsluitend bestaande GitHub-broncode en migrations read-only onderzocht; geen live Supabase- of browserproef, geen databasewrite, migratie, productcodewijziging of deployment.

## 1. Functionele uitgangspositie

De bestaande Insights-catalogus (`apps/hr-suite/lib/insights/report-catalog.ts`) heeft drie **beschikbare** rapporten: `absence`, `absence-bradford`, `absence-frequent`. De aparte `wvp`-rapportdefinitie is **available=false**. Het bestaande `process-automation`-rapport is beschikbaar maar is een generieke procesprojectie, **geen gevalideerde WVP-wettelijke rapportage**.

De API `apps/hr-suite/app/api/insights/absence/route.ts` ontsluit drie rapporten in JSON en bestaande Excel-export. De bestaande UI en query-/calculatie-/Excel-tests blijven de basis. **Geen tweede framework, geen duplicatie en geen activatie van `wvp` zonder bron-/privacybewijs.**

| Bestaande slice | Reeds aanwezig | Voor uitbreiding eerst bewijzen |
| --- | --- | --- |
| Verzuim | Ziekte-uren/dagen, beschikbare uren/dagen, verzuimpercentage, case-/actieve-case-KPI, maand-/jaartrend, afdeling, medewerkerdetail en Excel | Correcte geautoriseerde populatie, historische contract-/rooster-/plaatsingsnoemer, volledigheid en mutatievrije rapportage |
| Bradford | `S² × D` op bestaande verzuimrijen; banding, zoek/risk-filter, Excel | Definitie `S` als spells versus meldingen, dag-/periodeafbakening, privacy en toestemming per rol |
| Frequent verzuim | Rolling 12 maanden / kalenderjaren, drempel uit `absence_settings`, medewerkerlijst, Excel | Drempel en case/spell-definitie, periodieke historiek, geautoriseerde teamfilter, volledige resultaten |
| WVP | `absence_tasks` en proces/WVP-bronnen in code; Insights-catalogus disabled | Juridische milestone-set, klok, privacy, bewijsvereiste, datakwaliteit, tenant/team-aggregatie en veilige RLS |

## 2. Concrete bevindingen in de code (niet slechts hypotheses)

### INS03-F01 — Rapportage-GET kan databasegegevens muteren — HIGH, ontwerpbesluit vereist

`getAbsenceInsightReport` in `apps/hr-suite/lib/insights/absence-report.ts` roept **voor het ophalen** `supabase.rpc('normalize_expired_absence_cases', ...)` aan. De migrations `20260927100000_abs02_absence_hardening_wvp.sql` en `20260927101500_abs02_absence_lifecycle_self_scope.sql` tonen dat de interne functie met `UPDATE public.absence_cases` `RECOVERY_WINDOW`-records naar `CLOSED` zet en `closed_at`/`updated_at` invult. De migration noemt dit expliciet een lifecycle-update door een toegestane read. Dit is dus een **bewust bestaand ontwerp**, maar geen read-only rapportage. `Bradford` erft dit omdat het `getAbsenceInsightReport` gebruikt. Besluit nodig: lifecycle apart van rapportage-GET uitvoeren, of expliciet en geautoriseerd mutatiecontract; geen stille wijziging in INS-03.

### INS03-F02 — Scope vóór ophalen niet op direct-team allowlist beperkt — HIGH

`absence-report.ts` en `frequent-absence-report.ts` controleren `report-absence:read` en `employee:read` en filteren `employments` op tenant/HR-groep/administratie, maar bevatten **geen expliciete INS-01/INS-02 direct-team employee-allowlist vóór de bronqueries**. `absence_cases` wordt op tenant/HR-groep gefilterd maar niet expliciet op administratie of employee-allowlist; de geretourneerde `absenceCases`/`activeCases`-KPI's worden uit de case-collectie geteld, niet uit de uiteindelijke geautoriseerde employment-rijen. Dat is een aantoonbare applicatie-query- en aggregatie-onduidelijkheid met potentieel cross-administratie-/cross-team-risico; **effectieve RLS-toegang is nog niet live bewezen**, dus claim geen daadwerkelijk datalek. Fail-closed queryscoping, geautoriseerde KPI-populatie en negatieve persona-tests zijn vereist vóór een nieuwe slice of release.

### INS03-F03 — Noemer-/historiekzekerheid niet bewezen — HIGH voor KPI-betrouwbaarheid

`scheduledHours()` valt bij ontbrekend rooster terug op **8 uur per werkdag**; `absenceRate` wordt **0** bij `availableHours = 0`. Dit kan ontbrekende broninformatie maskeren als echte beschikbare uren of 0% verzuim. `employee_organizations` wordt tot één meest recente rij per dienstverband teruggebracht, niet zichtbaar per gerapporteerde historische dag. De code gebruikt een beperkte set queries met `.limit(5000)`, `.limit(10000)` en `.limit(20000)` zonder aangetoonde volledigheidscontrole of paginering. INS-03 mag geen onvolledige noemers of afgeknotte records als betrouwbare percentages tonen. Vereis `incomplete`/onbekend en reconciliatie.

### INS03-F04 — Frequent verzuim en Bradford gebruiken verschillende gebeurtenisdefinities

`frequent-absence-report.ts` telt `reportCount` per `absence_case` met `first_absence_on` in periode en telt ziekte-/herstelspells voor dagen; `bradford-report.ts` gebruikt `absenceOccurrences` uit `spellIds.size` en `sickDays` uit de verzuimrapportage. Dit zijn **niet automatisch dezelfde 'meldingen'**. Definieer case versus spell en historisch periodegedrag expliciet, voordat cross-report-KPI's vergeleken of uitgebreid worden. `frequentAbsenceQuery` heeft `12-months` / `this-year` / `previous-year`; `absence-query` accepteert voor het hoofdrapport momenteel alleen maand/jaar, ondanks ruimere TypeScript union.

### INS03-F05 — WVP foundation is niet hetzelfde als juridisch geaccepteerd rapport

`20260927100000_abs02_absence_hardening_wvp.sql` bevat `absence_tasks` met milestone, due date, status, `human_confirmation_required`, versie en RLS. `docs/requirements/absence/WVP_POORTWACHTER_ENGINE.md` noemt de wettelijke milestone-set **nog inhoudelijk te valideren**. PMUX/WVP acceptatie blijft apart open (issue #54). `wvp` blijft disabled tot bron-/rol-/privacy-/juridische acceptatie.

## 3. Voorgestelde eerste kleine product-/security-slice

**INS-03A — Verzuimrapportage: autorisatie en KPI-betrouwbaarheid (eerst).** Geen nieuwe grafiek als eerste prioriteit. Behoud bestaande UI/API en export. Baken HR Admin op toegestane administraties en Manager op **directe teamleden binnen actieve administratie** af, vóór bronqueries, volgens bestaande INS-01/02-scopingspatronen. Employee mag geen individuele collega-informatie opvragen. Bepaal een geautoriseerde dataset één keer en gebruik die voor KPI, trend, detail en Excel. Geen medische diagnose, vrije medische tekst of niet-noodzakelijke persoonsvelden in Insights. Breng `normalize_expired_absence_cases` onder een expliciet apart lifecycle-besluit, zonder automatisch bestaande workflowsemantiek te veranderen. Introduceer bronkwaliteitstoestanden in plaats van verzonnen roosters/0%-noemers. Detecteer truncatie en fail closed.

**INS-03B — Definities en harmonisatie** van frequent verzuim/Bradford pas na 03A, met expliciete `case`- versus `spell`-semantiek, tijdsvensters en privacy.

**INS-03C — WVP operationele aggregaties** pas na bewezen `absence_tasks`/PMUX-bron, juridische milestone-validatie, effectieve klok en rol-/privacy-/RLS-acceptatie; behoud `wvp` disabled tot dan.

## 4. Definition of Done voor INS-03A

1. Server-side tenant/HR-groep/administratie/Manager-direct-team allowlist vóór uitvoering van **alle** persoons-/case-/spell-/capacity-queries; HR Admin-administraties expliciet geautoriseerd. Negatieve cross-team/cross-admin en Employee 403-tests.
2. KPI, trend, detail, Excel en eventueel Bradford gebruiken exact dezelfde geautoriseerde en volledige populatie. Test met twee administraties en meerdere teams in één HR-groep; buiten-scope casus mag geen KPI verhogen.
3. Read-only rapport-GET heeft geen ongedocumenteerde databasewrite; lifecyclebesluit en regressie rond `normalize_expired_absence_cases` expliciet. Geen DB- of RLS-migratie zonder afzonderlijke toestemming.
4. Historische rooster-/plaatsingsbron met ontbrekende en conflicterende intervallen, meerdere dienstverbanden, herstelde cases en overlappende spells aantoonbaar correct. Onbekende noemer != 0% verzuim.
5. Bounded/paginated queries en truncatie-detectie; geen stil afkappen. NL/EN 43 namespaces, 390/768/1440px en exportpariteit.
6. Gerichte unit-, API-, autorisatie- en exporttests, TypeScript/ESLint/i18n/diff-check. Bestaande `.next/dev/types` absence/WVP-routefout apart registreren.
7. Code-integratie mag na gerichte groene checks; brede gehoste browser/RLS/Vercel TEST-acceptatie gebeurt volgens Edwins afspraak later gezamenlijk. Geen productreleaseclaim bij merge.

## 5. Nog onbekend / niet bewezen

- Actuele Core TEST rijtellingen, historische dekking, exacte live RLS-effecten en persona-toegang (niet live opgevraagd).
- Of de databasefunctie op huidige remote DB exact dezelfde definitie heeft als de laatst bekeken migrations (alleen repo-inspectie).
- Echte WVP-milestone-volledigheid en wettelijke goedkeuring.
- Full-suite build, browseracceptatie en deploymentstatus na de laatste `main` merge.

**Besluit:** INS-03A is de beste volgende gerichte ontwikkelslice, **maar implementatie en lifecyclewijziging wachten op afzonderlijke technische scopekeuze**. Dit contract is broncode-review, geen test-/releaserapport.
