# PMUX-04R5 — Screenshotindex (22 oktober 2026)

De browsercaptures hieronder zijn echte Codex In-App Browserbeelden die tijdens PMUX-04R5 inline zijn getoond. De browseromgeving blokkeerde de lokale PNG-downloadroute. Daarom zijn alle beoogde PNG-bestanden hieronder eerlijk als NOT CAPTURED gemarkeerd; inline weergave is geen bestandsevidence.

| ID / bestand | Persona | Route / viewport | Inline capture | PNG-status |
| --- | --- | --- | --- | --- |
| 01-D — PMUX04R5-01-D.png | HR Admin | Processtudio, 1440×900 | Ja | NOT CAPTURED |
| 01-M — PMUX04R5-01-M.png | HR Admin | Processtudio, 390×844 | Ja | NOT CAPTURED |
| 02-D — PMUX04R5-02-D.png | HR Admin | Formulierenstudio, 1440×900 | Ja | NOT CAPTURED |
| 02-M — PMUX04R5-02-M.png | HR Admin | Formulierenstudio, 390×844 | Ja | NOT CAPTURED |
| 03-D — PMUX04R5-03-D.png | Employee | /work?view=REQUESTS, 1440×900 | Nee | NOT CAPTURED — persona niet getest |
| 03-M — PMUX04R5-03-M.png | Employee | /work?view=REQUESTS, 390×844 | HR Admin-context getoond | NOT CAPTURED — Employee niet getest |
| 04-D — PMUX04R5-04-D.png | Employee | /focus/aanvragen, 1440×900 | Nee | NOT CAPTURED — route gaf 404 in HR Admin-context |
| 04-M — PMUX04R5-04-M.png | Employee | /focus/aanvragen, 390×844 | Nee | NOT CAPTURED |
| 05-D — PMUX04R5-05-D.png | Manager | /work, 1440×900 | Nee | NOT CAPTURED — persona niet getest |
| 05-M — PMUX04R5-05-M.png | Manager | /work, 390×844 | Nee | NOT CAPTURED |
| 06-D — PMUX04R5-06-D.png | Manager | /focus/werk, 1440×900 | Nee | NOT CAPTURED — persona niet getest |
| 06-M — PMUX04R5-06-M.png | Manager | /focus/werk, 390×844 | HR Admin-context getoond | NOT CAPTURED — Manager niet getest |
| 07-D — PMUX04R5-07-D.png | Employee of Manager | /settings/process-automation, 1440×900 | Nee | NOT CAPTURED — toegangsweigering niet getest |
| 08-D — PMUX04R5-08-D.png | HR Admin | /local/personas, 1440×900 | Ja | NOT CAPTURED |

Screenshots zijn uitsluitend diagnostisch. Geen capture uit deze index telt mee als PMUX-04-eindacceptatie of als vervanging van de eerdere 35 geplande bewijsmomenten.
## Vervolgcaptures — live herstart 22-10-2026

| Diagnostische capture | Persona | Route / viewport | Wat zichtbaar was | PNG-bestand |
| --- | --- | --- | --- | --- |
| R5-H01-D | HR Admin | Processtudio, 1440×900 | Recepten en procesoverzicht bovenaan; niet de flowkaart zelf | NOT CAPTURED |
| R5-H02-D | HR Admin | Formulierenstudio, 1440×900 | Gekoppeld formulier, sectie/velden en participantrechten; gepubliceerde versie alleen-lezen | NOT CAPTURED |
| R5-H02-M | HR Admin | Formulierenstudio-route, 390×844 | Bovenkant pagina/receptcatalogus; editorvelden buiten beeld | NOT CAPTURED |
| R5-H03-M | HR Admin | /work?view=REQUESTS, 390×844 | Nieuwe aanvraagkaarten en bestaande native starters; niets gestart | NOT CAPTURED |
| R5-H06-M | HR Admin | /focus/werk, 390×844 | Bestaande werkkaarten en Focus-navigatie | NOT CAPTURED |
| R5-H08-D | HR Admin | /local/personas, 1440×900 | TENANT_ADMIN en lege accountkeuze; de targetnamen kwamen alleen uit de AX-boom | NOT CAPTURED |

Deze beelden zijn alleen inline in Codex getoond en zijn geen PNG-bestanden. Ze bewijzen geen Employee- of Manager-presentatie of -rechten.

## Bestanden vastgelegd tijdens de live herstart — 22 oktober 2026

Deze vijf PNG’s zijn echte screenshots uit de afzonderlijke Codex In-App Browser. De captures zijn diagnostisch en tonen uitsluitend de bestaande HR Admin-context en bestaande TEST-procesdefinities. De overige geplande Employee-, Manager- en toegangsweigeringcaptures blijven `NOT CAPTURED`.

| ID / bestand | Persona | Route / viewport | Wat zichtbaar is | Status |
| --- | --- | --- | --- | --- |
| R5-LIVE-01-D — `PMUX04-R5-ADMIN-STUDIO-D.png` | HR Admin — TENANT_ADMIN | `/settings/process-automation`, 1440×900 | Bestaande processtudio, recept en procesoverzicht; alleen-lezen gepubliceerde definitie | PNG opgeslagen |
| R5-LIVE-02-D — `PMUX04-R5-ADMIN-FORM-STUDIO-D.png` | HR Admin — TENANT_ADMIN | Formulierenstudio, 1440×900 | Gekoppeld formulier, veldbibliotheek en participantrechten van gepubliceerde Interne overplaatsing | PNG opgeslagen |
| R5-LIVE-02-M — `PMUX04-R5-ADMIN-FORM-STUDIO-M.png` | HR Admin — TENANT_ADMIN | Formulierenstudio, 390×844 | Mobiele veldlijst en participantrechten; lange verticale lijst vereist scrollen | PNG opgeslagen |
| R5-LIVE-03-D — `PMUX04-R5-ADMIN-WORK-D.png` | HR Admin — TENANT_ADMIN | `/work?view=REQUESTS`, 1440×900 | Cataloguskaarten plus native starters; dubbele startpresentatie zichtbaar | PNG opgeslagen; geen actie uitgevoerd |
| R5-LIVE-08-D — `PMUX04-R5-ROLE-SWITCHER-D.png` | HR Admin — TENANT_ADMIN | `/local/personas`, 1440×900 | Servergerapporteerde rol- en toegangsscope en bestaande role switcher | PNG opgeslagen; targetnamen aanvullend bevestigd in AX-boom |

De oorspronkelijke tabel hierboven blijft de status van de eerdere capturepoging weergeven. Deze vijf nieuwe bestanden vullen de HR Admin-diagnostiek aan. De loginpagina is gereed voor owner-handoff; geen owner-, Employee- of Manager-capture is gemaakt.
## PMUX-04R5B — hervatting en oorzaakanalyse (22 oktober 2026)

- De vijf `R5-LIVE` PNG-bestanden hierboven zijn behouden en als bijlagen aan `edwin@editsolutions.nl` verstuurd. Er zijn in R5B geen nieuwe persona-captures gemaakt.
- `/focus/aanvragen`: de route is aanwezig; de eerdere 404 kwam uit de server-side actiezichtbaarheidsguard in de HR Admin-context. Focus-secties worden `notFound` wanneer de actieve context geen employee-profiel/zichtbare actie heeft. Employee-routecapture blijft `NOT CAPTURED`; echte Employee-uitkomst is onbekend.
- Dubbele native starters: op Mijn aanvragen worden de globale headerknoppen én de generieke procescatalogus getoond. De huidige deduplicatie herkent alleen bekende key-prefixes of exacte procesnamen; de bestaande `R5-TEST`-definities vielen buiten die herkenning en bleven als kaarten staan. De eerder opgeslagen `PMUX04-R5-ADMIN-WORK-D.png` toont de dubbele presentatie. Geen code gewijzigd.
- Owner-login op de bestaande IAB-loginpagina is nog nodig voor echte HR Admin/Employee/Manager role-switch-, server-scope-, beheertoegangs- en browsercapturetests. Alle niet vastgelegde rolbeelden blijven `NOT CAPTURED`; securitygate en E2E blijven **OPEN**.
