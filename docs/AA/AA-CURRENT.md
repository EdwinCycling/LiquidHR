# AA-CURRENT — Current LiquidHR State

Status: **ACTUEEL / LIVING**
Momentopname hoofddocument: 2026-10-02

> **CONTROL02 2026-10-06:** Draft PR #6 remote head `2dd5cd4...` met lokale pre-action statecontracten, candidate leasefencing, centraal conflictbeleid, plan-/recoverytellingen en contextselector-restyle. 2.282 HR-tests GREEN, 308 route build, 41 NL/EN-namespaces, 154 asset boundaryscan; **geen live Core writer/finalizeroute**, geen toegepaste kandidaat-SQL, geen echte browser-/JWT-acceptatie, geen remote databasebewijs. Migratiekandidaat ledger canonical LF `2A8EB9D8...`, scope unchanged `94C07DEB...`. Geen externe review in single-agent run. **Remote main is nu `38ccbcac...` na APIAI PR #7; appversie nog `1.20261002.1`.** De bestaande CONTROL02 PR's zijn van oudere main afgeleid en vragen aparte convergence. Volg AA-NEXT + AA-OPEN §3D voor de werkelijke volgende gates.

> **CONTROL02 FINAL update 2026-10-05 (latest):** Draft PR #6 is remote geverifieerd open/draft/unmerged/mergeable op `762670b9...`, gestapeld op PR #4, met 39 paden. Server-authoritative persisted decisions, authenticated decisionroutes, freshness/readback, persisted previewplans, race-invalidatie en refresh-safe wizardstate zijn gebouwd. Kritieke run 5/48 GREEN; TypeScript, NL/EN en lint zonder errors GREEN. Full suite: 2.261 tests GREEN, 3 skipped, 1 bestaande server-only timeout; dus niet volledig GREEN. Geen P0/P1 in onafhankelijke review. P2 vóór activering: per-action state-revalidation of transaction/leasebescherming. Migraties zijn niet toegepast en definitieve XML Core-writes blijven uit.

> **CONTROL02 update 2026-10-05:** Draft PR #4 is remote geverifieerd open/draft/unmerged/mergeable, review-snapshot `a5c056ba...`, 53 paden boven `main=6349d025...`. De lokaal gemelde FINAL-build op `495cd02...` is nog niet gepusht/gecontroleerd maar bevat extra matching/idempotency/audit/recovery-hardening met 53 gerichte tests GREEN. Full authenticated XML-browseracceptatie blijft OPEN wegens ontbrekende normale klantcontext; de historische `BSN_HASH_KEY` blijft onbewezen. De scope-invariantmigratie en het gedeelde Core/Payroll-contract blijven reviewgates in PR #4; definitieve XML-writes blijven uit.

> **Actuele richting sinds 2026-10-04 (bronstatus gescheiden):** Remote GitHub `main` is bij controle `6349d02538351cd01fc51f298c6e6fa0ba88006c` / app `1.20261002.1`; ONE VERSION hosted TEST-acceptatie is volgens de release-ownerhandoff GREEN, de onafhankelijke volledige bewijsreview blijft PENDING. Lokale CONTROL02 `38af35c2...` en lokaal gemelde CAO-BENCH02-voortgang zijn **niet automatisch op `main` aanwezig**. CONTROL02 heeft lokaal gerichte XML-/XSD-/previewtests en inmiddels Core TEST-readbacks, maar mist echte volledige browser-/JWT-acceptatie en definitieve Core-/Payroll-contractgoedkeuring; geen merge-ready claim. CAO-BENCH02 is volgens lokale overdracht technisch grotendeels gebouwd, maar admin-isolatiebewijs ontbreekt. **Volg voor de actuele uitvoeringsvolgorde het eerste deel van [AA-NEXT](AA-NEXT.md), voor externe gates [AA-OPEN](AA-OPEN.md).** Historische momentopnamen hieronder vervangen deze actuele status niet.

> **Latere lokale overdracht 2026-10-04 (niet automatisch remote geïntegreerd):** gezamenlijke ONE VERSION hosted TEST-acceptatie is volgens de overdracht afgerond; CAO-BENCH02 fase 2 heeft lokaal zeven persistent uitgevoerde benchmarks, maar blijft PARTIAL wegens ontbrekend Mars-only → Jupiter admin-isolatiebewijs. Zie [AA-OPEN](AA-OPEN.md) voor het gerichte register. Oudere momentopnamen hieronder zijn historische gegevens en mogen niet worden aangezien voor de actuele stand van niet-gemergede featurebranches. Verifieer de exacte status opnieuw bij PAY-CONVERGE.

> **Actueel:** CONVERGENCE01 is als TEST-release vrijgegeven op 2026-10-02. Dit is **geen** claim dat de volledige live security-/persona-acceptatiematrix GREEN is.

> **PAYLAB update 2026-10-02:** die oudere branchstatus is superseded. PAYLAB00–04 zijn geïntegreerd en browser-geaccepteerd op `integration/payroll-foundation-20261002`, exact accepted HEAD `3ff38bdc4b145dbf1080cf8f0a7f4abd41c2eb96`. De onafhankelijke LUNA MAX-review en desktop/390 px productie-acceptatie zijn GREEN. ONE VERSION gebruikt kandidaatversie `1.20261002.1`; de gezamenlijke TEST-release blijft pas RELEASED nadat main, Vercel en hosted smoke exact zijn geverifieerd. Zie `docs/quality/acceptance/runs/ONE-VERSION-20261002.md`.

## Canonieke repository

- Repo: `EdwinCycling/LiquidHR`
- Canonieke branch: `main`
- Canonieke Vercel HR-app: `liquidhr`
- Canonieke Supabase TEST/projectomgeving: `wnpfloqpjvaacobppbpk`
- Eén operationele LiquidHR-omgeving; Vercel “Production” is deploymentchannelnaam.

## Actuele canonieke LiquidHR TEST-release — 2026-10-02

- Appversie: `1.20260928.1`.
- `main` / `origin/main`: `cb73260ff0cd83d19fa29e44c9f0b93749fb10af`; lokale `main`-gelijkheid bevestigd in de Codex-releasehandoff.
- Vercel `liquidhr`: deployment `dpl_CANMAQydQcYGy9Xe7JhNm8grJuvH`, READY, targetlabel `production` = onze enige operationele TEST-omgeving.
- Alias: https://liquid-hr-hr-suite.vercel.app/.
- GitHub main-SHA en Vercel deploymentstatus/alias zijn onafhankelijk gecontroleerd. Vercel CLI-upload toont zelf geen Git-SHA; de schone checkout en gebruikte release-SHA zijn in de Codex-handoff vastgelegd.
- Historische ABS02-baseline vóór convergence: `3a0fc67f84bc7dab0acff732afab597142d59ea9`, appversie `1.20260927.3`.
- **Status:** TEST RELEASED; resterende live security-/persona-/exportacceptatie OPEN, dus geen volledige acceptance GREEN.

### Bewezen bij release

- CONTROL01 payrollruntime: synthetische interne JSON-fixture met IKV 1 en 2 verwerkt; één employee, één conceptdienstverband met `EMPLOYMENT_DRAFT_REQUIRES_CONTRACT_MAPPING`, twee IKV's. 20/20 gerichte payrolltests inclusief veilige resume zonder dubbele employee. Officiële XML/XSD-adapter blijft CONTROL02.
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
- IncomeRelationship/CONTROL02 en fiscale source gaps blijven expliciet.

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

**Eerstvolgende taak:** sluit uitsluitend de openstaande Control-, Insights- en AI-live-negatives op de vastgepinde releasebaseline; registreer nieuwe gerichte bugfixes traceerbaar. Daarna pas shared Control-/Core-integratie van CONTROL02 en Payroll Lab plannen. Pure `packages/payroll-engine`-ontwikkeling kan na dependencycheck afzonderlijk parallel.

**Belangrijk:** `docs/AA/` staat nog op een afzonderlijke documentatiebranch. Rebase/cherry-pick alleen de definitieve AA-bestanden bovenop de nieuwste `main` wanneer integratie expliciet wordt gepland; merge geen oude baselines blind.
