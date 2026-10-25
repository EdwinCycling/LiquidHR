# PAY-W03-TIMELINE-OPT-06 — begrensde timeline-reads

**25 oktober 2026 — W03 LOCAL PARTIAL; HOSTED OPEN.** De requestreductie en functionele gelijkwaardigheid zijn bewezen. Een herhaalbare winst in totale werkpleklatency is niet bewezen. Twee gerichte optimalisaties zijn onderzocht; de eerste tabelbatchvariant is behouden.

## Werkcontext en afbakening

- Bestaande worktree `PAY-HOSTED-R1-W01-W03-01`, branch `work/pay-w01-w03-defect-close-04-20261024`; schone begin-HEAD `0d549687488e4c415c31414d0aa953129d43491b`.
- Codecommit `b4a2cbc2ce18e319fbcd36b64ebab023d8a2f500`. Read-only `git ls-remote origin refs/heads/main` bevestigde `630df89c84bc2be4774072d387ecb5dc7df10f91`. Geen andere worktree of W02-branch gewijzigd.
- Alleen de timelinebronketen is gewijzigd. De 39 canonieke snapshots, OPT-05-tax-/Actual Work-batches, rekenregels, autorisatie en immutable Payroll-history zijn behouden.

## Vastgestelde oorzaak en gekozen wijziging

De oorspronkelijke timelineprojectie las per employee-/employment-paar afzonderlijk zeven tabellen: `employments`, `employment_contracts`, `employment_labor_conditions`, `employee_organizations`, `employment_salaries`, `employment_schedules` en `employment_pension_arrangement_assignments`. Voor 39 doelen waren dit 273 REST-requests. De identieke scope en tabelvorm werden steeds opnieuw naar Core gestuurd. De taxbatch startte pas na deze timelineprojecties.

Een nieuwe meting op de oorspronkelijke code gaf 7.931 ms timeline en 2.044 ms tax; de eerdere OPT-05-meting van de gecombineerde fase was 15.687 ms. In de nieuwe baseline hadden contracts/employments/labor/organization elk ongeveer 27–30 s opgetelde headerwachttijd over 39 gelijktijdig uitgevoerde reads; dit zijn geen fase-wall-times. De afzonderlijke schedule-read piekte op 1.908 ms. De transport-/serverwachttijd domineerde; er was geen upstream-querytijd of `Server-Timing` waarmee database-uitvoering en netwerk konden worden gescheiden.

Gedeelde werkgevers-/pensioen-/CAO-context werd al binnen de geautoriseerde renderrequest hergebruikt. De 32 catalogus-/aanvullende timeline-reads bleven daarom intact. De tax-/IKV-reader was al gebatcht: 50 reads over tien groepen. Zijn lijst van alle effectieve employments en IKV-links per medewerker kan niet veilig worden vervangen door alleen het ene gekozen timeline-employment: ook meerdere gelijktijdige dienstverbanden en actieve IKV-tellingen moeten behouden blijven. Het bestaande hergebruik van tax-income-links bleef intact.

De gekozen service autoriseert elk doel op `salary:read`, `contract:read`, `organization-placement:read` en `job-catalog:read`, vereist dezelfde tenant/HR-groep/administratie en loonperiode en leest groepen van maximaal vier exacte employee-/employment-paren. Drie groepen draaien tegelijk; binnen een groep maximaal vier queryfactories. De normale projectie voert haar bestaande controles opnieuw uit. De authenticated SSR-client, RLS, scopepredicaten en volledige effective-datehistories blijven gelijk. Er is geen nieuwe globale cache of database-RPC.

Per tabel wordt het resultaat teruggepartitioneerd; transportkolommen worden verwijderd voordat de oorspronkelijke projectie ze gebruikt. Een volle limiet, gelijke sorteerdatums of batchfout activeert de bestaande individuele fallback. De bestaande limiet van 100 rijen per doel wordt daardoor niet stilzwijgend veranderd.

| Afzonderlijk gemeten scope | Voor | Behouden variant |
| --- | ---: | ---: |
| Zeven primaire timeline-tabellen | 273 | 70 |
| Overige timeline-/catalogusreads | 32 | 32 |
| Tax/IKV | 50 | 50 |
| Timeline plus tax, Core REST | 355 | 152 |
| Canonieke snapshots | 39 | 39 |

Dit is 203 minder REST-requests (57%) in deze fase. Actual Work, latere Payroll-setupreads, Payroll Lab en browserresources vallen buiten deze teller. Dit is geen telling van onderliggende SQL-deelplannen en is niet rechtstreeks vergelijkbaar met de eerdere 367 requests voor de bredere bronfase of 790 volledige-route-requests.

## Zes metingen van de behouden code

Bestaande launcher, vrije loopbackpoort 51635, Development op Node 22.14.0; bestaande HR Admin via `/local/sign-in`, headless geïnstalleerde Chromium via bestaande `playwright-core` 1.62.1. Scope: De Sterren holding / Planeten / Jupiter BV, periode `2026-10`. De route was al gecompileerd door de pariteitsnavigatie. Tijdens deze reeks waren er geen codewijzigingen of gelijktijdige checks. Navigatie wachtte op documentcommit en daarna op echte zichtbaarheid van de juiste desktop-/mobiele runlijst; de volledige werkplek vereiste de periodesamenvatting en alle 39 medewerkerselectors.

Alle tijden hieronder zijn ms. Iedere trial: HTTP 200, 14 runs, 39/39 unieke employee-/employmentregels, geen overflow of page-error, dezelfde zichtbare gegevens en snapshotdigest. De instrumentatie voegde alleen tellers en timings toe en is verwijderd vóór de finale codecommit.

| Trial | Runlijst zichtbaar | Werkplek volledig | Timeline | Tax | REST-reads in fase |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop 1440×900 — 1 | 3.197 | 13.477 | 3.573 | 2.856 | 152 |
| Desktop — 2 | 4.147 | 16.098 | 6.095 | 1.613 | 152 |
| Desktop — 3 | 3.419 | 14.500 | 4.815 | 2.020 | 152 |
| 390×852 — 1 | 5.233 | 25.124 | 6.387 | 8.974 | 152 |
| 390×852 — 2 | 2.756 | 22.992 | 12.797 | 3.376 | 152 |
| 390×852 — 3 | 14.427 | 36.412 | 12.529 | 3.276 | 152 |

De eerdere OPT-05-werkplektijden waren desktop 11.835/12.990/17.767 ms en mobiel 13.093/12.642/29.781 ms. Deze nieuwe reeks bewijst geen consistente latencywinst tegenover OPT-05; vooral mobiel blijft te variabel. Dit zijn geen gecontroleerde A/B-metingen of gehoste SLO-metingen. Er is geen p95 berekend. De ruwe tellingen en afzonderlijke header-/bodytimings staan in [metrics](PAY-W03-TIMELINE-OPT-06-20261025.metrics.json); headerwachttijd omvat database, gateway en netwerk, en bodytijd omvat transfer/lezing. JSON-parsing is niet afzonderlijk geïsoleerd.

## Tweede en laatste poging — niet behouden

Een relationele read gebruikte de bestaande samengestelde employment-FK's om zes kindtabellen als begrensde left joins per groep op te halen. Er was geen schemawijziging nodig. Dit reduceerde de gemeten fase naar 92 REST-requests; dezelfde 39 timelineprojecties en snapshotdigests bleven gelijk. De volgende zes proeven, na één opwarmnavigatie, gaven echter geen aangetoonde latencywinst:

| Trial | Runlijst zichtbaar | Werkplek volledig | Timeline | Tax |
| --- | ---: | ---: | ---: | ---: |
| Desktop — 1 | 3.077 | 42.667 | 18.151 | 16.792 |
| Desktop — 2 | 2.314 | 34.708 | 15.546 | 10.338 |
| Desktop — 3 | 2.311 | 23.561 | 8.429 | 7.988 |
| 390px — 1 | 2.308 | 22.476 | 11.837 | 2.795 |
| 390px — 2 | 3.371 | 35.102 | 11.622 | 6.700 |
| 390px — 3 | 4.053 | 24.957 | 13.566 | 2.270 |

Ook de ongewijzigde taxfase werd veel trager; dit bewijst geen causale regressie door de joins. Zonder meetbare winst is die extra queryvorm teruggedraaid. De eerste reader is uit de vastgelegde lokale kopie hersteld en de definitieve code is opnieuw geverifieerd. De eerdere browsermetingen gelden voor diezelfde productiecode; alleen meetinstrumentatie en commentaar zijn nadien verwijderd/gewijzigd. Er is geen derde optimalisatiepoging uitgevoerd.

Twee tussentijdse helpers leverden geen geldige reeks: één miste een verwachte meetmarker in de React-console en één had een te korte vaste navigatiewacht bij sign-in. Tijdelijke servermetrics en het volgen van de gewone contextkeuze of reeds gekozen context herstelden de meetkoppeling. Deze gevallen zijn niet als productfout of geslaagde meting geteld.

## Gegevens, autorisatie en bestaande PDF

- Live vergelijking van de 39 oorspronkelijke en gebatchte timelineprojecties was exact gelijk, inclusief datums en provenance: digest `93f120ac93fa1b1eeeb807eb63741dc4df30cfd01483c963221564f843ee70e0` voor beide varianten.
- Alle twaalf geldige trials behielden snapshotdigest `0964b63039cc7228cc5b7ea4f0b483e87ee4061ecc2530e31af304435b9a85be` over bronhashes, version vectors en SOURCE_GAP-lijsten. De runlijst-/werkplekdigests waren `2f6eeb9262bd713320593937b5f4b0920db9fb461ad1e268e39ee453eb8c6a4c` en `5825a28b4fa8191c45e3d4c54fd1dc8d57ecb522a5737b20b9eda9dc4d030298`. Dit hashformaat is niet hetzelfde als oudere rapportformaten; alleen gelijk gedefinieerde digests worden vergeleken.
- De nieuwe regressies bewijzen projectiegelijkheid, historische volgorde, begrensde queryaantallen, exacte paarpartitionering, mixed tenant/HR-groep/administratie, geweigerde medewerker, gemengde periode, limiet-/tie-fallback, ontbrekend employment, leesfouten en onveilige filteridentifiers. Bestaande Manager-/Employee-/tenantnegatieven, Payroll-lifecycle, broncontracten en Retail R1/R2-regressies slaagden. De eerder uitgevoerde Manager-teamscope-PASS is historisch bewijs; een nieuwe live Manager- of Employee-handoff en een live foreign-tenantpersona zijn niet in OPT-06 uitgevoerd.
- HR Admin las Lisa's bestaande FINALIZED-artifact via de normale GET-route: HTTP 200, 33.174 bytes, SHA-256 `41a84b88ebd06b01eb49802002a14d20f7170eb58628bd884f6d8c5472f1e82a`, exact gelijk aan het eerdere W01-bewijs. Er is geen PDF gegenereerd of geschreven.

## Kwaliteitsgates en bestanden

- Finale kandidaat: **193/193 tests in 28 bestanden PASS**; HR Suite TypeScript **PASS**; ESLint op de vier gewijzigde source-/testbestanden **PASS**; `git diff --check` **PASS**. Geen zichtbare taalwijziging of dependencywijziging.
- Volledige root `npm run build`: **PASS**, exit 0, op codecommit `b4a2cbc2ce18e319fbcd36b64ebab023d8a2f500`, bestaande Node 24.22.1 en dezelfde W02-buildcontext met `.next/payrun01-acceptance-20261009`. HR Suite **339/339**, Control **12/12**; Payroll client-boundary scanner inclusief negatieve controle, PDF/function-trace-allowlist en vereiste runtime-assets **PASS**. De geschreven buildprovenance noemt exact deze code-SHA. Dependencies, configuraties en buildguards zijn niet gewijzigd.
- Gewijzigde product-/testbestanden: `employment-detail-service.ts`, nieuwe `payroll-timeline-batch-reader.ts`, nieuwe `employment-payroll-timeline-batch.test.ts` en `payroll/source/liquid-hr-source-provider.ts`. De tijdelijke Supabase-fetchwrapper en alle `[DEBUG-opt06]`-instrumentatie zijn verwijderd.
- Canonieke TEST-config en persona-credentials bleven ongewijzigd; de bestaande launcher kon ze via de gewone hostcontext veilig laden. De vroegere sandbox-`LOCALAPPDATA`-melding bewijst geen ontbrekende originele configuratie. De door de build gegenereerde Focus-widgetbron is exact hersteld. Beide `next-env.d.ts`-bestanden zijn ongewijzigd ten opzichte van HEAD; HR Suite SHA-256 `1b59d4c6b83807db275d43f3cf2cc8e9323f465fab764eea091cc5becd5bad37`.
- Alleen gewone lokale auth-/contextacties en bestaande gegevensreads; geen Payroll-businessdatawrite, berekening, nieuwe run, finalisatie, migratie, rechtenwijziging, push, merge of deployment. De eigen server is gestopt; andere servers/worktrees zijn niet aangeraakt.

**W03 LOCAL: PARTIAL.** Functionele gelijkwaardigheid en minder requests zijn bewezen; een vast performancebudget, afzonderlijke database-/netwerktiming en herhaalbare latencyacceptatie blijven OPEN. Er is niet vastgesteld dat verdere verbetering uitsluitend een RPC/schemawijziging vereist; er is daarom geen onbewezen RPC-ontwerp als noodzakelijke oplossing opgevoerd. Stop na de twee toegestane pogingen. **W01 LOCAL blijft PARTIAL** wegens de bestaande Jaap-previewgap. **HOSTED en issue #39 blijven afzonderlijk OPEN**, zonder nieuwe hosted claim of externe wijziging. Geen nieuwe roadmap-wave gestart.
