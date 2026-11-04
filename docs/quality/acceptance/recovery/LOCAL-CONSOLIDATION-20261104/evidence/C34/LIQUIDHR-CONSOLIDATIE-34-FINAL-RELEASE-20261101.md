# LIQUIDHR-CONSOLIDATIE-34 — Final Release Preflight

**Datum:** 01-11-2026

**Besluit:** **HOLD — Vercel deployment B faalde vóór de applicatiebuild**

**Opdrachtgever:** Edwin

## Voortgangsupdate 01-11-2026

Deze update supersedeert de preflight-status hieronder voor reeds uitgevoerde gates; de oorspronkelijke inventaris blijft als historische preflight behouden.

### Core TEST — A en A2

De bestaande standaard Supabase CLI-context in Edwin's Windows-profiel is door de officiële CLI herkend; `projects list` bevestigde project `wnpfloqpjvaacobppbpk`. CLI-versie `2.122.0`. Vanuit de geïsoleerde reconciliatiewerkmap toonden `supabase migration list` en `supabase db push --dry-run` vóór apply exact deze twee pending migraties en geen C:

1. A `20261030065603_ins_release_02_manager_insights_unblock.sql`
2. A2 `20261030120000_ins_release_04_active_role_permission_guard.sql`

A en daarna A2 zijn met de officiële CLI toegepast. De post-readback toont 593/593 lokale en remote ID's gematcht, precies één registratie van A en A2 elk, geen registratie van C en een lege nieuwe dry-run. Beide SQL-bestanden in de geïsoleerde map waren byte-identiek aan de GitHub-main blobs. De bestaande threshold-reader en wrapper, de aangescherpte permission-helper, EXECUTE-rechten, schema-ACL en relevante RLS-configuratie zijn read-only teruggelezen. Nieuwe helperfuncties hebben geen nieuwe security-advisorbevinding; operationele `absence:read`, `absence:recover` en `absence:write`-rechten bleven aanwezig. De migraties voeren geen tabel-/businessdatawrites uit. Overige projectbrede advisorresultaten zijn niet aan deze nieuwe functies toegeschreven.

### Vercel B — HOLD

Eén GitHub-gekoppelde deployment van main `814d747285c4a69725a1ce5a5a382e288b2d566a` naar het bestaande project `liquidhr` is gestart: `dpl_62jrr4LAdxUrem1ui7tZbSS3uURt`. De clone- en deploymentmetadata tonen dezelfde SHA. De build stopte vóór Next.js in `apps/hr-suite/scripts/verify-build-source.mjs` met `Verified build source unavailable`. De buildlog meldt dat Vercel 306 door `.vercelignore` uitgesloten bestanden verwijderde; inventarisatie van de geselecteerde Git-tree bevestigt exact 306 tracked paden onder `.artifacts/` (141), `.qoder/` (164) en `.mcp.json` (1). Daarmee is een dirty-statusoorzaak aantoonbaar; de buildlog exposeert de waarde van `VERCEL_GIT_COMMIT_SHA` niet, dus een gelijktijdige env-SHA-mismatch is niet uitgesloten.

De mislukte deployment kreeg geen alias. `liquidhr-edwinitsolutions.vercel.app` en `liquid-hr-hr-suite.vercel.app` bleven op de bestaande READY-deployment `dpl_BVSDnuTsJYHCvWnVotw4waxpxJ1n`; rollback-alias `liquidhr-git-main-edwinitsolutions.vercel.app` bleef op READY `dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K`. De actieve TEST-aliassen zijn dus ongewijzigd.

### Gerichte bronfix en vervolgstatus

Een minimale build-guardfix laat alleen worktree-deletions toe die overeenkomen met de actuele `.vercelignore`-regels. Staged deletions, wijzigingen, untracked paden, niet-uitgesloten deletions en platform-SHA-mismatch blijven fail-closed. Gerichte regressietests zijn 3/3 PASS; `node --check` PASS. Een dynamische check herkende 306 van 4.459 tracked paden als Vercel-uitgesloten en bevestigde dat bronwijzigingen en andere deletions nog steeds blokkeren. De fix is commit `4c9197055076fcaf02d7fe1ef98416d7d33ab8c7` op remote branch `work/c34-vercel-build-guard-20261101`; er is nog geen PR en main staat nog op `814d747…`.

De automatische review verwierp het aanmaken van een PR als niet-geautoriseerde remote write wegens het eerdere expliciete PR-verbod en onduidelijkheid over de latere releasemachtiging. Die beslissing wordt niet omzeild. De repaircommit is nog niet op main geïntegreerd; een volgende B-build, C, gehoste acceptatie D en cleanup zijn daarom niet uitgevoerd. GitHub-main, Vercel-aliassen, C-rechten, databasehistorie, bestaande extra worktrees en stashes zijn ongewijzigd. De actieve checkout staat op de repairbranch; Focus-resource, `next-env.d.ts`, `output/wvp01/`, secrets en andere beschermde wijzigingen bleven buiten de commit.

## Scope en oordeel

Edwin autoriseerde de volledige LiquidHR TEST-release: Core TEST-migraties A, A2 en C in volgorde, gecontroleerde deployment naar het bestaande Vercel-project, geauthenticeerde acceptatie, gerichte reparaties, centrale documentatie en cleanup na succesvolle release. Externe Nmbrs-transacties, echte salarisbetalingen, aangiften, onbedoelde FINALIZED-runs en klantproductieacties blijven buiten scope.

De productcode is geconsolideerd. De release is **HOLD** omdat de volledige Core TEST-migratiehistorie niet overeenkomt met de lokale bronhistorie. De opdracht vereiste stoppen vóór databasewijzigingen wanneer extra migraties of schema-/versieverschillen optreden. Daarom zijn A/A2/C niet uitgevoerd; deployment, C, D en cleanup zijn niet gestart.

## Vastgestelde baselines

| Onderdeel | Read-only vaststelling |
|---|---|
| GitHub | `EdwinCycling/LiquidHR` `main` = `814d747285c4a69725a1ce5a5a382e288b2d566a` |
| Appversie | `1.20261023.1` op de gekozen main |
| Supabase Core TEST | `wnpfloqpjvaacobppbpk`, `ACTIVE_HEALTHY`, Postgres 17.6 |
| Remote migratiehistorie | 591 registraties; laatste versie `20261029114914`; A/A2/C alle afwezig |
| Vercel | Project `liquidhr`, `prj_h3voMtzXGfqG6QTodR5d1VTcC1zP` |

De succesvolle full-suite evidence is 4.199 PASS / 8 SKIP op `b77f027c`; TypeScript slaagde. De succesvolle productiebuild staat op `c7dc67ba`. De `apps/hr-suite`-subtree op de gekozen main is identiek aan die op de kandidaat; wijzigingen tussen de build en main veranderen de runtime-appcode niet. Dit bewijs is hergebruikt: geen volledige nieuwe test/build-ronde uitgevoerd.

## Migratiegate — concrete blokkade

De actuele main bevat 577 timestamped SQL-migratiebestanden. Een exacte versievergelijking met de 591 remote registraties toont:

- 55 lokale migratieversies ontbreken onder hun eigen remote ID. Daarvan hebben 40 dezelfde migratienaam onder een afwijkende remote versie; 12 zijn andere lokale migraties; 3 zijn de bedoelde A/A2/C.
- Er zijn dus **52 niet-doelmigraties** die bij gebruik van de volledige lokale migratiemap extra pending zouden zijn.
- 69 remote versies hebben geen exact lokaal SQL-bronbestand. De bron is niet gevonden in lokale refs/stash-objects of in de 15 geïnventariseerde worktrees.
- Er is geen officiële Supabase CLI geïnstalleerd in de uitvoeringscontext. Er is daarom geen [`supabase db push --dry-run`](https://supabase.com/docs/reference/cli/supabase-db-push) uitgevoerd. De officiële Supabase MCP `apply_migration`-route accepteert geen oorspronkelijke migratieversie en kan de vereiste ID's niet veilig behouden; zie de [toolimplementatie](https://github.com/supabase/mcp/blob/main/packages/mcp-server-supabase/src/tools/database-operation-tools.ts) en [documentatie/issue over de timestampbeperking](https://github.com/supabase/mcp/issues/241).

Een geïsoleerde map met alleen A/A2 zou de ontbrekende geschiedenis verhullen en geldt niet als geldige selectie. De juiste vervolgstap is de volledige source-/history-lineage te herstellen en vervolgens een officiële CLI-dry-run op die volledige historie te laten bewijzen dat exact A `20261030065603` en A2 `20261030120000` pending zijn. De verwachte volgorde is A → A2; C `20261030120901` mag pas na succesvolle B-deployment worden toegepast. Geen migration repair, reset of handmatige SQL-write is uitgevoerd.

### Geraadpleegde migraties en security-impact

De drie SQL-bronnen op main zijn byte-identiek aan hun eerder beoordeelde blobs:

- A `20261030065603_ins_release_02_manager_insights_unblock.sql`, blob `6197fa24cea1db9b9113850329f67926c064d99a`: private security-definer threshold-reader met auth-, tenant-, groep- en permission-checks; exposed wrapper is security-invoker. De reader valideert de drempel op 1–20. Grant alleen aan authenticated; geen tabel/RLS-mutatie.
- A2 `20261030120000_ins_release_04_active_role_permission_guard.sql`, blob `7234695fc8c653441ee6be9cb057e0ea0ed8b220`: vervangt de gedeelde permission-helper met checks voor authenticated user, non-preboarding, actieve HR-group access/groep, actieve niet-verwijderde rol, permissioncode en tenant. Revokes PUBLIC/anon/authenticated gevolgd door grant aan authenticated; service-rolebeleid blijft intact.
- C `20261030120901_ins_release_04_manager_insights_activation.sql`, blob `978722f172a74a313afe06ae0488dcba1257d76c`: guarded activatie van alleen `report-absence:read` voor actieve, niet-verwijderde `DIRECT_MANAGER`-rollen, met log van uitsluitend nieuw toegevoegde rechten.

Dit is statische SQL-/read-only evidence, geen post-migratiebeveiligingsbewijs. Voor apply werden bestaande helperfuncties aangetroffen; `anon` had geen EXECUTE en `authenticated` wel, de internal-schema usage stond aan voor authenticated. A-functies en C-activatielog ontbreken. Eén `report-absence:read`-permissionrecord en één actieve Direct Manager-rol zijn aanwezig; die rol heeft deze permission nog niet. Bestaande operationele `absence:read`, `absence:recover` en `absence:write`-permissies zijn aanwezig. Geen post-readback is mogelijk omdat niets is toegepast.

## Deploymentstatus en rollback

Er is geen nieuwe Vercel-deployment gestart. De read-only projectreadback geeft de huidige `READY` deployment:

- `dpl_BVSDnuTsJYHCvWnVotw4waxpxJ1n`, alias `liquidhr-3wib85xex-edwinitsolutions.vercel.app`; Git-commitmetadata ontbreekt.
- `liquidhr-edwinitsolutions.vercel.app` en `liquid-hr-hr-suite.vercel.app` wijzen naar deze deployment.
- `liquidhr-git-main-edwinitsolutions.vercel.app` blijft op eerdere READY deployment `dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K`, waarvan metadata GitHub main-SHA `1c4eb3d1bfe75d8145b87484125fcfcb6605aacf` toont.

De bestaande deployment en rollbackmogelijkheid zijn behouden. De actuele `READY` deployment bewijst niet dat SHA `814d747…` uitgerold is. Geen alias is gewijzigd.

## Acceptatiematrix

| Rol/module | Status op gekozen release-SHA |
|---|---|
| HR Admin | Code aanwezig; geauthenticeerde hosted D-acceptatie OPEN |
| Direct Manager | Code aanwezig; A/A2/C, juiste tenant/direct-team positieven en negatieve scopecases OPEN |
| Employee | Code aanwezig; hosted ESS/MSS- en tenant-/self-scopeacceptatie OPEN |
| Insights, filters, details en exports | Code aanwezig; migratiegate en hosted acceptatie OPEN |
| Verzuim, frequent verzuim en Bradford | Code aanwezig; hosted rol-/tenantacceptatie op nieuwe SHA OPEN |
| WVP01 en PMUX-taken | Code aanwezig; volledige gehoste matrix op nieuwe SHA OPEN |
| Werkkalenders, SLA's en Operations | Code aanwezig; hosted acceptatie op nieuwe SHA OPEN |
| Actual Work en Payroll-bronconsumptie | Code aanwezig; hosted acceptance en actuele bronpariteit OPEN |
| LiquidHR Payroll en pensioen | Bestaande synthetische runs-/conceptstrook-/trace-readbacks en lokale lifecycletests vormen eerder bewijs, niet D-acceptatie op deze deployment. Nieuwe SHA, actuele fiscale/pensioenbron, zelfstandige persona-acceptatie en lifecycle blijven OPEN/fail-closed. Geen run of finalisatie aangemaakt. |
| Nmbrs | Uitgeschakeld; geen externe transacties uitgevoerd |

## Beschermde toestand en cleanup

Geen DB-write, Vercel-deployment, migration repair, payrollmutatie, cleanup, branch-/PR-sluiting of worktreeverwijdering uitgevoerd. De 15 lokale worktrees en 12 stashes zijn behouden. De Focus-resourcewijziging, `next-env.d.ts`, `output/wvp01/`, secrets en lokale configuratie zijn niet aangeraakt. Definitieve cleanup blijft geblokkeerd tot succesvolle release en D-acceptatie; de rollbackdeployment blijft behouden.
