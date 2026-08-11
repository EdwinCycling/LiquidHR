# Teamkompas

Status: **LEIDEND voor de eerste verticale slice**
Datum: **2026-08-10**

## 1. Doel en positionering

Teamkompas is een optionele LiquidHR-module waarmee medewerkers hun natuurlijke voorkeur en het gedrag in hun huidige werkrol vergelijken. HR Admin organiseert campagnes; medewerkers vullen zelfstandig veertig dual-ratingstellingen in; HR en managers krijgen uitsluitend veilige teamprojecties.

Teamkompas is een ontwikkel- en samenwerkingsinstrument. Het is geen klinische test, geen gevalideerde Jung-, DISC- of MBTI-meting en geen bron voor automatische selectie-, promotie-, salaris- of ontslagbesluiten. De UI benoemt dit bij deelname en resultaat.

De vier dimensies zijn:

| Code | Nederlandse naam | Engelse naam | Visuele betekenis |
|---|---|---|---|
| `ACTION` | Daadkracht | Action | rood |
| `VISION` | Inspiratie | Vision | amber |
| `HARMONY` | Harmonie | Harmony | groen |
| `LOGIC` | Analyse | Logic | blauw |

Kleuren ondersteunen de betekenis, maar zijn nooit de enige informatiedrager.

## 2. Scope en eigendom

- De onveranderlijke Teamkompas-vragenlijst is productreferentiedata en daardoor tenant-onafhankelijk. Campagnes, targetafdelingen, deelnames, antwoorden en profielen zijn eigendom van exact één `tenant_id + hr_group_id`.
- Teamkompas is groepsbreed: deelnemers mogen uit meerdere administraties binnen dezelfde HR-groep komen.
- `employee_id` verwijst naar de groepspersoon. Een dienstverband of administratie is alleen momentopname/provenance en geen eigendomsgrens.
- De actieve HR-groep wordt server-side en via RLS opnieuw gevalideerd. Een andere HR-groep is nooit leesbaar of selecteerbaar.
- Campagnedeelnemers worden bij starten gesnapshot uit actuele organisatieplaatsingen. Latere organisatiewijzigingen herschrijven een gestarte campagne niet.

## 3. Rollen en permissions

| Actor | Permission | Mogelijkheden |
|---|---|---|
| HR Admin | `team-compass:manage` | Campagnes en targetafdelingen beheren; starten, sluiten en archiveren; deelnamevoortgang en veilige teamprojecties lezen. |
| Manager | `team-compass:read` | Teamprojectie van actuele managementscope lezen, uitsluitend boven de anonimiteitsdrempel. |
| Medewerker | `self:team-compass:read` | Eigen uitnodigingen, antwoorden en volledige eigen resultaten lezen. |
| Medewerker | `self:team-compass:write` | Eigen concept opslaan, indienen en eigen deeltoestemming wijzigen. |

HR en managers zien nooit ruwe antwoorden. Een medewerker ziet nooit resultaten van een collega via de self-routes.

## 4. Campagnecontract

Statusmachine:

`DRAFT -> ACTIVE -> CLOSED -> ARCHIVED`

- Alleen `DRAFT` is inhoudelijk wijzigbaar.
- Starten vereist een naam, geldige sluitingsdatum, minstens één actieve targetafdeling en minstens één gevonden deelnemer.
- Starten maakt idempotent één deelname per medewerker, ook bij meerdere plaatsingen/targetafdelingen.
- Alleen `ACTIVE` accepteert concepten of inzendingen.
- Sluiten blokkeert nieuwe writes. Archiveren verwijdert niets.
- Iedere mutatie gebruikt optimistic concurrency via `version`.
- Heropenen valt buiten deze eerste slice; er is dus geen stille heropening.

## 5. Vragenlijst en scoremodel

De eerste immutable vragenlijstversie bevat veertig stellingen: tien per dimensie. Iedere stelling krijgt twee gehele scores van 1 tot en met 5:

- `inner`: dit past van nature bij mij;
- `outer`: dit laat ik zien in mijn huidige werkrol.

Voor iedere dimensie en laag geldt:

`percentage = ((som - 10) / 40) * 100`

Coordinaten:

- `x = ((ACTION + VISION) - (LOGIC + HARMONY)) / 2`
- `y = ((ACTION + LOGIC) - (VISION + HARMONY)) / 2`

Shift:

`sqrt((outer.x - inner.x)^2 + (outer.y - inner.y)^2)`

Interpretatie:

- `< 15`: dicht bij natuurlijke voorkeur;
- `15..35`: merkbare, normale aanpassing;
- `> 35`: hoge aanpassingsvraag; dit is een gesprekssignaal, geen diagnose.

Primaire en secundaire dimensie worden stabiel bepaald op de inner-percentages. Bij gelijke scores geldt de vaste volgorde `ACTION, VISION, HARMONY, LOGIC`, zodat dezelfde input altijd dezelfde uitkomst geeft.

## 6. Privacy- en zichtbaarheidscontract

- Ruwe antwoorden en het volledige profiel zijn standaard alleen voor de medewerker.
- `share_outer_profile` en `share_inner_profile` zijn afzonderlijke, vrijwillige toestemmingen en standaard `false`.
- Een named teambord toont een collega alleen bij `share_outer_profile = true`. Inner wordt alleen toegevoegd als ook `share_inner_profile = true`.
- HR- en manageraggregaten worden pas berekend vanaf de campagnedrempel; default en minimum zijn vijf voltooide deelnames.
- Onder de drempel worden alleen aantallen en voortgang getoond, nooit kleuren, gemiddelden, named punten of afleidbare deelgroepen.
- Een managerprojectie bevat uitsluitend medewerkers binnen de actuele `can_manage_employee`-scope. HR Admin blijft aan de geselecteerde HR-groep gebonden.
- Export van ruwe antwoorden, individuele scores en onderdrempelgroepen bestaat niet in deze slice.
- Audit bevat campagne-, lifecycle-, voortgangs- en toestemmingsmetadata, maar geen antwoordinhoud.

## 7. Interface en routes

De diepe module-interface leeft in `lib/team-compass/`:

- score-engine: pure deterministische berekening;
- schemas: gedeelde Zod-contracten;
- service: enige applicatie-ingang voor campagne-, antwoord- en projectiemutaties;
- database-RPC's: atomaire start en antwoordsubmit met RLS/permissionchecks.

Routes:

- `/team-compass`: rolgestuurde startpagina voor HR, manager en medewerker;
- `/team-compass/assessment/[participationId]`: mobiele dual-ratingflow;
- `/team-compass/results/[participationId]`: volledig eigen resultaat;
- `/settings/team-compass`: lijst-eerst campagnebeheer voor HR Admin.

API-resources voor mutaties:

- `/api/team-compass/campaigns` voor atomair toevoegen/wijzigen;
- `/api/team-compass/campaigns/[campaignId]/transition` voor starten, sluiten en archiveren;
- `/api/team-compass/participations/[participationId]/response` voor concept en definitief indienen.

Interne reads lopen rechtstreeks via Server Components en de diepe service-interface; er is geen overbodige interne HTTP-roundtrip voor het overzicht.

## 8. UX-contract

- Campagnebeheer is lijst-eerst: zoeken, statusfilter, sorteren, klikrij en modal voor toevoegen/wijzigen; starten/sluiten/archiveren zijn expliciete lifecycleacties.
- Targetafdelingen gebruiken een toegankelijke zoekbare keuzelijst met checkboxen en zichtbare selectie; gesloten waarden zijn geen vrij tekstveld.
- De assessmentflow toont één stelling per stap, voortgang `x/40`, twee duidelijke 1–5-keuzes, terug/volgende en een aparte review/submitstap.
- Knoppen, statussen en dimensies hebben tekstlabels naast kleur en icoon.
- Medewerkerresultaat gebruikt één concentrisch kompas met Inner- en Outer-markering plus tekstuele scoretabel en uitleg.
- HR/manager ziet campagnevoortgang, anonimiteitsmelding, teammix en regelgebaseerde aanbeveling. De medewerker ziet eigen uitnodiging/resultaat en bepaalt delen expliciet.
- Alle zichtbare tekst staat in `messages/nl/teamCompass.json` en `messages/en/teamCompass.json`.

## 9. Niet in deze slice

- AI-gegenereerde interpretaties;
- automatische e-mail of herinneringsjobs;
- vergelijkingen tussen HR-groepen;
- selectie-/performancebesluiten, medewerker-ranking of normgroepen;
- vrij bewerkbare vragen/scoringsformules;
- PDF/export en publieke deelname-links;
- heropenen of verwijderen van historische resultaten.

## 10. Acceptatie

De slice is pas afgerond wanneer schema, RLS, expliciete grants, atomaire RPC's, permissions, module-toggle, scoretests, SQL-contracttest, API, NL/EN-UI en drie-rollen-browsercontrole dezelfde scope bewijzen. Na remote toepassing zijn officiële typegeneratie en Supabase security-/performance-advisors verplicht.
