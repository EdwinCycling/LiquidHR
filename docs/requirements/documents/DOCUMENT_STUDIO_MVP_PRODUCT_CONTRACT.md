# LiquidHR — Document Studio MVP Product Contract

**Status:** PRODUCT AMENDED / APPROVED — NATIVE EDITOR V1 FROZEN — READY FOR DM-0 ARCHITECTURE AMENDMENT / FEASIBILITY
**Datum:** 2 september 2026
**Productnaam in UI:** Document Studio
**Onderliggende capability:** LiquidHR Document Platform
**Epic-prefix:** `DM-` (historisch: DocMerge)

> Dit contract amendeert het eerdere frozen contract. De eerdere Word-first authoringkeuze blijft hieronder als historische traceerbaarheid bewaard, maar is voor V1 **SUPERSEDED**. Document Studio V1 gebruikt LiquidHR-native structured document authoring. Onbekende/vrije placeholders zijn nog steeds **geen first-class Document Fields**.

## 1. Productdoel

Document Studio laat een HR Admin voor één medewerker vanuit een HR-group een professioneel HR-document samenstellen met een LiquidHR-native structured template.

LiquidHR:
1. laat een HR Admin een native structured template authoren en lifecycle/versioneren;
2. stelt optioneel een Cover Template en nul of meer Appendix Templates samen rond exact één Body;
3. vult bekende Employee-, Employment-, Organisation-/Document Profile- en contextdata automatisch in;
4. ondersteunt optionele peildatum/change-context waar een template dat vereist;
5. vraagt onbekende vrije `##`-codes tijdens deze generatie handmatig uit;
6. valideert bekende verplichte data;
7. toont altijd een verplichte Preview;
8. genereert via dezelfde controlled render semantics een immutable final PDF;
9. bewaart het document in Document Studio;
10. kan het document optioneel aan het medewerkerdossier koppelen;
11. bewaart audit-, component-version- en snapshotinformatie zolang het document bestaat.

North star:
> The document is not the process. The document is a controlled outcome of the HR process.

## 2. Productgrenzen MVP

### In MVP
- zichtbare module **Document Studio**;
- HR Admin individual create flow;
- HR-group-scoped template library;
- LiquidHR-native structured template authoring;
- `DOCUMENT TEMPLATE`, `COVER TEMPLATE` en `APPENDIX TEMPLATE`;
- structured editor document met gecontroleerde primitives en template lifecycle/versioning;
- document composition: optionele cover, exact één body, nul of meer geordende appendices;
- first-class header, footer, page numbering en page break semantics;
- Document Profile-concept voor goedgekeurde document-facing organisation data;
- block images/assets met deterministische positionering;
- template validation, versioning en lifecycle;
- placeholders met `##`-syntax;
- bekende LiquidHR-velden via allowlisted semantic field catalog;
- optionele tijdelijke/peildatumcontext per template;
- onbekende vrije codes als generation-only input;
- verplichte preview;
- PDF als controlled output;
- Document Studio document history/overview;
- optionele dossierkoppeling;
- immutable final artifact + snapshot + audit;
- delete/correctieflow;
- dedicated `resource:action`-permissions;
- NL/EN als afzonderlijke templates;
- retention policy per documenttype;
- twee primaire E2E-use-cases:
  1. Salariswijziging;
  2. Werkgeversverklaring.

### Niet in MVP
- DOCX als canonical source;
- DOCX template upload/import;
- DOCX export;
- DOCX → PDF runtime generation;
- Gotenberg of LibreOffice als vereiste V1-infrastructuur;
- Word round-trip support;
- floating/absolute images, text wrapping en vrije drag-positioning;
- text boxes, arbitrary shapes, WordArt en complexe Word sections;
- vrije multi-column layout of arbitrary 3+ column designer;
- conditional content, conditional clause engine en repeating sections;
- first-class Clause Library;
- arbitrary uploaded PDF/DOCX appendix merging;
- complete Word compatibility;
- signing/acknowledgement;
- manager tasks;
- employee tasks;
- bulk/multi-send;
- AI Create / Improve / Convert;
- Document Guard;
- Smart Diff;
- Explain My Document;
- autonomous HR mutation / closed-loop mutation;
- first-class configurable Document Fields voor onbekende placeholders;
- reusable custom-field definitions;
- datatypeconfiguratie voor vrije codes;
- conditional content language;
- repeating sections/data-table engine;
- complete in-app Word clone.

### V1.x / later
- multi-send / Documents by Exception;
- Word-template import als best-effort conversie naar een LiquidHR structured document, met HR Admin review/correctie;
- veilige rich copy/paste uit Word als sanitization dit toelaat;
- rijkere native editor-capabilities binnen de gecontroleerde modelgrenzen;
- DOCX export of andere exchange formats alleen na afzonderlijke productbeslissing;
- signing;
- employee/manager actions;
- AI Template Import;
- Document Guard / Smart Diff / Explain;
- closed-loop HR transactions;
- advanced retention/compliance policies.

## 3. Rollen en autorisatie

### MVP persona
**HR Admin**

Manager en medewerker krijgen in MVP geen Document Studio workflow of taken.

### Permissions
Templatebeheer en documentacties worden niet uitsluitend aan een hardcoded HR-rol gekoppeld.

Gebruik dedicated permissions in het bestaande LiquidHR `resource:action`-model, bijvoorbeeld conceptueel:
- `document-template:read`
- `document-template:write`
- `document:read`
- `document:create`
- `document:delete`

Exacte permissionnamen worden in DM-0 aan de actuele repo-conventies aangepast.

Alle autorisatie blijft:
- server-side;
- tenant-scoped;
- HR-group-scoped;
- employee-scoped waar relevant;
- RLS defense-in-depth.

## 4. Navigatie en hoofd-UX

### Hoofdnavigatie
Document Studio is een zelfstandige module/main-menu bestemming.

### Startpagina
Document Studio opent primair op het **documentenoverzicht**.

CTA:
`Document maken`

Templatebeheer is een apart onderdeel/submenu binnen Document Studio.

### Documentenoverzicht
Minimaal zichtbaar/bruikbaar:
- medewerker;
- documentnaam;
- documenttype;
- template;
- datum;
- maker;
- status;
- taal;
- dossier ja/nee.

Exacte kolomresponsiviteit volgt LiquidHR Foundation; mobiel mag minder kolommen tonen.

## 5. Twee geldige create-entrypoints

### Vanuit medewerkercontext
`Medewerker → Template → Context → Data → Preview → Generate`

### Vanuit Document Studio/templatecontext
`Template → Medewerker → Context → Data → Preview → Generate`

Er worden geen twee verschillende documentengines of flows gebouwd.

## 6. Template Library

### Minimale productmetadata
- naam;
- omschrijving;
- template type (`DOCUMENT`, `COVER` of `APPENDIX`);
- documenttype;
- categorie;
- taal;
- tags;
- HR-group scope;
- templateversie;
- status;
- default dossierkeuze;
- composition references en expliciete appendix-volgorde waar relevant;
- Document Profile/default branding reference waar relevant;
- retention policy via documenttype;
- created/updated metadata.

### Categorie en tags
Gebruik:
- vaste/bestuurde documentcategorie;
- de **bestaande LiquidHR tag cloud** voor aanvullende tags.

Geen nieuw parallel tagsysteem bouwen.

### Talen
NL en EN zijn aparte templates.

Geen runtime vertaling van één template in MVP.

### Template lifecycle
`DRAFT → ACTIVE → ARCHIVED`

- wijzigingen aan een gebruikte/actieve template leiden tot een nieuwe versie;
- historische documenten blijven aan hun oorspronkelijke templateversie gekoppeld;
- archived templates zijn niet beschikbaar voor nieuwe generatie, maar historische documenten blijven reproduceerbaar.

Exacte activatiesemantiek per logical template/version wordt in DM-0 uitgewerkt.

## 7. Native structured authoring — V1 canonical

### 7.1 Canonical source en generation pipeline

De canonical source van Document Studio V1 is een LiquidHR-native structured
editor document. DOCX of Microsoft Word is geen authoring boundary en geen
canonical template source.

De conceptuele pipeline is:

```text
LiquidHR native editor
→ structured editor document
→ controlled render model / HTML-CSS
→ mandatory Preview
→ immutable final PDF
```

De exacte editorlibrary en server-side PDF-runtime zijn in deze productbeslissing
niet vastgelegd. Tiptap/ProseMirror is een preferred architecture feasibility
candidate, geen verplichte dependency. De editor is geen Word-clone.

### 7.2 Template types en composition

V1 kent drie lifecycle- en versiegecontroleerde template types:

| Type | Rol | Cardinaliteit in een generated document |
|---|---|---|
| `DOCUMENT TEMPLATE` | primaire body/template voor het document | exact 1 |
| `COVER TEMPLATE` | optionele cover/front matter | 0..1 |
| `APPENDIX TEMPLATE` | herbruikbare back matter | 0..n |

Een generated document is een structured composition, niet één ongestructureerde
rich-text blob:

```text
Cover 0..1
Header 0..1
Body exactly 1
Appendices 0..n
Footer 0..1
```

Een Document Template kan zonder cover werken, een geselecteerde Cover Template
gebruiken of een geconfigureerde default Cover Template uit het relevante
Document Profile gebruiken wanneer die capability in de eerste implementatie
beschikbaar is. Een cover kan de normale body header/footer onderdrukken.

Cover content gebruikt dezelfde supported native primitives en kan onder meer
logo, document title, subtitle, employee name, organisation, date, document type
en een optioneel confidentiality label bevatten. Een separate free-layout
canvas is niet onderdeel van V1.

Een Document Template kan nul of meer Appendix Templates opnemen. HR Admin
bepaalt de expliciete volgorde. Iedere generatie snapshot de exacte appendix-
templateversies; latere wijzigingen aan een appendix veranderen geen bestaand
document. Appendices beginnen standaard op een nieuwe pagina.

Een addendum is geen aparte engine: het is een normaal Document Template. Een
herbruikbare standaardsectie die achter andere documenten komt, is een Appendix
Template.

### 7.3 Gecontroleerde V1-editorcatalogus

Ondersteunde tekstprimitives:

- paragraph;
- heading 1–3;
- bold, italic en underline;
- gecontroleerde font-size set en font allowlist;
- left, center en right alignment;
- bullet list en numbered list;
- line spacing en paragraph spacing;
- horizontal rule.

Ondersteunde structure primitives:

- table;
- first-class `TwoColumnBlock`;
- page break.

Ondersteunde documentprimitives:

- A4-output en gecontroleerde margins;
- header en footer;
- page numbering;
- cover en appendices.

### 7.4 Tables en TwoColumnBlock

V1-tabellen ondersteunen rows/columns, text, placeholders, images in cells,
basic alignment, controlled column widths, borders on/off en add/delete row of
column. Nested tables, arbitrary free-positioned tables en extreem complexe
merged-cell Word-layouts zijn niet ondersteund.

Voor de veelvoorkomende compositie image/icon links plus text rechts gebruikt
V1 bij voorkeur de first-class `TwoColumnBlock`, niet een tabel met onzichtbare
opmaak. De begrensde presets zijn conceptueel `25/75`, `33/67`, `50/50`,
`67/33` en `75/25`. Iedere zijde mag bounded supported content bevatten zoals
text, heading, image, placeholder of list. Er is geen vrije grid en geen
arbitrary 3+ column designer.

### 7.5 Images en positionering

Images zijn in V1 structural en deterministic. Het basiselement is een
`BLOCK IMAGE` met controlled resize, preserved aspect ratio, left/center/right
alignment, alt text, replace/delete en een safe asset reference. Een image mag
ook in een table cell, `TwoColumnBlock`, cover, header of footer voorkomen.

Niet ondersteund zijn floating images, absolute X/Y-positioning, text wrapping,
behind/in-front-of-text, Word-style anchors, arbitrary drag positioning en een
vrije inline-flow image in text runs. De historische image-positioning-problemen
zijn de reden voor deze structurele beperking.

### 7.6 Header, footer en pagination

Header en Footer zijn first-class separate template regions. Zij kunnen de
bounded primitives bevatten die nodig zijn voor professionele HR-documenten:
text, placeholder, image/logo, alignment, bounded two-column layout en page
numbering waar passend. Zij herhalen via renderer semantics op relevante pagina's
en worden niet als gekopieerde bodytekst gesimuleerd.

Een page break is een first-class structural node, geen reeks lege paragraphs.
Renderer semantics moeten deterministic professional pagination ondersteunen,
waaronder waar haalbaar orphaned-heading avoidance, kleine layoutblokken en
kleine table rows bij elkaar houden, grote normale tabellen laten doorlopen en
appendices standaard op een nieuwe pagina starten. Volledige Microsoft Word
pagination semantics worden niet beloofd.

### 7.7 Document Profile

Document Studio kent het productconcept `DOCUMENT PROFILE` voor approved
document-facing organisation data. De concrete bestaande LiquidHR-domainnaam
en storage ownership blijven leidend; er wordt geen tweede tenant- of
organisatie-model ingevoerd.

Een Document Profile kan conceptueel legal/company name, trading name, address,
Chamber of Commerce/VAT identifiers waar beschikbaar, country, logo, contact
details, default document branding, default header/footer settings en optioneel
een default Cover Template leveren. De eerste implementatie mag dit bewust
klein houden. Scope, organisatiekeuze en employee-context worden server-side
afgeleid; client-input is nooit authoritative voor organisation substitution.

### 7.8 Editor versus Preview

De **Editor** is een continuous authoring canvas. Hij hoeft tijdens het bewerken
geen exacte fysieke A4-paginering te tonen.

De **Preview** is de authoritative print/document preview en toont A4, margins,
cover, header/footer, page breaks, appendices, images, page numbering en
resolved placeholder values waar van toepassing. Preview en final PDF gebruiken
dezelfde canonical document/render semantics; er bestaat geen tweede
formatteerlogica.

Er zijn twee onderscheiden preview-contexten:

- **Template Preview:** tijdens het ontwerpen, met sample/context values en
  eventueel visueel herkenbare placeholders;
- **Generation Preview:** met concrete employee/document/temporal/free-input
  context. Deze preview is verplicht vóór Generate en representeert het output-
  document dat immutable final artifact wordt.

### 7.9 Historische Word-first beslissing — SUPERSEDED voor V1

Het eerdere productcontract koos Word/DOCX als primaire template-authoringroute:
een HR Admin maakte een Word-template, voegde `##` placeholders toe, uploadde
het bestand, waarna LiquidHR placeholders scande, classificeerde en valideerde
voor Draft/Active. Die beslissing en de bijbehorende rendereracceptatie-baseline
(headers, footers, page breaks, page numbering, meerdere pagina's, mergevelden,
fonts, formatting, special characters, euro/accenten, afbeeldingen, tabs,
spacing, bullets en tabellen) blijven als historische audit trail behouden.

Voor V1 is dit besluit vervangen door native structured authoring. DOCX
canonical source, DOCX upload/import en DOCX → PDF generation zijn OUT OF MVP.
Een latere best-effort Word-import kan converteren naar een LiquidHR structured
document waarna HR Admin review/correctie doet; LiquidHR belooft geen permanente
Word round-trip fidelity. Rich copy/paste uit Word is alleen een mogelijke
latere capability als die veilig kan worden gesaniteerd.

## 8. Placeholdercontract

### Basissyntax
`##FieldName`

Voorbeelden:
- `##EmployeeFirstName`
- `##EmployeeLastName`
- `##JobTitle`
- `##CompanyName`

### Tijdelijke/contextvarianten
Syntax:
- `##Salary[Was]`
- `##Salary[Is]`
- `##Salary[Wordt]`

Hetzelfde patroon kan op andere daarvoor geschikte semantic fields worden toegepast.

Technische interne semantic keys hoeven niet identiek te zijn aan zichtbare templatecodes.

In editor storage zijn placeholders atomic nodes en geen toevallig opgesplitste
tekst die later opnieuw moet worden geparsed. Conceptueel:

```text
{ type: "placeholder", field: "salary", temporal: "wordt" }
{ type: "free_placeholder", key: "DrankVoorkeur" }
```

De known semantic field catalog blijft de allowlist. De picker mag de codes
mensvriendelijk als chips tonen en is conceptueel gecategoriseerd onder
Employee, Employment, Job, Compensation, Organisation, Manager, Dates, Document
en Free fields. De eerder goedgekeurde known/free/temporal-semantiek verandert
niet.

## 9. Bekende LiquidHR-fields

Bekende fields komen uit een allowlisted semantic field catalog.

Minimale domeinen:
- Employee;
- Employment;
- Company;
- change/temporal context waar ondersteund.

### Requiredness
De semantic field catalog bepaalt of een bekend LiquidHR-field verplicht of optioneel is.

### Bekend veld zonder waarde

**Optioneel bekend veld zonder waarde:**
- toon warning;
- HR mag waarde handmatig invullen;
- of expliciet leeg laten.

**Verplicht bekend veld zonder waarde:**
- HR moet een geldige waarde oplossen/invullen;
- generate wordt geblokkeerd zolang de vereiste waarde ontbreekt.

Geen `null`, `undefined` of zichtbare placeholder in output.

## 10. Onbekende vrije placeholders — belangrijk MVP-override

Een onbekende code zoals `##DrankVoorkeur` is in MVP **geen configured Document Field object**.

LiquidHR:
1. detecteert de onbekende code;
2. toont hem netjes in een aparte aanvullende-invoerstap;
3. laat HR optioneel een waarde invullen;
4. gebruikt die waarde uitsluitend voor deze documentgeneratie;
5. bewaart de gebruikte waarde in de final snapshot zolang het document bestaat.

Vrije placeholders zijn altijd **optioneel**.

Bij leeg:
- render als lege string;
- nooit `null`;
- nooit `undefined`;
- nooit de originele `##Code`.

MVP doet nadrukkelijk niet:
- persisted custom field definition;
- reusable field catalog voor vrije codes;
- datatypeconfiguratie;
- manager ownership;
- required flag;
- choices/default/helptext;
- mapping naar andere custom fields.

Dit is een expliciete override op oudere masterteksten waarin Document Fields als first-class/Must werden beschreven.

## 11. Peildatum / Was–Is–Wordt model

Niet ieder document heeft temporal/change-context nodig.

Het template/configuratiemodel moet daarom verschillende modi kunnen aangeven.

### Mode 0 — NONE
Geen peildatumvraag.

Gebruik gewone huidige/static contextdata op generatiemoment.

### Mode 1 — AS_OF
Template vraagt één peildatum.

LiquidHR resolveert daarvoor relevante temporele velden op die datum.

### Mode 2 — TWO_POINT
Template vraagt twee peildata.

Gebruik voor documenten die twee momenten moeten vergelijken.

De concrete zakelijke labels worden per use-case/templatecontext bepaald.

### Mode 3 — WAS_IS_WORDT
Template gebruikt drie semantische punten:
- **Was** — waarde op door gebruiker opgegeven historische peildatum;
- **Is** — waarde op het moment van genereren;
- **Wordt** — waarde op door gebruiker opgegeven toekomstige/effectieve peildatum of handmatig voorgestelde toekomstige documentcontext.

Voorbeeld:
- `##Salary[Was]`
- `##Salary[Is]`
- `##Salary[Wordt]`

### Geen impliciete HR-mutatie
Handmatig ingevoerde `Wordt`-waarden zijn in MVP documentcontext.

Document Studio:
- schrijft deze niet automatisch terug naar Employment/HR-data;
- voert geen hidden mutation uit;
- maakt geen arbeidsvoorwaardelijke wijziging autonoom definitief.

Later kan dezelfde Document Platform capability aan een echte HR-change workflow worden gekoppeld.

## 12. Template-validatie

Een template wordt vóór activeren schema-gevalideerd, genormaliseerd en
veiligheidsgevalideerd.

### Blocking error
Voorbeelden:
- corrupte/ongeldige template;
- ongeldige placeholder-syntax;
- required system capability die niet resolveerbaar is;
- security/file validation failure.

Template kan dan niet ACTIVE worden.

### Warning
Voorbeelden:
- onbekende vrije placeholder;
- optioneel bekend field dat mogelijk leeg is;
- niet-blocking mapping issue.

Warnings blokkeren activatie niet wanneer de template technisch veilig en uitvoerbaar blijft.

## 13. Document create flow MVP

`Document Studio / Employee context`
→ `Employee / Template`
→ `Template / Employee`
→ `Temporal context indien template dit vraagt`
→ `Bekende data resolven`
→ `Missing known data oplossen`
→ `Vrije codes optioneel invullen`
→ `Cover + Body + geordende Appendices samenstellen`
→ `Validation`
→ `Mandatory Preview`
→ `Generate PDF`
→ `Document Studio`
→ `optioneel Employee Dossier`

### Dossierkeuze
Voor generatie:
`☐ Ook opslaan in dossier`

De default is per template instelbaar en standaard **uit**.

Als niet gekozen, blijft na generatie actie beschikbaar:
`Opslaan in dossier`

Geen herhaalde verplichte popup.

## 14. Preview

Preview is **altijd verplicht** vóór Generate.

Template Preview en Generation Preview zijn verschillende contexten, maar
gebruiken dezelfde canonical document/render semantics als de uiteindelijke PDF.
Generation Preview is verplicht vóór Generate en toont de concrete samengestelde
output inclusief cover, body, appendices, images, header/footer en page numbering.

Preview moet dezelfde renderingpipeline/engine gebruiken als de uiteindelijke PDF,
zodat preview en final output functioneel gelijk zijn. Er is geen aparte
formatteerlogica voor Preview en final.

Wijzigingen tijdens preview/preparation:
- creëren geen documentversies;
- creëren geen final audit-noise;
- blijven tijdelijke working state.

Alleen de uiteindelijke `Generate` creëert het controlled artifact.

## 15. Final output

### MVP controlled output
PDF.

DOCX export is geen MVP-feature.

### Final PDF
Na Generate:
- immutable artifact;
- gekoppeld aan exact samengestelde source: Document Template-version, optionele
  Cover Template-version en Appendix Template-versions in expliciete volgorde;
- Document Profile of resolved organisation snapshot waar gebruikt;
- structured editor document en normalized render model;
- header/footer definitions, page settings en safe asset references;
- source snapshot;
- gebruikte known-field values;
- gebruikte vrije input;
- temporal/change context;
- generated by;
- generated at;
- artifact integrity/hash zolang artifact bestaat;
- renderer/version metadata waar architectonisch vereist;
- audit.

Latere wijzigingen aan employee-data of template veranderen het bestaande document niet.

## 16. Document Studio opslag en dossier

Een gegenereerd document wordt altijd in Document Studio geregistreerd.

Het employee dossier is aanvullende employee-specifieke zichtbaarheid/koppeling.

Een document kan:
- alleen in Document Studio staan;
- of ook aan het medewerkerdossier gekoppeld zijn.

De medewerkercontext van een final document is immutable.

Een document kan niet achteraf naar een andere medewerker worden omgekoppeld.

Verkeerde medewerker:
`verwijderen → opnieuw genereren`

## 17. Naam wijzigen

De documentnaam/label mag vóór Generate worden aangepast.

Na Generate is de artifact-context immutable.

## 18. Verwijderen

HR mag een fout gegenereerd document verwijderen.

### Zonder dossierkoppeling
Document kan uit Document Studio worden verwijderd.

Artifact kan worden verwijderd volgens de retention/delete policy.

Minimale tombstone-audit blijft bestaan.

### Met dossierkoppeling
Bij verwijderen vraagt LiquidHR:
- alleen uit Document Studio verwijderen;
- óók uit dossier verwijderen.

Als het dossierdocument behouden blijft, moet het onderliggende artifact uiteraard beschikbaar blijven voor het dossier.

### Audit na echte deletion
Bewaar minimaal:
- document/event-id;
- verwijderd door;
- verwijderd op;
- medewerkerreferentie;
- documenttype;
- template/templateversie;
- optionele verwijderreden.

Bewaar na echte artifact deletion niet stiekem de volledige PDF of volledige source snapshot als verborgen kopie puur om deletion te omzeilen.

Verwijderreden is **optioneel**.

## 19. Retention

Retention wordt **per documenttype** geconfigureerd.

MVP-keuze:
- `Permanent`
- of `X jaar`

`Permanent` betekent geen automatische expiry; het blokkeert niet noodzakelijk een geautoriseerde correctie/deletion.

Exacte enforcement, scheduler, legal hold en veilige purge-semantiek worden in DM-0 ontworpen.

## 20. Eerste twee E2E-use-cases

### E2E-1 — Salariswijziging
Doel: bewijst change/temporal context.

Flow:
1. HR kiest medewerker;
2. kiest Salary Change template;
3. template vraagt relevante peildatumcontext;
4. LiquidHR resolveert huidige/historische salariscontext waar beschikbaar;
5. nieuwe/toekomstige waarde kan als documentcontext worden ingevoerd wanneer nog niet persisted;
6. vrije velden indien aanwezig;
7. preview;
8. immutable PDF;
9. Document Studio;
10. optioneel dossier.

Document Studio muteert het salarisrecord niet.

### E2E-2 — Werkgeversverklaring
Doel: bewijst klassieke static merge zonder noodzakelijke change-context.

Flow:
1. HR kiest medewerker;
2. kiest werkgeversverklaring;
3. Employee/Employment/Company data resolve;
4. missing values oplossen;
5. vrije codes indien aanwezig;
6. preview;
7. immutable PDF;
8. Document Studio;
9. optioneel dossier.

Samen bewijzen deze twee journeys dat het platform generiek is en niet uitsluitend een salary-letter feature.

## 21. Security baseline voor DM-0

Document Studio verwerkt gevoelige HR-data, structured editor documents en
image/logo-assets. Een toekomstige Word-import blijft een apart upload-
securityvraagstuk.

DM-0 moet ten minste ontwerpen/bevestigen:
- tenant isolation;
- HR-group isolation;
- employee scope;
- server-side authorization;
- RLS defense-in-depth;
- private storage;
- short-lived authorized download URLs;
- structured document schema validation en normalization;
- veilige image-asset upload met MIME/signature validation;
- safe filenames;
- size/resource limits;
- malicious/active content handling voor assets en toekomstige Word-import;
- malware scanning/quarantine strategy voor toekomstige uploaded files;
- geen externe runtime-assets of ongecontroleerde HTML/CSS/URL-references;
- path traversal protection;
- fail-closed upload behavior;
- rate limiting waar applicable;
- no arbitrary SQL/code/template execution;
- audit;
- idempotent generation;
- concurrency/duplicate-final protection.

Geen secret/config cleanup hoort bij deze workstream.

## 22. Success criteria MVP

MVP is productmatig geslaagd wanneer een HR Admin:
1. een native Document Template met gecontroleerde editorprimitives kan maken;
2. optioneel een Cover Template en geordende Appendix Templates kan samenstellen;
3. known placeholders als atomic semantic nodes kan gebruiken;
4. bekende HR-, Employment-, Organisation-/Document Profile- en contextdata correct laat resolven;
5. optioneel peildatumcontext kan gebruiken;
6. onbekende vrije codes zonder configuratiewerk kan invullen;
7. deterministische block images kan plaatsen in de ondersteunde containers;
8. een betrouwbare Template Preview en verplichte Generation Preview ziet;
9. een professionele immutable PDF genereert met dezelfde render semantics;
10. die later exact kan herleiden naar composition, versions, profile/context en renderer metadata;
11. het document kan terugvinden in Document Studio;
12. het optioneel in dossier kan plaatsen;
13. een fout document veilig kan verwijderen;
14. dit alles zonder manager/employee/signing/bulk/AI-complexiteit.

## 23. Delivery roadmap

### DM-0 — Architecture & Foundation
Geen brede featurebouw.

Deliverables:
- actuele repo/domain inventory;
- Document Studio architecture contract;
- template/domain model;
- semantic field catalog contract;
- temporal context model;
- generated-document/snapshot/audit model;
- storage model;
- permission model;
- native editor / controlled render / server-side PDF architecture + spike/feasibility;
- Document/Cover/Appendix composition and Document Profile contract;
- bounded formatting, image and pagination rules;
- upload threat model;
- retention/delete design;
- migrations plan;
- vertical-slice delivery plan.

### DM-1 — Native Template Library & Structured Editor
- navigation and native template library;
- template list;
- metadata/category/tags;
- HR-group scope;
- Draft/Active/Archived;
- versioning;
- structured editor document;
- controlled placeholder nodes and validation;
- deterministic image asset references.

### DM-2 — Data Resolver & Temporal Context
- semantic field catalog;
- known field resolver;
- required/optional behavior;
- `##Field`;
- `##Field[Was|Is|Wordt]`;
- NONE / AS_OF / TWO_POINT / WAS_IS_WORDT;
- generation-only free codes.

### DM-3 — Preview & PDF Generation
- preparation state;
- Template Preview and mandatory Generation Preview;
- Cover + Body + Appendix composition;
- mandatory preview;
- same render pipeline;
- PDF generation;
- immutable artifact;
- snapshot/hash;
- idempotency.

### DM-4 — Document Studio, Dossier, Audit & Retention
- generated-document overview;
- document detail;
- optional dossier linkage;
- rename-before-generate;
- delete flow;
- tombstone audit;
- retention policy.

### DM-5 — MVP E2E Acceptance
- Salary Change full journey;
- Employer Statement full journey;
- desktop/mobile;
- tenant/HR-group/employee authorization;
- formatting golden documents;
- malicious DOCX tests;
- migration/RLS/security gates;
- Production release acceptance.

## 24. Contract freeze rule

Vanaf dit document geldt:
- productkeuzes hierboven zijn leidend voor MVP;
- het eerdere Word-first besluit blijft historische traceerbaarheid maar is voor V1 SUPERSEDED;
- oudere mastertekst blijft voor het overige inspiratie/roadmapreferentie;
- bij conflict wint dit Product Contract;
- DM-0 mag architectuurkeuzes maken die de productsemantiek niet veranderen;
- een wijziging van MVP-productscope vereist expliciete productbeslissing;
- geen implementatie van later-features "om alvast klaar te zijn", behalve nette seams/interfaces waar dat goedkoop en noodzakelijk is.

**Productbesluit voor native Document Studio V1 is hiermee gesloten.**
**Volgende stap: DM-0 Architecture Amendment en NATIVE EDITOR → HTML/PDF FEASIBILITY SPIKE.**
