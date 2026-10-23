# PAYRUN-PERF-02 — Snellere salarisrunlijst — 2026-10-21

**Verdict: PARTIAL.** De opgeslagen runlijst haalt het voorlopige zichtbaarheiddoel; het volledige werkplekdeel blijft een trage staart. De afzonderlijke **SECURITY HOLD** voor hr-admin/Jupiter blijft actief.

## Uitgangspunt en diagnose

- Branch `work/BRANCH-SPLIT-PAYROLL-20261021`; uitgangs-HEAD `88da58e61fe3363ef1395893b09c01d437be3b79`. Bestaande lokale TEST-server en Chrome-sessie op `127.0.0.1:3010`, Mars BV actief.
- Eerdere routewaarnemingen: 13,8 / 2,9 / 10,3 s. Getagde servermetingen vóór de wijziging: `listPayrollProfessionalRuns()` 0,30–2,47 s; de volledige workspace 2,09–12,39 s.
- De hoogst gemeten workspace had 10 bronprojecties: `getPayrollCycleWorklist()` 8,89 s, waarvan Core-source-snapshots 7,52 s; run-artifactreads 0,83 s. `listScopedEmployments()` 0,43 s en `projectScopedEmployees()` 0,19 s. `listPayrollPeriods()` 0,30 s. De bronprojectie, niet het weergeven van de tabel, was de dominante lange staart.
- Drie acceptance-filters lazen elk 15 generieke inputreferenties afzonderlijk: circa 45 querycalls per route-render. De nieuwe, gescopeerde batchread maakt daar één read per filter van (drie batches totaal); de filtersemantiek en ontbrekende referenties blijven gelijk.
- Na batchread-meting duurde de runlijstservice 0,067–1,413 s; de batchread zelf 0,017–0,106 s. De volledige workspaceprojectie blijft compleet en voert nog steeds de bron-, lifecycle- en artifactreads uit.

## Wijziging en readback

- `/payroll/runs` laadt en autoriseert eerst de opgeslagen runlijst. Daarna streamt de volledige werkplek onder een eigen Suspense-boundary met een loading-state en een eigen toegangs-/foutstate. Er zijn geen runs, perioden, scopes of bronstatussen weggelaten.
- De batchrepository begrenst op payrolladministratie, tenant, HR-groep en gevraagde input-set-ID's; UUID-, opgeslagen-scope-, JSON- en hashvalidatie blijven actief. Er zijn geen indexen, migraties, autorisatie- of berekeningswijzigingen.
- Drie warme controles op dezelfde Mars-sessie: runlijst zichtbaar in **2,81 / 2,17 / 1,89 s**; volledige werkplek gereed in **13,34 / 8,84 / 7,54 s**. Daarmee is de lijst stabiel onder 3 s; de werkplekstaart blijft boven 5 s.
- Elke controle toonde dezelfde 10 rijen (de gehashte tabelinhoud bleef gelijk). `/payroll` toonde 8 recente runs; **8/8** waren aanwezig in de runlijst. Periode, statussen, bestaande werkplekstatussen en aggregate bedragweergave kwamen overeen met de eerdere Mars-readback. Geen berekening, review, finalisatie, PDF-mutatie of databasewrite uitgevoerd.
- De werkplek-loadingstate was zichtbaar terwijl de lijst al beschikbaar was; na voltooiing waren er geen alerts of actieve loading-regio's. De bestaande lege weergave bleef intact; de routefoutstate toont toegangsweigering of een generieke laadfout met retry. Component-, workbench- en viewtests zijn groen. De foutstate is niet door een live fault-injection geforceerd.
- Captured warme serverrequests rapporteerden een Next.js-fase van 3–109 ms; route-rendering van de volledige werkplek bleef circa 7,3–8,7 s in die requests. De ontwikkelcache is niet gewist om een kunstmatige cold-start te maken. De aparte productiebuild compileerde in 16,0 s; dit is buildtijd en geen routeprestatie.
- De bronvalidatiewaarschuwingen zijn bestaande `SOURCE_GAPS_PRESENT`-diagnostiek die in de werkplek als gap/blocked-status wordt weergegeven; ze veroorzaakten geen routefout. `Destination stream errored while writing data` kwam niet voor in de gecontroleerde logs (0 waarnemingen); de eerdere fout is hiermee niet reproduceerd en de oorzaak blijft onbewezen.

## Gates

- Gerichte Payroll-repository-, filter-, cycle-service-, autorisatie-, workbench- en viewtests: **6 bestanden, 51 tests PASS**.
- TypeScript: `npx tsc --noEmit --incremental false` **PASS**. De npm-wrapper probeerde anders `tsconfig.tsbuildinfo` te schrijven en kreeg EPERM.
- Productiebuild: `LIQUIDHR_NEXT_DIST_DIR=.next/payrun01-acceptance-20261009 npx next build` **PASS**; Next-compilatie 16,0 s, TypeScript 64 s, 337 statische pagina's gegenereerd. De build schreef naar de aparte acceptance-dist en liet de bestaande bytes van `next-env.d.ts` gelijk.
- De standaard Vitest-tempdirectory gaf EPERM vóór testcollectie. De gerichte en volledige tests slaagden met een tijdelijke `.tmp-payrun-perf-02` in deze worktree; de map is daarna verwijderd. Geen algemene ACL- of sandboxwijziging.
- De verplichte finale full-suitegate: **697/707 testbestanden geslaagd, 4 overgeslagen, 6 failures** (3.455 tests geslaagd, 8 overgeslagen, 6 failures). Vier bestaande 5-seconden-timeouts in persona-link-, manager-scope-, payroll-calendar- en startpage-count-tests slaagden in de gerichte zes-bestandenherhaling. Twee autorisatietests bleven reproduceerbaar falen: `protected-get.test.ts` en `development-plans-handler.test.ts` verwachten 403 maar krijgen 200 wanneer een HR Admin de exacte self-permission al in de AuthContext heeft terwijl de DB-self-permission ontbreekt. De betreffende auth-code is niet gewijzigd; deze gate is geen PASS en vereist een afzonderlijk auth/securitybesluit.
- De Jupiter-keuze/toegang van `hr-admin` is hier niet opnieuw getest of gewijzigd. De eerdere SECURITY HOLD blijft volledig van kracht; deze functionele performancecontrole is geen persona- of securityacceptatie.

## Provenance

- Codecommit: `30c2223f4cdee640fec5ec97f6cc17e0824ea3dd` (`PAYRUN-PERF-02: stream run list and batch references`). Buildinhoud was gelijk aan deze codecommit.
- Gewijzigde productbestanden: route `payroll/runs/page.tsx`; `payroll-acceptance-scenario.ts` en test; `payroll-cycle-service.ts` en test; `payroll-professional-run-service.ts`; `payroll-professional-service.ts`; `payrun01-repository.ts` en test.
- `next-env.d.ts` bleef buiten de commit; SHA-256 na build: `B8B3A344484B959AF5E4E3FC1A1609DAC3CB9ECE0CDEB6C145BE29BC4C491000`.
- Geen push, PR, merge, databasewrite of deployment.
