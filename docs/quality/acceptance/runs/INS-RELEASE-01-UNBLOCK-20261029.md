# INS-RELEASE-01 — Unblock sprint Insights

- **Datum:** 2026-10-29
- **Repository:** `EdwinCycling/LiquidHR`
- **Geïsoleerde branch:** `work/ins-release-01-unblock-20261029`
- **Gepinde `origin/main`-basis:** `b6835ef5e97bf6b0ba1f5d17acb624ffc08a5609` (na PR #69; geverifieerd met `git fetch origin` en `git ls-remote`)
- **Testomgeving:** Windows PowerShell, Node `22.14.0`, npm `10.9.2`, Vitest `4.1.10`, `package-lock.json`
- **Oordeel:** **HOLD** voor merge/hosted TEST-acceptatie. Lokale codegates zijn groen, maar Manager-autorisatie vereist een nog niet toegepaste permissionwijziging, Manager-frequency mist een veilige toegang tot de configureerbare drempel en echte persona-/RLS-/browseracceptatie ontbreekt.

## Samenvatting

De lokale broncode verklaart de gemelde Manager-403. `getAbsenceInsightScope()` vereist `report-absence:read` en `employee:read` voordat bronqueries of directe-team-resolutie starten. De Insights-permissionmigration kent `report-absence:read` toe aan `TENANT_ADMIN` en `HR_ADMIN`, maar niet aan `DIRECT_MANAGER`. De absencemigration kent `absence:read` wel toe aan `DIRECT_MANAGER`; dat blijft de bestaande RLS-grens voor cases en spells. Er is geen permissiebypass toegevoegd. De authorizationtests controleren nu ontbrekende rechten en de route zet weigeringen om naar HTTP 403 voor alle drie rapporten en Excel.

De code- en testwijzigingen zijn op deze branch lokaal uitgevoerd. Geen databasewrite, migratie, grant, accountmutatie, payrollrun, deployment, push of merge is uitgevoerd. Vercel-projectinstellingen konden niet gelezen worden: `get_project` gaf HTTP 403 voor `team_edwinitsolutions`. Volgens het repo-releasecontract is een root `vercel.json` met `deploymentEnabled: false` niet voldoende bewijs wanneer de effectieve projectinstelling niet leesbaar is. Daarom is geen Draft PR aangemaakt.

## Diagnoses en resterende bevindingen

### BLOCKER — `DIRECT_MANAGER` mist `report-absence:read`

- **Reproduceerbaar bewijs:** de actuele lokale `getAbsenceInsightScope()` vereist achtereenvolgens `report-absence:read`, `employee:read`, geldige administratiecontext en daarna Manager-direct-team-scope. De canonical migration `20260724105304_insights_report_permissions.sql` seedt de rapportpermissie alleen voor `TENANT_ADMIN` en `HR_ADMIN`. `20260726150000_add_absence_core.sql` seedt `absence:read` voor `TENANT_ADMIN` en `DIRECT_MANAGER`.
- **Verwacht:** geautoriseerde Manager kan de rapportservice bereiken; vervolgens beperken bestaande applicatiescope en RLS gegevens tot de directe teamleden en actieve administratie.
- **Geobserveerd:** zonder `report-absence:read` krijgt de service 403 vóór team- of bronqueries. De eerdere Fase-A-browserrun zag Manager-403 voor verzuim, frequent verzuim, Bradford en Excel. De actuele hosted identiteit/roltoekenning en deployed source-SHA konden deze run niet read-only worden bevestigd.
- **Veilige oplossing:** hieronder staat uitsluitend een voorstel. Geen databasewijziging is toegepast.

**Voorstel — niet uitgevoerd:** voeg `report-absence:read` idempotent toe aan actieve, niet-verwijderde `DIRECT_MANAGER`-rolrecords (globaal en tenantgebonden, zodat bestaande tenantrolresolutie gelijk blijft). Laat `employee:read`, `absence:read`, administratievalidatie, direct-teamfilter en bestaande RLS intact.

```sql
begin;
insert into public.role_permissions (management_role_id, permission_id)
select manager_role.id, permission.id
from public.management_roles manager_role
join public.permissions permission on permission.code = 'report-absence:read'
where manager_role.code = 'DIRECT_MANAGER'
  and manager_role.is_active = true
  and manager_role.deleted_at is null
on conflict do nothing;
commit;
```

**Testplan vóór/na een afzonderlijk geautoriseerde TEST-toepassing:**

1. Preflight: inventariseer actieve `DIRECT_MANAGER`-rol-ID's en welke koppelingen met `report-absence:read` al bestaan.
2. Manager met de rapportpermissie, `employee:read`, bestaande `absence:read`, actieve administratie en directe teamleden: API en Excel leveren dezelfde eigen teamset; een medewerker buiten team/administratie ontbreekt in KPI's, details en export.
3. Manager zonder `report-absence:read`: 403 vóór team-/bronqueries; Employee blijft 403; HR Admin-scope blijft ongewijzigd.
4. Test echte Supabase-RLS apart: Manager direct team toegestaan, buiten-team/andere administratie/HR-groep/tenant geweigerd. Mocktests gelden niet als RLS-bewijs.

**Rollback:** sla vóór toepassing exact de manager-role-ID's op waarvoor de koppeling ontbreekt. Verwijder bij rollback uitsluitend de `role_permissions`-paren voor die vastgelegde ID's en `report-absence:read`; behoud paren die vóór toepassing al bestonden. Geen brede verwijdering op basis van alleen `role.code`.

### HIGH — configureerbare frequentiedrempel is niet aantoonbaar leesbaar voor Manager

`absence_settings_group_select` vereist `absence-settings:read`. De canonical permissionseed kent die leespermissie alleen aan `TENANT_ADMIN` toe. `absence_settings` bevat naast `frequent_absence_threshold` ook `default_case_manager_employee_id`. De frequentierapportservice gebruikt bij een onzichtbare/ontbrekende settingsrij momenteel `?? 3`; voor een Manager kan dat stilzwijgend afwijken van de ingestelde HR-groepsdrempel. De nieuwe unitfixtures leveren de settingsrij expliciet aan en bewijzen deze RLS-situatie dus niet.

Ik heb `absence-settings:read` niet aan Managers toegekend en geen alternatieve RLS-/RPC-bypass gebouwd: de brede rij bevat ook een manager-ID en dit zou een niet-goedgekeurde scope-uitbreiding zijn. Voor volledige Manager-acceptatie is een smalle, server-side oplossing nodig die alleen de frequentiedrempel geeft binnen de toegestane rapportcontext, of een expliciet goedgekeurde scopekeuze. Tot die tijd is de Manager-frequentie-uitkomst geen bewezen juiste reflectie van een afwijkende ingestelde drempel.

### EVIDENCE GAP — HR Admin-authenticatie en TEST-persona's

De huidige lokale sign-inroute gebruikt de vaste fixture-identiteit `hradmin.fixture@liquidhr.test` en `TALENT_HR_ADMIN_PASSWORD`. De route geeft 503 als die variabele ontbreekt, 401 bij een Supabase password-loginfout, 403 bij een niet-geverifieerde/verkeerde fixture-identiteit en 303 na succesvolle identiteitscontrole. De vorige browserrun legde geen status of foutcategorie vast. In deze geïsoleerde clone ontbreken zowel de centrale TEST-runtimeconfig als `apps/hr-suite/.env.local`; waarden zijn niet gelezen. Daarom kan de eerdere HR Admin-loginfout niet verder worden onderscheiden tussen credentials/accountstatus en actieve rol-/tenant-/HR-groep-/administratiecontext.

Benodigde read-only beheercontrole vóór browseracceptatie: bevestig dat de bestaande fixtureaccount geverifieerd en actief is, aan het bestaande employee-record gekoppeld is, de bedoelde actieve HR-groep- en `TENANT_ADMIN`/`HR_ADMIN`-rolscope heeft en een toegestane actieve administratie kan kiezen. Geen account- of grantwijziging is gevraagd of uitgevoerd.

### EVIDENCE GAP — hosted versie en push-trigger

De eerdere Vercel-lookup vond deployment `dpl_BVSDnuTsJYHCvWnVotw4waxpxJ1n` met source `cli` maar zonder Git-SHA; die deployment bewijst dus niet dat de huidige Insights-code erop staat. De nieuwe read-only `get_project`-controle werd geweigerd met 403 op `team_edwinitsolutions`. Effectieve Git/Preview-triggers konden daardoor niet bevestigd worden. De branch en commit blijven lokaal; er is geen push of PR gemaakt.

## Gewijzigde bestanden

| Bestand | Wijziging |
|---|---|
| `apps/hr-suite/lib/insights/frequent-absence-report.ts` | Een Manager met een lege directe teamlijst krijgt een expliciet lege rapportuitkomst zonder employments-/medewerkerbronqueries; de bestaande drempelread blijft de enige extra read. |
| `apps/hr-suite/lib/insights/absence-insight-authorization.test.ts` | Permissionmock volgt nu `AuthContext.permissions`; positieve Managerfixtures bevatten ook bestaand `absence:read`; tests voor missende report-/employee-rechten, lege directe teams, ongeldige administratie en scope-/Excel-pariteit. |
| `apps/hr-suite/app/api/insights/absence/route.test.ts` | Nieuw: HTTP 403-regressietest voor afwijzingen in verzuim, frequent verzuim en Bradford, zowel JSON als Excel. |
| `apps/hr-suite/lib/payroll/component-library.test.ts` | Catalogusverwachting bijgewerkt voor de bestaande W04-component; geen Payroll-berekening gewijzigd. |
| `apps/hr-suite/app/(dashboard)/payroll-components/page.test.tsx` | Verouderd systeemaantal bijgewerkt van 24 naar 25 en W04-code expliciet gecontroleerd. |
| `docs/quality/acceptance/runs/INS-RELEASE-01-UNBLOCK-20261029.md` | Dit acceptatie-, diagnose- en voorstelrapport. |

## Verificatie

| Controle | Resultaat |
|---|---|
| Gerichte Vitest | **PASS** — 4 bestanden, 43 tests, 0 failures; 2.14 s. Commando: `npx.cmd vitest run lib/insights/absence-insight-authorization.test.ts app/api/insights/absence/route.test.ts lib/payroll/component-library.test.ts 'app/(dashboard)/payroll-components/page.test.tsx'`. |
| Brede workspace Vitest | **PASS** — hr-suite 777 bestanden / 3.935 tests geslaagd, 4 bestanden / 8 tests overgeslagen; Control 2 / 11 geslaagd; payroll-rules-nl-2026 6 / 49 geslaagd. Totaal: 789 bestanden (785 PASS, 4 SKIP), 4.003 tests (3.995 PASS, 8 SKIP), 0 failures. Commando: `npm.cmd test`; Vitest-duur circa 198.5 s over de uitgevoerde workspaces. |
| SKIP-uitleg | 5 APIAI-01 lokale HTTP-acceptatietests vereisen `LIQUIDHR_API_V1_ACCEPTANCE=true` plus een expliciete loopback-runtime; die was niet gestart. 3 Payroll-live-persistentietests vereisen `PAYLAB_LIVE_TEST=1`; niet aangezet, conform geen DB-writes/payrollrun. Geen SKIP als PASS geteld. |
| Root TypeScript | **PASS** — `npm.cmd run type-check`, inclusief hr-suite, Control en Payroll workspaces. |
| Gerichte ESLint | **PASS** — alle vijf gewijzigde TS/TSX-bestanden. Commando: `npx.cmd eslint 'lib/insights/absence-insight-authorization.test.ts' 'lib/insights/frequent-absence-report.ts' 'app/api/insights/absence/route.test.ts' 'lib/payroll/component-library.test.ts' 'app/(dashboard)/payroll-components/page.test.tsx'` vanuit `apps/hr-suite`. |
| i18n | **PASS** — `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite`; 43 namespaces met gelijke NL/EN-sleutels. |
| Productiebuild | **PASS** — `npm.cmd run build --workspace @liquid-hr/hr-suite`; Next compile en TypeScript, 348 statische pagina's, Payroll client-boundary scanner en PDF tracechecks geslaagd. Geen deployment. |
| Dependency-runtime | `npm ci --no-audit --no-fund` slaagde. Node `22.14.0` gaf een enginewaarschuwing: `@sparticuz/chromium@149` vraagt `^22.17.0 || >=24`; de build slaagde desondanks. Geen dependency-updates uitgevoerd. |
| Browser HR Admin/Manager/Employee, desktop/390px | **NOT TESTED** — centrale lokale TEST-config ontbreekt; geen server/login gestart. Unittests zijn geen browserbewijs. |
| Live Supabase-RLS / administratie-, HR-groep- en tenantisolatie | **NOT TESTED** — alleen code/migraties en mocks beoordeeld; geen remote query of databasewijziging. |
| Hosted source-SHA / Vercel-triggerveiligheid | **NOT VERIFIED** — Vercel API 403. |

De brede run schreef Happy DOM `NotSupportedError`-logs voor `blob:`-URL-fixtures in Payroll-tests; de betrokken tests slaagden en de runner eindigde met exitcode 0. Er zijn geen testlogbestanden opgeslagen; commando's en uitkomsten staan hierboven.

## Releasebesluit en vervolgstappen

**HOLD.** Lokale implementatie- en technische controles zijn groen, maar de live Manager-permissie is niet verleend, de configureerbare Manager-frequentiedrempel heeft geen bewezen veilige leesroute, HR Admin-login en RLS zijn niet bevestigd en Vercel-triggerveiligheid ontbreekt. Dit rapport verleent geen TEST-release-, deployment-, database- of merge-autoriteit.

1. Bevestig of keur een smalle Manager-rapportpermissie goed; behandel de drempelroute afzonderlijk vanwege de extra velden in `absence_settings`.
2. Laat een bevoegde beheerder de bestaande HR Admin TEST-identiteit/context read-only controleren en herstel niets aan account of grants zonder apart mandaat.
3. Herstel Vercel-teamreadtoegang of lever onafhankelijke bevestiging van de effectieve Git/Preview-triggerconfiguratie; maak daarna pas de Draft PR.
4. Voer na afzonderlijke autorisatie een hosted TEST-proef uit op de exacte deployed SHA: HR Admin, Manager-direct-team, Employee-denial, andere administratie/HR-groep/tenant, alle drie rapporten en Excel, desktop en 390px, en directe API/RLS-negatieven.