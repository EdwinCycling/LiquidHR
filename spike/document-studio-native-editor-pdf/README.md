# Document Studio native editor → HTML/PDF feasibility spike

Disposable synthetic proof for the approved native structured Document Studio direction. This directory is outside `apps/hr-suite` and has no production dependency, schema, renderer, or runtime selection.

## Run

```text
node spike.mjs --check --out <external-test-evidence-directory>
node spike.mjs --serve --port 4173
node spike.mjs --closure-check --out <external-test-evidence-directory>/closure --font-dir <temp-work-sans-files>
node tiptap-runtime.mjs --deps <temp-deps> --out <external-test-evidence-directory>/tiptap-result.json
node asset-runtime.mjs --deps <temp-deps> --out <external-test-evidence-directory>/asset-result.json
node concurrency-runtime.mjs --deps <temp-deps> --url <closure-preview-url> --out <external-test-evidence-directory>/concurrency-result.json
```

The check writes normalized JSON, three HTML views, deterministic synthetic PNG assets, and a JSON run summary to the supplied evidence directory. Browser screenshots and the PDF are created separately with the repository's Playwright CLI workflow. Do not commit that generated evidence directory, browser binaries, fonts, or caches.

The fixture intentionally exercises Cover, Header, Body, two ordered Appendices, Footer, atomic known/temporal/free placeholders, marks, lists, bordered and borderless tables, 25/75, 33/67 and 50/50 `TwoColumnBlock`s, structural images, explicit page break, A4 page composition, security rejection cases, and empty optional free-field resolution.

The closure-only checks add a real temporary Tiptap/ProseMirror runtime, a 105-row table split into complete row-boundary fragments with repeated headers, pinned Work Sans WOFF2 proof, bounded `sharp` PNG/JPEG decoding, and local Chromium concurrency smoke at 1/2/4. Dependencies and all generated evidence remain outside the repository; this source does not select or install a production package.
