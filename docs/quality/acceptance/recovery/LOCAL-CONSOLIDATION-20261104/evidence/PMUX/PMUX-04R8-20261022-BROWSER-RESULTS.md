# PMUX-04R8 — browseracceptatie en screenshotindex (22 oktober 2026)

**Verdict: PARTIAL / HOLD.** De volledige Opleidingsaanvraag-E2E is niet veilig uitvoerbaar of geaccepteerd.

## Runcontext

- Worktree: `C:\Users\Edwin\.codex\worktrees\branch-split-pmux-20261021\LiquidHR`
- Branch/HEAD: `work/BRANCH-SPLIT-PMUX-20261021` / `19656935a2f2d329f18157a9d2cd0c0fc88257d5`
- De bestaande `scripts/start-test-worktree.ps1 -Mode Development -Port 3011`-launcher gebruikte de centrale TEST-configuratie. De lokale runtime is na de run gestopt. Poort 3010 en andere worktrees zijn niet benaderd.
- `scripts/check-test-personas.ps1 -SkipBrowser` controleerde de canonieke Payroll-personacatalogus en beschermde configuratie zonder waarden te tonen. De browserchecks zijn bewust overgeslagen; de Payroll-persona's kregen daarom geen READY-status en zijn niet gebruikt.
- Bestaande dirty bestanden zijn ongewijzigd gebleven; hun SHA-256-hashes zijn gelijk aan de runstart. Er is geen commit, push, merge of deployment gedaan.

## Feitelijk beschikbare rollen

| Rol | Browserbewijs |
| --- | --- |
| HR Admin — `TENANT_ADMIN`, Planeten/Jupiter BV | Bestaande geauthenticeerde sessie beschikbaar. Dashboard, Processtudio, Mijn aanvragen, Mijn werk en Focus laadden. |
| Owner | Geen geverifieerde ownersessie beschikbaar. Geen accountwissel uitgevoerd. |
| Manager | Geen ondersteunde geauthenticeerde sessie beschikbaar; niet getest. |
| Medewerker | Geen ondersteunde geauthenticeerde sessie beschikbaar; niet getest. |

De bestaande lokale accountwisselpagina is alleen bekeken. Zij rapporteerde `TENANT_ADMIN` en toonde alleen bestaande Payroll-doelen; er is geen doelaccount gekozen en geen identiteit gewisseld. Dit levert geen owner-, Manager- of Medewerkerbewijs op.

## Screenshotindex

De verse R8-screenshots hieronder zijn echte In-App Browser-captures die inline in deze Codex-run zijn getoond. De beschikbare IAB-capture leverde beelden van **998×720**; er is geen lokaal bestandspad of 390×844 viewportoverride beschikbaar gesteld.

| ID | Persona | Pagina | Waarneming | Bestand |
| --- | --- | --- | --- | --- |
| R8-01 | HR Admin | `/dashboard/start` | Dashboard geladen | Inline; niet als bestand opgeslagen |
| R8-02 | HR Admin | `/settings/process-automation` | Processtudio geladen; 24 definities zichtbaar | Inline; niet als bestand opgeslagen |
| R8-03 | HR Admin | Formulierenstudio-stap voor gepubliceerde Verlofaanvraag | De stap opent; voor deze geselecteerde definitie staat geen gekoppeld formulier (`Geen waarde`) | Alleen toegankelijkheidsboom; geen R8-beeldbestand |
| R8-04 | HR Admin | `/work?view=REQUESTS` | Aanvraagcatalogus en starters zichtbaar; niets gestart | Inline; niet als bestand opgeslagen |
| R8-05 | HR Admin | `/work` | Mijn werk geladen; 8 items; geen item geopend of gewijzigd | Inline; niet als bestand opgeslagen |
| R8-06 | HR Admin | `/focus` | Focus-overzicht geladen | Inline; niet als bestand opgeslagen |
| R8-07 | HR Admin | `/focus/werk` | Focus-werk geladen; 8 items; geen item geopend of gewijzigd | Inline; niet als bestand opgeslagen |
| R8-08 | HR Admin | `/local/personas` | `TENANT_ADMIN` en bestaande Payroll-doelen zichtbaar; geen wissel uitgevoerd | Inline; niet als bestand opgeslagen |

Bestaande PNG-bestanden zijn als PNG gevalideerd; hun pixelmaten zijn in deze run gecontroleerd. Dit zijn **R5-diagnostiekbestanden**, geen nieuwe R8-captures:

| Bestand | Scherm / grootte | Betekenis |
| --- | --- | --- |
| [PMUX04-R5-ADMIN-STUDIO-D.png](PMUX-04-20261021-TEST-ACCEPTANCE/PMUX04-R5-ADMIN-STUDIO-D.png) | Processtudio, 1440×900 | Historische HR Admin-capture |
| [PMUX04-R5-ADMIN-FORM-STUDIO-D.png](PMUX-04-20261021-TEST-ACCEPTANCE/PMUX04-R5-ADMIN-FORM-STUDIO-D.png) | Formulierenstudio, 1440×900 | Historische gepubliceerde R5-definitie |
| [PMUX04-R5-ADMIN-FORM-STUDIO-M.png](PMUX-04-20261021-TEST-ACCEPTANCE/PMUX04-R5-ADMIN-FORM-STUDIO-M.png) | Formulierenstudio, 390×844 | Historische mobiele veld- en rechtenweergave |
| [PMUX04-R5-ADMIN-WORK-D.png](PMUX-04-20261021-TEST-ACCEPTANCE/PMUX04-R5-ADMIN-WORK-D.png) | Mijn aanvragen, 1440×900 | Historische **pre-fix** capture waarop de dubbele starterpresentatie zichtbaar was |
| [PMUX04-R5-ROLE-SWITCHER-D.png](PMUX-04-20261021-TEST-ACCEPTANCE/PMUX04-R5-ROLE-SWITCHER-D.png) | Lokale accountwisselpagina, 1440×900 | Historische HR Admin-context |

Nieuwe R8-captures zijn niet naar PNG-bestanden opgeslagen: de ondersteunde In-App Browser toonde de captures inline en bood geen lokale export. De losse Playwright CLI-sessie bleef niet open tussen commando's. Ik heb geen browserbeleid omzeild en geen nieuwe browser of testharnas geïnstalleerd.

## Mobiele breedte en starters

- R6 legde eerder in een echte browser op **390×844** vast: pagina `390/390`; studio-main, catalogus en flow elk `335/335`. De procesautomatiseringscode is sinds R6 onveranderd op deze branch; deze meting is dus hergebruikt, niet opnieuw vastgelegd in R8. Zie [PMUX-04R6 lokale acceptatie](PMUX-04R6-20261022-LOCAL.md).
- In de actuele R8-aanvraagcatalogus staan de twee directe native starters (`Interne overplaatsing starten`, `Documentkennisname starten`) en één afzonderlijke kaart `R5-TEST — Overdue interne overplaatsing`. De eerder zichtbare dubbele native cataloguskaarten `R5-TEST — Interne overplaatsing` en `R5-TEST — Document bevestiging` staan hier niet. Geen starter is aangeklikt.
- Een nieuwe 390×844-PNG van de gecorrigeerde Processtudio ontbreekt; daarvoor blijft de R6-meting het bewijs.

## Autorisatie en procesveiligheid

- **Positief, paginaniveau:** de bestaande HR Admin-sessie opende `/settings/process-automation`.
- **Negatief, paginaniveau:** een verse anonieme Playwright-navigatie naar `/settings/process-automation` eindigde op `/login?next=...`.
- Geen Manager-/Medewerker-JWT, directe API/RPC-, tenant-, HR-groep-, administratie- of out-of-scope-negatieve controle is uitgevoerd.
- De zichtbare proceslijst bevatte 24 definities; daarin was geen Opleidingsaanvraag zichtbaar. Er is geen Opleidingsaanvraag aangemaakt, gestart of gepubliceerd.
- Er zijn geen migraties, TEST-businessdatawrites, rolwissels of andere procesmutaties uitgevoerd.

**Volledige Opleidingsaanvraag-E2E: HOLD.** De relevante securitygate is niet groen en de echte owner-, Manager- en Medewerker-sessies ontbreken. De browserwaarnemingen en beschikbare R6-meting vervangen die gates niet.
