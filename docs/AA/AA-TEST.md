# AA-TEST — LiquidHR Testing Standard

Status: **LEIDEND**
Eerste opzet: 2026-09-29

Doel: proportioneel bewijs zonder na iedere kleine wijziging de volledige HR-suite opnieuw te draaien.

## 1. Risicoklassen en testminimum

| Risico | Voorbeelden | Minimum |
| --- | --- | --- |
| **LOW** | Documentatie, workflow-/configuratietekst, beperkte statische wijziging zonder runtimegedrag | Controleer geraakte verwijzingen/inconsistenties, diff-check en zo nodig een gerichte document-/scriptcheck. Geen volledige HR-suite; geen browser zonder runtimewijziging. |
| **MEDIUM** | Gewone feature of bugfix | Direct geraakte tests plus aangrenzende contracttests; toepasselijke scope-typecheck/lint; gerichte browsercontrole wanneer UI-gedrag verandert. |
| **HIGH** | Auth, tenant/RLS, Payroll, schema, security of cross-cutting wijziging | Positieve én negatieve autorisatie-/scopegevallen; domein-, regressie- en integriteitschecks; relevante databasecontracten; productiebuild waar toepasselijk; volledige suite volgens de releasegate. Remote readback/mutatie alleen binnen afzonderlijk toegestaan bereik. |

**AA-LEAN-02-routering:** FAST = beperkte LOW/MEDIUM-presentatiewijziging zonder contractimpact; STANDARD = MEDIUM; CONTROLLED = HIGH of aantoonbaar brede shared-core-impact. Classificeer de **feitelijke wijziging**, niet automatisch de hele route of het hele bestand als HIGH. Bij onduidelijke security-impact eerst gericht controleren.

**TEST-integratiegate:** voor expliciet geautoriseerde **FAST/STANDARD-pushes naar uitsluitend synthetische TEST** volstaat passend gericht bewijs (plus lokale/hosted smoke waar relevant). Een volledige 2.000+-testsuite is **niet verplicht per kleine TEST-push**. Voor **CONTROLLED** en formele/gezamenlijke releaseacceptatie blijft één finale volledige relevante suite op de definitieve runtime-/schemacode verplicht. Documenteer SHA, bewijs en OPEN-punten; herhaal niet na alleen docs/versionmetadata. `OPEN` is niet `GREEN`, en een TEST-release met OPEN acceptatie is geen productieacceptatie.

## 2. Testprincipe

Test **risicogestuurd en bounded**.

| Wijziging | Minimum |
| --- | --- |
| Kleine component-/bugfix | LOW/MEDIUM volgens runtime- en security-impact |
| Nieuwe feature/slice | MEDIUM of HIGH volgens scope; featuretests + aangrenzende contracten |
| DB/migration | HIGH: contract, readback, RLS/grants en types na geautoriseerde wijziging |
| Auth/RLS/scope | HIGH: gerichte positieve én negatieve autorisatiematrix |
| Shared core met brede blast radius | passende bredere suite; full suite als releasebeleid dit vereist |
| Feature afronden | relevante feature-/integratiegates; geen automatische full suite |
| FAST/STANDARD-integratie naar synthetic TEST, met expliciet mandaat | Gerichte gates, relevante smoke; geen automatische volledige suite of complete browsermatrix |
| CONTROLLED of formele gezamenlijke release | Eén volledige finale relevante suite + passende build |
| Alleen docs/versionmetadata na bewezen code | geen full suite opnieuw |

Een full suite is geen ritueel. Gebruik hem waar het bewijs toevoegt.

Praktische regel:
- tijdens bouwen: targeted;
- bij een defect: defecttest + relevante regressie;
- bij CONTROLLED-/formele gezamenlijke release: één full suite op de **uiteindelijke productcode**;
- bij FAST/STANDARD TEST-integratie: alleen gerichte checks en passende smoke, met expliciet besluit over resterende niet-kritieke OPEN-punten;
- na uitsluitend docs/versionmetadata: niet opnieuw;
- zodra ná een eerdere full suite nog productcode, UI-code, schema of runtimegedrag wijzigt, geldt die eerdere full-suite-GREEN niet automatisch als releasebewijs voor de nieuwe worktree.

## 3. Persona's

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

## 4. Test Auth versus normale OAuth

Test Auth:
- uitsluitend lokale development/test;
- fail-closed buiten lokale dev;
- nooit zichtbaar of bruikbaar op Vercel Production/Preview;
- mag geen rollen creëren of escaleren om een scenario groen te krijgen.
- Blijvende werkafspraak: bestaande synthetische TEST-accounts en hun beveiligd/geconfigureerde gebruikersnaam-wachtwoord mogen zonder nieuwe toestemmingsvraag via Test Auth en de bestaande role-switch worden gebruikt voor normale ontwikkel- en acceptatietests. Dit dekt in-/uitloggen, de gewone Supabase Auth-sessionhandelingen, wisselen naar bestaande Employee-, Manager- en HR Admin-identiteiten en geauthenticeerde read-only browser-, API- en documentcontroles.
- Dit is geen toestemming voor nieuwe accounts, rollen, rechten of fixtures, writes naar businessdata/schema, securitybypass of gebruik buiten de canonieke lokale TEST-runtime. Toon, log of commit nooit de inloggegevens, tokens, cookies of magic links; de accountmapping blijft in de beveiligde runtimeconfiguratie.

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

## 5. Synthetic testdata

- Gebruik synthetische, duidelijk herkenbare TEST-records.
- Gebruik geen echte persoonsgegevens in repositoryfixtures.
- Bestaande persoonlijke/representatieve bestanden worden vóór commit geanonimiseerd.
- Testrecords worden niet verwijderd wanneer append-only auditbewijs behouden moet blijven.
- Waar cleanup veilig onderdeel van het productcontract is: cleanup/neutralisatie na de run.
- Waar cleanup niet passend is: markeer records herkenbaar als synthetic acceptance fixture en documenteer ze.

## 6. Authorization matrix

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

## 7. Browser en API

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

**Browseromvang per route:** FAST controleert alleen de werkelijk gewijzigde zichtbare plek in één representatief formaat/thema, met zo nodig een tweede smalle viewport; STANDARD test de geraakte flow en relevante rollen; CONTROLLED gebruikt de risicorelevante volledige positieve/negatieve matrix. Geen verplichte reeks screenshots van alle bestaande pagina's, rollen en thema's bij een kleine brandingwijziging. Een runner zonder rapport is geen geslaagde browserassertion; registreer een niet-kritieke ontbrekende capture als OPEN waar de TEST-releaseflow dat toestaat.

**Vercel Preview:** uitsluitend verplicht wanneer het gekozen CONTROLLED-/PR-contract of de specifieke risicobeoordeling dat vraagt. Indien Preview vereist is, gebruik commit-specifieke Preview-URL en uitsluitend geïsoleerde Preview-scoped synthetische backends; leen nooit de gezamenlijke TEST-database. Ontbrekende Preview-inrichting blijft dan een omgevingsgrens. Voor geautoriseerde FAST/STANDARD-integratie rechtstreeks naar synthetische TEST geldt de gerichte lokale plus gehoste smoke volgens `AA-REL.md`. Test Auth blijft fail-closed buiten lokale development. Zie `docs/delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md`.

Exports:
- download echte output;
- parse het bestand;
- controleer rij-/scope-/filterpariteit;
- controleer content-type/formaat;
- controleer spreadsheet-formuleprefixbescherming waar relevant.

## 8. DB en concurrency

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

## 9. UI en i18n

Waar relevant:
- loading;
- error;
- empty;
- validation;
- permission;
- keyboard/focus;
- narrow/mobile viewport;
- NL/EN parity.

## 10. Payroll Lab / payroll engine

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

## 11. Full-suite beleid

Draai een volledige relevante hr-suite:
- bij CONTROLLED-convergence en formele/gezamenlijke releaseacceptatie;
- eerder alleen bij aantoonbaar brede shared-core blast radius;
- **niet** standaard bij ieder FAST/STANDARD-commit of iedere expliciet geautoriseerde synthetische TEST-push.

Als een full suite GREEN is op exact dezelfde productcode en daarna alleen docs/versionmetadata wijzigt:
- hergebruik het bewijs;
- draai hem niet opnieuw.

Als één ongerelateerde test timeout:
1. run geïsoleerd;
2. herhaal bounded;
3. bepaal flaky/performance/root cause;
4. voor een formele/CONTROLLED-release geldt de GREEN-gate van AA-REL; voor een geautoriseerde beperkte synthetische TEST-release rapporteer je de ongerelateerde afwijking expliciet als OPEN en pas je §8 AA-REL toe zonder tests kunstmatig groen te maken.

## 12. Acceptance verdicts

Volg `docs/quality/acceptance/REPORTING-STANDARD.md`.

- **GREEN**: alle in-scope verplichte assertions bewezen.
- **PARTIAL**: nuttig bewijs, maar verplichte assertion nog open.
- **BLOCKED**: veilige voortgang daadwerkelijk onmogelijk.
- **ENVIRONMENT-GATED**: productcode niet afgekeurd, maar bewijs door externe/runtimegrens niet beschikbaar.

Rapporteer alleen wat werkelijk is waargenomen.
