# PAY-PERFORMANCE-FINAL-OPTIMIZATION-02 — finale meting en acceptatie

**Verdict: HOLD.** De desktop- en mobiele administratiekeuze werken via de normale HR Admin-flow. De 39/39 bronidentiteitspariteit blijft behouden en de bestaande definitieve PDF-hash is opnieuw gelezen. De gevraagde stabiele snelheidswinst is niet aangetoond; de nieuwe warme medianen liggen boven de eerder vastgelegde baseline. Een directe vóór/na-vergelijking van alle opgeslagen bruto-, netto-, werkgeverskosten-, pensioen- en fiscale componentbedragen ontbreekt. Verdere winst uit de 39 openingssaldo-reads vereist controle van de gedeelde providerwijzigingen in actief W04-werk; die afhankelijkheid is niet omzeild.

## Scope en uitvoeringsgrenzen

- Branch `work/liquidhr-performance-recovery-01-20261028`, HEAD `9e553e42a7516e6a93e825e721385e1743b47315`; ongewijzigde productcode-HEAD `5b43acf3514b608364427908d754ef6d1973e0e7`. Baseline: `origin/main` `11ba924b4a726431ae7928cfd8d2201d738893b4`.
- Officiële lokale TestRuntime-launcher, Development op loopback `127.0.0.1:3012`, bestaande synthetische TEST-configuratie; bestaande Core TEST en afzonderlijke Payroll Lab TEST bleven ongewijzigd. Scope voor alle Payroll-metingen: De Sterren holding / Planeten / Jupiter BV, periode `2026-10`, 39 medewerkerregels en 33 zichtbare run-detaillinks.
- Elke meting begon pas na een geslaagde HR Admin-login, normale HR-groepselectie en `/api/context`-readback. Er is geen auth-bypass gebruikt.
- Geen salarisrun, berekening/herberekening, review, finalize, PDF-generatie, TEST-datawrite of migratie. Geen merge, push naar `main` of handmatige Vercel-deployment.

## Mobiele en desktop administratiekeuze

Op 390 px was de mobiele navigatielade bij binnenkomst gesloten; na de normale knop **Open navigatie** werd de administratiekeuze zichtbaar. Via het bestaande formulier slaagden Mars BV en daarna Jupiter BV elk met `POST /api/context/administration` **303**. De daaropvolgende context-read gaf **200** en bevestigde De Sterren holding / Planeten / Jupiter BV. De login gaf 303; de normale HR-groepselectie gaf 200. Dezelfde Mars↔Jupiter-flow slaagde op desktop.

De eerdere “hang” was geen vastgelopen server-POST of auth-probleem. De eerdere browserklik wachtte met een korte standaardtimeout op volledige navigatie; die timeout viel niet samen met de POST. De request-response trace laat de POST en daaropvolgende contextread slagen. De browseracceptatie is daarom hersteld door de flow te meten op de daadwerkelijke response en contextreadback; er was geen productcode- of autorisatiewijziging nodig.

## Metingen

De klok startte op de eerste HTTP-responsecommit na `page.goto`. Runlijsttijd eindigde bij de eerste zichtbare run-detaillink; werkplektijd eindigde zodra de periodeheading en alle 39 medewerkercheckboxes zichtbaar waren. `Cold` betekent eerste Payroll-routebezoek in een verse browsercontext; de lokale developmentserver was al gestart en warm. Dit zijn lokale TEST-developmentmetingen, geen hosted of productie-SLO-resultaten.

| Viewport | Run | Responsecommit ms | Runlijst ms | Volledige werkplek ms |
| --- | --- | ---: | ---: | ---: |
| Desktop 1440×900 | Cold browser | 5.945 | 6.240 | 17.444 |
| Desktop | Warm 1 | 2.830 | 3.109 | 17.301 |
| Desktop | Warm 2 | 2.451 | 2.725 | 12.689 |
| Desktop | Warm 3 | 7.759 | 8.042 | 20.058 |
| Desktop | Warm 4 | 2.366 | 2.654 | 12.950 |
| Desktop | Warm 5 | 2.431 | 2.754 | 15.223 |
| Mobiel 390×852 | Cold browser | 2.962 | 2.994 | 28.917 |
| Mobiel | Warm 1 | 10.689 | 10.989 | 33.526 |
| Mobiel | Warm 2 | 6.310 | 6.588 | 36.835 |
| Mobiel | Warm 3 | 2.594 | 2.874 | 12.312 |
| Mobiel | Warm 4 | 2.088 | 2.356 | 12.073 |
| Mobiel | Warm 5 | 2.424 | 2.705 | 19.417 |

| Viewport | Warme mediaan runlijst / langzaamste | Warme mediaan werkplek / langzaamste |
| --- | ---: | ---: |
| Desktop | **2.754 / 8.042 ms** | **15.223 / 20.058 ms** |
| Mobiel | **2.874 / 10.989 ms** | **19.417 / 36.835 ms** |

De definitieve baseline in de eerdere recovery-evidence had twee warme metingen: desktop runlijst mediaan/langzaamste **1.796/1.888 ms** en werkplek **13.596/14.044 ms**; mobiel **2.238/2.609 ms** en **12.053/12.148 ms**. De nieuwe steekproeven zijn groter, maar liggen mediaan boven die kleine baseline. De huidige data bewijzen dus geen performancewinst; vooral de mobiele werkplek heeft hoge spreiding en uitschieters.

Alle twaalf routebezoeken gaven HTTP 200, 33 run-detaillinks en 39 medewerkerregels; geen van beide viewports had horizontale overflow of een browser page-error. De zes navigaties per viewport genereerden 234 `PAYROLL_SOURCE_PROVIDER_GAP`-consoleberichten (39 per route), dezelfde bestaande bron-gaps; dit zijn geen browser page-errors. Gemeten same-origin browser-API-responses: desktop 3 op cold en 2 per warme navigatie; mobiel 2 op cold en 2 per warme navigatie. Dit zijn geen Supabase REST-counts.

De Next-serverroute `/payroll/runs?period=2026-10` logde voor de vijf warme navigaties een `application-code`-duur met mediaan/langzaamste van **15,0/19,9 s desktop** en **19,2/36,6 s mobiel**. De cold-browserroute logde respectievelijk **14,6 s** (plus 2,6 s Next-compilatie) en **28,8 s**. Dit is de volledige serverroutefase inclusief bronopvragingen; het is geen afzonderlijke database-executietijd.

## Bronreads en W04-afhankelijkheid

Instrumentatie die eerder op dezelfde codekandidaat is uitgevoerd registreerde vóór de W03-bundeling 355 timeline/tax REST-requests (waarvan 273 timeline-reads), en erna 152 (waarvan 70 timeline-reads). Een aanvullende bronprobe registreerde employments **61→26**, lifecycle **39→2**, en bleef op **39 openingssaldo-reads**. Die openingssaldo-reads komen uit de gedeelde `loadPayrollSetup`/`listOpeningCumulativeSnapshots`-route. De actuele W04-branch `work/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026` stond bij read-only remote controle op `bc40fce70b5321764ec56a08a1f7d380d8a7d26e`; de GitHub-compare bevestigde directe overlap in `liquid-hr-source-provider.ts`, `payroll-setup-service.ts` en `calculation-repository.ts`. Zonder dependencycontrole en gezamenlijke acceptatie is het niet veilig die reader hier te bundelen; volgens de stopregel is verdere optimalisatie op dit punt daarom gestopt.

De live meetrun gebruikt de response-/DOM-events en Next serverfaseduur. Runtime-injectie om elke Supabase-call opnieuw te tellen werd door de officiële launcher geweigerd; dit is niet omzeild. De bovenstaande query-counts zijn de eerder vastgelegde instrumentatie voor dezelfde codekandidaat, niet een nieuwe per-request live REST-telling.

## Correctheid, bronidentiteit en PDF

- De read-only batch-vs-individueelvergelijking na de `actualWorkType`-volgordecorrectie bevestigde **39/39 source hashes, 39/39 versievectoren en 39/39 gaps**. Die code staat in de ongewijzigde productcode-HEAD `5b43acf...`; HEAD `9e553e...` voegt alleen bewijsdocumentatie toe.
- De bestaande opgeslagen Lisa-PDF is via de normale HR Admin/Jupiter-context opnieuw opgehaald: HTTP 200, `application/pdf`, **33.174 bytes**, SHA-256 `41a84b88ebd06b01eb49802002a14d20f7170eb58628bd884f6d8c5472f1e82a`, gelijk aan het bestaande integratiebewijs. Geen artifact gegenereerd of opgeslagen.
- De Payroll-berekeningsengine, `component_results`-writer en opgeslagen-run detailreader zijn niet gewijzigd; er is geen run- of databasewrite uitgevoerd. Dit ondersteunt dat opgeslagen bedragen niet zijn aangepast, maar vervangt niet de gevraagde volledige vóór/na-export per bestaande run. De eerdere acceptance-evidence bevatte geen baselinebedragen. Bruto/netto-, werkgeverskosten-, pensioen- en fiscale componentbedragen zijn daarom **niet als A/B-pariteit geclaimd**.
- De employment-directorybatch blijft per medewerker `contract:read` autoriseren, valideert tenant/HR-groep/administratie en valt bij ontbrekende/onvolledige batchresultaten terug op de bestaande individuele reader. De gerichte scope-, denied-employee- en fallbacktests slaagden. De eerdere Manager-/Employee-scopeprobes blijven ongewijzigd bewijs; deze meting deed geen cross-tenant selectie.

## Regressie en migration-contracttest

- De zes relevante testbestanden voor Actual Work, Payroll-cycle, payrun repository, source provider, employment-directory en batch-concurrency: **89/89 PASS**.
- HR Suite TypeScript `npm run type-check --workspace @liquid-hr/hr-suite`: **PASS**.
- Volledige HR Suite ESLint `npm run lint --workspace @liquid-hr/hr-suite`: **0 errors, 7 warnings** in ongewijzigde tests `distribution-read-service.test.ts` en `payroll-import/service.test.ts`.
- Officiële productiebuild `scripts/start-test-worktree.ps1 -Mode Production -PayrollAcceptance -Build`: **PASS** op `9e553e...`; Next.js compile, TypeScript, 343 static pages, Payroll client-boundary scan, PDF runtime-trace gates en buildprovenance slaagden.
- De gevraagde employee-directory migration-contracttest: **3 PASS / 2 FAIL**. Eén assertion verwacht een inline `if employment_row.id is null then` waar de migratie de vervangtekst binnen een `$replacement$`-string bevat; de andere verwacht een andere inspringing in een tekstanker. `git diff --exit-code origin/main -- <test> <migration>` bevestigde dat zowel test als SQL byte-identiek zijn aan `origin/main` `11ba924b...`; dit zijn bewezen baselinefails, geen regressies uit PR #53.

## Besluit en publicatie

- **Administratiewissel desktop/mobiel: PASS.** **39/39 bronidentiteit/gaps: PASS.** **Bestaande PDF-hash: PASS.** Gerichte tests, TypeScript, ESLint en build: PASS; twee bestaande migration-contract assertions blijven bekende baselinefails.
- **Performancewinst: HOLD** door hogere medianen dan baseline en grote spreiding. **Componentbedragen A/B: HOLD** omdat de vereiste volledige vóór/na-componentexport ontbreekt. **Opening-saldo-optimalisatie: expliciete W04-afhankelijkheid; gestopt.** Overall: **HOLD**.
- Deze acceptance-evidence hoort bij Draft PR #53 op de bestaande branch. Geen merge of Vercel-deployment uitgevoerd.
