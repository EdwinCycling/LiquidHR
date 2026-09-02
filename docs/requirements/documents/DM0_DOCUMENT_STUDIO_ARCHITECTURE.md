# LiquidHR — DM-0 Document Studio Architecture & Foundation

**Status:** DM-0 ARCHITECTURE — PRODUCT APPROVED, READY FOR FEASIBILITY GATE
**Datum:** 1 september 2026
**Scope:** repository discovery, architecture and delivery design only
**Product:** Document Studio
**Underlying capability:** LiquidHR Document Platform
**Epic-prefix:** `DM-`

## 1. Besluit en grenzen

Dit document is het door Product Review geamendeerde architectuurdocument voor het frozen productcontract [`DOCUMENT_STUDIO_MVP_PRODUCT_CONTRACT.md`](DOCUMENT_STUDIO_MVP_PRODUCT_CONTRACT.md). Het contract is leidend voor productsemantiek; dit document maakt alleen technische keuzes en markeert resterende implementatiedetails.

DM-0 implementeert geen productfunctionaliteit. Er zijn in deze slice geen app-code, migration, package-installatie, Supabase/Vercel-mutatie, versie-bump of main-merge toegestaan. DM-1 is niet gestart.

### Bron- en instructievoorrang

- De aangeleverde download `C:\Users\Edwin\Downloads\LIQUIDHR_DOCUMENT_STUDIO_MVP_PRODUCT_CONTRACT.md` is de externe productbron.
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
| Root werkboom vóór DM-0 | clean, `main...origin/main` |
| DM-0 werkboom | geïsoleerd in `.codex-worktrees/dm0-document-studio-architecture` |
| Branch | `work/dm0-document-studio-architecture` vanaf exact bovenstaande SHA |
| Canonical protected env | `apps/hr-suite/.env.local` bestaat; waarden niet gelezen of afgedrukt |
| Poort 3000 | geen listener aangetroffen bij baselinecontrole |

De huidige implementatie is bewust niet aangepast om Document Studio “alvast” te starten.

### Architectuurkaders

De repository gebruikt Next.js App Router, typed server-side services en Supabase met RLS. Nieuwe feature slices volgen `schema → API/service → UI`; authorization is server-side en RLS is defense-in-depth. De bestaande UI-basis is LiquidHR UX Foundation v1. Document Studio moet een eigen module-ownershipregel krijgen en bestaande Foundation-primitives hergebruiken zodra DM-1 start.

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
| File security primitives | `file-rules.ts`, `file-signatures.ts` | safe filename, request/file size, MIME/extensie, signature en SHA-256 zijn bruikbare onderlagen; DOCX-policy moet strenger zijn |
| Tag cloud | `star_performer_tags`, `lib/talent/service.ts` en bestaande tag-manager | bestaande tenant-wide LiquidHR tag cloud gebruiken; geen tweede tagcatalogus |
| Permissions | `lib/auth/permissions.ts`, bestaand `resource:action` model | dedicated template/document permissions; geen hardcoded rol als autorisatiekern |
| Audit | bestaande `audit_logs` en centrale auditfuncties/triggers | bestaande auditbron gebruiken voor events; deletion tombstone is een smalle aanvullende retention-entiteit |
| Private storage | buckets `employee-documents` en `company-documents`, storage policies, short-lived signed URLs | nieuw dedicated private Document Studio prefix/bucket adviseren |

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
    ├── document types
    ├── template logical identities
    │   └── template versions (NL of EN per identity)
    └── generated documents
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

RLS herhaalt deze grens met bestaande `internal_security` group-permission/access helpers. Client-side employee-, group-, template-, storage-key- of retentionvelden zijn nooit authoritative.

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

De templatescan en preparation state dragen de gevraagde temporal mode; de catalogus beslist per field of de combinatie uitvoerbaar is. Een template wordt niet ACTIVE wanneer het een required temporal capability vraagt die niet beschikbaar is.

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

## 7. Template model en ontwerp-lifecycle

### Logical model

De voorgestelde nieuwe tabellen zijn conceptueel, niet als SQL uitgewerkt:

| Entiteit | Belangrijkste gegevens | Scope/regels |
|---|---|---|
| `document_studio_document_types` | tenant/group, stable code, name, category, retention kind, retention years, active status, created/updated actor/time | HR-group-owned; category is controlled metadata; retention is `PERMANENT` of bounded `YEARS` |
| `document_studio_templates` | tenant/group, logical key, name, description, document type, language (`nl`/`en`), default dossier choice, active logical pointer, created/updated metadata | NL en EN zijn afzonderlijke logical templates; unique per group/logical key/language |
| `document_studio_template_versions` | template id, integer version, status, private source storage key, filename, MIME, size, SHA-256, placeholder manifest, validation result, temporal mode/config, created/activated/archived metadata | `DRAFT → ACTIVE → ARCHIVED`; source/version used by a generated document is immutable |
| `document_studio_template_tags` | template/version relationship and existing `star_performer_tags` relationship | reuse existing tag cloud; no new tag definitions |

`document_studio_templates` is the stable identity. `document_studio_template_versions` is the immutable source/config unit used by generation. Activating a new version moves the previous active version to historical/archived state after the replacement is valid. A used archived version remains readable for historical documents and reproduction/audit; it is not selectable for new generation.

### Metadata and validation

The placeholder manifest records detected visible codes, normalized known/unknown classification, requiredness result and temporal requirements. It is derived data, not a permission source. Template activation requires a safe source, valid syntax, a complete supported capability set and no blocking security result. Unknown free codes produce warnings only when structural/security validation is green.

### Word upload security profile

The existing file rules are a lower-level starting point, not the complete profile. Document Studio accepts `.docx` only for MVP; not `.doc`, `.docm`, macro-enabled or arbitrary ZIP files. The DM-specific scanner must validate, at minimum:

- extension, MIME, ZIP/magic signature, expected OOXML parts and well-formed XML;
- archive entry count, compressed/uncompressed size, compression ratio and total expansion limits;
- no absolute paths, `..` traversal, duplicate/conflicting entries or unexpected executable payloads;
- reject `vbaProject.bin`, ActiveX/OLE/embedded executable content and disallowed external relationships;
- safe filename and storage-key generation independent of user input;
- placeholder syntax across supported Word XML parts, including headers/footers, without evaluating any expression;
- quarantine/scan status before Active.

### Approved fail-closed security gate

A newly uploaded DOCX may be stored only in a private quarantine state before security approval. While it is quarantined or its scan state is unknown, unavailable or inconclusive, it must not be rendered, previewed, converted by LibreOffice/Gotenberg, activated or used for Generate. All required structural validation and malware/quarantine checks must be GREEN before the source can leave quarantine or enter any renderer pipeline.

This is a Document Studio gate in addition to the existing lower-level upload rules. SEC-006 is not globally closed; the repository’s current malware-scanning/quarantine residual remains explicit.

## 8. Generated document, snapshot and deletion model

### Proposed entities

| Entity | Purpose and minimum fields | Lifecycle |
|---|---|---|
| `document_studio_generated_documents` | tenant/group, employee, selected employment/context, optional administration reference, document type, logical template/version, language, label, status, generated by/at, PDF storage key, content type, byte size, SHA-256, retention policy/expiry snapshot, idempotency key, deletion markers | created only by Generate; final context and artifact references immutable; status may transition to deleted |
| `document_studio_source_snapshots` | generated-document id, snapshot schema version, resolved known values, generation-only free values, temporal context, renderer metadata, source/template checksum and selected identifiers | created atomically with final document; deleted with the real artifact; no hidden full copy after deletion |
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

## 10. DOCX replacement and PDF architecture

### Current deploy/dependency facts

`apps/hr-suite/package.json` currently has Next.js 16.3.0, React, TypeScript, Supabase, Zod and `sharp`; no DOCX templating library, office renderer, LibreOffice binary, PDF converter or Gotenberg client is installed. No package was installed in DM-0.

Vercel documents function limits for memory, bundle size, request/response payloads and execution duration; the current page documents a 4.5 MB function body limit and finite runtime/memory ceilings. That makes a 25 MiB DOCX upload and native office renderer a poor direct fit for a normal route handler. The application should upload/download through private storage and keep the renderer outside the Next function boundary. See [Vercel Functions limits](https://vercel.com/docs/functions/limitations).

### Approved renderer decision

Product Review approves a private, isolated document-renderer boundary with pinned Gotenberg + LibreOffice as primary:

```text
Next server route/service
  ├─ authenticate, scope, validate and resolve data
  ├─ fetch private template source
  └─ call private renderer with one prepared request
       ├─ structural DOCX/security validation
       ├─ placeholder replacement in OOXML
       ├─ LibreOffice headless conversion
       └─ PDF bytes + renderer/version result
  └─ preview: return temporary controlled PDF, persist no final row
  └─ generate: revalidate, render, hash, persist artifact + snapshot + audit
```

Gotenberg documents `/forms/libreoffice/convert` for office documents and returns a file from a multipart request; LibreOffice documents headless operation and `--convert-to` PDF support. These are compatible with Word-first rendering, but the service must run as a private, pinned and hardened worker/container, not as an unbounded client-supplied URL fetch. See [Gotenberg routes](https://gotenberg.dev/docs/getting-started/routes), [Gotenberg LibreOffice conversion](https://gotenberg.dev/docs/convert-with-libreoffice/convert-to-pdf) and [LibreOffice start parameters](https://help.libreoffice.org/latest/nl/text/shared/guide/start_parameters.html).

The application-facing renderer adapter has one contract for Preview and Generate:

```text
validate source
→ scan OOXML/relationships/placeholders
→ resolve allowlisted values
→ replace text while preserving Word XML structure
→ render DOCX to PDF
→ return PDF bytes, content metadata, hash, renderer version and diagnostics
```

The same adapter and pinned renderer image/version are mandatory for preview and final. Preview output is ephemeral; only Generate persists the controlled artifact. Ordinary PDF is the MVP controlled output; PDF/A is not required and no DOCX export endpoint is planned for MVP. A managed third-party document conversion service is not allowed for MVP unless separately approved later.

### Replacement technology assessment

| Option | Strength | Blocking concern | DM-0 decision |
|---|---|---|---|
| Gotenberg + LibreOffice | office-native conversion route, good fit for headers/footers/tables/images and existing layout | separate private service, resource isolation, pinned fonts/version and operational security required | recommended renderer boundary |
| Direct LibreOffice worker | same office conversion engine, fewer service layers | lifecycle/sandbox/HTTP contract must be built and operated by LiquidHR | one fallback if Gotenberg cannot be hosted |
| Docxtemplater | DOCX ZIP manipulation and tag replacement; documented `render(tags)` API | it is a replacement layer, not a PDF engine; paid modules/licensing need approval; default syntax differs from frozen `##` syntax | candidate replacement adapter only, not complete solution |
| HTML/browser PDF | easy route deployment | reflows Word layout and cannot be the fidelity baseline for arbitrary DOCX | reject for MVP final rendering |

Docxtemplater’s official API confirms replacement of template variables and generation of a DOCX ZIP, but it does not remove the need for a controlled PDF renderer. Its paid-module license is a separate commercial review; no dependency is selected or installed in DM-0. See [Docxtemplater API](https://docxtemplater.com/docs/api/) and [Docxtemplater PRO license](https://docxtemplater.com/PRO-LICENSE.pdf).

### Fidelity acceptance baseline

The golden-document suite must cover headers, footers, page breaks, page numbering, multiple pages, embedded merge fields, font family/size, bold, italic, special characters, euro signs, accents, images/logos, tabs, spacing, bullets and existing tables. Dynamic repeating tables are out of scope. The suite compares semantic text, page count, layout anchors and rasterized pages at a pinned renderer version; byte equality across renderer upgrades is not assumed.

### Renderer security and determinism

- No renderer request may follow arbitrary template URLs or external relationships.
- Worker has no outbound network by default, isolated temporary profile/workspace and per-request resource/time limits.
- Disable macros and reject macro/embedded active content before the renderer.
- Pin LibreOffice, fonts, locale, timezone and renderer version; record renderer version in the snapshot.
- Delete temporary DOCX/PDF files in success and failure paths.
- Cap retries; a malformed document is a blocking input error, not an infinite retry. Gotenberg explicitly distinguishes input-related `400` failures from server/resource `500` failures and recommends capped attempts.
- Security tests must include malformed XML/ZIP, oversized expansion, external references, wrong MIME/signature, duplicate generation and cross-group input.

### Hard pre-implementation feasibility gate

Before committing to the full DM-1 implementation/migration sequence, run a disposable renderer/replacement spike. It must use a safe synthetic DOCX with no real HR data and prove, through the same intended renderer boundary:

- `##EmployeeFirstName` in normal body text;
- a token split across Word XML runs;
- `##Salary[Is]`;
- `##Salary[Wordt]`;
- `##EffectiveDate`;
- header and footer;
- existing table;
- image/logo;
- page break;
- special characters, euro sign and accents.

Required pipeline:

```text
safe synthetic DOCX
→ placeholder detection/replacement
→ approved private renderer boundary
→ PDF
→ golden/visual fidelity assessment
```

The spike is disposable and outside committed application code. No spike dependency or package may be committed or installed unless separately approved. A failed or incomplete spike blocks the full DM-1 implementation/migration commitment.

## 11. Validation design

| Area | Blocking | Warning/allowed continuation |
|---|---|---|
| Source file | invalid `.docx`, MIME/signature mismatch, malformed OOXML, limits exceeded, active content, scan unavailable/inconclusive for activation | none for security failures |
| Placeholder syntax | malformed bracket/identifier, ambiguous duplicate semantics, unsupported required field/mode | unknown free code |
| Known data | required value cannot be resolved or validly supplied | optional known value missing |
| Temporal context | required date missing/invalid, range conflict, unsupported field/mode | persisted future value absent when manual `Wordt` is allowed |
| Scope | tenant/group/employee/template mismatch, unauthorized action | none |
| Rendering | conversion failure, missing output, PDF integrity failure | non-blocking renderer diagnostic only if final remains verifiable |
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
→ Validation
→ Mandatory Preview
→ Generate
```

Preparation state is not a document version. It may be client working state plus a short-lived opaque server handle, but it is never trusted as authorization or source of truth. Preview stores no final version, snapshot, audit event or document-history row. The preview request can produce temporary renderer output that is returned through a short-lived controlled channel and then removed.

Generate:

1. re-authenticates and checks permissions/scope;
2. rechecks that the selected template version is still active and safe;
3. re-resolves known data and validates manual values;
4. renders through the same pipeline;
5. hashes/verifies the PDF;
6. writes final metadata, source snapshot, optional dossier link and audit as one logical finalization;
7. exposes the document only through a private, short-lived authorized download URL.

The label may change until step 6. After finalization, employee, employment context, template version, resolved snapshot and artifact context are immutable.

## 13. Threat model

| Threat | Control required in architecture |
|---|---|
| Malicious DOCX/active content | `.docx` only, OOXML inspection, reject macros/OLE/ActiveX/embeds, sandboxed renderer, no macros/network |
| ZIP bomb/oversize | compressed/uncompressed/entry/ratio/request limits before expansion; bounded renderer resources |
| External references/remote images | reject or strip according to approved policy; no arbitrary fetch; worker egress off |
| Tenant/group tampering | server context, group-bound RLS, composite relations, storage prefix policies |
| Employee tampering/wrong employee | server employee lookup and immutable generated `employee_id`; no relink operation |
| Artifact URL theft | private bucket, short-lived signed URL, no persistent signed URL in DB/UI state |
| Path traversal | generated UUID storage segments and safe filename; never use raw name as path |
| Template injection | allowlisted token parser only; no expressions, code, SQL, URLs or property traversal |
| Placeholder abuse | identifier grammar, length/count limits, unknown values are plain text and optional; escape replacement content |
| Unauthorized template actions | dedicated server permission checks plus RLS; status transitions server-only |
| Retention race | snapshot expiry at generation, atomic delete decision, idempotent deletion/purge later, link-aware artifact policy |
| Duplicate final | request idempotency key, unique constraint, transaction/concurrency test |
| Snapshot leakage after delete | real artifact/snapshot deletion, minimum tombstone only; no hidden PDF/source copy |
| Malware scanner gap | fail-closed Active gate and explicit SEC-006 residual; no claim that DM-0 solves scanning |

## 14. Database and migration plan — proposed only

No migration was created or applied in DM-0. A later migration sequence should introduce, in dependency order:

1. controlled document types and retention configuration;
2. logical templates and immutable template versions;
3. template-tag join to existing `star_performer_tags`;
4. generated documents and source snapshots;
5. dossier links;
6. minimal deletion tombstones and any required audit event metadata;
7. private storage bucket/policies and grants.

Each exposed table receives tenant/group RLS and the necessary composite tenant/group/employee/template relations in the same migration. Storage policies must derive scope from server-controlled path shape and group access, not from a client-supplied URL. Grants are least-privilege and route services use typed Supabase clients; no arbitrary SQL or service-role bypass is introduced in application paths.

The existing `audit_logs`/central audit mechanism remains the general audit source. The tombstone is not a replacement audit log: it exists only because a real deletion removes the source row and full snapshot. Retained fields must be minimal and non-content-bearing.

Before any future migration apply, the canonical application schema, local migration history, generated `packages/db/types.ts`, advisors and fixtures must be compared. Migration-history drift is a hard stop; DM-0 does not use `db push`, repair, pull or manual history edits.

## 15. Delivery slices

| Slice | Scope | Dependencies | Migration/permission/security/test gate | Explicit non-goals |
|---|---|---|---|---|
| DM-1 Template Library & Secure Word Upload | module/navigation, list-first library, metadata, controlled category, existing tags, group scope, Draft/Active/Archived, versioning, DOCX upload, OOXML placeholder scan and validation | approved model, storage boundary, scanner decision, successful disposable renderer/replacement feasibility gate | new tables/RLS/grants; malware/active-content gate; upload corpus, ZIP limits, tenant/group tamper tests; no remote apply without approval | no employee merge, preview, PDF, AI, free-field persistence |
| DM-2 Data Resolver & Temporal Context | allowlisted semantic catalog, known `##Field`, required/optional resolution, `NONE`/`AS_OF`/`TWO_POINT`/`WAS_IS_WORDT`, generation-only free inputs | DM-1 active versions; Salary Change gap decision | typed resolver tests, cross-domain authorization/RLS, overlap/future-effective/unknown-code tests, no HR writeback | no renderer/final artifact, no custom-field catalog |
| DM-3 Preview & PDF Generation | preparation state, same render pipeline, mandatory preview, PDF generation, immutable artifact, source snapshot/hash, idempotency | DM-1 source and DM-2 resolver; approved private renderer | renderer golden suite, sandbox/resource tests, PDF integrity, duplicate/concurrency, no final row on preview | no overview/delete/retention scheduler |
| DM-4 Document Studio, Dossier, Audit & Retention | overview/detail, final document history, label-before-generate, optional dossier bridge, delete choices, tombstone, retention config/enforcement seam | DM-3 artifact; approved dossier relation | RLS/download/delete/link tests, deletion artifact proof, snapshot leakage test, retention dates; no scheduler if not approved | no relink, signing, tasks, bulk, AI |
| DM-5 MVP E2E Acceptance | Salary Change and Employer Statement, desktop/mobile, persona/scope negatives, formatting golden docs, malicious DOCX, migration/RLS/security/release gate | DM-1–DM-4 green and authorized environment | authenticated HR Admin E2E, tenant/group/employee negatives, console/overflow, exact artifact/snapshot/audit evidence, production gate | no unapproved scope expansion or cleanup |

Each slice must remain independently reviewable. The repository order remains schema → API/service → UI inside each slice; DM-0 contains none of those implementation changes.

## 16. Open decisions requiring Product/Security review

1. Renderer choice is approved: private pinned Gotenberg + LibreOffice primary, private isolated direct LibreOffice worker fallback. Managed third-party document conversion is outside MVP unless separately approved later; remaining work is operational boundary, hosting and hardening design.
2. Confirm the malware scanner/quarantine provider and the release rule when scanning is unavailable. Until then, keep the SEC-006 residual explicit and block activation on an unknown scan state.
3. The minimum E2E-1 Salary Change field set is frozen: employee identity, `##Salary[Is]`, `##Salary[Wordt]`, `##EffectiveDate` and relevant Company-fields. DM-2 must separately prove historical `[Was]` resolution; the current repository does not prove a complete generic as-of resolver.
4. Retention ownership is approved: an HR-group-authorized administrator configures document-type `PERMANENT`/`X jaar`. Remaining implementation details are safe numeric bounds and timezone/date rule.
5. Confirm the dedicated permission names and their grants in the current role/permission matrix. Dossier link/unlink must have a separate authorization capability from basic document create/read.
6. The no-duplicate dossier bridge is approved; implementation must expose one GeneratedDocument artifact through a bridge/read-model without copying to `employee_documents`. Exact read-model details remain for DM-4.
7. Ordinary PDF is approved for MVP. PDF/A is explicitly not required.

## 17. DM-0 verification and evidence boundary

Executed for this architecture slice:

- repository instructions, requirements routing, current context, contract and relevant architecture/domain sources read;
- `origin/main` fetched and exact baseline recorded;
- isolated worktree/branch created from current baseline;
- protected canonical env existence checked without exposing values;
- implementation/dependency/schema/storage/auth inventory performed;
- official Vercel, Gotenberg, LibreOffice and Docxtemplater documentation checked for renderer feasibility;
- no application tests, typecheck, lint or build run, as required by the user’s architecture-only scope.

The disposable renderer/replacement spike was not run in this documentation-only amendment. It is the next hard feasibility gate and must complete before the full DM-1 implementation/migration commitment.

Amendment handoff checks:

- `git diff --check`;
- prove changed paths are limited to the DM-0 architecture and necessary delivery-context record;
- prove no app code, migration, package manifest/lockfile or version file changed;
- recheck canonical env existence;
- commit and non-force push only this same isolated branch; do not merge to `main`.

## 18. Result

Product Review is closed. DM-0 is approved and ready for the feasibility gate, not for DM-1 implementation. The essential foundation decision is to keep the existing dossier/file infrastructure as a set of secure storage, download, validation, tag, context and audit patterns, while introducing a separate Document Studio semantic model for template versions, resolved source snapshots, immutable PDF artifacts, dossier links and deletion tombstones.

The main feasibility risk is not placeholder replacement; it is a secure, generic, typed temporal resolver for Salary Change and a private office-native renderer with malware/quarantine controls. Those risks and decisions are explicit above. No DM-1 work has started.
