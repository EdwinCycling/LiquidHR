# UX-redesign Bedrijfsgegevens

## Status

`AFGEROND` — eerste Liquid Flow-redesign.

## Scherm

- Route: `/settings/company-data`
- Doel: groepsbreed bedrijfsadres vastleggen en locaties beheren.
- Rollen: bestaande server-side permission boundary blijft leidend.

## Doorgevoerde UX

- Centrale Liquid Flow-radius en gedeelde form-, button-, dropdown- en accordionstijlen zijn aangescherpt.
- De pagina gebruikt een duidelijke tweestapsflow: Bedrijfsadres en Locaties.
- Het grote informatievenster is op deze pagina verwijderd.
- De bestaande adreszoeker, Nederlandse postcode/huisnummer-aanvulling, internationale velden, handmatige fallback en locatie-modal zijn behouden.
- De locatiecounter en de primaire acties zijn direct zichtbaar.
- Na een wijziging verschijnt niet langer ten onrechte de status `opgeslagen`.
- NL- en EN-teksten zijn gelijkgetrokken en uitgebreid.

## Grenzen

- Geen schemawijziging.
- Geen API-contractwijziging.
- Geen wijziging aan autorisatie of RLS.
- Geen verwijdering van algemene informatie- of HeRa-oplossingen buiten dit scherm.

## Verificatie

- Strict TypeScript: geslaagd.
- ESLint: geslaagd.
- i18n-pariteit: geslaagd, 28 namespaces.
- Productiebuild via Webpack: geslaagd.
- Ingelogde desktop- en 390px-browsercontrole: geslaagd.
- Locatietab en locatiemodal geopend en gesloten: geslaagd.

## Volgende scherm

`/authorization` — Rollen en autorisatie. Gebruik hiervoor de bestaande requirements [`AUTORISATIE_EN_RECHTEN.md`](../authorization/AUTORISATIE_EN_RECHTEN.md) en werk het statusregister bij.
