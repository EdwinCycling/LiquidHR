# Autorisatiebeheer en grafisch rechtenoverzicht — ontwerp

Datum: 18 juli 2026  
Status: goedgekeurd in gesprek

## 1. Doel

Het bestaande autorisatiescherm combineert rollen, functiepunten, plaatsingen en rolhouders in één lange pagina. De functionaliteit blijft gelijk, maar de gebruiker moet sneller kunnen zien welke rol wat mag, verschillen kunnen herkennen en wijzigingen gecontroleerd opslaan.

De vernieuwde pagina gebruikt uitsluitend de bestaande `management_roles`, `permissions` en `role_permissions` als bron van waarheid. Er komt geen tweede autorisatiemodel en geen client-side autorisatiebeslissing; afgeleide tellingen zijn alleen presentatie. `authorization:read`, `authorization:write`, server-side validatie en RLS blijven ongewijzigd leidend.

## 2. Afgewogen opties

### Alleen visuele opschoning

De huidige formulieren worden mooier gegroepeerd, maar rolverschillen blijven moeilijk vergelijkbaar. Dit is onvoldoende voor het gevraagde grafische overzicht.

### Matrix met dekkingsgrafiek — gekozen

Een werkruimte met rollenlijst, gegroepeerde rechteneditor en een heatmap per rol en functiegebied. Dit maakt zowel beheer als controle begrijpelijk zonder een extra grafiekbibliotheek of nieuw datamodel.

### Volledige graph-editor

Een node-linkdiagram met rollen, afdelingen en personen oogt aantrekkelijk, maar wordt snel onleesbaar en kan ten onrechte suggereren dat grafische verbindingen autorisatie bepalen. Dit wordt niet gekozen.

## 3. Informatiearchitectuur

De pagina krijgt drie tabbladen met URL-state:

1. **Rechten beheren** — een rol selecteren en functiepunten wijzigen;
2. **Grafisch overzicht** — rollen vergelijken per functiegebied;
3. **Toewijzingen** — organisatieplaatsingen en rolhouders beheren.

Boven de tabbladen staan vier compacte kengetallen: totaal rollen, actieve tenantrollen, toegekende functiepunten en afgedekte functiegebieden. Systeemrollen zijn zichtbaar ter referentie, maar blijven niet wijzigbaar.

## 4. Rechten beheren

- Links staat een zoekbare rollenlijst met type, status en aantal toegekende rechten.
- Rechts staat de geselecteerde rol met omschrijving en een gegroepeerde rechteneditor.
- Iedere functiegroep toont toegekend/totaal, een voortgangsbalk en een groepsactie om alles aan of uit te zetten.
- Individuele functiepunten tonen naam, omschrijving en technische code; de code is secundaire informatie.
- Een sticky actiebalk toont het aantal niet-opgeslagen wijzigingen en biedt opslaan en herstellen.
- Na opslaan wordt de lokale uitgangssituatie bijgewerkt, zodat de pagina niet ten onrechte gewijzigde status blijft tonen.
- Zoeken filtert op rolnaam/code en op functienaam/code zonder autorisatiebeslissingen te veranderen.

## 5. Grafisch overzicht

Desktop toont een heatmap met rollen als kolommen en functiegebieden als rijen. Iedere cel toont `toegekend / totaal` en gebruikt kleurintensiteit voor de dekkingsgraad. De cel is ook tekstueel en met een toegankelijke voortgangswaarde beschreven; kleur is nooit de enige informatiedrager.

Een klik op een cel opent **Rechten beheren** met de gekozen rol en het betreffende functiegebied in beeld. Op mobiel wordt dezelfde informatie als rolkaarten met horizontale dekkingsbalken weergegeven, zonder horizontale pagina-overflow.

De heatmap visualiseert uitsluitend permissiondekking. Afdelingsscope, direct-managerbereik en effective dating worden als aparte uitlegregel getoond, omdat een functiepunt zonder geldige scope nog steeds geen toegang geeft.

## 6. Toewijzingen

De bestaande formulieren voor medewerkerplaatsing en managementrolhouder blijven functioneel, maar worden uit de rechteneditor gehaald. Ze krijgen elk een eigen kaart, korte uitleg en een duidelijke invoervolgorde. Dit voorkomt dat rechten en organisatiescope als hetzelfde concept worden ervaren.

## 7. UX, toegankelijkheid en responsive gedrag

- De bestaande Liquid HR-tokens, Tailwind v4 en componentfundering blijven leidend; componenten bevatten geen hardcoded kleuren.
- Alle zichtbare tekst komt uit de NL/EN-namespace `organization` met volledige sleutelpariteit.
- Tabbladen, zoekvelden, groepsselecties, heatmapcellen en statusmeldingen zijn met toetsenbord bedienbaar.
- Focus, foutstatus, opslaan en niet-opgeslagen wijzigingen zijn expliciet zichtbaar en via `aria-live` aangekondigd.
- Desktop benut de schermbreedte; mobiel stapelt rollen, editor en grafiek logisch.

## 8. Techniek en autorisatie

- Geen schemawijziging is nodig.
- De Server Component haalt de bestaande matrix één keer beveiligd op.
- De Client Component beheert alleen presentatie en conceptselecties.
- Opslaan blijft via `PUT /api/roles/[roleId]/permissions` lopen en vereist `authorization:write`.
- Globale systeemrollen blijven databasebreed onveranderlijk; de UI toont ze read-only.
- Kritieke permissionlogica verandert niet. Nieuwe tests richten zich op afgeleide dekkingsberekeningen, dirty-state en rol-/groepselectie.

## 9. Versie, documentatie en deployment

- Applicatieversie wordt `1.20260718.2`.
- Leaked-password protection wordt niet langer als uitvoerbare handmatige actie vermeld: binnen het huidige Supabase-abonnement is de betaalde optie niet beschikbaar. Dit wordt als geaccepteerde abonnementsbeperking gedocumenteerd.
- Na unit-, i18n-, TypeScript-, lint- en buildcontrole wordt lokaal op poort 3000 en op 390px gevalideerd.
- Daarna wordt de branch gepusht, naar `main` geïntegreerd en via de gekoppelde Vercel-productiedeployment gepubliceerd. De gebruikerswijzigingen in `docs/delivery/HANDMATIGE_ACTIES.md` en `package-lock.json` worden niet overschreven of onbedoeld meegecommit.

## 10. Acceptatiecriteria

- Een beheerder vindt een rol of functiepunt zonder door een lange pagina te zoeken.
- Alle rechten per rol zijn beheerbaar met individuele en groepsselectie.
- Niet-opgeslagen wijzigingen zijn ondubbelzinnig zichtbaar en herstelbaar.
- De grafiek maakt per rol de dekking over alle functiegebieden begrijpelijk en blijft zonder kleur interpreteerbaar.
- Organisatieplaatsingen en rolhouders staan afzonderlijk onder Toewijzingen.
- Systeemrollen zijn zichtbaar maar niet wijzigbaar.
- API- en RLS-autorisatie blijven ongewijzigd en getest.
- Productie en branch-preview bouwen en laden succesvol.
