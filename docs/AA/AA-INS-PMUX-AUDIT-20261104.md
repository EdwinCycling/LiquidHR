# Insights en PMUX — geïntegreerde code- en roadmapcheck, 4 november 2026

## Scope en bewijsgrens
Read-only GitHub-controle op canonieke main (documentatiebaseline `c2a16aaccb93bc74c7c181dc81ab15bd2a7ea1e4`, productauditbaseline `fbe44908f0793519d4b712c26cf8ffa05cf872d1`). Controle van merge-status PR's #52, #57, #60, #65, #68, #71 en #88, aanwezigheid van concrete codebestanden, report-catalog, autorisatieguard, PMUX-werkbak, werkkalenders en historische acceptatierapporten. Geen verse lokale test-run, geauthenticeerde browser-/RLS-run of actuele Supabase-migratiehistorie-readback. Vercel READY uit eerdere audit bewijst deploy, niet E2E-acceptatie.

## Insights — in code aanwezig
- **INS-01 Headcount/FTE:** PR #57 MERGED, component `components/insights/headcount-fte-report.tsx`, route `app/api/insights/headcount-fte/route.ts`, berekening/query/auth/tests. Rapportcatalogus: `headcount-fte` available.
- **INS-02 instroom/uitstroom:** PR #60 MERGED, component `joiners-leavers-report.tsx`, API, service, CSV en regressietests. Rapportcatalogus: `joiners-leavers` available.
- **INS-03A verzuimscoping:** PR #65 MERGED; `lib/insights/absence-insight-scope.ts` controleert de onafhankelijke direct-team employee allowlist; KPI/detail/export en onbekende data behandeld volgens eerdere contracttests.
- **INS-03B frequent verzuim en Bradford:** PR #68 MERGED; rapporten, queries, 365-kalenderdagperiode, berekeningen, Excel en NL/EN. Geen nieuwe semantische verandering in deze audit.
- **INS-RELEASE-04:** PR #71 MERGED; rol-hardening en migraties A/A2/C zijn in repository. Hun **actuele toegepaste Core TEST-status** is niet opnieuw geverifieerd.
- **Bestaande catalogus:** medewerkers, verlof, verzuim, salaris, talent, AI-gebruik en procesautomatisering aanwezig. `wvp` en `provision` zijn expliciet `available:false`, dus niet als vrijgegeven rapport tellen.

**Open gehoste bewijs:** HR Admin/Manager/Employee inclusief Engelse sessie, lege Manager, buiten-team-/cross-tenant-/cross-administratiecases, KPI/detail/Excel-/CSV-pariteit, live role/RLS; lifecycle-normalisatie buiten rapportage (#67); INS-03C WVP wettelijke/privacy-/PMUX-gate.

## PMUX — in code aanwezig
- **Operationele werkbak:** `app/(dashboard)/work/page.tsx` importeert `ProcessWorkWorkspace`, startbare processen, work-service en documentkennisname/interne-overdrachtadapter.
- **Werkkalenders:** `app/(dashboard)/settings/work-calendars/page.tsx` importeert instellingencomponent en service en vereist `process-definition:write`.
- **Centrale claim/action security:** PR #52 MERGED; `supabase/migrations/20261028125342_pmux_work_item_claim_guard.sql` controleert voor handelen huidige CLAIMED-status, eigenaar, permission en actuele kandidaat. Eerdere gerichte PGlite-tests positief. Gehoste echte taakafhandeling is hiermee niet integraal bewezen.
- **Proces-/formulierenstudio:** in oudere implementatie-/acceptatie-evidence beschreven; in deze gerichte GitHub-check geen volledige individuele studio-route-/publish-/mobile-code-inventaris of verse browseracceptatie uitgevoerd. Deze onderdelen dus niet blind E2E PASS markeren.
- **WVP01:** opgenomen in consolidatie PR #88, met `docs/requirements/absence/WVP_POORTWACHTER_ENGINE.md` en bestaande begeleiding/werkbak. Historische acceptatie noemt de basismigratie toegepast, auditcorrectie op 26 oktober HOLD; voor de **huidige** DB-status is read-only reconciliatie nodig.

**Open bewijs:** HR Admin/Manager/Employee live claim→act→audit inclusief negatieve scopes en P10-400, procespublicatie/start/publish/revision, Employee handoff en 390px weergave, werk-/SLA-kalenderacceptatie, WVP01 auditcorrectie en echte processtart/claim/actie, migratie-lineage en privacy/RLS.

## Aanbevolen gezamenlijke roadmap
1. **Nu / P0:** één gehoste acceptatiematrix op actuele `main` en deployed runtime-provenance voor Payroll, Insights en PMUX; SQL-migratievergelijken alleen read-only; CI op `main`. Geen brede ontwikkelrelaunch.
2. **Insights P1:** directe-team/administratiescope en verzuim rapport-ketens volledig bewijzen, lifecycle owner/cadence #67 kiezen; INS-03C WVP disabled tot gevalideerde juridische/privacy-/PMUX-gates.
3. **PMUX P1:** één echte geautoriseerde procesketen, publish→start→work item→claim→act→audit, plus negatieve persona- en mobiele checks; WVP01 als apart gereguleerd acceptatiepad.
4. **Daarna:** Talent/Development Analytics, Payroll Analytics op canonieke actuals, verdere procescatalogus/formulierverbeteringen; wettelijke Payroll P2 separaat.

## Besluit
**CODE INTEGRATION: bevestigd voor onderzochte INS-waves en PMUX-security/WVP01 mergehistorie.**
**HOSTED FUNCTIONAL RELEASE: niet volledig aangetoond.** Geen verse tests, DB-write, migratie of deployment uitgevoerd.
Heropen geen gemergde waves enkel omdat oudere momentopnamen nog HOLD zeggen. Heropen alleen concrete onvoldoende geteste contracts of productflows.
