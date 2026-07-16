# Tijdhub, persoonlijke klokken en reminders — ontwerp

Datum: 2026-07-15  
Status: GOEDGEKEURD

## 1. Doel

Liquid HR krijgt na inloggen onderin de linkerzijbalk een persoonlijke Tijdhub. De Tijdhub combineert een instelbare klok, komende reminders met live aftelling, een detailpopup en persoonlijk reminderbeheer. HR-admins kunnen daarnaast reminders plannen voor iedereen, één of meer afdelingen of geselecteerde medewerkers.

De ervaring moet rustig, modern en premium aanvoelen. De klok geeft de suite karakter, maar blijft functioneel en compact.

## 2. Functionele scope

### 2.1 Klok

Iedere gebruiker kiest in persoonlijke instellingen:

- `ANALOG`: analoge klok;
- `DIGITAL`: digitale 24-uursklok;
- `HIDDEN`: geen klok in de sidebar.

Voor de analoge klok zijn drie stijlen beschikbaar:

- `CLASSIC`: rustige wijzerplaat met uurmarkeringen;
- `MINIMAL`: alleen hoofdmarkeringen en slanke wijzers;
- `LIQUID`: thematische accentboog, zachte diepte en subtiele seconde-indicatie.

Alle varianten gebruiken bestaande thema-CSS-variabelen. Componenten bevatten geen hardcoded kleuren. Animaties respecteren `prefers-reduced-motion`.

### 2.2 Sidebar

De Tijdhub staat tussen de navigatie en de instellingen-/accountfooter. In uitgeklapte toestand toont hij:

- de gekozen klok;
- huidige lokale datum;
- maximaal drie eerstvolgende actieve reminders;
- per reminder een relatieve aftelling;
- een actie om snel een persoonlijke reminder te maken;
- een link naar de volledige reminderpagina.

In ingeklapte toestand toont de sidebar een compacte klok/reminderknop met een badge voor het aantal komende of vervallen reminders. Op mobiel verschijnt dezelfde Tijdhub in het uitschuifmenu.

De aftelling gebruikt lokale clienttijd voor presentatie. De database bewaart tijdstippen als `timestamptz`; API en server blijven de bron van waarheid.

### 2.3 Reminderinteractie

Een klik op de klok opent het Tijdhub-paneel. Een klik op een reminder opent een toegankelijke detailpopup met:

- titel;
- datum en tijd;
- omschrijving;
- afzender: zelf of HR;
- doelgroepcontext indien zichtbaar voor de maker;
- status;
- acties `Gereed`, `Uitstellen` en `Sluiten`.

Wanneer een reminder tijdens een actieve sessie zijn tijdstip bereikt, verschijnt een in-app popup. De popup wordt per ontvanger maximaal eenmaal per sessie automatisch getoond. Browserpush, e-mail en mobiele push vallen buiten deze slice.

### 2.4 Persoonlijke reminder

Iedere ingelogde gebruiker kan voor zichzelf een reminder maken met:

- datum;
- tijd;
- titel, maximaal 160 tekens;
- optionele omschrijving, maximaal 2.000 tekens.

De gebruiker kan de eigen reminder wijzigen, verwijderen, gereedmelden of uitstellen. Een uitgestelde reminder behoudt auditbare herkomst en krijgt een nieuw effectief herinneringstijdstip voor die ontvanger.

### 2.5 HR-reminder

Een actor met `reminder:write` kan een reminder maken voor:

- `EVERYONE`: alle actieve gebruikers binnen de tenant en gekozen administratiescope;
- `DEPARTMENTS`: één of meer afdelingen, inclusief medewerkers met een actieve plaatsing op het herinneringstijdstip;
- `EMPLOYEES`: één of meer expliciet geselecteerde medewerkers met een gekoppelde auth-user.

Ontvangers worden bij publicatie atomair gematerialiseerd. Daardoor blijft de oorspronkelijke doelgroep aantoonbaar en verandert een latere afdelingsverplaatsing niet stil de ontvangerslijst. De maker ziet vooraf het ontvangersaantal en moet de publicatie bevestigen.

HR-reminders blokkeren gebruikerswerk niet. Iedere ontvanger beheert de eigen status, snooze en zichtbaarheid zonder de centrale reminder of andere ontvangers te wijzigen.

## 3. Pagina's en navigatie

### 3.1 Persoonlijke instellingen

De bestaande instellingenmodal krijgt tabs:

- `Weergave`: taal en thema;
- `Klok & reminders`: kloktype, analoge stijl en een preview van de gekozen klok.

Klokvoorkeuren zijn usergebonden en tenantonafhankelijk, net als locale en thema.

### 3.2 Reminderpagina

Nieuwe route `/reminders` met URL-state tabs:

- `Voor mij`: komende, vervallen en afgeronde reminders van de gebruiker;
- `Door HR gepland`: alleen zichtbaar met `reminder:write`, met status, doelgroep, ontvangersaantal en bereik.

De pagina ondersteunt filteren op status en periode via queryparameters. De server rendert de lijst; er komt geen globale clientcache.

## 4. Datamodel

### 4.1 UserPreferences

`user_preferences` krijgt:

- `clock_mode`: enum `ANALOG | DIGITAL | HIDDEN`, default `ANALOG`;
- `analog_clock_style`: enum `CLASSIC | MINIMAL | LIQUID`, default `LIQUID`.

### 4.2 Reminder

Nieuwe tabel `reminders`:

- tenant- en optionele administratiescope;
- maker `created_by_user_id`;
- type `PERSONAL | HR`;
- doelgroepsoort `SELF | EVERYONE | DEPARTMENTS | EMPLOYEES`;
- titel en omschrijving;
- `remind_at timestamptz`;
- status `DRAFT | PUBLISHED | CANCELLED`;
- publicatie- en auditvelden.

### 4.3 ReminderTargets

Doelgroepselectie wordt vastgelegd in `reminder_targets` voor afdeling- en medewerkerselecties. Deze tabel bewaart de intentie van de maker en maakt een beheerweergave mogelijk.

### 4.4 ReminderRecipients

`reminder_recipients` bevat één regel per uiteindelijke ontvanger:

- reminder;
- auth-user en, indien beschikbaar, employee;
- status `PENDING | COMPLETED | DISMISSED`;
- effectief herinneringstijdstip;
- `completed_at`, `dismissed_at`, `last_popup_at`;
- afgeleide herkomst voor audit.

Een unieke constraint voorkomt dubbele ontvangers per reminder. Indexen ondersteunen `user_id + effective_remind_at + status` en beheerquery's per reminder.

## 5. Autorisatie en RLS

Nieuwe canonieke permissions:

- `reminder:read` voor HR-beheerinzage;
- `reminder:write` voor HR-publicatie en annulering.

Persoonlijk gebruik vereist geen brede tenantpermission: RLS staat uitsluitend self-acties toe op eigen persoonlijke reminders en eigen recipientregels. HR-mutaties vereisen `reminder:write` server-side én in RLS. Tenant- en administratiescope worden expliciet afgedwongen.

Een gewone gebruiker kan nooit:

- ontvangers van een HR-reminder uitlezen;
- statussen van andere ontvangers wijzigen;
- een HR-reminder wijzigen of annuleren;
- reminders buiten de eigen tenant afleiden.

Publicatie naar een doelgroep verloopt via één transactionele PostgreSQL-RPC die de reminder vergrendelt, scope valideert, ontvangers materialiseert en de reminder publiceert.

## 6. Services en API

Zod-schema's valideren voorkeuren, persoonlijke reminders, HR-reminders, doelgroepkeuze, statusacties en snooze. De servicelaag gebruikt uitsluitend de ingelogde RLS-client.

Routes:

- `GET/POST /api/reminders` voor persoonlijke lijst/aanmaak en bevoegde HR-aanmaak;
- `GET/PATCH/DELETE /api/reminders/[reminderId]` voor detail en toegestane wijzigingen;
- `POST /api/reminders/[reminderId]/publish` voor atomaire HR-publicatie;
- `PATCH /api/reminder-recipients/[recipientId]` voor gereed, uitstellen en verbergen;
- bestaande preferences Server Action wordt uitgebreid met klokvoorkeuren.

Responses gebruiken `{ data }` of `{ error }` met passende statuscodes. Groeiende queries hebben altijd een limiet/range.

## 7. UI-componenten

Afzonderlijke componenten houden verantwoordelijkheden klein:

- `SidebarTimeHub`: plaatsing, upcominglijst en open/dicht-state;
- `AnalogClock`: SVG-klok met drie stijlvarianten;
- `DigitalClock`: 24-uursweergave met tabular cijfers;
- `ReminderCountdown`: lokale relatieve aftelling;
- `ReminderDetailDialog`: toegankelijke detail- en statusacties;
- `ReminderComposer`: persoonlijk of HR-formulier;
- `ReminderList`: servergevoede lijstweergave;
- `ClockPreferences`: instellingen en live preview.

De eerste serverrender bevat het actuele kloktype en de eerstvolgende reminders. Clientcode verzorgt alleen tijdanimatie, modals en gerichte mutatiefetches.

## 8. Foutafhandeling en toegankelijkheid

- Datum/tijd in het verleden wordt geweigerd bij nieuwe reminders.
- Een doelgroep zonder ontvangers kan niet worden gepubliceerd.
- Een ontvanger zonder auth-koppeling wordt niet gematerialiseerd en telt mee in een vooraf getoonde uitsluitingsmelding voor HR.
- Gelijktijdige publicatie wordt database-side geblokkeerd.
- Dialogs ondersteunen focusbeheer, Escape en duidelijke labels.
- Klokken hebben een tekstueel tijdalternatief voor screenreaders.
- Urgentie wordt nooit alleen met kleur gecommuniceerd.

## 9. Teststrategie

- Pure unit-tests voor countdownlabels, tijdzonegrenzen, klokhoeken en doelgroepsamenvatting.
- Zod-tests voor verleden tijd, scopecombinaties en statusacties.
- Database-integratietests voor self-only RLS, tenantisolatie, HR-permissions, afdelingmaterialisatie, deduplicatie en atomaire publicatie.
- Route-/servicetests voor 400, 403, 404, 409 en successcenario's.
- UI-verificatie voor drie klokmodi, drie analoge stijlen, ingeklapte/uitgeklapte sidebar, detailpopup en 390px mobiel.
- Volledige lint-, TypeScript-, i18n- en productiebuildcontrole; Supabase advisors en typegeneratie na migratie.

## 10. Buiten scope

- Browserpush, e-mail, sms en mobiele push.
- Herhalende reminders en complexe recurrence-regels.
- Vrij samengestelde of opgeslagen doelgroepen buiten afdelingen en medewerkers.
- Verplichte bevestiging dat een ontvanger de inhoud inhoudelijk heeft gelezen.
- Koppeling met Liquid Display of de toekomstige AI-agent; het datamodel blijft hiervoor wel geschikt.

## 11. Acceptatiecriteria

- Een gebruiker kan analoog, digitaal of verborgen kiezen en ziet de keuze na een nieuwe login terug.
- Iedere analoge stijl is visueel onderscheidend en themacompatibel.
- De sidebar toont maximaal drie komende reminders met een correct bijgewerkte aftelling.
- Persoonlijke reminders zijn volledig self-only.
- HR kan veilig naar iedereen, afdelingen of medewerkers publiceren en ziet vooraf het bereik.
- Iedere ontvanger kan onafhankelijk gereedmelden, uitstellen of verbergen.
- Een reminder die tijdens een sessie afloopt toont een toegankelijke in-app popup.
- Geen cross-tenant-, cross-administratie- of recipientdatalek is mogelijk.
