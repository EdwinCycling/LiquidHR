# T01-R acceptance — Survey, Personality/Team Compass en 9-grid

| Veld | Waarde |
|---|---|
| Datum | 2026-09-27 |
| Baseline | aa1bb386d5afb704611fbe0634f40c07090bbb73 |
| Productversie | 1.20260925.1 |
| Omgeving | Lokale acceptance-branch en bestaand Supabase TEST-project |
| TEST-project | wnpfloqpjvaacobppbpk |
| Branch | work/acceptance-T01R-20260927 |
| Implementatiecommit | aa01d864f7534c3590dfa8d4dd8ed0215548d89d |

## 1. Executive Summary

**Verdict: PARTIAL.** De complete lokale hr-suite, strict TypeScript, gewijzigde-bestanden-ESLint, i18n-controle en productiebuild slaagden. De gecontroleerde Survey-, Team Compass- en 9-grid-flows zijn in TEST uitgevoerd met synthetische T01-R-campagnes. Vier reproduceerbare UI-/logica-defecten zijn minimaal hersteld en kregen regressietests.

De re-acceptance is niet GREEN: een tweede Employee-persona en een out-of-scope Manager-account ontbraken; meerdere resultaat- en doelgroepvarianten vereisen meerdere veilige TEST-personen; de Manager-assignment is bewust niet met andere medewerkers gevuld; de aaneengesloten role-switch-cyclus en ACT-AS-stop via de zichtbare knop zijn niet volledig bewezen. De lokale ACT-AS-flow gebruikte een queryparameter voor het kortlevende token en de lokale Next-toegangslog registreerde URL-querystrings. Die transport-/loggingkeuze vraagt een afzonderlijke security-review.

Geen merge, push naar main, deployment, migration, ABS01-mutatie of productieactie uitgevoerd tijdens de acceptance. Alleen geïsoleerde T01-R-featuredata en één geautoriseerde ACT-AS START/STOP-auditcombinatie zijn geschreven.

| ID | Area | What broke | Why | Fix | Regression | Result |
|---|---|---|---|---|---|---|
| T01R-FIX-01 | Survey authoring / DropdownSelect | De zichtbare doelgroep-labelnaam werd vervangen door een generieke toegankelijkheidsnaam. | De fallback aria-label op basis van de placeholder overschreef de FormField-labelrelatie. | Behoud expliciete namen; gebruik de placeholder alleen zonder id of aria-labelledby. | Twee componenttests controleren FormField- en standalone-namen; NL-browserflow herhaald. | FIXED_DURING_RUN |
| T01R-FIX-02 | Survey authoring / DropdownSelect | De keuzelijst kon onderaan het scherm buiten beeld vallen. | De portal positioneerde altijd onder de trigger en begrensde positie/hoogte/breedte niet aan de viewport. | Deel een viewport-positioneringshelper die boven de trigger kan openen en menu-afmetingen begrenst. | Drie helpertests en browserretst van de lage trigger op desktop en 390 px. | FIXED_DURING_RUN |
| T01R-FIX-03 | Manager 9-grid / scorer | Een niet-opgeslagen scoreconcept kon bij een andere medewerker verschijnen; na refresh moest de nieuwe scoreversie worden gebruikt. | ManagerView hield lokale state vast terwijl de geselecteerde medewerker of server-scoreversie veranderde. | Remount ManagerView met campaign-, employee- en scoreversie als React-key. | Twee componenttests; browserselectie en twee saves op de gecontroleerde medewerker; DB-versie 7. | FIXED_DURING_RUN |
| T01R-FIX-04 | Manager 9-grid / assignment authorization | Een lopende assignment kon na start niet worden bewerkt. | De bewerkregel liet DRAFT, NOT_STARTED en RETURNED toe, maar miste de geldige IN_PROGRESS-status. | Sta IN_PROGRESS toe in de bestaande editregel; submitted blijft vergrendeld. | Statusregressie en twee manager-saves met HTTP 200. | FIXED_DURING_RUN |

## 2. Coverage

| Capability | Result | Evidence / boundary |
|---|---|---|
| HR Admin Survey authoring en activeren | PASS | Nieuwe anonieme Survey met titel, beschrijving, verplichte enkelvoudige keuze, optioneel tekstveld, doelgroep EMPLOYEES en één synthetische recipient; via bestaande UI geactiveerd. |
| Survey employee participation | PASS | Invite geopend, verplichte validatie en malformed payload geweigerd, één antwoord opgeslagen; herhaalde submit gaf 409. |
| Survey doelgroepvarianten | PARTIAL | Individual/EMPLOYEES met één recipient bewezen; all, department, team, function, group, multi-tenant en cross-HR-group varianten vereisten aanvullende geïsoleerde TEST-fixtures. |
| Survey resultaten en export | PARTIAL | HR-monitor en CSV bereikbaar; één response, aggregate antwoord en participation-indicator gecontroleerd. Averages, rounding, filters en kleine-cohortbeleid zijn met n=1 niet betekenisvol te accepteren. |
| Standalone Personality-product | NOT_APPLICABLE | In de huidige route-/module-inventarisatie is geen afzonderlijke Personality-assessment gevonden. Er is geen nieuw psychometrisch model of claim toegevoegd. |
| Team Compass employee self-assessment | PASS | Bestaande Team Compass-route, vragenlijst van 40 antwoorden, eigen profiel/resultaat en duplicate/incomplete-validatie gecontroleerd. |
| Team Compass manager/privacy | PARTIAL | Incomplete groep onder drempel 5 verbergt aggregates; manager write voor employee kreeg 403. Een geldig aggregate met meerdere profielen is niet bewijsbaar met één gecontroleerde respondent. |
| HR Admin 9-grid | PARTIAL | Campagne gestart, drie assignments en tien leden weergegeven; exacte unieke membership/population uit DB gelezen. Alle matrixcellen en historische gesloten review niet gevuld/getest. |
| Manager in-scope 9-grid | FIXED_DURING_RUN | Gecontroleerde medewerker selecteren, score opslaan, opnieuw opslaan met actuele versie, workspace verversen en mobiliteit gecontroleerd. |
| Manager out-of-scope 9-grid | PASS | Directe mutatie van een niet-lid gaf verhullende 404; geen score-row voor die medewerker. |
| Employee 9-grid | PASS | Employee-route geweigerd; er is geen eigen-resultaatzichtbaarheid toegevoegd. |
| Role switch | PARTIAL | HR Admin kon afzonderlijk Manager- en Employee-context openen; Manager/Employee konden niet naar hoger privilege wisselen. Een ononderbroken HR Admin → Manager → Employee → HR Admin-cyclus is niet met deze fail-closed UI beschikbaar. |
| ACT-AS | PARTIAL | HR Admin startte een Employee-subjectsessie en stopte deze via de bestaande API; manager-start geweigerd. Zichtbare Stop-knop gaf in browserrun geen waargenomen request. Querytoken-/logbeveiliging blijft review nodig hebben. |
| Full / Focus | PARTIAL | T01 beheerschermen zijn in Full gecontroleerd. Focus heeft geen equivalent voor Survey, Team Compass of 9-grid; relevante Focus ACT-AS-context is gecontroleerd. HR Admin /focus/team was niet beschikbaar. |
| Responsive en talen | PASS voor geteste routes | Desktop en 390×844 gecontroleerd op Survey, monitor, Team Compass en 9-grid; 9-grid documentbreedte bleef 390 px. HR Admin, Manager en Employee voorkeuren tijdelijk naar EN gezet en daarna naar NL hersteld. |
| Keyboard/accessibility sanity | PARTIAL | Accessible naamfout gerepareerd en zichtbaar label/regressie getest; geen volledige toetsenbord-/gridinteractie- of WCAG-certificering uitgevoerd. |
| Cross-feature koppelingen | NOT_APPLICABLE | Geen contractuele koppeling gevonden tussen Survey-resultaten, Team Compass-profielen en 9-grid-plaatsingen; geen koppeling verzonnen. Gedeelde employee-/team-scope is via bestaande routes en API-grenzen geraakt. |

## 3. Role Matrix

| Persona | Survey | Personality / Team Compass | 9-grid | Context/security result |
|---|---|---|---|---|
| HR ADMIN | Survey gemaakt/geactiveerd, monitor en export bereikbaar. | Campagne gestart; onder de drempel bleef teamprofiel verborgen. | Campagne gestart en roster/population gecontroleerd. | Directe test-role-switch naar Manager en Employee werkte; ACT-AS Employee-start en auditpad werkten. |
| MANAGER IN-SCOPE | Geen authoring-/adminformulier; monitor/export is niet manager-capability. | Eigen team bleef onder drempel; geen individuele profielen getoond. | Eigen assignment zag in-scope medewerker; score save/refresh werkte na fix. | Manager-toegang op medewerkerwrite in Team Compass kreeg 403. Focus team toonde geen ACT-AS-bediening. |
| MANAGER OUT-OF-SCOPE | Geen aparte tweede Manager-account beschikbaar. | Geen afzonderlijk out-of-scope-teamfixture beschikbaar. | Niet-lid kon niet worden gewijzigd; API gaf 404. | Manager kon geen ACT-AS start uitvoeren: 403. Cross-tenant en cross-HR-group tweede manager ontbreken als testpersonas. |
| EMPLOYEE SELF | Toegewezen Survey geopend en voltooid; tweede submit geweigerd. | Eigen Team Compass-assessment en resultaat bereikbaar. | 9-grid-toegang geweigerd. | Employee kon niet naar hogere testrol wisselen. |
| OTHER EMPLOYEE | Apart testaccount/credential ontbrak; geen geclaimde browserbewijsvoering. | Geen ander employee-profiel getoond via geteste manager-/thresholdroutes. | Forged/niet-toegewezen member mutation verhuld als 404. | Een tweede ingelogde Employee-persona en diens eigen-resultaat/response-probes zijn environment-gated. |
| ACT-AS | N.v.t. voor surveydeelname buiten eigen invite. | Employee-subject gestart door HR Admin; subjectroute en audit gecontroleerd. | Geen Manager-subject ACT-AS-capability waargenomen. | HR Admin-start toegestaan; Manager-start 403; HR Admin-stop API 200. Stop-knop zelf niet bewezen; actor en subject bleven in audit onderscheiden. |

## 4. Functional Results

### Survey

- T01-R-campagne T01R-20260927-001 Survey privacy acceptance is via de bestaande HR Admin UI gemaakt en geactiveerd met één specifieke synthetische medewerker als recipient. Andere audience-modi zijn niet als equivalent bewezen.
- De participantflow valideerde een ontbrekend verplicht antwoord met 400 RESEARCH_REQUIRED_ANSWER_MISSING, malformed answers met 400 RESEARCH_ANSWERS_INVALID, accepteerde de geldige submit met 201 en weigerde duplicaat met 409 RESEARCH_ALREADY_SUBMITTED.
- De HR monitor toonde de response/participatie en aggregate keuze. Manager kreeg geen authoring-/adminformulier; HR export was bereikbaar. De export had vier kolommen, waaronder een response identifier, en geen employee-name- of employee-id-kolom.
- De browserflow plus DB-readback bevestigde dat de anonieme response respondent_employee_id NULL heeft. In het resultaat werd wel participatie naast een aggregate antwoord getoond; zie Product Decisions.

### Personality / Team Compass

- Huidige productnaam en bestaande route zijn Team Compass. Er is geen afzonderlijk Personality-module of zelfstandige psychometrische route aangetroffen.
- Eén employee voltooide de bestaande Team Compass-vragenlijst met 40 antwoorden; eigen profiel/resultaat bevatte de bestaande niet-klinische context. Incomplete/ongeldige invoer gaf 400 TEAM_COMPASS_INPUT_INVALID; opnieuw indienen na afronden gaf 409 TEAM_COMPASS_RESPONSE_LOCKED.
- Manager zag dat nog vier voltooiingen nodig waren en kreeg geen aggregate profiel. Directe managerwrite naar een employee-response werd geweigerd met 403 TEAM_COMPASS_FORBIDDEN.

### 9-grid

- HR Admin startte een T01-R-campagne met drie assignments en tien unieke medewerkers.
- In-scope managerselectie, opslaan en verversen slaagden voor de gecontroleerde medewerker. De browser verstuurde na refresh de actuele versies 5 en 6; beide writes gaven 200. De opgeslagen record staat op versie 7.
- Ongeldige score gaf 400 TALENT_REVIEW_INPUT_INVALID; niet-lid mutatie gaf 404 TALENT_REVIEW_MEMBER_NOT_FOUND; stale version 1 gaf 409 TALENT_REVIEW_VERSION_CONFLICT.
- De assignment had nog 4 van 5 vereiste medewerkers zonder score. De assignment is daarom niet ingestuurd; andere medewerkers zijn niet beoordeeld om progressie kunstmatig te vullen.

## 5. Negative/Security Results

- Survey answer validation, duplicate submit, manager admin-boundary, Team Compass manager-write denial, 9-grid invalid enum, nonmember lookup concealment en stale-version conflict zijn direct via bestaande API’s getest.
- De enige Survey-response is anoniem opgeslagen: één response en nul gekoppelde respondent_employee_id-waarden. Export bevatte geen namen of employee-id’s.
- Team Compass-resultaten bleven onder drempel 5 verborgen; één completed profiel had sharing false/false. De manager kon geen persoonlijke antwoorden schrijven.
- 9-grid-campagnepopulatie had geen dubbele medewerker; de directe out-of-scope write maakte geen score-row aan. Employee 9-grid-route werd geweigerd.
- Role-switch liet geen Manager- of Employee-escalatie zien. De beveiliging werd niet verzwakt.
- Manager kon geen ACT-AS starten. Een eerder geautoriseerde HR Admin ACT-AS-sessie bleef actor/subject-gebonden; replay door Manager van het Employee-subject werd naar geen-toegang gestuurd. START/STOP-auditreadback nam toe van 6/2 naar 7/3.
- Risico: de bestaande kortlevende ACT-AS-credential gaat mee als actAs-queryparameter. De lokale Next access log bevatte URL-querystrings. De credentialwaarde is niet in dit rapport opgenomen. Transport via query en logredactie zijn niet gewijzigd in deze scope; zie Not Fixed.
- De laatste manager-browserrun had nul page errors en registreerde drie console-error-events; de probe bewaarde de exacte berichttekst niet, dus de oorzaak daarvan is niet geclassificeerd.
- Geen schema, migration, RLS of grants gewijzigd. Supabase advisors/typegen waren daarom niet van toepassing.

## 6. Mobile/Responsive Results

- Browserviewport 390×844 gebruikt voor Survey-respons, monitor, Team Compass-routes en manager-/HR 9-grid.
- Bij de finale manager 9-gridrun bleven viewport en document op 390 px; target selection, de twee manager saves en workspace refresh werkten. De low-trigger dropdown is ook in de browser opnieuw geopend na de positioneringsfix.
- Geen page errors in de finale 9-gridrun. Drie console-error-events zijn geteld maar niet bewaard; zie security/results en Not Fixed.
- De onderzochte schermen vertoonden geen horizontale overflow. Drag/drop over alle negen cellen op mobiel is niet met een volledige 9-cel-populatie bewezen.

## 7. Data/DB Readback

Alle databasecontroles zijn read-only SELECT op het bestaande TEST-project. Campagnes zijn niet verwijderd of gesloten; uitsluitend synthetische T01-R-featuredata is gebruikt.

| Feature | TEST-readback |
|---|---|
| Survey | ACTIVE; 1 uitnodiging, 1 submitted invitation, 1 response, 0 identified responses, 1 opgeslagen answer. respondent_employee_id is NULL. |
| Team Compass | ACTIVE; anonymity threshold 5; 1 participation, 1 completed, 40 answers, 1 profile; geen profielsharing. |
| 9-grid | ACTIVE; 3 assignments, 10 members, 10 unieke medewerkers, 0 dubbele membership, 1 score op NORMAL_NORMAL met versie 7, 9 expliciet unplaced. Geen score voor nonmember. |
| ACT-AS | Voor/na auditreadback: 6 START / 2 STOP → 7 START / 3 STOP; één extra START/STOP-paar. |

Geen employee-, employment-, absence-, leave- of payrollbedrijfsgegevens zijn gewijzigd. Locale voorkeuren van de gebruikte HR Admin-, Manager- en Employee-persona zijn voor de EN-canary teruggezet naar NL en server-side teruggelezen.

## 8. Quality Gates

| Gate | Result |
|---|---|
| Focused Talent Review regressie | 2 bestanden / 8 tests geslaagd. |
| Dropdown accessibility/positioning regressie | 2 bestanden / 5 tests geslaagd. |
| Volledige hr-suite tests | 463 bestanden / 1.834 tests geslaagd met testTimeout 30.000 ms. |
| Strict TypeScript | npm run type-check geslaagd. |
| Gewijzigde-bestanden-ESLint | Alle acht gewijzigde source- en testbestanden geslaagd. |
| i18n | 39 Nederlandse/Engelse namespaces hebben gelijke sleutels. |
| Productiebuild | Next.js 16.3.6 compileerde en genereerde 296 routes; build geslaagd. |
| Git diff check | Staged implementation-diff zonder whitespacefouten; documentatiediff wordt bij de docs-commit opnieuw gecontroleerd. |
| Supabase advisors/type generation | N.v.t.; geen schemawijziging. |

De installatie bracht 543 packages binnen. De npm-installatie-audit rapporteerde 5 dependencybevindingen (2 moderate, 3 high); manifests en lockfile zijn niet gewijzigd en er is geen audit-fix gedraaid. De werkende Node-versie was 22.14; @sparticuz/chromium declareert minimaal 22.17. De gebruikte browserflows slaagden met de beschikbare lokale browser, maar deze versieafwijking blijft een omgevingsbeperking.

## 9. Fixed During Run

| ID | Area | What broke | Why | Fix | Regression | Result |
|---|---|---|---|---|---|---|
| T01R-FIX-01 | Survey authoring | FormField-label was geen toegankelijke triggernaam. | Fallback aria-label op placeholder verdrong de zichtbare labelrelatie. | Respecteer id/aria-labelledby en behoud expliciete standalone aria-labels. | Twee componenttests; authoringbrowser opnieuw gecontroleerd. | FIXED_DURING_RUN |
| T01R-FIX-02 | Survey authoring | Keuzemenu viel buiten viewport. | Alleen vaste onderpositie, zonder viewport-fit. | Boven/onder kiezen en hoogte/breedte/positie begrenzen. | Drie unitgevallen plus desktop/mobiele browserretst. | FIXED_DURING_RUN |
| T01R-FIX-03 | Manager 9-grid | Draft lekte tussen geselecteerde medewerkers; serverversie was niet synchroon met de lokale editor. | useState initializer liep niet opnieuw bij andere selection/scoreprops. | Remount op campagne, medewerker en scoreversie. | Twee componenttests; twee browser saves op actuele versies; readback versie 7. | FIXED_DURING_RUN |
| T01R-FIX-04 | 9-grid assignmentregels | IN_PROGRESS-workflow kon niet worden bewerkt. | Status ontbrak uit bestaande toestemmingsallowlist. | IN_PROGRESS aan bestaande editregel toegevoegd. | Statusregressie en manager-save browserhertest. | FIXED_DURING_RUN |

### T01R-FIX-01 — Dropdown accessible name

- **Module/route:** generieke DropdownSelect; Survey authoring.
- **Persona:** HR ADMIN.
- **Symptom/classificatie:** schermlezernaam volgde de generieke placeholder in plaats van de zichtbare FormField-label; accessibility defect in shared component.
- **Technische root cause:** de standaard aria-label werd ook gezet wanneer het button-element al een id of aria-labelledby had.
- **Waarom vorige tests dit misten:** tests valideerden selectie/waarde, niet de toegankelijke naam bij een zichtbare FormField-label.
- **Wijziging/fix:** alleen de fallbacknaam zetten als geen zichtbare labelrelatie bestaat; een expliciete standalone aria-label blijft gelden.
- **Bestanden/migraties:** components/ui/dropdown-select.tsx en dropdown-select.test.tsx; geen migration.
- **TEST-data/config:** geen DB-, feature- of configuration change.
- **Regression/retest:** 2 componenttests en Survey authoringbrowser hertest; gewijzigde ESLint, strict TypeScript en volledige suite groen.
- **Downstream recheck:** Survey doelgroepformulier, dropdown-menu geometry, 9-grid-selectors, i18n en build.
- **Security/privacy impact:** geen authorization- of datatoegangswijziging; accessible label hersteld.
- **Bedoeld gedrag:** herstel van zichtbaar labelgedrag, geen nieuwe productfeature.
- **Commit SHA:** aa01d864f7534c3590dfa8d4dd8ed0215548d89d.
- **Preventieles:** test de exposed triggernaam wanneer een gedeelde control via FormField wordt gelabeld.

### T01R-FIX-02 — Dropdown viewport position

- **Module/route:** generieke DropdownSelect portal; Survey authoring.
- **Persona:** HR ADMIN.
- **Symptom/classificatie:** onderste controls konden een keuzelijst openen waarvan de opties buiten beeld vielen; responsive/usability defect.
- **Technische root cause:** menu-top was altijd trigger-bottom plus gap; viewport-randen, beschikbare ruimte en menuhoogte waren niet meegenomen.
- **Waarom vorige tests dit misten:** bestaande suite dekte waarden en keyboard-state, maar geen lage viewport-trigger met werkelijk portal-geometrie.
- **Wijziging/fix:** geïsoleerde positioneringshelper kiest boven/onder, clamped menu-breedte, top en maxHeight; scroll/resize/query herpositioneert.
- **Bestanden/migraties:** components/ui/dropdown-select.tsx, components/ui/dropdown-menu-position.ts en dropdown-menu-position.test.ts; geen migration.
- **TEST-data/config:** geen DB-, feature- of configuration change.
- **Regression/retest:** drie helpertests; desktop lage trigger opnieuw geopend; 390×844 routebreedte geverifieerd; volledige build groen.
- **Downstream recheck:** Survey authoring, Team Compass selectors en 9-grid score-controls.
- **Security/privacy impact:** geen.
- **Bedoeld gedrag:** herstel van bruikbare keuzelijsten binnen de viewport, geen nieuwe businessregel.
- **Commit SHA:** aa01d864f7534c3590dfa8d4dd8ed0215548d89d.
- **Preventieles:** positioneer geportaleerde menu’s op basis van viewport en test minstens een viewport-randgeval.

### T01R-FIX-03 — Manager score draft selection/version

- **Module/route:** TalentReviewWorkspace ManagerView; /workforce/9-grid.
- **Persona:** MANAGER IN-SCOPE.
- **Symptom/classificatie:** niet-opgeslagen scores van medewerker A bleven staan nadat medewerker B werd geselecteerd; refresh moest de meest recente serverversie gebruiken. Data-integriteits-/UX-defect.
- **Technische root cause:** lokale draftstate gebruikte geselecteerde score alleen als initializer en bleef behouden terwijl geselecteerde medewerker of scoreversie veranderde.
- **Waarom vorige tests dit misten:** unit coverage controleerde save-validatie maar selecteerde geen tweede medewerker terwijl er een onverzonden draft bestond.
- **Wijziging/fix:** ManagerView krijgt een stabiele key van campagne, selected employee en selected score version; state wordt bij een contextwissel opnieuw geïnitialiseerd uit de actuele score.
- **Bestanden/migraties:** components/talent/talent-review-workspace.tsx en talent-review-workspace.test.tsx; geen migration.
- **TEST-data/config:** één gecontroleerde T01-R-medewerker tweemaal opgeslagen; geen andere medewerker beoordeeld.
- **Regression/retest:** twee componenttests; browser selecteerde gecontroleerd doel na draft op andere medewerker; twee saves HTTP 200 met versies 5 en 6; DB readback versienummer 7.
- **Downstream recheck:** Manager assignment, score update API, stale-version 409, HR 9-grid en mobiel 390×844.
- **Security/privacy impact:** voorkomt onbedoeld tonen/opslaan van een andere medewerkerdraft; geen nieuwe scope of permission.
- **Bedoeld gedrag:** herstel van medewerkergebonden editorstate en bestaande optimistic concurrency.
- **Commit SHA:** aa01d864f7534c3590dfa8d4dd8ed0215548d89d.
- **Preventieles:** wanneer lokale editorstate door serverprops wordt begrensd, test expliciet entitywissel en versie-refresh.

### T01R-FIX-04 — IN_PROGRESS assignment editable

- **Module/route:** Talent Review editregel; manager 9-grid score-save.
- **Persona:** MANAGER IN-SCOPE.
- **Symptom/classificatie:** manager kon een gestart werkpakket met status IN_PROGRESS niet opslaan; workflow defect.
- **Technische root cause:** canEditTalentReviewAssignment stond NOT_STARTED, DRAFT en RETURNED toe, maar niet de bestaande IN_PROGRESS-status.
- **Waarom vorige tests dit misten:** statusregeltest controleerde draft/returned en submitted, niet de gestartte assignment tussen die states.
- **Wijziging/fix:** IN_PROGRESS toegevoegd aan de bestaande bewerkbare statussen; SUBMITTED blijft immutable.
- **Bestanden/migraties:** lib/talent-review/rules.ts en rules.test.ts; geen migration.
- **TEST-data/config:** bestaande T01-R-assignment veranderde via normale workflowstatus; geen schemawijziging.
- **Regression/retest:** directe statusregressie plus manager browser save/refresh 200 en stale-version 409.
- **Downstream recheck:** manager in-scope 9-grid, API score-write, assignment progress en DB scorereadback.
- **Security/privacy impact:** geen rol/scopeverbreding; alleen een bestaand actief assignment lifecycle-pad kan bewerken.
- **Bedoeld gedrag:** herstel van bestaand workflowgedrag, geen nieuwe productregel.
- **Commit SHA:** aa01d864f7534c3590dfa8d4dd8ed0215548d89d.
- **Preventieles:** lifecycle-allowlists moeten elke bestaande niet-terminale status expliciet afdekken.

## 10. ENVIRONMENT-GATED

- Andere Employee login/persona en tweede out-of-scope Manager-account waren niet beschikbaar. Daarom zijn cross-tenant/cross-HR-group en other-employee read/result-denial niet als een volledig persona-paar geclaimd.
- Survey UI/API werd met één employee-target getest; doelgroepmodi all/department/team/function/group en meerdere HR groups/tenants vragen gecontroleerde aanvullende TEST-personen.
- Team Compass vereist 5 voltooiingen voor aggregate. Met één gecontroleerde respondent kon alleen de onder-drempel-privacygrens bewezen worden; geen synthetic extra profielen aangemaakt om een aggregate te forceren.
- Manager 9-grid assignment wacht op 4 van 5 beoordeelde medewerkers. Alleen de geautoriseerde gecontroleerde medewerker is beoordeeld; de resterende gridcellen, minimum/maximumscores, submit, history en closed-review read-only zijn daardoor niet volledig geaccepteerd.
- Uninterrupted test-role-switch-cyclus is niet beschikbaar nadat de context naar Manager gaat: de bestaande test-role-switch-bediening is daar verborgen en Employee kan niet escaleren.
- ACT-AS Stop-knop werd zichtbaar, maar de browser nam geen stoprequest waar binnen het observatievenster; de bestaande stop-API retourneerde wel 200 en auditreadback klopte.
- Consoleprobe telde drie errors zonder de messages te bewaren. Geen JS pageerror, maar die console events zijn hierdoor niet inhoudelijk geclassificeerd.
- Lokale package/browser mismatch: project-runtime Node 22.14 tegenover @sparticuz/chromium minimum 22.17. De uitgevoerde browser- en buildcontroles slaagden met de aanwezige browser.

## 11. PRODUCT DECISIONS

- Een anonieme Survey met n=1 toont momenteel participation count/badge naast de aggregate antwoordwaarde. Database response heeft geen employee-id en CSV bevat geen naam-/employee-id-kolom, maar een gebruiker kan het antwoord uit kleine-n aggregaat afleiden. Requirements definiëren geen minimum-anonimiteitscohort voor Survey. Productowner moet kiezen of Survey-resultaten onder een kleine n-grens worden onderdrukt; deze run introduceert die regel niet.
- De geïmplementeerde personality-gerelateerde capability heet Team Compass en gebruikt de bestaande 40-vragen-workflow. Er is geen los Personality-product gevonden; deze acceptance voegt geen psychometrische claims of alternatieve scoreinterpretatie toe.
- Manager/Employee-contexten bieden geen vrije privilege-switch of Manager ACT-AS-start in deze scope. De bestaande fail-closed UI/API is behouden; er is geen permission toegevoegd.

## 12. NOT FIXED

- **ACT-AS credential in query/log:** local access logging bevat querystrings terwijl ACT-AS een kortlevende credential in actAs draagt. Architectuurwijziging/transport- en logredactie vallen buiten de kleine T01-R-reparaties. Aanbevolen vervolg: security review van URL-, browser-history-, referrer- en logblootstelling en ontwerp van een actor-/subject-gebonden alternatief plus redactie, met gerichte regressies vóór aanpassing.
- **Stop-control browserbewijs:** Stop-knop was zichtbaar, maar browserrequest niet waargenomen. API-stop en auditreadback slaagden. Vervolg: na hydration in de gecontroleerde browser de klik en terugkeer naar actorcontext bewijzen.
- **Three unclassified console errors:** probe bewaarde alleen het aantal. Vervolg: read-only reproduceerbare routeprobes die berichten verzamelen zonder ACT-AS-query of extra scorewrites.
- **Kleine-n Survey privacy threshold:** productbeslissing vereist; geen codepolicy geforceerd.
- **Scope-uitbreiding fixtures:** geen andere employee, tweede manager, multi-profile Team Compass of meer scoring van ongerelateerde medewerkers toegevoegd.

## 13. LESSONS/PATTERNS

- Hergebruik van een gedeelde dropdown vraagt controle van accessible-name en viewport-positionering in de echte portal, niet alleen een option-select test.
- Voor entitygebonden drafts is een geselecteerde entity/version boundary nodig; de parent kan serverversie expliciet als remount identity doorgeven zonder derived-state-effect.
- Een assignment die via start IN_PROGRESS wordt, moet in zowel UI- als service-rules bewerkbaar blijven tot submitted.
- Gebruik bij anonieme uitkomsten de DB-readback én exportcontract; anonymity van een response voorkomt niet dat een eenpersoonsaggregaat het antwoord afleidbaar maakt.
- Een partial report houdt bewezen route-/API-resultaten gescheiden van ontbrekende personas, productbeleid en onbewezen UI-requestgedrag.

## 14. Commits/Remote Head

- Baseline: aa1bb386d5afb704611fbe0634f40c07090bbb73.
- T01-R implementation commit: aa01d864f7534c3590dfa8d4dd8ed0215548d89d op work/acceptance-T01R-20260927.
- Acceptance report, run-log en CURRENT_CONTEXT checkpoint staan in een aparte documentatiecommit op dezelfde branch.
- Alleen de T01-R branch wordt gepubliceerd; geen merge naar main of deployment. De exacte final branch tip en remote readback staan ook in de taakafronding.

## 15. Final Verdict

**PARTIAL — T01-R fixes and local quality gates are GREEN; complete acceptance is not GREEN.**

De codeproblemen zijn gefixt en geregreseerd. Re-acceptance blijft gedeeltelijk door ontbrekende persona-/cohort-fixtures, ongevulde managerassignment, niet-waargenomen browserstoprequest, ongeclassificeerde browserconsole events, de kleine-n productkeuze en ACT-AS tokentransport/logging-review. Baseline main, Vercel en ABS01 bleven buiten scope.
