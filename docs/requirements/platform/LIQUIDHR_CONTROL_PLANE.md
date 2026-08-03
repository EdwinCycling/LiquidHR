# LiquidHR Control Plane

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
| Administratiemodel | `SEPARATE`, `COMBINED` |

`COMBINED` betekent één functionele organisatie en medewerkerslijst, terwijl ieder dienstverband aan een administratie gekoppeld blijft. `SEPARATE` betekent dat gebruikers alleen toegestane administraties kunnen kiezen en zien.

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
- Onboarding van tenant, primair contact en één of meer administraties.
- Activeren, pauzeren, hervatten, beëindiging starten en definitief beëindigen.
- Dagelijkse/on-demand gebruikssnapshots als basis voor latere historie en facturatie.

## Bewuste grenzen van deze eerste versie

- Geen deployment.
- Geen betaalprovider, facturatie of automatische incasso.
- Geen automatisch verwijderen van klantdata.
- De eerste klantbeheerder wordt na onboarding via de bestaande LiquidHR-uitnodigingsstroom aangemaakt.
- Historische grafieken en automatische dagelijkse snapshotplanning volgen na lokale validatie.
