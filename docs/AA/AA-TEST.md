# AA-TEST — LiquidHR Testing Standard

Status: **LEIDEND**
Eerste opzet: 2026-09-29

Doel: hoge zekerheid zonder na iedere kleine wijziging ~2.000 tests opnieuw te draaien.

## 1. Testprincipe

Test **risicogestuurd en bounded**.

| Wijziging | Minimum |
| --- | --- |
| Kleine component-/bugfix | betrokken tests + regressietest |
| Nieuwe feature/slice | featuretests + aangrenzende contracts/security |
| DB/migration | migrationcontract + readback + RLS/grants + types |
| Auth/RLS/scope | gerichte authorization/securitymatrix |
| Shared core met brede blast radius | bredere relevante suite, zo nodig full suite |
| Featurebranch afronding | relevante feature-/integrationgates |
| Convergence/release | één volledige suite + production build |
| Alleen docs/version metadata na bewezen code | full suite niet opnieuw |

Een full suite is geen ritueel. Gebruik hem waar het bewijs toevoegt.

Praktische regel:
- tijdens bouwen: targeted;
- bij een defect: defecttest + relevante regressie;
- bij convergence/release: één full suite op de **uiteindelijke productcode**;
- na uitsluitend docs/versionmetadata: niet opnieuw;
- zodra ná een eerdere full suite nog productcode, UI-code, schema of runtimegedrag wijzigt, geldt die eerdere full-suite-GREEN niet automatisch als releasebewijs voor de nieuwe worktree.

## 1A. Bewijs tijdens grote bouwslagen en uitgestelde acceptatie

Een substantieel featurepakket heeft **één risicogestuurde teststrategie vanaf het begin**. Iedere agent bezit zijn gerichte unit-/contracttests; de integrator voert relevante geïntegreerde regressies en waar uitvoerbaar echte browser-/JWT-tests uit; onafhankelijke review richt zich op veranderde risicogrenzen. Defecten die in scope liggen worden in dezelfde bouwronde gereproduceerd, gerepareerd en opnieuw getest. Herhaal geen volledige suite als de productcode en gedeelde blast radius onveranderd zijn; convergence doet de finale suite op exact de releasekandidaat.

Bewijsniveaus niet verwisselen:
- `STATIC/UNIT`: parser-, service- en migrationcontracttests; geen claim over remote grants, echte Auth-sessies of echte browserflow.
- `REMOTE READBACK`: toegepaste schema-/grant-/trigger-/migrationstatus en concrete readbacks; niet automatisch bewijzen dat een gemanipuleerde JWT of definitieve SQL-write daadwerkelijk wordt geweigerd.
- `REAL AUTH/API/BROWSER`: echte gescopeerde TEST-actor, directe HTTP-/RLS-negatieven en daadwerkelijk doorlopen desktop-/390-px-flow op vastgepinde code en omgeving.
- `RELEASE`: onafhankelijke convergence-gate, juiste migratieprovenance, Preview/TEST en expliciet releasebesluit volgens AA-REL.

Ontbreekt alleen een externe secret, authentieke persona, goedgekeurde fixture of gedeeld datacontract, rapporteer per niveau wat wel bewezen is. **Een gekende ontbrekende fixture herhaald onderzoeken is geen teststrategie.** Koppel één `AA-OPEN`-ID met concrete herstartvoorwaarde en test de onafhankelijke delen verder. Activeer de ontbrekend-bewezen beveiligde functionaliteit niet; geen fake persona, ongetoetste sleutel, omzeilde guard of synthetische SQL-rol als vervanging voor een echte JWT-negative.

## 2. Persona's

De vaste functionele testpersona's zijn:

### HR Admin
Test:
- groeps-/administratiebeheer binnen toegewezen scope;
- HR-functionaliteit;
- instellingen;
- imports;
- reports;
- AI-governance waar toegestaan.

### Manager
Test:
- uitsluitend eigen team/afdeling volgens server-side scope;
- geen HR-adminbeheer;
- forged employee/department/context weigeren;
- rapporten alleen in managercatalogus.

### Employee / Medewerker
Test:
- self-service en eigen medewerkercontext;
- geen managementreports;
- geen HR Admin-instellingen;
- forged andere medewerker weigeren.

### Control OWNER
Test:
- platformmutaties die OWNER/OPERATOR toestaan;
- bootstrap/onboarding;
- lifecycle;
- geen auth-bypass.

### Control OPERATOR
Test:
- dezelfde operationele mutationgrens waar productcontract dit toestaat.

### Control AUDITOR
Test:
- read-only;
- writes moeten server-side worden geweigerd.

Gebruik de bestaande geconfigureerde identities/harness. Documenteer geen wachtwoorden, tokens of persoonlijke accountgegevens in deze file. Exacte accountmapping hoort in beveiligde/runtime testconfiguratie, niet in publieke canonieke documentatie.

Een test mag nooit groen worden gemaakt door tijdens acceptance een extra rol, platformoperator of tweede identity te creëren die het product normaal niet zou hebben.

## 3. Test Auth versus normale OAuth

Test Auth:
- uitsluitend lokale development/test;
- fail-closed buiten lokale dev;
- nooit zichtbaar of bruikbaar op Vercel Production/Preview;
- mag geen rollen creëren of escaleren om een scenario groen te krijgen.

Normale OAuth:
- gebruiken wanneer echte identity/callback/sessiongedrag onderdeel van acceptance is;
- geen redirect/securitybypass bouwen om een test te laten slagen;
- voor lokale Control OAuth moet de lokale callback expliciet in de Supabase Redirect URL allowlist staan; wijzig daarvoor niet de production Site URL;
- houd lokale redirecttoegang development-specifiek (huidig Control-patroon: `http://localhost:3001/**`);
- terugvallen naar de hosted HR-login is geen geslaagde lokale Control-authenticatie.

Control:
- platformoperatorstatus komt uit de echte `platform_operators`-autorisatie, niet uit een testrol die tijdens acceptance wordt verzonnen.

### Lokale TEST-runtime en worktrees

- Gebruik de centrale Windows-runtimeconfig `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local` uitsluitend via `scripts/start-test-worktree.ps1`.
- Preflight controleert vereiste variabelen alleen op aanwezigheid, workspace-dependencies, loopback-poort en bij Production-modus de bestaande `.next`-build. De waarden worden niet getoond of gekopieerd.
- De launcher bouwt of installeert niets en stopt geen bestaand proces. Een nieuwe worktree mag zonder lokale `.env.local` starten; een bestaande lokale file wordt alleen toegestaan wanneer de centrale hardlink aantoonbaar is.
- Leg voor browseracceptatie de exacte worktree-HEAD, status, URL, viewport en relevante browser/networkresultaten vast. De volledige werkwijze staat in `docs/delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md`.

## 4. Synthetic testdata

- Gebruik synthetische, duidelijk herkenbare TEST-records.
- Gebruik geen echte persoonsgegevens in repositoryfixtures.
- Bestaande persoonlijke/representatieve bestanden worden vóór commit geanonimiseerd.
- Testrecords worden niet verwijderd wanneer append-only auditbewijs behouden moet blijven.
- Waar cleanup veilig onderdeel van het productcontract is: cleanup/neutralisatie na de run.
- Waar cleanup niet passend is: markeer records herkenbaar als synthetic acceptance fixture en documenteer ze.

## 5. Authorization matrix

Bij securitygevoelige features minimaal waar relevant:
- happy path juiste persona;
- ontbrekende permission;
- verkeerde tenant;
- verkeerde HR-groep;
- verkeerde administratie;
- out-of-scope medewerker/team/case;
- forged query/body/cookie/context;
- stale/revoked permission;
- read versus write;
- direct API/RPC, niet alleen UI.

## 6. Browser en API

Browseracceptatie bewijst:
- werkelijke navigatie;
- formuliergedrag;
- states;
- responsive/interactie;
- downloadgedrag;
- console/network voor de geteste flow waar relevant.

API-acceptatie:
- stuur een echte HTTP/API-request;
- een browser die navigatie zelf blokkeert is geen bewijs van een server-side 403.

Voor Vercel Preview hoort de pull request een commit-specifieke Preview-URL te krijgen. Test daar alleen met Preview-scoped variabelen naar geïsoleerde synthetische backends; voer de relevante browsermatrix uit op de immutabele deploymentcommit en controleer deploymentstatus, console en requests. Test Auth blijft fail-closed buiten lokale development. Preview-omgeving ontbreekt of faalt: `BLOCKED BY ENVIRONMENT` of `RED` op basis van de concrete evidence, niet een TEST/Production-backend als vervanging gebruiken. Zie `docs/delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md`.

Exports:
- download echte output;
- parse het bestand;
- controleer rij-/scope-/filterpariteit;
- controleer content-type/formaat;
- controleer spreadsheet-formuleprefixbescherming waar relevant.

## 7. DB en concurrency

Bij databasekritieke flows:
- inspecteer readback, niet alleen HTTP 200;
- test idempotency;
- test races waar dubbele charge/dubbele mutation plausibel is;
- test recovery/retry zonder dubbele businessactie;
- controleer grants/RLS/RPCscope.

### Importfinalisatie

Voor staged imports die meerdere domainwrites doen, test minimaal:
- preview veroorzaakt nul definitieve domainwrites;
- employee + assignment + IKV + employment/draft volgens contract;
- failure na een eerdere deelwrite laat een herkenbare herstelbare status achter;
- retry maakt geen duplicate employee, IKV of employment;
- idempotency over dezelfde batch/source;
- foutdiagnostiek is voldoende voor root-cause zonder PII/secrets;
- batchstatus maskeert geen ontbrekende kernrecord.

## 8. UI en i18n

Waar relevant:
- loading;
- error;
- empty;
- validation;
- permission;
- keyboard/focus;
- narrow/mobile viewport;
- NL/EN parity.

## 9. Payroll Lab / payroll engine

Voor Payroll geldt aanvullend `AA-PAYROLL.md`.

Tijdens normale Payroll-engineontwikkeling bewijs minimaal waar relevant:
- componentdefinition/input/output/dependency-contracten;
- fixed-decimal gedrag en afronding;
- geen binary-float regressies in financiële calculation paths;
- expliciete rounding stage/mode/scale per wettelijke regel waar van toepassing;
- tests voor rekenkundig, naar beneden, naar boven en target-multiple rounding waar gebruikt;
- statutory boundary tests rond relevante drempels (onder/exact/boven);
- trace van unrounded → rounded value + rounding rule version waar relevant;
- deterministische restcentallocatie wanneer groepsbedragen worden verdeeld;
- cumulatieve/YTD-logica alleen waar de component/regeling dit expliciet vereist;
- graph/order/dependency-resolutie;
- veilige expression-engine;
- ownership/provenance en detached forks;
- Golden Case exact-resultaat;
- source/input/result hash-repeatability;
- run lifecycle;
- persistence readback;
- immutable trace/control artifacts;
- tenant/HR-groep/administratie-scope negatives;
- client secret boundary.

Een synthetische Golden Case bewijst de engine en orchestration, niet automatisch fiscale juistheid. Echte NL-jaarrules krijgen afzonderlijke compliancecases tegen de betreffende officiële bronnen.

Browseracceptatie mag bestaande lokale Test Auth/testidentities gebruiken. Maak geen nieuwe rol, gebruiker of bypass om acceptatie mogelijk te maken.

Een Payroll Lab-auth/environmentprobleem mag als `ENVIRONMENT-GATED` worden geregistreerd wanneer engine/persistencebewijs onafhankelijk beschikbaar is; heropen geen eindeloze auth-RCA buiten de afgesproken slice.

## 10. Full-suite beleid

Draai een volledige hr-suite:
- aan het eind van convergence/release;
- eerder alleen bij aantoonbaar brede shared-core blast radius.

Als een full suite GREEN is op exact dezelfde productcode en daarna alleen docs/versionmetadata wijzigt:
- hergebruik het bewijs;
- draai hem niet opnieuw.

Als één ongerelateerde test timeout:
1. run geïsoleerd;
2. herhaal bounded;
3. bepaal flaky/performance/root cause;
4. release vereist uiteindelijk een verdedigbare GREEN gate volgens AA-REL.

## 11. Acceptance verdicts

Volg `docs/quality/acceptance/REPORTING-STANDARD.md`.

- **GREEN**: alle in-scope verplichte assertions bewezen.
- **PARTIAL**: nuttig bewijs, maar verplichte assertion nog open.
- **BLOCKED**: veilige voortgang daadwerkelijk onmogelijk.
- **ENVIRONMENT-GATED**: productcode niet afgekeurd, maar bewijs door externe/runtimegrens niet beschikbaar.

Rapporteer alleen wat werkelijk is waargenomen.
