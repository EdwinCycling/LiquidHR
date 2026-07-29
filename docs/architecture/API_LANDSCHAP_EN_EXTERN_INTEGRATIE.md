# API-landschap en externe integraties

Status: **INVENTARISATIE / nog geen besluit voor externe ontsluiting**  
Datum: 2026-07-29

## Conclusie

Liquid HR heeft een interne applicatie-API, maar geen publieke of partner-API. De bestaande routes onder `/api/*` zijn een backend-for-frontend voor de ingelogde webapp. Zij zijn geen stabiel, versioneerbaar contract voor klanten, payrollpartners of andere externe systemen.

Een toekomstige externe API krijgt daarom een apart contractvlak onder `/api/v1/*`. Bestaande interne routes worden niet rechtstreeks ontsloten.

## Huidige interne API

- 112 Next.js route handlers onder `apps/hr-suite/app/api/` (inventarisatie 2026-07-29).
- Meestal resourcegeoriënteerde paden, bijvoorbeeld `/api/employees`, `/api/departments` en `/api/reminders`.
- Domeincommando's gebruiken bewust aparte paden wanneer een gewone resourcebewerking onvoldoende betekenis heeft, bijvoorbeeld `/api/absence/report`, `/api/leave/request/preview` en `/api/reminders/[reminderId]/publish`.
- Invoer wordt in routes of services met Zod gevalideerd; responses gebruiken nog geen uniform extern foutcontract.

## Toegang en datagrens

De primaire bescherming bestaat uit:

1. Supabase-authenticatie met geverifieerde sessieclaims.
2. Server-side permissiecontrole via `requirePermission` en actieve tenant-/administratiecontext.
3. RLS op de blootgestelde database-entiteiten.

De globale Next.js-proxy laat `/api/*` bewust door. Dat is passend voor een interne BFF, mits iedere route of aangeroepen service zelf authenticatie en autorisatie afdwingt. Dit is geen geschikte enige beveiligingsgrens voor een publieke API.

## Betrouwbaarheid en schaalbaarheid

| Onderwerp | Huidige situatie | Beoordeling |
|---|---|---|
| Idempotentie | Verlofaanvragen, verlof-ledgermutaties en verzuimmeldingen/-herstel kennen idempotentiesleutels of unieke operatie-/bronkeys in de database. | Goed voor risicovolle transacties; niet uniform voor alle mutaties. |
| HTTP-semantiek | `GET`, `POST`, `PATCH`, `PUT` en `DELETE` worden gebruikt; commandoroutes gebruiken `POST` of `PATCH`. | Passend voor interne domeinlogica. |
| Paginering | Veel queries hebben een harde serverlimiet; er is geen generiek `cursor`/`limit` responsecontract. Sommige lijsten, zoals medewerkers, worden volledig geretourneerd. | Verbeterpunt vóór externe ontsluiting. |
| Versionering | Geen `/v1` of equivalent. | Geen direct probleem intern; vereist voor een publiek contract. |
| Rate limiting | Geen generieke applicatielaag aangetroffen. | Vereist voor publieke endpoints en kostbare AI-ingangen. |
| API-documentatie | Geen OpenAPI/Swagger-contract aangetroffen. | Vereist vóór partner- of klantintegraties. |

## Uitgaande externe diensten

| Dienst | Doel | Aandachtspunt |
|---|---|---|
| Supabase | Authenticatie, database en private storage. | Sessies, RLS en signed URLs zijn onderdeel van de vertrouwensgrens. |
| Google Gemini | HeRa-modelaanroepen en tool-use. | Modelcontext en geautoriseerde toolresultaten kunnen persoonsgegevens bevatten; verwerkingsgrondslag, retentie en tenantkeuze moeten expliciet worden vastgelegd. |
| PDOK | Nederlandse adressuggesties. | Alleen een zoekopdracht gaat naar de provider. |
| Geoapify | Internationale adressuggesties. | API-sleutel blijft server-side; alleen noodzakelijke adreszoekopdracht versturen. |
| Nager.Date | Feestdagenimport. | Publieke bron; provideruitval afvangen. |

Er zijn geen inkomende webhooks, publieke API-sleutels, OAuth-clientcredentials voor integratiepartners of een externe developer portal aangetroffen.

## Richting voor een toekomstige externe API

Een externe integratie wordt als afzonderlijke verticale slice ontworpen en implementeert minimaal:

1. `/api/v1/*` met een expliciet, backwards-compatible OpenAPI-contract.
2. API-clients met tenant- en administratiescopes; geen hergebruik van browsercookies als partneridentiteit.
3. Cursorpaginering, begrensde filters en consistente sortering voor elke collectieroute.
4. Een `Idempotency-Key` voor alle muterende HR-, salaris- en verloftransacties, bewaakt in de database met payload-hash en resultaat-herhaling.
5. Rate limits, auditlogging en traceerbare request-IDs.
6. Gesigneerde, herprobeerbare webhooks met eventversies en dead-letter/leveringsstatus.
7. Strikte dataminimalisatie: BSN, salaris, documenten en medische/verzuimgegevens zijn niet standaard beschikbaar en vragen expliciete scopes en beleidsbesluit.

## Eerstvolgende besluitpunten

- Welke eerste integratie rechtvaardigt een extern API-contract (bijvoorbeeld payroll, tijdregistratie of identity provisioning)?
- Welke gegevenscategorieën en mutaties mogen per integratietype beschikbaar zijn?
- Worden webhooks onderdeel van de eerste release of volgt alleen polling?
- Welk retentie-, subprocessor- en tenantbeleid geldt voor HeRa/Gemini?

Totdat deze punten zijn besloten, blijven de bestaande `/api/*`-routes uitsluitend intern.
