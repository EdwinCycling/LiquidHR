# Redesign requirements — Rollen en autorisatie

**Status:** GEVERIFIEERD  
**Datum:** 2026-08-07  
**Route:** `/authorization`  
**Verwant scherm:** `/role-assignments`  
**Bron:** [AUTORISATIE_EN_RECHTEN.md](../authorization/AUTORISATIE_EN_RECHTEN.md)  
**Ontwerpstatusregister:** [SCHERM_REDESIGN_STATUS.md](SCHERM_REDESIGN_STATUS.md)

Dit document bevat eerst de requirements en daarna het ontwerpvoorstel. In deze fase worden geen UI-, API-, database-, RLS- of autorisatiewijzigingen uitgevoerd.

## Scherm en scope

### Gebruikersdoel

Een bevoegde HR-beheerder moet snel kunnen begrijpen:

1. welke rollen beschikbaar zijn;
2. welke exacte rechten aan een rol zijn gekoppeld;
3. welke delen van het autorisatielandschap aandacht vragen;
4. waarom een recht op zichzelf nog geen toegang tot alle gegevens betekent.

De gebruiker moet met weinig zoeken een rol kunnen selecteren, rechten kunnen nalopen, wijzigingen gecontroleerd kunnen opslaan en de gevolgen van een wijziging kunnen begrijpen.

### Rollen en permissies

- De pagina blijft server-side beschermd met `authorization:read`.
- Wijzigen en opslaan blijft server-side beschermd met `authorization:write`.
- Systeemrollen blijven zichtbaar als referentie en blijven in de interface herkenbaar als alleen-lezen.
- Tenantrollen blijven de beheerbare rollen.
- De bestaande self-authorization-lockout blijft leidend: een gebruiker mag zichzelf niet de benodigde autorisatie ontnemen.

### Scope van deze redesign

- Visuele en interactionele herinrichting van `/authorization`.
- De bestaande functies voor rollen zoeken, rollen selecteren, rechten filteren, rechten selecteren, herstellen en opslaan.
- De bestaande grafische dekking per rol en functiegroep.
- De bestaande melding dat exacte rechten en organisatiescope samen de uiteindelijke toegang bepalen.
- Desktop en 390px mobiel.
- NL/EN-vertalingspariteit.

### Buiten scope

- Wijzigingen aan permissions, management roles, role permissions, assignments, RLS, API-contracten of autorisatielogica.
- Het samenvoegen van `/authorization` en `/role-assignments` tot één route.
- Nieuwe rollen, rechten of categorieën in de database.
- Een nieuw audit- of rapportagesysteem.
- Wijzigingen aan het bedrijfsgegevensscherm; dat scherm blijft als afgeronde referentie in het UX-statusregister staan.

## Bestaande situatie

### Huidige flow

1. De pagina toont vier samenvattingskaarten.
2. De gebruiker kiest tussen `Rechten beheren` en `Grafisch overzicht` via URL-state (`tab`).
3. In `Rechten beheren` staat links een doorzoekbare rollenlijst.
4. De geselecteerde rol toont rechts per categorie een verzameling checkboxen, met zoekfunctie, telling en voortgang.
5. Wijzigingen blijven lokaal als concept totdat de gebruiker expliciet opslaat of herstelt.
6. In `Grafisch overzicht` staat een heatmap op desktop en een rol-per-rol overzicht op mobiel.
7. Een dekking kan worden geopend in een dialoog om de onderliggende rechten te bekijken en, voor een bewerkbare rol, aan te passen.
8. Organisatieplaatsingen en managementtoewijzingen leven functioneel op `/role-assignments`; zij zijn geen tweede rechtenmatrix op `/authorization`.

### Functionaliteit die behouden moet blijven

- Zoeken op rolnaam en rolcode.
- Zoeken op functienaam, functiepuntcode en omschrijving.
- Selecteren en deselecteren van individuele rechten.
- Alles selecteren of wissen per categorie.
- Duidelijke telling van gewijzigde rechten.
- Herstellen van niet-opgeslagen wijzigingen.
- Expliciet opslaan.
- Duidelijke status voor actieve, inactieve, systeem- en tenantrollen.
- Heatmapdekking per rol en categorie.
- Inspecteren van de rechten achter een heatmapvak.
- Concrete foutmelding voor `SELF_AUTHORIZATION_LOCKOUT`.
- URL-state voor de actieve werkruimte.

### Bestaande API-, data-, RLS- en permissiegrenzen

De redesign mag uitsluitend de bestaande gegevens en services gebruiken:

- `listAuthorizationMatrix()` voor rollen, permissions en role-permissions.
- `/api/roles` voor het aanmaken van een tenantrol.
- `/api/roles/[roleId]/permissions` voor het opslaan van rechten.
- `requirePermission('authorization:read')` op de pagina en leesservice.
- `requirePermission('authorization:write')` op schrijfservices.
- De bestaande Supabase-client en RLS blijven de bron van waarheid.

De heatmap is alleen een leesbare projectie. Een percentage of kleur mag nooit worden geïnterpreteerd als wildcardrecht, automatisch organisatiescope of gegarandeerde toegang.

### Herbruikbare componenten en bestanden

- `apps/hr-suite/app/(dashboard)/authorization/page.tsx`
- `apps/hr-suite/components/organization/authorization-manager.tsx`
- `apps/hr-suite/lib/organization/authorization-view.ts`
- `apps/hr-suite/lib/organization/management-service.ts`
- `apps/hr-suite/app/api/roles/route.ts`
- `apps/hr-suite/app/api/roles/[roleId]/permissions/route.ts`
- `apps/hr-suite/app/(dashboard)/role-assignments/page.tsx`
- `apps/hr-suite/components/organization/role-assignment-manager.tsx`
- `apps/hr-suite/messages/nl/organization.json`
- `apps/hr-suite/messages/en/organization.json`
- De bestaande Liquid Flow-tokens en gedeelde `button-primary`, `button-secondary` en paginaheader.

### Vastgestelde UX-problemen

- De pagina bevat veel gelijktijdige informatie: samenvatting, navigatie, rollen, categorieën, checkboxen, codes en uitleg.
- Door de huidige sterke rondingen krijgt vrijwel ieder element dezelfde visuele nadruk; de hiërarchie tussen pagina, werkruimte, categorie en recht is daardoor zwakker.
- De rollenlijst en rechtenmatrix voelen als twee losse panelen in plaats van één duidelijke taakflow.
- De rechtenbeschrijvingen en codes staan permanent onder ieder item, waardoor scannen moeilijker wordt.
- De primaire actie `Rechten opslaan` concurreert visueel met veel andere kaders en knoppen.
- De heatmap is informatief, maar de betekenis van “dekking” vraagt om context op het moment dat de gebruiker deze gebruikt.
- De bestaande labels voor `Toewijzingen` zijn aanwezig, maar de huidige `/authorization`-component toont die werkruimte niet; de daadwerkelijke toewijzingsflow staat op `/role-assignments`.

## Ontwerpvoorstel

### Ontwerpprincipe

Maak van de pagina één rustige beheerflow:

**kies rol → beoordeel rechten → wijzig indien toegestaan → controleer → sla expliciet op**.

De gebruiker ziet steeds één duidelijke primaire taak. Informatie die alleen als uitleg dient, wordt compact en contextueel aangeboden.

### Paginaopbouw

1. **Paginaheader**
   - Bestaande `AdminSettingsPageHeader` behouden.
   - Titel: `Rollen en rechten`.
   - Een korte uitleg onder de titel: exacte rechten en organisatiescope bepalen samen de toegang.
   - Geen extra permanent informatiepaneel onder de header.

2. **Compacte samenvatting**
   - De vier huidige metrics blijven inhoudelijk behouden.
   - Visueel terugbrengen tot een rustige, compacte statusrij met minder decoratie.
   - Geen grote cirkelvormige achtergronddecoratie; cijfers en labels zijn leidend.
   - Op mobiel twee kolommen of een horizontaal scrollbare statusrij, afhankelijk van de bestaande Liquid Flow-patronen.

3. **Werkruimtenavigatie**
   - Een duidelijke segmentkeuze voor `Rechten beheren` en `Grafisch overzicht`.
   - De actieve keuze moet een actieve tab zijn, geen generieke knop met alleen kleurverschil.
   - `Toewijzingen` blijft voorlopig een secundaire link naar `/role-assignments`, met uitleg dat dit de organisatiescope en rolhouders beheert.
   - De actieve werkruimte blijft in de URL staan.

4. **Contextuele statusmelding**
   - Succes-, fout- en lockoutmeldingen verschijnen op één vaste, goed zichtbare plek boven de werkruimte.
   - De melding gebruikt `aria-live` en verdwijnt niet voordat de gebruiker de uitkomst heeft kunnen lezen.
   - Geen dubbele scope-uitleg op zowel header, werkruimte als heatmap.

### Werkruimte: Rechten beheren

#### Rol kiezen

- Lijst-eerst blijft de basis: zoeken, tellen en direct selecteren.
- De lijst krijgt een duidelijke titel, zoekveld en compacte statusinformatie.
- Een rolregel toont primair naam, secundair rolcode en status; het aantal rechten is ondersteunende informatie.
- Systeemrol/tenantrol en actief/inactief worden als badges of tekststatus getoond, niet alleen via kleur.
- De geselecteerde rol is met toetsenbord en screenreader herkenbaar.
- Op mobiel verandert de linkerkolom in een rolkeuze boven de rechtenlijst; de gebruiker hoeft niet horizontaal door twee panelen te navigeren.

#### Nieuwe tenantrol

- `Nieuwe tenantrol` blijft een secundaire actie bij de rollenlijst.
- Het formulier wordt als compacte disclosure of modal geopend, zodat de hoofdtaak niet naar beneden wordt geduwd.
- De invoervelden blijven rolcode, rolnaam, omschrijving en organisatiescope.
- Na aanmaken blijft de gebruiker in dezelfde werkruimte en krijgt de nieuwe rol een duidelijke geselecteerde/statusweergave.

#### Rechten van de geselecteerde rol

- De geselecteerde rol krijgt een duidelijke titel, rolcode, status, scope-indicatie en alleen-lezen-indicatie.
- De telling “functiepunten toegekend” blijft zichtbaar naast de rolinformatie.
- De zoekfunctie blijft boven de categorieën staan.
- Categorieën worden visueel rustiger gegroepeerd; de categorie is de primaire scanlaag.
- Elke categorie toont:
  - categorienaam;
  - `toegekend / totaal`;
  - percentage als aanvullende informatie;
  - compacte voortgangsbalk;
  - `Alles selecteren` of `Alles wissen` wanneer de rol bewerkbaar is.
- Rechten worden als compacte rijen weergegeven. Naam is primair; omschrijving en functiepuntcode zijn secundair en mogen als compacte detailregel of disclosure worden getoond.
- De exacte permission code blijft altijd beschikbaar voor controle, maar hoeft niet visueel even zwaar te zijn als de menselijke naam.
- Bij een systeemrol zijn checkboxen zichtbaar als alleen-lezen en is het onmogelijk om een wijzigingsbalk te activeren.

#### Opslaan

- De opslaaibalk is de enige dominante primaire actie in de werkruimte.
- Zij blijft zichtbaar wanneer er niet-opgeslagen wijzigingen zijn.
- Zij toont het aantal gewijzigde rechten, `Herstellen` en `Rechten opslaan`.
- Zonder wijzigingen is de balk compact en de opslagactie disabled.
- Op mobiel blijft de balk onderin zichtbaar zonder inhoud of focus te bedekken; er is voldoende ondermarge voor de laatste categorie.
- Bij opslaan blijft de gebruiker op dezelfde rol en werkruimte.

### Werkruimte: Grafisch overzicht

- De heatmap blijft een overzichts- en inspectiewerkruimte, geen aparte manier om rechten toe te kennen.
- De bestaande uitleg over recht én scope blijft behouden, omdat dit een inhoudelijk noodzakelijke beveiligingsuitleg is. Deze wordt compact vormgegeven en uitsluitend in deze werkruimte getoond.
- Desktop gebruikt een semantische tabel met vaste eerste kolom en horizontale scroll wanneer nodig.
- Elke cel toont de dekking en heeft een toegankelijke naam met rol, categorie, telling en percentage.
- Mobiel gebruikt het bestaande rol-per-rol patroon met categorieën en voortgangsbalken.
- Een klik of toetsenbordactivatie opent de detaildialoog.
- De detaildialoog toont duidelijk:
  - welke rol en categorie worden bekeken;
  - dat dekking geen wildcard of volledige toegang betekent;
  - welke exacte rechten aangevinkt zijn;
  - of de rol alleen-lezen is.
- De detaildialoog krijgt een normale sluitactie, Escape-ondersteuning, focusbeheer en voldoende ruimte voor 390px.

### Toewijzingen

Voor deze redesign blijft `/role-assignments` de aparte flow voor:

- organisatieplaatsingen;
- managementtoewijzingen;
- effectieve datums en organisatiescope.

Op `/authorization` komt hoogstens een contextuele secundaire link naar deze flow. Een tweede toewijzingsformulier op `/authorization` wordt niet voorgesteld, omdat dit de grens tussen “welk recht” en “op welke scope” vervaagt.

### Informatievenster

- Het scope-informatievenster behouden in `Grafisch overzicht`: het voorkomt een inhoudelijk gevaarlijke interpretatie van de heatmap.
- Niet als permanent los venster in `Rechten beheren` tonen; daar volstaat één korte contextregel in de rolheader of paginaheader.
- Geen generieke helpbox toevoegen wanneer de uitleg geen concrete keuze of beveiligingsrisico ondersteunt.

### States

Het ontwerp moet expliciet voorzien in:

- laden van matrix en rolgegevens;
- geen rollen;
- geen zoekresultaten voor rollen;
- geen zoekresultaten voor rechten binnen een categorie;
- geselecteerde systeemrol / alleen-lezen;
- geselecteerde inactieve rol;
- niet-opgeslagen wijzigingen;
- opslaan bezig;
- succesvol opgeslagen;
- algemene opslagfout;
- self-authorization-lockout;
- lege heatmap wanneer er geen categorieën of rollen beschikbaar zijn.

Elke state krijgt dezelfde visuele hiërarchie: wat is er aan de hand, wat kan de gebruiker nu doen en wat blijft behouden.

### Desktop en 390px mobiel

#### Desktop

- De rollenlijst blijft naast de rechteninhoud staan wanneer de beschikbare breedte dit toelaat.
- De rolkeuze blijft visueel stabiel tijdens het scrollen.
- De rechteninhoud gebruikt de beschikbare breedte zonder categorieën zo klein te maken dat de tekst onleesbaar wordt.
- De heatmap mag horizontaal scrollen; de eerste kolom blijft herkenbaar.

#### 390px mobiel

- Geen twee-koloms beheerlayout.
- Eerst rolkeuze, daarna rolstatus en rechten.
- Categorieën staan onder elkaar en gebruiken de volledige beschikbare breedte.
- Permission codes mogen afbreken of via detail zichtbaar worden; geen afgekapt onbegrijpelijk tekstlint.
- De opslagbalk blijft bereikbaar en bedekt geen checkboxen.
- De heatmap wordt niet als brede tabel geforceerd; het mobiele rol-per-rol overzicht blijft de leesvorm.
- Dialogen gebruiken vrijwel de volledige schermbreedte met duidelijke sluitactie.

### Radius, spacing, kleur en typografie

- Gebruik de bestaande Liquid Flow CSS-variabelen en gedeelde componenttokens.
- Hoofdsecties krijgen een bescheiden middelgrote radius; niet ieder subelement krijgt een zwaar afgerond kaartje.
- Checkboxrijen, badges en zoekvelden krijgen kleinere radii dan hoofdsecties.
- Vermijd volledig ronde decoratieve vormen als visuele achtergrond.
- Gebruik border, spacing en typografie voor hiërarchie; niet alleen schaduw of kleurvlakken.
- Primaire actie gebruikt de bestaande primary-token; componenten bevatten geen hardcoded hexkleuren.
- Focusringen blijven zichtbaar en contrastrijk.

## Niet-functionele requirements

### NL/EN i18n

- Alle zichtbare tekst komt uit de bestaande `organization`-namespace of een passende nieuwe namespace.
- Nieuwe sleutels worden gelijktijdig in `messages/nl/organization.json` en `messages/en/organization.json` toegevoegd.
- Geen inline vertaalobjecten en geen hardcoded foutmeldingen.
- Nederlandse formulering blijft begrijpelijk voor HR-beheerders; technische permission codes zijn ondersteunende referentie-informatie.

### Keyboard, focus en semantiek

- Werkruimtenavigatie gebruikt semantische tabs met correcte actieve tab en panelrelatie, of een semantisch gelijkwaardig patroon.
- Rolkeuze is volledig toetsenbordbedienbaar.
- Categorieën en checkboxen volgen een logische tabvolgorde.
- De dialoog verplaatst focus naar de inhoud bij openen, sluit met Escape en brengt focus terug naar de opener.
- Statusmeldingen gebruiken `aria-live` zonder de volledige matrix onnodig opnieuw te laten voorlezen.
- Voortgangsbalken bevatten label en actuele waarde.
- Kleur is nooit de enige indicator voor dekking, status of selectie.

### Beveiliging en functionele grenzen

- De redesign verandert niet welke rechten een rol heeft of wie die rechten mag wijzigen.
- Server-side permission checks en RLS blijven ongewijzigd.
- De UI mag geen schrijfactie aanbieden die de API niet al ondersteunt.
- De self-authorization-lockout blijft een expliciete, begrijpelijke foutmelding.
- De heatmap blijft een projectie en wordt niet gebruikt als autorisatiebron.

## Acceptatiecriteria voor implementatie na akkoord

- De primaire flow `rol kiezen → rechten beoordelen → opslaan` is binnen één scherm begrijpelijk.
- De rollenlijst is lijst-eerst, doorzoekbaar en toegankelijk.
- De rechtenmatrix is scanbaar zonder dat de exacte permission code verloren gaat.
- Rechten per categorie kunnen nog steeds individueel en groepsgewijs worden beheerd.
- Herstellen, opslaan, succes, fout en self-authorization-lockout blijven werken.
- Systeemrollen zijn zichtbaar maar niet bewerkbaar.
- Het grafisch overzicht blijft een leesbare projectie met contextuele scope-uitleg.
- `/role-assignments` blijft de aparte toewijzingsflow; er ontstaat geen dubbele bron voor organisatiescope.
- De informatie-uitleg verschijnt alleen waar deze een concrete interpretatiefout voorkomt.
- Desktop en 390px mobiel zijn visueel gecontroleerd.
- NL en EN hebben dezelfde vertalingssleutels.
- Gerichte typecheck, lint, i18n-check en relevante tests/build zijn groen.

## Voorgestelde implementatievolgorde na akkoord

1. Pagina- en werkruimtenavigatie, statusrij en radii/spacing.
2. Rollenlijst en responsive rolkeuze.
3. Rechtenmatrix, categoriehiërarchie en opslaaibalk.
4. Heatmap, detaildialoog en contextuele scope-uitleg.
5. States, i18n-pariteit en toegankelijkheidsdetails.
6. Gerichte verificatie en browsercontrole op desktop en 390px.

## Open beslispunten

De volgende punten zijn bewust als ontwerpkeuze vastgelegd voordat er wordt geïmplementeerd:

1. **Toewijzingen:** voorstel is een secundaire link naar `/role-assignments`, niet een derde tab binnen `/authorization`.
2. **Permission details:** voorstel is naam prominent en omschrijving/code compacter; exacte code blijft beschikbaar.
3. **Nieuwe tenantrol:** voorstel is een disclosure of modal in plaats van een permanent formulier onder de rollenlijst.
4. **Categorieën:** voorstel is één rustige verticale scanstructuur op mobiel en maximaal twee kolommen op brede desktop.
5. **Scope-uitleg:** voorstel is alleen prominent in het overzicht en compact in de rechtenheader.

## Verificatie en overdracht

- Uitgevoerd in deze fase: repository-instructies, autorisatie-requirements, UX-statusregister, bestaande route, component, view-model, managementservice en NL/EN-labels read-only gecontroleerd.
- Implementatie uitgevoerd in de basiswerkplek `feature/verlofopbouw-inrichting`: visuele hiërarchie, minder ronde hoeken, compactere statuskaarten, tabsemantiek en link naar `/role-assignments`.
- Typecheck, lint, i18n-check en `git diff --check` zijn groen; de LF/CRLF-meldingen zijn bestaande werkboomwaarschuwingen.
- Browsercontrole op poort 3000 is uitgevoerd op desktop en 390px voor `/authorization` en `/settings/company-data`; er zijn geen credentials gekopieerd of zichtbaar gemaakt.
- Niet uitgevoerd: API-wijziging, databasewijziging, RLS-wijziging en deployment.
- Bestaande waarschuwingen: de werkboom bevat ongerelateerde wijzigingen; die zijn niet aangeraakt.
- Volgende actie: expliciet akkoord op dit requirementsdocument en ontwerpvoorstel; daarna pas implementatie van de UX-redesign.
- Status: **GEVERIFIEERD**.
