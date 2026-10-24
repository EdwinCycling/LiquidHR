# PAY-W01-W03-FORCE-LOCAL-03 — lokale Payroll-browseracceptatie

**Datum:** 24-10-2026
**Verdict:** **LOKALE ACCEPTATIE PARTIAL — W01-readflow daadwerkelijk uitgevoerd; W03 gemeten; volledigheid en conceptstrook blijven OPEN. Hosted acceptatie blijft afzonderlijk OPEN.**

## Context en methode

- Repository: `LiquidHR-Payroll`; bestaande veilige werkboom `PAY-HOSTED-R1-W01-W03-01`, branch `work/pay-w00-shared-build-01-20261024`, HEAD bij start `da1654d90deb3352d62ab5b09b7f14fd1d29c6c7`.
- Lokale TEST-app gestart met de bestaande `scripts/start-test-worktree.ps1` op vrije loopbackpoort `51518`, Development-modus, met de bestaande Payroll-acceptatieopties. De launcher preflight slaagde. Na de browserproeven is de server gestopt en is poort 51518 gesloten.
- Browser: geïnstalleerde `playwright-core` en headless Chrome, nieuwe geïsoleerde browsercontext. Er is via `/local/sign-in` daadwerkelijk aangemeld met de bestaande TEST HR Admin. De Employee-controle gebruikte de bestaande persona-keuze op `/local/personas`; er zijn geen accounts, grants of geheimen aangemaakt of gewijzigd.
- Heruitvoering in de zichtbare Codex-browser: op `/local/sign-in` is **HR Admin openen** gebruikt; de lokale persona-pagina toonde `TENANT_ADMIN` en de werkcontext is daarna op De Sterren holding · Planeten gezet. Via `/local/personas` is de bestaande optie **Payroll — Lisa** geopend en dezelfde werkcontext gekozen; de app bevestigde de Lisa-sessie. Dit gebruikt uitsluitend de bestaande lokale TEST-flow.
- HR Admin-scope uit de bestaande TEST-context: tenant De Sterren holding (`07249eb9-545c-883b-b26b-d52f83b4f4a1`), HR-groep Planeten (`6ba6f1df-e376-40f2-abff-ffdf000172e1`), administratie Jupiter BV (`8483abc9-f275-c80b-5a23-fedc54ce9f0a`). De contextreadback toonde de bestaande `TENANT_ADMIN`-rol, 3 HR-groepen, 5 administraties en geen actieve grants naar andere tenants.
- Alleen bestaande runs, status, strookbytes en schermen zijn gelezen. Geen Payroll-berekening, review, runcreatie, finalisatie, migratie of Payroll-businessdatawijziging uitgevoerd. Login, sessie/contextselectie en persona-handoff gebruikten wel de bestaande auth/context-routes.

## W03 — `/payroll/runs`

Desktopviewport 1440×900, drie afzonderlijke geauthenticeerde navigaties. “Zichtbaar” is de eerste zichtbare runlijst; “volledig” is de geladen volledige werkplek inclusief rooster/workbench. Tijden zijn browserwaarnemingen in de lokale Development-server en vormen geen hosted of productie-SLO.

| Meting | Runlijst zichtbaar | Werkplek volledig | Runs | Roosteritems | Werkplek/overzicht/batch | Horizontaal |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Desktop 1 | 45.787,8 ms | 45.806,5 ms | 14 | 209 | aanwezig | geen overflow; documentbreedte 1440 px |
| Desktop 2 | 25.761,7 ms | 25.784,4 ms | 14 | 209 | aanwezig | geen overflow; documentbreedte 1440 px |
| Desktop 3 | 26.053,4 ms | 26.068,5 ms | 14 | 209 | aanwezig | geen overflow; documentbreedte 1440 px |
| Mobiel 390 px | 78.200,5 ms | 78.205,1 ms | 14 | 196 | aanwezig | geen overflow; documentbreedte 390 px |

In alle vier lezingen stonden de bestaande Lisa- en Jaap-runs in de lijst met de UI-status “Geslaagd”. De runlijst bleef 14 rijen. **Open volledigheidsverschil:** de werkplek toont 209 roosteritems op desktop en 196 op 390 px. Dat is niet verklaard; W03 volledigheid is daarom niet PASS. Metingen zijn lokaal en bevatten geen warm-up/SLO-correctie.

## W01 — bestaande run, strook en autorisatie

- HR Admin kon de lijst en bestaande rundetails openen. Jaaps bestaande run `e20e0345-90ac-489b-9fee-7610b2d8f6a3` (oktober 2026, `SUCCEEDED`/`CONCEPT`) gaf detail-HTTP 200. De conceptstrooklink ontbrak in de UI; de preview-GET gaf HTTP 404 met `PAYROLL_CONCEPT_PAYSLIP_UNAVAILABLE`. **Conceptstrook-read is OPEN en niet als geslaagd aangemerkt.** Er is geen preview/PDF aangemaakt.
- Lisa’s bestaande run `57ac6c10-7a02-49c4-a588-2ca244e621d9` was `FINALIZED`. HR Admin kon de bestaande PDF ophalen: HTTP 200, 33.174 bytes, SHA-256 `41a84b88ebd06b01eb49802002a14d20f7170eb58628bd884f6d8c5472f1e82a`.
- Na de bestaande persona-handoff naar Employee Lisa laadde `/my-salary` op desktop en 390 px (HTTP 200) met alleen oktober 2026 en één eigen PDF. De eigen PDF was HTTP 200, 33.174 bytes en had exact dezelfde SHA-256 als het door HR Admin gelezen FINALIZED-artifact. Geen finalisatieactie was zichtbaar. Mobiele detailweergave had geen horizontale overflow.
- Als Lisa gaf `/payroll/runs` een HTTP 200-shell maar de bestaande lijst- en werkplekfoutstaten: “Je hebt geen toestemming om salarisruns van deze administratie te bekijken”, nul runrijen en geen workbench. Een directe GET naar Jaaps concept-preview gaf voor Lisa HTTP 403 met “Je hebt onvoldoende rechten voor deze actie”; er kwamen geen previewgegevens terug. De HTTP 200 van de pagina is dus geen bewijs van run-data-autorisatie.
- Lisa heeft volgens de bestaande persona-catalogus ook `DIRECT_MANAGER`-toekenningen; haar startpagina toont een team van drie medewerkers. De afgebakende Payroll-negatieve probe voor Jaap is nu uitgevoerd en denied. Een afzonderlijke manager-teamdossier/read-scope-proef is niet uitgevoerd en blijft OPEN. Er is geen Jaap- of Frits-persona-login geprobeerd.

## Open punten en scheiding van gates

1. **Lokale W03 volledigheid OPEN:** onderzoek waarom de mobile werkplek 196 rosteritems toont tegenover 209 desktopitems, en herhaal alleen de read-only volledigheidscontrole.
2. **Lokale W01 conceptstrook OPEN:** de bestaande Jaap-conceptpreview ontbreekt en de preview-route retourneert 404. Diagnoseer de bestaande guard/source-state; creëer of finaliseer geen run om dit te omzeilen.
3. **Manager teamdossier-scope OPEN:** Lisa heeft bestaande `DIRECT_MANAGER`-toekenningen. De Payroll-runlijst en Jaaps cross-employee concept-preview zijn geweigerd, maar een afzonderlijke Manager-teamdossier-readcheck is niet uitgevoerd.
4. **Hosted gate OPEN:** deze resultaten zijn uitsluitend van de lokale loopback Development-app. Ze bewijzen geen gehoste login, hosted actor/scope, hosted routegedrag of hosted performance. Zie [PAY-W00-AUTH-UNBLOCK-01](PAY-W00-AUTH-UNBLOCK-01-20261024.md); geen hosted sessie of deployment is gebruikt.
5. Bestaande `SOURCE_GAP`-meldingen blijven fail-closed. Er is geen netto, fiscale, pensioen- of werkgeversuitkomst geconstrueerd.

## Bewijsgrenzen

Playwright-browserwaarnemingen en directe read-only HTTP-responses zijn in deze lokale run vastgelegd; de PDF-bytegelijkheid is op lengte en SHA-256 gecontroleerd. Geen ruwe cookies, tokens, wachtwoorden of configuratiewaarden zijn in dit rapport opgenomen. Er is geen onafhankelijke hosted controle, productiebuild of nieuwe regressiesuite onderdeel van deze browseracceptatie.
