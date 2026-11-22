# LiquidHR — Gesprekscycli / Performance Reviews — MVP (P1)

**Document:** PERF-MVP-01 · **versie:** 1.0 · **datum:** 2026-11-22  
**Status:** GOEDGEKEURD FUNCTIONEEL SCOPEONTWERP / NOG NIET GEBOUWD OF GEACCEPTEERD  
**Bron:** productbesluiten Edwin 22 november 2026, consolidatie van functionele ontwerpen v0.1–v0.4.  
**Gerelateerde uitvoering:** [PERF-MVP-01 Codex-runbook](../../delivery/PERF-MVP-01-CODEX-20261122.md).

## 0. Leesvolgorde en gezag

Dit is de **leidende P1-functionele productspecificatie** voor het bouwen van de gespreksmodule. Eerdere concepten in de chats zijn superseded waar zij afwijken. Raadpleeg eerst AGENTS.md, docs/AA/AA-CURRENT.md en docs/AA/AA-README.md; vervolgens de relevante AA-OP, AA-TEST, AA-REL, AA-REQ, AA-ACCEPT, UX Foundation en dit document. Bij strijd prevaleren security, privacy en de expliciete actuele opdracht.

**P0 blijft onafhankelijk OPEN:** hosted rol-/RLS-acceptatie, SEC-101 onafhankelijke andere-tenantproef, rollback en Payroll-migratiebron. P1 functioneel ontwerpen en lokaal bouwen is geen automatische P0-acceptatie, remote migratie-, integratie- of releasevrijgave. Vercel is synthetic TEST, niet commerciële productie. Geen onverwachte deployment.

## 1. Doel, terminologie en ontwerpprincipes

Een HR Admin start een **gespreksronde** voor één, meerdere of een gefilterde groep medewerkers. Per deelnemer ontstaat exact één **gespreksdossier** in deze ronde. De medewerker schrijft een zelfreflectie, de bevoegde manager schrijft een reactie en optioneel een formele beoordeling, waarna de medewerker akkoord of gemotiveerd voor gezien/niet akkoord bevestigt. Het dossier wordt dan afgerond.

**V1 is bewust minimaal in de inhoud:** maximaal één vrij tekstveld voor de medewerker en één voor de manager; geen verplichte vragenset, geen peer-/360-feedback of dialogische pingpong.

**Twee gescheiden bronobjecten:** de ronde beheert doelgroep, instellingen en globale afsluiting; het dossier beheert de eigen workflowstatus en historie. Formele gespreksinhoud is NIET hetzelfde als de transparante Continuous Appraisal-tijdlijn. Gebruik bestaande Core HR, PMUX/work items, Storage/documentpatronen, Talent, audit en UX Foundation; geen dubbele proces-/taken-/notificatie-/medewerker-engine.

## 2. Reikwijdte en definities

- **Ronde:** campagne met titel, type, inleiding, terug-/vooruitkijkperiode, start, streefdatum, optionele beoordelingsconfiguratie, deelnemers en rondestatus.
- **Gespreksdossier:** medewerker/ronde-combinatie, toegewezen reviewer, reactieteksten, beoordeling, documenten, bevestiging, intern veld en status-/auditgeschiedenis.
- **Gespreksperiode:** inhoudelijke periode waarop het gesprek betrekking heeft; verschillend van planning.
- **Startdatum:** moment vanaf wanneer taken actief worden; toekomstig starten mogelijk.
- **Streefdatum:** *zachte* gewenste afrondingsdatum, nooit een blokkering of automatische sluiting.
- **Gespreksdatum:** optioneel datumveld van de manager, niet vereist om in te dienen.
- **Manager:** daadwerkelijk bevoegd toegewezen reviewer, binnen effectieve team-/employee-scope, geen willekeurig ID uit clientinput.
- **HR Admin:** expliciet bevoegde HR-beheerpersona met brede read-scope en rondebeheer; een generieke technische Tenant Admin krijgt niet vanzelf toegang tot vertrouwelijke inhoud.
- **Concept versus definitief:** een concept is alleen voor zijn auteur, een definitief ingediend onderdeel is onveranderbaar.
- **Ronde sluiten:** alle nog openstaande dossiers bevriezen read-only zonder hun oorspronkelijke status te vervalsen.

## 3. MUST HAVE — ronde-inrichting en selectie

De HR Admin kan in de bestaande Workforce-omgeving een ronde aanmaken met:
1. Verplichte titel en verplichte beschrijving/aanhef (getoond aan deelnemers).
2. Gesprekstype, zoals functioneren, beoordelen, ontwikkeling, terugkijken, vooruitkijken, tussentijds of zelf benoemd; type is informatief, geen verborgen logica.
3. Inhoudelijke periode van/tot met validatie van volgorde; datumvelden mogen niet verwisseld worden.
4. Startdatum onmiddellijk of toekomstig; zachte streefdatum met duidelijke waarschuwing bij onlogische volgorde.
5. Beoordeling ja/nee. Zo ja: vier-, vijf- of tienpuntsschaal met bedrijfseigen labels en omschrijvingen per score; de schaal is **immutable snapshot per ronde**.
6. Selectie van alle actieve medewerkers binnen de bevoegde context of specifieke medewerkers via filters op naam, HR-groep, administratie, afdeling, functie, locatie, manager en dienstverbandstatus; selectie is expliciet, met preview van aantal medewerkers en betrokken managers.
7. Actieve medewerkers standaard; eventuele inactieve medewerkers alleen indien expliciet geselecteerd, geautoriseerd en inhoudelijk passend.
8. Toon en blokkeer ambiguïteit: ontbrekende manager/reviewer, ongeldige employee/HR-context, duplicaat binnen ronde, niet-beschikbare identiteit of een ongeldige autorisatie. HR kan een bestaande bevoegde reviewer aanwijzen waar de organisatiegegevens geen eenduidige manager geven.
9. Meerdere dienstverbanden: **één dossier per employee/ronde**, niet per IKV/dienstverband; HR-context wordt expliciet vastgelegd en veilig gevalideerd.
10. Concept bewaren, geplande ronde publiceren, actieve ronde starten. Publicatie is idempotent, bulkacties maken geen dubbele dossiers of notificaties.

**Later toevoegen:** HR Admin mag in een **actieve** ronde individuele medewerkers toevoegen, met dezelfde rondeconfiguratie, status 'wacht op medewerker' en nieuwe eigen taak; bestaande dossiers blijven ongewijzigd. Als de streefdatum is verstreken, waarschuw maar blokkeer niet. Geen toevoegingen aan gesloten/geannuleerde rondes. Alle toevoegingen krijgen audit: wie/wanneer/waarom en deduplicatie.

Na publicatie geen wijziging van de inhoudelijke beoordelingsschaal, het al uitgegeven gesprekstype/tekst of de terugkijkperiode voor bestaande dossiers. Alleen een expliciet geautoriseerde, geauditeerde operationele correctie zoals streefdatumverschuiving mag zonder retroactieve betekeniswijziging.

## 4. MUST HAVE — proces per medewerker

### 4.1 Zelfreflectie door medewerker

- Toon titel, inleiding, periode en streefdatum.
- Eén verplicht vrij tekstveld; bewaar concept en definitief indienen.
- Concept is privé voor de medewerker, ook niet zichtbaar voor de manager/HR Admin via gewone reads of exports.
- Definitieve zelfreflectie is immutable; versturen doet taak medewerker af en creëert/activeert de managerstap.
- Server valideert identiteit, medewerker/dossier, fase, versie en idempotency-key.

### 4.2 Managerreactie

- Manager ziet pas na indiening de zelfreflectie.
- Eén verplicht tekstveld voor reactie, concept opslaan en definitief indienen.
- Een **optionele** gespreksdatum.
- Als beoordeling aanstaat: verplichte gekozen score binnen het ronde-snapshot en verplichte schriftelijke onderbouwing. Als beoordeling uitstaat: geen score-/onderbouwingsvelden in UI of API-payload.
- **Documenten:** manager kan vóór zijn definitieve indiening meerdere PDF- of Word-bestanden toevoegen (bijv. gespreksverslag), inzien, vervangen/verwijderen binnen conceptfase. Na definitieve indiening zijn de ingediende bijlagen immutable, en zichtbaar voor de medewerker in dossier/documentsectie. Medewerker: alleen lezen/downloaden, nooit upload/vervang/verwijder.
- **Interne informatie:** afzonderlijke optionele informatie/notitie voor bevoegde manager en HR Admin. Geen onderdeel van managerreactie, gedeelde bijlagen, beoordeling of bevestiging. Versies en auteurs auditbaar. Tijdens actieve ronde mag alleen een bevoegde actor dit veld wijzigen, óók nadat de openbare managerreactie definitief is verstuurd; bij gesloten ronde uitsluitend lezen. Niet opnemen in gedeelde timeline, medewerkerexports, samenvattingen of AI-context.
- Definitief managerversturen vergrendelt reactie, score, toelichting, gespreksdatum en gedeelde documentset, activeert medewerkerbevestiging.

### 4.3 Bevestiging door medewerker

De medewerker ziet de definitieve managerreactie, eigen reflectie, eventuele score/toelichting, gespreksdatum en gedeelde bijlagen. Twee acties:
- **Akkoord:** eindstatus AFGEROND_AKKOORD, met actor en timestamp; instemming met inhoud.
- **Voor gezien — niet akkoord:** verplichte tekstuele motivatie, eindstatus AFGEROND_NIET_AKKOORD; dit bevestigt ontvangst zonder inhoudelijke instemming. Reden is append-only, niet een revisie van de managerreactie.

Na beide eindacties worden publieke gespreksonderdelen en de individuele workflow definitief read-only; interne informatie blijft alleen gedurende de actieve ronde volgens §4.2 aanpasbaar. Geen opnieuw indienen, pingpong, weigering ontvangstbevestiging of tweede beoordelingsroute.

**Niet-akkoord-document/formele bezwaaraanvulling:** **V1 buiten scope**. V2 eventueel aparte immutable bijlage/bezwaarroute na expliciet productbesluit.

## 5. Statussen, transities en tijd

**Ronde:** CONCEPT → GEPLAND → ACTIEF → GESLOTEN; CONCEPT/GEPLAND/ACTIEF → GEANNULEERD indien veilige, geauditeerde annulering. De exacte annulering van reeds ingediende gesprekken bewaart historie en verwijdert geen inhoud. GEPLAND wordt op de startdatum actief via bestaande scheduler, fail-closed en idempotent.

**Dossier:** WACHT_OP_MEDEWERKER → WACHT_OP_MANAGER → WACHT_OP_BEVESTIGING → AFGEROND_AKKOORD of AFGEROND_NIET_AKKOORD.

**Te laat** is een afgeleide indicator van streefdatum en onvoltooide status, nooit een blocking state of automatische negatieve beoordeling.

**HR sluit een ronde voortijdig:** toon vooraf aantallen per status, vraag bevestiging plus verplichte administratieve reden; leg actor/tijdstip en snapshot vast; zet ronde op GESLOTEN; sluit/invalideert alle nog openstaande PMUX-werktaken, reminders en toekomstige acties; **behoud per dossier de laatste echte workflowstatus** en markeer het met een apart read-only/closed-by-round-kenmerk. Geen openstaande taken meer uitvoerbaar. Een dossier dat op manager wacht blijft in rapportage 'wacht op manager, ronde gesloten', niet 'afgerond'. Niet-gepubliceerde concepten blijven verborgen. Heropenen en nieuw toevoegen na sluiten niet toegestaan in V1.

**Idempotentie/concurrency:** dubbele start, dubbele submit, dubbele bestandsaanmaak, gelijktijdige revieweractie, sluiting tijdens submit en retries zijn transactieve, fail-closed en geauditeerde situaties. Gebruik optimistic locking en bestaande RPC/servicepatronen, geen client-updated statuskolom.

## 6. Rollen en zichtbaarheid

| Gebied | Medewerker | Bevoegde manager | HR Admin |
| --- | --- | --- | --- |
| Ronde creëren/configureren/sluiten/deelnemers toevoegen | Nee | Nee | Ja, eigen HR-context |
| Eigen zelfreflectieconcept | Alleen auteur | Nee | Nee |
| Definitieve zelfreflectie | Eigen | Alleen toegewezen dossier | Binnen HR-context |
| Managerreactieconcept | Nee | Alleen auteur | Nee |
| Definitieve managerreactie/score | Eigen, na managerindiening | Toegewezen dossier | Binnen HR-context |
| Managerdocumenten vóór managerindiening | Nee | Upload/lezen/vervangen vóór submit | Niet standaard concept-inzage |
| Definitieve managerdocumenten | Alleen eigen, lezen | Lezen | Lezen binnen HR-context |
| Intern informatieveld | **NOOIT** | Lezen/schrijven eigen geautoriseerde dossiers | Lezen/schrijven binnen HR-context |
| Bevestiging | Eigen indiening/lezen | Lezen | Lezen |
| Voortgang | Eigen | Direct team/toegewezen | Geautoriseerde HR-context |
| Document- en bestandsdownload | Eigen, na indiening | Toegewezen | HR-context |

**Security-invarianten:**
- Rollen worden expliciet vertaald naar canonieke permissions. Een generieke tenantbrede platformrol is niet automatisch HR Admin met toegang tot private performance-inhoud. Wel moet de bestaande TEST-persona 'hr-admin' via legitieme, aantoonbare HR-permissies de functie kunnen gebruiken; geen globale privilegeverruiming.
- Tenant, HR-groep, administratie, medewerker, effectieve managerrelatie/reviewertoewijzing en procesfase gelden voor **ieder** SQL-/API-/Storage-/PDF-/exportpad.
- Zelfde dossierlink levert voor elke rol uitsluitend toegestane projectie. Private veld en concepten worden **niet geselecteerd en niet geserialiseerd** in employee/algemene GET-responses; niet alleen verbergen in React.
- Gescheiden beveiligde private-note-entiteit/RPC of equivalent, expliciete serverpermissie en RLS; negatief testen op response-body, JSON-bulk, documentbron, exports, dashboard, notificaties, tijdlijn en AI.
- Managerwissel: openstaande revieweractie uitsluitend via gecontroleerde toewijzing aan bevoegde nieuwe manager; oorspronkelijke auteurs en reeds ingediende inhoud immutable. Nieuwe manager krijgt historische scope niet automatisch; pas toegang toe volgens bestaande Continuous Appraisal-handovergrenzen en specifiek geautoriseerde gespreksreviews. Vorige manager verliest actieve toegang wanneer bevoegdheid eindigt.
- HR/manager-notitie is vertrouwelijk in de **gewone applicatie**, geen garantie dat wettelijke AVG-inzageverzoeken uitgesloten zijn. Niet gebruiken voor medische gegevens, ongecontroleerde profilering of verboden persoonsgegevens.

## 7. Documenten, opslag en privacy

Herbruik bestaande veilige documentregels, file-signaturevalidatie en private Supabase Storage. V1 staat PDF, DOC en DOCX toe; geen macro-enabled DOCM, executable of HTML. Gebruik de bestaande maximumgrenzen (momenteel 25 MiB per document), checksum, gebruikers-/dossier-/tenant-bound storage key, bestandstype-/inhoudssignatuurcheck, veilige bestandsnaam, virus-/malwarecontrole indien ondersteunde voorziening aanwezig, en strikt beveiligde file-preview/download. **Verzin geen malwarescan-PASS** wanneer de voorziening ontbreekt; registreer expliciet de veiligheidsgrens.

Bestanden behoren tot het formele gespreksdossier, niet automatisch tot de algemene employee-documentenlijst. Er mag hooguit een autorisatiegetoetste verwijzing naar het dossier bestaan; geen tweede blob of andere ACL. Geen publiek toegankelijke bestandslinks. Na managerindiening zijn gedeelde bijlagen onveranderbaar; bij fouten kan een aparte latere geauditeerde aanvulling worden ontworpen (buiten V1).

Audit: start, doelgroep, toevoegingen, assignments, concept→indiening, score-snapshot, upload/delete vóór indiening, downloads waar productbeleid dat vraagt, bevestiging, private-note-versies, sluiting en fouten zonder documentinhoud of geheimen in gewone logs. Bestaande beleid voor retentie, archiveren en AVG-verzoeken volgen; geen hard-coded onbeperkte bewaartermijn. Log geen volledige beoordelings- of privénotitieteksten.

## 8. Continuous Appraisal — gekoppeld, niet gedupliceerd

Bestaande canonieke module: docs/requirements/Talent/10-LiquidHR-Continuous-Appraisal-Requirements.md; routes /my-appraisal en /workforce/continuous-appraisal. Dat is een **transparante gedeelde tijdlijn**; geen geheime managerlaag en geen formele beoordelingsengine.

**MUST V1:**
1. In het gesprek sectie 'Gerelateerde ontwikkeling': lees en link **bestaande** voor medewerker en manager geautoriseerde gedeelde Continuous Appraisal-items (doelen, acties, afspraken, feedback). Persistente bron-ID verwijzing (many-to-many indien nodig); geen data-kopie.
2. Een dossier kan navigeren naar het oorspronkelijke item; de bronautoriteit controleert iedere read opnieuw. Een link verleent geen extra leesrechten.
3. Vanuit de gedeelde tijdlijn kan, als de bestaande UI dat veilig ondersteunt, een neutrale verwijzing naar een afgerond gesprek beschikbaar zijn. Toon nooit interne notities, score, concept of bijlagen in de tijdlijn. Is dat niet veilig haalbaar, implementeer alleen de inhoudsloze beveiligde backlink en documenteer deze beperking.
4. Het bestaande item kan een eigen lifecycle behouden, ook als de ronde later is gesloten; link verandert geen ownership of status.

**SHOULD V2:** vanuit gesprek nieuwe ontwikkelafspraken/doelen creëren in bestaande Continuous Appraisal en opvolging in volgende ronde; geen tweede actie-engine.

**COULD V3:** optionele AI-voorbereiding met uitsluitend per actor geautoriseerde, transparante context en menselijk akkoord. Geen AI-bepaalde beoordeling/HR-beslissing.

## 9. Navigatie en dashboard (allemaal MUST V1)

**Gebruik de huidige appnavigatie** in apps/hr-suite/components/layout/sidebar.tsx en sidebar-navigation.ts, startpagina apps/hr-suite/app/(dashboard)/dashboard/start, bestaande centrale /work en medewerkerkaart /employees/[employeeId]. Geen parallelle startpagina, sidebar of werkvoorraad.

### HR Admin
- Workforce → Gesprekken → Gespreksrondes; submenu/tabs **Rondes**, **Alle gesprekken** en knop **Nieuwe gespreksronde**.
- Organisatiedashboardwidget 'Gespreksrondes': actieve rondes, aantallen medewerkers, afgerond, wacht op medewerker/manager/bevestiging, te laat; korte top-rondeprogressie en acties. Tellingen zijn geautoriseerd/gefilterd op context; geen tekst, score of vertrouwelijke note in dashboardpayload.
- Ronde detail: voortgang + filterbare tabel (naam, afdeling, reviewer, status, zachte deadline, laatste actie), deelnemers toevoegen, administratief sluiten, dossiers openen.

### Manager
- Workforce → Gesprekken → **Mijn team**; tabs openstaand/alle/afgerond en aparte link **Mijn gesprekken** als medewerker.
- Teamdashboardwidget: aantal eigen manageracties, bij medewerkers, wacht op bevestiging, afgerond, te laat en maximaal enkele relevante medewerkers.
- Klik opent dezelfde individuele gespreksdossier-URL; taken verschijnen ook in bestaande /work. Manager kan geen ronde beheren of collega's buiten scope zien.

### Medewerker
- Workforce/persoonlijke Talent-omgeving → **Mijn gesprekken**; daarnaast dashboardwidget 'Mijn gesprek' en bestaande /work.
- Widget toont belangrijkste openstaande actie met ronde, periode, zachte deadline, status en actie; bij meerdere gesprekken link 'Alle gesprekken'. Geen teaminformatie.

### Medewerkerkaart
- Nieuwe aparte **Gesprekken**-tab op /employees/[employeeId] met lijst van eigen/manager-/HR-geautoriseerde historische en actuele dossiers; ook zonder Talent Passport-permissie.
- Kolommen: titel, periode, manager, status, deadline, eventuele **reeds gedeelde** definitieve score en datum afronding. Bij ronde gesloten terwijl dossier onvoltooid: 'Ronde gesloten — wacht op manager' of equivalent, niet 'afgerond'.
- Het individuele dossier heeft **Overzicht**, **Gespreksinhoud**, **Documenten**, **Gerelateerde ontwikkeling**, en uitsluitend voor HR Admin/bevoegde manager **Interne informatie**.
- Documenten- en dossierlinks respecteren authorisatie; algemene tab Documenten krijgt niet automatisch leesrecht op gesprekbijlagen.

### Voorgestelde routes (nieuw, verifieer bestaande naming vóór implementatie)
- /workforce/conversations — team/HR gesprekken
- /workforce/conversations/new — HR rondewizard
- /workforce/conversations/rounds/[roundId] — rondebeheer
- /my-conversations — eigen gesprekken
- /conversations/[conversationId] — canonical rolgefilterd dossier
- /employees/[employeeId]?tab=conversations — employee dossierhistorie
- /work/[workItemId] — bestaande PMUX-taakroute, geen nieuw tasksysteem.

## 10. UX en interactie

Werk met bestaande UX Foundation v1, PageShell, SectionHeader, ScrollableTabs, DetailColumns, lijst-/filterpatronen, shared dialogs/fields en huidige NL/EN i18n. Geen card-on-card of zelfbedachte design tokens. Wizard voor HR: (1) ronde en beoordelingsconfiguratie, (2) deelnemerfilters en validatie, (3) bevestigen/starten. Grote groepen vereisen server-side zoeken/filteren/pagineren en idempotente bulkselectie; geen client-only duizenden employees.

Medewerkerformulieren: zichtbaar wat verwacht wordt, tekst verplicht, autosave of expliciet concept op basis van bestaande patronen, duidelijke laatste versie en definitief-indienen-bevestiging. Manager: beoordelingsvelden alleen als ronde dat vereist; duidelijke markering 'Interne informatie: niet gedeeld'. Eindbevestiging: inhoud bekijken vóór akkoord; niet-akkoordtekst verplicht.

Alle views voorzien loading/empty/404/403/validation/409-conflict, toegankelijke toetsenbord- en screenreaderstaten, mobiele 390px-layout, NL/EN-pariteit. Een gesloten ronde toont read-only de historische fase zonder actieve submitknoppen.

## 11. Architectuurcontract / voorgestelde gegevensentiteiten

Codex bepaalt na inspectie het exacte fysieke schema en bestaande PMUX-extensions; voorstel:
- performance_review_rounds: tenant/hr-group/administration applicability, config snapshot, date/periods, round status/version, creator/audit.
- performance_review_participants: round+employee unique, effective reviewer/manager assignment, employee context, independent phase, closed-by-round flag/version, timestamps.
- performance_review_submissions: self reflection, manager response, rating score/labels snapshot, rating explanation, optional actual meeting date, authorship and submit/version events. Scheid concepten van definitief gepubliceerde read-projections.
- performance_review_acknowledgements: agreement enum, mandatory disagreement body, actor/time, immutable.
- performance_review_private_notes: **afgeschermde** intern-note met version history en strikt separate permission/RLS.
- performance_review_attachments: metadata/storage key/checksum/upload state/released at with immutable final set.
- performance_review_appraisal_links: bronreferentie naar bestaande shared Continuous Appraisal-items, met per request herbeoordeelde brontoegang.
- audit/PMUX: hergebruik bestaande process definitions/instances/work items, reminders, audit trail en integriteitsmechanismen; geen nieuw algemene proces-framework.

Dit is een **logisch contract**, geen bevel om exact zeven nieuwe tabellen te maken. Minimaliseer schema en pas bestaande productpatronen toe. Alle exposed tabellen hebben RLS, grants, indexes, FKs en bijpassende forward-only migration; nooit plaintext privégegevens in onbeschermde views. Koppeling met medewerker én tenant/hr-group/administratie afdwingen op databaseniveau waar canoniek mogelijk. Service-/RPC-mutations atomair en idempotent. Maak typegen in packages/db/types.ts conform AGENTS.

## 12. Werkvoorraad, meldingen en reminders

Per deelnemer precies één uitvoerbare taak van de huidige fase:
- Bij start: medewerker 'Vul je zelfreflectie in'; manager ontvangt informatieve melding.
- Na medewerkerindiening: manager 'Vul managerreactie in'.
- Na managerindiening: medewerker 'Bekijk en bevestig gesprek'.
- Na bevestiging: geen openstaande fase.
- Vóór/na zachte streefdatum: herinnering aan huidige actor, zonder blokkade. Richtlijn voor V1: 7 dagen vóór en hooguit wekelijks na streefdatum, voor zover bestaande PMUX-remindercapaciteit dit betrouwbaar ondersteunt; geen onbewezen timinggarantie (huidige cron/capacity blijft leidend).
- Bij ronde sluiten/annuleren: taken en reminderjobs worden fail-closed gemaakt; er mag geen latere taak worden heropend door een retry of scheduler.

Laat admin-/dashboardtellingen, PMUX-taken en de echte dossierfase reconcileerbaar zijn; 'wacht op manager' in een **gesloten** ronde betekent geen uitvoerbare taak.

## 13. Afwijkingen en afhandeling

- Ontbrekende of meerdere actuele managers: blokkeer geselecteerde dossierstart tot HR een bestaande bevoegde reviewer kiest; geen willekeurige fallback.
- Managerwijziging: geauditeerde vervanging, bevoegdheidcheck, geen impliciete toegang tot alle historische dossiers.
- Uitdienst/afwezig: bestaande dossiers historisch intact, HR kan ronde sluiten; geen automatisch negatieve score.
- Dubbeldienstverband: uniek dossier per medewerker/ronde.
- Nog niet bevestigde managertekst: medewerker mag niet meelezen.
- Ronde sluit tijdens een open upload of submit: geen gedeeltelijk gedeeld document, geen statusoverschrijving; atomair of veilig compensatiebeleid.
- Herhaald indienen/ronde starten/deelnemer toevoegen: idempotent, geen duplicaten.
- Bestand zonder definitieve metadata/virus-scanstatus: nooit publiek beschikbaar.
- Privénotitie en assessment niet zichtbaar via een generieke activity feed of AI-context.
- Wijziging in datum/manager-context terwijl gebruiker formulier openheeft: 409-conflict en herstelbare UX.

## 14. MoSCoW / functionele roadmap

### MUST HAVE — MVP V1
Rondeconfiguratie; selectie op medewerkers/filters; deelnemer later toevoegen; zachte datums; optie beoordeling met 4/5/10 schalen en eigen omschrijvingen; medewerkertekst; managertekst; optionele gespreksdatum; score+onderbouwing indien ingeschakeld; **manager-upload PDF/Word en employee-readonly**; **privéveld manager/HR Admin**; akkoord/niet akkoord met verplichte reden; status/readonly afsluiten; taken/reminders; HR-/manager-/employee-navigatie en dashboarditems; medewerkerkaart-tab en historisch dossier; basislink Continuous Appraisal; beveiliging/audit/retentie/NL-EN/responsive/acceptatie.

### SHOULD HAVE — V2 (niet in deze bouwopdracht)
Herbruikbare vragensets, meerdere vraagtypen en rolverschillen; peer-to-peer-feedback; functie-/afdelingsjablonen; herhaalrondes; vanuit formeel gesprek nieuwe ontwikkelacties/skills naar Continuous Appraisal; PDF-export; instelbare reminders; afzonderlijk geauditeerd bezwaar-/aanvullingsdocument na besluit.

### COULD HAVE — V3
AI-schrijfhulp, AI-voorbereiding en samenvattingsvoorstel op basis van toegestane data; feedbackkwaliteitssuggesties, upward feedback, teamtrends zonder individuele ongeautoriseerde detailinzage.

### NICE TO HAVE — later
360 graden, 9-grid/kalibratie, meerjarige trendanalyse, kalender-/Teams-integratie, spraak, gecontroleerde beloningskoppeling. Geen autonome AI-beoordeling.

## 15. Verplichte acceptancecriteria / traceability

| ID | Scenario / te bewijzen resultaat |
| --- | --- |
| PERF-A01 | HR Admin opent gespreksrondewizard vanuit Workforce en kan concept bewaren. |
| PERF-A02 | HR filtert op naam, HR-groep, administratie, afdeling, functie, manager en locatie; preview en scope kloppen. |
| PERF-A03 | HR start ronde voor een selectie; één dossier per medewerker, juiste manager en werktaak. |
| PERF-A04 | Toekomstig begin start niet vroegtijdig; geplande ronde activeert idempotent op start. |
| PERF-A05 | 4-, 5-, 10-puntsconfigureerbare schaal en labels worden als snapshot bewaard. |
| PERF-A06 | Zonder beoordeling verschijnen geen scorevelden en is geen score via API toelaatbaar. |
| PERF-A07 | HR voegt na start medewerker toe; bestaande dossiers wijzigen niet, dubbele toevoeging faalt veilig. |
| PERF-A08 | Zelfreflectieconcept is alleen voor auteur leesbaar; definitief indienen vergrendelt tekst. |
| PERF-A09 | Manager kan uitsluitend na medewerkerindiening definitief reageren; tekst verplicht. |
| PERF-A10 | Manager kan gespreksdatum leeg laten of geldig invullen; score+toelichting verplicht indien ingeschakeld. |
| PERF-A11 | Manager kan geldige PDF/DOC/DOCX meerdere malen toevoegen en conceptbijlagen verwijderen/vervangen. |
| PERF-A12 | Na managerindiening krijgt medewerker uitsluitend definitieve documenten te zien/lezen/downloaden. |
| PERF-A13 | Employee upload/delete/vervang en toegang tot conceptbijlagen zijn via API en Storage geweigerd. |
| PERF-A14 | Privé-informatie lees/schrijf alleen bevoegde manager/HR Admin; Employee-API en exports bevatten **geen veld/waarde**. |
| PERF-A15 | Medewerker leest definitive reactie, score en toelichting; kan akkoord zonder motivatie. |
| PERF-A16 | Niet akkoord vereist niet-lege motivatie, sluit dossier met separate immutable ontvangstactie. |
| PERF-A17 | Gesloten individuele dossiers zijn publiek read-only; geen status-pingpong. |
| PERF-A18 | Zachte streefdatum na verstrijken blijft actief invulbaar, zichtbaar als te laat. |
| PERF-A19 | HR sluit ronde met open dossiers; statussen blijven origineel, taken/reminders stoppen en alle dossiers read-only. |
| PERF-A20 | HR/manager/employee dashboards tonen consistente geautoriseerde faseaantallen en directe links. |
| PERF-A21 | Iedere fase verschijnt precies eenmaal als taak in bestaande /work; geen dubbele tasksystemen. |
| PERF-A22 | Medewerkerkaart-tab Gesprekken werkt ook zonder Talent Passport; eigen/manager/HR-scope correct. |
| PERF-A23 | Dossierhistorie toont definitieve inhoud, bijlagen, bevestiging, actor/timestamps en gesloten onvolledige dossiers. |
| PERF-A24 | Bestaande Continuous Appraisal-items kunnen veilig gekoppeld/geopend worden zonder inhoud te kopiëren. |
| PERF-A25 | Shared timeline en gewone documenttab bevatten geen private notitie of niet-vrijgegeven score/bijlage. |
| PERF-A26 | Geen cross-employee, cross-manager, cross-division, cross-HR-group, cross-tenant data via GET/POST/Storage/files. |
| PERF-A27 | Managerwissel verplaatst open taak gecontroleerd en voorkomt onterecht historisch bereik. |
| PERF-A28 | Race-/retry-tests: dubbele submit, parallelle close, dubbele upload, optimistic lock, audit consistent. |
| PERF-A29 | Gevoelige data in response/log/export/audit niet onbedoeld blootgesteld. |
| PERF-A30 | NL/EN-i18n, responsive desktop en 390px, keyboard/a11y, 403/404/409/loading/empty. |
| PERF-A31 | Alle geschreven migraties forward-only, RLS/grants/DB-types/adviseurs gecontroleerd, geen externe datawrites zonder machtiging. |
| PERF-A32 | Échte lokale TEST-personaflow via bestaande HR Admin → Manager → Employee (geen auth-bypass), met bewijs per actor en SHA. |
| PERF-A33 | Technische suite, typecheck/lint/i18n/build en relevante SEC-101 regressie blijven groen op uiteindelijke kandidaat. |
| PERF-A34 | Geen onbedoelde Vercel-release, ongerelateerde code-/Payroll-wijziging, accountmutatie of secretblootstelling. |

## 16. Bewijslast / Definition of Done

Een **CODE COMPLETE** claim vereist implementatie van alle MUST-cases, expliciet afgehandelde 403/404/409, contract-/unit-/integration-/browserbewijs, security- en negatieve-scopechecks en documentatie die verwijst naar commit SHA. **Lokaal getest** is niet hetzelfde als **gehost geaccepteerd**; ontbrekende TEST-personasessie of niet-toegepaste schemawijziging blijft BLOCKED/PARTIAL.

De uitvoeropdracht voor Codex staat in [docs/delivery/PERF-MVP-01-CODEX-20261122.md](../../delivery/PERF-MVP-01-CODEX-20261122.md). Alleen de gebruiker kan afzonderlijk de remote Supabase-migratie of een Vercel-release vrijgeven.