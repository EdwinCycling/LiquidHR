# LiquidHR Setup Assistant — Slice 0 handoff

**Status:** GREEN — READY WITH REQUIREMENT ADJUSTMENTS  
**Datum:** 2026-08-27  
**Scope:** goedgekeurde productbesluiten voor de Setup Assistant; nog geen implementatie.

> **Supersession note — 2026-08-31:** De actuele current-main implementatie en releasecontext gebruiken permission-based autorisatie: `settings:read` voor lezen/openen en `settings:write` voor mutaties. De aanvullende `TENANT_ADMIN`-only gate uit deze historische Slice 0-handoff is daarom OBSOLETE en is niet naar main gesalvaged. De overige requirements hieronder blijven als handoff-context behouden.

Deze handoff legt de besluiten uit het externe requirementsdocument en de goedgekeurde Slice 0-opdracht vast. De bronrequirements blijven leidend voor de volledige stapcatalogus; dit document bevriest de onderstaande product- en implementatiegrenzen.

## 1. Rol en permissions

- Technische rol: `TENANT_ADMIN`.
- Zichtbare productnaam: **HR Admin**.
- Setup zichtbaar/lezen: `TENANT_ADMIN` plus `settings:read`.
- Setup ON/OFF en completion muteren: `TENANT_ADMIN` plus `settings:write`.
- CTA-bestemmingen behouden hun bestaande, eigen permissions.
- V1 introduceert geen `setup:*`-permissions.

## 2. HR-groep en ON/OFF

- Setup-instellingen en completion zijn gedeeld per HR-groep.
- Iedere bevoegde `TENANT_ADMIN` met `settings:write` voor de actieve HR-groep mag enabled state en completion wijzigen.
- Mutaties bewaren `updated_at` en `updated_by`.
- OFF verbergt edge tab en drawer, schakelt suggesties uit en behoudt bestaande completion-data.

## 3. Completion

- Completion is gedeeld per HR-groep, handmatig, reversibel en wordt nooit automatisch gezet.
- `completed_by` registreert de actor die de stap afrondt.

## 4. HeRa / Setup overlaycontract

- Er mag maximaal één shell-assistant-overlay tegelijk open zijn.
- Setup openen terwijl HeRa open is: HeRa sluiten, daarna Setup openen.
- HeRa openen terwijl Setup open is: Setup sluiten, daarna HeRa openen.
- Drawers en backdrops worden nooit gestapeld.

## 5. Vastgelegde stapbesluiten

- EMP-002 gebruikt in V1 `/settings/employment-contracts`; geen nieuwe section-anchor of deep-link uitsluitend voor Setup.
- SET-004 blijft één checkliststap met `/settings/dashboard-widgets` en `/settings/menu-order`; completion is in V1 uitsluitend handmatig en heeft geen smart suggestion resolver.
- De bestaande `hr-group:manage` / historische `hr-group:write`-inconsistentie is technische debt. Geen permission-refactor tenzij implementatie daardoor werkelijk blokkeert; bestaande route/API-contracten blijven leidend.
- EMP-003 gebruikt niet de aanwezigheid van salariswaarden of alleen bestaande salary structures als visibility-trigger. Alleen een bestaande betrouwbare expliciete salary/product-capability of expliciete non-default-configuratie mag de stap zichtbaar maken. Ontbreekt zo'n resolver, dan is EMP-003 verborgen in V1.

## 6. Persistence

De goedgekeurde richting is minimale nieuwe Setup-domeinpersistence met HR-groep-scope, RLS en auditvelden. De logische entiteiten zijn:

- `setup_guide_settings`
- `setup_step_completion`

Een migration is verwacht, maar mag niet remote worden toegepast zonder expliciete toestemming.

## 7. Slice- en Stitchgrens

- Stitch: veilig te starten.
- Slice 1-implementatie: nog niet veilig te starten; eerst deze handoff als actuele requirementsgrens gebruiken en daarna afzonderlijke implementatietoestemming afwachten.
- Deze Slice 0-handoff wijzigt geen productcode, migration of remote database.
