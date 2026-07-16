# ADR-0001: Tenant- en administratiegrenzen

**Status:** Geaccepteerd  
**Datum:** 2026-07-14

## Context

Liquid HR moet meerdere klanten in één Supabase-project ondersteunen. Klanten kunnen meerdere juridische administraties hebben en kiezen tussen gescheiden of gecombineerd operationeel gebruik. De oorspronkelijke specificatie gebruikte een lege `administration_id` als impliciete toegang tot alle administraties en maakte onvoldoende onderscheid tussen collega-deling, operationeel combineren en juridische stamgegevens.

## Besluit

1. `Tenant` is de absolute klant- en RLS-grens.
2. `Administration` is een hiërarchische juridische entiteit binnen exact één tenant.
3. `UserAccess` gebruikt expliciete scope `TENANT` of `ADMINISTRATION`; null betekent nooit vanzelf toegang.
4. Stamtabellen zijn administratiegebonden tenzij hun requirement expliciet tenantbrede eigendom vastlegt.
5. Parent-administraties leveren geen automatische stamgegevensovererving.
6. `sharing_mode` regelt zichtbaarheid van medewerker-basisgegevens; `administration_mode` regelt de operationele gebruikerservaring.
7. Combineren is een eenmalige overgang `SEPARATE → COMBINED` en zet collega-deling aan. Terugdraaien wordt database-side geweigerd.
8. De contextcookie wordt als onbetrouwbare input behandeld; servervalidatie en RLS blijven verplicht.

## Gevolgen

- Iedere administratiegebonden tabel en query draagt expliciete administratiescope.
- Tenantbrede beheerders kunnen wisselen omdat hun toegang expliciet tenantbreed is.
- Administratiegebruikers zien geen siblings zonder aanvullende accessregel.
- Gecombineerde klanten houden juridische entiteiten voor stamdata, contracten, payroll en rapportages.
- Een toekomstige splitsing vereist export en migratie naar nieuwe tenantgrenzen en is geen eenvoudige instelling.

