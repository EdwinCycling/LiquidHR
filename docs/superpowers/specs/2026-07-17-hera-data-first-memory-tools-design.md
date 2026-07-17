# HeRa data-first, geheugen en veilige tools — ontwerp

Datum: 17 juli 2026  
Status: ter beoordeling  
Vervangt niet: `2026-07-16-hera-ai-agent-design.md`; dit document bouwt daarop voort en is leidend voor de hier beschreven uitbreiding.

## 1. Aanleiding

De eerste productie-eindtest toont dat HeRa technisch kan chatten, maar nog niet handelt als een betrouwbare HR-agent. De vraag _“Zijn er medewerkers die meer dan € 6.000 verdienen?”_ leverde algemene informatie op in plaats van een analyse van de gegevens van de ingelogde organisatie. Daarnaast blijkt geheugen wel opgeslagen te kunnen worden, maar niet betrouwbaar te worden teruggelezen of beheerd. Rollen en permissions worden nog niet volledig aan de agentcontext doorgegeven, een relatieve datum werd verkeerd geïnterpreteerd en het verwijderen van een gesprek met gekoppeld geheugen faalt.

HeRa wordt daarom doorontwikkeld tot een data-first HR-agent: zij analyseert en bespreekt uitsluitend geautoriseerde Liquid HR-data, maakt haar scope zichtbaar, onthoudt alleen met toestemming en voert wijzigingen alleen uit via een controleerbaar bevestigingsproces.

## 2. Functionele dekking van de initiële opdracht

| Initiële wens | Ontwerpbesluit |
| --- | --- |
| Vragen over salarissen moeten over de eigen data gaan | HR-feitvragen mogen alleen worden beantwoord na een geslaagde interne toolcall. Zonder resultaat geeft HeRa geen algemene of verzonnen invulling. |
| HeRa moet data analyseren en bediscussiëren | Antwoorden tonen conclusie, gegevensscope, relevante filters, peildatum en eventuele onzekerheid. HeRa kan vervolgvragen over dezelfde analyse beantwoorden. |
| Alleen indien nodig om aanvulling of internet vragen | Bij ontbrekende context stelt HeRa eerst één gerichte verduidelijkingsvraag. Internet staat standaard uit en wordt alleen gebruikt na een expliciet verzoek of toestemming voor die concrete zoekactie. |
| Volledige browser-eindtest op productie | De acceptatie bevat desktop, 390 px, meerdere rollen, twee gebruikers en twee tenants op een publieke Vercel-omgeving. |
| Geheugen per gebruiker en tenant isoleren | Opslag, API-autorisatie en RLS borgen gezamenlijk `(tenant_id, owner_user_id)`. Positieve en negatieve isolatietests zijn verplicht. |
| “Zal ik dit onthouden/wijzigen/verwijderen?” | HeRa herkent geheugenintenties, toont een voorstelkaart en past pas na expliciete bevestiging iets aan. |
| Geheugen bekijken, wijzigen en verwijderen | Er komt een zichtbaar geheugenbeheer met lijst, detail, bewerken en verwijderen. |
| Toon en senioriteit afstemmen en keuze geven | Er komen expliciete gebruikersinstellingen voor toon en detail-/senioriteitsniveau. Deze beïnvloeden formulering, nooit bevoegdheden. |
| Meer veilige leestools | Medewerker-, dienstverband-, salaris- en organisatie-informatie worden toegevoegd met server-side permissionchecks en RLS. |
| Meer schrijftools met voorstel → controlekaart → bevestiging | Iedere mutatie gebruikt een persistent concept, een menselijke controlekaart, expliciete bevestiging, herautorisatie en auditregistratie. |

## 3. Doelen

1. HeRa beantwoordt HR-feitvragen aantoonbaar vanuit de juiste tenantdata en binnen de rechten van de gebruiker.
2. HeRa maakt duidelijk welke populatie, periode, peildatum en filters voor een analyse zijn gebruikt.
3. HeRa kan analyses in gewone taal bespreken en passende vervolgvragen voorstellen zonder nieuwe feiten te verzinnen.
4. HeRa gebruikt werkelijk rollen, permissions, locale, tijdzone en gebruikersvoorkeuren.
5. Gebruikers hebben volledige regie over wat HeRa onthoudt.
6. Mutaties zijn veilig, controleerbaar, herhaalbaar en auditeerbaar.
7. De kernflows zijn aantoonbaar geïsoleerd per gebruiker en tenant en werken op productie.

## 4. Niet-doelen

- HeRa krijgt geen algemene, autonome internettoegang.
- Een gekozen “senior” schrijfniveau verleent geen HR-, manager- of beheerdersrechten.
- HeRa schrijft niet rechtstreeks naar domeintabellen buiten bestaande domeinservices.
- HeRa genereert geen fictieve werknemers, salarissen, trends, benchmarks of beleidsteksten als ware het Liquid HR-data.
- Bulkmutaties en onomkeerbare administratieve acties vallen buiten de eerste verticale slices.

## 5. Data-first antwoordcontract

### 5.1 Interne data is de standaardbron

De systeemprompt en toolrouter leggen het volgende harde contract op:

1. Classificeer de vraag als interne HR-feitvraag, uitleg/advies, geheugenactie, mutatieverzoek of expliciete internetvraag.
2. Gebruik voor een interne HR-feitvraag minimaal één passende leestool.
3. Formuleer uitsluitend conclusies die door het toolresultaat worden gedragen.
4. Benoem bij aggregaties de zichtbare scope, filters, peildatum en aantallen.
5. Als de data of bevoegdheid ontbreekt, leg dat concreet uit en stel zo nodig één gerichte vervolgvraag.
6. Presenteer algemene kennis nooit als informatie over de organisatie.

Voorbeeldantwoord op de oorspronkelijke testvraag:

> Ja. Binnen de 42 actieve dienstverbanden die jij voor tenant X mag bekijken, hebben 3 medewerkers op peildatum 17 juli 2026 een vast bruto maandloon boven € 6.000. Wil je de namen zien, of alleen een verdeling per afdeling? Variabele beloning is niet meegerekend.

De exacte details hangen af van de permissions. Wie alleen totalen mag zien, ontvangt geen namen of individuele bedragen.

### 5.2 Analyse en discussie

Een data-antwoord bevat waar relevant:

- de directe conclusie;
- de gebruikte broncategorie, zoals actieve dienstverbanden of actuele salarisgegevens;
- scope: tenant, toegestane populatie, periode en peildatum;
- toegepaste filters en definitie, bijvoorbeeld bruto maandloon en exclusief toeslagen;
- onzekerheden of ontbrekende velden;
- veilige vervolgopties die passen bij dezelfde permissions.

Toolresultaten leveren hiervoor gestructureerde metadata mee. De agent hoeft die niet zelf te reconstrueren.

### 5.3 Verduidelijking en internet

Bij een ambigue interne vraag vraagt HeRa alleen naar informatie die de uitkomst materieel verandert, bijvoorbeeld “bedoel je bruto basisloon of totale maandbeloning?”. Kan HeRa de gevraagde data niet vinden, dan meldt zij dat eerst.

Internetgebruik kent twee geldige routes:

- de gebruiker vraagt in het huidige bericht expliciet om internetonderzoek; of
- HeRa beschrijft één concrete zoekactie en de gebruiker geeft daarvoor toestemming.

Toestemming is eenmalig en geldt alleen voor die zoekactie. Externe informatie wordt herkenbaar gescheiden van Liquid HR-data en voorzien van bronlinks en raadpleegdatum. Zonder internettool antwoordt HeRa eerlijk dat extern zoeken nog niet beschikbaar is.

## 6. Rollen, permissions, toon en senioriteit

### 6.1 Autorisatiecontext

`requireHeRaContext()` levert de werkelijke actieve rollen en canonieke permissions uit de server-side tenantcontext. De agent krijgt alleen een compacte capabilitybeschrijving; tools controleren permissions bij iedere uitvoering opnieuw. RLS blijft de laatste verdedigingslaag.

Persona bepaalt alleen standaardpresentatie:

- medewerker: persoonlijk, helder, actiegericht;
- manager: teamgericht, samenvattend, met besliscontext;
- HR: beleidsmatig en operationeel, met definities en uitzonderingen;
- tenantbeheerder: organisatiebreed en technisch waar nodig.

### 6.2 Gebruikerskeuze

De gebruiker kan onafhankelijk kiezen uit:

- toon: vriendelijk, zakelijk of direct;
- detailniveau: compact, gebalanceerd of uitgebreid;
- senioriteitsniveau van uitleg: basis, ervaren of senior/expert.

De defaults volgen de werkcontext, maar de expliciete keuze wint. De instelling verandert alleen taal, structuur en hoeveelheid toelichting. Zij verandert nooit datascopes, permissions, goedkeuringsvereisten of zichtbare persoonsgegevens.

Hiervoor komt een aparte, RLS-beveiligde gebruikersvoorkeur per tenant. Dit is voorspelbaarder dan de instelling afleiden uit vrij geheugen.

## 7. Geheugen met gebruikersregie

### 7.1 Wat wel en niet wordt onthouden

HeRa mag na toestemming duurzame werkvoorkeuren onthouden, zoals gewenste antwoordlengte, aanspreekvorm of terugkerende rapportagevoorkeur. HeRa bewaart geen wachtwoorden, tokens, BSN, medische details, bijzondere persoonsgegevens of losse gevoelige gesprekspassages als geheugenitem.

### 7.2 Herkennen en bevestigen

Wanneer een gebruiker een duurzame voorkeur uitspreekt, stelt HeRa een concrete geheugenactie voor:

- nieuw: “Zal ik onthouden dat je korte, zakelijke antwoorden wilt?”;
- conflict: “Je eerdere voorkeur is ‘uitgebreid’. Zal ik die wijzigen naar ‘compact’?”;
- verwijdering: “Wil je dat ik deze voorkeur verwijder?”.

De kaart toont de exacte genormaliseerde inhoud, categorie en tenant. Alleen expliciete bevestiging maakt, wijzigt of verwijdert het item. Het systeem slaat de voorkeur van de gebruiker op, niet de tekst van het laatste assistentbericht.

### 7.3 Gebruik in gesprekken

Bij ieder nieuw antwoord laadt HeRa alleen actieve geheugenitems van de huidige `(tenant_id, owner_user_id)`. De prompt markeert ze als gebruikersvoorkeuren, niet als feiten over medewerkers of de organisatie. Een nieuw gesprek kan daardoor aantoonbaar dezelfde goedgekeurde voorkeur toepassen.

### 7.4 Zichtbaar geheugenbeheer

De HeRa-interface krijgt een toegankelijk geheugenpaneel met:

- alle actieve items voor de huidige tenant;
- categorie, inhoud, bron en datum;
- wijzigen via voorstel en bevestiging;
- verwijderen via bevestiging;
- een lege toestand en heldere uitleg over isolatie;
- geen mogelijkheid om geheugen uit een andere tenant te bekijken of globaal te muteren.

## 8. Veilige leestools

De eerste uitgebreide toolset bestaat uit kleine, doelgerichte serverfuncties. Iedere tool valideert input, gebruikt de bestaande service- en datatoegangslaag, controleert permissions en retourneert een begrensd resultaat met metadata.

| Toolgroep | Voorbeelden | Veiligheidskenmerken |
| --- | --- | --- |
| Medewerkers | zoeken, profielsamenvatting, toegestane teamlijst | minimale velden, paginering, PII-permission, tenantfilter |
| Dienstverbanden | status, contractvorm, begin/einddatum, uren | peildatum verplicht, historische scope expliciet |
| Salaris | telling boven/onder grens, verdeling, toegestane individuele details | salarispermission, aggregatiedrempel, geen naamlek via kleine groepen |
| Organisatie | afdelingen, functies, managers, plaatsingen | huidige/historische peildatum, alleen zichtbare onderdelen |
| Reminders | eigen reminders en status | alleen eigenaar of bestaande domeinbevoegdheid |

De salarisvraag krijgt een specifieke aggregatietool, zodat tellen en filteren in de database gebeurt en niet in het taalmodel. De response bevat onder meer `matchedCount`, `populationCount`, `currency`, `salaryBasis`, `asOfDate`, `filters`, `canRevealIndividuals` en eventueel een gepagineerde detailset.

## 9. Veilige schrijftools

### 9.1 Universele mutatiestroom

Iedere schrijfhandeling doorloopt dezelfde toestandsmachine:

`proposed → awaiting_confirmation → executing → succeeded | failed | expired | cancelled`

1. HeRa verzamelt alleen noodzakelijke velden en maakt een concept via een domeinspecifieke service.
2. De UI toont een controlekaart met wijziging, huidige waarde, nieuwe waarde, doelpersoon/-scope en gevolgen.
3. De gebruiker bevestigt of annuleert expliciet.
4. Bij bevestiging worden identiteit, tenant, permissions, actuele waarden en geldigheid opnieuw gecontroleerd.
5. De bestaande domeinservice voert de mutatie uit en schrijft auditinformatie.
6. HeRa toont het werkelijke resultaat; bij gedeeltelijke of mislukte uitvoering doet zij geen succesclaim.

Concepten verlopen automatisch. Dubbele bevestiging is idempotent. Een gesprek verwijderen ruimt concepten veilig op zonder geheugen-FK-fout.

### 9.2 Gefaseerde schrijftools

De eerste set omvat:

- persoonlijke reminder aanmaken of wijzigen;
- eigen adreswijziging voorstellen waar de bestaande domeinflow dat ondersteunt;
- toegestane salariswijziging als concept via de bestaande salaris-/dienstverbandservice;
- toegestane rooster- of urenomvangwijziging als concept;
- toegestane organisatieplaatsing als concept.

Een tool wordt pas vrijgegeven als de onderliggende domeinservice autorisatie, validatie, audit en foutafhandeling al correct ondersteunt. Anders blijft zij zichtbaar als niet beschikbaar en noemt HeRa de ontbrekende vervolgstap.

### 9.3 Tijd en tijdzone

Relatieve datums worden server-side geïnterpreteerd met de actuele datum, tenant-/gebruikertijdzone en locale. De controlekaart leest de absolute datum en tijd terug, inclusief tijdzone. Een onverwachte datum in het verleden of een ongeldige lokale tijd blokkeert bevestiging.

## 10. Technisch ontwerp en gegevensmodel

De implementatie volgt `schema → API → UI`.

### 10.1 Schema

- herstel de foreign-keystrategie tussen gesprekken en geheugen, zodat gesprekverwijdering nooit probeert `tenant_id` op `NULL` te zetten;
- breid geheugenitems uit voor genormaliseerde inhoud, status en veilige update/delete-flow waar nodig;
- voeg een RLS-beveiligde HeRa-gebruikersvoorkeur toe met unieke sleutel `(tenant_id, owner_user_id)`;
- breid actieconcepten uit met type, versie, status, expiry, controlepayload en idempotencygegevens;
- voeg geen onbegrensde ruwe modelpayloads of secrets toe;
- maak RLS-policies in dezelfde migratie en test positieve en negatieve toegang.

### 10.2 Services en API

- één centrale HeRa-contextbouwer voor identiteit, tenant, werkelijke permissions, locale, tijdzone, expliciete stijlvoorkeur en goedgekeurd geheugen;
- een toolregistry met per tool schema, benodigde permission, uitvoerder en begrensde output;
- GET/POST/PATCH/DELETE voor geheugen met eigenaarschap en tenantcontext;
- GET/PATCH voor stijl- en senioriteitsvoorkeuren;
- concept- en bevestigingsroutes die de domeinservice gebruiken en bij confirm herautoriseren;
- een expliciete bronpolicy voor intern, gebruiker-aangeleverd en extern materiaal;
- gestructureerde foutcodes die de UI vertaald weergeeft.

### 10.3 UI

- chatantwoorden tonen een compacte datascoperegel en, indien nuttig, uitklapbare analyse-details;
- geheugenvoorstellen en mutaties gebruiken afzonderlijke controlekaarten;
- zichtbaar geheugenbeheer en stijl-/senioriteitskeuze in HeRa-instellingen;
- duidelijke status voor laden, toestemming, verlopen, geannuleerd, mislukt en uitgevoerd;
- alle zichtbare tekst via gelijke NL/EN namespaces;
- bruikbaar met toetsenbord, screenreader en op 390 px zonder horizontale scroll.

## 11. Privacy en beveiliging

- Alle reads en writes vereisen server-side auth, actieve tenantcontext en canonieke permissions.
- RLS beperkt alle HeRa-tabellen tot de eigenaar binnen de tenant; domeindata behoudt eigen RLS.
- Tools ontvangen geen service-roleclient voor gebruikersvragen.
- Tooloutputs volgen dataminimalisatie, limieten en expliciete PII-/salarisbevoegdheden.
- Kleine salarisgroepen worden niet uitgesplitst wanneer dat herleidbaarheid veroorzaakt.
- Promptinjectie in gesprekstekst, opgeslagen geheugen of externe bronnen kan de toolpolicy niet wijzigen.
- Logs bevatten request-id, toolnaam, duur en uitkomst, maar geen volledige salaris- of PII-payload.
- Mutaties registreren actor, tenant, concept, bevestiging en domeinresultaat in de bestaande auditketen.

## 12. Foutgedrag

- Geen toestemming: HeRa zegt welke soort toegang ontbreekt, zonder verborgen data te bevestigen.
- Geen resultaten: HeRa meldt nul resultaten binnen de expliciete scope; zij vult niets algemeen aan.
- Ambigue vraag: één gerichte verduidelijkingsvraag.
- Toolfout: geen inhoudelijke conclusie; wel herstelbare vervolgstap en request-id waar beschikbaar.
- Modelprovider niet beschikbaar: gesprek en conceptstatus blijven consistent; er wordt geen mutatie uitgevoerd.
- Bevestiging verlopen of data intussen gewijzigd: concept blokkeren en een vernieuwde controlekaart aanbieden.
- Internet niet toegestaan: geen extern verzoek uitvoeren of impliceren dat dit is gebeurd.

## 13. Levering in verticale slices

### Slice 1 — Correctheid en vertrouwen

- data-first prompt- en antwoordcontract;
- werkelijke rollen en permissions in de context;
- correct opslaan én terugladen van geheugen;
- geheugenvoorstel voor toevoegen, wijzigen en verwijderen;
- zichtbaar geheugenbeheer;
- expliciete toon- en senioriteitsinstellingen;
- correcte relatieve tijd;
- herstel gesprekverwijdering met gekoppeld geheugen;
- herstel productie-OAuth-redirectconfiguratie;
- eerste salarisaggregatietool voor de oorspronkelijke testvraag.

### Slice 2 — Brede leestools en analyse

- medewerker-, dienstverband-, salaris- en organisatietools;
- begrensde detailweergave en aggregatieprivacy;
- analysemetadata, vervolgvragen en discussie over dezelfde dataset;
- route-, permission-, RLS- en promptinjectietests.

### Slice 3 — Veilige schrijftools en eindacceptatie

- generiek concept-/controlekaart-/bevestigingspatroon;
- gefaseerde domeinschrijftools;
- herautorisatie, idempotency, expiry en audit;
- volledige lokale en publieke productie-eindtest.

## 14. Verificatie en acceptatiecriteria

### 14.1 Geautomatiseerd

- unit-tests voor intentclassificatie, datacontract, persona, voorkeuren, geheugenextractie, datuminterpretatie en tooloutputs;
- route-tests voor auth, tenantcontext, permissions, validatie, update/delete en bevestiging;
- database-tests voor RLS, FK-verwijdergedrag, unieke voorkeuren en actieconceptstatussen;
- negatieve tests tegen cross-user, cross-tenant, salarislekken, promptinjectie, dubbele bevestiging en verlopen concepten;
- strict TypeScript, lint, relevante testsets en NL/EN-keypariteit.

### 14.2 Browser-eindtest

De volledige flow wordt lokaal op poort 3000 en op een publieke Vercel-preview getest. Na deployment volgt een productie-smoketest.

Testmatrix:

- gebruiker A en gebruiker B in tenant 1;
- gebruiker A in tenant 1 en tenant 2;
- medewerker, manager en HR-/tenantbeheercontext;
- desktop en 390 × 844;
- nieuw gesprek en vervolggesprek;
- geheugen toevoegen, toepassen in nieuw gesprek, wijzigen, verwijderen;
- voorkeur voor toon en senioriteit wijzigen;
- salarisvraag boven € 6.000 met geautoriseerde en ongeautoriseerde gebruiker;
- medewerker-, dienstverband- en organisatievragen;
- iedere vrijgegeven schrijftool: voorstel, annuleren, bevestigen, dubbele confirm en verlopen concept;
- gesprek verwijderen met en zonder gekoppeld geheugen;
- expliciete internetvraag en geweigerde toestemming;
- export, foutstatus en herstelgedrag.

Acceptatie is pas geslaagd wanneer databasecontrole bevestigt dat geen gebruiker geheugen, gesprekken, concepten of domeindata van een andere gebruiker/tenant kan lezen of muteren, en de zichtbare browseruitkomst daarmee overeenkomt.

## 15. Succesdefinitie

HeRa is voor deze uitbreiding geslaagd wanneer de oorspronkelijke salarisvraag een correct, permission-aware antwoord uit Liquid HR-data geeft; de gebruiker de analyse kan bevragen; internet niet stil wordt gebruikt; geheugen aantoonbaar per gebruiker en tenant werkt en volledig beheersbaar is; toon en senioriteit instelbaar zijn zonder autorisatie-effect; en elke mutatie pas na een begrijpelijke controlekaart en expliciete bevestiging via de bestaande domeinservice wordt uitgevoerd.
