# Employment, uitdiensttreding en herintreding

Status: goedgekeurd ontwerp, gereed voor implementatieplanning  
Datum: 15 juli 2026

## 1. Doel en kernmodel

Employee is de blijvende persoonsidentiteit binnen één tenant. Een Employee kan nul, één of meerdere dienstverbanden hebben. Dienstverbanden mogen gelijktijdig lopen, ook binnen dezelfde administratie.

Een uitdiensttreding beëindigt een dienstverband en verwijdert of dupliceert de Employee niet. Een terugkerende medewerker krijgt een nieuw dienstverband bij dezelfde Employee en wordt als herintreder herkend.

Een persoon die bij meerdere klanten voorkomt, heeft per tenant een afzonderlijke Employee. Deduplicatie zoekt nooit buiten de actieve tenant en maakt geen cross-tenant persoonsregister.

## 2. Scheiding tussen persoon, dienstverband, IKV en organisatieplaatsing

- `employees` bevat identiteit en contactgegevens.
- `employments` bevat de contractuele arbeidsrelatie met een administratie.
- `income_relationships` bevat de fiscale/loontechnische inkomstenverhouding en het IKV-nummer.
- `employment_income_relationships` koppelt deze twee tijdsgebonden.
- `employee_organizations` blijft de organisatorische plaatsing met afdeling en leidinggevende.

Employment en IKV zijn niet één-op-één. Meerdere contractuele relaties kunnen onder voorwaarden bij één IKV horen, terwijl een doorlopend dienstverband in andere situaties een nieuwe IKV kan krijgen. De koppeltabel bewaart daarom de historische relatie.

Een organisatorische plaatsing mag zonder Employment bestaan, bijvoorbeeld voor een beveiliger of andere externe aanwezige. `employee_organizations` krijgt een optionele `employment_id`; wanneer deze gevuld is, dwingt de database dezelfde tenant, administratie en Employee af.

## 3. Dienstverband

`employments` bevat minimaal:

- `id`, `tenant_id`, `administration_id` en `employee_id`;
- een uniek dienstverbandnummer binnen de administratie;
- type, contractvorm en status;
- begin- en optionele einddatum;
- proeftijd, anciënniteitsdatum, oorspronkelijke indiensttredingsdatum en contractdocumentverwijzing;
- indicator primair dienstverband, alleen voor presentatie en standaardselectie;
- auditvelden en soft-delete waar toegestaan.

Overlappende dienstverbanden zijn toegestaan. Binnen hetzelfde dienstverband mogen tijdsgebonden onderliggende records niet overlappen.

De actuele arbeidsstatus wordt afgeleid:

- `NEVER_EMPLOYED`: nooit een Employment gehad;
- `FUTURE_EMPLOYEE`: alleen een toekomstig Employment;
- `ACTIVE_EMPLOYEE`: minimaal één actief Employment;
- `FORMER_EMPLOYEE`: eerder in dienst, alle dienstverbanden beëindigd en geen toekomstig Employment.

Het bestaande `employees.is_active` betekent uitsluitend dat de persoonskaart bruikbaar/niet-gearchiveerd is en wordt niet gebruikt als arbeidsstatus.

## 4. Effectief gedateerde arbeidsvoorwaarden

De bestaande requirement wordt uitgevoerd met afzonderlijke tijdlijnen voor:

- `employment_labor_conditions`;
- `employment_schedules`;
- `employment_salaries`;
- `employment_cost_allocations`.

Iedere tijdlijn gebruikt een halfopen geldigheidsperiode `[valid_from, valid_until)`. Per Employment mogen records van hetzelfde tijdlijntype niet overlappen. Een wijzigingsactie sluit het vorige record en voegt een nieuw record atomair toe; historie wordt niet overschreven.

Salarisschalen, schaalstappen, kostenplaatsen en interne beëindigingsredenen zijn administratiegebonden stamgegevens. Wettelijke Belastingdienstcodes zijn centrale, versiegebonden systeemstamgegevens en zijn niet vrij wijzigbaar door klanten.

## 5. Inkomstenverhouding

`income_relationships` bevat minimaal administratie, Employee, loonheffingensubnummer, IKV-nummer, type, begin/einddatum en rapportagestatus. De database voorkomt conflicterende dubbele IKV-identiteiten binnen dezelfde loonadministratieve scope, maar staat meerdere parallelle IKV’s per Employee toe.

De koppeltabel naar Employment is effectief gedateerd en controleert dezelfde tenant, administratie en Employee. Daardoor blijft zichtbaar welke contractuele relatie in welke periode onder welke IKV is verwerkt.

## 6. Uitdiensttredingsproces

Iedere Employment heeft maximaal één actuele beëindiging in `employment_terminations`. Deze bevat:

- laatste contract-/werkdag;
- interne HR-reden;
- toepasselijke officiële code reden einde arbeidsverhouding;
- initiatiefnemer en toelichting waar noodzakelijk;
- workflowstatus `DRAFT`, `CONFIRMED`, `PAYROLL_READY`, `REPORTED` of `CANCELLED`;
- eindafrekeningstatus, rapportagedatum en auditvelden.

Bevestigen valideert de einddatum, sluit relevante toekomstige tijdlijnen of markeert conflicten expliciet, maar verwijdert nooit historie. Correcties verlopen als geaudite wijziging; een gerapporteerde beëindiging wordt niet stil overschreven.

Een Employee wordt pas `FORMER_EMPLOYEE` wanneer geen actief of toekomstig Employment resteert. Een externe persoon zonder Employment wordt daardoor nooit ten onrechte oud-medewerker.

## 7. Deduplicatie en herintreding

### 7.1 Exact BSN

Het leesbare BSN blijft versleuteld. Daarnaast krijgt Employee een tenantgebonden, met een serversecret berekende HMAC-vingerafdruk. De invoer voor de HMAC bevat de tenant-ID en het genormaliseerde BSN, zodat dezelfde persoon bij verschillende tenants niet correleerbaar is via de databasewaarde.

Een unieke constraint op `(tenant_id, bsn_fingerprint)` blokkeert een tweede actieve Employee met hetzelfde BSN binnen de tenant. BSN, invoer en vingerafdruk komen nooit in logs, foutmeldingen, analytics of URL’s.

Een exacte match kan niet worden genegeerd om alsnog een tweede Employee te maken. Een bevoegde gebruiker kiest de bestaande Employee of start een gecontroleerde gegevenscorrectie.

### 7.2 Match zonder BSN

Zonder BSN zoekt een beperkte serverfunctie uitsluitend binnen dezelfde tenant naar kandidaten op een gewogen combinatie van geboortedatum, geboorte-/achternaam, initialen, privé-e-mail en eventueel adres.

De gebruiker krijgt drie mogelijkheden:

1. bestaande Employee kiezen en als herintreder verdergaan;
2. bevestigen dat dit een andere persoon is, met verplichte motivatie;
3. als twijfelgeval bewaren.

Een twijfelgeval blijft concept: geen uitnodiging, actief Employment of loonverwerking totdat een bevoegde gebruiker de identiteit heeft opgelost.

`identity_match_decisions` bewaart kandidaat, beslissing, beslisser, datum, gebruikte regels en motivatie. De audit bevat geen leesbaar BSN.

## 8. Herintreding

Een herintreding maakt:

- geen nieuwe Employee;
- wel een nieuw Employment;
- zo nodig een nieuwe IKV of een nieuwe effectief gedateerde koppeling;
- nieuwe actuele arbeidsvoorwaardentijdlijnen zonder oude historie aan te passen.

`is_rehire` wordt afgeleid uit een eerder beëindigd Employment vóór de nieuwe begindatum. De UI toont de eerdere historie en vraagt expliciet om bevestiging dat de bestaande persoon wordt hergebruikt.

## 9. Autorisatie en gegevensbeveiliging

- Iedere tabel heeft RLS en policies in dezelfde migratie.
- Contractgegevens gebruiken `contract:read`, `contract:write` en passende self-rechten.
- Salarisgegevens gebruiken afzonderlijk `salary:read`, `salary:write` en `self:salary:read`.
- Deduplicatie vereist een specifiek recht en retourneert alleen minimale kandidaatdata.
- Tenant-ID en administratie-ID worden server-side uit de actieve context bepaald, nooit vertrouwd uit alleen formulierdata.
- Samengestelde foreign keys dwingen dezelfde tenant, administratie en Employee af.
- Directe cross-tenant queries leveren nul rijen of een getypeerde weigering op.

## 10. API en UI

Na de schemafase volgen serverfuncties/API-routes voor:

- personeels- en duplicaatcontrole;
- aanmaken en wijzigen van Employment;
- arbeidsvoorwaarden, roosters, salaris en kostenverdeling;
- IKV-beheer en koppeling;
- uitdiensttreding en herintreding.

Daarna volgen Server Component-pagina’s:

- medewerkersoverzicht met afgeleide arbeidsstatus;
- Employee-detail met dienstverbandtijdlijn;
- wizard voor nieuw persoon of herintreder;
- Employment-detail met tijdgebonden tabbladen;
- gecontroleerde uitdienstwizard.

Filtering, sortering en paginering zijn URL-gebaseerd. React Query en SWR worden niet gebruikt.

## 11. Testdata

De ontwikkelseed blijft deterministisch herhaalbaar en bevat:

- het bestaande testtenant met exact vijftig gevarieerde medewerkers;
- een tweede tenant met exact tien medewerkers;
- medewerkers zonder Employment;
- toekomstige, actieve en voormalige medewerkers;
- herintreders met meerdere opeenvolgende dienstverbanden;
- parallelle dienstverbanden in dezelfde en verschillende administraties;
- meerdere IKV-scenario’s;
- een veilig fictief duplicaat-/twijfelgeval.

Fictieve BSN’s worden uitsluitend als expliciete testwaarden verwerkt en nooit naar logs of screenshots geschreven.

## 12. Test- en acceptatiecriteria

- Databaseconstraints voor tenantintegriteit, BSN-vingerafdruk, effectieve periodes en IKV-koppelingen.
- RLS-tests voor iedere nieuwe tabel, inclusief negatieve cross-tenant- en cross-administratietests.
- Unit-tests voor arbeidsstatus, herintreding en matchbeslissingen.
- Integratietests voor schema → server/API → UI.
- Browsertests op desktop en mobiel voor aanmaken, parallel Employment, uitdienst en herintreding.
- Strict TypeScript zonder `any`, lint, typecheck, tests en productiebuild slagen.
- De app draait voor lokale acceptatie altijd op poort 3000.
- Iedere testbare mijlpaal krijgt een publieke preview-URL voor iPhone en externe laptop.

## 13. Bouwvolgorde

1. Authenticatie en uitnodigingen.
2. I18n, voorkeuren en thema’s.
3. Employment-schema en RLS.
4. Employment server/API.
5. Employment UI.
6. Seeds, regressietests, browsercontrole en publieke preview.

De verplichte volgorde binnen iedere verticale slice blijft `schema → API/server → UI`.
