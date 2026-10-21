# LIQUIDHR-POSTRELEASE-STATUS-20261021 — Git/Vercel, cleanup, acceptatie en hervatting

**Peildatum:** 21 oktober 2026, na de door de producteigenaar gedeelde CLEANUP-07/08/09-resultaten.  
**Bronnen:** Codex-eindrapporten zoals door de gebruiker gedeeld; onafhankelijke GitHub `main`-, branch-/PR- en Vercel deployment-/aliasreadbacks waar genoemd. **Deze statusregistratie is geen opnieuw uitgevoerde lokale test of fiscale certificering.**  
**Productcode-release:** `1.20261021.1`, source SHA `c0fa236967ec0708c0a57f72e0dfb29b78b3fead`.  
**Vercel Production-target:** `dpl_CuyAgvBwHr5z9bXNv52Np7SaTxb9`, `READY` op diezelfde Git-SHA, bron Git/`main`. De targetnaam Production is **geen claim van live klantpayroll/commerciële GA**.

## 1. Stand na gezamenlijke integratie en deployment

- STAR V2, Employee UX, Core/Payroll en AI/MCP/Focus zijn geïntegreerd in **één productcode-release**. Geen nieuwe merge van oude featurebranches of tweede integratie-app.
- De drie actuele aliases verwijzen naar dezelfde deployment: `liquid-hr-hr-suite.vercel.app`, `liquidhr-edwinitsolutions.vercel.app` en `liquidhr-git-main-edwinitsolutions.vercel.app`.
- Vorige werkende deployment `dpl_9WkAbLQMgfAZW6RhkytzGiJGV1LR` (code `c03a8ddc806042add0683f120f592540396018b3`) blijft bewust beschikbaar als rollback; niet opruimen zonder apart akkoord.
- Runtimeprovenance `buildId` en `publicRuntimeFingerprint` waren via de Vercel filetree-API niet onafhankelijk uitleesbaar; de writer werd tijdens build met de juiste `sourceCommit` uitgevoerd. Verifieer die twee artifactvelden niet achteraf bij aanname.
- De oudere `LIQUIDHR-CONVERGENCE-03-20261021.md` bevat correct de *toenmalige* LOCAL GREEN / HOSTED HOLD-gate vóór release en wordt niet retroactief herschreven. Dit document is de latere postrelease-aanvulling.
- **Documentatie-only commits na `c0fa2369` veranderen de GitHub Development-baseline; zij veranderen de al uitgerolde Vercel-runtime niet.** De productcode blijft exact de genoemde source-SHA totdat een afzonderlijke nieuwe release wordt geautoriseerd. Lokale main moet zo nodig daarna fast-forward worden bijgewerkt.

## 2. Production-smoke op 21 oktober (gerapporteerd)

**Geobserveerd via ingelogde browser:**
- HR Admin-dashboard in De Sterren holding / Planeten / Jupiter; STAR Insights toont medewerkers en talentgegevens binnen scope (eerder 35/11).
- Payroll-hoofdoverzicht toont opgeslagen salarisruns.
- Employee-dashboard met eigen Journey; `Mijn salaris` is bereikbaar maar toont in de gekozen Employee-context geen definitieve loonstroken; dat alleen bewijst geen productdefect.
- HeRa-paneel opent en tekstinput wordt actief.

**Nog OPEN:**
1. **P0: `/payroll/runs` blijft op een laadscherm staan**, terwijl het Payroll-hoofdoverzicht werkt. Volgende separate CONTROLLED bugfix: één authentieke HR Admin-reproductie, read-only network/server/loaderdiagnose, klein herstel en gerichte positieve/negatieve scopechecks; geen salaris- of databasewrites.
2. Geen afgeronde geauthenticeerde paysliproute met een bekende FINALIZED Employee-acteur in deze hosted smoke.
3. Geen verzonden HeRa-prompt / geen aangetoonde AI-generatie of end-to-end remote MCP-hostrespons.
4. Focus-widget ChatGPT-host/CSP/consent/revoke/logout/rolwisseling blijft open.
5. Artifact fingerprint, Deploy Hook-caller en overige gerichte securityacceptaties zijn niet volledig afgetekend.

Er zijn bij deze smoke **geen** businessdata, FINALIZED-runs, betaalopdrachten, aangiften of migraties gewijzigd.

## 3. CLEANUP-07 — remote resultaten

**GitHub:** 10 remote branches verwijderd nadat `ahead_by=0` tegen `main` en het ontbreken van open PR-heads waren vastgesteld. GitHub `main` bleef op de release-SHA; er resteren volgens readback **11 GitHub branches (main + tien vooruit-/afwijkende branches)**. De vijf open Draft PR's #28, #30, #31, #32 en #33 zijn bewust niet gesloten; afwijkende branchcommits zijn niet automatisch bewijs van unieke functionaliteit. AI PR #27 en #29 zijn inmiddels **merged/closed**.

**Vercel:** negen verweesde Preview-aliases verwijderd, nadat hun doeldeployments `404/not_found` gaven; ook de foutgelopen CLI-deployment `dpl_5y2HzPxCdoWpramQM9tjNLuuToBw` is verwijderd met readback 404. De drie productiealiases en beide READY-deployments zijn behouden.

**Deploy Hook:** historische hook naar `work/ai-gpt-live` behouden; externe caller niet vastgesteld (beperkte API-toegang). Geen onbewezen claim dat die hook veilig is of al is ingetrokken.

## 4. CLEANUP-08/09 — lokale resultaten (Codex-verslag; geen directe Windows-readback vanuit GitHub)

- **29 → 20 → 2 geregistreerde worktrees**; de primaire checkout staat op `C:\Users\Edwin\Documents\Apps\LiquidHR`, schone `main`, code-release-SHA `c0fa236967ec0708c0a57f72e0dfb29b78b3fead`.
- De enige andere werkboom: `C:\Users\Edwin\.codex\worktrees\payroll-p0-p1\LiquidHR`, hersteld op branch `work/payroll-p0-p1` / checkpoint `4f99b04e`. De werkboom bestaat, maar zijn runtime is **geblokkeerd door ontbrekende oorspronkelijke configuratie**.
- Unieke code en niet-gecommitte wijzigingen zijn volgens Codex behouden via branchrefs en lokale herstelstashes. Voorbeelden: STAR `61360d4f`; PAY-CONVERGE `a607c070`; PAYCASE `526a1689`; PAYFULL `4075ed94`; PAYINTEGRATE `f8f1326e` / `e38125c6`. De bestaande APIAI-stash `a3a8b82f79fd577d155f8d038b7f3e7d43cc5fcd` blijft beschermd.
- Twee afwijkende lokale configuraties en een PAYDOC-PDF zijn hashgeverifieerd opgeslagen in een ACL-afgeschermd **lokaal** archief: `C:\Users\Edwin\AppData\Local\LiquidHR\WorktreeConfigArchive\cleanup09-20261021`. Geen geheimen in GitHub opnemen.
- Codex rapporteerde dat ook oude Playwright-logs, tijdelijke snapshots en duizenden gegenereerde untracked bestanden zijn opgeruimd. Geen acceptatiebewijs weggooien dat niet elders reproduceerbaar is.
- **Incident:** door een slashverschil is de beschermde `work/payroll-p0-p1`-worktree tijdelijk verwijderd. De branch kon worden hersteld maar het unieke **519-byte** bestand `apps/hr-suite/.env.local` was niet teruggevonden. De centrale config verschilt en is uitdrukkelijk **niet** als vervanging gebruikt. Dit is **OPEN / CONFIG RECOVERY**; niet verdoezelen als 'volledig schoon'.
- GitHub-code, bestaande Vercel deployment en businessdatabase zijn tijdens CLEANUP-08/09 volgens Codex **niet gewijzigd**. Productiegerelateerde validatie is niet opnieuw gedraaid.

### P0 veiligheidsafspraak — CONFIG-RECOVERY-01

Herstel alleen uit de **oorspronkelijke** beveiligde opslag of aantoonbaar identieke lokale back-up: controleer lokaal veilig metadata/hash/herkomst in bestaande ACL-archieven, File History, Prullenbak of herstelbare snapshots. Lees/log geen secrets. Geen centrale config overschrijven, geen waarden gokken, geen nieuwe credentials, geen geautomatiseerde database-, GitHub- of Vercel-actie. Als het origineel niet terug te vinden is: **BLOCKED**, gebruik de beschermde Payroll/Nmbrs-runtime niet, en vraag de eigenaar om herstel uit de oorspronkelijke secretbron. Bescherm de herstelstashes; geen `git stash clear/drop` of `git gc` als onderdeel van deze taak.

## 5. Payroll-productstatus

- **Frits / Jupiter november 2026:** opgeslagen **CONCEPT**, run `d8508395-2e25-59be-bc0b-ff2f0b83f7dc`. Kinderopvang `2026.09`, schaal 6 salarisnummer 12, 24/36 uur, contractueel bruto € 1.879,33; werknemerspensioen € 118,57; loonheffing € 49,92; **€ 1.710,84 na die inhoudingen, nadrukkelijk nog niet definitief nettoloon**; totale werkgeverskosten € 2.689,17. Geen FINALIZED/PDF/betaal-/aangiftebewijs.
- Werkgeverparameters, waaronder fictieve Whk 1,52%, en openingscumulatieven zijn voor het expliciet geautoriseerde **fictieve acceptatiescenario** gesimuleerd; nooit als officiële beschikkingen, betaald loon of echte werkgevershistorie presenteren.
- Historische Mars FINALIZED-cases (waaronder Emma/Noah) met PDF/hash blijven apart gedateerd bewijs, niet opnieuw berekenen of muteren.
- Cao-/pensioenbronkwaliteit, officiële deelname, full netto/payslip/finalization van nieuwe cases, jaaropgaaf, meerdere IKV, uitgaande aangiften en betalingen blijven afzonderlijke GA-gates.
- `PAYROLL-CORE-RESET-01`: afgeronde **gerichte Jupiter/Frits-configuratie** niet verwarren met volledige bredere reset van alle proefadministraties Mars/Jupiter/Mercurius; niet als generiek volledig voltooid boeken.

## 6. Overige productmodules, roadmap en GO

- **STAR V2:** geïntegreerde code en positieve hosted HR Admin smoke; rapportages 9-grid, talentpaspoort (HR/Manager), skills, POP, campagnehistorie en Continuous Appraisal aanwezig. Reeds lokaal geaccepteerde 04D-subwaves behouden eigen gedateerde bewijs; geen onnodige nieuwe STAR-merge.
- **Employee UX:** gescheiden kaartkop-/actieregels, Activa/Wagenpark/Software/Budgetten verborgen op medewerkerprofiel, Opleidingen zichtbaar, kaartvolgorde behouden; desktop/390px eerder geaccepteerd.
- **AI:** 8 Employee READ + 6 Manager READ + 2 Focus-protocoltools geïntegreerd; consent en RLS blijven server-side. Code van PR #27/#29 is geïntegreerd, echte ChatGPT-Host/Focus-eindacceptatie blijft OPEN. Geen nieuwe autonome schrijfacties.
- **GO voor afgebakende nieuwe niet-Payroll-features** op een schone `main`, mits gewone per-feature gate, branchmandaat en risico-/securitychecks; onopgeloste Payroll-config maakt deze niet afhankelijk.
- **HOLD voor gebruik van de beschermde Payroll/Nmbrs-runtime** tot origineel `.env.local` hersteld; houd de `/payroll/runs`-bugfix als eerste Payroll-ontwikkelactie.
- Korte Core-volgorde na stabilisatie: WVP01 (Wet verbetering poortwachter) → INS02 (Report Consistency + Headcount/FTE) → AW02 later. PMUX-02/03 en verdere Employee UX zijn planned; niet als geleverd registreren.
- Strategische Payroll-differentiatoren Flightdeck, Evidence Graph, Cao/Pension Autopilot, Time Machine, AI Copilot zijn **roadmap**, geen actuele GA-functies.

## 7. Werkafspraken en volgende aftekenpunten

1. `CONFIG-RECOVERY-01`: één bounded read-only herstelpoging; stop met expliciet BLOCKED als originele bron ontbreekt.
2. `PAYRUN-ROUTE-01`: gerichte diagnostic/fix van geauthenticeerde `/payroll/runs`; patchrelease alleen na apart releasebesluit en expliciete herhaalde gate.
3. Gerichte hosted ESS payslip met juiste actor, HeRa generatie/MCP, Focus-host security en buildprovenance-readback afronden voor de betreffende productgates.
4. AA-CURRENT, AA-ACCEPT, AA-OPEN, AA-NEXT, AA-ROAD, AA-REL en AI-/Payroll-overzichten wijzen naar deze status. **Historische runrapporten niet retroactief overschrijven.**
5. Geen nieuwe dump van grote oude worktrees of hernieuwde megamerge. Branchrefs/herstelstashes blijven bewaard tot aparte functionele reconciliatie met diff-evidence.
6. **Geen automatische Production-deploy van documentatie.** LOCAL FIRST → GITHUB CONTINUOUS → VERCEL ON DEMAND. GitHub `main` kan bij docs-only merges een latere SHA krijgen dan de ongewijzigde Vercel runtime; rapporteer beide afzonderlijk en synchroniseer de lokale ontwikkelcheckout via fast-forward.
