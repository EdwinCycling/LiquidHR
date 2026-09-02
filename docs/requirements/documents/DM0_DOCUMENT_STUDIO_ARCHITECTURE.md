# LiquidHR — DM-0 Document Studio Native Editor Architecture Amendment

**Status:** PRODUCT AMENDED / APPROVED — NATIVE EDITOR V1 FROZEN — READY FOR FEASIBILITY
**Datum:** 2 september 2026
**Scope:** repository discovery, architecture and delivery design only
**Product:** Document Studio
**Underlying capability:** LiquidHR Document Platform
**Epic-prefix:** `DM-`

## 1. Besluit en grenzen

Dit document is het amendement op het eerdere DM-0-architectuurdocument voor
het geamendeerde productcontract [`DOCUMENT_STUDIO_MVP_PRODUCT_CONTRACT.md`](DOCUMENT_STUDIO_MVP_PRODUCT_CONTRACT.md).
Het contract is leidend voor productsemantiek; dit document beschrijft de
nieuwe native structured authoring-seams en markeert resterende
implementatiedetails.

De eerdere Word-first architectuur blijft verderop als historische,
superseded rationale bewaard. Zij is geen actieve V1-architectuur.

DM-0 implementeert geen productfunctionaliteit. Er zijn in deze slice geen app-code, migration, package-installatie, Supabase/Vercel-mutatie, versie-bump of main-merge toegestaan. DM-1 is niet gestart.

### Bron- en instructievoorrang

- De aangeleverde eerdere download `C:\Users\Edwin\Downloads\LIQUIDHR_DOCUMENT_STUDIO_MVP_PRODUCT_CONTRACT.md` is de historische externe productbron; het geamendeerde repositorycontract is nu de actieve productbron.
- De geplakte tekst is de actuele gebruikersopdracht: zij voegt uitvoeringsgrenzen, baseline-eisen, deliverables, branch- en verificatie-eisen toe.
- Dit repositorydocument is de gecontroleerde kopie van het frozen contract. Bij verschil wint het frozen contract voor productkeuzes en wint de actuele gebruikersopdracht voor de uitvoering van DM-0.
- [`DOCUMENTEN_EN_AI_COMPLIANCE.md`](DOCUMENTEN_EN_AI_COMPLIANCE.md) blijft een bestaande, aangrenzende/historische bron voor het huidige medewerkersdossier en latere compliance/OCR/RAG-richting. De daarin beschreven dynamische Document Fields, globale documenten en AI-compliance zijn niet leidend voor Document Studio MVP.

## 2. Baseline en repositorycontext

### Vastgestelde baseline

| Controle | Uitkomst |
|---|---|
| Baseline | actuele `origin/main` na AN-6 release |
| `origin/main` SHA | `155ccbde373a06684e37d9746b01dd65931c870b` |
| Laatste commit | `docs: record AN-6 production release` |
| Zichtbare appversie | `1.20260901.1` uit `apps/hr-suite/lib/app-version.ts` |
| Root werkboom vóór amendment | clean, branch `work/analyse-v2-foundation-discovery`, HEAD `ec66f981c9bc732b4445c76ea3d1d363b1ad567d`; niet aangeraakt |
| Historische DM-0 werkboom | clean, `.codex-worktrees/dm0-document-studio-architecture`, head `247cc22f7009caccac3a87d715ec61cb2f7823ff` |
| Bronbranch | `work/dm0-document-studio-architecture`, exact ongewijzigd gebruikt |
| Amendment werkboom | geïsoleerd in `.codex-worktrees/document-studio-native-editor-amendment` |
| Amendment branch | `work/document-studio-native-editor-amendment` vanaf exact de historische DM-0-head |
| Canonical protected env | `apps/hr-suite/.env.local` bestaat; waarden niet gelezen of afgedrukt |
| Poort 3000 | niet nodig voor deze documentatie-only amendment |

De huidige implementatie is bewust niet aangepast om Document Studio “alvast” te starten.

### Architectuurkaders

De repository gebruikt Next.js App Router, typed server-side services en Supabase met RLS. Nieuwe feature slices volgen `schema → API/service → UI`; authorization is server-side en RLS is defense-in-depth. De bestaande UI-basis is LiquidHR UX Foundation v1. Document Studio moet een eigen module-ownershipregel krijgen en bestaande Foundation-primitives hergebruiken zodra DM-1 start. Toekomstige implementatie blijft strict TypeScript zonder `any`, gebruikt geen nieuw UI-framework (geen MUI, Chakra, Ant, Radix of shadcn) en bewaart NL/EN-pariteit.

## 3. Capability-inventory: hergebruik en grenzen

### Direct herbruikbaar

| Capability | Bestaande bron | DM-0 conclusie |
|---|---|---|
| Medewerker- en employmentcontext | `lib/employees/employee-service.ts`, `lib/employment/employment-service.ts`, `lib/employment/employment-detail-service.ts`, `lib/context/server-context.ts` | gebruiken als read-side bron; geen Document Studio-writeback |
| Effective-dated employmentdata | `employment_salaries`, `employment_schedules`, `employee_organizations`, `employment_labor_conditions`, `employment_contracts`, `employments` | data-basis bestaat, generieke veilige resolver-seam ontbreekt |
| HR-group/tenant context | `lib/auth/permissions.ts`, `lib/context/server-context.ts`, `hr_groups`, bestaande group access helpers | standaard scope voor templates en generated documents |
| Company data | `lib/company-data/service.ts`, `administration_company_data` en group/company bronnen | current/static merge mogelijk; geen company-history-contract aangetroffen |
| Dossier uploads/downloads | `lib/documents/file-rules.ts`, `document-service.ts`, employee document routes/components | validatorlagen, private storage en signed-download patroon herbruikbaar; bestaande dossierentiteiten niet semantisch overbelasten |
| Bedrijfsdocumenten | `company-document-service.ts` en company-document routes | patroon voor HR-group scoped private files; geen generated-document tabel hergebruiken |
| File security primitives | `file-rules.ts`, `file-signatures.ts` | safe filename, request/file size, MIME/extensie, signature en SHA-256 zijn bruikbare onderlagen voor image assets en een latere Word-import |
| Tag cloud | `star_performer_tags`, `lib/talent/service.ts` en bestaande tag-manager | bestaande tenant-wide LiquidHR tag cloud gebruiken; geen tweede tagcatalogus |
| Permissions | `lib/auth/permissions.ts`, bestaand `resource:action` model | dedicated template/document permissions; geen hardcoded rol als autorisatiekern |
| Audit | bestaande `audit_logs` en centrale auditfuncties/triggers | bestaande auditbron gebruiken voor events; deletion tombstone is een smalle aanvullende retention-entiteit |
| Private storage | buckets `employee-documents` en `company-documents`, storage policies, short-lived signed URLs | dedicated private Document Studio prefix/bucket voor generated artifacts en safe assets adviseren |
| Native editor/rendering | geen bestaande Document Studio implementation aangetroffen | nieuwe structured-document seam; geen bestaand rich-text blob- of Word-runtimecontract hergebruiken |
| Organisation/document profile | bestaande company/administration/group-bronnen | Document Profile resolveert approved document-facing values; geen tweede tenantmodel |

### Niet rechtstreeks hergebruiken

- `employee_documents` is een dossierdocument met bestaande categorieën, audiences en legacy custom fields. Een immutable generated PDF met exact templateversion/snapshot heeft een ander eigenaarschap en lifecycle.
- `company_documents` is een HR-group-scoped bedrijfsbibliotheek, geen per-medewerker generated artifact.
- `document_categories` is administration-scoped en heeft bestaande dossiersemantiek; het is niet de nieuwe Document Studio documenttype/retentionconfiguratie.
- `custom_field_definitions` mag niet worden gebruikt voor vrije `##`-codes. Het frozen contract maakt deze inputs generation-only en niet-configureerbaar.
- `lib/hera/read-tools.ts` bewijst een beperkte as-of-queryvorm voor HeRa, maar is niet de generieke Document Studio resolver en mag niet als AI- of merge-engine worden gekoppeld.

## 4. Ownership, scope en autorisatie

### Ownershipmodel

Document Studio is een zelfstandige HR-group-scoped module:

```text
tenant
└── hr_group
    ├── Document Profile / approved document-facing organisation data
    ├── document types
    ├── template logical identities
    │   ├── Document Template identities
    │   ├── Cover Template identities
    │   └── Appendix Template identities
    │       └── template versions (NL of EN per identity)
    └── generated documents
        ├── exact composed component versions
        ├── resolved Document Profile snapshot where used
        └── exactly one immutable employee context
```

Een `administration_id` is alleen een contextreferentie als de geselecteerde employment/bedrijfsbron die waarde veilig bepaalt. Het is geen tweede eigenaar van een template of generated document.

### Voorgestelde permission-seam

De bestaande permissioncodes worden eerst naast de actuele permissionmatrix gelegd. Conceptueel zijn nodig:

- `document-template:read`
- `document-template:write`
- `document:read`
- `document:create`
- `document:delete`

`document:write` bestaat al voor legacy dossieruploads en mag niet automatisch templatebeheer of generation authority betekenen. De exacte codes en role grants worden pas in een goedgekeurde DM-1/DM-2 migration vastgelegd. De huidige HR Admin-persona is een productpersona, geen nieuwe hardcoded technische rolnaam.

### Autorisatiecontract

Elke route/service controleert server-side:

1. authenticated user en actuele tenant;
2. HR-group membership en de dedicated permission;
3. target employee binnen dezelfde tenant/group;
4. bij employment/context: de employment bij die employee en group;
5. bij template: de template en versie binnen die group;
6. bij download/delete/link: het generated document binnen dezelfde group en employee-relatie.

RLS herhaalt deze grens met bestaande `internal_security` group-permission/access helpers. Client-side employee-, group-, template-, profile-, storage-key- of retentionvelden zijn nooit authoritative. Een Document Profile mag geen client-provided scope of uncontrolled organisation substitution introduceren.

## 4a. Document Profile seam

`DOCUMENT PROFILE` is een productconcept voor approved document-facing
organisation data. De concrete bestaande LiquidHR-domainnaam en ownership
blijven leidend: resolve bestaande company-, administration- en HR-group-bronnen
waar passend en introduceer geen tweede tenant-, administratie- of
organisatie-entiteit zonder afzonderlijk besluit.

De seam kan legal/company name, trading name waar toepasselijk, address, Chamber
of Commerce/VAT identifiers waar beschikbaar, country, logo, contact details,
default document branding, default header/footer settings en optioneel een
default Cover Template leveren. De eerste implementation mag een kleine
subset ondersteunen.

De service resolveert het profiel server-side uit de geautoriseerde actuele
tenant/HR-group/context. De client mag alleen een profile reference binnen de
toegelaten scope aanvragen; tenant, HR-group, administration, employee,
organisation substitution, logo asset en retention blijven server-authoritative.
De resolved waarden en gekozen profile identity worden bij Generate in de
immutable snapshot opgenomen.

## 5. Temporal feasibility en Salary Change-gap

### Wat de repository bewijst

- `employment_salaries` bevat effective-dated salarisrecords met `valid_from`/`valid_until` en meerdere salarisvelden.
- `employment_schedules` bevat effective-dated uren/roosterinformatie.
- `employee_organizations` bevat effective-dated afdeling, functietitel en direct manager.
- `employment_contracts` bevat contractreeksinformatie met start/eind en arbeidsrelatievelden.
- `employments` bevat start/eind, status, contract type en employment type.
- De employment-detailservice kan tijdlijnen lezen; de HeRa-read-laag toont een beperkte as-of-selectie voor salaris, employment en organisatie.
- Een veilige, algemene, permission-aware resolver die Employee + Employment + Company + meerdere temporele bronnen onder één `TemporalContext` samenbrengt is niet aangetroffen.
- Company-profieldata heeft geen aangetroffen effective-dated history die een historische bedrijfsnaam/adres-resolutie bewijst.

### Classificatie

De letterclassificatie hieronder gaat over de praktische Document Studio-capability, niet alleen over het bestaan van ruwe kolommen.

| Candidate field | Classificatie | Bewijs en gevolg |
|---|---|---|
| Employee identity/name | C — current only | actuele employee-bron; geen historische identity seam aangetroffen. Resolve op generatiemoment. |
| Employment existence | B | employment heeft start/eind en kan op een datum worden geselecteerd, maar geen generieke resolver met volledige authorization/data-contract. |
| Employment status | B | status staat op `employments`; historische betekenis en overlappende employmentselectie moeten door een nieuwe resolver worden vastgelegd. |
| Contract type/employment type | B | velden bestaan op employment/contractniveau; selectie tussen contractreeks en peildatum is niet als documentcontract beschikbaar. |
| Salary | B + D | effective history en beperkte HeRa as-of-query bewijzen data-aanwezigheid; geen veilige generieke Document Studio resolver. Toekomstige persisted records kunnen bestaan. |
| Hours/schedule | B + D | effective history aanwezig; geen generieke resolver-seam; toekomstige effectieve waarden kunnen bestaan. |
| Job title | B + D | `employee_organizations` is effective-dated; actuele org/role sources bestaan, maar geen generieke join/resolver. |
| Department | B + D | effectieve organization placement bestaat; naam- en scope-resolutie moet in dezelfde resolver worden bepaald. |
| Manager | B + D | direct-managerrelatie is aanwezig in organization data; historical/permission-safe name resolution ontbreekt als algemene seam. |
| Company name/address | C | current/group/company bronnen aanwezig; historische company snapshot niet bewezen. |
| User-supplied future context | E | handmatige `Wordt`-waarde is toegestaan als documentcontext; wordt nooit automatisch HR-data. |

Er is op dit moment geen kandidaatveld dat als volledig bewezen, generiek Document Studio A-resolvercontract kan worden afgevinkt. A is wel een haalbare interne doeltoestand voor de nieuwe resolver: data met een geldige effective range plus een getest semantisch selectieregel.

### Capability decision

- `NONE`: nu bruikbaar voor static/current merge zonder temporal placeholders. Dit ondersteunt E2E-2 conceptueel zodra de resolver is gebouwd.
- `AS_OF`: contractueel ondersteund, maar per field gated. Alleen fields met een bewezen resolver mogen worden geactiveerd.
- `TWO_POINT`: modelmatig voorbereiden; geen fieldclaim zonder twee-point tests.
- `WAS_IS_WORDT`: het platformcontract blijft reëel. Voor de eerste Salary Change-journey zijn alleen `Is` en `Wordt` nodig; historische `Was`-resolutie wordt afzonderlijk bewezen in DM-2. `Wordt` kan persisted future-effective data gebruiken als die bestaat, anders een handmatige documentwaarde zijn.

De templatevalidatie en preparation state dragen de gevraagde temporal mode; de catalogus beslist per field of de combinatie uitvoerbaar is. Een template wordt niet ACTIVE wanneer het een required temporal capability vraagt die niet beschikbaar is.

### Exacte Salary Change-gap

De huidige code heeft salarisgeschiedenis en een beperkte as-of-query, maar mist één veilige seam voor Document Studio die:

- één employee/employment-context autoriseert;
- salarisrecords volgens één datumgrens selecteert;
- actuele en historische velden semantisch gelijk formatteert;
- toekomstige persisted records onderscheidt van handmatige `Wordt`-context;
- samenhang met contracttype, uren, functie, afdeling, manager en company-context vastlegt;
- geen HeRa/AI- of vrije-SQL-afhankelijkheid introduceert;
- de resolved values aan een immutable source snapshot kan leveren.

Daarom is E2E-1 niet bewezen door bestaande salary queries. DM-2 moet deze gap oplossen met een typed, allowlisted, server-side resolver en een expliciete negative/overlap testset. Document Studio mag het salarisrecord niet muteren.

### Frozen Salary Change MVP-fieldset

De eerste Salary Change-journey bewijst minimaal:

- employee identity;
- `##Salary[Is]`;
- `##Salary[Wordt]`;
- `##EffectiveDate`;
- relevante Company-fields.

`##Salary[Was]` is geen vereiste in het eerste Salary Change-document. DM-2 moet historische `[Was]`-resolutie wel afzonderlijk aantonen, zodat de generieke `WAS_IS_WORDT`-capability geen papieren contract blijft. Handmatige `Salary[Wordt]` blijft uitsluitend documentcontext en muteert nooit HR-data.

## 6. Semantic field catalog — ontwerpcontract

De catalogus is een allowlist van stabiele interne keys met zichtbare templatecodes als alias. Er is geen executable SQL in de catalogus en onbekende codes worden er niet aan toegevoegd. Iedere bekende entry heeft een vaste requiredness policy, conceptueel `requiredWhenReferenced=true` of `requiredWhenReferenced=false`. Een template mag die policy in MVP niet overrulen.

| Domain | Visible code | Internal key | Type | Requiredness | Temporal mode | Resolver contract | Sensitivity/formatting |
|---|---|---|---|---|---|---|---|
| Employee | `##EmployeeFirstName` | `employee.first_name` | text | `requiredWhenReferenced=true` | NONE | authorized employee read | HR-PII; plain text, trim |
| Employee | `##EmployeeLastName` | `employee.last_name` | text | `requiredWhenReferenced=true` | NONE | authorized employee read | HR-PII; plain text, trim |
| Employee | `##EmployeeNumber` | `employee.employee_number` | text | `requiredWhenReferenced=false` | NONE | authorized employee read | identifier; no locale mutation |
| Employment | `##EmploymentNumber` | `employment.number` | text | `requiredWhenReferenced=false` | AS_OF-capable after seam | selected employment resolver | identifier; no placeholder fallback |
| Employment | `##EmploymentStartDate` | `employment.starts_on` | date | `requiredWhenReferenced=true` | AS_OF | employment-at-date resolver | locale-aware NL/EN date |
| Employment | `##EmploymentEndDate` | `employment.ends_on` | date | `requiredWhenReferenced=false` | AS_OF | employment-at-date resolver | empty only when genuinely absent |
| Employment | `##EmploymentStatus` | `employment.status` | enum label | `requiredWhenReferenced=true` | AS_OF | allowlisted status mapping | unknown codes block; no raw code output |
| Employment | `##ContractType` | `employment.contract_type` | enum label | `requiredWhenReferenced=true` | AS_OF/TWO_POINT gated | contract-at-date resolver | unknown codes block |
| Employment | `##Salary` | `employment.salary` | money | `requiredWhenReferenced=true` | AS_OF/TWO_POINT/WAS_IS_WORDT gated | salary effective-range resolver | currency, decimal and frequency policy fixed per locale |
| Employment | `##WeeklyHours` | `employment.weekly_hours` | decimal | `requiredWhenReferenced=true` | AS_OF/TWO_POINT/WAS_IS_WORDT gated | schedule effective-range resolver | locale decimal formatting |
| Employment | `##JobTitle` | `employment.job_title` | text | `requiredWhenReferenced=true` | AS_OF/TWO_POINT/WAS_IS_WORDT gated | organization effective-range resolver | plain text |
| Employment | `##Department` | `employment.department_name` | text | `requiredWhenReferenced=false` | AS_OF/TWO_POINT/WAS_IS_WORDT gated | organization effective-range resolver | plain text |
| Employment | `##ManagerName` | `employment.manager_name` | text | `requiredWhenReferenced=false` | AS_OF/TWO_POINT/WAS_IS_WORDT gated | authorized manager identity resolver | HR-PII; plain text |
| Company | `##CompanyName` | `company.name` | text | `requiredWhenReferenced=true` | NONE | authorized current company resolver | legal/current label |
| Company | `##CompanyAddress` | `company.address` | multiline text | `requiredWhenReferenced=true` | NONE | authorized current company resolver | line breaks preserved |
| Context | `##EffectiveDate` | `context.effective_date` | date | `requiredWhenReferenced=true` | AS_OF/TWO_POINT/WAS_IS_WORDT | temporal/document context resolver | business/effective date; locale-aware |
| Context | `##GenerationDate` | `context.generated_at` | date | `requiredWhenReferenced=true` | NONE | server clock at Generate | locale-aware; not client supplied |

### Contractregels

- Visible codes are normalized only for scanning/lookup; output preserves values, not source placeholder syntax.
- A catalog entry has one resolver owner, a type, a sensitivity class, a formatting rule, a fixed `requiredWhenReferenced` policy and supported temporal modes.
- Templates cannot override the requiredness policy of a known field in MVP. When a referenced known field has `requiredWhenReferenced=true` and cannot be resolved or validly supplied, Generate blocks.
- Missing optional known value is a warning and can be manually supplied or intentionally blank.
- Missing required known value blocks Generate.
- Unknown valid `##Code` values are generation-only optional inputs. They are tracked in preparation and final snapshot, not in this catalog or `custom_field_definitions`.
- Unknown/malformed/ambiguous codes never become executable expressions, SQL, paths, URLs or property accessors.

## 6a. Structured template document model

De canonical source van V1 is versioned editor JSON volgens een allowlisted
structured document model. De exacte editorlibrary is niet bevroren; een mature
extensible architecture zoals Tiptap/ProseMirror is de preferred feasibility
candidate. De library is een adapter achter de Document Studio document-model
seam, niet het productcontract zelf.

De documentmodel-interface maakt composition en rendering expliciet:

```text
structured document
├── cover: 0..1 bounded region
├── header: 0..1 bounded region
├── body: exactly 1 document region
├── appendices: 0..n ordered bounded regions
└── footer: 0..1 bounded region
```

Ondersteunde nodes zijn beperkt tot paragraph, heading 1–3, inline formatting,
lists, horizontal rule, table, `TwoColumnBlock`, block image en page break. De
modelmetadata draagt A4, controlled margins, allowed fonts/sizes en de
document-/profile-/compositionreferences. Het model bevat geen arbitrary HTML,
CSS, JavaScript, URL-fetch of vrije layout-instructie.

Known placeholders en temporal placeholders zijn atomic semantic nodes, niet
tekst die door split-run parsing moet worden gereconstrueerd:

```json
{ "type": "placeholder", "field": "salary", "temporal": "wordt" }
{ "type": "free_placeholder", "key": "DrankVoorkeur" }
```

De `field` verwijst alleen naar de server-side allowlisted semantic catalogus;
`free_placeholder.key` is een bounded identifier en geen property path of
executable expression. Placeholderwaarden worden pas in preparation/Generate
resolved en blijven plain escaped content.

De normalizer is een diepe module achter een kleine render-interface: hij
valideert schema en cardinaliteit, normaliseert toegestane nodes/attrs en
produceert één controlled render model voor Template Preview, Generation Preview
en final PDF. Onbekende nodes, attrs, styles, externe assets en onveilige
referenties blokkeren voordat een renderer wordt aangeroepen.

## 6b. Document composition en componentversies

Een Document Template-version bevat de body en de composition-configuratie.
Cover- en Appendix Template-versions zijn afzonderlijke immutable componenten.
Composition resolveert uitsluitend server-side geldige versies uit dezelfde
HR-group, bewaart de expliciete appendix-volgorde en bepaalt header/footer-
overrides volgens één contract. De generated-document snapshot bevat de exacte
component-ID's en versies, de normalized composition en de profile snapshot.

Later wijzigen van een Document Template, Cover Template, Appendix Template,
Document Profile, header/footer-definitie of asset verandert geen eerder
generated document.

## 7. Template model en ontwerp-lifecycle

### Logical model

De voorgestelde nieuwe tabellen zijn conceptueel, niet als SQL uitgewerkt:

| Entiteit | Belangrijkste gegevens | Scope/regels |
|---|---|---|
| `document_studio_document_types` | tenant/group, stable code, name, category, retention kind, retention years, active status, created/updated actor/time | HR-group-owned; category is controlled metadata; retention is `PERMANENT` of bounded `YEARS` |
| `document_studio_templates` | tenant/group, logical key, template kind (`DOCUMENT`/`COVER`/`APPENDIX`), name, description, document type, language (`nl`/`en`), default dossier choice, active logical pointer, created/updated metadata | NL en EN zijn afzonderlijke logical templates; unique per group/logical key/language/kind |
| `document_studio_template_versions` | template id, integer version, status, canonical structured editor document, composition/configuration, header/footer definitions, render policy, safe asset references, placeholder manifest, validation result, temporal mode/config, content checksum, created/activated/archived metadata | `DRAFT → ACTIVE → ARCHIVED`; source/version used by a generated document is immutable |
| `document_studio_template_tags` | template/version relationship and existing `star_performer_tags` relationship | reuse existing tag cloud; no new tag definitions |

`document_studio_templates` is the stable identity. `document_studio_template_versions` is the immutable structured source/config unit used by generation. Activating a new version moves the previous active version to historical/archived state after the replacement is valid. A used archived version remains readable for historical documents and reproduction/audit; it is not selectable for new generation.

### Metadata and validation

The placeholder manifest records detected visible codes, normalized known/unknown classification, requiredness result and temporal requirements. It is derived data, not a permission source. Template activation requires a valid structured document, supported composition, complete capability set and no blocking security result. Unknown free codes produce warnings only when schema/security validation is green.

### Structured-document validation profile

The structured-document validator/normalizer must validate, at minimum:

- schema version, node types, node attributes and region cardinalities;
- supported formatting values, font allowlist, font sizes, A4/margin bounds and composition ratios;
- atomic known/free/temporal placeholder node shape and catalog membership;
- table, `TwoColumnBlock`, image-container and page-break constraints;
- bounded text/row/column/node sizes and no nested tables or arbitrary layout instructions;
- no arbitrary HTML, CSS, JavaScript, URL, property path, expression or executable content;
- safe asset references that resolve only to authorized, HR-group-scoped assets;
- deterministic normalized output independent of client ordering or unsupported attributes.

### Future Word-import security profile

DOCX is OUT OF MVP, but a later best-effort Word import remains an uploaded-file
boundary. The former Word-first security decision is retained as future
architecture: accept `.docx` only through private quarantine; validate extension,
MIME, magic/signature, OOXML/ZIP limits, XML parts, relationships, macros/OLE/
ActiveX/embedded active content, safe names and external references; scan before
conversion; and fail closed while scan is unavailable or inconclusive. Imported
content may enter the native model only after conversion plus HR Admin
review/correction. It never restores a Word round-trip promise.

This is a future upload gate in addition to the native V1 model. SEC-006 is not
globally closed; the repository’s current malware-scanning/quarantine residual
remains explicit. Native V1 image assets have their own authorized upload,
signature, size, storage and rendering controls described below.

## 7a. Image asset seam

Images and logos are safe assets, not arbitrary remote references. A future
asset module must provide:

- server-side authorized upload under the existing tenant/HR-group model;
- supported image formats, MIME plus file-signature validation and bounded
  dimensions/bytes;
- generated safe storage keys and private storage with HR-group scoping;
- deterministic asset references in the structured document and in the final
  snapshot;
- safe decoding/rendering, no external hotlink or runtime fetch, and no client-
  supplied scope/path authority;
- replace/delete behavior with lifecycle handling for assets still referenced
  by active versions or immutable generated documents.

V1 positioning is structural: a block image or an image inside a supported
container (table cell, `TwoColumnBlock`, cover, header or footer) carries its
alignment, bounded size and preserved aspect ratio. The renderer consumes only
authorized asset references from the normalized render model.

## 8. Generated document, snapshot and deletion model

### Proposed entities

| Entity | Purpose and minimum fields | Lifecycle |
|---|---|---|
| `document_studio_generated_documents` | tenant/group, employee, selected employment/context, optional administration reference, document type, logical Document Template/version, language, label, status, generated by/at, PDF storage key, content type, byte size, SHA-256, retention policy/expiry snapshot, idempotency key, deletion markers | created only by Generate; final context, composition and artifact references immutable; status may transition to deleted |
| `document_studio_source_snapshots` | generated-document id, snapshot schema version, structured editor document, normalized composition, exact Document/Cover/Appendix component versions and order, header/footer/page settings, resolved Document Profile/organisation values, authorized asset references, resolved known values, generation-only free values, temporal context, renderer metadata, source/template checksum and selected identifiers | created atomically with final document; deleted with the real artifact; no hidden full copy after deletion |
| `document_studio_dossier_links` | generated-document id, tenant/group/employee, linked time/actor, link status | optional, unique per generated artifact; unlink does not change generated artifact identity |
| `document_studio_deletion_tombstones` | event/document id, tenant/group/employee reference, document type and template/version references, deleted by/at, optional reason, dossier action, artifact deletion result | append-only minimum record after actual row/artifact deletion; no full PDF or full source snapshot |

The generated document’s `employee_id` is immutable and protected by a database relation plus service checks. There is no relink-to-another-employee operation. Wrong employee means delete and regenerate.

### Dossier semantics

Do not copy the PDF into `employee_documents` merely to make it appear in a dossier. That would duplicate artifact lifecycle and confuse legacy document categories/custom fields. Use a narrow bridge relation and extend the dossier read model in DM-4 so the same generated artifact can be shown/downloaded under the employee context. If the dossier link is retained, deletion must offer:

- remove from Document Studio and dossier, permitting artifact deletion; or
- remove only from Document Studio and retain the dossier link/artifact.

An explicit link is not a second owner and cannot change employee, source snapshot or template version.

Product Review approves this bridge direction. Link and unlink require a separate authorization capability from basic document create/read; the exact permission identifier follows current repository conventions and is finalized in implementation design.

### Idempotency and concurrency

The Generate request gets a server-created/request-bound idempotency key. A group-scoped uniqueness rule and a transaction-level duplicate check prevent two final rows for the same accepted request. Generate re-authorizes and re-resolves after Preview; it does not trust client preparation state. Storage staging and cleanup must be compensating and idempotent so a failed metadata transaction cannot leave an accessible orphan.

## 9. Retention, expiry and deletion

### Policy

The document type owns `PERMANENT` or `YEARS` retention. An HR-group-authorized administrator owns configuration of that document-type policy. At Generate, the selected policy and calculated `expires_at` are snapshotted on the generated document. A later document-type policy change does not silently rewrite historical obligations.

### MVP enforcement design

- `PERMANENT`: no automatic expiry; authorized correction/deletion remains possible.
- `YEARS`: positive bounded integer, calculated with one documented timezone/date rule.
- Manual delete is permission-gated and records a tombstone after real deletion.
- Dossier-linked artifacts remain available until the dossier link is removed or an approved shared-artifact deletion action handles both surfaces.
- Automatic expiry/purge is designed as a later idempotent worker/scheduler; DM-0 creates no scheduler.
- Legal hold is later. Its absence must not be represented as if a legal-hold feature exists.
- Purge must remove the PDF and full snapshot, verify storage deletion, and retain only the minimum tombstone/audit record.

## 10. Controlled render model en server-side PDF architecture

### Current deploy/dependency facts

`apps/hr-suite/package.json` bevat Next.js 16.3.0, React, TypeScript, Supabase,
Zod en `sharp`; er is geen native Document Studio editor, PDF-library of
renderer dependency geïnstalleerd. No package was installed in DM-0 or in this
amendment.

Vercel documenteert limieten voor memory, bundle size, request/response payloads
en execution duration. De render-runtime blijft daarom achter een expliciete
server-side seam en wordt niet als client-only final PDF generation in een
normale browser uitgevoerd. De precieze plaatsing (dedicated worker, isolated
runtime of passende andere server-side adapter) volgt uit de feasibility-spike
en een afzonderlijke infrastructuurbeslissing wanneer nodig. Zie [Vercel
Functions limits](https://vercel.com/docs/functions/limitations).

### Active architecture decision

De actieve V1-architectuur gebruikt één controlled render model voor Template
Preview, Generation Preview en final Generate:

```text
Next server route/service
  ├─ authenticate, scope and validate request
  ├─ load authorized Document/Cover/Appendix versions, profile and assets
  ├─ resolve allowlisted known/free/temporal values
  ├─ normalize structured editor document and composition
  └─ call server-side renderer through one controlled seam
       ├─ render normalized HTML/CSS or equivalent print representation
       ├─ apply A4, margins, header/footer, page-break and pagination semantics
       └─ return PDF bytes, content metadata, hash, renderer/version result
  ├─ Template Preview: sample/context values, no final row
  ├─ Generation Preview: concrete context, temporary controlled output
  └─ Generate: revalidate, render, hash, persist artifact + snapshot + audit
```

The exact server-side PDF runtime is **NOT SELECTED** in this documentation-only
amendment. The output representation may be controlled HTML/CSS or an equivalent
print model, but arbitrary user HTML/CSS execution is not allowed. The renderer
must consume only the normalized render model and authorized asset references.
There is no client-only final PDF path and no client-supplied renderer URL.

The application-facing renderer seam has one contract for Preview and Generate:

```text
validate structured document and composition
→ resolve allowlisted values and authorized assets
→ normalize to controlled render model
→ render server-side to PDF
→ return bytes, content metadata, hash, renderer version and diagnostics
```

Preview output is ephemeral; only Generate persists the controlled artifact.
The same normalized document, composition, component versions, resolved context,
asset references and renderer semantics are used for Generation Preview and
final Generate. Ordinary PDF is the MVP controlled output; PDF/A is not required.

### Editor and renderer decision status

| Seam/option | Strength | Blocking concern | Amendment status |
|---|---|---|---|
| Tiptap/ProseMirror or comparable mature editor | extensible structured JSON, atomic nodes and editor ecosystem | exact schema integration, bounded nodes and UX feasibility remain to prove | preferred feasibility candidate; not selected or installed |
| Controlled HTML/CSS print representation | maps naturally from normalized structured content and supports a single render model | pagination, fonts, A4 fidelity, asset safety and server-side runtime need proof | candidate representation; not a production runtime decision |
| Gotenberg + LibreOffice | relevant to historical Word/DOCX conversion | unnecessary V1 dependency while DOCX is out of MVP; operational infrastructure was unavailable in historical spike | not required or selected for native V1; future option only after explicit approval |
| Direct LibreOffice or managed conversion service | possible future adapters for Word import or other formats | security, hosting, licensing and scope approval | outside this amendment and not selected |

The former Word-first renderer rationale is not deleted; it is historical below.
It no longer creates a V1 hard dependency on DOCX, a DOCX parser, split-run
replacement, Gotenberg or LibreOffice.

### Controlled render security and determinism

- The renderer accepts only a normalized, schema-validated model; it never
  executes arbitrary HTML, CSS, JavaScript, expressions, SQL, paths or URLs.
- Assets are authorized, HR-group scoped, safe-decoded and referenced by
  deterministic internal identifiers; external hotlinks and runtime fetches are
  rejected.
- The runtime is server-side, isolated where possible, has no outbound network
  by default and enforces per-request byte, node, page, memory, time and retry
  limits.
- Fonts, locale, timezone, renderer/runtime version and pagination settings are
  pinned once selected and recorded in the generation snapshot.
- Temporary render inputs/outputs are removed on success and failure; a failed
  render cannot expose an accessible orphan or create a final row.
- Preview has no final audit/history row. Generate re-authenticates,
  re-resolves, re-normalizes, re-renders, verifies PDF integrity and finalizes
  artifact, snapshot and audit atomically.
- Fidelity checks compare semantic content, page count, layout anchors and
  rasterized pages at a pinned runtime; byte equality across runtime upgrades is
  not assumed.

### Former Word-first architecture — historical / SUPERSEDED for V1

The former DM-0 direction was:

```text
uploaded DOCX
→ private quarantine and OOXML scan
→ split-run placeholder detection/replacement
→ Gotenberg + pinned LibreOffice (or direct LibreOffice fallback)
→ PDF
```

That architecture was intended to preserve arbitrary Word layout and included
DOCX-specific validation, macro/relationship controls and a private office-native
renderer boundary. The split-run problem, quarantine path and office renderer
remain useful historical rationale and future Word-import security requirements.
The product amendment explicitly supersedes Word-first authoring for V1, so the
former parser/replacement/rendering path is not the active template boundary.

The former DM-0 technical decisions remain recorded here for traceability:

- `.docx` was the only accepted MVP source; `.doc`, `.docm`, arbitrary ZIPs,
  macro/OLE/ActiveX/embedded executable content and disallowed external
  relationships were rejected;
- archive/XML structure, entry count, compressed/uncompressed size, expansion
  ratio, path traversal, safe filenames and placeholder syntax across body,
  header and footer were validated before activation;
- the former application adapter was `validate → scan OOXML/relationships/
  placeholders → resolve allowlisted values → replace while preserving Word XML
  structure → render DOCX to PDF → return bytes/hash/renderer metadata`;
- Gotenberg with pinned LibreOffice was the former recommended primary,
  isolated direct LibreOffice the fallback, Docxtemplater only a possible
  replacement adapter, and HTML/browser PDF rejected as the arbitrary-DOCX
  fidelity baseline;
- the former golden suite covered headers, footers, page breaks, page numbers,
  multiple pages, merge fields, fonts, formatting, special characters,
  euro/accent characters, images, tabs, spacing, bullets and tables.

These are historical/superseded decisions, not new native V1 requirements. The
security controls remain relevant if a future Word-import seam is approved.

## 10a. NATIVE EDITOR → HTML/PDF FEASIBILITY SPIKE — NEXT GATE

Before DM-1 implementation or migration commitment, run one disposable,
synthetic-only feasibility spike. It must prove the risky seams of the revised
architecture, not build DM-1 in full:

1. versioned structured editor JSON;
2. paragraph, heading and basic formatting;
3. atomic known/free/temporal placeholder nodes;
4. table;
5. `TwoColumnBlock`;
6. block image/logo;
7. image inside table and `TwoColumnBlock`;
8. header/footer;
9. page break;
10. Cover + Body + Appendix composition;
11. multi-page A4;
12. controlled HTML/CSS or equivalent print render;
13. server-side PDF;
14. Template Preview;
15. Generation Preview;
16. Preview/final fidelity;
17. deterministic image positioning;
18. appendices starting on a new page;
19. no page-wide/editor overflow;
20. basic asset/render security boundaries.

The spike must explicitly test the historical pain point that image positioning
remains stable:

- image left, center and right;
- image resizing with preserved aspect ratio;
- image in `TwoColumnBlock`;
- image in a table cell;
- image in header and cover;
- PDF pagination around each of those elements.

Required conceptual pipeline:

```text
synthetic structured document and safe synthetic assets
→ schema validation and normalization
→ authorized placeholder/context resolution
→ controlled server-side render boundary
→ Template Preview and Generation Preview
→ final PDF from the same render semantics
→ golden/visual fidelity assessment
```

The spike is disposable and outside committed application code. No editor,
renderer, package, container, license, external service or production
configuration may be selected, installed or committed by this amendment. A
failed or incomplete spike blocks the full DM-1 implementation/migration
commitment. Any new runtime or service requires a separate approval decision.

## 10b. HISTORICAL WORD-FIRST RENDERING FEASIBILITY GATE — BLOCKED

**Execution date:** 2 september 2026
**Result:** `FEASIBILITY BLOCKED — LOCAL RENDERER INFRASTRUCTURE UNAVAILABLE`

This is the preserved result from the former Word-first architecture line. It
was an environment availability result, not an architecture rejection.

### Historical environment

- Docker CLI was installed at `C:\Program Files\Docker\Docker\resources\bin\docker.exe`.
- The Docker daemon was unavailable; the configured Docker Desktop Linux engine
  named pipe could not be opened. No ephemeral Gotenberg container could be
  started or used.
- Local `soffice`/LibreOffice was not installed or discoverable.
- Existing Poppler `pdfinfo` and `pdftoppm` utilities, Python and Node runtimes
  did not provide an approved DOCX-to-PDF renderer and could not substitute for
  it.

### Historical spike boundary

The rendering portion stopped before fixture generation, replacement and
conversion. No synthetic DOCX, PDF, screenshot or other spike artifact was
created; there is no claimed split-run, fidelity or performance result. No real
HR data, employee document or customer document was used.

The former upload rule remains a future Word-import invariant:

```text
untrusted uploaded DOCX
→ private quarantine
→ structural validation
→ malware/security scan GREEN
→ only then conversion/import into native model
```

The blocked result does not select Gotenberg or LibreOffice for native V1 and
does not invalidate the newly approved native editor architecture. The next
gate is the synthetic native-editor-to-HTML/PDF spike above. Do not treat the
historical environment block as proof of native preview/PDF fidelity.

## 11. Validation design

| Area | Blocking | Warning/allowed continuation |
|---|---|---|
| Structured source | invalid schema/version, unsupported node/attribute, cardinality/composition violation, limits exceeded, unsafe HTML/CSS/reference | none for schema or security failures |
| Asset source | unsupported format/signature, limits exceeded, unsafe decode, unauthorized scope or unresolved reference | none for security failures |
| Placeholder nodes | malformed atomic node/key, catalog mismatch, ambiguous duplicate semantics, unsupported required field/mode | unknown valid free code |
| Known data | required value cannot be resolved or validly supplied | optional known value missing |
| Temporal context | required date missing/invalid, range conflict, unsupported field/mode | persisted future value absent when manual `Wordt` is allowed |
| Scope | tenant/group/employee/template mismatch, unauthorized action | none |
| Rendering | normalization/render failure, missing output, pagination violation, PDF integrity failure | non-blocking renderer diagnostic only if final remains verifiable |
| Output | placeholder, `null` or `undefined` leakage, wrong content type, hash/size mismatch | none |

Warnings are visible and part of the preparation result. A warning does not silently create a required value or mutate HR data.

## 12. Preparation, preview and Generate state machine

Both entrypoints use the same transient model:

```text
Entry(employee or template)
→ Employee + Template
→ Temporal context when required
→ Known data resolution
→ Missing-value resolution
→ Optional free-code inputs
→ Cover + Body + ordered Appendices composition
→ Validation
→ Template Preview or mandatory Generation Preview
→ Generate
```

Preparation state is not a document version. It may be client working state plus a short-lived opaque server handle, but it is never trusted as authorization or source of truth. Template Preview may use sample values; Generation Preview uses concrete employee/document/temporal/free-input context. Neither preview stores a final version, snapshot, audit event or document-history row. The preview request can produce temporary renderer output that is returned through a short-lived controlled channel and then removed.

Generate:

1. re-authenticates and checks permissions/scope;
2. rechecks that the selected Document/Cover/Appendix versions, profile and assets are still active, authorized and safe;
3. re-resolves known data and validates manual values;
4. re-normalizes the same structured composition and renders through the same pipeline as Generation Preview;
5. hashes/verifies the PDF;
6. writes final metadata, source snapshot, optional dossier link and audit as one logical finalization;
7. exposes the document only through a private, short-lived authorized download URL.

The label may change until step 6. After finalization, employee, employment context,
Document/Cover/Appendix versions and order, Document Profile snapshot, resolved
snapshot, assets and artifact context are immutable.

## 13. Threat model

| Threat | Control required in architecture |
|---|---|
| Malicious structured input/HTML/CSS | schema allowlist, normalized render model, no arbitrary HTML/CSS/JavaScript/expressions, isolated server-side renderer |
| Oversize document/layout abuse | bounded nodes, text, rows, columns, assets, pages, bytes, time and renderer resources |
| Unsafe image asset | MIME/signature and decode validation, dimension/size limits, private scoped storage, safe renderer input |
| External references/remote images | reject external URLs/hotlinks and runtime fetch; worker egress off |
| Future malicious DOCX/active content | private quarantine, OOXML/ZIP inspection, reject macros/OLE/ActiveX/embeds, malware scan before native conversion/import |
| Tenant/group tampering | server context, group-bound RLS, composite relations, storage prefix policies |
| Employee tampering/wrong employee | server employee lookup and immutable generated `employee_id`; no relink operation |
| Artifact URL theft | private bucket, short-lived signed URL, no persistent signed URL in DB/UI state |
| Path traversal | generated UUID storage segments and safe filename; never use raw name or client path as storage key |
| Template/render injection | allowlisted node and token model only; no expressions, code, SQL, URLs, property traversal or arbitrary styles |
| Placeholder abuse | atomic identifier grammar, length/count limits, unknown values are plain text and optional; escape replacement content |
| Unauthorized template actions | dedicated server permission checks plus RLS; status transitions server-only |
| Retention race | snapshot expiry at generation, atomic delete decision, idempotent deletion/purge later, link-aware artifact policy |
| Duplicate final | request idempotency key, unique constraint, transaction/concurrency test |
| Snapshot leakage after delete | real artifact/snapshot deletion, minimum tombstone only; no hidden PDF/source copy |
| Malware scanner gap | fail-closed future-upload gate and explicit SEC-006 residual; no claim that this amendment solves scanning |

## 14. Database and migration plan — proposed only

No migration was created or applied in DM-0. A later migration sequence should introduce, in dependency order:

1. controlled document types and retention configuration;
2. Document Profile ownership/reference using existing organisation/company/HR-group concepts;
3. logical Document/Cover/Appendix templates and immutable structured template versions;
4. template-tag join to existing `star_performer_tags`;
5. generated documents and source snapshots containing exact composition;
6. safe image asset references and private storage bucket/policies where required;
7. dossier links;
8. minimal deletion tombstones and any required audit event metadata;
9. private artifact storage policies and grants.

Each exposed table receives tenant/group RLS and the necessary composite tenant/group/employee/template relations in the same migration. Storage policies must derive scope from server-controlled path shape and group access, not from a client-supplied URL. Grants are least-privilege and route services use typed Supabase clients; no arbitrary SQL or service-role bypass is introduced in application paths.

The existing `audit_logs`/central audit mechanism remains the general audit source. The tombstone is not a replacement audit log: it exists only because a real deletion removes the source row and full snapshot. Retained fields must be minimal and non-content-bearing.

Before any future migration apply, the canonical application schema, local migration history, generated `packages/db/types.ts`, advisors and fixtures must be compared. Migration-history drift is a hard stop; DM-0 does not use `db push`, repair, pull or manual history edits.

## 15. Delivery slices

| Slice | Scope | Dependencies | Migration/permission/security/test gate | Explicit non-goals |
|---|---|---|---|---|
| DM-1 Native Template Library & Structured Editor | module/navigation, list-first library, metadata, controlled category, existing tags, group scope, Document/Cover/Appendix kinds, Draft/Active/Archived, versioning, bounded structured editor, atomic placeholders, validation and safe assets | approved native model, Document Profile seam, asset boundary and successful native editor → HTML/PDF feasibility gate | new tables/RLS/grants; asset signature/size/scope tests; schema/render injection tests; tenant/group tamper tests; no remote apply without approval | no Word import, employee merge, final PDF, AI, free-field persistence |
| DM-2 Data Resolver & Temporal Context | allowlisted semantic catalog, known `##Field`, required/optional resolution, `NONE`/`AS_OF`/`TWO_POINT`/`WAS_IS_WORDT`, generation-only free inputs | DM-1 active versions; Salary Change gap decision | typed resolver tests, cross-domain authorization/RLS, overlap/future-effective/unknown-code tests, no HR writeback | no renderer/final artifact, no custom-field catalog |
| DM-3 Preview & PDF Generation | preparation state, Template Preview, mandatory Generation Preview, same normalized render pipeline, Cover/Body/Appendix composition, server-side PDF, immutable artifact, source snapshot/hash, idempotency | DM-1 structured source and DM-2 resolver; approved server-side renderer runtime | renderer golden suite, pagination/image stability, sandbox/resource tests, PDF integrity, duplicate/concurrency, no final row on preview | no overview/delete/retention scheduler |
| DM-4 Document Studio, Dossier, Audit & Retention | overview/detail, final document history, label-before-generate, optional dossier bridge, delete choices, tombstone, retention config/enforcement seam | DM-3 artifact; approved dossier relation | RLS/download/delete/link tests, deletion artifact proof, snapshot leakage test, retention dates; no scheduler if not approved | no relink, signing, tasks, bulk, AI |
| DM-5 MVP E2E Acceptance | Salary Change and Employer Statement, desktop/mobile, persona/scope negatives, native formatting/composition golden docs, asset/render security, migration/RLS/security/release gate | DM-1–DM-4 green and authorized environment | authenticated HR Admin E2E, tenant/group/employee negatives, console/overflow, exact artifact/snapshot/audit evidence, production gate | no Word compatibility promise, unapproved scope expansion or cleanup |

Each slice must remain independently reviewable. The repository order remains schema → API/service → UI inside each slice; DM-0 contains none of those implementation changes.

## 16. Remaining implementation/security decisions — product direction frozen

1. Native structured authoring and the Document/Cover/Appendix composition are approved. The exact editor library is not selected; Tiptap/ProseMirror remains the preferred feasibility candidate and requires the native spike before adoption.
2. The server-side PDF runtime is not selected. It must consume the controlled render model, run behind an isolated server-side seam and share semantics between Preview and Generate. A new runtime, service, container or license requires separate approval.
3. The historical Word-first renderer block remains an environment result, not an architecture rejection. It does not reinstate Gotenberg/LibreOffice as a native V1 dependency. Future Word import needs its own private quarantine, scan and conversion decision.
4. Confirm the asset validation/storage lifecycle and renderer limits: supported formats, signature/decoder behavior, dimensions, bytes, references, replacement and deletion of in-use assets.
5. Confirm the malware scanner/quarantine provider and release rule for future uploaded files. Until then, keep the SEC-006 residual explicit and block any upload path on an unknown scan state.
6. The minimum E2E-1 Salary Change field set is frozen: employee identity, `##Salary[Is]`, `##Salary[Wordt]`, `##EffectiveDate` and relevant Company-/Document Profile-fields. DM-2 must separately prove historical `[Was]` resolution; the current repository does not prove a complete generic as-of resolver.
7. Retention ownership is approved: an HR-group-authorized administrator configures document-type `PERMANENT`/`X jaar`. Remaining implementation details are safe numeric bounds and timezone/date rule.
8. Confirm the dedicated permission names and their grants in the current role/permission matrix. Dossier link/unlink must have a separate authorization capability from basic document create/read.
9. The no-duplicate dossier bridge is approved; implementation must expose one GeneratedDocument artifact through a bridge/read-model without copying to `employee_documents`. Exact read-model details remain for DM-4.
10. Ordinary PDF is approved for MVP. PDF/A is explicitly not required.

## 17. Amendment verification and evidence boundary

Executed for this native-editor amendment:

- repository instructions, requirements routing, current context, contract and
  the complete historical DM-0 source document were read;
- `origin` was fetched and exact current `origin/main` baseline recorded;
- source branch `work/dm0-document-studio-architecture` was verified clean at
  `247cc22f7009caccac3a87d715ec61cb2f7823ff`;
- isolated amendment worktree/branch was created from that exact source head;
- protected canonical env existence was checked without exposing values;
- no application tests, typecheck, lint or build were run, as required by the
  documentation-only scope;
- the historical Word-first feasibility block was preserved as an environment
  record and explicitly decoupled from the active native architecture.

The native editor → HTML/PDF feasibility spike was not run because this run
closes documentation only. It remains the hard next gate before DM-1
implementation/migration commitment. No editor, renderer, package, container,
service or production configuration was selected or installed here.

Amendment handoff checks:

- `git diff --check`;
- prove changed paths are limited to the product contract, DM-0 amendment,
  minimal docs index and delivery-context record;
- prove no app code, migration, package manifest/lockfile or version file changed;
- recheck canonical env existence;
- commit and non-force push only this same isolated branch; do not merge to `main`.

## 18. Result

The Product decision is amended and approved: Document Studio V1 uses
LiquidHR-native structured authoring with bounded Document/Cover/Appendix
composition, atomic placeholders, deterministic assets, one controlled render
model, mandatory Generation Preview and immutable final PDF. The former
Word-first authoring and office-renderer direction remains preserved as
historical rationale but is SUPERSEDED for V1; DOCX is not the canonical source
or a V1 dependency.

The exact editor library and server-side PDF runtime remain deliberately
unselected. The next hard gate is the synthetic `NATIVE EDITOR → HTML/PDF
FEASIBILITY SPIKE`, including stable image positioning and Preview/final
fidelity. No DM-1 work, migration, package installation or infrastructure change
has started.
