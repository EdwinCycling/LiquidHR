# INS-RELEASE-02 — Manager Insights unblock

- **Datum:** 2026-10-30
- **Repository:** `EdwinCycling/LiquidHR`
- **Featurebranch:** `work/ins-release-01-unblock-20261029`
- **Actuele remote `main`:** `5e47832123bc90e197b38dc511bd658904e62c96`
- **Lokale integratiebasis:** `19b6ac38f1b8a2ae2d18193efb80ad2ba82a9ffe` (de bestaande branchcommit plus de twee actuele, documentatie-only main-commits)
- **Testomgeving:** Windows PowerShell, Node `22.14.0`, npm `10.9.2`, Vitest `4.1.10`, `package-lock.json`
- **Oordeel:** **CODE READY / DB APPROVAL REQUIRED / LIVE ACCEPTANCE OPEN / RELEASE HOLD**
- **GitHub:** niet gepusht; geen PR aangemaakt. Effectieve Vercel-triggers konden niet worden gecontroleerd omdat Vercel `get_project` voor `team_edwinitsolutions` HTTP 403 gaf.

## Samenvatting

De bestaande INS-RELEASE-01-fixes zijn behouden. De featurebranch is bijgewerkt met de actuele `origin/main`; die bevatte alleen zes W04/AA-documentatiebestanden. De INS-RELEASE-02-code voegt een idempotente rapportpermissie toe aan actieve, niet-verwijderde globale en tenantgebonden `DIRECT_MANAGER`-rolrecords, en vervangt de directe leestabelquery voor de frequentiedrempel door een beperkte, HR-groepsgebonden RPC-projectie.

De migratie is alleen lokaal voorbereid en door PGlite-contracttests uitgevoerd. Zij is **niet** toegepast op Core TEST. Er zijn geen accountmutaties, databasewrites, grants of RLS-policywijzigingen op Core TEST uitgevoerd. De enige live Core TEST-verzoeken in deze sprint waren read-only SELECT-preflights.

## Implementatie

### Manager-rapportrecht

De nieuwe migratie `apps/hr-suite/supabase/migrations/20261030065603_ins_release_02_manager_insights_unblock.sql` voegt `report-absence:read` toe aan actieve `DIRECT_MANAGER`-rolrecords, ongeacht of de rol globaal of tenantgebonden is. `ON CONFLICT (management_role_id, permission_id) DO NOTHING` maakt de koppeling idempotent. Inactieve, verwijderde en niet-Manager-rollen worden uitgesloten.

Bestaande `employee:read`-, `absence:read`-, administratie- en direct-teamcontroles blijven in de applicatiescope staan. De migratie wijzigt geen bestaande RLS-policy.

### Frequentiedrempel

`frequent-absence-report.ts` leest `absence_settings` niet meer rechtstreeks. De nieuwe RPC geeft alleen `configured` en `frequent_absence_threshold` terug voor de opgegeven tenant/HR-groep nadat de gebruiker expliciet `report-absence:read` heeft.

De publieke wrapper is `SECURITY INVOKER`; de private helper staat in het niet-blootgestelde schema `internal_security`, gebruikt een lege `search_path` en controleert zelf identiteit en HR-groepspermissie. De helper leest alleen de drempelprojectie. `default_case_manager_employee_id` wordt niet geretourneerd. Alleen een aantoonbaar ontbrekende instellingenrij levert `configured=false` op en gebruikt de contractuele standaard 3. Een geweigerde, ongeldige of mislukte read wordt 403/503 en nooit stilzwijgend 3.

De migratie trekt geen tabelbrede SELECT-grant in en gebruikt geen service-role-client. In Core TEST bestond `USAGE` op `internal_security` voor `authenticated` al; `anon` had dit niet. Beide voorgestelde functies waren vóór toepassing afwezig.

### Preflight en regressies

`scripts/insights-auth-preflight.mjs` controleert uitsluitend configuratiebestandsmetadata en aanwezige environmentvariabelenamen. Het leest geen configuratiebestanden of environmentwaarden en doet geen server-, Auth-, Supabase- of databaseverzoek.

De PGlite-contracttests bewijzen lokaal:
- idempotente toekenning aan globale en tenantgebonden Managers;
- uitsluiting van inactieve/verwijderde rollen en Employees;
- alleen de geautoriseerde frequentiedrempel, terwijl Manager de volledige instellingenrij via gewone RLS niet ziet;
- weigering voor Employee, andere HR-groep/tenant en unauthenticated;
- execute-rechten alleen voor authenticated en een SECURITY INVOKER-wrapper.

De servicetests bewijzen dat frequentierapport en Excel dezelfde ingestelde drempel gebruiken en geen overige instellingen serialiseren. Dit zijn unit-/PGlite-contracten, geen live RLS-acceptatie.

## Read-only Core TEST-preflight en open beveiligingsgrens

De metadata-preflight op project `wnpfloqpjvaacobppbpk` vond één actief globaal `DIRECT_MANAGER`-rolrecord, zonder `report-absence:read` en met de bestaande `absence:read`-koppeling; er waren geen actieve tenantgebonden Manager-rolrecords. Er zijn geen medewerker-, case- of spellrecords opgehaald.

De bestaande `absence_settings`-selectpolicy vereist `absence-settings:read`, wat de nieuwe smalle projectie oplost zonder de volledige rij open te stellen. De bestaande policies voor absence-cases/spells/capaciteit delegeren echter naar `internal_security.can_manage_employee(..., 'absence:read')`. De huidige helper bevat ook een HR-groepspermissiepad. In combinatie met de bestaande Manager-`absence:read`-koppeling is directe-team-isolatie op de ruwe tabellen daardoor **niet aangetoond** en mogelijk ruimer dan de Insights-servicefilter.

Dit is geen bewezen live datalek: er zijn geen geauthenticeerde positieve/negatieve rijproeven uitgevoerd. Het is wel een **security-blocker voor een claim dat Manager-toegang end-to-end uitsluitend direct-team is**. Deze sprint verandert die bestaande RLS-architectuur niet. Een afzonderlijke securitybeoordeling en read-only Manager-proeven voor directe teamleden, buiten-teamleden, andere administratie, HR-groep en tenant zijn nodig voordat LIVE ACCEPTANCE sluit.

## SQL-toepassing en rollbackvoorstel

Het volledige, niet-uitgevoerde SQL-voorstel staat in de migratie hierboven. Voor toepassing moet een bevoegde beheerder eerst de huidige mappings vastleggen met een read-only query die per actief Manager-role-ID aangeeft of de `report-absence:read`-koppeling al bestaat. Vergelijk die set na toepassing. Rollback verwijdert uitsluitend role/permission-paren die vóór toepassing afwezig waren en na toepassing aanwezig zijn.

Gebruik voor de rollback alleen de exacte paren uit die pre-/post-readback; vul dus uitsluitend de mappings in die deze toepassing werkelijk toevoegde:

```sql
begin;

with added_by_this_application (management_role_id, permission_id) as (
  values
    -- Vul alleen exacte UUID-paren in die vóór toepassing ontbraken
    -- en na toepassing door deze migratie aanwezig zijn.
    ('<newly-added-management-role-id>'::uuid, '<report-absence-permission-id>'::uuid)
)
delete from public.role_permissions as mapping
using added_by_this_application as added
where mapping.management_role_id = added.management_role_id
  and mapping.permission_id = added.permission_id
returning mapping.management_role_id, mapping.permission_id;

drop function if exists public.get_frequent_absence_threshold(uuid, uuid);
drop function if exists internal_security.read_frequent_absence_threshold(uuid, uuid);

commit;
```

De voorbeeld-UUID's moeten door de geverifieerde paren worden vervangen; voer dit niet met placeholders uit. Laat de bestaande schema-`USAGE`-grant staan: die was al aanwezig vóór deze migratie. De voorgestelde functies waren vooraf afwezig, zodat de twee `DROP FUNCTION`-regels uitsluitend deze nieuwe objecten verwijderen. Geen van deze SQL is uitgevoerd.

## Acceptatiematrix

| Controle | HR Admin | Manager | Employee | Bewijsniveau |
|---|---|---|---|---|
| Frequentieverzuim en drempel | Servicecontract aanwezig; echte context niet getest | Rapportrecht-, directe-team- en drempelcontracten getest | Weigering getest | UNIT / PGlite; geen LIVE TEST |
| Verzuim/Bradford | Bestaande unit- en routechecks | Bestaande scopechecks; ruwe RLS-direct-teamgrens open | 403-contract getest | UNIT; geen LIVE TEST |
| KPI/detail/Excel | Bestaande regressies | Service-/Excel-pariteit getest | Exportweigering getest | UNIT; geen LIVE TEST |
| Andere HR-groep/tenant | Niet live getest | Smalle threshold-RPC weigert cross-group/tenant in PGlite | Employee-RPC-weigering in PGlite | PGlite-contract; geen LIVE RLS |
| Browser, desktop/mobiel | NOT TESTED | NOT TESTED | NOT TESTED | Geen geautoriseerde sessie/config |

De lokale configuratiepreflight vond geen `apps/hr-suite/.env.local`, centrale TEST-`.env.local` of centrale `payroll-test-personas.env`. Alle zes benodigde sleutel-namen ontbreken: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `TALENT_HR_ADMIN_PASSWORD`, `TALENT_MANAGER_PASSWORD`, `TALENT_EMPLOYEE_PASSWORD`, `LIQUIDHR_TEST_ROLE_SWITCH_ENABLED`. Waarden zijn niet gelezen of afgedrukt; authenticatie is niet geprobeerd. De status van het fixtureaccount zelf blijft onbekend.

## Verificatie

| Controle | Resultaat | Exacte uitvoering |
|---|---|---|
| Gerichte Insights-, route-, RLS/SQL- en preflighttests | **PASS — 16 bestanden, 64 tests** | `npx.cmd vitest run` met de absence-, frequentie-, Bradford-, API-route-, permission-contract-, ABS-02-contract-, nieuwe SQL-contract- en preflighttestbestanden vanuit `apps/hr-suite`. |
| Payroll-catalogusregressies | **PASS — 2 bestanden, 20 tests** | `npx.cmd vitest run "app/(dashboard)/payroll-components/page.test.tsx" lib/payroll/component-library.test.ts` vanuit `apps/hr-suite`. |
| Root Vitest | **PASS — 4,003 PASS / 8 SKIP / 0 FAIL** | `npm.cmd test`; hr-suite 3,943 PASS + 8 SKIP, Control 11 PASS, payroll-rules-nl-2026 49 PASS. 787 testbestanden PASS, 4 SKIP; circa 215 seconden. Vergelijking met INS-RELEASE-01: 8 extra tests PASS, dezelfde 8 SKIP. |
| SKIP-uitleg | **Geen nieuwe skipcategorieën** | 5 API-v1 runtime-acceptatietests vereisen opt-in `LIQUIDHR_API_V1_ACCEPTANCE=true` en een expliciete loopback-runtime; 3 Payroll-livepersistencetests vereisen `PAYLAB_LIVE_TEST=1`. Geen runtime of Payroll-liveproef gestart. |
| Root TypeScript | **PASS** | `npm.cmd run type-check` voor alle aanwezige workspaces. |
| Gerichte ESLint | **PASS** | `npx.cmd eslint` op frequent-service, autorisatietest, nieuwe SQL-contracttest en preflight-script/tests. |
| NL/EN i18n | **PASS — 43 namespaces** | `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite`; gelijke sleutels. |
| Productiebuild | **PASS** | `npm.cmd run build --workspace @liquid-hr/hr-suite`; Next.js 16.4.2 compile + TypeScript, 348 statische pagina's, Payroll client-boundary scanner, function-traces en provenancecheck geslaagd. Een standaard sandboxrun werd eerst door Windows-junctionrechten geblokkeerd; de lokale build slaagde met toegestane lokale bestandstoegang. Geen deployment. Build was op dezelfde sourcecode vóór de latere documentatie-only main-merge. |
| Build-bescherming | **PASS** | De build genereerde de bestaande Focus-resource; die is in de geïsoleerde clone naar de branchversie hersteld. `apps/hr-suite/next-env.d.ts` bleef SHA-256 `1B59D4C6B83807DB275D43F3CF2CC8E9323F465FAB764EEA091CC5BECD5BAD37`. |
| Auth-configuratiepreflight | **BLOCKED BY MISSING LOCAL CONFIG — verwacht** | `node scripts/insights-auth-preflight.mjs` exit 2; alleen ontbrekende sleutel-namen. Geen secrets gelezen/geprint, geen netwerkverzoek. |
| HR Admin/Manager/Employee browser- en live RLS-proeven | **NOT TESTED** | Vereiste bestaande lokale TEST-configuratie ontbreekt; geen rolwissel of nieuwe identiteit. |
| Vercel effectieve Git-/Preview-triggers | **NOT VERIFIED** | Vercel `get_project` gaf HTTP 403; push/PR daarom achterwege gelaten. |

De full Vitest-run gaf niet-fatale Happy DOM `blob:`-URL-`NotSupportedError`-consolemeldingen bij bestaande Payroll-fixtures. De suites eindigden met exitcode 0 en alle bijbehorende tests slaagden. Geen failures of flakiness waargenomen.

## Bestanden in deze sprint

| Bestand | Resultaat |
|---|---|
| `apps/hr-suite/lib/insights/frequent-absence-report.ts` | Gebruikt alleen de veilige drempel-RPC; toegangs- en configuratiefouten zijn fail-closed. |
| `apps/hr-suite/lib/insights/absence-insight-authorization.test.ts` | Drempelprojectie, 403/fail-closed, lege-team- en rapport/Excel-pariteit. |
| `apps/hr-suite/supabase/migrations/20261030065603_ins_release_02_manager_insights_unblock.sql` | Niet-uitgevoerde permission- en threshold-RPC-migratie. |
| `apps/hr-suite/supabase/migrations/20261030065603_ins_release_02_manager_insights_unblock.contract.test.ts` | PGlite-contracttests voor idempotentie, bevoegdheden, isolatie en projectie. |
| `apps/hr-suite/scripts/insights-auth-preflight.mjs` | Metadata-/sleutelnaam-preflight zonder inhoud van configbestanden of environmentwaarden te lezen. |
| `apps/hr-suite/scripts/insights-auth-preflight.test.mjs` | Regressietests voor naam-only preflight. |
| `docs/quality/acceptance/runs/INS-RELEASE-02-MANAGER-INSIGHTS-UNBLOCK-20261030.md` | Dit acceptatie- en rollbackvoorstel; INS-RELEASE-01-evidence blijft onveranderd. |

## Eindadvies en resterende handelingen

**CODE READY:** bestaande INS-RELEASE-01-correcties en nieuwe lokale implementatie zijn gericht en breed getest. De actuele main-documentatiecommits zijn in de featurebranch geïntegreerd.

**DB APPROVAL REQUIRED:** de migratie blijft een voorstel. Alleen na expliciet database- en securitymandaat kan een beheerder de migratie toepassen en de exacte nieuw toegevoegde mappingparen vastleggen voor eventuele rollback.

**LIVE ACCEPTANCE OPEN:** bestaande HR Admin-/Manager-/Employee TEST-identiteiten, Manager-direct-team, andere administratie/HR-groep/tenant, directe API- en RLS-negatieven, en desktop-/mobiele browserproeven moeten met bestaande geautoriseerde TEST-configuratie worden uitgevoerd. Los eerst de RLS-direct-teamvraag op; deze sprint bewijst geen live RLS-isolatie.

**RELEASE HOLD:** niet pushen zolang effectieve Vercel Git-/Preview-triggers niet read-only zijn bevestigd. Er is geen merge naar main, PR of deployment uitgevoerd.
