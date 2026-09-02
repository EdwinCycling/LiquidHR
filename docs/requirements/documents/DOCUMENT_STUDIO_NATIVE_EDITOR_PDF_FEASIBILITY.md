# DOCUMENT STUDIO NATIVE EDITOR → HTML/PDF FEASIBILITY — PARTIAL

**Datum:** 2 september 2026  
**Scope:** disposable synthetic spike, geen production implementation  
**Baseline:** `8132dde3b7efc5c6a3ebb9c7b8df661b8911441e` (`origin/work/document-studio-native-editor-amendment`)  
**Evidence directory:** `C:\Users\Edwin\AppData\Local\Temp\liquidhr-document-studio-native-editor-pdf-20260902`

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
- Lokale Poppler bevat `pdfinfo` en `pdftoppm`; `soffice`/LibreOffice is niet
  gebruikt. Docker is niet gebruikt. Er is geen externe service of betaald
  product gebruikt.
- Chromium `HeadlessChrome/152.0.0.0` leverde de PDF-render.

De eerste CLI-PDF zonder expliciete papierinstelling werd correct als een
belangrijke guardrail gevonden: die uitvoer was Letter. De reproduceerbare
correcte run gebruikt daarom expliciet `format: A4` en
`preferCSSPageSize: true`. Een production seam moet deze instelling pinnen en
testen.

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

Tiptap/ProseMirror is architectonisch passend als toekomstige editoradapter:
de fixture gebruikt precies het type atomic node/content-model dat een
ProseMirror-schema kan representeren. De feitelijke Tiptap runtime, schema
extensions, paste sanitization en editor transactions zijn in deze spike niet
geïnstalleerd of bewezen.

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

Bewezen: bordered en borderless tabellen, headers, meerdere rijen,
placeholder-cellen en image-cellen. De `TwoColumnBlock`-presets 25/75, 33/67
en 50/50 zijn bewezen met image+text, text+image en placeholder-rich
text+text. De content blijft binnen de bounded columns.

Niet bewezen: een zeer grote tabel die over meerdere fysieke pagina’s doorloopt,
herhaalde table headers bij zo’n split, merged cells, nested tables, complexe
Word-layouts, orphan/widow-regels of volledige browser auto-flow. De spike
materialiseert een eenvoudige deterministische block paginator; dit is een
feasibility render model, geen Word-paginering.

## PREVIEW

De volgende views gebruiken één `normalize → paginate → renderHtml`-semantics:

- **Template Preview:** sample/context placeholders zichtbaar als `##...`
  chips.
- **Generation Preview:** concrete Ada Voorbeeld-context, inclusief leeg
  optioneel `Koffie`-veld als lege string.
- **Final PDF:** dezelfde Generation Preview HTML, met expliciete A4 printopties.

De PDF zelf is de authoritative physical preview voor deze spike. De browser
page-stack is een bruikbare inspectie-/editorrepresentatie, maar wordt niet als
bewijs van exacte print-paginering gebruikt.

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

De spike gebruikt de kleine CSS-allowlist `Arial, "Segoe UI", sans-serif`,
zonder gedownloade font binary. Body, headings, bold, italic, euroteken en
Nederlandse accenten (`naïef`, `beëindiging`, `één`) zijn in Chromium visueel
leesbaar. Fallbackgedrag is niet op andere deployment images getest; font
packaging en een production allowlist blijven open.

## SECURITY

De synthetische assets zijn deterministic PNG-data met signature, MIME,
dimensions, byte-size en safe `assetRef`. SVG is bewust uitgesloten. De
negative checks rejecteerden:

- arbitrary HTML/script node;
- remote image URL;
- unsupported `style` attribute.

Er is geen client filesystem path, runtime remote fetch, arbitrary expression,
SQL, real HR data of secret in de fixture/evidence. De PDF meldt geen
JavaScript. Een echte image decoder-fuzz, malware scanner/quarantine en private
storage/RLS flow vallen buiten deze disposable spike en zijn niet opgelost.

## PERFORMANCE

Gemeten op deze lokale synthetic fixture:

| Meting | Resultaat | Classificatie |
|---|---:|---|
| Normalization | 1.499 ms | GOOD |
| HTML + pagination | 1.530 ms | GOOD |
| Chromium A4 PDF | 1695 ms wall clock | ACCEPTABLE |
| Node RSS tijdens check | 60,596,224 bytes | ACCEPTABLE voor synthetic run |
| PDF size | 114309 bytes | GOOD voor synthetic run |

Dit is geen load test. Worker memory, timeout, page/node/asset limits,
concurrent render isolation en Vercel runtime budget zijn nog niet vastgesteld.

## VISUAL EVIDENCE

Extern bewaard in:
`C:\Users\Edwin\AppData\Local\Temp\liquidhr-document-studio-native-editor-pdf-20260902`

- `editor-desktop-1440x900.png` — editor surface desktop;
- `template-preview-desktop-1440x900.png` — Template Preview;
- `generation-preview-desktop-1440x900.png` — Generation Preview;
- `editor-mobile-390x844.png` — editor mobile;
- `generation-proof-a4.pdf` — final PDF proof;
- `pdf-page-1.png` t/m `pdf-page-6.png` — rasterized PDF pages.

De browserconsole had 0 errors en 0 warnings. Op 390×844 waren body- en
document-scroll-width beide 390 px; overflow delta was 0 px; 3 TwoColumn-nodes
en 10 toolbar buttons bleven inspecteerbaar. Geen evidence binary, font of
browser cache is gecommit.

## ACCEPTANCE MATRIX

| Capability | Status | Evidence / limit |
|---|---|---|
| Structured JSON | GREEN | Versioned JSON + normalizer |
| Tiptap/ProseMirror suitability | PARTIAL | Model maps cleanly; runtime not installed/selected |
| Atomic placeholders | GREEN | Known, temporal, free; no split-run output |
| Tables | PARTIAL | Borders, cells, images proven; multi-page split open |
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
| Fonts | PARTIAL | Current Chromium allowlist; deployment fallback open |
| Asset safety | PARTIAL | Boundary negatives/signature proven; fuzz/scan/storage open |
| Performance | PARTIAL | Synthetic timing only; no load/concurrency budget |
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

No new editor library, renderer, container, license, service or production
infrastructure is approved by this report.

## DECISION

**PARTIAL — bounded native editor → controlled HTML/CSS → local server-side A4
PDF is technically feasible for the frozen MVP primitives.**

`READY FOR DM-1 DESIGN: NO`.

The hard production gate remains open until the follow-up design explicitly
resolves the editor adapter, renderer runtime/sandbox, table pagination model,
font packaging, asset decoder/security boundary and resource limits. This is a
follow-up decision gate, not a reopening of the approved native product model.

## REMAINING RISKS

- Tiptap/ProseMirror editor runtime and paste/transaction behavior are not
  proven.
- The simple paginator does not prove large table continuation or all
  near-boundary combinations.
- Chromium PDF defaults can silently produce Letter unless A4 options are
  pinned.
- Production runtime, sandbox, Vercel/Next limits, egress policy and renderer
  provenance are unverified.
- Font fallback, decoder fuzzing, malware quarantine, private storage and
  tenant/group authorization need their own implementation/test gates.
- The synthetic timing is not a capacity or concurrency guarantee.

## FILES

Committed source/report scope:

- `spike/document-studio-native-editor-pdf/synthetic-document.json`
- `spike/document-studio-native-editor-pdf/spike.mjs`
- `spike/document-studio-native-editor-pdf/README.md`
- `docs/requirements/documents/DOCUMENT_STUDIO_NATIVE_EDITOR_PDF_FEASIBILITY.md`
- minimal status/index entries in `docs/README.md` and
  `docs/delivery/CURRENT_CONTEXT.md`.

Generated HTML, JSON, PNG, PDF, raster evidence, npx cache and browser
artifacts remain outside Git in the evidence directory.

## VERIFICATION

Run only for this spike:

- `node spike\document-studio-native-editor-pdf\spike.mjs --check --out <evidence>` — GREEN;
- Playwright CLI localhost browser proof, snapshots, screenshots and console — GREEN;
- `pdfinfo` + `pdftoppm` on the generated PDF — GREEN, A4/6 pages/raster review;
- 3× same-document PDF render — GREEN for page/layout/size, metadata hash variance recorded;
- mobile overflow/geometry assertion — GREEN;
- `git diff --check` — run at handoff;
- scope verification — run at handoff.

No full LiquidHR tests, typecheck, lint, build, migration, Supabase, Vercel,
GitHub or production check was run.

## MUTATIONS

- Created isolated worktree/branch `spike/document-studio-native-editor-pdf`
  from the exact approved amendment SHA.
- Added only disposable spike source and the feasibility documentation/status
  records listed above.
- Used temporary npx Playwright tooling and external test evidence.
- Did not install or alter a production dependency, manifest, lockfile,
  browser binary, font, service, container or infrastructure.

## CANDIDATE

Branch: `spike/document-studio-native-editor-pdf`  
Base: `8132dde3b7efc5c6a3ebb9c7b8df661b8911441e`  
Remote target: `origin/spike/document-studio-native-editor-pdf` (non-force push).

## NEXT

Use this report as the DM-1 input gate. Before implementation, make a separate
approved decision for the editor adapter and isolated PDF runtime, then extend
the spike/golden suite for multi-page tables, larger boundary matrices,
production fonts, decoder/resource limits and the real deployment runtime.

STOP.
