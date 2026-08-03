# LiquidHR coding standards

Dit document is de compacte dagelijkse checklist voor codewijzigingen. `AGENTS.md`, de leidende documenten onder `docs/README.md` en goedgekeurde ADR/FDR's blijven de bron van waarheid bij tegenstrijdigheden.

## Werkwijze

- Lees vóór een wijziging `AGENTS.md`, `docs/README.md` en `docs/delivery/CURRENT_CONTEXT.md`.
- Houd wijzigingen klein en scopevast; laat bestaande dirty wijzigingen van Edwin ongemoeid tenzij de opdracht ze expliciet raakt.
- Hergebruik bestaande services, validatie, autorisatie, i18n en UI-patronen voordat je iets nieuws introduceert.
- Gebruik strict TypeScript en geen `any`.
- Werk bij schemawijzigingen end-to-end: schema, RLS, server/API, UI, gegenereerde types en relevante verificatie.

## Veiligheid en Git

- Voer geen databasewijziging, push, merge, deployment of destructieve reset uit zonder expliciete scope en bevestiging.
- Gebruik de lokale Codex Developer Toolkit voor de afgesproken workflow:
  - `Maak Git backup`
  - `Zet Git backup terug`
  - `Nieuwe feature: <naam>`
  - `Feature afgerond`
- Een featurebranch start vanaf `last-good` en een nieuwe feature vereist een schone werkboom.
- Restore vraagt exact `HERSTEL`, beschermt standaard dirty wijzigingen en verwijdert standaard geen ongetrackte bestanden.
- `Feature afgerond` mag tests, een lokale commit en lokale `last-good`-refs uitvoeren; merge en push blijven handmatig.
- Log of commit nooit secrets, tokens, private keys of lokale `.env`-bestanden.

## Code en productgedrag

- Autorisatie wordt server-side én via RLS afgedwongen; UI-verberging is alleen UX.
- Gebruik canonieke permissions (`resource:action` of `self:resource:action`) en Engelse identifiers voor database-entiteiten.
- Alle zichtbare tekst en foutmeldingen komen uit NL/EN-taalbestanden met gelijke sleutels.
- Gebruik bestaande thema-variabelen en Tailwind/CSS-conventies; voeg geen willekeurige hardcoded componentkleuren toe.
- Beheerbare stamdata volgt lijst-eerst: zoeken/filteren/sorteren, duidelijke selectie en modalacties voor toevoegen/wijzigen/deactiveren.

## Verificatie

- Kies de kleinste relevante controle: parser/syntaxcheck voor scripts, gerichte test voor logica, i18n-check voor vertalingen en typecheck voor TypeScript.
- Voer volledige tests, build en browsercontrole uit bij release-, merge-, infrastructuur-, auth-, routing- of schemawijzigingen, of wanneer de opdracht dat vraagt.
- Rapporteer geslaagd, geblokkeerd en niet uitgevoerd afzonderlijk; verwar bestaande failures niet met regressies.
