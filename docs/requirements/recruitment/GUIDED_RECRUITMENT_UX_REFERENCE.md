> Repositorybron: ongewijzigd overgenomen uit `LIQUIDHR_GUIDED_RECRUITMENT_GOOGLE_STITCH_UX_BRIEF(1).md` van 13 augustus 2026. Canonieke referenties zijn ZIP `(8)` + `(9)`, met RC-007 uit ZIP `(7)`. Deze UX-referentie stuurt compositie en interactie; bestaande LiquidHR-shell, componenten, security en requirements blijven leidend.

**UX / GOOGLE STITCH**

LiquidHR Guided Recruitment

Definitieve UX-referentie — gekoppeld aan de canonieke Stitch-schermset RC-001 t/m RC-032

| **Status**  | Definitieve UX-brief voor designgeneratie         |
|-------------|---------------------------------------------------|
| **Datum**   | 13 augustus 2026                                  |
| **Product** | LiquidHR — Recruitment Light / Guided Recruitment |

> *“Start extreem eenvoudig; voeg structuur toe waar de klant daar waarde aan heeft.”*

## Status van deze UX-referentie

De UX is functioneel goedgekeurd. Google Stitch is hierna **geen requirementsbron** maar een visuele referentie voor de bouw.

**Canonieke Stitch-set:** ZIP `(8)` + ZIP `(9)`, aangevuld met **RC-007 uit ZIP `(7)`** omdat RC-007 niet in de laatste tweedelige export zat. De mapnamen in het screenregister hieronder zijn de officiële referentienamen.

**Conflictregel:** requirements winnen altijd van Stitch. De bestaande LiquidHR-shell en bestaande component-/securitypatronen winnen van legacy navigatieteksten die nog in sommige Stitch-screens voorkomen. Bouw dus geen aparte `Recruitment Suite`, `Talent Pool`, `Reports/Rapportages`, `All Jobs` of globale `Assessments`-module op basis van screenshots.

# 1. Opdracht aan Google Stitch

Ontwerp een complete, samenhangende schermset voor LiquidHR Guided Recruitment. De schermen dienen als visuele en interactionele richting voor implementatie in de bestaande LiquidHR HR-suite. Ontwerp dus geen losstaand nieuw product en geen nieuwe algemene applicatieshell.

> **Belangrijkste ontwerpgedachte**
> Het product moet tegelijk extreem eenvoudig kunnen voelen voor een klein MKB-bedrijf én volwassen guided recruitment ondersteunen wanneer HR meer structuur wil.

- **Doelgroep:** HR Admin in een Nederlandse MKB-organisatie; managers/collega’s participeren alleen waar zij zijn toegewezen.

- **Tone of voice:** rustig, menselijk, professioneel, begrijpelijk; geen ATS-jargon waar gewone HR-taal volstaat.

- **Complexiteit:** progressive disclosure. De eenvoudige route blijft compact; geavanceerde begeleiding verschijnt pas waar relevant.

- **Output:** ontwerp elke hieronder genoemde state/screen als standalone scherm met consistente componenten en responsive intent.

# 2. Bestaande LiquidHR-visuele richting

Gebruik de reeds gekozen LiquidHR/Journeys-visuele richting als basis. Recruitment moet voelen alsof het altijd onderdeel van dezelfde applicatie is geweest.

- donkere LiquidHR-zijbalk behouden

- lichte rustige content-area

- Inter/Aptos-achtige neutrale sans-serif typografie

- compacte body rond 14px

- subtiele borders, lichte cards, minimale zware schaduwen

- semantische statussen met rustig groen/oranje/rood/blauw

- consistente 8px-achtige spacing-rhythm en compacte informatiedichtheid

- Lucide-achtige line icons; geen Material Symbols-look

- responsive zonder aparte mobiele shell

- bestaande header/context/account-footerpatronen respecteren

> **Niet doen**
> Geen parallelle navigatie, geen nieuwe design system-taal, geen glassmorphism, geen overdreven gradients, geen “AI dashboard”-esthetiek, geen overdaad aan KPI-kaarten.

# 3. Kernpersona’s en rechten in de UX

| **Persona**         | **Wat de UI moet ondersteunen**                                                                       |
|---------------------|-------------------------------------------------------------------------------------------------------|
| HR Admin            | volledig vacaturebeheer, pipeline, kandidaten, gesprekken, beoordelingen, settings, aannemen/afwijzen |
| Manager/selectielid | alleen concrete toegewezen sollicitatie/gesprek, beperkte kandidaatgegevens, eigen beoordeling        |
| Kandidaat           | alleen publieke vacaturepagina + sollicitatieformulier; geen account                                  |

Ontwerp participant-schermen zo dat ze bewust minder navigatie en minder kandidaatdata tonen dan HR. Na Afgewezen/Aangenomen bestaat er geen participant-view meer.

# 4. UX-principes

**1.** Vacature eerst: de hoofdmodule opent met vacatures, niet met één groot kandidatenbord.

**2.** Eenvoudig kan echt eenvoudig: een klant met één werkfase mag nergens het gevoel krijgen dat hij een “enterprise ATS” moet configureren.

**3.** Terminal actions voelen bewust anders dan fasewijzigingen: Afwijzen en Aannemen zijn duidelijke acties met bevestiging en gevolgen.

**4.** Guided Recruitment verschijnt als hulp, niet als verplicht proces: bibliotheek, sets en fit-profiel zijn optionele verdieping.

**5.** Publieke kandidaatervaring is los van de ingelogde app en voelt als een eenvoudige branded vacaturepagina.

**6.** Beoordelingen zijn transparant per kenmerk; vermijd rankings, winnaar-labels en percentages.

**7.** Security moet zichtbaar logisch zijn: een manager ziet alleen wat nodig is en geen HR-only controls.

# 5. Informatiearchitectuur

| **Hoofdroute**               | **Substructuur**                                                                      |
|------------------------------|---------------------------------------------------------------------------------------|
| Sollicitaties                | Vacatureoverzicht → vacatureboard → kandidaat/applicationdetail → gesprek/beoordeling |
| Instellingen → Sollicitaties | Proces/Pipeline, Bibliotheek, Sets, Publicatie, Privacy                               |
| Publiek                      | Vacaturepagina → sollicitatieformulier → ontvangstbevestiging                         |
| Medewerkers                  | Bestaande Medewerker toevoegen-flow met kandidaatmatch-state                          |

# 6. Canonieke schermset — overzicht

| **ID** | **Canonieke schermnaam** | **Stitch-map** | **Bronexport** |
|---|---|---|---|
| RC-001 | Sollicitaties — overzicht | `rc_001_sollicitaties_overzicht` | (8) |
| RC-002 | Nieuwe vacature — basisgegevens | `rc_002_nieuwe_vacature_basisgegevens` | (8) |
| RC-003 | Vacature-editor — contentblokken | `rc_003_vacature_editor_contentblokken` | (8) |
| RC-004 | Sollicitatieformulier configureren | `rc_004_sollicitatieformulier_configureren` | (8) |
| RC-005 | Vacature — publicatie | `rc_005_vacature_publicatie` | (8) |
| RC-006 | Publieke vacaturepagina — desktop | `rc_006_publieke_vacaturepagina_desktop` | (8) |
| RC-007 | Publieke sollicitatie — mobiel | `rc_007_publieke_sollicitatie_mobiel` | (7) — canonieke eerdere versie |
| RC-008 | Publieke ontvangstbevestiging — desktop | `rc_008_publieke_ontvangstbevestiging_desktop` | (8) |
| RC-009 | Kandidaatboard — eenvoudig | `rc_009_kandidaatboard_eenvoudig` | (8) |
| RC-010 | Kandidaatboard — uitgebreid | `rc_010_kandidaatboard_uitgebreid` | (8) |
| RC-011 | Kandidaatdetail — overzicht | `rc_011_kandidaatdetail_overzicht` | (8) |
| RC-012 | Kandidaat — meerdere sollicitaties | `rc_012_meerdere_sollicitaties` | (8) |
| RC-013 | Gesprek toevoegen | `rc_013_gesprek_toevoegen` | (8) |
| RC-014 | Interviewmodus | `rc_014_interviewmodus` | (8) |
| RC-015 | Beoordelaar — eigen scorecard | `rc_015_beoordelaar_eigen_scorecard` | (8) |
| RC-016 | Fit-profiel en individuele scores | `rc_016_fit_profiel_en_individuele_scores` | (9) |
| RC-017 | Kandidaten vergelijken | `rc_017_kandidaten_vergelijken` | (8) |
| RC-018 | Afwijzen — bevestiging | `rc_018_afwijzen_bevestiging` | (8) |
| RC-019 | Afgewezen — contact/reminder afhandeling | `rc_019_afgewezen_contact_reminder_afhandeling` | (9) |
| RC-020 | Aannemen — persoonscheck | `rc_020_aannemen_persoonscheck` | (9) |
| RC-021 | Aannemen — minimale dataoverdracht | `rc_021_aannemen_minimale_dataoverdracht` | (9) |
| RC-022 | Aangenomen — Preboarding Journey handoff | `rc_022_aangenomen_preboarding_journey_handoff` | (9) |
| RC-023 | Instellingen — pipeline | `rc_023_instellingen_pipeline` | (9) |
| RC-024 | Instellingen — bibliotheek | `rc_024_instellingen_bibliotheek` | (9) |
| RC-025 | Instellingen — bibliotheekitem / eigen vraag | `rc_025_instellingen_bibliotheekitem_eigen_vraag` | (9) |
| RC-026 | Instellingen — sets overzicht | `rc_026_instellingen_sets_overzicht` | (9) |
| RC-027 | Instellingen — vragenset samenstellen | `rc_027_instellingen_vragenset_samenstellen` | (8) |
| RC-028 | Instellingen — publicatiebranding | `rc_028_instellingen_publicatiebranding` | (9) |
| RC-029 | Instellingen — privacy / bewaartermijn | `rc_029_instellingen_privacy_bewaartermijn` | (9) |
| RC-030 | Medewerker toevoegen — mogelijke kandidaat gevonden | `rc_030_medewerker_toevoegen_mogelijke_kandidaat_gevonden` | (9) |
| RC-031 | Participant/manager — toegewezen sollicitatie | `rc_031_participant_manager_toegewezen_sollicitatie` | (9) |
| RC-032 | Terminal state — participant heeft geen toegang meer | `rc_032_terminal_state_participant_heeft_geen_toegang_meer` | (9) |

> **RC-007 bronnoot**
> RC-007 is de goedgekeurde mobiele publieke sollicitatie uit Stitch ZIP `(7)`. Alle andere schermen komen uit de laatste tweedelige export `(8)` en `(9)`.

> **Niet letterlijk overnemen uit screenshots**
> Legacy shelllabels, een eventueel zichtbaar derde terminal outcome (`Teruggetrokken`), rankings/matchscores, jobboardintegraties, verplichte privacytoestemming en recruitmentdocument-overdracht naar Core HR zijn geen goedgekeurde V1-functionaliteit. De requirements en onderstaande detailinstructies zijn leidend.


# 7. Detailinstructies per scherm

## RC-001 — Sollicitaties — overzicht

**Stitch-referentie:** `rc_001_sollicitaties_overzicht` — bron (8).

**Doel:** HR landt in Recruitment en begrijpt binnen seconden wat openstaat.

**Inhoud:**

- Page header Sollicitaties met CTA Nieuwe vacature

- compacte topline metrics: Open vacatures, Actieve sollicitaties, Nieuw, Geplande gesprekken

- filter/search op status, functie, afdeling

- vacaturelijst of cards met titel, locatie/uren, publicatiestatus en aantallen sollicitaties

- per vacature primaire actie Openen; secundair menu voor bewerken/sluiten/archiveren

**Belangrijkste interacties:**

- Nieuwe vacature

- Open vacature

- Filteren/sorteren

**Designnotities:** Voorkom dashboard-overload. Metrics zijn ondersteunend; de vacaturelijst is de hoofdinhoud.

## RC-002 — Nieuwe vacature — basisgegevens

**Stitch-referentie:** `rc_002_nieuwe_vacature_basisgegevens` — bron (8).

**Doel:** HR maakt snel een vacature aan vanuit bestaande organisatiecontext.

**Inhoud:**

- selecteer bestaande LiquidHR-functie optioneel

- vacaturetitel

- afdeling/team

- locatie

- werkvorm

- uren van/tot

- dienstverband

- optionele salarisrange met toon/niet tonen

- optionele start- en sluitingsdatum

- selectieteam intern

**Belangrijkste interacties:**

- Opslaan als concept

- Volgende: vacaturetekst

**Designnotities:** Gebruik een eenvoudige 2-koloms desktopform layout, 1 kolom mobiel. Maak koppeling met bestaande functie zichtbaar maar niet dominant.

## RC-003 — Vacature-editor — contentblokken

**Stitch-referentie:** `rc_003_vacature_editor_contentblokken` — bron (8).

**Doel:** HR schrijft een aantrekkelijke vacature zonder page-buildercomplexiteit.

**Inhoud:**

- zes blokken: Over de functie, Jouw rol, Wat breng je mee, Wat bieden wij, Sollicitatieprocedure, Aanvullende informatie

- iedere sectie heeft editable titel, rich text en zichtbaar/verborgen toggle

- drag/reorder affordance voor blokvolgorde

- live compact preview-pane of Preview action

**Belangrijkste interacties:**

- Blok herordenen

- Titel wijzigen

- Verbergen/tonen

- Preview

**Designnotities:** Geen algemene “Add section” builder in V1. Laat duidelijk zien dat dit vaste flexibele blokken zijn.

## RC-004 — Sollicitatieformulier configureren

**Stitch-referentie:** `rc_004_sollicitatieformulier_configureren` — bron (8).

**Doel:** HR bepaalt welke gegevens kandidaat moet invullen.

**Inhoud:**

- vaste velden Voornaam, Achternaam, E-mail als locked required

- Telefoon, CV, Motivatie met segmented choice Verborgen / Optioneel / Verplicht

- sectie Extra vragen gebaseerd op vrije-veldenprincipe

- knop Vraag toevoegen met keuze uit bibliotheek/eigen veld

- privacyblok met linkinstelling en voorbeeldtekst

**Belangrijkste interacties:**

- Extra vraag toevoegen

- Volgorde aanpassen

- Preview kandidaatformulier

**Designnotities:** Visualiseer vaste en configureerbare velden anders. Geen gevoel van een generieke form builder.

## RC-005 — Vacature — publicatie

**Stitch-referentie:** `rc_005_vacature_publicatie` — bron (8).

**Normatieve correctie:** de link wordt handmatig gedeeld; V1 bevat geen LinkedIn/Indeed/jobboardintegratie.

**Doel:** HR kiest bewust of vacature publiek is.

**Inhoud:**

- radiokeuze Alleen intern versus Openbare LiquidHR-vacaturepagina

- publicatiestatus chip Concept/Gepubliceerd/Gesloten

- na publicatie: publieke URL in copy-field

- buttons Kopieer link, Bekijk pagina, Publicatie stoppen

- korte uitleg dat link via eigen website, LinkedIn etc. gedeeld kan worden

- Google for Jobs-ready indicator mag informatief/subtiel zijn, geen grote belofte

**Belangrijkste interacties:**

- Publiceren

- Kopieer link

- Open publieke pagina

- Sluiten

**Designnotities:** Laat optioneel karakter heel duidelijk zijn.

## RC-006 — Publieke vacaturepagina — desktop

**Stitch-referentie:** `rc_006_publieke_vacaturepagina_desktop` — bron (8).

**Doel:** Kandidaat leest vacature en kan direct solliciteren zonder LiquidHR-account.

**Inhoud:**

- eenvoudige branded header met bedrijfslogo/naam

- hero met vacaturetitel en metadata chips/regels: locatie, uren, hybride, dienstverband, salaris indien zichtbaar

- primaire CTA Solliciteer

- vacaturesecties in ruime leeskolom

- sticky of side-card met kerninfo en CTA op desktop

- sollicitatieformulier onderaan of duidelijke jump naar formulier

- footer met privacylink en subtiele Powered by LiquidHR indien gewenst

**Belangrijkste interacties:**

- Scroll naar solliciteren

- Sollicitatie indienen

**Designnotities:** Geen ingelogde app-shell. Rustige recruitmentpagina, voldoende witruimte, uitstekende leesbaarheid.

## RC-007 — Publieke sollicitatie — mobiel

**Stitch-referentie:** `rc_007_publieke_sollicitatie_mobiel` — bron (7) — canonieke eerdere versie.

**Doel:** Solliciteren moet op telefoon eenvoudig en betrouwbaar zijn.

**Inhoud:**

- compact vacatureheader

- single-column formulier

- grote touch targets

- upload CV met duidelijke bestandstatus

- extra vragen onder vaste velden

- privacylink

- sticky/duidelijke Verzenden-knop zonder scherm te domineren

**Belangrijkste interacties:**

- CV upload

- Formulier invullen

- Verzenden

**Designnotities:** Ontwerp expliciet op circa 390×844. Geen horizontale overflow.

## RC-008 — Publieke ontvangstbevestiging — desktop

**Stitch-referentie:** `rc_008_publieke_ontvangstbevestiging_desktop` — bron (8).

**Doel:** Bevestigen dat inzending gelukt is zonder accountverwachting te wekken.

**Inhoud:**

- bedrijfslogo

- eenvoudige succesillustratie/icon

- Bedankt, je sollicitatie voor \[vacature\] is ontvangen

- geen “check je account”, geen statusportal

- optionele link Terug naar website

**Designnotities:** Geen belofte van automatische bevestigingsmail zolang LiquidHR die niet verstuurt.

## RC-009 — Kandidaatboard — eenvoudig

**Stitch-referentie:** `rc_009_kandidaatboard_eenvoudig` — bron (8).

**Normatieve correctie:** `AANGENOMEN` en `AFGEWEZEN` zijn terminal actions, nooit drag/drop-fases.

**Doel:** Laat zien dat Recruitment ook ultra-simpel kan.

**Inhoud:**

- vacatureheader met titel, status, publicatielink en compacte counts

- slechts één actieve kolom Sollicitatie

- naast/onder het bord compacte terminale groepen of filters Afgewezen en Aangenomen

- candidate cards met naam, leeftijd sollicitatie, eventueel CV/gesprekindicator

- duidelijke acties kandidaat openen, Afwijzen, Aannemen

**Belangrijkste interacties:**

- Kandidaat openen

- Afwijzen

- Aannemen

**Designnotities:** Dit scherm is cruciaal: het mag niet “leeg” of onaf voelen met maar één werkfase.

## RC-010 — Kandidaatboard — uitgebreid

**Stitch-referentie:** `rc_010_kandidaatboard_uitgebreid` — bron (8).

**Normatieve correctie:** drag/drop alleen tussen werkfases; nooit sorteren/rangschikken op assessmentscore.

**Doel:** Ondersteun organisaties die meer selectiefases gebruiken.

**Inhoud:**

- kolommen bijvoorbeeld Nieuw, Screening, Eerste gesprek, Tweede gesprek, Aanbod

- compacte cards

- drag-and-drop tussen werkfases

- filters/selectieteam/status

- terminal outcomes via expliciete acties, niet door gewoon te slepen

**Belangrijkste interacties:**

- Drag stage

- Open kandidaat

- Gesprek toevoegen

- Afwijzen/Aannemen

**Designnotities:** Horizontale board mag desktop scrollen, maar mobiel liever stage-filter/lijst dan miniatuurkolommen.

## RC-011 — Kandidaatdetail — overzicht

**Stitch-referentie:** `rc_011_kandidaatdetail_overzicht` — bron (8).

**Doel:** HR ziet alles van één sollicitatie zonder kandidaat en sollicitatie te verwarren.

**Inhoud:**

- header met kandidaatnaam, vacaturetitel, huidige fase en acties Fase wijzigen / Gesprek toevoegen / Beoordelen / Afwijzen / Aannemen

- tabs Overzicht, Gesprekken, Beoordelingen, Notities, Historie

- contactkaart met e-mail/telefoon copy actions

- CV en motivatie

- antwoorden op vacaturevragen

- bron en ontvangstdatum

- compacte timeline van belangrijke events

**Belangrijkste interacties:**

- Tabs

- Copy contact

- CV openen

- Terminal actions

**Designnotities:** Zet vacaturecontext altijd zichtbaar; dit voorkomt verwarring bij kandidaten met meerdere sollicitaties.

## RC-012 — Kandidaat — meerdere sollicitaties

**Stitch-referentie:** `rc_012_meerdere_sollicitaties` — bron (8).

**Doel:** Laat één Candidate met meerdere Applications begrijpelijk zien.

**Inhoud:**

- candidate identity bovenaan

- sectie Sollicitaties met cards/rows per vacature en outcome/fase

- geselecteerde sollicitatie opent eigen detailcontext

- oude afgewezen sollicitatie duidelijk historisch, niet als algemene kandidaatstatus

**Designnotities:** Geen globale “goede/slechte kandidaat”-score over vacatures heen.

## RC-013 — Gesprek toevoegen

**Stitch-referentie:** `rc_013_gesprek_toevoegen` — bron (8).

**Doel:** HR registreert een selectiegesprek zonder agenda-integratie.

**Inhoud:**

- titel/type

- datum en tijd

- deelnemers selecteren

- vragenset kiezen uit standaard/eigen sets

- preview van inhoud set

- optionele kandidaatvoorbereidingsvragen

- actie Kopieer voorbereidingstekst

**Belangrijkste interacties:**

- Opslaan

- Set kiezen

- Voorbereiding kopiëren

**Designnotities:** Leg uit dat uitnodiging en communicatie extern worden afgehandeld.

## RC-014 — Interviewmodus

**Stitch-referentie:** `rc_014_interviewmodus` — bron (8).

**Doel:** Interviewer krijgt focus op gesprek en vragen.

**Inhoud:**

- kandidaat + vacature + gesprekstitel bovenaan

- progress/inhoudsindex van vragen

- per vraag optionele notitieruimte

- duidelijk onderscheid tussen gespreksvragen en beoordelingscriteria

- CTA Naar beoordeling / Opslaan

**Belangrijkste interacties:**

- Volgende vraag

- Notitie vastleggen

- Naar beoordeling

**Designnotities:** Maak dit scherm rustig en bijna “presentatiemodus”, zonder onnodige HR-adminnavigatie.

## RC-015 — Beoordelaar — eigen scorecard

**Stitch-referentie:** `rc_015_beoordelaar_eigen_scorecard` — bron (8).

**Doel:** Beoordelaar scoort onafhankelijk en begrijpt de schaal.

**Inhoud:**

- lijst criteria gegroepeerd op kenmerk

- 1–5 scale

- korte ankertekst onder/naast schaal

- optionele toelichting

- waarschuwing dat ingediende beoordeling wordt vastgelegd

- geen scores van anderen vóór eigen submit

**Belangrijkste interacties:**

- Score kiezen

- Toelichting

- Beoordeling indienen

**Designnotities:** Geen sterrenesthetiek als dat te casual voelt; segmented 1–5 of radio scale past beter.

## RC-016 — Fit-profiel en individuele scores

**Stitch-referentie:** `rc_016_fit_profiel_en_individuele_scores` — bron (9).

**Doel:** HR ziet een transparante samenvatting na meerdere beoordelingen.

**Inhoud:**

- kenmerkprofiel met Communication 4.3, Ownership 3.7 etc.

- aantal beoordelingen per kenmerk

- subtiele horizontale bars/radial chart alleen als leesbaarheid toeneemt

- expand row om scores per beoordelaar te zien

- toelichtingen per beoordelaar

- geen totaalpercentage

**Belangrijkste interacties:**

- Kenmerk openklappen

- Individuele scorecard bekijken

**Designnotities:** Noem het bijvoorbeeld “Beoordelingsprofiel” of “Kenmerkprofiel”, niet AI fit score.

## RC-017 — Kandidaten vergelijken

**Stitch-referentie:** `rc_017_kandidaten_vergelijken` — bron (8).

**Normatieve correctie:** alleen kenmerkvergelijking; geen totaalscore, matchpercentage, ranking of aanbevolen kandidaat.

**Doel:** HR vergelijkt transparant kandidaten binnen één vacature.

**Inhoud:**

- table/matrix met kandidaatnamen rijen en geselecteerde kenmerken kolommen

- fase/outcome context

- missende scores als “—”

- geen sortering op automatisch totaal tenzij puur handmatig/kolomsortering

- link naar kandidaatdetail

**Designnotities:** Vermijd podium, rankingbadges en “best match”.

## RC-018 — Afwijzen — bevestiging

**Stitch-referentie:** `rc_018_afwijzen_bevestiging` — bron (8).

**Normatieve correctie:** geen standaardreden `Geen culturele match`; gebruik objectieve/functiegerelateerde redenen.

**Doel:** Maak terminale gevolgen duidelijk zonder zwaar te voelen.

**Inhoud:**

- kandidaat + vacature

- select afwijsreden intern

- optionele interne toelichting

- duidelijke melding: selectietoegang voor manager/beoordelaars stopt direct

- buttons Annuleren en Afwijzen

**Belangrijkste interacties:**

- Afwijzen bevestigen

**Designnotities:** Gebruik rood semantisch, maar niet alarmistisch. Dit is een normale HR-handeling.

## RC-019 — Afgewezen — contact/reminder afhandeling

**Stitch-referentie:** `rc_019_afgewezen_contact_reminder_afhandeling` — bron (9).

**Normatieve correctie:** communicatie blijft extern en de reminder is volledig optioneel.

**Doel:** HR kan extern contact makkelijk afhandelen, maar hoeft niets te doen.

**Inhoud:**

- successtatus “\[Naam\] is afgewezen”

- tekst: LiquidHR verstuurt geen bericht

- e-mail met Kopieer

- telefoon met Kopieer

- optioneel Open e-mail / Open WhatsApp

- reminderblok met Herinner mij morgen / Andere datum / Geen reminder

- sluitknop Klaar

**Belangrijkste interacties:**

- Copy

- Open extern

- Reminder kiezen

- Sluiten

**Designnotities:** Geen checkbox “kandidaat geïnformeerd” verplicht maken. Geen blokkade.

## RC-020 — Aannemen — persoonscheck

**Stitch-referentie:** `rc_020_aannemen_persoonscheck` — bron (9).

**Doel:** Voorkom dubbele Employee-identiteiten.

**Inhoud:**

- kandidaat/vacature bovenaan

- mogelijke bestaande Employee matches met naam/e-mail/employee context

- keuzes Nieuwe medewerker, Bestaande medewerker, Oud-medewerker/herintreder waar relevant

- duidelijke tekst dat LiquidHR alleen suggereert, HR beslist

**Belangrijkste interacties:**

- Match kiezen

- Doorgaan

**Designnotities:** Geen auto-merge. Laat security/privacy serieus maar gebruiksvriendelijk voelen.

## RC-021 — Aannemen — minimale dataoverdracht

**Stitch-referentie:** `rc_021_aannemen_minimale_dataoverdracht` — bron (9).

**Doel:** HR controleert wat Recruitment naar Core HR meegaat.

**Inhoud:**

- voornaam, tussenvoegsel, achternaam, privé-e-mail, telefoon

- duidelijke callout “Niet overgenomen: CV, motivatie, interviewnotities en beoordelingen”

- Core HR contextvelden die normaal nodig zijn voor Employee/Employment kunnen daarna volgen via bestaande patronen

**Belangrijkste interacties:**

- Bevestigen en medewerker maken/koppelen

**Designnotities:** Visueel de domeingrens expliciet maken.

## RC-022 — Aangenomen — Preboarding Journey handoff

**Stitch-referentie:** `rc_022_aangenomen_preboarding_journey_handoff` — bron (9).

**Doel:** Sluit recruitment positief af en bied volgende stap.

**Inhoud:**

- successtate met kandidaatnaam

- Employee aangemaakt/gekoppeld

- CTA Preboarding Journey starten

- secundair Later doen

- link Medewerker bekijken

**Belangrijkste interacties:**

- Journey starten

- Later

- Medewerker openen

**Designnotities:** Gebruik dezelfde Journeys-designrichting; geen nieuwe onboardingconcepten verzinnen.

## RC-023 — Instellingen — pipeline

**Stitch-referentie:** `rc_023_instellingen_pipeline` — bron (9).

**Normatieve correctie:** V1 heeft minimaal één werkfase en exact twee vaste terminal outcomes: `AFGEWEZEN` en `AANGENOMEN`. Een zichtbaar `Teruggetrokken` in Stitch is niet leidend.

**Doel:** HR Admin configureert van eenvoudig tot uitgebreid proces.

**Inhoud:**

- lijst actieve werkfases met drag handles

- inline rename

- toggle actief/inactief

- Nieuwe fase toevoegen

- vaste terminal outcomes Afgewezen en Aangenomen apart/vergrendeld weergegeven

- voorbeeld “Minimaal één werkfase nodig”

**Belangrijkste interacties:**

- Reorder

- Rename

- Toggle

- Add stage

**Designnotities:** Laat heel duidelijk zien dat “Sollicitatie” als enige fase een valide setup is.

## RC-024 — Instellingen — bibliotheek

**Stitch-referentie:** `rc_024_instellingen_bibliotheek` — bron (9).

**Doel:** Beheer grote gecureerde content zonder onoverzichtelijkheid.

**Inhoud:**

- tabs/filter voor 4 typen

- search

- filter LiquidHR standaard / Eigen

- actief/inactief toggle

- tags/kenmerken

- table/list met titel, type, kenmerk, bron, status

- CTA Eigen item toevoegen

**Belangrijkste interacties:**

- Filter

- Activeer/deactiveer

- Open item

- Eigen item toevoegen

**Designnotities:** LiquidHR-items moeten visueel herkenbaar maar niet dominant branded zijn.

## RC-025 — Instellingen — bibliotheekitem/eigen vraag

**Stitch-referentie:** `rc_025_instellingen_bibliotheekitem_eigen_vraag` — bron (9).

**Normatieve correctie:** library-itemtype en input-/scoretype zijn twee afzonderlijke concepten.

**Doel:** Bekijk standaarditem of bewerk eigen item.

**Inhoud:**

- type badge

- vraag/criteriumtekst

- kenmerk

- voor beoordelingscriterium 1–5 ankers

- tags

- actief/inactief

- bij LiquidHR-item: read-only tekst + eventueel Kopieer naar eigen variant

- bij eigen item: edit controls

**Belangrijkste interacties:**

- Activeren

- Kopiëren

- Eigen item opslaan

**Designnotities:** Geen AI-generate-knop.

## RC-026 — Instellingen — sets overzicht

**Stitch-referentie:** `rc_026_instellingen_sets_overzicht` — bron (9).

**Doel:** HR ziet herbruikbare gesprekssets.

**Inhoud:**

- cards/list met titel, beschrijving, aantal vragen/criteria/prepitems

- LiquidHR standaard versus Eigen

- actief/inactief

- CTA Nieuwe set

**Belangrijkste interacties:**

- Open set

- Kopieer standaardset

- Nieuwe set

**Designnotities:** Voorbeelden in mockup: Eerste kennismaking, Commerciële functie, Leidinggevend, Senior professional.

## RC-027 — Instellingen — vragenset samenstellen

**Stitch-referentie:** `rc_027_instellingen_vragenset_samenstellen` — bron (8).

**Normatieve correctie:** een set bevat Gespreksvragen, Beoordelingscriteria en Voorbereidingsvragen; sollicitatieformulier-vragen horen niet in een set.

**Doel:** HR stelt set samen zonder ingewikkelde workflowdesigner.

**Inhoud:**

- titel en beschrijving

- linkerzijde/selector bibliotheekitems met zoek/filter

- rechterzijde geordende setinhoud

- sections Gespreksvragen / Beoordelingscriteria / Voorbereiding mogen optioneel gegroepeerd zijn

- drag/reorder

- duidelijke counts

**Belangrijkste interacties:**

- Item toevoegen

- Verwijderen

- Reorder

- Opslaan

**Designnotities:** Geen pipeline-automatisering of condition builder.

## RC-028 — Instellingen — publicatiebranding

**Stitch-referentie:** `rc_028_instellingen_publicatiebranding` — bron (9).

**Normatieve correctie:** privacyverklaring wordt getoond/gelezen; LiquidHR schrijft geen universele toestemming als rechtsgrond voor.

**Doel:** HR stelt defaults voor publieke vacaturepagina in.

**Inhoud:**

- logo upload/select

- bedrijfsnaam

- accentkleur

- optionele publieke contactinfo

- privacyverklaring URL

- preview miniatuur desktop/mobiel

**Belangrijkste interacties:**

- Opslaan

- Preview

**Designnotities:** Hou branding bewust beperkt; geen page builder.

## RC-029 — Instellingen — privacy / bewaartermijn

**Stitch-referentie:** `rc_029_instellingen_privacy_bewaartermijn` — bron (9).

**Normatieve correctie:** default 28 dagen, range 1–3650; >365 geeft alleen een waarschuwing en geen claim dat expliciete toestemming verplicht is.

**Doel:** Maak retentie begrijpelijk en verantwoord configureerbaar.

**Inhoud:**

- number input Bewaar recruitmentgegevens … dagen na einde procedure

- default 28

- helpertekst configureerbaar 1–3650 dagen

- bij \>365 dagen waarschuwing in amber dat organisatie termijn zelf moet onderbouwen

- tekst dat wijziging doorwerkt op nog aanwezige recruitmentrecords

- geen talentpooloptie in V1

**Belangrijkste interacties:**

- Waarde wijzigen

- Opslaan

**Designnotities:** Geen juridische claims zoals “wettelijk verplicht 28 dagen”.

## RC-030 — Medewerker toevoegen — mogelijke kandidaat gevonden

**Stitch-referentie:** `rc_030_medewerker_toevoegen_mogelijke_kandidaat_gevonden` — bron (9).

**Normatieve correctie:** alleen voornaam, tussenvoegsel, achternaam, privé-e-mail en telefoon mogen als basisdata worden voorgesteld voor overdracht; geen recruitmentdocumenten/-beoordelingen.

**Doel:** Bestaande Core HR-flow herkent Recruitment-identiteit.

**Inhoud:**

- normale Medewerker toevoegen-flow

- inline match card “Mogelijke bestaande kandidaat gevonden”

- naam/e-mail/telefoon en korte sollicitatiehistorie

- acties Bekijk kandidaat, Gebruik kandidaatgegevens, Toch nieuwe medewerker maken

- bij actieve sollicitatie extra vraag of aanname uit deze sollicitatie voortkomt

**Belangrijkste interacties:**

- Match gebruiken

- Toch nieuw

- Actieve sollicitatie afronden als aangenomen

**Designnotities:** Dit moet voelen als uitbreiding van bestaand Employee-scherm, niet als recruitmentwizard.

## RC-031 — Participant/manager — toegewezen sollicitatie

**Stitch-referentie:** `rc_031_participant_manager_toegewezen_sollicitatie` — bron (9).

**Normatieve correctie:** geen overall `Eindoordeel`, aanbevelingsdropdown of globale fit-score; alleen criteria 1–5 + toelichting.

**Doel:** Manager beoordeelt alleen concrete kandidaat zonder HR-beheerrechten.

**Inhoud:**

- beperkte header context

- kandidaatbasis, CV/motivatie indien toegestaan

- toegewezen gesprek

- interviewvragen

- eigen scorecard

- geen pipelineconfig, privacy, andere kandidaten of terminal HR-controls tenzij expliciet toegestaan

**Belangrijkste interacties:**

- Gesprek openen

- Eigen beoordeling invullen

**Designnotities:** Gebruik minder admin-controls en maak scope natuurlijk duidelijk.

## RC-032 — Terminal state — participant heeft geen toegang meer

**Stitch-referentie:** `rc_032_terminal_state_participant_heeft_geen_toegang_meer` — bron (9).

**Normatieve correctie:** terminal state lekt geen kandidaat- of vacaturegevoelige data aan de participant.

**Doel:** Toon correct gedrag na Afgewezen/Aangenomen.

**Inhoud:**

- eenvoudige toegangsmelding “Deze sollicitatie is niet meer beschikbaar voor jou”

- geen kandidaatgegevens in foutstate

- teruglink naar eigen relevante start/overzicht

**Designnotities:** Belangrijk voor security review. Geen leakage via titel, e-mail, CV of oude data.

# 8. Componenten die Stitch consistent moet hergebruiken

- VacancyIdentity: titel + metadata + status

- CandidateIdentity: naam + initial/avatar + contactcontext

- StatusChip: vacaturestatus, fase, terminal outcome

- MetricStrip: compacte cijfers zonder grote dashboardcards

- CandidateCard: compacte Kanban/list card

- StageColumn / StageFilter

- QuestionItem: type, tekst, kenmerk, active state

- SetSummaryCard

- AssessmentScale 1–5 met anchor help

- CharacteristicScoreRow met expand details

- ParticipantAvatarGroup

- CopyValueRow voor e-mail/telefoon/link

- TerminalActionDialog

- PrivacyWarning

- PublicVacancyHeader en PublicApplicationForm

# 9. Responsive gedrag

| **Desktop**                                                                  | **Mobiel**                                                                                             |
|------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| Vacatureoverzicht als ruime lijst/cards; board met horizontale stagekolommen | Vacatureoverzicht als compacte lijst; board liever stage-filter + verticale cards dan miniatuur-Kanban |
| Kandidaatdetail met tabs en eventueel side panel voor kerninfo               | Tabs horizontaal scrollbaar of compacte segmented navigation; alle content single column               |
| Publieke vacature kan sticky sollicitatiecard rechts hebben                  | CTA en formulier in één kolom; geen sticky elementen die content blokkeren                             |
| Vragenset samenstellen als dual-pane                                                   | Vragenset samenstellen als library picker → selected list sequentieel                                            |

| **UX-MOB-001** | **MUST** | Ontwerp publieke sollicitatie, kandidaatdetail en participant scorecard expliciet ook voor circa 390×844. |
|----------------|----------|-----------------------------------------------------------------------------------------------------------|

# 10. Contentvoorbeelden voor mockups

## 10.1 Voorbeeldvacature

Gebruik voor een deel van de schermen een geloofwaardige voorbeeldvacature geïnspireerd op een senior productrol, maar niet letterlijk de aangeleverde externe vacaturetekst kopiëren.

- Titel: Lead Product Manager — Ground Intelligence Platform

- Locatie: Nootdorp

- Werkvorm: Hybride

- Uren: 32–40

- Dienstverband: Vast

- Kern: productstrategie, SaaS, discovery, analytics, pricing, stakeholdermanagement

## 10.2 Voorbeeldkandidaten

| **Kandidaat**  | **Gebruik**                                            |
|----------------|--------------------------------------------------------|
| Lisa Jansen    | hoofdkandidaat, tweede gesprek, meerdere beoordelingen |
| Peter de Boer  | vergelijkingskandidaat                                 |
| Hup Le Pup     | afwijzen + contact/reminder voorbeeld                  |
| Sanne de Vries | voorbeeld van één Candidate met twee Applications      |

## 10.3 Voorbeeldkenmerken

- Communicatie

- Eigenaarschap

- Analytisch vermogen

- Samenwerken

- Leervermogen

- Klantgerichtheid

# 11. Toegankelijkheid en states

- kleur nooit als enige statusdrager; gebruik tekst/iconen

- keyboard focus zichtbaar

- drag-and-drop heeft alternatieve move controls

- 1–5 score labels zijn screen-reader begrijpelijk

- upload states: leeg, bezig, geslaagd, fout

- empty states: geen vacatures, geen kandidaten, geen gesprekken, geen beoordelingen

- loading/skeleton states subtiel

- foutstates zonder persoonsgegevens te lekken

- bevestigingsdialogen voor terminal actions en privacydelete

# 12. Wat Stitch expliciet niet moet ontwerpen

- nieuwe algemene LiquidHR-shell of zijbalk

- kandidaatportal/account

- interne e-mailclient

- chat

- Outlook/calendar scheduling

- AI-rankings, matchpercentages of “recommended candidate” badges

- volledige careers-site CMS

- jobboard marketplace

- pipeline per vacature

- workflow automation builder

- contractondertekening

- talentpool

- post-hire performance vergelijking

# 13. Verwachte oplevering van Stitch

| **ST-001** | **MUST** | Lever voor ieder RC-scherm een duidelijke standalone screen.png-equivalent en bijbehorende HTML/design representation waar Stitch dat ondersteunt. |
|------------|----------|----------------------------------------------------------------------------------------------------------------------------------------------------|

| **ST-002** | **MUST** | Maak states onderling visueel consistent; gebruik dezelfde componenten en spacing. |
|------------|----------|------------------------------------------------------------------------------------|

| **ST-003** | **MUST** | Zorg dat publieke schermen duidelijk buiten de ingelogde app-shell staan, maar branding wel LiquidHR-kwaliteit uitstraalt. |
|------------|----------|----------------------------------------------------------------------------------------------------------------------------|

| **ST-004** | **MUST** | Laat minstens één ultra-simpel en één uitgebreid pipelinevoorbeeld zien. |
|------------|----------|--------------------------------------------------------------------------|

| **ST-005** | **MUST** | Laat minstens één manager/selectielid-view zien om least-privilege visueel te toetsen. |
|------------|----------|----------------------------------------------------------------------------------------|

| **ST-006** | **MUST** | Laat een mobiele publieke sollicitatie en mobiele interview/assessment-flow zien. |
|------------|----------|-----------------------------------------------------------------------------------|

# 14. Interpretatieregel voor latere implementatie

> **Stitch is richtinggevend, niet letterlijk bindend**
> De uiteindelijke LiquidHR-implementatie moet de visuele hiërarchie, interactie-intentie, informatiedichtheid, componentcompositie en tone of voice van de gekozen Stitch-schermen volgen. Bestaande LiquidHR-shell, reusable components, permissions/security, routing, accessibility, i18n, data en onderhoudbare technische structuur blijven echter leidend. Geen parallelle app of 1-op-1 HTML-kopie bouwen.

# 15. Snelle reviewcheck voor de gegenereerde schermset

- Kan een kleine klant de module gebruiken met alleen Sollicitatie / Afgewezen / Aangenomen zonder dat het leeg of vreemd voelt?

- Is duidelijk dat publieke publicatie optioneel is?

- Is kandidaat vs sollicitatie visueel logisch, ook bij meerdere sollicitaties?

- Is Guided Recruitment rijk maar optioneel?

- Zijn beoordelingen transparant zonder ranking?

- Is het verschil tussen werkfase en terminal outcome duidelijk?

- Is de rechtenintrekking na terminal outcome zichtbaar in managerstates?

- Is de publieke sollicitatie op mobiel overtuigend?

- Past alles in de bestaande LiquidHR/Journeys-stijl?

# 16. Implementatiegebruik van deze UX-set

Voor Codex/implementatie geldt:

- De RC-schermen zijn **richtinggevend**, niet 1-op-1 code om te kopiëren.
- Gebruik bestaande LiquidHR-shell, routing, componenten, permissions, RLS, i18n en accessibility-patronen.
- Neem uit Stitch vooral layout, informatiehiërarchie, interactionele intentie, density, scorecardpatronen en publieke kandidaatervaring over.
- Wanneer Stitch een element toont dat buiten V1 valt, wordt het **niet** gebouwd, ook niet als het visueel aantrekkelijk is.
- `screen.png` helpt bij visuele verificatie; `code.html` mag als ontwerpbron worden gelezen maar niet blind worden overgenomen.
- Test minimaal desktop en 390×844 mobiel waar relevant. Publieke sollicitatie, participant-view en kernkandidaatflows verdienen expliciet responsive bewijs.

## 16.1 Definitieve requirement → screen samenvatting

| **Flow** | **RC-reeks** |
|---|---|
| Vacature aanmaken/publiceren | RC-001 → RC-002 → RC-003 → RC-004 → RC-005 |
| Publieke kandidaatflow | RC-006 → RC-007 → RC-008 |
| HR kandidaatbehandeling | RC-009/010 → RC-011/012 |
| Gesprek & beoordeling | RC-013 → RC-014 → RC-015 → RC-016/017 |
| Afwijzen | RC-018 → RC-019 → RC-032 |
| Aannemen | RC-020 → RC-021 → RC-022 → RC-032 |
| Recruitmentsettings | RC-023 → RC-024/025 → RC-026/027 → RC-028 → RC-029 |
| Employee-create Candidate match | RC-030 |
| Participant/manager | RC-031 → RC-032 |
