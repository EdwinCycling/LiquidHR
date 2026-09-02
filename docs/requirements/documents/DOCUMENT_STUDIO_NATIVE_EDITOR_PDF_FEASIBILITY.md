# DOCUMENT STUDIO NATIVE EDITOR → HTML/PDF FEASIBILITY — FEASIBILITY GREEN

**Datum:** 2 september 2026  
**Scope:** disposable synthetic spike, geen production implementation  
**Baseline:** closure from `a63313ae54c79781e598b8ca362104f8993592cc`
(`origin/spike/document-studio-native-editor-pdf`), descended from approved
amendment `8132dde3b7efc5c6a3ebb9c7b8df661b8911441e`
(`origin/work/document-studio-native-editor-amendment`).
**Evidence directory:** `C:\Users\Edwin\AppData\Local\Temp\liquidhr-document-studio-native-editor-closure-20260902`

## BASELINE

De approved Product Contract en `DM0_DOCUMENT_STUDIO_ARCHITECTURE.md` zijn als
leidend uitgangspunt gebruikt. De native structured editor, Cover/Body/Appendix
composition, atomic placeholders, structural images, continuous editor en
authoritative A4 Preview zijn niet heropend. De vroegere Word-first/DOCX-lijn
blijft historische rationale en is niet opnieuw geselecteerd.

Preflight:

- `origin/main`: `155ccbde373a06684e37d9746b01dd65931c870b`.
- `work/document-studio-native-editor-amendment` lokaal en remote: exact
  `8132dde3b7efc5c6a3ebb9c7b8df661b8911441e`, clean.
- `spike/document-studio-native-editor-pdf` lokaal en remote: exact
  `a63313ae54c79781e598b8ca362104f8993592cc`, clean.
- Closure branch/worktree: `spike/document-studio-native-editor-pdf-closure`,
  gestart vanaf exact de first-spike SHA.
- Visible app version: `1.20260901.1`.
- Canonical protected env bestaat; waarden zijn niet gelezen, gekopieerd,
  gewijzigd of gestaged.
- Geen amendment-branch, `main`, app-code, package, migration, Supabase,
  Vercel, GitHub setting of version is aangepast.

## TOOLING

Inventory vóór tijdelijke uitvoering:

- `apps/hr-suite` gebruikt `@playwright/test`/Playwright `1.62.1` in de
  bestaande lockfile en `sharp`; Tiptap/ProseMirror staat niet in manifest of
  lockfile.
- Node `v22.14.0`, npm/npx `10.9.2`.
- `@playwright/cli` is uitsluitend tijdelijk via npx gebruikt; de cache staat
  buiten Git.
- Closure-only dependency probe buiten de monorepo: Tiptap/ProseMirror
  `3.31.0`, `jsdom 29.0.0`, `sharp 0.35.3`, Playwright `1.62.1` en
  `@fontsource/work-sans 5.3.0`.
- `@fontsource/work-sans` is OFL-1.1; de closure gebruikt alleen tijdelijke
  latin WOFF2-bestanden voor 400 normal, 700 normal en 400 italic.
- Chromium production-candidate package-metadata: `@sparticuz/chromium
  149.0.0`, 69,585,980 bytes packed / 69,678,316 bytes unpacked. Dit is een
  bundle-size probe, geen production install; package license is MIT.
- `playwright-core 1.62.1` is the matching candidate control layer (3,070,300
  bytes packed, Apache-2.0); neither candidate is added to the monorepo here.
- Lokale Poppler bevat `pdfinfo` en `pdftoppm`; `soffice`/LibreOffice is niet
  gebruikt. Docker is niet gebruikt. Er is geen externe service of betaald
  product gebruikt.
- Chromium `HeadlessChrome/152.0.0.0` leverde de PDF-render.

De eerste CLI-PDF zonder expliciete papierinstelling werd correct als een
belangrijke guardrail gevonden: die uitvoer was Letter. De reproduceerbare
correcte run gebruikt daarom expliciet `format: A4` en
`preferCSSPageSize: true`. Een production seam moet deze instelling pinnen en
testen.

## FEASIBILITY CLOSURE — GREEN

De closure sluit de zes resterende spikevragen zonder de goedgekeurde
product- of architectuurbesluiten te wijzigen: echte Tiptap/ProseMirror
runtime, 105-rijen multi-page table continuation, pinned Work Sans, bounded
PNG/JPEG decoding/resource limits, een geloofwaardige Node.js/Vercel
server-side renderer-richting en 1/2/4 concurrency smoke. De lokale closure
PDF- en preview-evidence is groen; productie-deployment blijft een DM-1 gate.

## STRUCTURED MODEL

`spike/document-studio-native-editor-pdf/synthetic-document.json` gebruikt
`liquid-hr.document-studio.native.v1` met afzonderlijke regions:

```text
Cover 1
Header 1
Body 1
Appendix 1..2
Footer 1
```

De normalizer accepteert alleen de bounded nodecatalogus: paragraph, heading
1–3, marks, alignment, bullet/numbered list, horizontal rule, table,
`TwoColumnBlock`, block image en first-class page break. Hij rejecteert
unsupported nodes/attributes, arbitrary HTML/CSS/scripts, onbekende asset refs,
remote URLs en onveilige free-placeholder keys.

De check leverde 6 pagina’s op, één first-class page break, 6 headings, 7
image-cases en de presets `25/75`, `33/67` en `50/50`. De fixture gebruikt
fictieve context: Ada Voorbeeld, LiquidHR Test B.V., `€ 4.250,00`, toekomstige
waarde `€ 4.500,00`, 2 september 2026 en optioneel vrij veld `Koffie`.

De closure bewijst de feitelijke Tiptap/ProseMirror runtime in een tijdelijke
jsdom-harness. `@tiptap/core`, StarterKit, Underline, Image en Table
extensions werken samen met custom atomic `knownPlaceholder`,
`freePlaceholder`, `temporalPlaceholder`, `pageBreak`, `blockImage` en
`twoColumnBlock` nodes. Insert/edit/delete, whole-node atomic delete,
undo/redo, semantic JSON reload en allowlisted paste-sanitization zijn groen.
De echte browser clipboard-event wiring blijft terecht een DM-1 integratiegate.

## PDF

De Generation Preview is via dezelfde localhost-HTML naar PDF gerenderd met
Chromium `page.pdf({ format: 'A4', preferCSSPageSize: true,
printBackground: true })`.

`pdfinfo generation-proof-a4.pdf`:

- 6 pagina’s;
- `594.96 x 841.92 pt (A4)`;
- 114309 bytes;
- PDF 1.4, niet encrypted, geen JavaScript.

Visueel gerasterde pagina’s `pdf-page-1.png` t/m `pdf-page-6.png` zijn
geïnspecteerd. Cover, herhaalde header/footer, page numbers, body-layout,
tables, images, expliciete page break en beide appendices zijn zichtbaar zonder
overlap, escape of clipping in deze fixture.

Dit bewijst een lokale server-side browser-PDF-boundary. Het bewijst geen
production Vercel/Next sandbox, concurrency, font packaging, resource limits
of deployment provenance.

De closure herhaalt deze route met een 105-rijen synthetic table en pinned
Work Sans. De closure-PDF heeft 13 pagina’s, `594.96 x 841.92 pt (A4)`,
82.360 bytes, PDF 1.4, geen encryptie en geen JavaScript. Dezelfde HTML maakt
14 tabel-fragmenten over pagina 5–11; elk fragment bevat maximaal 8 complete
rijen en een eigen herhaalde header. De eerste en laatste rijen zijn visueel
gecontroleerd op pagina 5, 6 en 11.

## IMAGE STABILITY

De PDF bevat de volgende structural cases: cover, header, table cell,
`TwoColumnBlock` image-left, image-right, body left-near-boundary, centered,
right-resized en appendix images. De afbeeldingen zijn PNG-only, deterministic
data assets met gecontroleerde `assetRef`, alignment en width percentage.

Bij 1440×900 gaf de browser geometry check:

- alle 6 page wrappers: `scrollHeight === clientHeight`;
- 25/75 kolommen: 168/505 px;
- 33/67 kolommen: 219/445 px;
- 50/50 kolommen: 332/332 px;
- image aspect ratios bleven per asset constant tijdens left/center/right en
  resize cases.

De zes PDF-rasterpagina’s bevestigen dezelfde positionering visueel. De
structurele aanpak voorkomt floating, absolute X/Y, wrapping en anchors.
Een volledige drag/resize editorinteractie en extreme page-boundary stress zijn
niet bewezen.

## TABLE / LAYOUT

De closure bewijst naast bordered/borderless tabellen nu een 105-rijen tabel
over 7 fysieke A4-pagina’s. De paginator maakt controlled fragments op
complete rijgrenzen; elk fragment schrijft dezelfde `thead`, waardoor de
header herhaald wordt zonder dat een rij wordt gesplitst. Een heading,
paragraph, 33/67 TwoColumnBlock en image staan bewust direct vóór de tabel om
de boundary-regel te belasten. Merged cells, nested tables, complexe
Word-layouts en orphan/widow-regels blijven buiten V1.

## PREVIEW

De volgende views gebruiken één `normalize → paginate → renderHtml`-semantics:

- **Template Preview:** sample/context placeholders zichtbaar als `##...`
  chips.
- **Generation Preview:** concrete Ada Voorbeeld-context, inclusief leeg
  optioneel `Koffie`-veld als lege string.
- **Final PDF:** dezelfde Generation Preview HTML, met expliciete A4 printopties.

De PDF zelf is de authoritative physical preview voor deze spike. De closure
bevestigt dat de 13-pagina table-preview en pinned-font PDF uit dezelfde
normalized HTML komen; de browser page-stack is daarnaast bruikbaar voor
inspectie, maar niet het enige bewijs van exacte print-paginering.

## REPEATABILITY

Dezelfde normalized document werd minstens drie keer gerenderd.

- HTML SHA-256, drie keer: `90e29417f318a32fe2f3ea3ab8d1cd94ae76d57a12e67b8fe1f3bad54b885bc2`.
- PDF run 1: `4954F633E095A07C05525C00656993FE375D0BEA87F8961B1FB3A3DACCD38785`.
- PDF run 2: `FDE994FFF238F4A06AE1BD8FAC09F5BDDA7B7E7447693AAFCF9BE3A681E2848D`.
- PDF run 3: `D57EAA070EEE1BDE01C0A242629889F9CA67B9B806AB3F7C91FFF67F3C5E433E`.
- Alle PDF-runs: 6 A4 pages, 114309 bytes.

De PDF-byte-hashes verschillen door Chromium `CreationDate`/`ModDate`; page
count, paper size, content placement en file size bleven gelijk. Een product
golden suite moet metadata normaliseren of hashes van een genormaliseerde
contentlaag vergelijken.

## FONTS / CHARACTERS

De closure kiest als DM-1 fontstrategie een exact gepinde lokale Work Sans
asset-set: `@fontsource/work-sans 5.3.0`, licentie OFL-1.1, latin WOFF2 voor
400 normal, 700 normal en 400 italic. De PDF injecteert deze assets als
embedded data URI; er is geen runtime Google-font fetch. Body, headings, bold,
italic, euroteken en Nederlandse accenten blijven leesbaar in de pinned-font
PDF. De uiteindelijke app/renderer moet dezelfde pinned files in de traced
server bundle opnemen en een `Arial, "Segoe UI", sans-serif` fallback behouden.

## SECURITY

De synthetische assets zijn deterministic PNG-data met signature, MIME,
dimensions, byte-size en safe `assetRef`. SVG is bewust uitgesloten. De
negative checks rejecteerden:

- arbitrary HTML/script node;
- remote image URL;
- unsupported `style` attribute.

Er is geen client filesystem path, runtime remote fetch, arbitrary expression,
SQL, real HR data of secret in de fixture/evidence. De closure gebruikt
`sharp 0.35.3` met signature/MIME-match, alleen PNG/JPEG, `5 MiB` encoded input,
`4000 px` max edge, `16M` max pixels, `2 MiB` genormaliseerde output,
`failOn:error`, `limitInputPixels`, rotate en bounded resize. Geldige PNG/JPEG
worden geaccepteerd; SVG, remote URL, corrupt PNG, MIME mismatch en oversized
input/dimensions worden geweigerd. Malware scanner/quarantine en private
storage/RLS flow blijven implementatiegates.

## PERFORMANCE

Gemeten op deze lokale synthetic fixture:

| Meting | Resultaat | Classificatie |
|---|---:|---|
| Normalization | 1.499 ms | GOOD |
| HTML + pagination | 1.530 ms | GOOD |
| Chromium A4 PDF | 1695 ms wall clock | ACCEPTABLE |
| Node RSS tijdens check | 60,596,224 bytes | ACCEPTABLE voor synthetic run |
| PDF size | 114309 bytes | GOOD voor synthetic run |

Closure smoke: zeven lokale Chromium PDF-renders met concurrency `1`, `2` en
`4` waren groen; alle output was 13 A4-pagina’s en 82.360 bytes. De maximale
gemeten renderduur was 1.455,6 ms en RSS-delta 20.852.736 bytes. Iedere
Playwright-browser werd in `finally` gesloten en rapporteerde disconnected na
close. Dit is geen Vercel load test: cold starts, planquota en productie-
resourcebudget blijven deploymentgates.

## VISUAL EVIDENCE

Extern bewaard in:
`C:\Users\Edwin\AppData\Local\Temp\liquidhr-document-studio-native-editor-closure-20260902`

- `editor-desktop-1440x900.png` — editor surface desktop;
- `template-preview-desktop-1440x900.png` — Template Preview;
- `generation-preview-desktop-1440x900.png` — Generation Preview;
- `editor-mobile-390x844.png` — editor mobile;
- `generation-proof-a4.pdf` — final PDF proof;
- `pdf-page-1.png` t/m `pdf-page-6.png` — rasterized PDF pages.

Closure evidence:

- `closure-pinned-work-sans.pdf` — 13-page pinned Work Sans A4 PDF;
- `table-page-05.png`, `table-page-06.png`, `table-page-11.png` — visual table
  boundary checks;
- `closure/closure-table-preview.html` and `closure/closure-run-summary.json`
  — 105 rows, 14 fragments, repeated headers;
- `tiptap-result.json`, `asset-result.json` and `concurrency-result.json` —
  runtime, decoder-policy and 1/2/4 smoke evidence.

De browserconsole had 0 errors en 0 warnings. Op 390×844 waren body- en
document-scroll-width beide 390 px; overflow delta was 0 px; 3 TwoColumn-nodes
en 10 toolbar buttons bleven inspecteerbaar. Geen evidence binary, font of
browser cache is gecommit.

## ACCEPTANCE MATRIX

| Capability | Status | Evidence / limit |
|---|---|---|
| Structured JSON | GREEN | Versioned JSON + normalizer |
| Tiptap/ProseMirror suitability | GREEN | Real Tiptap 3.31.0/jsdom runtime with custom nodes, transactions and paste seam |
| Atomic placeholders | GREEN | Known, temporal, free; no split-run output |
| Tables | GREEN | 105 rows, 14 row-boundary fragments, repeated headers over pages 5–11 |
| TwoColumnBlock | GREEN | 25/75, 33/67, 50/50 + geometry |
| Images | GREEN | Structural cases in PDF |
| Image stability | GREEN | Repeated visual/geometry checks on synthetic cases |
| Cover | GREEN | Separate first PDF page; body header/footer suppressed |
| Header/Footer | GREEN | Repeated logo/company/footer/page number |
| Page break | GREEN | First-class node creates body page boundary |
| Appendix composition | GREEN | Two appendices start after body on new pages |
| Multi-page A4 | GREEN | 6-page A4 PDF |
| HTML/CSS render | GREEN | Controlled page stack and CSS print boundary |
| Server-side PDF | GREEN | Local Chromium with explicit A4 options |
| Template Preview | GREEN | Visible placeholder/sample mode |
| Generation Preview | GREEN | Concrete synthetic context |
| Preview/final fidelity | GREEN | Same normalized HTML semantics; visual anchors match |
| Repeatability | GREEN | HTML identical; PDF metadata-only hash variance |
| Fonts | GREEN | Pinned Work Sans 5.3.0 OFL-1.1 WOFF2 set embedded in closure PDF |
| Asset safety | GREEN | sharp decode, PNG/JPEG signature/MIME and bounded resource policy |
| Performance | GREEN | Local 1/2/4 concurrency smoke; Vercel production budget remains open |
| Desktop/mobile | GREEN | 1440×900 and 390×844, no horizontal overflow |

## PRODUCTION IMPLICATIONS

The spike supports the approved product direction: native structured authoring
can feed one bounded normalized render model used by Preview and final PDF.
Production design should preserve:

- an explicit schema/version and normalizer before HTML generation;
- no arbitrary HTML/CSS/JS, remote references or expressions;
- first-class regions and structural layout nodes;
- authoritative rendered-PDF Preview or equivalent exact physical preview;
- explicit A4 `format`/CSS-size behavior in the renderer seam;
- bounded pages, nodes, text, rows, assets, bytes, time and memory;
- a controlled font allowlist and pinned runtime/Chromium provenance.

No production dependency, renderer, container, service or infrastructure is
changed by this report. The closure does select a concrete DM-1 direction:
Tiptap/ProseMirror as the editor adapter and an isolated Node.js server-side
Vercel Function/worker seam using pinned Chromium plus pinned Work Sans assets.

## RENDERER

The credible production direction is one dedicated Node.js render function or
worker boundary inside the current Next.js/Vercel project, receiving only an
authorized normalized document and returning an immutable PDF. It must run
Chromium with explicit A4 options, use pinned `playwright-core` plus
`@sparticuz/chromium 149.0.0` (temporary package probe: 69,585,980 packed
bytes), load the pinned Work Sans files, enforce page/node/asset/time limits,
and close the browser in every success/error path. The existing project region
`cdg1` can be retained for the first DM-1 implementation; no `vercel.json`,
route, package or deployment was changed here.

This direction is compatible with Vercel’s Node.js runtime, which exposes full
Node APIs for computationally intense functions, and the current documented
250 MB compressed function bundle limit. Vercel documents `maxDuration` for
Next.js functions and `outputFileTracingIncludes` for files that must enter a
Next.js function bundle; the DM-1 design must verify both with a real preview
deployment. See [Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js),
[Function limits](https://vercel.com/docs/functions/limitations) and
[static Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json).

Edge is not suitable for this renderer because the seam needs Node APIs and a
native/browser runtime. Vercel Sandbox remains a credible fallback if the
function bundle or browser isolation is not acceptable: its official SDK runs
isolated Linux images and supports custom images, but adopting it would be a
separate infrastructure decision and is not silently selected here. See
[Vercel Sandbox](https://vercel.com/docs/sandbox).

The local proof establishes the boundary and bundle headroom direction, not
Vercel deployment provenance. A real DM-1 gate must prove Linux Chromium
launch, traced font/browser assets, private authorized input, cancellation,
timeout and 1/2/4 request behavior on the selected plan.

## DECISION

**FEASIBILITY GREEN — bounded native editor → controlled HTML/CSS → isolated
Node.js server-side A4 PDF is technically feasible for the frozen MVP
primitives.**

`READY FOR DM-1 DESIGN: YES`.

The closure resolves the editor runtime, row-preserving multi-page table
strategy, pinned Work Sans asset strategy, PNG/JPEG decoder/resource boundary
and a credible Vercel-compatible renderer direction. It does not reopen any
approved product or architecture decision; Vercel deployment, private storage
authorization, malware quarantine and real browser clipboard wiring remain
explicit DM-1 implementation gates.

## REMAINING RISKS

- The local Tiptap proof uses jsdom and a sanitizer seam; real browser
  clipboard-event wiring and editor UX integration belong to DM-1.
- The table strategy is proven for controlled row fragments; merged cells,
  nested tables, very long wrapped cells and orphan/widow rules remain out of
  frozen V1.
- Production Linux Chromium launch, Vercel deployment provenance, plan quota,
  cancellation and egress policy remain unverified.
- Private object-storage resolution, tenant/group authorization and malware
  quarantine must be implemented around the bounded image decoder.
- PDF metadata is not a byte-stable golden hash; compare normalized content or
  raster/layout invariants instead.

## FILES

Committed source/report scope:

- `spike/document-studio-native-editor-pdf/synthetic-document.json`
- `spike/document-studio-native-editor-pdf/spike.mjs`
- `spike/document-studio-native-editor-pdf/tiptap-runtime.mjs`
- `spike/document-studio-native-editor-pdf/asset-runtime.mjs`
- `spike/document-studio-native-editor-pdf/concurrency-runtime.mjs`
- `spike/document-studio-native-editor-pdf/README.md`
- `docs/requirements/documents/DOCUMENT_STUDIO_NATIVE_EDITOR_PDF_FEASIBILITY.md`
- minimal status/index entries in `docs/README.md` and
  `docs/delivery/CURRENT_CONTEXT.md`.

Generated HTML, JSON, PNG, PDF, raster evidence, npx cache and browser
artifacts remain outside Git in the evidence directory.

## VERIFICATION

Run only for this closure spike:

- `node spike\document-studio-native-editor-pdf\spike.mjs --check --out <evidence>` — GREEN;
- `node spike\document-studio-native-editor-pdf\tiptap-runtime.mjs --deps <temp-deps> --out <evidence>\tiptap-result.json` — GREEN;
- `node spike\document-studio-native-editor-pdf\asset-runtime.mjs --deps <temp-deps> --out <evidence>\asset-result.json` — GREEN;
- `node spike\document-studio-native-editor-pdf\spike.mjs --closure-check --out <evidence>\closure --font-dir <temp-font-files>` — GREEN;
- Playwright CLI localhost browser proof, snapshots, screenshots and console — GREEN;
- `pdfinfo` + `pdftoppm` on the generated pinned-font PDF — GREEN, A4/13 pages/raster review;
- `node spike\document-studio-native-editor-pdf\concurrency-runtime.mjs --deps <temp-deps> --url <closure-url> --out <evidence>\concurrency-result.json` — GREEN for 1/2/4 concurrency and cleanup;
- `sharp` PNG/JPEG acceptance plus SVG, MIME, corrupt, byte and dimension negatives — GREEN;
- `git diff --check` — run at handoff;
- scope verification — run at handoff.

No full LiquidHR tests, typecheck, lint, build, migration, Supabase, Vercel
deployment or production check was run.

## MUTATIONS

- Created isolated worktree/branch `spike/document-studio-native-editor-pdf-closure`
  from first-spike SHA `a63313ae54c79781e598b8ca362104f8993592cc`.
- Added only disposable closure source and the feasibility documentation/status
  records listed above.
- Used temporary external Tiptap, jsdom, sharp, Playwright, Work Sans and npx
  tooling; all generated evidence and caches remain outside Git.
- Did not install or alter a production dependency, manifest, lockfile,
  browser binary, font, service, container, Vercel setting or infrastructure.

## CANDIDATE

Branch: `spike/document-studio-native-editor-pdf-closure`
Base: `a63313ae54c79781e598b8ca362104f8993592cc`
Remote target: `origin/spike/document-studio-native-editor-pdf-closure` (non-force push).

## NEXT

Use this report as the DM-1 input gate. Design the selected Tiptap/ProseMirror
adapter and isolated Node.js renderer, then prove the real Vercel deployment
boundary, private authorized input, browser clipboard wiring, malware
quarantine and non-synthetic golden fixtures before implementation release.

STOP.
