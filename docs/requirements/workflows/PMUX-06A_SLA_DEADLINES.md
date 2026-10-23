# PMUX-06A — Stap-SLA's en deadlines

Status: **LOKALE IMPLEMENTATIE GEREED; REMOTE EN BROWSERACCEPTATIE OPEN**
Datum: 23 oktober 2026
Roadmap: [PMUX geconsolideerde roadmap](PMUX_CONSOLIDATED_ROADMAP_20261022.md)

## Doel en grens

HR Admin kan voor een geschikte processtap een SLA kiezen. Bij activering legt de server de deadline vast op de actieve stap en het bijbehorende werkitem. Mijn werk, Focus, het startdashboard en procesdetail gebruiken daarna dezelfde deadlineprojectie. Bestaande gepubliceerde procesversies blijven immutable. Reminders en escalaties vallen onder PMUX-06B en zijn niet onderdeel van deze slice.

## Capabilitymatrix

| Onderdeel | Bestaand | Toegevoegd in PMUX-06A |
| --- | --- | --- |
| SLA-contract | `slaSchema` bevat getypeerde duur, eenheid en `businessDays`. | De Processtudio biedt geen deadline, uren, kalenderdagen en een geblokkeerde werkdagenoptie met uitleg. Compiler en UI weigeren werkdagen zolang geen eenduidige werkdag-/feestdagenkalender aan de procesdefinitie is gekoppeld. |
| Runtime en deadlinevelden | Actieve processtappen en werkitems hebben bestaande deadlinevelden; procesinstanties verwijzen naar een gepubliceerde versie. | Een lokale forward-only trigger berekent de deadline bij insertie van een actieve stap uit de gepinde versie en kopieert dezelfde waarde naar het nieuwe werkitem. Een legacy werkdag-SLA zonder kalender blokkeert activatie met een stabiele foutcode en gebruikersuitleg. Er wordt niet teruggerekend of bijgewerkt bij het lezen. |
| Tijdzone | Er bestond geen canonieke HR-groeptijdzone; de AI-creditgroepinstelling was uitsluitend als toekomstige bron gemarkeerd. | `hr_groups.time_zone` is een expliciete IANA-tijdzone met standaard `Europe/Amsterdam`, beheerbaar via de bestaande HR-groepinstelling en `hr-group:manage`. Deadlineberekening en presentatie gebruiken de actieve HR-groepcontext. |
| Mijn werk, Focus en dashboard | Bestaande work-item-/Focus-/dashboardprojecties en paginering. | Eén centrale statusprojectie levert deadline, resterende tijd en status. Urgentiesortering gebruikt de deadline. Het dashboard noemt aantallen expliciet als gebaseerd op de getoonde werkitems; bestaande querypaginering en tenantautorisatie zijn niet verruimd. |
| Procesdetail | Bestaande taak- en procesdetailprojectie. | Starttijd, verantwoordelijke, deadline, resterende tijd en verstreken status worden samen getoond in de actieve HR-groeptijdzone, voor zover bestaande autorisatie de gegevens toestaat. |
| Reminders en escalaties | Buiten deze slice. | Niet gewijzigd; gepland voor PMUX-06B. |

## Berekeningscontract

- **Starttijd:** `process_step_instances.activated_at`, vastgelegd wanneer de runtime de stap activeert. De SLA begint bij stapactivatie, onafhankelijk van de latere toewijzingsactie.
- **Minuten en uren:** verstreken tijd vanaf `activated_at`; een uur is 60 verstreken minuten.
- **Kalenderdagen:** tel het ingestelde aantal lokale kalenderdatums op bij de lokale wandkloktijd van `activated_at` in `hr_groups.time_zone`, en vertaal dat lokale tijdstip terug naar een instant. Weekenden tellen mee; een dag kan rond zomertijd 23 of 25 verstreken uren omvatten.
- **Werkdagen:** niet berekenbaar zolang geen gekwalificeerde kalender aan de stap/procesdefinitie is gekoppeld. De Studio toont de configuratieblokkade, de compiler blokkeert publicatie van zo'n definitie en de runtime blokkeert activatie van een legacy gepubliceerde versie met een begrijpelijke melding. Er wordt geen deadline verzonnen en een legacy stap wordt niet als "geen deadline" getoond.
- **Materialisatie en versie:** de trigger gebruikt uitsluitend de immutable `process_version_id` van de procesinstantie en de bijbehorende stap-SLA. De resulterende deadline wordt eenmaal op de actieve stap opgeslagen en exact naar het nieuwe werkitem gekopieerd. Een latere conceptwijziging of publicatie wijzigt een al actieve deadline niet. Er is geen stille backfill van reeds actieve werkitems.
- **Status:** `CLOSED` voor terminale/afgeronde werkitems; `OVERDUE` zodra de peildatum strikt na de deadline ligt; exact op de deadline blijft de taak nog niet overschreden; `NEAR_DUE` binnen 24 uur vóór de deadline; anders `ON_TRACK`. Een ontbrekende deadline wordt `NO_DEADLINE`.
- **Peildatum en sortering:** de server maakt één `asOf`-peildatum per lijstprojectie. Items met een deadline worden standaard op urgentie gesorteerd, met gesloten/geen-deadline-items daarna; filters, autorisaties, totaaltellingen en paginering blijven de bestaande serverquery gebruiken.

## Foundation- en toegankelijkheidsgebruik

De SLA-editor hergebruikt Foundation `RadioGroup` en `TextInput`; de tijdzone-instelling hergebruikt `DropdownSelect`; status en detail gebruiken bestaande `Badge`, `Surface`, `FormField` en de bestaande proces-, Focus- en dashboardlayouts. Er is geen nieuwe generieke UI-primitive geïntroduceerd. NL- en EN-labels komen uit de bestaande `processAutomation`, `startpage` en `settings`-namespaces. Deadline-status bevat tekst naast een semantische badge en is niet alleen met kleur herkenbaar.

## Lokale acceptatie

Lokale tests bewijzen uren versus kalenderdagen, weekendinclusie, Nederlandse en UTC-zomertijdwisselingen, geen SLA, werkdagblokkade, grensmoment, overschrijding, afgeronde items, herhaalde stapactivatie/materialisatie, tenant-/groepsisolatie en onveranderde opgeslagen deadlines nadat de groepszone wijzigt. PMUX-05A/B/C-conditie-, runtime-, veldrechten- en immutable-version-pin-regressies zijn meegenomen.

Zie [PMUX-06A lokale acceptatie](../../quality/acceptance/runs/PMUX-06A-20261023-LOCAL.md). Geen remote migratie, databasewrite, browserlogin, push, merge of deployment is uitgevoerd. Hosted readback en echte desktop-/390px-browseracceptatie blijven afzonderlijk OPEN.
