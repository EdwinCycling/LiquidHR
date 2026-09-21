# DOC02 — Document Template Rendering

- **Run ID:** DOC02
- **Name:** Document template rendering torture test
- **Status:** READY
- **Execution mode:** ISOLATED_FIXTURE
- **Mutation risk:** MEDIUM
- **Expected runtime:** LONG
- **Required personas:** HR Admin, Manager in scope, Employee self, Other Employee, Act-as Employee, out-of-scope Manager
- **External dependencies:** Document Studio template/schema, renderer/PDF/storage/hash, dossier, signing and Auth
- **Preferred branch name:** `work/acceptance-DOC02-YYYYMMDD`
- **Fixture isolation strategy:** Use a dedicated acceptance template and disposable controlled document data; never edit or replace a product template used by another run
- **Harness reference:** [HARNESS-V2.md](../HARNESS-V2.md)
- **Reporting reference:** [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)

## Dedicated template and rendering matrix

Use a dedicated acceptance template, not a product template. Discover and test known placeholders, free placeholders, temporal placeholders, optional values, missing values, invalid schema, names, dates, amount formatting and special characters. Record the expected exact rendered output and compare PDF/text/metadata after rendering.

Verify template validation, draft/activate lifecycle, render idempotency, filename/content type, storage key/hash, unresolved-marker absence, viewer/download, refresh/relogin and error paths. Test invalid or missing data without corrupting the template or generating a misleading final document.

## Exact before/after persistence

Record exact before/after counts and identifiers for batches, batch items, snapshots, dossier links, signing requests and signing events. One controlled render must not create duplicates on double click, repeated submit or bounded retry. Read back status transitions and downstream dossier/signing projections.

## Audience and signing matrix

Prove Employee self view/download/sign where contracted; Other Employee denial; HR lifecycle visibility; HR direct signing denial when Employee-only; Act-as behavior; Manager denial; out-of-scope denial; and cross-tenant denial when safe. Every negative case must have no data leak, business mutation, revision/event mutation or false-success audit.
