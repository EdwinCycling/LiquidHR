# PAYDOC-D0 — lokale Payroll-acceptatie

**Verdict: PARTIAL** · 21-10-2026 · kandidaatcode `568ffc38b4abec9366c52a4e88791c979674eb88` · branch `work/BRANCH-SPLIT-PAYROLL-20261021`

De bestaande lokale TEST-runtime op `http://127.0.0.1:3010` is hergebruikt. De server is niet opnieuw gestart. Er is geen push, merge, deployment, remote businessdatawrite of databasewijziging uitgevoerd.

## Tenant Admin-contextmatrix

Read-only Core TEST-readback bevestigde voor persona-key `hr-admin` één actieve `TENANT`-scope met rol `TENANT_ADMIN` binnen De Sterren holding; drie HR-groepen en vijf administraties zijn effectief beschikbaar, er zijn nul actieve grants naar andere tenants en twee oude Mars-/Jupiter-administratiegrants zijn inactief. Deze scope is rechtstreeks in Core TEST gewijzigd, niet door een Git-migratie. De bestaande tenantgebonden `TENANT_ADMIN`-permissiematrix blijft van kracht; dit zijn geen platformrechten. D0 heeft geen grant- of schemamutatie uitgevoerd.

| Identiteit | Bewezen context | Positief resultaat | Negatieve grens / bewijsstatus |
| --- | --- | --- | --- |
| Test HR Admin | De Sterren holding; `TENANT_ADMIN` | Via de bestaande administratiekiezer zijn alle 3/3 HR-groepen en 5/5 administraties geselecteerd. Na bevestiging klopte de server-side `/api/context`-readback. De gekozen D0-case stond in Mars BV. | Geen grant naar een andere tenant. Een directe live foreign-tenant-API-impersonatie is niet uitgevoerd; de forged tenant-scope wordt wel door de Payroll-accessguard-test geweigerd. |
| `payroll-demo-002` | Employee-selfservice in Mars BV | Bestaande role-switch-key; `/my-salary` toont één eigen FINALIZED oktoberstrook en biedt inline bekijken en downloaden. Er staan geen Payroll Admin-routes in de getoonde Employee-navigatie. | Cross-employee artifactread wordt door de self-scope service vóór de bytes-read geweigerd. Er is geen live forged cross-employee HTTP-aanvraag uitgevoerd. |
| Manager | Niet live gewisseld | De lokale accountwisselaar toonde bestaande Employee-accounts maar geen Manager-keuze; de gekozen Lisa-accountwissel veranderde de sessie niet. Gerichte tests met DIRECT_MANAGER weigeren Payroll-adminservice-toegang; de artifactroute geeft een signed-in non-admin 403 vóór de artifactservice. | Een live Manager-documentaanvraag blijft OPEN; geen manager-PDF-bytes zijn opgehaald. |

De oude Mars-only Test HR Admin-afspraak is verouderd. De eerdere Jupiter/Mars-afwijking was een contractmismatch en is met de actuele grant-readback en browsermatrix gesloten; grants zijn niet gewijzigd. Dit sluit geen afzonderlijke live Manager- of foreign-tenant-HTTP-acceptatie.

## Bestaande FINALIZED-loonstrook

Gebruikt is uitsluitend de al opgeslagen, immutable Mars-case `payroll-demo-002`, periode `2026-10`, lifecycle `FINALIZED`, artifacttype `PAYSLIP_PDF`.

- HR Admin run-detail gebruikt de bestaande geautoriseerde `GET /api/payroll/runs/{runId}/artifact/PAYSLIP_PDF`; inline viewer en download slaagden.
- Employee-selfservice gebruikte `GET /api/my-salary/payslips/2026-10`; inline viewer en download slaagden.
- Beide downloads waren 513.406 bytes met dezelfde SHA-256: `51b8c513b4c6f9b0c5a9e74e36086099d493ec08b9228b997779ae6cee56d977`. De inline viewer controleert de responsehash vóór de blob-preview; beide routes leverden dezelfde opgeslagen bytes.
- Desktop: HR Admin en Employee PASS. Op 390×1079 is Employee DEMO-002 nu PASS: de bestaande inline-PDF laadde, de download voltooide en sluiten keerde terug naar de salarisstrook. De kaart en viewer pasten visueel in de viewport; er is geen numerieke overflowmeting vastgelegd.
- De browserflow toonde eerst de loading-state en daarna de PDF. Er is geen fout geforceerd in de browser; de bestaande loading-, error-, retry- en hashvalidatie zijn in de gerichte DocumentViewer-tests gecontroleerd.

Er is geen berekening, review, finalisatie, PDF-creatie of lifecycle-mutatie gestart; D0 heeft alleen bestaande routes gelezen en geen opgeslagen bedragen, run, artifact of audittrail gewijzigd. De hashcontrole bewijst bytepariteit van deze ene bestaande PDF, geen algemene loonbedrag- of juridische audit.

## Autorisatie- en privacycontroles

- Positief: HR Admin en de gekoppelde Employee lezen hetzelfde bestaande artifact via hun normale productroutes; Employee-data komt via de self-only servicecontext.
- HTTP-regressies: anonieme HR Admin-artifactread geeft 401 vóór de artifactservice; een actor zonder Payroll Admin-toegang geeft 403 vóór byte-read. Beide routes testen expliciet dat de artifactservice niet is aangeroepen.
- Rol-/scope-regressies: Manager en Employee kunnen de componentlibrary niet als Payroll Admin openen; een forged tenantcontext wordt door de serverguard geweigerd. Een self-permission die naar een ander employee resolveert, wordt geweigerd vóór het lezen van artifactbytes. De servicecontracttests weigeren ook een afwijkende tenant-, HR-groep- of administratiescope.
- Closeout-regressies: 8 bestaande viewer-/auth-/scopebestanden: 48/48 PASS; twee cross-employee/out-of-scope PDF-servicecases: 2/2 PASS; één cross-scope repositorytest: 1/1 PASS. De artifactroute weigert anonymous met 401 en signed-in non-admin met 403 vóór byte-read; een run buiten caller-scope geeft 404. De service weigert cross-employee rendering en het repository weigert cross-scope vóór query.
- Dit zijn gecontroleerde testcontexten, geen live impersonatie. De bestaande accountwisselaar toonde Lisa als beschikbaar, maar openen liet de browser op TENANT_ADMIN; de browser/devserver toonde Compiling en Fast Refresh. De historische Lisa-200-observatie en live Manager-, Lisa- en foreign-tenant-HTTP-probes blijven OPEN.

## Testgate en wijzigingen

- Gerichte finale set: **11 bestanden, 81 tests PASS** — stored-payslip viewer, DocumentViewer loading/error/retry/hashchecks, HR Admin artifactroute, Employee self-route/service, Payroll scope-/rolguard en permissioncontext.
- TypeScript `type-check`: PASS. ESLint op de vijf gewijzigde code-/testbestanden: PASS. `check:i18n`: PASS, 43 NL/EN namespaces gelijk.
- Canonieke persona-preflight: JSON/catalogus en statische role-switch-/configchecks PASS; `-SkipBrowser` rapporteerde Lisa, Jaap en Frits als BLOCKED omdat voor die drie geen browseracceptatie werd uitgevoerd. De gebruikte bestaande DEMO-002-role-switch is apart live gecontroleerd. De centrale TEST-config had vereiste variabelen; preflight startte geen server.
- Eén full-suitepoging op dezelfde productimplementatiecode maar vóór de laatste twee test-only negatieve assertions: **708 bestanden; 3.443 tests PASS, 8 SKIP, 21 tests timeout** met de bestaande 5.000 ms-testlimiet. De twee toegevoegde negatieve tests zijn daarna in de gerichte set geslaagd.
- Historische geïsoleerde herkansing: 32 tests PASS en 9 time-outs over PDF-, PGlite-/migratie- en grote-datasetbestanden; de oorspronkelijke negen test-ID's zijn niet in het rapport bewaard. PAYDOC-D0-CLOSEOUT herhaalde negen brongecorreleerde kandidaten afzonderlijk met apps/hr-suite/vitest.config.ts, --maxWorkers=1 en de bestaande 5.000 ms-limiet: 9/9 PASS, testfase 1,40–2,90 s per test. Dit wijst op parallelle worker-/resourceconcurrentie als waarschijnlijkste verklaring, maar bewijst niet dat dit exact dezelfde historische negen tests waren. De volledige suite is niet herhaald; de oude full-suite-uitkomst blijft geen PASS.
- Er is geen nieuwe productiebuild uitgevoerd en geen Vercel-release gestart; de al draaiende lokale TEST-runtime is gebruikt voor de browserflow.

Code/testbestanden: `apps/hr-suite/app/(dashboard)/payroll/runs/[runId]/page.tsx`, `apps/hr-suite/components/payroll/payroll-stored-payslip-viewer.tsx`, `apps/hr-suite/components/payroll/payroll-stored-payslip-viewer.test.tsx`, `apps/hr-suite/app/api/payroll/runs/[runId]/artifact/[artifactType]/route.test.ts`, `apps/hr-suite/lib/payroll/component-library-access.test.ts`.

AA-OPEN: de oude Mars-only/Jupiter-hold is onder het bevestigde tenantcontract gesloten. D0-closeout heeft Employee DEMO-002 mobiel gesloten; live Manager/Lisa/foreign-tenant-probes, de specifieke Jupiter/Lisa-bedragpariteit, volledige /payroll/runs-performance en een timeoutvrije finale full-suite blijven open. Historische acceptance-rapporten zijn niet herschreven. Zie ook AA-CURRENT, AA-OPEN, AA-ACCEPT en AA-NEXT.
## PAYDOC-D0-CLOSEOUT — 21-10-2026

**Verdict per onderdeel:** functioneel **PASS**; Employee mobiel **PASS**; security **PARTIAL**; testkwaliteit **PARTIAL**; overall **PARTIAL**.

### Employee mobiel

De bestaande lokale TEST-runtime bleef hergebruikt. In Chrome Responsive op 390 px breedte (390×1079) opende Employee DEMO-002 de bestaande FINALIZED-loonstrook inline; na de eerste loading-state verscheen de PDF-viewer met één pagina. De download voltooide. Sluiten keerde terug naar de salarisstrook. De bestaande opgeslagen bytes/hash uit dit rapport zijn niet opnieuw gegenereerd of gewijzigd. Er is geen fout geforceerd in de browser; de bestaande DocumentViewer loading/error/retry/hashtests zijn in de gerichte set geslaagd.

### Negatieve autorisatie

- **Manager zonder Payroll-adminrecht:** live login niet voltooid; de ondersteunde accountwisselaar toonde geen Manager-keuze. De gerichte DIRECT_MANAGER-test met salarispermissions wordt door de Payroll-adminservice geweigerd vóór de repository-read. De artifactroute geeft een signed-in non-admin HTTP 403 vóór de artifactservice/byte-read.
- **Andere Employee / cross-employee:** payroll-service-artifact cross-employee en out-of-scope preview slaagden 2/2; er wordt geen PDF gerenderd of artifact ingevoegd. De bestaande payslip-service tests blokkeren query/URL-signing buiten employee scope. Lisa was in de accountwisselaar beschikbaar, maar Account openen veranderde de sessie niet van TENANT_ADMIN; de historische Lisa-HTTP-200 is dus niet live herbeoordeeld.
- **Ongeldige tenant-/administratiescope:** de route geeft voor een run buiten caller-scope 404; de cross-scope repositorytest slaagde 1/1 en weigert vóór Supabase-query. Geen vreemde PDF-bytes zijn in deze probes teruggekomen.
- De lokale accountwisselroute bleef op /local/personas; de sessierol bleef TENANT_ADMIN en de browser/devserver toonde Compiling en Fast Refresh. Dit is een niet-voltooide browserpersona-flow, geen bewezen product-autorisatiefout. De oude Mars-only/Jupiter-hold blijft gesloten onder het bevestigde tenantbrede Test HR Admin-contract. Live Manager-, Lisa- en foreign-tenant HTTP-probes blijven OPEN.

De bestaande persona-preflight scripts/check-test-personas.ps1 -SkipBrowser slaagde voor catalogus, vereiste configuratie en credentialvelden; zij startte geen server. De script markeerde Lisa/Jaap/Frits als BLOCKED omdat -SkipBrowser de live browseracceptatie overslaat. In de zichtbare lokale accountwisselaar stond Lisa als beschikbaar; er is geen account aangemaakt of permission gewijzigd.

### Timeoutonderzoek en finale testkwaliteit

De eerdere rapportage van negen geïsoleerde time-outs bewaart geen exacte test-ID's. Daarom zijn negen brongecorreleerde kandidaten met de bestaande appconfiguratie afzonderlijk herhaald (--maxWorkers=1, originele testlimiet 5.000 ms); alle negen slaagden en elke testfase duurde 1,40–2,90 s:

- lib/document-generation/pdf.test.ts — renders the controlled HTML document as a multipage Work Sans A4 PDF.
- lib/payroll/validation-pack-pdf.test.ts — renders valid PDF bytes with the shared Chromium runtime.
- lib/payroll/payrun01-payslip-pdf.test.ts — renders valid A4 PDF bytes from the saved-result presentation.
- lib/payroll/payroll-calendar-migration.test.ts — preserves legacy months, scopes new periods, separates declaration periods, and locks referenced history; accepts database boundaries generated for every supported payroll periodicity.
- lib/payroll/separate-database-migrations.test.ts — applies the Core fiscal migration to the Core source schema and keeps its security contract; applies Payroll Lab migration without any Core tables and retains local scoped lifecycle guards; applies the regular employer setup migration with immutable scope and customer opening provenance.
- lib/startpage/service.counts.test.ts — counts more than 10,000 unique employees without transporting employment rows.

Samen met de acht gerichte viewer-/auth-/scopebestanden (48/48), de twee cross-employee servicecases (2/2) en één cross-scope repositorytest (1/1) zijn de onderzochte regressies groen. Omdat de oorspronkelijke negen IDs ontbreken, is dit geen bewezen exacte herhaling van die historische negen. De single-worker-uitkomst maakt parallelle runner-/worker-resourceconcurrentie waarschijnlijk, maar niet definitief bewezen. De eerdere volledige suite (3.443 PASS, 8 SKIP, 21 time-outs) is niet opnieuw gedraaid; zij blijft historische gedeeltelijke gate-evidence, geen finale full-suite-PASS.

Er zijn geen productcodewijzigingen, berekeningen, reviews, finalisaties, runs, PDF-mutaties, database-/grantwrites, push, merge of deployment uitgevoerd. apps/hr-suite/next-env.d.ts bleef ongemoeid.
