# PMUX-04R5 — Browserresultaten (22 oktober 2026)

Status: **PARTIAL / HOLD**. De PMUX-runtime is gestart en echte HR Admin-schermen zijn via de afzonderlijke Codex In-App Browser bekeken. Manager- en Employee-acceptatie en screenshotbestanden zijn niet afgerond. Dit rapport vervangt de eerdere PMUX-04- en PMUX-04R-evidence niet.

## Werkboom en runtime

- Werkmap: de aangewezen PMUX-worktree. Branch work/BRANCH-SPLIT-PMUX-20261021, HEAD e6edb1aac70986cd96d3b8c9f5c69aa0272fc587.
- Vóór de serverstart was apps/hr-suite/next-env.d.ts schoon en gelijk aan HEAD (SHA-256 1B59D4C6B83807DB275D43F3CF2CC8E9323F465FAB764EEA091CC5BECD5BAD37).
- De ondersteunde start-test-worktree.ps1-launcher startte Development op 127.0.0.1:3011; centrale TEST-configuratie meldde aanwezigheid zonder waarden te tonen. /login gaf HTTP 200.
- Na serverstart wijzigde Next uitsluitend de twee gegenereerde imports naar .next/dev/types. Na de run is alleen dat bestand naar HEAD hersteld; eindstatus toont geen wijziging aan next-env.d.ts.
- De server is gestopt na de browserrun; poort 3011 antwoordt niet meer. Poort 3010 is niet benaderd of gewijzigd.
- Er bleven de reeds bestaande R4-wijzigingen aan het R4-acceptatierapport en de R4-index behouden. Geen reset, checkout, rebase of cleanup uitgevoerd.

## Aanmelding en rolcontext

- De bestaande lokale TEST-loginroute /local/sign-in toonde de knop “HR Admin openen”. Die startte de normale bestaande Supabase-authenticatie voor de HR Admin-testpersona; Codex heeft geen wachtwoord, token of cookie gelezen of ingevoerd.
- De normale contextkeuze bood De Sterren holding · Planeten; daarna toonde de applicatie administratie Jupiter BV.
- De geladen /local/personas-pagina meldde server-side actieve rolcode TENANT_ADMIN, beheerdersrolcontrole “zou toegang geven” en lokale bevoegdheidscontrole “toegestaan”.
- Voor deze HR Admin-sessie bood de switcher alleen bestaande Payroll-doelaccounts. Geen daarvan is geselecteerd. Er is dus geen Manager- of Employee-rolwissel uitgevoerd.
- HR Admin is via de normale UI uitgelogd om de bestaande owner-loginroute vrij te maken. De browser staat op /login?next=%2Flocal%2Fpersonas. De owner-login is niet door de gebruiker afgerond. Manager/Employee- en toegangsweigeringstests zijn daardoor OPEN.
- Een kortdurende melding “Kies een HR-groep waartoe je toegang hebt” verscheen in de developmentserverlog rond contextselectie. Na de expliciete Planeten-keuze laadden de onderzochte pagina’s; dit is als transient genoteerd.

## Pagina’s en feitelijke uitkomst

| Route | Persona/context | Resultaat |
| --- | --- | --- |
| /settings/process-automation | HR Admin, Planeten / Jupiter BV | Laadde. De Processtudio toonde bestaande definities en stappen. Geen definitie Opleidingsaanvraag stond in het getoonde procesoverzicht. |
| Formulierenstudio binnen dezelfde route | HR Admin | Laadde voor de bestaande definitie Interne overplaatsing, inclusief gekoppelde formuliersecties, velden en participantrechten. De definitie was gepubliceerd; bewerken was uitgeschakeld zoals verwacht. |
| /dashboard/start | HR Admin | Laadde met bestaande dashboardwidgets, waaronder Mijn proceswerk. |
| /work | HR Admin | Laadde na de zichtbare laadstatus; toonde acht werkitems, de bestaande native starters en de bestaande werkvoorraad. |
| /work?view=REQUESTS | HR Admin | Laadde de bestaande catalogus met drie gepubliceerde startkaarten en twee bestaande aanvragen. Geen startactie aangeklikt. |
| /focus/aanvragen | HR Admin | HTTP/UI 404: de route bestaat in deze runtime niet. Employee is niet als rol getest. |
| /focus/werk | HR Admin | Laadde acht werkitems; mobile view toonde de bestaande kaarten en Focus-navigatie. Manager is niet als rol getest. |
| /local/personas | HR Admin | Laadde met servergerapporteerde TENANT_ADMIN-controle; alleen Payroll-doelen waren zichtbaar. |

R5 heeft geen definitie gemaakt of gepubliceerd, geen aanvraag of taak gestart, geen migratie uitgevoerd en geen remote businessdata gewijzigd. De catalogusweergave in HR Admin-context is geen Employee-startautorisatiebewijs. De catalogus-RPC is in deze run niet rechtstreeks met echte Employee-, Manager-, anon- of helpercontext bevraagd. De eerder vastgelegde migratiehistorie-reconciliatie is niet opnieuw remote uitgelezen in R5; PMUX-03B-historie blijft volgens de eerdere evidence nog open.

## Schermbeoordeling

- **Processtudio desktop 1440×900:** de bestaande proceskaarten, rollen en overgangen waren leesbaar. Gepubliceerde definities bleven alleen-lezen. Technische definitiekeys zoals internal-transfer-v2 staan zichtbaar in de proceslijst buiten “Geavanceerd”; dit wijkt af van de UX-eis om technische keys daar te verbergen.
- **Formulierenstudio desktop en 390×844:** formulierkoppeling, velden en participanttoegang waren zichtbaar. Op mobiel stapelen de secties; de herhaalde rechten-tabellen maken de pagina lang en vragen veel scrollen.
- **Mijn aanvragen op 390×844:** de bestaande /work?view=REQUESTS-ervaring toonde native startknoppen én een cataloguskaart met “R5-TEST — Interne overplaatsing”. Dat lijkt een dubbele startkeuze naast “Interne overplaatsing starten” en verdient een gerichte hercontrole; er is niets gestart.
- **Focus werk op 390×844:** kaarten en vaste Focus-navigatie waren leesbaar. De lijst vraagt normaal verticaal scrollen.
- **Geen bewijs voor volledige taakafronding:** zonder Employee- en Manager-context en zonder Opleidingsaanvraag-definitie is niet bewezen dat een medewerker de aanvraag kan afronden of dat onbevoegde rollen beheer geweigerd krijgen.
- De echte Codex-browser toonde captures inline. De poging om ze als lokale PNG-download te bewaren werd door de browser-URL-policy geblokkeerd omdat alleen HTTP(S) is toegestaan. Die route is niet herhaald en er is geen alternatieve export geprobeerd. Er staan daarom geen nieuwe PNG-bestanden op disk; zie de R5-screenshotindex.

## Gates en hervatting

- **Runtime/browser:** gedeeltelijk GO voor HR Admin-pagina’s in de gekozen TEST-context.
- **Manager/Employee-rol- en scopes:** HOLD; owner-aanmelding plus de echte rolwisselingen ontbreken.
- **Live catalogus-/RPC-security:** HOLD; positieve Employee- en negatieve actor-, tenant-, groep-, publicatie-, anon- en helperproeven zijn niet in deze run aangetoond.
- **Screenshots als bestanden:** HOLD; alleen inline Codex-captures, geen PNG-bestanden.
- **Volledige PMUX-04:** NIET GESLAAGD / OPEN. Opleidingsaanvraag ontbreekt in het zichtbare TEST-procesoverzicht en is in R5 niet aangemaakt of gestart.
- Geen code gewijzigd; daarom zijn TypeScript-, ESLint-, i18n- en productsuites niet uitgevoerd. Dit was een browseracceptatierun, geen codewijziging.

Voor hervatting is nodig: de gebruiker rondt de owner-login af in de zichtbare IAB; herhaal daarna uitsluitend de ontbrekende Manager-/Employee- en toegangsweigeringstests met de bestaande rolwisselaar. Gebruik voor PNG’s alleen een door de browseromgeving ondersteunde screenshot-naar-bestandfunctie; de geblokkeerde data-URL-route niet omzeilen. Een volgende geautoriseerde acceptatierun kan pas de Opleidingsaanvraag publiceren/starten wanneer de eigenaar die expliciete run autoriseert. Definitieve product-UX-goedkeuring blijft OPEN.