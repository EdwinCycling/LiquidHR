# LiquidHR — Document Studio DM-1 Native Template Library & Structured Editor

**Status: IMPLEMENTATION DESIGN CANDIDATE — BLOCKED FOR IMPLEMENTATION**
**Datum:** 2026-09-02
**Baseline:** origin/main 155ccbde373a06684e37d9746b01dd65931c870b
**Closure source:** spike/document-studio-native-editor-pdf-closure at d5dc1472067200f0e3d00150adc00c331f86d7e2
**Product version:** 1.20260901.1
**Scope:** requirements-, architectuur- en implementation-design-documentatie; geen implementatie.

## 1. Doel en besluit

DM-1 levert de eerste echte Document Studio-slice voor HR Admins binnen de actieve HR-groep:

- een zelfstandige Document Studio-navigatie en Template Library;
- documenttype-, metadata-, categorie-, tag- en Document Profile-configuratie;
- afzonderlijke NL- en EN-templates;
- Document, Cover en Appendix als composable template-kinderen;
- een bounded LiquidHR-native structured editor met atomic placeholders;
- draft-save, validatie, immutable active versions, archive en audit;
- private, genormaliseerde PNG/JPEG-assets met opaque references;
- een stabiele NormalizedDocumentV1-seam voor DM-3 preview/PDF.

De kandidaat blijft BLOCKED tot twee niet-technische/security-gates zijn gesloten:

1. De product-owned categoriecode-waarden zijn nergens als goedgekeurde actuele catalogus vastgelegd. DM-1 kan de gecontroleerde opslag technisch vastleggen, maar mag geen user-facing taxonomy verzinnen.
2. SEC-006 bevat nog geen bewezen herbruikbare malware-scanner/quarantaine. Voor de beperkte PNG/JPEG-flow is decoder-plus-re-encode mogelijk voldoende, maar de security-owner moet expliciet bevestigen dat deze decoder-only classificatie voor Document Studio-assets is toegestaan, of een goedgekeurde scanneradapter aanwijzen. Er wordt geen provider verzonnen.

Alles buiten deze twee gates is in dit document bevroren als de aanbevolen implementatierichting.

## 2. Baseline en repositorybevindingen

### 2.1 Bronnen en voorrang

De actuele product- en architectuurbronnen zijn, in deze volgorde gebruikt:

1. DOCUMENT_STUDIO_MVP_PRODUCT_CONTRACT.md — amended/approved native editor V1;
2. DM0_DOCUMENT_STUDIO_ARCHITECTURE.md — ownership, security en lifecycle seam;
3. DOCUMENT_STUDIO_NATIVE_EDITOR_PDF_FEASIBILITY.md — feasibility closure GREEN;
4. AGENTS.md, docs/README.md, docs/delivery/CURRENT_CONTEXT.md, CODING_STANDARDS.md;
5. UX Foundation, navigation en authorization requirements;
6. de actuele implementatie en read-only remote schema/policy/storage metadata.

De closure bevat geen productimplementatie. Tiptap/ProseMirror, Sharp, browser/PDF, clipboard en paste-proof zijn synthetic/local feasibility evidence, geen DM-1 runtimebewijs.

### 2.2 Bestaande capabilities die worden hergebruikt

- actieve tenant- en HR-groepcontext via loadActiveContext, requireAuthContext en requireHrGroupId;
- server-side permission checks via requirePermission en permissionErrorResponse;
- internal_security.current_user_has_hr_group_permission en de bestaande restrictive HR-group RLS-boundary;
- administrations, administration_company_data en administration_branding als bestaande bronnen;
- de bestaande tenant-brede star_performer_tags-catalogus als tag cloud;
- bestaande Foundation primitives/patterns/layouts en Lucide icons;
- sharp@0.35.3 als al aanwezige image decoder/normalizer;
- de Journey template/version pattern voor optimistic concurrency, immutable publication en guarded RPC-transacties.

### 2.3 Wat niet wordt hergebruikt als DM-1-model

De legacy-entiteiten employee_documents, company_documents, document_categories en custom_field_definitions zijn geen canonical DM-1 template-, categorie- of placeholdermodel. Legacy document/file services mogen hoogstens als storage/auth-pattern worden gelezen. DM-1 maakt geen dossierrecord en genereert geen employee/company document.

### 2.4 Technische actuele grenzen

- Next.js 16.3.0, React en strict TypeScript;
- Tiptap/ProseMirror staat nog niet in apps/hr-suite/package.json of package-lock.json;
- sharp@0.35.3 is al production dependency;
- bestaande buckets administration-branding, company-documents en employee-documents zijn private;
- actuele remote migration history: 409 records, laatste remote version 20260831165143;
- actuele local migration directory: 390 files, laatste lokale version 20260831151639;
- bekende migration/typegen drift blijft bestaan. Dit ontwerp vereist geen history repair, db push, pull of replay. Implementatie wordt één nieuwe forward migration boven de actuele remote max, na review van de gedeelde databasebaseline.

## 3. Scope

### 3.1 In scope DM-1

- zelfstandige route /document-studio met Template Library als primaire werkbank;
- list-first template library met zoeken, filteren, sorteren, klikrij en details/edit;
- aanmaken en bewerken van Document, Cover en Appendix templates;
- NL/EN als aparte template identity, zonder runtime translation;
- metadata en document-typeconfiguratie;
- gecontroleerde categoriecode zodra de productcatalogus is goedgekeurd;
- hergebruik van bestaande tenant-tag cloud;
- named Document Profiles die naar bestaande administratie/company-data/branding verwijzen;
- Tiptap-adapter naar een LiquidHR-owned canonical JSON-contract;
- bounded formatting, structural blocks, tables, columns, page breaks, structural images en atomic placeholders;
- draft revision save, reload, conflictmelding en recovery;
- pre-activation validation, activation, immutable version history en archive;
- private asset upload, normalization, reference tracking en safe deletion voor ongebruikte drafts;
- audit events, idempotency en server-side/RLS enforcement;
- typed API/service contracts en DM-3 output seam.

### 3.2 Niet in scope

- resolver/temporal value retrieval of generation (DM-2);
- HTML/PDF preview, Chromium, renderer worker, final PDF artifact of output storage (DM-3);
- generated documents, dossier bridge, retention enforcement en overview/dashboard (DM-4);
- DOCX/Word import/export, arbitrary HTML/CSS, external URL images, floating layout;
- employee-facing authoring or employee access;
- AI-assisted authoring;
- custom field definitions or a second organization/company model;
- production package install, schema migration, storage provisioning, remote mutation, tests or app code in this design run.

## 4. UX and navigation decision

### 4.1 Standalone module

Document Studio krijgt één standalone main-menu item Document Studio met route /document-studio. De zichtbaarheid is permission-gated by document-template:read; er is geen nieuw module-toggle en geen afgeleide UI-only authorization.

Routes:

    /document-studio
    /document-studio/templates
    /document-studio/templates/new
    /document-studio/templates/[templateId]
    /document-studio/templates/[templateId]/edit
    /document-studio/document-types
    /document-studio/document-profiles

/document-studio en /templates zijn dezelfde library-context met verschillende entry points; er ontstaat geen tweede library. Tot DM-3/DM-4 geen generated-document overview bestaat, toont de landing de template workbench en een duidelijke “overzicht volgt in een latere Document Studio-slice” status, geen fake records.

### 4.2 Foundation-compliance

Gebruik bestaande PageShell, PageHeader, PageToolbar, FilterBar, Surface, Badge, EmptyState, FormField, DropdownSelect, Tabs, DetailColumns, FormDrawer/bestaande modal-patterns en Button/IconButton. De structured editor en toolbar zijn domeinspecifiek en horen onder components/document-studio; er is geen nieuwe generic UI primitive.

De library is list-first: zoeken/filteren/sorteren, klikbare rijen, metadata in een drawer/modal, Save/Cancel en expliciete Archive-actie. Workbench, editor, version history en validation panel blijven functioneel herkenbaar op 1440px en 390x844. Toolbar controls mogen horizontaal binnen hun eigen bounded region scrollen; de pagina mag geen horizontale overflow krijgen.

## 5. Canonical document contract

### 5.1 Schema identity

Alle persisted content gebruikt exact schema id liquid-hr.document-studio.native.v1 en schema version 1. Schema identity is immutable version metadata. Unknown top-level keys, node types, marks, attrs en region keys worden geweigerd; de adapter schrijft altijd genormaliseerde key order en geen editor-internals.

### 5.2 Root shape

De canonical root heeft deze vorm:

    {
      "schema": {
        "id": "liquid-hr.document-studio.native.v1",
        "version": 1
      },
      "kind": "DOCUMENT",
      "page": {
        "size": "A4",
        "marginPreset": "NORMAL",
        "fontFamily": "WORK_SANS"
      },
      "regions": {
        "cover": null,
        "header": {
          "type": "region",
          "content": []
        },
        "body": {
          "type": "region",
          "content": []
        },
        "appendix": null,
        "footer": {
          "type": "region",
          "content": []
        }
      }
    }

Kind-specific invariant:

- DOCUMENT: body is required; cover and appendix are null; header and footer are optional;
- COVER: cover is required; all other regions are null;
- APPENDIX: appendix is required; all other regions are null.

Composition is relational, not hidden inside arbitrary JSON: a DOCUMENT version may reference one active COVER version and zero or more active APPENDIX versions. The root JSON remains self-contained for the owned content region(s); referenced component versions are resolved and included by the DM-3 seam later.

### 5.3 Page and resource limits

These limits are validation constants, not user-editable free CSS:

| Contract | Allowed value |
| --- | --- |
| page size | A4 only in DM-1 |
| margin preset | NARROW, NORMAL, WIDE mapped to renderer-owned mm values |
| font family | WORK_SANS only; renderer fallback is not authorable |
| document JSON | max 1 MiB UTF-8 after canonical serialization |
| total text | max 250,000 Unicode code points |
| content nodes | max 10,000 per version |
| text node | max 10,000 code points |
| heading levels | 1, 2, 3 |
| table columns | 1–8 |
| table rows | 1–200 |
| two-column ratio | 25_75, 33_67, 50_50, 67_33, 75_25 |
| image display width | 25, 50, 75, 100 percent presets |
| image alignment | LEFT, CENTER, RIGHT |
| page break | block only; no attrs |

The canonical validator rejects depth/size abuse before persistence. A future renderer may impose stricter resource budgets, but may not interpret values that DM-1 accepted but did not define.

### 5.4 Allowed block and inline nodes

Canonical allowlist:

    block: paragraph, heading, bulletList, orderedList, listItem,
           horizontalRule, table, tableRow, tableHeader, tableCell,
           twoColumnBlock, pageBreak, blockImage
    inline: text, knownPlaceholder, temporalPlaceholder, freePlaceholder
    marks: bold, italic, underline, fontSize

Rules:

- paragraph.align: LEFT, CENTER, RIGHT, JUSTIFY;
- heading.level: 1, 2, 3, with the same bounded alignment;
- fontSize: one of 10, 11, 12, 14, 16, 18, 24, 32 pt;
- lists contain list items and paragraphs only; no nested table, column, image or page break;
- table cells contain paragraphs, text/placeholders, and at most bounded structural images; no nested tables or columns;
- twoColumnBlock has exactly left and right regions, each using allowed bounded blocks except another twoColumnBlock, table or pageBreak;
- horizontalRule has no styling attrs;
- blockImage stores an opaque assetRef, safe alt text, width preset and alignment; it never stores a URL or storage path;
- no floating, absolute, wrapping, arbitrary grid, arbitrary HTML, CSS, SVG, script, iframe, external URL or remote image.

### 5.5 Atomic placeholder nodes

Placeholders are ProseMirror/Tiptap atom nodes and are never represented as editable magic text. Each node is deleted, copied and validated as one unit.

    { "type": "knownPlaceholder", "attrs": { "field": "employee.first_name" } }
    { "type": "temporalPlaceholder", "attrs": { "field": "employment.salary", "temporal": "is" } }
    { "type": "freePlaceholder", "attrs": { "key": "StartDatum" } }

- Known fields use a fixed DM-2 catalog key. The editor shows the product code/label but persists the stable internal key.
- Temporal values use exactly WAS, IS, WORDT; the editor presents the localized labels Was, Is, Wordt.
- Free placeholder keys use ^[A-Z][A-Za-z0-9]{0,79}$, remain generation-only and are not persisted as custom field definitions.
- Duplicate use of a placeholder is allowed. Validation returns one deduplicated manifest plus every location.
- Unknown known-field keys, malformed temporal fields and malformed free keys are activation-blocking errors.
- DM-1 does not resolve values. Preview-style labels are editor-only sample rendering and are never persisted as concrete employee/company data.

### 5.6 Canonical normalization

normalizeNativeDocumentV1(input) performs, in order:

1. strict schema parse and kind/region validation;
2. node, mark, attr, text, depth and resource limit validation;
3. placeholder key/catalog validation;
4. asset reference extraction and deduplication;
5. removal of editor-only selection/history/DOM data;
6. deterministic defaults and key ordering;
7. canonical JSON serialization and SHA-256 content hash.

Only the normalized result, hash, extracted asset refs and validation diagnostics enter the service/repository boundary. Tiptap JSON, HTML and DOM are adapter inputs, never the persistence contract.

## 6. Template model and lifecycle

### 6.1 Logical identity

document_studio_templates is the stable logical identity. Proposed fields:

    id uuid primary key
    tenant_id uuid not null
    hr_group_id uuid not null
    template_key text not null, lowercase slug, 1..80
    kind DOCUMENT | COVER | APPENDIX
    language NL | EN
    name text not null
    description text nullable
    lifecycle ACTIVE | ARCHIVED
    created_by_user_id, updated_by_user_id uuid
    created_at, updated_at timestamptz

Constraints/indexes:

- composite FK (tenant_id, hr_group_id) to hr_groups;
- unique (tenant_id, hr_group_id, template_key) for stable route/reference identity;
- unique on name is not used: names may be edited and do not define identity;
- index (tenant_id, hr_group_id, lifecycle, updated_at desc);
- ARCHIVED is terminal for the logical identity; a new template key is required to restart authoring.

The same template_key may not be reused by a different kind/language within the group. NL and EN therefore remain separate templates and can be activated independently; the UI groups them as a translation pair only as a convenience.

### 6.2 Version rows

document_studio_template_versions is the immutable content/history layer:

    id uuid primary key
    tenant_id uuid not null
    hr_group_id uuid not null
    template_id uuid not null
    status DRAFT | ACTIVE | ARCHIVED
    version_number integer nullable for DRAFT, >0 for history
    revision integer not null, starts at 1
    schema_id text not null
    schema_version integer not null
    document_json jsonb not null
    content_hash text not null
    validation_state VALID | INVALID
    validation_diagnostics jsonb not null default []
    document_type_id uuid not null
    category_code text not null
    default_dossier boolean not null default false
    document_profile_id uuid nullable
    created_by_user_id, updated_by_user_id uuid not null
    activated_by_user_id, archived_by_user_id uuid nullable
    created_at, updated_at, activated_at, archived_at timestamptz nullable

Constraints/indexes:

- composite FK to the logical template and HR group;
- composite FKs for document_type_id and document_profile_id remain group-safe;
- version_number is null only for DRAFT; ACTIVE or ARCHIVED has a positive integer;
- a logical template has at most one DRAFT (partial unique), at most one ACTIVE (partial unique), and unique positive version numbers;
- revision > 0, schema_id and schema_version must match the frozen V1 contract;
- active/archived content, metadata, composition and asset join rows are immutable;
- index (tenant_id, hr_group_id, template_id, status, updated_at desc).

The draft is not a published version and has no version number. On activation, the transaction locks the logical template, assigns max(version_number)+1, archives the previous active version, promotes the draft to ACTIVE and updates the logical active pointer. This follows the existing Journey pattern while keeping the old active version readable for history.

### 6.3 State transition table

| Current | Action | Result | Permission | Notes |
| --- | --- | --- | --- | --- |
| none | create | logical template + DRAFT | document-template:write | one transaction |
| DRAFT | save | DRAFT revision +1 | document-template:write | expected revision required |
| DRAFT | activate | ACTIVE version N | document-template:activate | valid only, atomic lock |
| ACTIVE | edit | new DRAFT clone | document-template:write | active bytes never mutate |
| ACTIVE | archive | logical ARCHIVED + active ARCHIVED | document-template:archive | no new draft after archive |
| ARCHIVED | read history | unchanged | document-template:read | no reactivation |
| DRAFT | discard | DRAFT deleted, unused assets eligible | document-template:write | explicit action, audited |

There is no direct DRAFT to ARCHIVED, no ARCHIVED to ACTIVE, and no client-side status update. Version number allocation and concurrent activation are server/RPC concerns.

### 6.4 Draft concurrency and idempotency

Every draft write sends draftVersionId, expectedRevision, idempotencyKey and normalized payload. The guarded transaction locks the row, compares revision and returns DOCUMENT_TEMPLATE_DRAFT_CONFLICT with the current revision on mismatch. Repeating the same idempotency key with the same actor/payload returns the original result; reusing it with a different payload fails closed. Activation has the same idempotency rule.

## 7. Document Types, categories and Document Profiles

### 7.1 Document Types

document_studio_document_types is HR-group scoped master data:

    id uuid
    tenant_id uuid
    hr_group_id uuid
    code text, lowercase slug 1..80
    name jsonb, required nl and en values
    description jsonb, optional nl and en values
    retention_kind PERMANENT | YEARS
    retention_years integer nullable, 1..100 when YEARS
    is_active boolean
    created_by_user_id, updated_by_user_id uuid
    created_at, updated_at timestamptz

Checks require both localized name values, a valid retention pair, group composite FK and unique (tenant_id, hr_group_id, code). Deactivation is explicit and does not delete a type used by historical versions. New activation requires an active type; existing history keeps its type reference.

### 7.2 Category representation and blocker

Do not reuse legacy document_categories as if it were the approved Document Studio taxonomy. Store category_code text on the version (and expose it in the library filter) with:

- a future controlled catalog constraint/table owned by the product decision;
- strict service validation against that catalog;
- no free-text input in the UI;
- a stable code rather than localized display text.

The smallest safe implementation is a document_studio_category_catalog table only if product approves a managed catalog. If categories are a frozen finite set, a database enum/check is acceptable. The product must choose one and approve the actual codes before migration. Until then the design is technically specified but implementation-blocked.

### 7.3 Document Profiles

The repository has administrations, administration_company_data and administration_branding; those are the owners of organization facts and branding. A Document Profile is therefore a small HR-group-scoped reference/configuration object, not a duplicate company record:

    document_studio_document_profiles
    id uuid
    tenant_id uuid
    hr_group_id uuid
    name text 1..120
    source_administration_id uuid not null
    logo_asset_id uuid nullable
    is_default boolean not null default false
    is_active boolean not null default true
    created_by_user_id, updated_by_user_id uuid
    created_at, updated_at timestamptz

The source administration must belong to the same tenant and HR group. The service reads the current approved administration name, registration/tax metadata, company data and branding only when an authorized future resolver/generator requests it; DM-1 does not copy those values into the profile or allow client substitution. logo_asset_id is an optional Document Studio asset override; otherwise the existing administration_branding.logo_storage_path remains the branding source. A group may have multiple named profiles because the existing source data is administration-scoped; exactly one active default is enforced by a partial unique index.

Profile changes do not rewrite template history. A version stores the profile ID it selected, so later DM-3 can resolve the intended profile under authorization and report a missing/deactivated source instead of silently switching organization data.

## 8. Composition model

document_studio_template_compositions is version-owned and relational:

    tenant_id uuid not null
    hr_group_id uuid not null
    document_template_version_id uuid not null
    component_kind COVER | APPENDIX not null
    component_template_version_id uuid not null
    sort_order integer not null

Keys and constraints:

- primary key (tenant_id, hr_group_id, document_template_version_id, component_kind, component_template_version_id);
- unique (tenant_id, hr_group_id, document_template_version_id, component_kind, sort_order);
- composite tenant/group FKs to both version rows;
- a guarded trigger/RPC verifies parent kind DOCUMENT, component kind matches COVER/APPENDIX, component status is ACTIVE, and all versions share the same group;
- at most one COVER row; APPENDIX rows use contiguous non-negative order in the normalized payload;
- active parent composition is immutable; a changed composition is saved on a new draft.

The component version itself owns its cover or appendix content JSON. A Document version owns its body, optional header and footer and the exact component version references. There is no recursive composition.

## 9. Tags

document_studio_template_tags links a logical template to the existing star_performer_tags catalog:

    tenant_id uuid not null
    hr_group_id uuid not null
    template_id uuid not null
    tag_id uuid not null
    created_by_user_id uuid not null
    created_at timestamptz not null
    primary key (tenant_id, hr_group_id, template_id, tag_id)

The existing tag table is tenant-wide, while the template link is group-scoped. The service must first authorize the active group and then verify the tag belongs to the same tenant and is active. A tag used by a template cannot be silently deleted from the template by a different group; tag catalog lifecycle remains the existing star-performer contract. Template library search can filter on tags without creating a second tag engine.

## 10. Structured editor decision

Use Tiptap/ProseMirror as a domain adapter, not as the canonical model. The temporary closure proof used 3.31.0 and real custom atom nodes. The production DM-1 dependency set, only after the blockers are closed, is:

    @tiptap/core                 3.31.0  MIT
    @tiptap/react                3.31.0  MIT
    @tiptap/starter-kit          3.31.0  MIT
    @tiptap/extension-underline  3.31.0  MIT
    @tiptap/extension-table      3.31.0  MIT
    @tiptap/extension-table-row  3.31.0  MIT
    @tiptap/extension-table-cell 3.31.0 MIT
    @tiptap/extension-table-header 3.31.0 MIT
    @tiptap/pm                   3.31.0  MIT, only if required as a direct peer pin

sharp@0.35.3 is already present and is not a new package. No paid extension, commercial editor, renderer package, Chromium, Playwright, @sparticuz/chromium, @fontsource/work-sans or Node worker is added in DM-1. Those belong to a separately approved DM-3 runtime boundary. Exact package metadata and lockfile resolution must be rechecked before install; feasibility evidence alone is not package approval.

Bundle budget: measure the actual production bundle after adapter implementation; the initial editor chunk has a review budget of 200 kB gzip and must be code-split from the library route. This is a budget gate, not an unverified size claim.

Recommended domain modules:

    apps/hr-suite/lib/document-studio/
      canonical-document.ts
      canonical-schema.ts
      semantic-catalog.ts
      editor/tiptap-adapter.ts
      editor/paste-sanitizer.ts
      validation.ts
      schemas.ts
      template-repository.ts
      template-service.ts
      document-type-service.ts
      document-profile-service.ts
      asset-policy.ts
      asset-service.ts
      errors.ts

The adapter must be a pure boundary with round-trip tests: canonical JSON to editor state to canonical JSON must preserve meaning, placeholder atom identity, asset refs, table structure and ordering. HTML pasted from the clipboard is parsed through a strict allowlist and loses unsupported styles/links; it never enters storage as HTML.

## 11. Asset model and lifecycle

### 11.1 Asset tables

document_studio_assets:

    id uuid
    tenant_id uuid
    hr_group_id uuid
    status QUARANTINED | APPROVED | REJECTED | RETIRED
    original_filename text sanitized, 1..180
    normalized_mime image/png | image/jpeg
    byte_size integer <= 2 MiB
    width integer <= 4000
    height integer <= 4000
    pixel_count bigint <= 16,000,000
    sha256 text not null
    storage_key text opaque, private bucket only
    uploaded_by_user_id uuid
    created_at, approved_at, retired_at timestamptz

document_studio_template_version_assets tracks extracted references:

    tenant_id uuid
    hr_group_id uuid
    template_version_id uuid
    asset_id uuid
    primary key (tenant_id, hr_group_id, template_version_id, asset_id)

This join is rebuilt transactionally from normalized JSON on every draft save. Active/history references are immutable. It prevents deleting an asset still referenced by any non-discarded version and gives RLS a relational scope for asset reads.

### 11.2 Accepted bytes and limits

DM-1 accepts only PNG and JPEG. Request validation rejects oversized Content-Length before formData() when present, then checks actual bytes, extension/MIME consistency, magic bytes, encoded input size <= 5 MiB, max edge <= 4000, max pixels <= 16M, and Sharp decode limits. Sharp rotates according to safe orientation, strips metadata, bounds the image and re-encodes to deterministic PNG/JPEG output <= 2 MiB. The original uploaded bytes are never rendered and are not retained after a rejected/quarantined upload beyond the explicitly approved operational retention.

Storage key format is generated server-side:

    {tenantId}/{hrGroupId}/{assetId}/normalized.{png|jpg}

Clients never choose bucket, tenant, group, path or MIME metadata. Reads use short-lived signed URLs only after asset row authorization; the editor receives an opaque asset ID and a server-created preview URL, never a public URL.

### 11.3 Security classification

The existing generic upload flow has no reusable malware scanner/quarantine implementation and SEC-006 is documented with a residual. Therefore:

- Future DOCX/office/unknown files: classification B — scanner/provider approval required; explicitly outside DM-1.
- Native PNG/JPEG normalized bytes: proposed A only after security-owner approval of decoder-only safety. The persisted/rendered artifact is Sharp-decoded and re-encoded raster data, with no original bytes, metadata, URL, HTML or active content retained.

If the current security policy requires a malware scan even for normalized raster output, this flow is blocked until an approved scanner/quarantine adapter exists. No external provider is selected by this document.

### 11.4 Asset lifecycle

    upload -> QUARANTINED -> signature/limits -> Sharp normalize -> APPROVED
                                          \-> REJECTED
    APPROVED -> referenced by draft/active/history -> RETIRED only after no references

An approved asset is usable only by an authorized same-group template version. A draft can reference it; an active version freezes the reference. Deletion is not a hard delete while referenced. Orphan cleanup is a later controlled job, not part of the editor request.

## 12. Authorization and RLS

### 12.1 Exact permissions

DM-1 introduces these canonical resource:action permissions:

    document-template:read
    document-template:write
    document-template:activate
    document-template:archive
    document-type:read
    document-type:write
    document-profile:read
    document-profile:write
    document-asset:read
    document-asset:write

document-template:read gates the standalone navigation and library. write covers draft and metadata changes; activate and archive are separate high-impact actions. Types/profiles/assets have separate exact codes to avoid granting lifecycle authority through a broad UI permission. No self: permission is introduced because DM-1 is HR Admin-only.

The migration seeds the permission rows and grants all ten only to the existing effective HR-admin role(s) that already manage the active HR group (TENANT_ADMIN global and tenant-specific, subject to the existing role matrix). It grants none to employee/manager roles by default. Exact role assignment must be checked against the current role/permission seed before applying the migration; no new role is invented.

### 12.2 Server checks

Every route/service:

1. gets the authenticated claims/context;
2. resolves the active tenant and HR group server-side;
3. validates the requested ID belongs to that tenant/group;
4. calls the exact permission required for the operation;
5. performs the mutation with the normal user-scoped Supabase client;
6. maps authorization, scope, conflict and validation failures to stable typed errors.

Client-supplied tenant/group IDs are ignored for scope selection and may only be used as consistency input that is checked against the active server context. No service-role bypass is used for ordinary CRUD.

### 12.3 RLS and grants

Every new exposed table has RLS enabled, authenticated grants only, and a restrictive HR-group boundary equivalent to the current internal_security.has_hr_group_access(tenant_id, hr_group_id). Permissive policies are split per command:

- SELECT: same-group access plus *:read;
- INSERT: same-group access plus the relevant *:write;
- UPDATE: USING and WITH CHECK both enforce same-group access plus the relevant write/lifecycle permission;
- DELETE: only draft/discard or unreferenced asset retirement through the guarded operation, never generic client delete of active/history rows.

Asset storage policies derive tenant/group from the generated path and require a matching authorized asset row; public/anon access is revoked. Update policies include a select-compatible visibility rule because Supabase/PostgREST UPDATE requires the row to be selectable as well as writable.

### 12.4 Guarded lifecycle RPCs

Atomic operations that span rows use narrowly scoped internal SECURITY DEFINER functions in internal_security, with set search_path = pg_catalog, fixed table qualification, auth.uid() and an explicit permission/group check. Public wrappers are SECURITY INVOKER where possible; internal functions are not executable by public or anon. Required operations:

    create_document_template_draft
    save_document_template_draft
    activate_document_template_draft
    archive_document_template
    discard_document_template_draft

The activation RPC locks the draft and logical template, revalidates active component references, category/type/profile/asset state, expected revision and idempotency, then performs the state transition and audit insert in one transaction. No direct UPDATE status path is exposed.

## 13. Database forward design

### 13.1 Tables and order

The implementation uses one small ordered forward set, starting above remote migration version 20260831165143 after the current remote baseline is rechecked:

1. document_studio_dm1_schema: enums/catalog decision, permissions, document types, profiles, logical templates, versions, compositions, template tags, assets and version-assets; checks, indexes, FKs, updated-at triggers, audit shape, RLS and grants.
2. document_studio_dm1_lifecycle: internal guarded RPCs and storage object policies after the asset bucket decision is approved. If the project convention requires one migration, these statements may be combined into one reviewed coherent migration; the order inside it remains schema → policies → guarded functions → grants.

No migration is created or applied in this task. The final implementation migration must use the actual remote max, not the stale local history, and must regenerate packages/db/types.ts after application/advisors as required by repository rules.

### 13.2 Required constraints

- all tables carry non-null tenant_id and hr_group_id;
- all group-scoped foreign keys are composite (tenant_id, hr_group_id, id);
- all version references include tenant/group;
- all user IDs reference auth.users with the existing deletion convention;
- JSONB has strict object/schema checks plus service-level Zod validation;
- active version uniqueness, one draft, positive version numbers and lifecycle timestamps are database-enforced;
- category/type/profile/asset references are checked on activation, not only on initial draft save;
- no raw storage path or client-owned URL is accepted in canonical JSON.

### 13.3 Advisors and typegen gate

After an authorized implementation migration, run Supabase advisors and inspect only DM-1 findings plus regressions. Regenerate packages/db/types.ts from the resulting schema. Existing unrelated advisor warnings and known typegen/migration drift are baseline debt; they are not silently fixed by DM-1.

## 14. API and service contracts

Routes expose domain actions, not generic table CRUD:

    GET  /api/document-studio/templates
    POST /api/document-studio/templates
    GET  /api/document-studio/templates/[templateId]
    PATCH /api/document-studio/templates/[templateId]/metadata

    POST  /api/document-studio/templates/[templateId]/draft
    PATCH /api/document-studio/template-versions/[versionId]/draft
    GET   /api/document-studio/template-versions/[versionId]
    POST  /api/document-studio/template-versions/[versionId]/validate
    POST  /api/document-studio/template-versions/[versionId]/activate
    POST  /api/document-studio/templates/[templateId]/archive
    POST  /api/document-studio/template-versions/[versionId]/discard

    GET/POST/PATCH /api/document-studio/document-types[/**]
    GET/POST/PATCH /api/document-studio/document-profiles[/**]
    GET /api/document-studio/semantic-fields
    GET/POST /api/document-studio/template-versions/[versionId]/assets
    GET/DELETE /api/document-studio/assets/[assetId]

Typed service inputs include active context, permission intent, expected revision and idempotency key. Responses include stable IDs, status, revision, content hash and validation diagnostics but never expose tenant/group authority from the request or raw storage credentials. No generate/preview/PDF endpoint exists in DM-1.

Validation response shape:

    {
      "valid": false,
      "errors": [
        {
          "code": "ASSET_NOT_APPROVED",
          "path": ["regions", "body", "content", 2, "attrs", "assetRef"],
          "messageKey": "documentStudio.validation.assetNotApproved"
        }
      ],
      "warnings": []
    }

Visible messages use NL/EN message files with equal keys. The API returns messageKey plus safe params, not localized server-owned prose.

## 15. UI implementation shape

Domain components under components/document-studio/:

    template-library.tsx
    template-library-filters.tsx
    template-metadata-form.tsx
    document-type-manager.tsx
    document-profile-manager.tsx
    structured-editor.tsx
    editor-toolbar.tsx
    placeholder-picker.tsx
    asset-picker.tsx
    composition-editor.tsx
    validation-panel.tsx
    version-history.tsx
    lifecycle-panel.tsx

The library row shows name, kind, language, category, document type, status, updated date and active version. The editor header shows draft revision, dirty state and Save; the right/secondary panel shows validation and composition metadata. Activation is a separate confirmation action explaining that the version becomes immutable and any previous active version moves to history. Archive is explicit and does not delete history.

Editor affordances are limited to the canonical node/mark allowlist. Placeholder insertion uses an accessible searchable choice component with visible selection; category, type, profile, tag and asset selection use the same Foundation searchable selection pattern. No closed ISO/reference value is a free text field.

## 16. DM-3 seam

DM-1 exposes a typed, normalized handoff object for a later resolver/renderer:

    type NormalizedDocumentV1 = {
      schemaId: 'liquid-hr.document-studio.native.v1';
      schemaVersion: 1;
      templateId: string;
      templateVersionId: string;
      templateVersion: number;
      kind: 'DOCUMENT' | 'COVER' | 'APPENDIX';
      page: { size: 'A4'; marginPreset: 'NARROW' | 'NORMAL' | 'WIDE'; fontFamily: 'WORK_SANS' };
      regions: CanonicalRegionsV1;
      composition: Array<{ kind: 'COVER' | 'APPENDIX'; templateId: string; versionId: string; version: number; sortOrder: number }>;
      assets: Array<{ assetRef: string; normalizedMime: 'image/png' | 'image/jpeg'; width: number; height: number; storageRef: string }>;
      placeholderManifest: Array<{ type: 'KNOWN' | 'TEMPORAL' | 'FREE'; key: string; locations: string[] }>;
    };

storageRef is an opaque server-side reference in the service boundary and is resolved only after authorization. The seam contains no employee IDs, tenant/group override, SQL, signed URL, raw file bytes, HTML, CSS, arbitrary URL or concrete resolved value. DM-3 owns resolution, final component expansion, template preview/generation preview semantics, renderer and PDF artifact policy.

## 17. Test and acceptance plan

No tests run in this docs-only task. The implementation gate must include:

### 17.1 Unit and contract tests

- canonical root/kind/region validation;
- every allowed node/mark and every forbidden node/attr;
- limits at and above boundary;
- deterministic normalization and content hash;
- atomic placeholder insertion, deletion, copy/paste, undo/redo and round-trip;
- temporal WAS/IS/WORDT, known catalog, free-key grammar and duplicate manifest;
- table/column/image/page-break invariants;
- composition cardinality, ordering and cross-group rejection;
- draft expected-revision conflict and idempotent retry;
- activation version allocation and immutable active/history rows;
- asset signature, size, pixel, orientation, re-encode and reference cleanup policy;
- NL/EN message key parity and API messageKey mapping.

### 17.2 Database/RLS tests

With real authenticated personas:

- HR Admin in group A can read/write/activate/archive group A;
- same HR Admin cannot read or mutate group B or another tenant;
- Manager and Employee receive denied/empty responses and no storage access;
- forged tenant/group/template/version/asset IDs are rejected or ignored;
- UPDATE cannot bypass select visibility or alter active/history content;
- component versions cannot cross group/kind/status boundaries;
- profile source administration cannot cross group;
- tag link cannot cross tenant;
- activation rollback leaves no half-active state;
- concurrent saves/activation produce one winner and a typed conflict for the other;
- audit events contain actor, group, entity, action, version/revision and safe change metadata only.

### 17.3 Browser acceptance

Use the real authenticated UI, not mocks:

1. open standalone Document Studio as HR Admin;
2. create Document, Cover and Appendix, including NL and EN identities;
3. enter every bounded block/mark and atomic placeholder;
4. attach a normalized image, reload, and verify persisted readback;
5. save, reopen, make a stale-revision conflict and recover;
6. compose one cover and ordered appendices;
7. validate, activate, inspect immutable version history, create a new draft and archive;
8. manage types, profiles and tags through list-first UI;
9. inspect 1440px and 390x844, console/page errors and page-wide overflow;
10. repeat negative API/UI checks as Manager, Employee, cross-group and cross-tenant.

DM-1 does not claim PDF output. DM-3 must separately prove preview/generation/PDF with the same normalized semantics.

## 18. Dependencies and blockers

### 18.1 Required before implementation

- product approval of concrete category codes and whether the catalog is fixed enum/check or managed table;
- security approval for decoder-only normalized PNG/JPEG assets or an approved scanner/quarantine adapter;
- review of the exact current role matrix before seeding the ten permissions;
- confirmation of the active remote schema baseline and migration timestamp immediately before migration authoring;
- exact Tiptap package/license/peer resolution recheck and lockfile review;
- UX copy approval for standalone navigation and the pre-DM-3 landing state.

### 18.2 Known non-blocking baseline debt

- remote/local migration-history drift and typegen drift documented in delivery docs;
- unrelated Supabase advisor findings;
- SEC-006 residual for generic/office uploads;
- no generated-document/dossier/retention runtime until later DM slices.

## 19. Implementation plan after gates

1. Record category and asset-security decisions in the requirements/decision documents.
2. Reconfirm origin/main, remote migration max, canonical env existence and active permissions; do not touch root dirty state.
3. Add and review the forward schema/security migration in order: enums/permissions → types/profiles → logical templates/versions → composition/tags/assets → RLS/grants → guarded RPCs/storage policies.
4. Run advisors and regenerate DB types; write repository/service Zod contracts against generated types.
5. Implement repository and guarded lifecycle services with test-first conflict/authorization coverage.
6. Add Tiptap adapter, canonical normalizer, custom atom nodes, strict paste sanitizer and editor code-splitting.
7. Add list-first library, metadata/type/profile/tag flows and responsive editor UI with i18n parity.
8. Add bounded asset normalization and private storage only after the security gate.
9. Run targeted unit/RLS/API checks, then real persona browser acceptance at desktop and 390x844.
10. Update implementation status/current context with evidence. DM-3 starts only from the typed normalized seam; it does not add renderer behavior to DM-1.

## 20. Open items and explicit decisions

| ID | Decision | Owner/state | Effect |
| --- | --- | --- | --- |
| DM1-OPEN-001 | Concrete category codes and catalog ownership | Product — OPEN/BLOCKING | required for type/metadata UI and activation |
| DM1-OPEN-002 | Decoder-only normalized raster vs approved scanner for PNG/JPEG | Security — OPEN/BLOCKING | required before asset upload/storage implementation |
| DM1-OPEN-003 | Confirm effective HR-admin role seed for all DM-1 permissions | Authorization review | no new role; implementation preflight |
| DM1-OPEN-004 | Confirm Tiptap direct peer set and bundle measurement | Engineering | package install only after design approval |
| DM1-OPEN-005 | Confirm landing copy before generated overview exists | Product/UX | no data model effect |
| DM1-OPEN-006 | Confirm one combined vs two ordered migration files | DB/integrator | same schema order and no history repair |

There is no unresolved choice about ownership, canonical JSON, version immutability, route family, tenant/group scope, profile source model, composition references, permission granularity or DM-3 boundary. Those are frozen above.

## 21. Files and expected implementation paths

This design change adds only:

    docs/requirements/documents/DM1_DOCUMENT_STUDIO_NATIVE_TEMPLATE_EDITOR_DESIGN.md

The minimal discoverability/status updates are:

    docs/README.md
    docs/delivery/CURRENT_CONTEXT.md

Expected future implementation paths (not changed in DM-1 design):

    apps/hr-suite/lib/document-studio/**
    apps/hr-suite/components/document-studio/**
    apps/hr-suite/app/document-studio/**
    apps/hr-suite/app/api/document-studio/**
    apps/hr-suite/messages/nl/**
    apps/hr-suite/messages/en/**
    apps/hr-suite/supabase/migrations/<new-forward-document-studio-migration>.sql

## 22. Verification and mutation boundary for this document run

Completed read-only/preflight evidence:

- origin/main fetched and verified at 155ccbde373a06684e37d9746b01dd65931c870b;
- closure commit d5dc1472067200f0e3d00150adc00c331f86d7e2 exists and descends from current main;
- closure app version is 1.20260901.1;
- isolated worktree is work/document-studio-dm1-native-template-editor-design at the closure SHA;
- canonical apps/hr-suite/.env.local exists; values were not read or exposed;
- remote schema, policies, migration inventory, existing storage buckets and relevant local migrations were inspected read-only;
- Supabase advisors were inspected read-only; unrelated baseline findings were not changed;
- live git ls-remote for the closure branch could not authenticate on this host (SEC_E_NO_CREDENTIALS), but the fetched remote-tracking ref matches the closure SHA exactly. This remains an evidence limitation, not a claim of a fresh live remote query.

No Supabase SQL mutation, storage mutation, package install, code edit, test, lint, typecheck, build, browser run, version bump, Vercel/GitHub setting change, merge, force operation or production action was performed.

## 23. Candidate and next gate

**Candidate:** BLOCKED — IMPLEMENTATION DESIGN CANDIDATE, because DM1-OPEN-001 and DM1-OPEN-002 are genuine product/security gates, not missing coding detail.

**Next:** approve the concrete category catalog and asset-security classification; then review this document as the DM-1 implementation contract. After approval, implement strictly in the order schema → service/API → UI and keep DM-3 renderer/PDF work separate.
