# LiquidHR final convergence en TEST-release — 20-11-2026

**Opdrachtgever:** Edwin
**Verdict:** LIMITED TEST / PARTIAL
**Project:** bestaand Vercel-project liquidhr, project-ID prj_h3voMtzXGfqG6QTodR5d1VTcC1zP
**Canonical TEST-URL:** https://liquid-hr-hr-suite.vercel.app
**Applicatieversie:** 1.20261120.1

## Bron en deployment

De lokale hoofdmap staat op branch main. Na de release-readback waren lokale HEAD, GitHub main, Vercel platformSourceSha en runtime sourceSha exact gelijk. De deployment was READY op het Production-target van het bestaande Vercel-project; dat target is de synthetische TEST-omgeving. Runtime-provenance bevestigde Core TEST-project wnpfloqpjvaacobppbpk. Het bestaande TEST-domein is aan de release gekoppeld. De productcodekandidaat voor deze documentatie-closeout was ca8ea172500b632c009122e22e035cbb0e02e2a4; de uiteindelijke main-commit bevat deze documentatie en dezelfde productcode.

De versie is eenmaal verhoogd. De Vercel Git-deployblokkade bleef actief; er is geen tweede project, Control Plane-deployment, workflow of hook geïntroduceerd.

## Hosted acceptance

| Onderdeel | Resultaat | Resterend bewijs |
| --- | --- | --- |
| Build en provenance | READY / PASS | Exacte source-pariteit en bestaande TEST-runtime bevestigd. |
| HR/Core | PARTIAL | Loginpagina en provenance gaven 200; anonieme gevoelige API-calls gaven 401. SEC-101 post-CONTRACT-bewijs: 44 PASS / 0 FAIL / 1 NOT TESTED. Andere-tenantmatrix ontbreekt. |
| WVP | PARTIAL | Routesmoke slaagde; week-42-code en PMUX-contract zitten in de kandidaat. Persona-lifecycle, documentacties, audit en negatieve scope/API/RLS zijn niet volledig bewezen. |
| Talent | PARTIAL | Routesmoke slaagde; TAL-INS01/02 zijn lokaal geïntegreerd. Geauthenticeerde matrix en positieve plan-/bewijsrecords ontbreken. |
| Payroll ESS | PARTIAL | Bestaande post-CONTRACT evidence blijft geldig. De volledige kandidaat-ESS-matrix is niet voltooid. |
| Payroll HR Admin | PARTIAL | Bestaande post-CONTRACT 3/3 is historisch bewijs. Op de kandidaat kwam geen HR Admin-personasessie tot stand. |
| Anonieme scope | PASS | Context-, WVP-, Talent- en pro-forma-API-proeven weigerden anonieme toegang met HTTP 401. |

De bestaande payroll-persona-configuratie leverde geen geauthenticeerde kandidaat-sessies op. Dit blijft OPEN als ontbrekend acceptatiebewijs; er is geen bewezen productdefect vastgesteld. Geen accounts, grants, rollen of tenants aangepast, geen auth-bypass gebruikt en geen businessdatawrites uitgevoerd.

## Lokale technische gates

De productcodekandidaat ca8ea172 behaalde HR Suite 4.277 PASS / 8 SKIP, Control 11/11, Payroll-regels 65/65, payroll-kalendercontract 2/2, TypeScript, ESLint, NL/EN, production build, Payroll-bundlescanner en function-tracegate PASS. Bronevidence: [WVP-integratie](WVP-PMUX-WEEK42-INTEGRATION-20261119.md), [Talent-afronding](TALENT-FUNCTIONAL-COMPLETION-20261119.md) en [finale pre-convergentiegate](LIQUIDHR-FINAL-ACCEPTANCE-20261119.md). Ongewijzigde bewezen suites zijn niet herhaald voor de documentatie-closeout.

Gitleaks v8.30.1 is uit de officiële Windows-release gehaald en de checksum is gecontroleerd. De volledige Git-geschiedenisscan vond vier brede generic-api-key-signalen; de scan van de getrackte snapshot vond 53 signalen van dezelfde generieke regel. De locaties zijn op pad en broncontext beoordeeld als documentatievoorbeelden, testfixtures en fiscale/Payroll-rekenconstanten. De getrackte BSN_HASH_KEY-regel in .env.example is leeg. Er zijn geen provider-specifieke credentialmatches gerapporteerd. Scanwaarden zijn afgeschermd; beschermde .env.local-configuratie is niet gelezen.

## Database en rollback

Geen nieuwe migratie of remote databasewrite is uitgevoerd. Core TEST wnpfloqpjvaacobppbpk registreert 603 migraties; Payroll TEST jhgeriucbkfarxiudzfy registreert 19. De Control Plane is niet gedeployed. Bestaande Core-migraties 20261119160230 en 20261119161917 zijn niet herhaald.

Payroll-migratie 20261113073051 is al geregistreerd, maar de exacte historische SQL-bron ontbreekt. De niet-centraal-vrijgegeven kandidaat is niet als die bron gebruikt. Er is geen nieuwe databasecompatibiliteitsblokkade voor deze release vastgesteld.

De vorige READY-post-CONTRACT-deployment dpl_799S2oXST6MgNzW96iBqUnhUQ1RK op SHA 69d29bbe80a5791cf31c1d4966347f756cd10130 is behouden als inactieve rollbackmogelijkheid. Rollback is niet uitgevoerd; compatibiliteit is read-only beoordeeld en geen terugschakeling is bewezen.

## Open acceptance en recovery

- GitHub #101 blijft OPEN voor onafhankelijke andere-tenantacceptatie vóór productiegebruik.
- Bestaande Manager-, Employee-, HR Admin- en Tenant Admin-personas zijn niet volledig geauthenticeerd op de kandidaat.
- Talent-positive records ontbreken; gebruik alleen normale productflows. Een noodzakelijke gedeelde fixture vereist een afzonderlijk bundelmandaat.
- De post-CONTRACT rollbackprocedure is niet uitgevoerd.
- De ontbrekende Payroll-bron voor geregistreerde migratie 20261113073051 blijft een afzonderlijk herstelpunt. Remote migratiehistorie is ongemoeid.

Dit is een beperkte synthetische TEST-release, geen ACCEPTANCE GREEN, commerciële Payroll-vrijgave of Production-klantrelease. Zie [AA-CURRENT](../../AA/AA-CURRENT.md), [AA-OPEN](../../AA/AA-OPEN.md), [AA-ACCEPT](../../AA/AA-ACCEPT.md) en [AA-NEXT](../../AA/AA-NEXT.md) voor de levende status.

## Baseline closeout — 21-11-2026

**Besluit:** Edwin accepteerde de geconsolideerde operationele TEST-baseline. Consolidatie **COMPLETE**; hosted functionele acceptatie **PARTIAL**. De op 20-11 uitgelezen deployment bleef actief op de canonieke TEST-alias, versie 1.20261120.1 en applicatiebron-SHA `3b76be2c614d4e1abbac5f7289925ef8d75eddbd`. Er is geen nieuwe deployment uitgevoerd.

### Lokale testvoorzieningen en persona-run

- De dependencyboom van de bestaande hoofdwerkmap is hersteld met `npm ci --no-audit --no-fund`. `npm ls --workspaces --depth=0` retourneerde succesvol; de lokale persona-configuratiepreflight vond de verwachte configuratie en dependencies. De install gaf een engine-waarschuwing: `@sparticuz/chromium@149.0.0` vraagt Node `^22.17.0 || >=24`, terwijl de lokale runtime Node `22.14.0` is; install en bestaande hoofdworkspace-resolutie slaagden.
- Playwright `TargetClosedError` is gereproduceerd in de Codex-processandbox. Chrome sloot tijdens Crashpad named-pipe-start. De bestaande Playwright CLI opende dezelfde Windows-Chrome normaal via een beoordeelde out-of-sandbox run. Geen Chromium-flags, installatie, productcode of infrastructuur aangepast.
- De bestaande persona-runner is tegen lokaal `localhost` uitgevoerd; dit is nadrukkelijk geen hosted acceptatie. Lisa was BLOCKED door de actieve Jupiter-scopecontrole, Jaap door mislukte contextsubmit/navigatie en Frits doordat de verwachte PFZW/pro-forma-toestand niet werd waargenomen. De runner meldde geen persona PASS. Test Auth en de Payroll role-switch zijn volgens het bestaande contract loopback-only; er was geen ondersteunde hosted persona-sessie. Geen auth-bypass, extra account/grant, businessdatawrite of deployment.
- Geen volledige regressiesuite herhaald; geen productcode gewijzigd. De bestaande bron-/deploymentreadback en eerder geldige kandidaatgates zijn hergebruikt.

### Beschermde Git-inventaris

Inventarisatie is read-only. Bij de remote-readback op 21-11-2026 stond `main` nog op de geaccepteerde releasebron `3b76be2c614d4e1abbac5f7289925ef8d75eddbd`. Geen branches, worktrees of stashes verwijderd, omdat ieder resterend object een actieve PR, niet-gemergede commits, beschermde rollback/recovery, dirty/untracked werk of nog niet beoordeelde unieke lineage heeft.

**Lokale branches (22 naast `main`):** de volgende 19 hebben commits die niet in `main` zitten en blijven behouden totdat inhoud/patch-equivalentie en eigenaar zijn vastgesteld:

`integration/pay-converge-20261018`, `integration/payroll-foundation-20261002`, `recovery/wvp01-local-main-20261029`, `work/BRAND01-20261012`, `work/CAO-PENSION-CORE-01-20261018`, `work/CAO-SETUP-01-20261018`, `work/CAO-SOURCE-01-20261018`, `work/CORE-DB-25P02-01-20261018`, `work/PAYCALC-REAL-01-20261013`, `work/PAYCOMP-EDIT-FIX-02-20261012`, `work/PAYESS-01-20261013`, `work/PAYFULL-01-20261014`, `work/PAYINTEGRATE-01-20261017`, `work/PERF01-A1-20261011`, `work/PRODUCT-PRINCIPLE-01-20261017`, `work/TALENT-CONVERGENCE-01-20261016`, `work/pay-w04-security-acl-hardening-16-20261029`, `work/paylab00` en `work/paytest-auth-01-current-20261013`.

Drie lokale refs zijn geïntegreerd/voorouder van main maar blijven behouden: `work/liquidhr-final-20261116` (gekoppeld aan dirty integratieworktree), `work/payfast-main-holder-20261120` (gekoppeld aan worktree met beschermde `next-env.d.ts`) en expliciet beschermde `work/payroll-p0-p1` (Nmbrs-herstelspoor).

**GitHub-branches (18 naast `main`):** 16 tips zijn niet in main geïntegreerd en behouden hun unieke/onbeoordeelde commits: `docs/aa-lean03-autonomous-approvals-20261013`, `docs/consolidatie34-migration-reconciliation-20261101`, `docs/payfull01-execution-local-20261014`, `docs/payroll-fast-track-20261029`, `docs/payroll-roadmap-recheck-20261104`, `docs/postrelease-20261024-canonical`, `fix/release-gates-20261102`, `recovery/liquidhr-cleanup-11/codex-efficiency-20261016`, `recovery/liquidhr-cleanup-11/config-recovery-blocked-20261021`, `recovery/liquidhr-cleanup-11/paycalc-real-01-20261013`, `recovery/liquidhr-cleanup-11/postrelease-status-20261021`, `work/PAYFULL-01-20261014`, `work/c34-guard-order-20261102`, `work/c34-vercel-final-build-fix-20261102`, `work/liquidhr-performance-recovery-01-20261028` en `work/paytest-auth-01-current-20261013`. Open PR's: #91 op `docs/payroll-roadmap-recheck-20261104`, #53 op `work/liquidhr-performance-recovery-01-20261028`, #31 op `work/paytest-auth-01-current-20261013`.

Twee remote tips zijn voorouders van main maar blijven expliciet beschermd: `recovery/liquidhr-cleanup-11/payroll-p0-p1-local-tip` is het lokale Payroll/Nmbrs-recoveryanker; `release/liquidhr-test-20261119` bewaart de vorige databasecompatibele rollbackbron (`69d29bbe80a5791cf31c1d4966347f756cd10130`).

**Worktrees (4 naast de hoofdwerkmap):**

| Pad / ref | Reden van behoud |
| --- | --- |
| `C:\Users\Edwin\.codex\worktrees\liquidhr-final-integration-20261116\LiquidHR` — `work/liquidhr-final-20261116` | Dirty beschermde `next-env.d.ts` en twee lokale reset-hulpscripts; gekoppelde branch blijft als herstelcontext. |
| `C:\Users\Edwin\.codex\worktrees\payfast-01-20261106\LiquidHR` — `work/payfast-main-holder-20261120` | Beschermde `next-env.d.ts`; gekoppelde branch is voorouder van main en wordt niet weggegooid zolang de worktree dirty is. |
| `C:\Users\Edwin\.codex\worktrees\payfast-lisa-readonly-20261106\LiquidHR` — detached | Uncommitted Payroll source-provider/workbench code, tests en helperbestand. |
| `C:\Users\Edwin\.codex\worktrees\payfast-render-baseline\LiquidHR` — detached | Uncommitted Focus/WVP code en centrale/requirement-documentatie; unieke wijziging blijft behouden. |

**Stashes (3):**

| Stash | Reden van behoud |
| --- | --- |
| `stash@{0}` — no branch | Payrollegebruikerswerk vóór de main-convergence. |
| `stash@{1}` — `work/hr-merge01-20261106` | Tijdelijk geïsoleerde overlappende Payroll-locale-edits. |
| `stash@{2}` — `main` | WVP02-werk en bestaande lokale documentatie. |

Vijf lokale `origin/*` trackingrefs zijn niet meer op GitHub aanwezig (`work/hr-merge01-20261106`, `work/wvp02-20261106` t/m `work/wvp05-20261106`). Ze zijn niet gepruned: hun resterende lineage is nog niet vergeleken met andere beschermde refs.

### Openstaande punten en veilige opruiming

De volgende punten blijven afzonderlijk OPEN: SEC-101 andere-tenantacceptatie; gezaghebbende bronrecovery van reeds geregistreerde Payroll-migratie `20261113073051` zonder fictieve migratie of remote-historywijziging; en een bewezen databasecompatibele rollbackproef. Hosted personaacceptatie, positieve Talent-records en de volledige WVP lifecycle-/rolmatrix blijven eveneens PARTIAL/OPEN.

Alleen de door de lokale Next-run gegenereerde `.next`-output is verwijderd. Verder is geen resterend branch-, worktree- of stash-object aantoonbaar overbodig. De test-runner wijzigde automatisch het beschermde `apps/hr-suite/next-env.d.ts`; herstel naar HEAD werd door auto-review geweigerd omdat dit de niet-gecommitte wijziging zou weggooien in strijd met de expliciete instructie dit bestand niet te wijzigen. Het bestand is daarom behouden.

Manager-MSS en BONUS blijven PARKED. Geen nieuwe feature, branch, infrastructuur, database, account, sleutel, wachtwoordtraject of migratie is gemaakt.

## Addendum: feitelijke postrelease Windows-cleanup — 21-11-2026

Dit addendum vervangt uitsluitend de operationele actualiteit van de eerdere worktree-inventaris. Historische pre-cleanupstatussen hierboven blijven geldig als tijdgebonden bewijs.

- `payfast-01-20261106`: geen unieke commits/productdiffs; automatisch gegenereerde `next-env.d.ts`-drift naar de werkboomeigen HEAD hersteld en schone worktree via normaal Git verwijderd.
- `liquidhr-final-integration-20261116`: geen unieke commits; de twee Jaap-TEST-wachtwoordreset-scripts inhoudelijk beoordeeld en verwijderd, hardlinks naar hoofdconfig en LOCALAPPDATA gecontroleerd, Git-registratie verwijderd. Aanvankelijk procesvergrendeld restpad is later met Windows PowerShell `Remove-Item -Recurse -Force` verwijderd; `Test-Path` bevestigde **False**.
- `payfast-render-baseline`: historische lokale Focus-widget-/AA-/WVP-diffs bewust met expliciet gebruikersmandaat weggegooid; het relevante WVP-follow-upverslag was reeds met SHA-256 naar hoofdmap gekopieerd en de requirementdocumentatie bijgewerkt. Git-registratie en residuele parentmap verwijderd.
- `payfast-lisa-readonly-20261106`: bewust behouden als ene extra worktree met niet-geïntegreerde Payroll-workbench/source-provider/tests/helper. Unieke `0ff689d7` opening-cumulatievenfunctionaliteit is functioneel al in main, maar oude workbench zou technische reason-codes zichtbaar maken. Geen merge zonder product-/securityreview.
- Drie bestaande stashes en canonieke `.env.local`-hardlinks zijn behouden. Centrale main was na de vorige docs-closeout `e2edd2a1`, actieve Vercel-runtime bleef `3b76be2c` READY. De lokale filesystemcleanup wijzigde geen GitHub-productcode, Supabase-database of Vercel-deployment.

**Eindstatus:** consolidatie en fysieke cleanup COMPLETE; hosted persona-/WVP-/Talent-/Payrollacceptatie PARTIAL. SEC-101 andere-tenantbewijs, authentieke bron van geregistreerde Payroll-migratie `20261113073051` en rollbackproef blijven OPEN. Het laatste oude integratiepad is onafhankelijk van Git gecontroleerd met PowerShell `Test-Path=False`.
