# PAYDOC-D0 — lokale Payroll-acceptatie

**Verdict: PARTIAL** · 21-10-2026 · kandidaatcode `568ffc38b4abec9366c52a4e88791c979674eb88` · branch `work/BRANCH-SPLIT-PAYROLL-20261021`

De bestaande lokale TEST-runtime op `http://127.0.0.1:3010` is hergebruikt. De server is niet opnieuw gestart. Er is geen push, merge, deployment, remote businessdatawrite of databasewijziging uitgevoerd.

## Tenant Admin-contextmatrix

Read-only Core TEST-readback bevestigde voor persona-key `hr-admin` één actieve `TENANT`-scope met rol `TENANT_ADMIN` binnen De Sterren holding; drie HR-groepen en vijf administraties zijn effectief beschikbaar, er zijn nul actieve grants naar andere tenants en twee oude Mars-/Jupiter-administratiegrants zijn inactief. Deze scope is rechtstreeks in Core TEST gewijzigd, niet door een Git-migratie. De bestaande tenantgebonden `TENANT_ADMIN`-permissiematrix blijft van kracht; dit zijn geen platformrechten. D0 heeft geen grant- of schemamutatie uitgevoerd.

| Identiteit | Bewezen context | Positief resultaat | Negatieve grens / bewijsstatus |
| --- | --- | --- | --- |
| Test HR Admin | De Sterren holding; `TENANT_ADMIN` | Via de bestaande administratiekiezer zijn alle 3/3 HR-groepen en 5/5 administraties geselecteerd. Na bevestiging klopte de server-side `/api/context`-readback. De gekozen D0-case stond in Mars BV. | Geen grant naar een andere tenant. Een directe live foreign-tenant-API-impersonatie is niet uitgevoerd; de forged tenant-scope wordt wel door de Payroll-accessguard-test geweigerd. |
| `payroll-demo-002` | Employee-selfservice in Mars BV | Bestaande role-switch-key; `/my-salary` toont één eigen FINALIZED oktoberstrook en biedt inline bekijken en downloaden. Er staan geen Payroll Admin-routes in de getoonde Employee-navigatie. | Cross-employee artifactread wordt door de self-scope service vóór de bytes-read geweigerd. Er is geen live forged cross-employee HTTP-aanvraag uitgevoerd. |
| Manager | Niet live gewisseld | Geen live browsermatrix; de bestaande Manager-rol wordt door de Payroll-componentaccessguard-test geweigerd voor Payroll Admin-toegang. | De directe Manager-browser/API-status blijft OPEN voor een afzonderlijke bestaande ondersteunde Manager-login. |

De oude Mars-only Test HR Admin-afspraak is verouderd. De eerdere Jupiter/Mars-afwijking was een contractmismatch en is met de actuele grant-readback en browsermatrix gesloten; grants zijn niet gewijzigd. Dit sluit geen afzonderlijke live Manager- of foreign-tenant-HTTP-acceptatie.

## Bestaande FINALIZED-loonstrook

Gebruikt is uitsluitend de al opgeslagen, immutable Mars-case `payroll-demo-002`, periode `2026-10`, lifecycle `FINALIZED`, artifacttype `PAYSLIP_PDF`.

- HR Admin run-detail gebruikt de bestaande geautoriseerde `GET /api/payroll/runs/{runId}/artifact/PAYSLIP_PDF`; inline viewer en download slaagden.
- Employee-selfservice gebruikte `GET /api/my-salary/payslips/2026-10`; inline viewer en download slaagden.
- Beide downloads waren 513.406 bytes met dezelfde SHA-256: `51b8c513b4c6f9b0c5a9e74e36086099d493ec08b9228b997779ae6cee56d977`. De inline viewer controleert de responsehash vóór de blob-preview; beide routes leverden dezelfde opgeslagen bytes.
- Desktop: HR Admin en Employee PASS. Op 390×844: HR Admin-viewer PASS zonder horizontale overflow; de Employee-mobilecontrole liep vast door een timeout/reset van de browserautomatisering en is **niet** als PASS aangemerkt.
- De bestaande loading-, error- en retry-weergave is gericht met componenttests gecontroleerd. De browserflow toonde de inline PDF zonder foutstate; mobiele Employee-rendering is niet bevestigd.

Er is geen berekening, review, finalisatie, PDF-creatie of lifecycle-mutatie gestart; D0 heeft alleen bestaande routes gelezen en geen opgeslagen bedragen, run, artifact of audittrail gewijzigd. De hashcontrole bewijst bytepariteit van deze ene bestaande PDF, geen algemene loonbedrag- of juridische audit.

## Autorisatie- en privacycontroles

- Positief: HR Admin en de gekoppelde Employee lezen hetzelfde bestaande artifact via hun normale productroutes; Employee-data komt via de self-only servicecontext.
- HTTP-regressies: anonieme HR Admin-artifactread geeft 401 vóór de artifactservice; een actor zonder Payroll Admin-toegang geeft 403 vóór byte-read. Beide routes testen expliciet dat de artifactservice niet is aangeroepen.
- Rol-/scope-regressies: Manager en Employee kunnen de componentlibrary niet als Payroll Admin openen; een forged tenantcontext wordt door de serverguard geweigerd. Een self-permission die naar een ander employee resolveert, wordt geweigerd vóór het lezen van artifactbytes. De servicecontracttests weigeren ook een afwijkende tenant-, HR-groep- of administratiescope.
- Deze gerichte HTTP-/servicechecks zijn tests met gecontroleerde autorisatiecontexten, geen live impersonatie van een andere tenant of Manager-account. De historische Lisa cross-employee HTTP-200-observatie is in D0 niet opnieuw benaderd en blijft als afzonderlijke securitycheck OPEN.

## Testgate en wijzigingen

- Gerichte finale set: **11 bestanden, 81 tests PASS** — stored-payslip viewer, DocumentViewer loading/error/retry/hashchecks, HR Admin artifactroute, Employee self-route/service, Payroll scope-/rolguard en permissioncontext.
- TypeScript `type-check`: PASS. ESLint op de vijf gewijzigde code-/testbestanden: PASS. `check:i18n`: PASS, 43 NL/EN namespaces gelijk.
- Canonieke persona-preflight: JSON/catalogus en statische role-switch-/configchecks PASS; `-SkipBrowser` rapporteerde Lisa, Jaap en Frits als BLOCKED omdat voor die drie geen browseracceptatie werd uitgevoerd. De gebruikte bestaande DEMO-002-role-switch is apart live gecontroleerd. De centrale TEST-config had vereiste variabelen; preflight startte geen server.
- Eén full-suitepoging op dezelfde productimplementatiecode maar vóór de laatste twee test-only negatieve assertions: **708 bestanden; 3.443 tests PASS, 8 SKIP, 21 tests timeout** met de bestaande 5.000 ms-testlimiet. De twee toegevoegde negatieve tests zijn daarna in de gerichte set geslaagd.
- Een geïsoleerde herkansing van de tien time-outbestanden: **32 tests PASS, 9 tests timeout** verdeeld over bestaande PDF-rendering, PGlite-/migratiecontracten en de 10.001-recordtest. Het zijn geen failures in D0-viewer- of self-scope-assertions; de volledige suite is daarom geen PASS.
- Er is geen nieuwe productiebuild uitgevoerd en geen Vercel-release gestart; de al draaiende lokale TEST-runtime is gebruikt voor de browserflow.

Code/testbestanden: `apps/hr-suite/app/(dashboard)/payroll/runs/[runId]/page.tsx`, `apps/hr-suite/components/payroll/payroll-stored-payslip-viewer.tsx`, `apps/hr-suite/components/payroll/payroll-stored-payslip-viewer.test.tsx`, `apps/hr-suite/app/api/payroll/runs/[runId]/artifact/[artifactType]/route.test.ts`, `apps/hr-suite/lib/payroll/component-library-access.test.ts`.

AA-OPEN: de oude Mars-only/Jupiter-hold is onder het nieuwe tenantcontract gesloten. Overblijvend zijn Employee 390 px, live Manager/foreign-tenant probes, de oudere Lisa/Jupiter-casusspecifieke PDF- en amountpariteit, volledige `/payroll/runs`-performance en de negen geïsoleerde full-suite-time-outs. Historische acceptance-rapporten zijn niet herschreven. Zie ook [AA-CURRENT](../../AA/AA-CURRENT.md), [AA-OPEN](../../AA/AA-OPEN.md), [AA-ACCEPT](../../AA/AA-ACCEPT.md) en [AA-NEXT](../../AA/AA-NEXT.md).
