# ADR-0008 — Afzonderlijk LiquidHR Control Plane

Status: **GEACCEPTEERD**  
Datum: 2026-08-02

## Besluit

Het leveranciersbeheer wordt een zelfstandige Next.js-app in dezelfde monorepo: `apps/liquidhr-control`. LiquidHR blijft `apps/hr-suite`. Beide applicaties zijn los startbaar en later los deploybaar. Lokaal gebruikt LiquidHR poort 3000 en LiquidHR Control altijd poort 3001.

## Reden

Platformbeheer heeft een andere doelgroep, risicoklasse en lifecycle dan klant-HR-functionaliteit. Een afzonderlijke app verkleint het aanvalsoppervlak, voorkomt dat leverancieracties per ongeluk in klantnavigatie verschijnen en maakt later onafhankelijke deployment, monitoring en toegang mogelijk. Eén monorepo houdt gedeelde contracten en migraties onderhoudbaar.

## Autorisatie

Supabase Auth bewijst identiteit. `platform_operators` verleent platformtoegang. Beveiligde databasefuncties controleren de operatorrol opnieuw en schrijven audit. Er is geen openbare registratie. Een bestaande LiquidHR-gebruiker is niet automatisch platformbeheerder.

## Databesluit

Tenant-lifecycle wordt niet afgeleid uit het administratiemodel. De lifecycle staat in `tenant_lifecycle`; de functionele inrichting blijft `tenants.administration_mode`. Statuscommando's synchroniseren `tenants.is_active`, waardoor bestaande LiquidHR-contextloading een gepauzeerde of beëindigde tenant niet aanbiedt.

## Gevolgen

- De Supabase-migraties blijven centraal onder `apps/hr-suite/supabase/migrations`.
- Nieuwe platformtabellen krijgen RLS en expliciete grants.
- Platformmutaties lopen via smalle RPC's, niet via vrije tabelwrites.
- De eerste operator vereist één handmatige bootstrap na de migratie.
- Deployment en automatische planning zijn afzonderlijke vervolgbesluiten.
