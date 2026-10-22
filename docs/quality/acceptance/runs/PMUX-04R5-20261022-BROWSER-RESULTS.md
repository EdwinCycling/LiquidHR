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
## Vervolgcontrole — live herstart op 22 oktober 2026

- Werkboom en branch zijn opnieuw gecontroleerd: work/BRANCH-SPLIT-PMUX-20261021, HEAD dd8fcd912282646fac34ba94af34972dd2f54e0d. De R4-rapportwijziging en R4-index bleven onaangeroerd.
- De ondersteunde launcher startte Development met de centrale TEST-configuratie op 127.0.0.1:3011; de runtime antwoordde en bleef tijdens deze controle actief. De bestaande Codex In-App Browser (IAB, tab 6) stond los van de Chrome-extensietabs. Geen bezoek aan of wijziging aan poort 3010.
- De lokale TEST-login voor HR Admin werkte via /local/sign-in en de bestaande contextkeuze De Sterren holding · Planeten; de app toonde administratie Jupiter BV.
- Server-renderde /local/personas meldde rolcode TENANT_ADMIN, beheerderscontrole “zou toegang geven” en lokale bevoegdheidscontrole “toegestaan”. De zichtbare targetlijst bevatte uitsluitend Payroll — Lisa, Jaap, Frits en DEMO-002 (Mars). Er is geen Employee- of Manager-rolwisseling uitgevoerd. HR Admin is via de normale UI afgemeld; de In-App Browser staat nu op de loginpagina en wacht op de gebruiker die de bestaande owner-login zelf uitvoert.
- Pagina-uitkomsten tijdens deze herstart: /settings/process-automation 200 (24 definities; geen Opleidingsaanvraag zichtbaar); de Formulierenstudio op gepubliceerde R5-TEST — Interne overplaatsing toonde het gekoppelde formulier en participantrechten in alleen-lezenmodus; /dashboard/start, /work?view=REQUESTS en /focus/werk laadden; /focus/aanvragen gaf 404. De aanvraagcatalogus toonde drie bestaande kaarten naast de twee native starters; er is geen starter aangeklikt.
- Desktop (1440×900 viewportinstelling) en mobiel (390×844) zijn opnieuw visueel bekeken. Inline captures tonen de formulierenlijst, mobiele aanvraagcatalogus en mobiele Focus-werkkaarten; de mobiele Formulierenstudio-capture staat bovenaan de pagina en toont de editorvelden niet. De rolkeuzelijst-inhoud is met de toegankelijkheidsboom bevestigd, niet zichtbaar als uitgevouwen opties in de screenshot.
- De In-App Browser biedt voor deze capture alleen screenshotbytes/inline weergave en geen save-to-path-functie. Daarom zijn ook deze nieuwe PNG-bestanden NOT CAPTURED; de eerder geblokkeerde downloadroute is niet opnieuw geprobeerd en er is geen alternatieve browser- of injectieroute gebruikt.
- Next.js heeft tijdens deze eigen serverstart uitsluitend de gegenereerde imports in apps/hr-suite/next-env.d.ts naar .next/dev/types omgezet. De server blijft bewust draaien terwijl de owner-login ontbreekt; herstel dit bestand pas na het stoppen van deze server. Er zijn geen migraties, procespublicaties, aanvraagstarts of remote businessdatawrites uitgevoerd.
- Status blijft PARTIAL / HOLD: de echte Employee-/Manager-rollen, beheerweigering, live RPC-proeven en PNG-bestanden zijn niet bewezen. Het volgende noodzakelijke browsermoment is de gebruiker die in de zichtbare bestaande loginpagina zelf de owner aanmeldt.

## Live browserrun en PNG-bewijs — herstart 22 oktober 2026

- Feitelijke branch-tip bij deze vervolgrun: `dd8fcd912282646fac34ba94af34972dd2f54e0d`; werkmap en branch zijn de gevraagde PMUX-worktree en `work/BRANCH-SPLIT-PMUX-20261021`.
- De ondersteunde TEST-developmentserver is daadwerkelijk gestart op `127.0.0.1:3011`, antwoordde op HTTP en bleef tijdens de browsercontroles actief. De Codex In-App Browser (IAB) is afzonderlijk gebruikt; de Chrome-extensie en Payroll op poort 3010 zijn niet bediend.
- De bestaande lokale aanmeldroute gaf toegang met de bestaande HR Admin-testidentiteit in context De Sterren holding · Planeten / Jupiter BV. De server-renderde role switcher meldde `TENANT_ADMIN`, beheerderscontrole “zou toegang geven” en lokale bevoegdheidscontrole “toegestaan”. Zichtbare doelaccounts: Payroll — Lisa, Jaap, Frits en DEMO-002 (Mars); Employee en Manager waren niet beschikbaar in deze HR Admin-lijst en zijn niet gewisseld.
- `/settings/process-automation` en Formulierenstudio voor de gepubliceerde `R5-TEST — Interne overplaatsing` werkten. `/dashboard/start`, `/work?view=REQUESTS` en `/focus/werk` laadden. `/focus/aanvragen` gaf 404. Er is geen Opleidingsaanvraag-proces aangemaakt, gepubliceerd of gestart.
- De actuele `/work?view=REQUESTS`-capture toont tegelijk de native knoppen “Interne overplaatsing starten” en “Documentkennisname starten” plus cataloguskaarten voor R5-TEST Interne overplaatsing en Document bevestiging. De dubbele startpresentatie is in deze runtime dus visueel bevestigd; geen van de knoppen is aangeklikt.
- Vijf authentieke browsercaptures zijn als PNG opgeslagen in de bestaande acceptance-map. Ze zijn afkomstig van de IAB-screenshotbytes en lokaal re-encoded als PNG, zonder inhoud te tekenen of te wijzigen. Desktopmaat is 1440×900; de mobiele Formulierenstudio-capture is daadwerkelijk genomen bij `innerWidth=390`, `innerHeight=844`.
- Bestanden: `PMUX04-R5-ADMIN-STUDIO-D.png`, `PMUX04-R5-ADMIN-FORM-STUDIO-D.png`, `PMUX04-R5-ADMIN-FORM-STUDIO-M.png`, `PMUX04-R5-ADMIN-WORK-D.png` en `PMUX04-R5-ROLE-SWITCHER-D.png`. De exacte view en bevinding per bestand staan in de screenshotindex.
- HR Admin is via de normale applicatie-UI afgemeld. De IAB staat op `/login` en is overgedragen voor de gebruiker om zelf met de bestaande owner-account aan te melden. Tot die login zijn Employee/Manager-wissels, hun schermen, beheerweigering en rolgebonden autorisatie niet bewezen. Wachtwoorden of tokens zijn niet door Codex ingevoerd of gelezen.
- Er zijn geen live RPC-proeven met Employee/Manager-JWT uitgevoerd; de HR Admin-catalogus is geen bewijs van Employee-startautorisatie. Geen migratie, procesmutatie, aanvraagstart of remote businessdatawrite is gedaan.
- De server blijft bewust draaien tot de owner-login is afgerond. `next-env.d.ts` bevat alleen de door deze Next-devserver gegenereerde `.next/dev/types`-imports; herstel die uitsluitend na het stoppen van deze run. Geen TypeScript-/ESLint-/i18n-suite gedraaid: er is geen productcode gewijzigd.
- Verdict blijft **PARTIAL / HOLD**. De nieuwe PNG’s zijn diagnostische HR Admin-evidence; ze vervangen de geplande Employee-, Manager-, toegangsweigering- en volledige PMUX-04-eindcaptures niet.