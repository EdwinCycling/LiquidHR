# PMUX-04 screenshot review-index — 2026-10-21

**Status: NOT CAPTURED.** Er zijn geen PNG-bestanden in deze run gemaakt. Alle 35 bewijsmomenten blijven open. De browserrun is bij de catalogus/securitygate gestopt; de bestaande switcher bood geen Manager of HR-verwerker. Deze index is een captureplan en geen screenshotbewijs.

Bestandsconventie voor een later afzonderlijk geautoriseerd vervolg: PMUX04-<ID>-D.png voor 1440×900 en PMUX04-<ID>-M.png voor 390×844. Gebruik alleen bestaande synthetische TEST-personas en gegevens. Maak beide formaten waar het moment een gebruikersscherm betreft; voor pure readback/API-momenten is een schermcapture alleen relevant als de UI de uitkomst toont.

| ID | Persona | Route / moment | Verwachte gebruikersactie | Resultaat in deze run | Status voor/na | UX-observatie |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | HR Admin | /settings/process-automation openen | Processtudio vinden | Bestaande proceslijst laadde na lokale codefix | Geen proces aangemaakt | Geen capture; adminpersona niet volledig geverifieerd |
| 02 | HR Admin | Procescatalogus | Opleidingsaanvraag-voorbeeld kiezen | Niet uitgevoerd | Geen draft | Geen Opleidingsaanvraag-readback |
| 03 | HR Admin | Conceptmetadata | Naam, beschrijving, deelnemers/rollen controleren | Niet uitgevoerd | Geen draft | OPEN |
| 04 | HR Admin | Procesflow, desktop | Stappen en verbindingen controleren | Niet uitgevoerd | Geen draft | OPEN |
| 05 | HR Admin | Procesflow, mobiel | Stappenlijst op 390px bedienen | Niet uitgevoerd | Geen draft | Geen mobiel bewijs |
| 06 | HR Admin | Beslisroute | Manager → Employee → Manager-lus controleren | Niet uitgevoerd | Geen draft | OPEN |
| 07 | HR Admin | Formulierenstudio | Secties en vijf velden controleren | Niet uitgevoerd | Geen draft | Geen gepubliceerde formulierdefinitie |
| 08 | HR Admin | Formulierrechten | Participantveldrechten controleren | Niet uitgevoerd | Geen draft | Stapgebonden rechten niet live bewezen |
| 09 | HR Admin | Employee-preview | Preview als Employee bekijken | Niet uitgevoerd | Geen draft | OPEN |
| 10 | HR Admin | Manager-preview | Preview als Manager bekijken | Niet uitgevoerd | Geen draft | Managerpersona niet beschikbaar |
| 11 | HR Admin | HR-preview | Preview als HR bekijken | Niet uitgevoerd | Geen draft | HR-persona niet beschikbaar |
| 12 | HR Admin | Procesproef | Write-free procesproef uitvoeren | Niet uitgevoerd | Geen draft | OPEN |
| 13 | HR Admin | Compilerfeedback | Onvolledig concept veilig laten afkeuren | Niet uitgevoerd | Geen draft | Geen compilerfeedback vastgelegd |
| 14 | HR Admin | Concept opslaan/heropenen | Revision bewaren en teruglezen | Niet uitgevoerd | Geen draft | Geen revision-readback |
| 15 | HR Admin | Publicatie | Immutable versie/audit controleren | Niet uitgevoerd | Geen publicatie | Gate HOLD |
| 16 | Employee | /focus/aanvragen → /work?view=REQUESTS | Catalogus openen en proces vinden | Werkview toonde bestaande Interne overplaatsing | Geen start gedaan | Dubbele startoptie zichtbaar |
| 17 | Employee | Aanvraagformulier | Vijf gepubliceerde velden invullen | Niet uitgevoerd | Geen instantie | Geen Opleidingsaanvraag in catalogus |
| 18 | Employee | Formulierconcept | Concept bewaren en heropenen | Niet uitgevoerd | Geen instantie | OPEN |
| 19 | Employee | Definitief indienen | Aanvraag indienen | Niet uitgevoerd | Geen instantie | Geen aanvraagwrite |
| 20 | Manager | /focus/werk / /work | Dezelfde taak openen | Niet uitgevoerd | Geen instantie | Geen Managerwissel beschikbaar |
| 21 | Manager | Taakdetail | Wijzigingen vragen met reden | Niet uitgevoerd | Geen instantie | Geen decision-/auditwrite |
| 22 | Employee | Teruggestuurde taak | Reden bekijken | Niet uitgevoerd | Geen instantie | Geen correctiestap |
| 23 | Employee | Taakdetail | Een waarde wijzigen en opnieuw indienen | Niet uitgevoerd | Geen instantie | Geen resubmit |
| 24 | Manager | Taakdetail | Dezelfde aanvraag goedkeuren | Niet uitgevoerd | Geen instantie | Geen Managerpersona |
| 25 | HR-verwerker | /work | HR-taak en voorgaande besluiten bekijken | Niet uitgevoerd | Geen instantie | Geen HR-persona/queue-readback |
| 26 | HR-verwerker | Taakdetail | HR-taak afronden | Niet uitgevoerd | Geen instantie | Geen HR-actie |
| 27 | ESS/MSS/HR | Eindstatus en audit | Voltooide workflow controleren | Niet uitgevoerd | Geen instantie | Geen lifecycle |
| 28 | ESS/MSS/HR | /work/[workItemId] | Procesvoortgang/historie openen | Niet uitgevoerd | Geen instantie | Geen historie |
| 29 | Employee | /focus/aanvragen | Mijn aanvragen terugvinden | Alleen bestaande lege toestand gezien | 0 werkitems | Geen screenshot |
| 30 | Manager | /focus/werk | Toegewezen werk en status zien | Niet uitgevoerd | Geen instantie | Managerroute OPEN |
| 31 | HR/Admin | /dashboard/start | Geautoriseerde projectie/tellingen controleren | Niet uitgevoerd voor procesinstantie | Geen instantie | Geen projectievergelijking |
| 32 | ESS/MSS/HR | Historie per rol | Scope van historie controleren | Niet uitgevoerd | Geen instantie | Geen persona-/scopeproef |
| 33 | ESS/MSS | /process-runtime/[workItemId] | Canonieke doorverwijzing controleren | Niet uitgevoerd | Geen instantie | Geen instantie |
| 34 | Employee/Manager | Directe beheer-/API-toegang | Onbevoegde route/RPC moet weigeren | Employee-instellingen eindigden op /geen-toegang; API-negatives niet uitgevoerd | Geen settings-inhoud zichtbaar | De fouttekst was generiek en niet overtuigend rolgebonden |
| 35 | Employee/Admin | Native Leave/Actual Work en starters | Beschikbaarheid controleren zonder mutatie | Niet uitgevoerd in deze run | Geen native mutaties | Geen regressieclaim |

Voor elk ID ontbreken zowel D- als M-capture. De UX-review van de zes vaste criteria en de gezamenlijke producteigenaarbeoordeling blijven OPEN.

## PMUX-04R diagnostische captures — geen acceptancebeelden

Deze drie echte Codex-browsercaptures zijn in de tooloutput van de herstelrun getoond, maar niet als PNG-bestand geëxporteerd. Ze hebben daarom geen worktree-bestandspad en vervangen geen van de 35 D/M-captures hierboven.

| Diagnostisch ID | Persona/context | Route / viewport | Feitelijk zichtbaar | Capturelocatie | Effect op 35 acceptatiebeelden |
| --- | --- | --- | --- | --- | --- |
| PMUX04R-DIAG-01-D | Bestaande Employee-context | `/work?view=REQUESTS&tab=ALL`, desktopbrowser | Geen generieke proceskaart; Verlof en Interne overplaatsing elk één bestaande startknop; geen werkitems | Inline in Codex-browser tooloutput; niet opgeslagen | Geen; alle geplande IDs blijven `NOT CAPTURED` |
| PMUX04R-DIAG-02-M | Bestaande Employee-context | `/work?view=REQUESTS&tab=ALL`, 390×844 | Mobiele diagnostische layout na lokale fix | Inline in Codex-browser tooloutput; niet opgeslagen | Geen; alle geplande IDs blijven `NOT CAPTURED` |
| PMUX04R-DIAG-03-D | Bestaande Employee-context | `/local/personas`, desktopbrowser | Alleen “Terug naar het startaccount”; geen andere persona-actie getoond | Inline in Codex-browser tooloutput; niet opgeslagen | Geen; alle geplande IDs blijven `NOT CAPTURED` |

Status: deze beelden tonen hersteldiagnostiek, geen volledige persona-, proces- of UX-acceptatie. Er is niet teruggeschakeld naar het owner-account omdat de browsercookies voor `127.0.0.1:3011` en de beschermde Payroll-runtime op `127.0.0.1:3010` worden gedeeld.
