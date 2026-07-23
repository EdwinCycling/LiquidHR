# Uitvoeringsplan: verlofopbouw, werkuren en voorrangsregels

Actuele uitvoeringsstatus 2026-07-22: stap 1 t/m 5, de priority-sub-slice en de eerste centrale ledger-/aanvraag-slice van stap 6/8 zijn gerealiseerd en remote/gebruiker-geauthenticeerd gecontroleerd. De settings-jaarsturing, startsaldo-, correctie-, carry-forward- en verval-RPC's zijn aanwezig; feestdagen worden in meerdaagse aanvragen overgeslagen. Volledige auditformulieren, periodieke eindjaarsprognose en latere ESS/notificaties blijven open.

Status: **IN UITVOERING — configuratie, ledgerbasis en HR-admin-aanvraag gereed; rapport- en latere workflow-uitbreidingen open**

Scope: HR-adminconfiguratie en de achterliggende verlof-engine. De aanvraagflow vanuit de HR-adminkalender is toegevoegd als latere stap 8; ESS/selfservice blijft buiten scope.

Leidend requirementsdocument: `docs/requirements/leave/VERLOF_OPBOUW_ENGINE.md`

## Doel

Bouw de beheerslice op `/settings/leave-accrual` volgens `schema → API → UI`. De slice configureert verloftypen, gewone werkuren, overwerk en informatieve planningsuren; profielgebonden, versioneerbare opbouwregels; bonus- en voorrangsregels; jaarafsluiting en saldo-audit. Alle berekeningen en het medewerker-/managerrapport zijn per dienstverband.

## Stap 1 — Databasefundering, beveiliging en rechten

Maak één samenhangende migratiereeks voor de verlofconfiguratie, werkurentypen/-entries, profieltoewijzingen, versioneerbare opbouwregels, pauzekoppelingen, bonusregels/treden, priority-rules/items, jaarsturing, buckets, grootboek, carry-forward-snapshots en openingssaldi. Voeg constraints toe voor tenant/administratiegelijkheid, datumketens zonder gaten/overlap, unieke sorteringen en idempotente bronverwerking. Voeg RLS, expliciete grants, audittriggers en canonieke permissions toe: minimaal `leave:read`, `leave:write` en `self:leave:read`.

Bouw de databaseproeven voor isolatie, regelketens, locked years en carry-forward mee in dezelfde stap. De migraties, remote toepassing, structuurstest, typesgeneratie en Supabase advisors zijn uitgevoerd; lokale Docker-validatie blijft open.

Voorbeeldscherm: **niet nodig**; dit is uitsluitend de veilige fundering.

## Stap 2 — Pure verlof-engine en rapportprojectie

Maak `lib/leave/` met co-located types, Zod-schema's en pure testbare berekeningen voor:

- contracturen-, gewerkte-uren- en overwerkopbouw;
- configureerbare ratio per regel, opbouwpauzes en `UPFRONT`/`ARREARS`;
- bonus-treden op verjaardag/anciënniteitsdatum;
- startbucket, vervaljob, jaarafsluiting en carry-forward zonder dubbeltelling;
- `getLeaveBalanceReport(employmentId, asOfDate)` met beginjaarsaldo, overhevelingen, saldo nu, eindprognose, maandmomenten, verval, handmatige mutaties en de toekomstige opnamekolom;
- FIFO-voorbereiding op priority-rules, zonder aanvragen daadwerkelijk te boeken.

**Gerealiseerd:** `leave-engine.ts` en `report.ts` met test-first berekeningen voor contracturen, goedgekeurde werk-/overwerkuren, informatieve uitsluiting, ratio/pauze, boekingsmoment, payroll-frequentiefout, bonus/triggers, verval, FIFO en per-employment rapportprojectie. De centrale schrijfweg naar buckets/transacties en de job/jaarafsluiting blijven open.

Voorbeeldscherm: **optioneel**; een voorbeeld van het gewenste saldo-overzicht is nuttig om de rapportvelden en volgorde te bevestigen.

## Stap 3 — Server-API's en autorisatiecontracten

Voeg compacte API-routes toe voor de configuratie en voor het saldo-rapport. Iedere route begint met `requirePermission()`, valideert via de schemas uit stap 2 en gebruikt de RLS-gebonden serverclient. De route voor medewerker/manager accepteert alleen `employmentId` en peildatum; scope wordt server-side bepaald.

**Gerealiseerd:** `/api/leave/balance-report` en `/api/leave/catalog` met auth/RLS-scope, automatische keuze van het enige actieve dienstverband, selectiegegevens bij meerdere parallelle dienstverbanden, catalogus-GET, catalogusmutaties, opvolgers, bonusregels, priority-configuratie en profieltoewijzingen. Startsaldoboekingen, centrale bucket-/grootboekmutaties, jaarafsluiting en handmatige saldo-correcties blijven bewust open tot de centrale mutatie-engine is toegevoegd.

Voorbeeldscherm: **niet nodig**; de API is afgeleid van de requirements en wordt door tests vastgelegd.

## Stap 4 — HR-admin: verlof- en urenstamgegevens

Voeg de tegel **Verlofopbouw** toe aan de HR-inrichting op `/settings` en bouw `/settings/leave-accrual`. Start met de catalogi:

- verloftype met rechtvorm: opbouw, onbeperkt, vaste jaarlimiet of weekurenfactor;
- gewone werkuren, overwerk en informatieve planningsuren;
- veilige archivering/activering zonder historische referenties te breken.

Gebruik bestaande `AdminSettingsPageHeader`, settings-accordions, i18n-namespaces en server-rendered data. Geen zichtbare tekst in componenten.

Voorbeeldscherm: **ja** — een voorbeeld voor de hoofdindeling en voor de formulieren van verloftype en werkuren/planningsuren.

## Stap 5 — HR-admin: profielen en versiegebonden opbouwregels

Bouw het profieloverzicht en de regel-editor. Per profiel en verloftype toont de UI de keten van voorganger/opvolgers, geldigheidsdata en lock-status. De gebruiker selecteert een versie om details te bekijken; **Wijzigen** maakt een opvolger met een direct aansluitende startdatum.

De editor configureert frequentie/periode, moment, opbouwhoeveelheid of gewerkte-urenratio, gekoppelde werkuren-/overwerktypen, opbouwpauze-typen, vervaltermijn en individuele uitzonderingen. Voeg de bonusregel- en tier-editor toe als subsectie van het profiel.

Voorbeeldscherm: **ja** — vooral de regelketen/tijdlijn en het opbouwregel-formulier met gekoppelde uren- en pauzetypen.

## Stap 6 — HR-admin: voorrangsregels, jaarafsluiting en saldo-audit

Bouw de priority-rule-bundels per profiel. De beheerder geeft de bundel een naam, geldigheidsperiode en actieve status, voegt verloftypen toe en bepaalt de afboekvolgorde. Toon een live, niet-mutatieve preview: bundel → verloftypevolgorde → FIFO op dichtstbijzijnde vervaldatum.

Voeg jaarsturing toe met afsluitpreview: ieder over te dragen bucket, resterend saldo en vervaldatum. Na een bevestigde jaarafsluiting toont de UI de carry-forward-snapshot en de geblokkeerde regelversies. Voeg de saldo-audit per dienstverband/type toe, met de rapportgegevens uit stap 2 en handmatige plus-/mincorrectie met reden.

Voorbeeldscherm: **ja** — voor de drag-/toetsenbordvolgorde van de bundel, de afsluitpreview en de saldo-/mutatieaudit.

## Stap 7 — Integratie, kwaliteitsgate en oplevering

Vul `messages/nl/leave.json` en `messages/en/leave.json` volledig en voeg de settings-tegel, routezichtbaarheid en permission-seeds samen. Werk `docs/README.md`, `IMPLEMENTATION_STATUS.md` en `CURRENT_CONTEXT.md` bij met de gerealiseerde slice en eventuele bewust resterende onderdelen.

Voer de HRMyDay-releasegate uit: gerichte en volledige Vitest-suite, ESLint, strict TypeScript, i18n-pariteit, productiebuild, typesgeneratie, Supabase advisors, positieve en negatieve database-/RLS-proeven, ingelogde browsercontrole op poort 3000 en publieke preview op desktop en 390px. Controleer specifiek parallelle dienstverbanden, manager-/selfscope, regelopvolgers, locked years, carry-forward, opbouwpauze en FIFO-preview.

Voorbeeldscherm: **optioneel**; alleen een eindbeeld om visueel te vergelijken tijdens de browsercontrole.

## Stap 8 — HR-admin: verlof aanvragen vanuit de medewerkerskalender

De functionele bron voor deze stap is `docs/requirements/leave/VERLOF_AANVRAAG_HR_ADMIN.md`. De stap start pas nadat de centrale bucket-/grootboekengine, jaarafsluiting en saldo-audit uit stap 6 veilig zijn afgerond.

Voeg de nieuwe permission `leave:request` toe aan de bestaande tenantbrede rechtenmatrix. `TENANT_ADMIN` (HR-admin/Hoofdbeheerder) krijgt deze standaard; aanvullende managementrollen zijn selecteerbaar. Een geautoriseerde manager mag direct goedgekeurd boeken binnen zijn bestaande scope. Medewerkers krijgen deze permission nooit. De actor moet daarnaast kalender- en managementscope hebben. Voeg in het bestaande harmonica-menu onder **Medewerker**, boven **Acties**, de acties **Verlof aanvragen via voorrangsregels** en **Verlof aanvragen zonder voorrangsregels** toe.

De aanvraag werkt per `Employment`. Bij één actief dienstverband kiest de server dit automatisch; bij meerdere parallelle dienstverbanden kiest de actor eerst expliciet het dienstverband. Er wordt nooit over employments heen geaggregeerd.

De priority-flow kiest geen, één of meerdere geldige bundels correct: blokkeren, automatisch tonen of laten selecteren. De UI toont per bundel en verloftype zowel saldo nu als saldo einde kalenderjaar, waarbij die laatste prognose toekomstige opbouw bevat. De directe flow toont alle actieve verloftypen, met per type saldo nu, saldo einde jaar of onbeperkt, en kiest exact één type zonder automatische fallback. Beide flows ondersteunen één volledige dag, voormiddag, namiddag of specifieke uren; voormiddag en namiddag gebruiken dezelfde per administratie configureerbare duur, standaard vier uur. Een meerdaagse reeks gebruikt start-/einddatum en volledige geplande dagen; feestdagen worden overgeslagen. De server berekent minuten op basis van de effectieve roostering, controleert saldo/limieten en boekt direct goedgekeurd via één atomische, geauditeerde en idempotente engineactie.

Technische subfasen binnen deze stap blijven `schema → API → UI`: permission/RLS/audit en aanvraagallocaties; configuratie voor halve-dagduur; pure rooster-, beschikbaarheids-, FIFO- en idempotentiecontracten; preview/confirm-API; kalenderformulier en bevestiging; daarna positieve/negatieve tests en browsercontrole. ESS, medewerker-selfservice, managergoedkeuring en functiegroepnotificatie blijven uitdrukkelijk buiten deze stap.

Voorbeeldschermen: **ja** — de drie aangeleverde beelden dekken de priority-formulierindeling en detailweergave. Voor de implementatie zijn nog nuttig: harmonica-menu met beide acties, directe aanvraag zonder priority, bevestigde boeking en blokkade bij onvoldoende saldo.

## Skills en loop

- De `plan`-skill is gebruikt om dit uitvoeringsplan af te bakenen. Subagents worden niet gebruikt: `AGENTS.md` verbiedt delegatie in dit project.
- Bij uitvoering geldt de Supabase-skill voor migratie, RLS, grants, types en advisors.
- De opgeslagen **HRMyDay releasegate** uit `LOOPS.md` is stap 7 en is verplicht voordat deze verticale slice als klaar wordt gemeld.
