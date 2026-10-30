# INS-RELEASE-03 — Final Security & Integration

| Eigenschap | Waarde |
|---|---|
| Datum | 30 oktober 2026 |
| Repository | `EdwinCycling/LiquidHR` |
| Branch | `work/ins-release-01-unblock-20261029` |
| Geteste basis | `7fda769804c57b4c9971d3842c3d7cd052af0065` (historische INS-RELEASE-03-basis) |
| Omgeving | Geïsoleerde lokale checkout; Windows; Node 22.14.0; npm 10.9.2 |
**INS-RELEASE-03-status:** Historisch CODE READY voor lokale integratie. **Actuele INS-RELEASE-04-status:** HOLD — directe Core TEST DB-verbinding en D-acceptatie-evidence ontbreken; zie het laatste preflight-addendum.

## Samenvatting

De INS-03-rapportages valideren nu expliciet de identiteit en scope van iedere teruggekomen bronrij. De directe-teamgrens staat los van de ruimere operationele verzuimrechten en wordt opnieuw gecontroleerd voor verzuim, frequent verzuim en Bradford. Een onverwacht te brede bronrespons faalt gesloten voordat KPI’s, details of Excel-data worden opgebouwd.

Read-only inspectie van Core TEST bevestigde dat de bestaande permissive `absence_cases`, `absence_spells` en `absence_capacity_changes`-SELECT-paden onder meer `internal_security.can_manage_employee()` gebruiken. Die helper kan HR-groepsrechten én directe-managementrechten honoreren. De effectieve operationele RLS-grens kan daardoor ruimer zijn dan de Insights-grens. De bestaande operationele policies en rechten zijn niet gewijzigd. De inspectie las alleen policies, helperdefinities en geaggregeerde rol-/toewijzingsaantallen; geen verzuimrecords. Er is geen live geauthenticeerde Manager- of Employee-request uitgevoerd, dus dit is geen live row-level persona-bewijs.

## Beveiligingscorrectie

- De bestaande actieve administratie-, tenant-, HR-groep-, directe-team- en medewerkerrelaties worden per teruggekomen rij gevalideerd.
- De Insights-allowlist staat los van `can_manage_employee()`. Een bronrij voor een collega in dezelfde HR-groep, een andere administratie, tenant of HR-groep wordt geweigerd.
- Bradford, frequentie en verzuim gebruiken dezelfde geautoriseerde populatie voor KPI’s, details en Excel. Een medewerker blijft uitgesloten van collega-Insights; een lege Manager-teamlijst levert geen medewerkers op.
- Queryfouten en onvolledige/ongeautoriseerde brongegevens worden niet omgezet in fictieve waarden. Medische vrije tekst is niet toegevoegd aan rapportages.
- De SQL-regressie modelleert de effectieve permissive operationele lezing plus de afzonderlijke rapportfilter met synthetische gegevens. Zij bewijst de applicatiegrens, niet de live Core TEST-RLS-uitkomst.

## INS-RELEASE-02-migratiebeoordeling

`apps/hr-suite/supabase/migrations/20261030065603_ins_release_02_manager_insights_unblock.sql` is behouden en **niet uitgevoerd**.

- De rapportpermissie wordt met `ON CONFLICT DO NOTHING` idempotent toegekend aan actieve, niet-verwijderde globale en tenantgebonden `DIRECT_MANAGER`-rollen.
- De threshold-RPC projecteert alleen `configured` en `frequent_absence_threshold`. `default_case_manager_employee_id` wordt niet teruggegeven.
- De fallbackwaarde `3` wordt alleen door de applicatie gebruikt wanneer de RPC aantoonbaar `configured=false` retourneert wegens een ontbrekende settings-rij. RPC-weigering, inconsistente configuratie, ongeldige waarde of bronfout faalt gesloten.
- De private helper is `SECURITY DEFINER`, heeft lege `search_path`, valideert authenticatie en `report-absence:read`, en is eigendom van de migratierol. De publieke wrapper is `SECURITY INVOKER`, heeft lege `search_path` en dezelfde migratie-eigenaar. Tests controleren EXECUTE voor `authenticated` en weigering voor `anon` en `service_role`.
- Rollback: roltoekenning is additief; verwijder haar niet blind, omdat `ON CONFLICT` niet vastlegt of de rij al bestond. Bij code-rollback kan de toegevoegde permissie blijven staan. Een eventuele database-terugdraaiing vereist een afzonderlijk gecontroleerde forward migration met bewijs welke rijen door deze migratie zijn toegevoegd. Hier is geen rollback of databasewijziging uitgevoerd.
- Migratievolgorde: pas deze migratie, indien later afzonderlijk geautoriseerd, toe nadat de voorafgaande schema- en permissiemigraties voor `absence_settings`, `current_user_has_hr_group_permission` en de gebruikte rollen/permissies zijn toegepast; daarna kan de code die de threshold-RPC aanroept worden uitgerold. Deze acceptatieronde heeft geen migratie toegepast.

## Verificatie

| Controle | Resultaat | Evidence |
|---|---:|---|
| Gerichte Insights-/SQL-contracttests | PASS — 4 bestanden, 34 tests | `npx vitest run lib/insights/absence-insight-authorization.test.ts supabase/migrations/absence_insight_manager_scope.contract.test.ts supabase/migrations/20261030065603_ins_release_02_manager_insights_unblock.contract.test.ts app/api/insights/absence/route.test.ts` |
| Payroll-catalogusregressies | PASS — 1 bestand, 6 tests | `npx vitest run lib/payroll/component-catalog.test.ts` |
| Volledige Vitest-suite | PASS — 4.008 PASS / 8 SKIP / 0 FAIL; 788 bestanden PASS / 4 SKIP | `npm test` vanaf repository-root; opgegeven baseline 4.003 / 8 / 0, dus 5 extra regressietests |
| TypeScript | PASS | `npm run type-check` vanaf repository-root; hr-suite, control en payroll-workspaces |
| ESLint | PASS — geen warnings | Gericht op de gewijzigde Insights-services en testbestanden met `npx eslint` |
| NL/EN i18n | PASS — 43 namespaces | `npm run check:i18n` vanaf `apps/hr-suite` |
| Productiebuild | PASS | `npm run build` vanaf `apps/hr-suite`; Next.js genereerde 348 statische pagina’s; build/provenancecontroles geslaagd |
| Git diff-check | PASS | `git diff --check --ignore-space-at-eol` gaf geen whitespacefouten; `core.autocrlf` gaf bij staging een EOL-conversiewaarschuwing voor LF-werkkopieën op Windows |

De volledige suite gaf bestaande Happy DOM-waarschuwingen voor synthetische `blob:payfull-*`-iframe-URL’s; de betrokken tests en de volledige run slaagden. De build genereerde een wijziging in het Focus-widgetartefact; alleen dat exacte bestand is hersteld naar de voorafgaande HEAD-inhoud. `apps/hr-suite/next-env.d.ts` bleef ongewijzigd.

## Git- en Vercel-status

De ontwikkelbranch begon op `7fda769804c57b4c9971d3842c3d7cd052af0065`; `origin/main` was `5e47832123bc90e197b38dc511bd658904e62c96` en een voorouder van die branch. Het Vercel-project `edwinitsolutions/liquidhr` is aan deze GitHub-repository gekoppeld. De projectconfiguratie meldt `createDeployments: disabled`; de aangetroffen Deploy Hook is voor een andere branch. Er is geen GitHub Vercel-deployworkflow aangetroffen. De featurebranch-ref ontbrak voor publicatie; codecommit `6e3e880b104caeeea61f75c52985cda50e8fb6f0` is met een gewone, niet-force push op dezelfde branch gepubliceerd. De post-push `git ls-remote`-SHA kwam overeen en de read-only Vercel-lijst voor deze branch retourneerde 0 deployments.

Er is in deze ronde geen databaseactie, migration apply, accountwijziging, merge of deployment uitgevoerd.

## Resterende acceptatiegrens

Lokale code-, SQL-contract-, type-, lint-, i18n- en buildcontroles zijn geslaagd. Voor Core TEST resteert een afzonderlijk geautoriseerde, geauthenticeerde acceptatie met bestaande HR Admin-, Manager- en Employee-identiteiten om de effectieve live RLS en persona-uitkomsten te bevestigen. Dat bewijs valt buiten deze lokale codegereedheidsbeoordeling.

**Oordeel: CODE READY** voor gecontroleerde integratie en voorbereiding van Core TEST-acceptatie. Dit is geen toestemming om de migratie toe te passen, te mergen of een deployment uit te voeren.

## INS-RELEASE-04 — Gecontroleerd Core TEST-pakket (30 oktober 2026)

Deze sectie documenteert de eerdere INS-RELEASE-04-runnercorrectie en vervangt de toenmalige INS-RELEASE-03-volgorde. Het bijgewerkte uitvoerbare runbook verderop vervangt de hieronder genoemde A→B→C→D-volgorde door A→A2→B→C→D. De eerdere bewering dat `20261030065603` ook de Manager-permissie toekent, is achterhaald. De historische INS-03-resultaten hierboven blijven bewijs voor hun toenmalige SHA; ze zijn geen hosted acceptatiebewijs voor deze kandidaat.

| Eigenschap | Waarde |
|---|---|
| Repository/branch | `EdwinCycling/LiquidHR` / `work/ins-release-01-unblock-20261029` |
| PR-head vóór deze correctieronde | `0a116fc7b73d57266c5906f6300991a3df3c0818` |
| PR-basis bij controle | `5e47832123bc90e197b38dc511bd658904e62c96` |
| Core TEST-project | Supabase `wnpfloqpjvaacobppbpk`; Vercel `edwinitsolutions/liquidhr` (`prj_h3voMtzXGfqG6QTodR5d1VTcC1zP`) |
| Actieve alias/readback | `liquid-hr-hr-suite.vercel.app` → `dpl_BVSDnuTsJYHCvWnVotw4waxpxJ1n`; READY, CLI-bron, geen controleerbare Git-SHA |
| Core TEST migraties | 591 read-only records; A `20261030065603` en C `20261030120901` ontbreken |
| Resultaat | Runnercorrecties en uitvoeringsrunbook lokaal gereed; geen migratie, deployment, aliaswijziging of hosted persona-run uitgevoerd |

### Veilige migratie-/deployvolgorde

1. **A — Alleen readmodel/RPC.** Pas `20261030065603_ins_release_02_manager_insights_unblock.sql` pas toe na expliciete Core TEST-toestemming. De migratie maakt geen Manager-toekenning. Een ontbrekende RPC laat HR Admin frequentieverzuim gesloten falen met `503`; er is geen stille drempelfallback naar 3.
2. **B — Beveiligde app.** Deploy uitsluitend na afzonderlijk `RELEASE LIQUIDHR TEST` en pin de exacte kandidaat-SHA. De actuele Vercel-aliasmetadata koppelt de actieve deployment aan `dpl_BVSDnuTsJYHCvWnVotw4waxpxJ1n`, aangemaakt op 25 oktober 2026 via CLI, maar bevat geen betrouwbaar bron-SHA of zichtbare productversie. Behandel de actieve app daarom als mogelijk verouderd. Ga niet door naar C zolang de actieve app niet aantoonbaar de beveiligde kandidaat is.
3. **C — Managerrecht activeren.** Pas `20261030120901_ins_release_04_manager_insights_activation.sql` pas na B en na afzonderlijke expliciete Core TEST-toestemming toe. Zij kent alleen `report-absence:read` toe aan actieve, niet-verwijderde `DIRECT_MANAGER`-rollen (globaal of tenantgebonden), en verandert operationele absence-permissies of RLS niet. Een privé ledger bevat uitsluitend grants die deze migratie nieuw heeft ingevoegd.
4. **D — Directe acceptatie.** Start meteen daarna één geauthenticeerde run met de bestaande, geautoriseerde synthetische HR Admin-, Manager-, lege-Manager- en Employee-sessies. Bevestig live source-SHA, doelproject, migratieversies A vóór C, alias en recente release-readback voordat de runner requests verstuurt. Bij enige securityfailure: stop de run en voer eerst de geautoriseerde containment uit.

De read-only Supabase-migratielijst bevatte 591 versies en bevatte noch `20261030065603` noch `20261030120901`. Er is niet geschreven of gemigreerd. De contextselectie-API's die de runner voor een geautoriseerde administratie-/negatieve contextproef gebruikt, zijn nagelezen: ze valideren de context en zetten uitsluitend cookies; ze schrijven geen businessdata. Alle directe PostgREST-verzoeken in de runner zijn GET's met de bestaande gebruikerssessie.

### RPC- en permissiebeoordeling

- De threshold-helper is `SECURITY DEFINER` met lege `search_path`; de publieke wrapper is `SECURITY INVOKER` met lege `search_path`. Contracttests controleren eigenaarschap door de migratierol, `EXECUTE` voor `authenticated` en geen `EXECUTE` voor `anon` of `service_role`.
- De helper vereist een geauthenticeerde gebruiker, niet-lege tenant-/HR-groepscope en `report-absence:read` voor die scope. Zij projecteert alleen `configured` en `frequent_absence_threshold`, weigert dubbele/ongeldige settings en retourneert `configured=false` alleen als de settingsrij aantoonbaar ontbreekt. `default_case_manager_employee_id` wordt niet gelezen of teruggegeven.
- Fase A geeft dus geen Manager Insights-toegang. Contracttests bewijzen weigering vóór C en toegang na C voor de juiste scope. De activeringsmigratie is idempotent, omvat globale en tenantgebonden actieve Manager-rollen en laat bestaande Manager- en HR Admin-toekenningen bij rollback intact.
- Containment na een fout ná C: eerst (na afzonderlijke DB-toestemming) alleen de door fase C gelogde rechten verwijderen; behoud de ledger voor audit/provenance:

```sql
begin;
delete from public.role_permissions rp
using internal_security.ins_release_04_manager_permission_activation_log activation
where activation.migration_version = '20261030120901'
  and rp.management_role_id = activation.management_role_id
  and rp.permission_id = activation.permission_id;
commit;
```

Verifieer daarna de nul-/bestaande grantset. Herstel pas daarna, indien nodig en afzonderlijk geautoriseerd, de vorige Vercel-app. Fase A introduceert geen Manager-recht en kan voor containment blijven staan; er is geen destructieve rollback van de RPC nodig. Geen rollback is in deze opdracht uitgevoerd.

### Acceptatie-runner

`apps/hr-suite/scripts/verify-build-source.mjs` vereist vóór elke production build een leesbare, schone Git-checkout en controleert dat een eventuele `VERCEL_GIT_COMMIT_SHA` met `HEAD` overeenkomt. `next.config.ts` neemt die vastgelegde commit-SHA op in de serverbuild; de no-store route `/api/runtime/build-provenance` geeft uitsluitend SHA, Vercel deployment-/project-ID, deployment-URL/target en de Core TEST-projectreferentie terug. Zonder schone Git-bron of vereiste runtimevelden faalt de build of readback gesloten. Er worden geen credentials, tokens of databasewaarden teruggegeven.

De runner accepteert operatorverwachtingen en persona-sessiepaden uit het private manifest, maar gebruikt geen manifestwaarde als bewijs voor deployment, alias, bron-SHA of migraties. Hij leest de actuele alias-naar-deployment-koppeling en deploymentstatus via Vercel CLI GET's en vergelijkt die met de runtime-provenanceroute en de verwachte 40-karakter-SHA. De read-only migratiepoort leest de applied migration list via Supabase Management API (`database_migrations_read`), controleert exacte versies en namen, en biedt de toestanden `none`, `a-only`, `a2-ready` en `complete`. De volgorde wordt aangetoond met onafhankelijke readbacks: `none` vóór A, `a-only` na A en vóór A2, `a2-ready` na A2 en vóór B/C, en `complete` na C. Elke readback bevat `verifiedAt`; bewaar die JSON-uitvoer bij de run-evidence. `--verify-deployment-only` is de B-poort; de volledige D-run vereist daarnaast `--confirm-authorized-core-test` en een live `complete`-readback.

Voor het gewone verzuimrapport gebruikt de runner uitsluitend de ondersteunde kalenderjaarparameter `period=year` en vergelijkt hij de teruggegeven `startDate`/`endDate` met 1 januari en 31 december van dat jaar. Frequent verzuim en Bradford moeten elk exact hetzelfde inclusieve rollende 365-dagenvenster teruggeven. Voor Manager wordt de directe-teamallowlist uit `employee_organizations` onafhankelijk via Manager én HR Admin bepaald; de sets moeten gelijk zijn. HR Admin moet elke buiten-teammedewerker, case en relevante spell in dezelfde tenant/groep/administratie bevestigen. Ook `absenceCases` en `activeCases` worden met een onafhankelijke HR Admin-lezing van directe-team-dienstverbanden/cases/spells vergeleken; case- en roostergewogen ziekte-KPI's moeten overeenkomen met de toegestane details. Ontbrekende fixtures, cases of relevante perioden zijn HOLD. Geen fixture-ID of -naam mag in API-details of Excel voorkomen, en frequentie-/Bradford-KPI's moeten met de details overeenkomen.

De runner maakt geen login, sessie of JWT, gebruikt geen service role, schrijft geen responsebestanden en logt geen tokens, cookies, namen, diagnoses of vrije medische tekst. Directe RLS-lezingen gebruiken bestaande persona-sessies en niet-medische sleutelkolommen; operationele verzuimrechten blijven onaangeroerd. Een volledige D-run is **niet** tegen Core TEST uitgevoerd.

### Uitvoerbaar A–A2–B–C–D-runbook

Gebruik in alle stappen de finale, beoordeelde 40-karakter `releaseSha`; de volgende runbooks voeren geen stap uit zonder de bijbehorende afzonderlijke toestemming.

Maak vóór A een lokale map voor niet-gevoelige JSON-readbacks; bewaar geen credentials, sessies of rapportdata daarin. Pin de open Draft PR-head eenmaal en hergebruik die waarde door alle fasen:

```powershell
$ErrorActionPreference = 'Stop'
$branch = 'work/ins-release-01-unblock-20261029'
$evidenceDir = Join-Path $env:TEMP 'INS-RELEASE-04-gate-evidence'
New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
$remoteHead = git ls-remote origin "refs/heads/$branch"
$releaseSha = ($remoteHead -split '\s+')[0]
if ($releaseSha -notmatch '^[a-f0-9]{40}$') { throw 'Remote PR-head ontbreekt of is ongeldig.' }
if (@(git status --porcelain).Count -ne 0) { throw 'Source-checkout is niet schoon.' }
git fetch origin
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed; stop.' }
git switch --detach $releaseSha
if ($LASTEXITCODE -ne 0) { throw 'Could not check out the pinned SHA; stop.' }
if (@(git status --porcelain).Count -ne 0) { throw 'Source-checkout is niet schoon.' }
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed; stop before phase A.' }

# Eenmalig vóór A/A2/C; houd dezelfde PowerShell-sessie voor alle fasen.
$toolHome = 'C:\Users\Edwin\AppData\Local\Temp\LiquidHR-INS-RELEASE-04-tools-2202d61f'
$env:SUPABASE_HOME = Join-Path $toolHome '.supabase-home'
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$supabase = Join-Path $toolHome 'node_modules\.bin\supabase.cmd'
if (-not (Test-Path -LiteralPath $supabase -PathType Leaf)) { throw 'Pinned Supabase CLI ontbreekt; installeer uitsluitend supabase@2.122.0 in de task-toolmap en herhaal deze preflight.' }
$cliVersion = (& $supabase --version | Out-String).Trim()
if ($cliVersion -ne '2.122.0') { throw "Verwachte Supabase CLI 2.122.0, aangetroffen: $cliVersion" }

function Assert-CoreTestDbUrl {
  param([Parameter(Mandatory)][string]$DbUrl)
  $uri = $null
  if (-not [Uri]::TryCreate($DbUrl, [UriKind]::Absolute, [ref]$uri)) { throw 'Core TEST DB URL is not a valid absolute PostgreSQL URI; no migration applied.' }
  if ($uri.Scheme -notin @('postgres','postgresql')) { throw 'Core TEST DB URL scheme is not PostgreSQL; no migration applied.' }
  $expectedRef = 'wnpfloqpjvaacobppbpk'
  $directHost = 'db.' + $expectedRef + '.supabase.co'
  $encodedUser = ($uri.UserInfo -split ':',2)[0]
  $dbUser = [Uri]::UnescapeDataString($encodedUser)
  if ([string]::IsNullOrWhiteSpace($dbUser)) { throw 'Core TEST DB URL has no PostgreSQL user; no migration applied.' }
  $poolerHost = ($uri.Host -match '^[a-z0-9-]+\.pooler\.supabase\.com$') -and ($dbUser -eq ('postgres.' + $expectedRef))
  if ($uri.Host -cne $directHost -and -not $poolerHost) { throw 'Core TEST DB URL does not independently identify Supabase project wnpfloqpjvaacobppbpk; no migration applied.' }
}
```

**A — Threshold-RPC.** Vereist afzonderlijke toestemming voor deze Core TEST-databasewijziging. Voer eerst de onafhankelijke migration API-read uit; A, A2 en C moeten alle ontbreken. Maak daarna een unieke tijdelijke workdir met alleen config en migratie A, zodat geen andere lokale pending migratie kan meelopen:

```powershell
$ErrorActionPreference = 'Stop'
$databaseUrl = $env:LIQUIDHR_CORE_TEST_DB_URL
if (-not $databaseUrl) { throw 'LIQUIDHR_CORE_TEST_DB_URL ontbreekt.' }
Assert-CoreTestDbUrl -DbUrl $databaseUrl
if (-not $env:SUPABASE_ACCESS_TOKEN) { throw 'SUPABASE_ACCESS_TOKEN met database_migrations_read ontbreekt.' }
$beforeA = git ls-remote origin "refs/heads/$branch"
if (($beforeA -split '\s+')[0] -ne $releaseSha) { throw 'PR-head veranderde vóór fase A; stop.' }
$none = node apps/hr-suite/scripts/ins-release-04-core-test-acceptance.mjs --verify-migration-stage none
if ($LASTEXITCODE -ne 0) { throw 'Core TEST migraties zijn niet leeg volgens de vereiste preflight.' }
$none | Set-Content (Join-Path $evidenceDir 'migration-none-before-a.json')
$phaseA = Join-Path $env:TEMP ('LiquidHR-INS-RELEASE-04-A-' + [guid]::NewGuid().ToString('N'))
$migrationDir = Join-Path $phaseA 'supabase\migrations'
New-Item -ItemType Directory -Path $migrationDir -Force | Out-Null
Copy-Item 'apps/hr-suite/supabase/config.toml' (Join-Path $phaseA 'supabase\config.toml')
Copy-Item 'apps/hr-suite/supabase/migrations/20261030065603_ins_release_02_manager_insights_unblock.sql' $migrationDir
& $supabase migration list --workdir $phaseA --db-url $databaseUrl
if ($LASTEXITCODE -ne 0) { throw 'Read-only migration list failed; stop without applying.' }
# Controleer de lijst: uitsluitend A mag lokaal ontbreken op remote.
& $supabase migration up --workdir $phaseA --db-url $databaseUrl --include-all --yes
if ($LASTEXITCODE -ne 0) { throw 'Fase A faalde; stop vóór B.' }
$afterA = node apps/hr-suite/scripts/ins-release-04-core-test-acceptance.mjs --verify-migration-stage a-only
if ($LASTEXITCODE -ne 0) { throw 'Readback na A is niet exact A-only; stop vóór B.' }
$afterA | Set-Content (Join-Path $evidenceDir 'migration-a-only-after-a.json')
```

**A2 — Gedeactiveerde rollen fail-closed.** Vereist afzonderlijke toestemming voor deze exacte Core TEST-databasewijziging. A moet onafhankelijk als enige toegepaste releasemigratie zijn bevestigd. Gebruik een tweede unieke tijdelijke workdir met alleen A2. De migratie vervangt de bestaande permission-helper op basis van de nieuwste preboarding-definitie, sluit inactieve/verwijderde rollen uit en behoudt `SECURITY DEFINER`, lege `search_path`, eigenaar en bestaande service-role-ACL. A2 moet gereed zijn voordat B wordt uitgerold:

```powershell
Assert-CoreTestDbUrl -DbUrl $databaseUrl
$beforeA2 = node apps/hr-suite/scripts/ins-release-04-core-test-acceptance.mjs --verify-migration-stage a-only
if ($LASTEXITCODE -ne 0) { throw 'Preflight vóór A2 is niet exact A-only; stop.' }
$beforeA2 | Set-Content (Join-Path $evidenceDir 'migration-a-only-before-a2.json')
$phaseA2 = Join-Path $env:TEMP ('LiquidHR-INS-RELEASE-04-A2-' + [guid]::NewGuid().ToString('N'))
$migrationDir = Join-Path $phaseA2 'supabase\migrations'
New-Item -ItemType Directory -Path $migrationDir -Force | Out-Null
Copy-Item 'apps/hr-suite/supabase/config.toml' (Join-Path $phaseA2 'supabase\config.toml')
Copy-Item 'apps/hr-suite/supabase/migrations/20261030120000_ins_release_04_active_role_permission_guard.sql' $migrationDir
& $supabase migration list --workdir $phaseA2 --db-url $databaseUrl
if ($LASTEXITCODE -ne 0) { throw 'Read-only migration list failed; stop without applying.' }
# Controleer de lijst: uitsluitend A2 mag lokaal ontbreken op remote.
& $supabase migration up --workdir $phaseA2 --db-url $databaseUrl --include-all --yes
if ($LASTEXITCODE -ne 0) { throw 'Fase A2 faalde; stop vóór B.' }
$afterA2 = node apps/hr-suite/scripts/ins-release-04-core-test-acceptance.mjs --verify-migration-stage a2-ready
if ($LASTEXITCODE -ne 0) { throw 'Readback na A2 is niet exact A+A2; stop vóór B.' }
$afterA2 | Set-Content (Join-Path $evidenceDir 'migration-a-and-a2-after-a2.json')
```

**B — App.** Alleen na `RELEASE LIQUIDHR TEST` en een geslaagde `a2-ready` readback: haal exact `releaseSha` uit GitHub, controleer een schone checkout, link/pull alleen project `liquidhr`, bouw prebuilt en deploy naar het bestaande Production-target (synthetische TEST). De Production-deploy wijst de bestaande projectdomeinen aan de nieuwe deployment toe; de runner moet die koppeling meteen bewijzen voordat C mag starten:

```powershell
$beforeB = node apps/hr-suite/scripts/ins-release-04-core-test-acceptance.mjs --verify-migration-stage a2-ready
if ($LASTEXITCODE -ne 0) { throw 'Core TEST toont niet exact A+A2 vóór B; stop.' }
$beforeB | Set-Content (Join-Path $evidenceDir 'migration-a-and-a2-before-b.json')
git fetch origin
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed; stop.' }
$currentRemote = git ls-remote origin "refs/heads/$branch"
$currentSha = ($currentRemote -split '\s+')[0]
if ($currentSha -ne $releaseSha) { throw 'PR-head veranderde sinds A; stop.' }
git switch --detach $releaseSha
if ($LASTEXITCODE -ne 0) { throw 'Could not check out the pinned SHA; stop.' }
if (@(git status --porcelain).Count -ne 0) { throw 'Source-checkout is niet schoon.' }
Push-Location apps/hr-suite
vercel link --yes --scope edwinitsolutions --project prj_h3voMtzXGfqG6QTodR5d1VTcC1zP
if ($LASTEXITCODE -ne 0) { throw 'Vercel project link failed; stop.' }
# Vercel CLI maakt lokaal apps/hr-suite/.gitignore aan; houd die ongecommit maar behoud haar.
if (Test-Path -LiteralPath '.gitignore' -PathType Leaf) {
  $gitDir = git rev-parse --absolute-git-dir
  $excludeFile = Join-Path $gitDir 'info\exclude'
  $excludeEntry = '/apps/hr-suite/.gitignore'
  if (-not ((Get-Content -LiteralPath $excludeFile -ErrorAction SilentlyContinue) -contains $excludeEntry)) {
    Add-Content -LiteralPath $excludeFile -Value $excludeEntry -Encoding utf8
  }
}
if (@(git status --porcelain).Count -ne 0) { throw 'Vercel-link liet onverwachte lokale wijzigingen achter; stop vóór pull/build.' }
vercel pull --yes --scope edwinitsolutions --project prj_h3voMtzXGfqG6QTodR5d1VTcC1zP --environment=production
if ($LASTEXITCODE -ne 0) { throw 'Vercel pull failed; stop before build.' }
vercel build --prod --scope edwinitsolutions --project prj_h3voMtzXGfqG6QTodR5d1VTcC1zP
if ($LASTEXITCODE -ne 0) { throw 'Vercel build failed; stop before deployment.' }
vercel deploy --prebuilt --prod --scope edwinitsolutions --project prj_h3voMtzXGfqG6QTodR5d1VTcC1zP
if ($LASTEXITCODE -ne 0) { throw 'Vercel deployment failed; stop before provenance or C.' }
node scripts/ins-release-04-core-test-acceptance.mjs --verify-deployment-only --expected-source-sha $releaseSha
if ($LASTEXITCODE -ne 0) { throw 'Alias, deployment, source-SHA of Core TEST-project readback mismatch; stop vóór C.' }
Pop-Location
```

**C — Manager-rapportrecht.** Alleen na geslaagde B-readback en afzonderlijke toestemming voor deze Core TEST-databasewijziging. Houd hetzelfde `releaseSha` vast. Bewijs vóór C opnieuw dat uitsluitend A en A2 van deze release zijn toegepast; stage vervolgens exact één lokale migratie:

```powershell
$databaseUrl = $env:LIQUIDHR_CORE_TEST_DB_URL
if (-not $databaseUrl) { throw 'LIQUIDHR_CORE_TEST_DB_URL ontbreekt.' }
Assert-CoreTestDbUrl -DbUrl $databaseUrl
$beforeC = node apps/hr-suite/scripts/ins-release-04-core-test-acceptance.mjs --verify-migration-stage a2-ready
if ($LASTEXITCODE -ne 0) { throw 'Preflight vóór C is niet exact A+A2; stop.' }
$beforeC | Set-Content (Join-Path $evidenceDir 'migration-a-and-a2-before-c.json')
$phaseC = Join-Path $env:TEMP ('LiquidHR-INS-RELEASE-04-C-' + [guid]::NewGuid().ToString('N'))
$migrationDir = Join-Path $phaseC 'supabase\migrations'
New-Item -ItemType Directory -Path $migrationDir -Force | Out-Null
Copy-Item 'apps/hr-suite/supabase/config.toml' (Join-Path $phaseC 'supabase\config.toml')
Copy-Item 'apps/hr-suite/supabase/migrations/20261030120901_ins_release_04_manager_insights_activation.sql' $migrationDir
& $supabase migration list --workdir $phaseC --db-url $databaseUrl
if ($LASTEXITCODE -ne 0) { throw 'Read-only migration list failed; stop without applying.' }
& $supabase migration up --workdir $phaseC --db-url $databaseUrl --include-all --yes
if ($LASTEXITCODE -ne 0) { throw 'Fase C faalde; stop vóór D.' }
$afterC = node apps/hr-suite/scripts/ins-release-04-core-test-acceptance.mjs --verify-migration-stage complete
if ($LASTEXITCODE -ne 0) { throw 'Readback na C is niet exact A+A2+C; stop vóór D.' }
$afterC | Set-Content (Join-Path $evidenceDir 'migration-a-a2-and-c-after-c.json')
```

Stop als A, A2 of C onverwacht aanwezig is vóór A; als A ontbreekt vóór A2; als A2 ontbreekt vóór B/C; als C al aanwezig is vóór C; of als Supabase CLI een andere lokale migratie wil toepassen. Behoud readbacks `none`, `a-only` na A, `a2-ready` na A2 en vóór B/C, en `complete` na C. Deze readbacks tonen uitsluitend de exacte toegestane migraties op elk releasepunt.

**D — Persona/RLS/browser.** Gebruik uitsluitend de bestaande geautoriseerde NL-sessie van HR Admin, Manager, lege Manager en Employee, plus EN-sessies van HR Admin en Manager. De manifestverwachtingen bevatten beide toegestane HR Admin-administraties, Manager-context/verboden contexten, directe-team-buitenstaanders, bekende drempels en de lege Manager-context. Er worden geen TEST-identiteiten of sessies aangemaakt. Vereis Vercel CLI-authenticatie, `SUPABASE_ACCESS_TOKEN` met uitsluitend benodigde `database_migrations_read`-toegang en de gepinde Vercel-envfile; toon die waarden niet:

```powershell
$manifestPath = Read-Host 'Volledig pad naar het bestaande private INS-RELEASE-04-manifest'
$manifestPath = (Resolve-Path -LiteralPath $manifestPath).Path
$repoRoot = (Get-Location).Path.TrimEnd([IO.Path]::DirectorySeparatorChar)
$repoPrefix = $repoRoot + [IO.Path]::DirectorySeparatorChar
if ($manifestPath.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Het manifest moet buiten de checkout blijven.' }
if (-not (Test-Path -LiteralPath '.vercel/.env.production.local' -PathType Leaf)) { throw 'De bestaande Vercel-envfile ontbreekt.' }
if (-not $env:SUPABASE_ACCESS_TOKEN) { throw 'SUPABASE_ACCESS_TOKEN ontbreekt.' }
node --env-file=.vercel/.env.production.local scripts/ins-release-04-core-test-acceptance.mjs `
  --manifest "$manifestPath" --expected-source-sha $releaseSha --confirm-authorized-core-test
```

De route `/v1/projects/{ref}/database/migrations` is een GET met `database_migrations_read`; de runner controleert exacte versies en migratienamen. Vercel vult deployment-ID, project-ID, URL en waar beschikbaar Git-SHA platformmatig in. De buildprovenance SHA wordt daarnaast uit de schone, gepinde Git-checkout gecompileerd. Zie [Supabase applied migration history](https://supabase.com/docs/reference/api/v1-list-migration-history) en [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables).

**Stop/rollback:** iedere SHA-, project-, alias-, migratievolgorde-, scope-, fixture-, KPI-, detail- of Excel-mismatch stopt de run vóór de volgende fase. Bij een securityfout ná C: stop D; na afzonderlijke DB-toestemming verwijder uitsluitend de door C-ledger vastgelegde nieuwe role grants (SQL hierboven) en behoud de ledger. Herstel de vorige Vercel-app alleen na afzonderlijke TEST-releaseautorisatie. Laat A2 staan bij containment: terugdraaien van de rolactiviteitscontrole zou de gedeactiveerde-roltoegang opnieuw openen en vereist een afzonderlijk beoordeeld herstelbesluit. A introduceert geen Manager-rapportrecht en vereist bij containment geen destructieve rollback.

### Bestaande TEST-identiteiten en voorwaarden

- HR Admin: bestaande geautoriseerde NL- en EN-storage states, met beide manifest-administraties in de bedoelde tenant/HR-groep.
- Manager: bestaande geautoriseerde directe-team-sessie in NL en EN; HR Admin moet dezelfde actuele teamallowlist onafhankelijk kunnen lezen.
- Lege Manager: bestaande geautoriseerde NL-sessie waarvan de directe teamlijst daadwerkelijk leeg is.
- Employee: bestaande geautoriseerde NL-sessie zonder collega-Insights.
- Een private manifest met deze bestaande storage-state-paden en de verwachte tenant-, HR-groep-, administratie-, verboden-scope-, buiten-team-fixture- en drempelwaarden. De runner maakt of vernieuwt geen sessies.
- Vercel CLI-authenticatie voor `edwinitsolutions/liquidhr`, de Core TEST DB-URL uitsluitend tijdens A/C, een Supabase Management API-token met alleen `database_migrations_read` voor readbacks en de bestaande `.vercel/.env.production.local` voor D. Toon of commit geen waarden.
- Historische momentopname vóór INS-RELEASE-04 EXECUTION UNBLOCK: de Supabase CLI was niet beschikbaar. De laatste preflight heeft een lokale, exact gepinde CLI 2.122.0 geïnstalleerd in de task-specifieke toolmap; zie de laatste sectie.

De huidige alias levert voor de deploymentreadback nog `RUNTIME_PROVENANCE_UNAVAILABLE`; A en C ontbreken. Er is daardoor nog geen live uitvoering van de uiteindelijke runner tegen de nieuwe app.

### GitHub/Vercel-triggercontrole

PR #71 is open en Draft; de remote branch-head was bij aanvang van deze correctieronde `0a116fc7b73d57266c5906f6300991a3df3c0818`. De actuele Vercel-project-API meldt `gitProviderOptions.createDeployments = disabled`; de Vercel-teamwebhook-readback is leeg; de repository heeft geen Vercel push-deployworkflow en de deploymentlijst toont nul deployments voor deze branch. Daarmee is een automatische Vercel-deployment door deze Git-push uitgeschakeld. Na push worden branch-head, Draft-status en branch-deploymentcount opnieuw read-only gecontroleerd.

### Verificatie van deze kandidaat

| Controle | Resultaat | Evidence |
|---|---:|---|
| Gerichte runner-/SQL-/Payroll-tests | PASS — 7 bestanden, 32 tests; vóór de laatste éénregelige parserfix in `next.config.ts` uitgevoerd en niet opnieuw gedraaid | Exacte Vitest-opdracht direct onder deze tabel; runner-, migratie- en rapportlogica was op dat moment definitief |
| Volledige Vitest-suite | PASS — 4.025 PASS / 8 SKIP / 0 FAIL; 790 bestanden PASS / 4 SKIP; uitgevoerd vóór de laatste éénregelige parserfix in `next.config.ts` en niet opnieuw gedraaid | `npm test` vanaf repository-root; HR Suite 3.965/8, Control 11/0, Payroll-rules 49/0; na de parserfix zijn typecheck, lint, `node --check`, diff-check en build geslaagd |
| HR-suite TypeScript | PASS | `npm run type-check` vanuit `apps/hr-suite` |
| ESLint gewijzigde code | PASS — geen warnings | Gericht op `next.config.ts`, provenance-route en gewijzigde runner/provenance-scripts en tests |
| `node --check` runner/provenance | PASS | Runner, build-source verifier en provenance writer |
| Git diff-check | PASS | `git diff --check --ignore-space-at-eol`; Git meldde de verwachte Windows LF→CRLF-conversie |
| Productiebuild | PASS — Next.js 16.4.2; 348 static pages; source provenance `34559f75679099b4ed5434bd3bd9a7ea9ac8bdb6` | `npm run build` vanuit `apps/hr-suite`; `prebuild` eiste schone Git en build provenance nam exact `HEAD` op |
| Live deployment/migratie/persona/RLS/browser | NOT RUN | Actieve deployment mist de provenance-route; A/C ontbreken; vereist geautoriseerde A→B→C→D-run |
| i18n | Niet opnieuw uitgevoerd | Geen UI- of NL/EN-vertalingsbestanden gewijzigd |

```powershell
Push-Location apps/hr-suite
npm test -- --reporter=dot scripts/ins-release-04-core-test-acceptance.test.mjs app/api/runtime/build-provenance/route.test.ts supabase/migrations/20261030065603_ins_release_02_manager_insights_unblock.contract.test.ts supabase/migrations/absence_insight_manager_scope.contract.test.ts app/api/insights/absence/route.test.ts lib/insights/frequent-absence-report.test.ts lib/payroll/component-catalog.test.ts
Pop-Location
```

De volledige suite gaf opnieuw de bekende Happy DOM-waarschuwingen voor synthetische `blob:payfull-*`-iframe-URL's; alle betrokken tests slaagden en de volledige run eindigde met exitcode 0. Dit zijn waarschuwingen, geen nieuwe regressies. De volledige suite en de gerichte 32-test-suite zijn uitgevoerd vóór de laatste éénregelige whitespacecorrectie in de Git-statusparser van `next.config.ts`; die suites zijn daarna niet herhaald. De correctie raakt alleen die buildstatusparser; na de correctie zijn TypeScript, ESLint, `node --check`, diff-check en productiebuild gecontroleerd. De eerste buildpoging vond de whitespacefout; de retry op `34559f75679099b4ed5434bd3bd9a7ea9ac8bdb6` slaagde. `next-env.d.ts` bleef gelijk; de door de build gegenereerde Focus-widgetbron is na hashcontrole exact naar de voorafgaande committed inhoud teruggezet.

### Actueel oordeel

**Historisch oordeel op de eerdere kandidaat-SHA: EXECUTION READY** voor de gecontroleerde A→B→C→D-run. De onafhankelijke readbacks, runnerfail-closed-controles, fixturebewijs en uitvoerbare runbook zijn klaar. Er is geen migration apply, SQL-write, role grant, deployment, aliaswijziging, merge of hosted personaacceptatie uitgevoerd. De Core TEST-run blijft ongestart totdat expliciete toestemming voor databasefasen A/C en `RELEASE LIQUIDHR TEST` voor B is gegeven. D vereist daarna de genoemde bestaande geautoriseerde identiteiten en storage states. De push naar de bestaande Draft PR volgt na de laatste Git/Vercel-triggercontrole; na push worden remote SHA en branch-deploymentcount opnieuw gecontroleerd.

## INS-RELEASE-04 EXECUTION UNBLOCK — laatste preflight (30 oktober 2026)

### Vastgepinde basis en actuele gates

De laatste read-only controle startte op branch work/ins-release-01-unblock-20261029. Zowel lokale HEAD als de remote PR #71-head waren toen exact 2202d61f64640300184ea4785f8885240e3da598. PR #71 is open en Draft. Dit addendum is alleen documentatie; na de documentcommit moet de release-run opnieuw de exacte remote PR-head pinnen. Als er vóór uitvoering nieuwe commits zijn, inspecteer die eerst en gebruik alleen de na review vastgestelde exacte SHA. De lokale Vercel-link heeft daarnaast een ongetrackte apps/hr-suite/.gitignore aangemaakt; die is behouden en wordt via één repo-lokale .git/info/exclude-regel buiten commits gehouden. Er zijn geen andere code- of testwijzigingen.

| Gate | Status | Vastgesteld bewijs / resterende voorwaarde |
|---|---|---|
| Tests en build | PASS, doorgevoerd bewijs | De actuele PR-beschrijving registreert 4.036 PASS / 8 SKIP / 0 FAIL. De bestaande runbook-evidence registreert een geslaagde TypeScript-, ESLint- en productiebuild. Deze doc-only preflight heeft ze niet herhaald, conform scope. |
| Supabase CLI | READY | Lokale, niet-globale installatie supabase@2.122.0 in C:\Users\Edwin\AppData\Local\Temp\LiquidHR-INS-RELEASE-04-tools-2202d61f. De version-, migration list- en migration up-help controles slaagden. |
| Core TEST databaseverbinding en write-autorisatie | HOLD | Supabase Management/MCP read-only project- en migratielezingen werken. LIQUIDHR_CORE_TEST_DB_URL en SUPABASE_ACCESS_TOKEN ontbreken in process-, user- en machineomgeving; CLI-tokenbestanden ontbreken. Er is geen directe Postgresverbinding of migration-apply-permissie bewezen. |
| Core TEST-projectidentiteit | PASS voor read-only referentie | Supabase projectlijst noemt LiquidHR, ACTIVE_HEALTHY, ref wnpfloqpjvaacobppbpk. De migratiehistorie is via read-only toegang uit hetzelfde project gelezen. |
| Migratiehistorie | PASS | 591 records. A 20261030065603, A2 20261030120000 en C 20261030120901 ontbreken alle drie; dit is de vereiste starttoestand. |
| Vercel-project/link | READY voor projecttoegang | Vercel CLI 65.0.0, Node 22.14.0; whoami en projectinspectie slagen. Project liquidhr, ID prj_h3voMtzXGfqG6QTodR5d1VTcC1zP, repo LiquidHR, root apps/hr-suite, productiebranch main, Vercel Node 24.x. Het project-API meldt createDeployments=disabled. Vercel Production is volgens het LiquidHR-omgevingscontract de bestaande synthetische TEST-channel. Geen deployment of aliaswijziging uitgevoerd. |
| Live provenance/configuratiedoel | HOLD tot na B | Huidige actieve deployment dpl_BVSDnuTsJYHCvWnVotw4waxpxJ1n is READY/production maar heeft geen controleerbare Git-SHA. GET /api/runtime/build-provenance op de bestaande alias retourneert 404. De Vercel production-configuratie is niet als runtime-Core-ref bewezen; de nieuwe provenance-readback moet na B exact de release-SHA, project-ID en ref wnpfloqpjvaacobppbpk bevestigen vóór C. |
| HR Admin-sessies NL/EN | HOLD | Geen vereiste Playwright/storage-state bestanden gevonden onder de bestaande TestRuntime-locatie. |
| Manager-sessies NL/EN en lege Manager NL | HOLD | Geen vereiste sessies gevonden. De onafhankelijke directe-team-connector gaf een interne fout; geen geautoriseerde allowlist beschikbaar. |
| Employee NL-sessie | HOLD | Geen vereiste sessie gevonden. |
| Negatieve buiten-team-fixtures | HOLD | Geen onafhankelijke HR Admin-referentie voor medewerkers/cases/spells bevestigd. Een ontbrekende fixture kan niet als PASS gelden. |
| Private manifest | HOLD | Geen bestaand INS-RELEASE-04-manifest gevonden onder TestRuntime of in de checkout. Er is geen manifest met placeholders of ongeverifieerde waarden gemaakt. |

### Supabase CLI en Core TEST-voorbereiding

De projectgebonden installatie is buiten de repository gehouden, zodat package.json, lockfiles en productdependencies niet wijzigen. De npm-installatiemethode volgt de [officiële Supabase CLI setup](https://supabase.com/docs/guides/local-development/cli/getting-started); de gebruikte flags zijn bevestigd met de [officiële CLI-referentie](https://supabase.com/docs/reference/cli/global-flags). Supabase CLI 2.122.0 ondersteunt migration list en migration up met --db-url, en --workdir; migration up ondersteunt ook --include-all en --yes. De CLI-help meldt dat met --db-url geen Supabase CLI access token nodig is, maar de opgegeven database-URL en PostgreSQL-rechten zijn wel vereist. De URI moet volgens de CLI-help percent-encoded zijn. Vóór iedere apply controleert Assert-CoreTestDbUrl zonder de URL, gebruikersnaam of wachtwoord te tonen dat de directe host exact db.wnpfloqpjvaacobppbpk.supabase.co is, of dat de Supabase-poolerhost en de PostgreSQL-gebruikersnaam samen exact project wnpfloqpjvaacobppbpk aanwijzen. Andere hosts falen gesloten. Er is geen URL in process-, user- of machineenvironment en de canonical TestRuntime-config is niet geopend of uitgelezen.

De geïsoleerde toolmap kan indien gewist opnieuw worden opgebouwd zonder globale installatie:

~~~powershell
$toolHome = 'C:\Users\Edwin\AppData\Local\Temp\LiquidHR-INS-RELEASE-04-tools-2202d61f'
New-Item -ItemType Directory -Path $toolHome -Force | Out-Null
Push-Location $toolHome
npm init -y
npm install --save-exact supabase@2.122.0
Pop-Location
~~~

Gebruik daarna de bootstrap in het A–A2–B–C–D-runbook bovenaan: die fixeert SUPABASE_HOME binnen de toolmap, schakelt CLI-telemetrie uit en faalt als de versie niet exact 2.122.0 is. De bestaande A, A2 en C migratieblokken roepen nu expliciet deze lokale $supabase uit en houden elke migratie in een tijdelijke workdir met exact één SQL-bestand. --yes wordt alleen gebruikt ná onafhankelijke fasecontrole en de afzonderlijke expliciete databaseautorisatie. De Supabase CLI is niet aangemeld en er is geen account of credential aangemaakt.

### Vercel-link, build en deployment

De geïsoleerde apps/hr-suite-checkout is gekoppeld met:
~~~powershell
Push-Location apps/hr-suite
vercel link --yes --scope edwinitsolutions --project prj_h3voMtzXGfqG6QTodR5d1VTcC1zP
if ($LASTEXITCODE -ne 0) { throw 'Vercel project link failed; stop.' }
Pop-Location
~~~

Readback van apps/hr-suite/.vercel/project.json bevestigt het opgegeven project-ID, team-ID en projectnaam. Vercel CLI-authenticatie en project-read zijn beschikbaar. De link heeft apps/hr-suite/.env.local en apps/hr-suite/.gitignore aangemaakt; beide zijn buiten de rapportage gehouden, .env.local is niet gelezen en de ignorefile is niet gecommit. De verwachte apps/hr-suite/.vercel/.env.production.local ontbreekt nog. Voer geen env-pull uit vóór geautoriseerde fase B; die schrijft lokaal environmentmateriaal weg. Vercel env-waarden zijn niet in dit rapport gekopieerd.

Na A2-readback, een schone checkout en afzonderlijke autorisatie RELEASE LIQUIDHR TEST zijn dit de exacte B-commando's op de op dat moment gepinde releaseSha:
~~~powershell
Push-Location apps/hr-suite
vercel pull --yes --scope edwinitsolutions --project prj_h3voMtzXGfqG6QTodR5d1VTcC1zP --environment=production
if ($LASTEXITCODE -ne 0) { throw 'Vercel pull failed; stop before build.' }
vercel build --prod --scope edwinitsolutions --project prj_h3voMtzXGfqG6QTodR5d1VTcC1zP
if ($LASTEXITCODE -ne 0) { throw 'Vercel build failed; stop before deployment.' }
vercel deploy --prebuilt --prod --scope edwinitsolutions --project prj_h3voMtzXGfqG6QTodR5d1VTcC1zP
if ($LASTEXITCODE -ne 0) { throw 'Vercel deployment failed; stop before provenance or C.' }
Pop-Location
~~~

Dit zijn voorbereide commando's; er zijn geen Vercel-mutaties uitgevoerd. --prod wijst naar de bestaande Vercel-production-channel van de synthetische LiquidHR TEST-app volgens het repository-omgevingscontract. Na deployment moet de runner met --verify-deployment-only de nieuwe alias, deployment-ID, exacte source-SHA en Supabase-ref onafhankelijk lezen. De huidige 404 is de oude deploymentstatus; D of C starten niet zolang die readback niet slaagt.

### Persona's, loginroutes en manifest

De canonieke C:\Users\Edwin\AppData\Local\LiquidHR\TestRuntime-locatie bestaat en .env.local bestaat, maar de inhoud is niet bekeken. Een metadata-only bestandsnaamscan vond daar geen manifest, storage state, sessiebestand of persona-browserstate. De checkout bevat geen verifieerbare bestaande persona-states. De bestaande /login- en /auth/callback-routes zijn de normale aanmeldroutes; er is geen aanmelding geprobeerd omdat geen bestaande geautoriseerde persona-sessie/credentiallocatie aan de vereiste HR Admin-, Manager-, lege-Manager- en Employee-persona's kon worden gekoppeld. Geen account, sessie, rol of fixture is aangemaakt of gewijzigd.

De managerteam-allowlist moet onafhankelijk uit een geautoriseerde bron worden bepaald. De Manager-service gaf een connectorfout; de vereiste HR Admin-readback voor buiten-team-medewerkers en relevante cases/spells ontbreekt. Maak daarom geen manifest. D is pas uitvoerbaar wanneer de bestaande, ACL-beschermde storage states, private manifest met uitsluitend gecontroleerde waarden, directe-team-allowlist en bestaande buiten-team-cases/spells beschikbaar zijn. De manager-allowlist moet onafhankelijk overeenkomen met de managerteambron; een ontbrekende fixture is HOLD.

### Fasepoorten, evidence en containment

Behoud de bestaande volgorde A → A2 → B → C → D en gebruik bij alle stappen dezelfde finale releaseSha. De huidige read-only startstatus is “geen A/A2/C”. Voer nooit een volgende fase uit als de onafhankelijke historie niet exact de verwachte toestand toont:

- A: afzonderlijke toestemming voor exact migration 20261030065603; vóór apply moeten A/A2/C ontbreken; na afloop moet uitsluitend A als releasemigratie zichtbaar zijn.
- A2: afzonderlijke toestemming voor exact migration 20261030120000; vooraf alleen A aanwezig; erna exact A+A2.
- B: afzonderlijke RELEASE LIQUIDHR TEST-toestemming; vooraf exact A+A2; na deploy moet provenance voor releaseSha, Vercel-project en Core TEST-ref slagen.
- C: afzonderlijke toestemming voor exact migration 20261030120901; pas na succesvolle B-readback; vooraf exact A+A2 en erna exact A+A2+C.
- D: aparte bevestiging van geautoriseerde Core TEST-acceptatie én beschikbaarheid van alle bestaande persona-sessies, de onafhankelijke allowlist, negatieve fixtures en private manifest. Geen sessies of fixtures creëren.

Bewaar uitsluitend niet-gevoelige JSON-readbacks in %TEMP%\INS-RELEASE-04-gate-evidence. Voeg geen credentials, tokens, cookies, persoonsgegevens of rapportexports toe. Stop onmiddellijk bij een andere branch-SHA, dirty source-checkout, ontbrekende DB-URL, fout in migratievolgorde, onverwachte pending migratie, verkeerde deployment/ref, provenancefout, persona-scopelek, ontbrekende negatieve fixture of KPI-/details-/Excel-mismatch.

Containment: A verleent geen Manager-recht en heeft geen destructieve rollback nodig. Laat A2 staan bij incident; ongedaan maken kan gedeactiveerde rollen opnieuw toegang geven en vereist een afzonderlijk securitybesluit. Bij een fout na C: stop D; verwijder alleen de door C-ledger bewezen nieuw toegevoegde report-absence:read grants, uitsluitend na aparte databaseautorisatie, en behoud de ledger. Herstel een eerdere Vercel-app uitsluitend na een aparte RELEASE LIQUIDHR TEST-autorisatie. Geen rollback-, migratie-, database-, deployment- of aliasactie is tijdens deze preflight uitgevoerd.

### Eindstatus

**HOLD.** Er is geen aangetoond productcode- of regressiedefect in deze voorzichtige preflight. De blokkades zijn toegang en ontbrekende acceptatie-evidence: directe Core TEST DB-verbinding/write-rechten; verificatie van de runtime-Core-ref na B; bestaande HR Admin/Manager/lege Manager/Employee states; private manifest; onafhankelijke Manager-allowlist; en geverifieerde negatieve buiten-team-medewerkers met relevante cases/spells. Tests/build zijn alleen doorgevoerd uit de bestaande acceptatie-evidence en niet opnieuw uitgevoerd. Geen fase A, A2, B, C of D is gestart.
