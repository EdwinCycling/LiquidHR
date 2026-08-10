# UX-redesign Workflows en formulieren

## Scherm en scope

- Scherm: Workflows en formulieren
- Route: `/settings/process-automation`
- Rollen en permissies: bestaande `process-definition:read`, `form-definition:read`, `process-definition:write` en `process-definition:publish`-grenzen blijven leidend.
- Gebruikersdoel: snel zien welke processen bestaan en in productie staan, een definitie terugvinden en een nieuw proces gecontroleerd opzetten.
- Scope: informatiearchitectuur, catalogus, studio-navigatie, aanmaakwizard, responsive gedrag en NL/EN-copy.
- Buiten scope: schema, API-contracten, RLS, permissies, runtimegedrag, nieuwe procesvelden, remote writes en deployment.

## Bestaande situatie

De pagina toonde recepten en daaronder één lange werkruimte. Catalogus, processtappen, formulierbuilder, preview, Procesproef en versieverschil stonden gelijktijdig onder elkaar. Daardoor was niet direct zichtbaar hoeveel processen bestonden, welke versie voor nieuwe starts in productie stond en waar een beheerder moest beginnen.

Behouden functionaliteit:

- zoeken en filteren in de proces- en formuliercatalogus;
- concept, gepubliceerd en gearchiveerd onderscheiden;
- concepten bewerken en automatisch bewaren;
- klonen, publiceren en archiveren;
- processtappen en formulierbindings beheren;
- preview per deelnemer, taal en schermformaat;
- Procesproef zonder writes en versieverschil;
- gecertificeerde recepten via het bestaande receptenpaneel.

Herbruikte patronen:

- de tweestapsnavigatie en rustige sectiehiërarchie van Bedrijfsgegevens;
- lijst-eerst, statusrijen en duidelijke selectie uit Rollen en autorisatie/role-assignments;
- genummerde voortgang, één taak per scherm en review vóór aanmaken uit de nieuwe-medewerkerwizard;
- bestaande Liquid Flow-tokens, form fields en buttons.

## Nieuw ontwerp

1. Bovenaan staat één overzicht met totalen voor alle processen, in productie, in voorbereiding en gearchiveerd.
2. `In productie` betekent expliciet: een gepubliceerde immutable versie die voor nieuwe processtarts beschikbaar is. Een concept wordt niet als productie gepresenteerd.
3. De catalogus blijft links lijst-eerst met zoekveld, statusfilter, telling en compacte klikrijen.
4. De geselecteerde definitie staat rechts. Onder de definitieheader loopt een genummerde studio-navigatie: Proces, Formulier, Preview, Procesproef en Versies.
5. Slechts één studio-onderdeel wordt tegelijk getoond. Dit verwijdert de lange doorlopende pagina zonder bestaande functies te verwijderen.
6. `Nieuw proces` opent een driestapswizard: Basis, Startpunt en Controleren. De wizard maakt pas na de review een concept aan.
7. De wizard genereert een veilige technische sleutel uit de procesnaam en laat deze vóór aanmaken corrigeren.
8. Gecertificeerde recepten blijven als apart, bestaand startpad zichtbaar; de wizard doet niet alsof hij recepten kan activeren zonder de bestaande recipe-actie.

### States en gedrag

- Leeg: overzicht toont nulwaarden; catalogus toont de bestaande lege toestand.
- Geen zoekresultaten: catalogus toont een rustige lege zoektoestand.
- Alleen-lezen: gepubliceerde en gearchiveerde definities behouden hun lockstatus en server-side grenzen.
- Opslaan/fout/conflict: bestaande autosave- en revision-conflictmeldingen blijven in de definitieheader.
- Wizard: eerste stap valideert naam en sleutel; terug en annuleren schrijven niets; aanmaken gebeurt alleen in de reviewstap.
- Desktop: overzicht in vier kolommen, catalogus naast de geselecteerde werkruimte.
- 390px: overzicht en catalogus stapelen; studionavigatie wordt een verticale, goed raakbare stappenlijst; modal gebruikt vrijwel de volledige breedte.

## Toegankelijkheid en i18n

- Status is altijd tekstueel en niet alleen via kleur herkenbaar.
- De actieve catalogusrij gebruikt `aria-current`; de actieve studiostap gebruikt `aria-current="step"`.
- De wizard is een benoemde dialoog met genummerde voortgang en logische focusvolgorde.
- Alle nieuwe zichtbare tekst staat in `processAutomation.json`; NL en EN hebben dezelfde sleutels.
- Bestaande toetsenbord-, autosave-, compiler- en autorisatiegrenzen blijven behouden.

## Acceptatiecriteria

- Een beheerder ziet zonder scrollen hoeveel processen bestaan en hoeveel er in productie staan.
- Concepten en productieversies zijn niet te verwarren.
- De catalogus blijft doorzoekbaar en filterbaar.
- Slechts één studio-onderwerp staat tegelijk open.
- Een nieuw proces wordt via Basis → Startpunt → Controleren aangemaakt.
- Publiceren, archiveren, klonen, preview, Procesproef en versieverschil blijven bereikbaar.
- Desktop en 390px hebben geen horizontale pagina-overflow.
- Typecheck, gerichte lint, i18n-pariteit en browsercontrole zijn groen.

## Verificatie en overdracht

- Strict TypeScript: geslaagd.
- i18n-pariteit en `git diff --check`: geslaagd.
- Gerichte ESLint: geblokkeerd door de bestaande ESLint 10/`eslint-plugin-react`-incompatibiliteit.
- Browsercontrole: geblokkeerd omdat de geïsoleerde worktree geen lokale Supabase-omgevingswaarden bevat; er zijn geen secrets gekopieerd of gelinkt.
- Status: GEIMPLEMENTEERD, browserverificatie geblokkeerd.
- Datum: 2026-08-10.
