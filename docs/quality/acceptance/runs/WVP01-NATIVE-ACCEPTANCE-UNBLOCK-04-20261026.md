# WVP01 native acceptance unblock 04

Datum: 2026-10-26  
Branch: `work/wvp01-safe-integr-02-20261026`  
Basis: `3598b40e83c24d7f76d4ed08428acc558447bb16`  
Status: **PARTIAL** — lokale runtime en read-only rolchecks PASS; Employee-zelfdossier en echte procesketen OPEN.

## Core TEST-schema

Doeldatabase: LiquidHR Core TEST, project `wnpfloqpjvaacobppbpk`. Migratie `20261026055349_wvp01_absence_guidance` was vooraf al eenmaal toegepast en in [acceptance 03](WVP01-CORE-TEST-ACCEPTANCE-03-20261026.md) read-only geverifieerd. SHA-256: `d4ec81cdab60e398a61d7ee12e8fb76e7d1bbf68829264501eb6efb3cd35659a`.

Deze run heeft geen migratie-, schema- of businessdatawrites uitgevoerd. Er zijn geen accounts of rechten gemaakt, geen WVP-casus of proces gestart en geen WVP-taken, reminders, notificaties of domeinaudit-events toegevoegd.

## Runtime en werkboom

De centrale config en synthetische persona-configuratie bestonden op `%LOCALAPPDATA%\LiquidHR\TestRuntime`. De PowerShell-sandbox leverde een andere, virtuele `LOCALAPPDATA`; een process-lokale override naar de bestaande gebruikersmap liet de officiële `scripts/start-test-worktree.ps1` de config vinden. De configuratiebestanden zijn niet gelezen, gekopieerd of gewijzigd en waarden zijn verborgen gebleven. De officiële Development-runtime draaide op `127.0.0.1:3012` en is na acceptatie gestopt.

De `.git`-pointer van de integratieworktree verwijst correct naar de bestaande gedeelde Git-administratie en de geregistreerde worktreebranch. De melding “not a work tree” trad op toen de sandbox directe toegang tot de aparte worktree weigerde; na expliciete worktree-attachment werkte Git normaal. Er is geen Git-metadata aangepast. De runtime wijzigde automatisch de integratieworktree-kopie van `apps/hr-suite/next-env.d.ts`; alleen die exact gegenereerde delta is naar de oorspronkelijke schone inhoud teruggezet. De beschermde hoofdwerkboom is niet gewijzigd.

## Native rol- en privacycontroles

De geïsoleerde Chrome-run gebruikte de bestaande `/local/sign-in`, de bestaande lokale role-switch en normale contextselectie. Geen bestaande browsersessie was nodig.

| Rol | Controle | Resultaat |
| --- | --- | --- |
| HR Admin | Drie gemarkeerde `operations-10-year`-dossiers binnen Jupiter BV | Elk precies één dossier, `canManage=true` |
| Manager | Dezelfde drie Jupiter-dossiers | Elk precies één dossier, `canManage=true` |
| Manager | Gemarkeerd Mars-dossier buiten de actieve Jupiter-administratie | Lege resultaatset |
| Employee (`employee.fixture`, rol `EMPLOYEE`) | De drie Jupiter-dossiers plus het gemarkeerde Mars-dossier | Vier lege resultaatsets; geen cross-employee data |
| Anoniem | WVP API | HTTP 401 |
| Privacyvorm | WVP-API-resultaten | De gecontroleerde medische-veld-denylist matchte geen responsekeys |

HR Admin- en Manager-dossierpagina's renderden na de UI-fix echte headings op 390, 768 en 1440 px; iedere route gaf HTTP 200, zonder browserexception of horizontale overflow. De Employee-overviewroute gaf HTTP 200 en had op dezelfde breedtes geen horizontale overflow. De lijstinhoud is niet als acceptatiebewijs gebruikt: de Employee-fixture heeft geen gemarkeerd eigen WVP-dossier. Read-only broncontrole vond twee gesloten, ongemarkeerde casusrecords voor die identiteit; die zijn uitgesloten. De Employee-zelfweergave op een gemarkeerd eigen dossier blijft OPEN.

De canonieke Lisa-login is niet als Employee-negatief gebruikt: Core TEST verleent deze identiteit een bestaande `DIRECT_MANAGER`-HR-groepsrol. Dit is bestaand scopebewijs; geen rol is gewijzigd. De canonieke `check-test-personas.ps1`-statische preflight slaagde, maar zijn browserdeel verwacht het verouderde `/login`-pad en markeerde persona-browserbewijs BLOCKED. De native WVP-runner gebruikte het actuele `/local/sign-in`-pad en slaagde voor de hierboven genoemde WVP-controles.

## Lokale herstelwijziging en gerichte tests

De browserlog reproduceerde een detailpagina-crash: de Server Component gebruikte `wvpLabelKeys` uit een Client Component, waardoor de import geen array was. De labels staan nu in een gedeelde server-veilige module. De detailroute gebruikt ook dezelfde PostgreSQL-UUID-validator als de service; dit accepteert geldige bestaande Core UUID's zonder RFC-versiebits te eisen. Bestaande nullable `isSelf`-waarden blijven fail-closed `false`.

Na herstel renderden HR Admin- en Manager-dossiers volledig; de laatste browserrun had nul page errors. Resultaten:

- Vijf gerichte WVP-testbestanden: **23/23 PASS**.
- HR-suite TypeScript: **PASS**.
- ESLint op gewijzigde WVP-bestanden: **PASS**.
- `git diff --check`: **PASS**.
- De eerder groene algemene integratiegate van 247 tests is niet herhaald.

Een onmiddellijke eerste context-GET na lokale login gaf eenmaal `PGRST303 JWT issued at future`; de normale contextselectie en alle latere WVP-reads slaagden. Dit blijft een lokale TEST-runtimefluctuatie.

## Beschikbare casus en exact, nog niet geautoriseerd voorstel

De negen gedocumenteerde synthetische afwezigheidscases staan gesloten; geen ervan heeft al een WVP-proces. Er is dus geen bestaande actieve synthetische casus om een volledige processtart mee te testen.

Voorgestelde ene nieuwe synthetische casus:

- Identiteit: bestaande `employee.fixture`, employee `c6b1c7a9-c250-3d19-b1a0-87e317e80b13`, bestaande bevestigde tewerkstelling `eb1eea55-62c4-4b85-a3e9-20dca923e7d4`.
- Scope: De Sterren holding / Planeten / Jupiter BV `8483abc9-f275-c80b-5a23-fedc54ce9f0a`.
- Eerste verzuimdag en effectieve WVP-klokstart: **2026-10-26**.
- Mutaties na afzonderlijke toestemming: maak via de bestaande afwezigheidsflow één `ACTIVE` casus met een open eerste verzuimspell en 100% afwezigheid; start daarna WVP via de normale UI/API met de bestaande idempotente startactie. Geen vrije tekst, diagnose, medische bijlage, Auth-user, rolgrant of directe SQL/service-role-write.
- Verwachte wettelijke kalendertermijnen uit de huidige projectie: week 6 op **2026-12-07**, week 8 op **2026-12-21**. De werkbak kan actuele status/deadlines tonen; herinnering/escalatie is vóór die termijnen niet als afgevuurd te bewijzen.
- Herstelstrategie: geen hard delete of geschiedenisherschrijving. Na de goedgekeurde proef loopt herstel via de bestaande volledige herstelmelding en WVP-afsluitactie; synthetische audit/proceshistorie blijft bewaard. De casus blijft actief tot een toegestane herstelmelding wordt uitgevoerd.

Een akkoord voor alleen casuscreatie en processtart autoriseert geen mijlpaalafronding, werkafspraak, kennisname, recovery, afsluiting of notificatie. Die acties zijn in deze run niet uitgevoerd. De eerste casus- en proceswrites vereisen nog een afzonderlijk expliciet akkoord op het bovenstaande voorstel.

## Eindoordeel

- Runtimeherstel: **PASS**, proces-lokaal en via de officiële launcher.
- Persona-login: **PASS** voor HR Admin, Manager en de Employee-fixture.
- Read-only rolacceptatie: **PARTIAL** — HR Admin/Manager-positief en manager-/Employee-negatieven PASS; Employee-zelfdossier OPEN.
- Gemarkeerde synthetische actieve casus: **niet beschikbaar**.
- Echte procesacceptatie (start, milestones, afspraken, kennisname, reminders en afsluiting): **OPEN**.
- Core TEST-migratie: **al toegepast eenmaal; deze run deed geen write**.
- Git: lokaal op de integratiebranch; geen push, deployment, migratieherhaling of wijziging van de beschermde hoofdwerkboom.