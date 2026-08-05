# LiquidHR Control Plane

> **Actuele scope vanaf 2026-08-05:** Control Plane beheert de HR-groepstructuur. Edwin maakt HR-groepen aan en kan initiële/lege administraties aanmaken. Een HR-admin kan later vanuit een geselecteerde HR-groep administraties toevoegen. De oude `SEPARATE`/`COMBINED`-keuze hieronder is historische implementatiecontext; zie [HR-groepen: scope, inrichting en domeingrenzen](../multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md) en [ADR-0009](../../decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md).

Status: **LEIDEND**  
Datum: 2026-08-02

## Doel

LiquidHR Control is een afzonderlijke, gesloten applicatie voor de leverancier van LiquidHR. De applicatie beheert klanten (tenants), hun lifecycle, administratiemodel, omvang en platformaudit. Klantgebruikers krijgen nooit toegang tot deze applicatie.

## Projectgrens

- Code: `apps/liquidhr-control`.
- Lokale poort: altijd `3001`; LiquidHR zelf blijft op `3000`.
- Later zelfstandig te deployen, met een eigen domein en eigen omgevingsvariabelen.
- De applicaties delen het Supabase-project en het tenantcontract, maar niet hun navigatie, sessie-UX of deploymentconfiguratie.
- Normaal platformbeheer gebruikt de ingelogde gebruiker en beveiligde RPC's; geen service-role sleutel in de browser of de reguliere control-appflow.

## Toegang

- Geen registratiepagina en geen self-service uitnodiging.
- Een gebruiker moet bestaan in Supabase Auth én als actieve rij in `platform_operators`.
- Rollen: `OWNER`, `OPERATOR`, `AUDITOR`.
- Alleen `OWNER` en `OPERATOR` muteren; `AUDITOR` leest.
- De eerste operator en iedere volgende operator worden bewust handmatig toegevoegd.

## Tenantmodel

Lifecycle en administratiemodel zijn onafhankelijke assen:

| As | Waarden |
|---|---|
| Lifecycle | `PROVISIONING`, `ACTIVE`, `PAUSED`, `TERMINATING`, `TERMINATED` |
| Inrichtingsmodel | Eén of meer HR-groepen met één of meer administraties per groep |

Een HR-groep is een afzonderlijke functionele HR-omgeving binnen de holding. De HR-admin switcht expliciet tussen HR-groepen en ziet binnen de gekozen groep de toegestane administraties. Een bestaande administratie kan niet naar een andere groep worden verplaatst. Een nieuwe administratie kan via Control Plane of door een HR-admin vanuit de geselecteerde HR-groep worden aangemaakt.

## Lifecycle

- Nieuwe tenants starten als `PROVISIONING` en zijn niet toegankelijk in LiquidHR.
- `ACTIVE -> PAUSED` blokkeert de tenant via bestaande `tenants.is_active`-contextcontrole.
- `PAUSED -> ACTIVE` hervat de toegang.
- Beëindiging verloopt in twee stappen: `TERMINATING -> TERMINATED`.
- `TERMINATED` is binnen de applicatie onomkeerbaar; herstel vereist een expliciete technische en juridische procedure buiten de normale UI.
- Iedere mutatie vereist een reden en schrijft een append-only platformauditregel.

## Basisfuncties

- Dashboard met aantallen tenants, actief/gepauzeerd, medewerkers, gebruikers en opslag.
- Klantenlijst met zoeken en statusfilter.
- Klantdetail met administratiemodel, actuele omvang en auditgeschiedenis.
- Onboarding van tenant, primair contact, één of meer HR-groepen en optioneel initiële/lege administraties.
- Activeren, pauzeren, hervatten, beëindiging starten en definitief beëindigen.
- Dagelijkse/on-demand gebruikssnapshots als basis voor latere historie en facturatie.

## Bewuste grenzen van deze eerste versie

- Geen deployment.
- Geen betaalprovider, facturatie of automatische incasso.
- Geen automatisch verwijderen van klantdata.
- De eerste klantbeheerder wordt na onboarding via de bestaande LiquidHR-uitnodigingsstroom aangemaakt.
- Historische grafieken en automatische dagelijkse snapshotplanning volgen na lokale validatie.
