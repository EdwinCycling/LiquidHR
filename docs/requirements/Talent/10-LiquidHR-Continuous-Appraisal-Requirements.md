# LiquidHR Continuous Appraisal / Doorlopende beoordeling

**Status:** LEIDEND; V2-addendum aangevuld op 14 oktober 2026

**Actuele V2-acceptatie (2026-10-15): HOLD.** De opdracht autoriseert de TEST-migratie, maar de voorafgaande 9-grid-uitvoering is door de officiële Supabase-migratieconnector geweigerd met Invalid or expired requestState. Zie [de acceptatierun](../../quality/acceptance/runs/TALENT-CONTINUOUS-APPRAISAL-UX-V2-20261015.md); post-migratiebeveiliging en persona-browsergates blijven open.
**Datum:** 3 augustus 2026
**Bron:** `C:\Users\Edwin\Downloads\Employee_timeline.md` en de aangeleverde referentieschermen
**Productbeschrijving:** één gedeelde geschiedenis voor notities, acties, afspraken, feedback, doelen/ontwikkeling en gespreksverslagen.

## 1. Doel en productgrens

Continuous Appraisal is een transparante medewerker-managermodule. De medewerker en de actuele manager zien dezelfde gedeelde timeline; er bestaat binnen deze module geen verborgen managernotitie. De module ondersteunt doorlopende gesprekken en opvolging en is geen formele beoordelingscyclus, salarisbesluit of verzuimdossier.

De eerste slice bevat:

- timeline-items: `NOTE`, `ACTION`, `AGREEMENT`, `FEEDBACK`, `GOAL`, `MEETING_SUMMARY` en systeemgebeurtenissen;
- acties met eigenaar, deadline, status en prioriteit;
- maximaal 100 tekens per commentaarregel onder ieder item;
- zoek-, type-, status-, eigenaar- en periodefilters;
- toekomstige eigen items wijzigen; inhoud uit het verleden blijft onveranderlijk;
- reguliere itemverwijdering is niet beschikbaar; het V2-addendum staat uitsluitend auditeerbare soft delete toe binnen de maker- en historiegrens;
- een medewerkerweergave op de startpagina en een volledige Workforce-werkruimte voor de manager;
- managerwissel als zichtbaar systeemitem en veilige historische handovergrens.

Bijlagen/screenshot-opslag is bewust een vervolgslice. De referentieafbeeldingen sturen de interactie en modalopbouw; de eerste databaseversie slaat geen externe URL of onveilige inline-bestandsinhoud op.

## 2. Rollen en toegang

### Medewerker

- ziet de eigen gedeelde timeline en de startpaginakaart;
- maakt notities, acties, afspraken, doelen en meeting summaries voor zichzelf;
- kan geen `FEEDBACK` namens een manager plaatsen;
- kan toekomstige eigen items wijzigen;
- kan op ieder zichtbaar item commentaar toevoegen;
- kan geen item of commentaar verwijderen en geen historische inhoud wijzigen.

### Manager

- ziet op de startpagina de eigen timeline als medewerker;
- opent vanuit Workforce de volledige timeline van actuele directe medewerkers binnen de bestaande managementscope;
- maakt items voor de medewerker en kan feedback als enige productrol aanmaken;
- kan toekomstige items wijzigen die hij/zij zelf heeft aangemaakt;
- kan op ieder zichtbaar item commentaar toevoegen;
- kan de inhoud van medewerkeritems niet wijzigen en kan niets stil verwijderen.

### HR Admin / Tenant Admin

- heeft tenantbrede lees- en beheerscope volgens de bestaande permissionmatrix;
- kan de gedeelde timeline binnen de tenant gebruiken voor ondersteuning en audit;
- krijgt geen aparte geheime notitielaag.

Nieuwe permissions zijn canoniek:

- `continuous-appraisal:manage`, `continuous-appraisal:read`, `continuous-appraisal:write`;
- `self:continuous-appraisal:read`, `self:continuous-appraisal:write`.

De UI verbergt geen beveiligingsgrens: iedere route/service gebruikt `requirePermission()` en RLS herhaalt de regel.

## 3. Eigendom, scope en managerwissel

De bronrecords zijn **tenant-owned**: ieder record bevat `tenant_id` en verwijst met samengestelde foreign keys naar `employees`. Een actieve administratiecookie is geen eigendoms- of toegangsbewijs voor de timeline. De manager- en medewerkersscope volgt de actuele effective-dated `employee_organizations`-relatie en de bestaande `internal_security`-helpers.

De veilige handoverdefault is `SYSTEM_ASSISTED`:

- de medewerker ziet volledige eigen historie;
- een nieuwe manager ziet toekomstige items, open/actieve acties, afspraken en doelen;
- oude notities, feedback en meeting summaries worden niet automatisch gedeeld vóór de ingangsdatum van de nieuwe manager;
- een managerwissel wordt als zichtbaar `SYSTEM_EVENT` geregistreerd.

Een latere instelling kan deze handover uitbreiden naar historische deling met expliciete tenantkeuze. Er is geen clientparameter waarmee een manager historische scope kan verruimen.

## 4. Itemcontract

| Type | Verplichte inhoud | Aanmaak |
|---|---|---|
| Notitie | titel, datum, beschrijving | medewerker/manager |
| Actie | titel, eigenaar, deadline, status, prioriteit, beschrijving | medewerker/manager |
| Afspraak | titel, datum, beschrijving | medewerker/manager |
| Feedback | titel, datum, beschrijving, richting manager → medewerker | alleen manager |
| Doel/ontwikkeling | titel, datum, doelsoort, beschrijving, eventueel deadline | medewerker/manager |
| Meeting summary | titel, datum, beschrijving, eventueel volgende meeting | medewerker/manager |
| Systeemgebeurtenis | titel, datum, beschrijving | alleen database-trigger |

Statuswaarden zijn `PLANNED`, `OPEN`, `WAITING`, `ACTIVE`, `DONE`, `NOT_RELEVANT`, `CANCELLED` en `ARCHIVED`. `NOT_RELEVANT` is een echte status en blijft gescheiden van `CANCELLED`. Een actie is een first-class item en wordt niet als los tekstblok gemodelleerd.

## 5. Historische integriteit

- Een item waarvan de datum al vóór vandaag ligt, kan niet inhoudelijk worden gewijzigd; items van vandaag en toekomstige items zijn nog bewerkbaar voor de maker.
- Een toekomstig item mag alleen door de maker worden gewijzigd.
- De database bewaakt identiteit, maker, datum en optimistic-lock `version`.
- Er is geen fysieke delete-route of delete-grant. De V2 soft-delete-route registreert maker, actor, tijdstip, versie en audit-event; soft-deleted items verdwijnen uit de normale timeline maar blijven in audit/historie. Alleen de maker mag een niet-systeemitem verwijderen als de datumgrens dit toestaat.
- Statusovergangen `DONE` en `NOT_RELEVANT` lopen via een aparte geautoriseerde statusroute/RPC met optimistic locking. Zij wijzigen geen titel, beschrijving of andere historische inhoud. Alleen passende open acties, afspraken en doelen tonen deze acties.
- Commentaren zijn immutable append-only records van maximaal 100 karakters.
- Mutaties worden naar de bestaande `audit_logs` geschreven; de module maakt geen tweede auditwereld.

## 6. UI-acceptatiecriteria

De referentieschermen zijn richtinggevend voor de informatiehiërarchie:

- duidelijke modal met verticale oranje accentlijn, titel, sluitknop, labels, velden, annuleren en primaire actie;
- lijst/timeline met datum, omschrijving, categorie, eigenaar en actiekolom;
- visuele categorie-badges voor actie, afspraak, feedback, doel en meeting;
- zoekveld, tabs/filters en sortering op datum; iedere tab houdt een vaste typegerichte toevoegknop, ook bij lege of gevulde resultaten;
- `Alles` opent een typekeuze; toevoegen vanuit een categorie selecteert het betreffende type vooraf. Feedback toevoegen blijft rolgebonden;
- `Klaar` en `Niet meer relevant` tonen afzonderlijke, semantisch leesbare statusbadges. Verwijderen vereist een bevestigingsdialoog met titel en waarschuwing;
- een item toont commentaar ingeklapt; openen toont de bestaande regels en een compact invoerveld met `0/100`;
- mobiele weergave stapelt velden en kaartinhoud zonder horizontaal scrollen;
- lege, fout-, laad- en geen-toegangstoestanden zijn Nederlandstalig en Engelstalig beschikbaar;
- alle zichtbare tekst komt uit `continuousAppraisal.json`.

## 7. Technische doorsnede

De verticale volgorde blijft:

```text
schema + RLS + grants + permissions + audit
  → service + zod-validatie + optimistic locking
  → API-routes
  → medewerkerstartpagina + Workforce-werkruimte
```

Nieuwe publieke tabellen zijn `continuous_appraisal_items` en `continuous_appraisal_item_comments`. De eerste slice gebruikt geen Realtime, React Query, SWR, AI-samenvatting of externe calendar/chatkoppeling.

## 8. Bewust uitgesteld

- veilige Supabase Storage-bijlagen en screenshot-preview;
- tenantinstelling voor handovervarianten;
- notificaties/reminders voor nieuwe commentaren of verlopen acties;
- formele PDF/export en koppeling aan beoordelingscycli;
- sentimentanalyse, AI-samenvatting en automatische score.

Deze uitbreidingen mogen pas na een afzonderlijk besluit worden toegevoegd en mogen de transparante timeline niet omzeilen.
