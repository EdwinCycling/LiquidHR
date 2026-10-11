# AA-CURRENT — Current LiquidHR State

Status: **ACTUEEL / LIVING**
Momentopname: 2026-10-11 (historische acceptance-evidence blijft ongewijzigd)

## Actuele releasebaseline — 1.20261011.1

- Appversie `1.20261011.1`; `origin/main` en GitHub `main` zijn op 2026-10-11 read-only bevestigd op `7bc40b46ce18af2a63e2a73d7a0fcfa7a660f865`.
- Laatst eerder gedocumenteerde Vercel `liquidhr`-deployment: `dpl_5F5rFrmcXZ7PT1hp2ACWSiV8FBVV`, **READY** op SHA `c90275c5775a276d5ccd62f563b44372ee78ae11`. Pariteit met de actuele main-SHA is in deze run niet gecontroleerd. Target `production` is de deploymentchannel van de bestaande synthetic TEST-omgeving.
- APIAI-09 featurebranch `work/APIAI-09-MSS-20261011`: runtime-implementatie `6f92c66c019eec4d8fb780f340b966edff755cd2`, test-only vervolgcommit `701f738ad2933e683dbc73a6303afe43883ad89f`. Lokaal gerichte tests, TypeScript, ESLint, i18n en Webpack-productiebuild zijn groen; hosted Manager-auth-/scopeacceptatie en Vercel-readback blijven OPEN. Zie [APIAI-09 acceptance](../quality/acceptance/runs/APIAI-09-20261011.md). Niet gemerged of gedeployed.
- SEC-01 migrationbron `20261011120317_secure_continuous_appraisal_attachment_storage_keys`; read-only TEST-migrationlijst registreert dezelfde naam als `20261011130922`. De historische versies verschillen; niet hernoemen, herschrijven of opnieuw toepassen.
- De geauthenticeerde hosted security-/persona-acceptatie voor SEC-01 blijft **OPEN**. Deployment READY en toepassing op TEST zijn daarvoor geen vervangend bewijs; zie [AA-OPEN](AA-OPEN.md).
- CONTROL02 en de officiële Loonaangifte-XML-import blijven **CANCELLED**. `work/payroll-p0-p1` en de Nmbrs-worktree blijven als afzonderlijk geparkeerd spoor behouden.
- PR #16 is gemerged op `ffdca4822fb4cca6e675d9c969b59a12ca664c51` en bracht de selectief bijgewerkte roadmap/Focus-context mee. PR #13 en de niet-goedgekeurde PR #2 zijn niet gemerged; zie [PR #16](https://github.com/EdwinCycling/LiquidHR/pull/16).

De kandidaatstatus van ONE VERSION op 2026-10-10 is historisch vastgelegd in [het acceptatierapport](../quality/acceptance/runs/ONE-VERSION-20261010.md); die status is niet de actuele main-/deploymentstatus.

> **Statusupdate 2026-10-10:** CONTROL02 en de officiële Loonaangifte-XML-import zijn CANCELLED. Er komt geen vervolgontwikkeling, herstelmigratie of E2E-acceptatie. De interne representatieve import en CONTROL01 blijven behouden; TEST-data en databaseobjecten zijn read-only geïnventariseerd en blijven staan totdat een exact cleanupvoorstel apart is goedgekeurd.

> **PAYLAB update 2026-10-02:** die oudere branchstatus is superseded. PAYLAB00–04 zijn geïntegreerd en browser-geaccepteerd op `integration/payroll-foundation-20261002`, exact accepted HEAD `3ff38bdc4b145dbf1080cf8f0a7f4abd41c2eb96`. De onafhankelijke LUNA MAX-review en desktop/390 px productie-acceptatie zijn GREEN. ONE VERSION gebruikt kandidaatversie `1.20261002.1`; de gezamenlijke TEST-release blijft pas RELEASED nadat main, Vercel en hosted smoke exact zijn geverifieerd. Zie `docs/quality/acceptance/runs/ONE-VERSION-20261002.md`.

## Canonieke repository

- Repo: `EdwinCycling/LiquidHR`
- Canonieke branch: `main`
- Canonieke Vercel HR-app: `liquidhr`
- Canonieke Supabase TEST/projectomgeving: `wnpfloqpjvaacobppbpk`
- Eén operationele LiquidHR-omgeving; Vercel “Production” is deploymentchannelnaam.

## Historische canonieke baseline vóór release 1.20261011.1 — 2026-10-10

De volgende deploymentgegevens beschrijven de baseline vóór de release hierboven en zijn behouden als historische context.

- Appversie: `1.20261002.1`.
- `origin/main`: `783999044de83c902e63fefb3587fdbbf99d4de3`.
- Vercel-project `liquidhr` (`prj_h3voMtzXGfqG6QTodR5d1VTcC1zP`): deployment `dpl_A9iNj25sybqbsS5zwghbYBSzYhUR` is READY op exact dezelfde main-SHA. Het targetlabel is `production`; dit project is de bestaande synthetic TEST-omgeving.
- Alias `liquid-hr-hr-suite.vercel.app` wijst naar die deployment; de huidige deployment is als rollback candidate gemarkeerd.
- GitHub main-SHA en Vercel deploymentstatus/alias zijn onafhankelijk gecontroleerd. Vercel CLI-upload toont zelf geen Git-SHA; de schone checkout en gebruikte release-SHA zijn in de Codex-handoff vastgelegd.
- Historische ABS02-baseline vóór convergence: `3a0fc67f84bc7dab0acff732afab597142d59ea9`, appversie `1.20260927.3`.
- **Status:** TEST RELEASED; resterende live security-/persona-/exportacceptatie OPEN, dus geen volledige acceptance GREEN.

### Bewezen bij release

- CONTROL01 payrollruntime: synthetische interne JSON-fixture met IKV 1 en 2 verwerkt; één employee, één conceptdienstverband met `EMPLOYMENT_DRAFT_REQUIRES_CONTRACT_MAPPING`, twee IKV's. 20/20 gerichte payrolltests inclusief veilige resume zonder dubbele employee. De officiële XML/XSD-import is CANCELLED; de interne fixture blijft apart.
- INS01: HR Admin 19 rapporten, Manager 7, Employee 0; directe Bradford-route geeft Manager/Employee geen rapport. CSV-download is gemeld; de laatste inhoudelijke rijscope/filter/formulecontrole blijft OPEN.
- AI01-A: 7 bestanden / 37 gerichte tests GREEN; eerdere remote durability/concurrency-evidence behouden. Live toggle/revocation- en persona-negatives OPEN.
- Control: OWNER werkt; 2 bestanden / 11 tests GREEN. AUDITOR write, invitation reuse/revoke, forged scopes en cross-tenant bootstrap live nog OPEN.
- Kwaliteit: HR full-suite 1.954 geslaagde tests met één PDF-render-timeout tijdens parallelrun; die test geïsoleerd geslaagd in 3,03 s. Geen onjuiste claim van timeoutvrije full-suite-GREEN.
- TypeScript HR/Control, ESLint zonder errors (6 HR-warnings), i18n 41 HR namespaces en 182 Control keys, builds 304 HR / 12 Control routes geslaagd; Vercel HR-build 304 routes.
- Hosted smoke: /login HTTP 200; normale loginopties, Test Auth niet zichtbaar; protected pages redirecten naar login; anonieme /api/context en /api/employees HTTP 401, testauth POST 404.
- Bij de release-closeout geen nieuwe migrations/schemawijzigingen.

Acceptancebron op `main`: `docs/quality/acceptance/runs/CONVERGENCE01-20260928.md`; volg voor de vrijgegeven SHA de releasehandoff van 2 oktober.

## Payroll Lab — PAYLAB00–04 integrated candidate

Payroll wordt niet als aparte gebruikersapp ontwikkeld. Het is een bounded context binnen dezelfde LiquidHR-app/repository, met een pure `packages/payroll-engine` en een aparte Payroll Lab Supabase-database. De geïntegreerde kandidaat is MERGE-READY; de ONE VERSION-releasegate staat hierboven.

Accepted integration:
- branch: `integration/payroll-foundation-20261002`;
- HEAD: `3ff38bdc4b145dbf1080cf8f0a7f4abd41c2eb96`;
- bronworktree `LiquidHR-Payroll/Code` en oude featurebranches blijven behouden; er is geen cleanup uitgevoerd.
- Desktop en 390 px browserflow, M0/NL-2026-runs en traces, 24 SYSTEM-definities, CUSTOMER_FORK bewaren/heropenen, read-only/copy-regels en negatieve auth-/scopeprobes zijn GREEN.

PAYLAB00:
- **ENVIRONMENT-GATED / CLOSED**;
- isolation foundation en separate Payroll Lab-database staan;
- Core bleef ongewijzigd.

PAYLAB01:
- **PARTIAL**;
- server-only source adapter + canonical source snapshot gebouwd;
- live Core→snapshot browserbewijs bleef buiten die slice/open door eerdere auth/environmentissues;
- IncomeRelationship blijft een expliciet onopgeloste Payroll/Core-source gap; CONTROL02 is CANCELLED.

PAYLAB02 / Engine M0:
- **GREEN voor synthetic M0-scope** op 2026-09-30;
- authenticated HR Admin Test Auth browserflow: Payroll → Payroll Lab → Bereken test payroll;
- run `SUCCEEDED`;
- 9 componentresultaten;
- trace;
- 7 controls PASS;
- GC-NL-001 netto € 3.175,00;
- totale werkgeverskosten € 4.910,00;
- herhaalrun met identieke source/input/result hashes;
- SYSTEM / CUSTOMER_FORK / CUSTOMER_CUSTOM ownership + provenance aanwezig;
- veilige bounded typed expression engine aanwezig;
- productiebuild, typecheck, changed-area lint, i18n en client-secret scan GREEN;
- separate Payroll Lab persistence/readback bewezen;
- alleen expliciet goedgekeurde Lab-testcontextkoppeling toegepast;
- geen Core-writes of permissionwijzigingen.

Bewijsgrens:
PAYLAB02 bewijst de generieke componentengine + synthetic vertical slice; deze synthetic GC blijft als regressiecase naast de afzonderlijke PAYLAB03 compliancecase bestaan.

PAYLAB03 / NL 2026 regular monthly wage:
- **GREEN — uitsluitend WHITE/NL/STD/onder AOW/reguliere volledige maand 2026**; loonheffingskorting aan, en korting uit in de geteste formulevariant.
- CC-NL-2026-001: bruto/fiscaal loon € 4.000,00 → echte loonheffing € 818,67 → netto € 3.181,33.
- Systeemregelset `NL-PAYROLL-2026` versie `2026.1`, engine `0.2.0`; SYS-only registered statutory rule, exact Decimal/breukrekenen en expliciet geversioneerde wettelijke rounding stages met volledige trace.
- 21 onafhankelijk vooraf opgestelde rekengevallen, 10 onafhankelijke officiële witte-maandtabelankers; fiscale oracle onafhankelijk van productiecalculator.
- 2 authenticated browserruns SUCCEEDED, 4 componentresultaten en 4 interne PASS-aansluitcontroles per run, persisted trace en identieke source/input/result hashes.
- Gerichte engine/package/app-tests, typechecks, lint, i18n, productiebuild en client-secret scan volgens acceptance report GREEN; geen volledige hr-suite-regressierun.
- Code-SHA lokaal: `5d7e9fc5e19ff4582787b51e0104c885ac83370a`; bewijsregistratiecommit `ab2e1d5`.
- Alleen synthetische Lab-artefacten; geen Core-write/migration/permissionwijziging. Geen push/merge/deployment.
- De actieve Codex-run las destijds AA op `b71d663`, vóór de latere AA-documentatiecommits; lees bij de volgende run de **nieuwste** AA-branch inclusief rounding/iterative/IKV-invariants en de vaste LUNA MAX-subagentregel. Niet automatisch mergen.

**Bewijsgrens:** dit is niet algemene Nederlandse payrollcompliance. Buiten scope: pensioen, werkgeverspremies, VCR/YTD, gedeelde grondslagen, multi-IKV, iteratie, reserveringen, aangifte, boven-Lmax en live Core→IKV-sourceacceptatie. GC-NL-001 blijft als aparte synthetische M0-regressiecase bestaan.

Acceptancebron (lokaal op de Payroll worktree, nog niet op GitHub): `docs/payroll/acceptance/PAYLAB03-NL2026-REGULAR-WAGE-20260930.md`.


## CONVERGENCE01 — na de TEST-release

De vroegere werkstatus, debugging en checkpoints zijn historische informatie en staan in het gedateerde convergence-acceptatierapport. De actueel geldige toestand is hierboven vastgelegd.

**Eerstvolgende taak:** hervat Nmbrs vanuit de bestaande P0/P1-basis en de bijbehorende acceptatiedocumentatie. CONTROL02 wordt niet hervat. Losse `packages/payroll-engine`-ontwikkeling blijft alleen na dependencycheck afzonderlijk te plannen.

**Belangrijk:** `docs/AA/` staat nog op een afzonderlijke documentatiebranch. Rebase/cherry-pick alleen de definitieve AA-bestanden bovenop de nieuwste `main` wanneer integratie expliciet wordt gepland; merge geen oude baselines blind.
