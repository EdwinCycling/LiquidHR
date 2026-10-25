# PMUX-06A1-TEST-RELEASE-09 — Vercel TEST-release

Datum: 2026-10-25
Verdict: **GO — TEST RELEASED, LIMITED; positieve geauthenticeerde acceptance OPEN**

## Scope

- Alleen de bestaande synthetische LiquidHR TEST-app in Vercel-project liquidhr, technisch target production.
- Exacte bron: GitHub main 5ec09687a8394955f0445f931a337be8e9984829; Git tree ea5a8f3bc16926304faac00959d031e828929fa1.
- Geen commerciële productie, andere branch, databasewijziging of nieuwe worktree.
- De release zelf heeft geen Supabase-write of migratie uitgevoerd.
- De lokale Focus-widget- en next-env.d.ts-wijzigingen zijn behouden; geen codebestanden of versies aangepast.

## Preflight

| Controle | Resultaat |
| --- | --- |
| Lokale HEAD, lokale main en live origin/main | Alle exact 5ec09687a8394955f0445f931a337be8e9984829 |
| Bronexport | Schone git-archive van de gepinde commit; Vercel-projectmetadata wees naar project prj_h3voMtzXGfqG6QTodR5d1VTcC1zP |
| Appversie in bron | 1.20261023.1 |
| Supabase Core TEST | 581 migraties; directory-scope, P9-deadline-normalisatie en work-calendars zijn read-only aanwezig |
| Bestaande rollback vóór release | dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K READY op 1c4eb3d1bfe75d8145b87484125fcfcb6605aacf |
| Beschermde Focus-widget | SHA-256 A8134B54351065DB6EFF5CBED717511A979AB85118810DA2941195DF8BAEEAEA, voor/na gelijk |
| Beschermde next-env.d.ts | SHA-256 B8B3A344484B959AF5E4E3FC1A1609DAC3CB9ECE0CDEB6C145BE29BC4C491000, voor/na gelijk |

## Gates

- Eerder geaccepteerde gerichte directory-, role-switch-, P9- en calendar-gates: 157 tests PASS; typecheck, gerichte ESLint, i18n en runnercontrole PASS. Deze SHA is daarvoor niet gewijzigd.
- Finale HR Suite-suite: 3.709 tests PASS, 8 SKIP, 1 FAIL; 746 testbestanden PASS, 4 SKIP, 1 FAIL.
- De enige failing assertion is ESS/MSS Workflow Unification V1: de oude contracttest verwacht dat de compiler SLA_WORKDAY_CALENDAR_REQUIRED gooit. De actuele PMUX-06A.1-regel accepteert DAYS businessDays structureel en faalt gesloten tijdens runtime als voor de scope geen kalender bestaat. De nieuwe kalender-runtimechecks dekken de fail-closed gevallen. Geen productdefect is vastgesteld; assertion blijft OPEN en is niet op de vastgepinde SHA aangepast.
- Vercel production-build eindigde READY. De PDF-function trace-allowlistcontrole PASS; buildprovenance is geschreven voor 5ec09687a8394955f0445f931a337be8e9984829.
- De eerste deploymentpoging dpl_8zsX1bcdwYr9n5qdDjBAFcfuzNLU faalde zonder aliaswijziging, omdat de schone archiefexport geen Git-commit-SHA kon afleiden. De herhaalpoging gaf alleen als build-time provenance-waarde dezelfde geverifieerde commit-SHA door; geen projectvariabelen of applicatiecode zijn gewijzigd.

## Deployment en provenance

| Veld | Waarde |
| --- | --- |
| Deployment | dpl_BVSDnuTsJYHCvWnVotw4waxpxJ1n |
| URL | https://liquidhr-3wib85xex-edwinitsolutions.vercel.app |
| Project / target / status | liquidhr / production / READY |
| Bron-SHA / tree-SHA | 5ec09687a8394955f0445f931a337be8e9984829 / ea5a8f3bc16926304faac00959d031e828929fa1 |
| Appversie | 1.20261023.1 |
| Vercel Git-metadata | meta.githubCommitSha ontbreekt bij deze CLI-archiefdeployment; deploymentbuildlog bevestigt Build provenance written voor de exacte SHA. Dit rapport registreert manifestprovenance conform AA-REL §6 en claimt geen Git-metadata-pariteit. |

### Aliasreadback

| Alias | Actuele deployment |
| --- | --- |
| liquid-hr-hr-suite.vercel.app (canoniek) | dpl_BVSDnuTsJYHCvWnVotw4waxpxJ1n |
| liquidhr-edwinitsolutions.vercel.app (projectalias) | dpl_BVSDnuTsJYHCvWnVotw4waxpxJ1n |
| liquidhr-git-main-edwinitsolutions.vercel.app (branchalias) | dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K; niet door deze CLI-deployment verplaatst |

De oude deployment dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K is nog READY. Rollback kan door de canonieke alias(sen) terug te zetten; er is niet teruggerold. Er zijn geen andere deployment- of aliasacties uitgevoerd.

## Gehoste, write-vrije smoke

Requests gingen naar de canonieke alias en bevatten geen bestaande gebruikerssessie.

| Request | Resultaat |
| --- | --- |
| GET / | 307 naar /dashboard/start |
| GET /login | 200; HTML bevat geen zichtbare appversie |
| GET /settings/work-calendars | 307 naar /login |
| GET /settings/process-automation | 307 naar /login |
| GET /api/settings/work-calendars | 401 JSON |
| GET /api/process-automation/recipes | 401 JSON |
| GET /api/process-automation/studio | 401 JSON |

De anonieme safety-smoke bevestigt dat de calendar- en P9/procesroutes authenticatie eisen. Er is geen positieve geauthenticeerde pagina-/dataread uitgevoerd; de zichtbare versie is daarom uit de exacte gedeployde bron en buildprovenance bevestigd, niet vanuit een ingelogde UI. Er is geen P9 gestart en geen databasewrite gedaan. Positieve geauthenticeerde hosted acceptance blijft OPEN.

## Opslag en terughoudendheid

Vercel-team Usage-dashboard (Hobby) toonde direct vóór en na deployment Deployment Storage 45,1 MB / 10 GB en Functions Storage 169,83 MB / 10 GB; de readback liet geen meetbare wijziging zien. Dit is een teamscope Usage-meting, geen projectspecifieke ZIP-meting.

Geen migratie opnieuw toegepast, geen build buiten deze aangevraagde Vercel-release, geen Preview, geen Vercel-projectinstelling aangepast, geen alias handmatig verplaatst en geen rollback uitgevoerd. De rapport- en indexupdates zijn lokaal en niet gecommit of gepusht.