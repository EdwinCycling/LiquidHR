# AA-CURRENT — Current LiquidHR State

Status: **ACTUEEL / LIVING**  
Momentopname: 2026-10-01

> Deze eerste opzet is geschreven terwijl CONVERGENCE01 nog loopt. Na GREEN/RELEASED moet dit document direct worden bijgewerkt naar de definitieve release-SHA en versie.

## Canonieke repository

- Repo: `EdwinCycling/LiquidHR`
- Canonieke branch: `main`
- Canonieke Vercel HR-app: `liquidhr`
- Canonieke Supabase TEST/projectomgeving: `wnpfloqpjvaacobppbpk`
- Eén operationele LiquidHR-omgeving; Vercel “Production” is deploymentchannelnaam.

## Laatste volledig vrijgegeven baseline vóór CONVERGENCE01

- `main/origin/main`: `3a0fc67f84bc7dab0acff732afab597142d59ea9`
- appversie: `1.20260927.3`
- ABS02 is inhoudelijk afgerond en deployed.
- Hosted provenance had beperkte metadata-evidencegaps, niet opnieuw openen als productdefect.


## Payroll Lab — PAYLAB00/01/02/03

Payroll wordt niet als aparte gebruikersapp ontwikkeld. Het is een bounded context binnen dezelfde LiquidHR-app/repository, met een pure `packages/payroll-engine` en een aparte Payroll Lab Supabase-database.

Ontwikkelwerkplek:
- worktree: `LiquidHR-Payroll/Code`;
- branch: `work/paylab00`;
- niet gepusht, niet gemerged, niet gedeployed.

PAYLAB00:
- **ENVIRONMENT-GATED / CLOSED**;
- isolation foundation en separate Payroll Lab-database staan;
- Core bleef ongewijzigd.

PAYLAB01:
- **PARTIAL**;
- server-only source adapter + canonical source snapshot gebouwd;
- live Core→snapshot browserbewijs bleef buiten die slice/open door eerdere auth/environmentissues;
- IncomeRelationship/CONTROL02 en fiscale source gaps blijven expliciet.

PAYLAB02 / Engine M0:
- **GREEN voor synthetic M0-scope** op 2026-09-30;
- authenticated HR Admin Test Auth browserflow: Payroll → Payroll Lab → Bereken test payroll;
- run `SUCCEEDED`;
- 9 componentresultaten;
- trace;
- 7 controls PASS;
- GC-NL-001 netto € 3.175,00;
- totale werkgeverskosten € 4.910,00;
- herhaalrun met identieke source/input/result hashes;
- SYSTEM / CUSTOMER_FORK / CUSTOMER_CUSTOM ownership + provenance aanwezig;
- veilige bounded typed expression engine aanwezig;
- productiebuild, typecheck, changed-area lint, i18n en client-secret scan GREEN;
- separate Payroll Lab persistence/readback bewezen;
- alleen expliciet goedgekeurde Lab-testcontextkoppeling toegepast;
- geen Core-writes of permissionwijzigingen.

Bewijsgrens:
PAYLAB02 bewijst de generieke componentengine + synthetic vertical slice; deze synthetic GC blijft als regressiecase naast de afzonderlijke PAYLAB03 compliancecase bestaan.

PAYLAB03 / NL 2026 regular monthly wage:
- **GREEN — uitsluitend WHITE/NL/STD/onder AOW/reguliere volledige maand 2026**; loonheffingskorting aan, en korting uit in de geteste formulevariant.
- CC-NL-2026-001: bruto/fiscaal loon € 4.000,00 → echte loonheffing € 818,67 → netto € 3.181,33.
- Systeemregelset `NL-PAYROLL-2026` versie `2026.1`, engine `0.2.0`; SYS-only registered statutory rule, exact Decimal/breukrekenen en expliciet geversioneerde wettelijke rounding stages met volledige trace.
- 21 onafhankelijk vooraf opgestelde rekengevallen, 10 onafhankelijke officiële witte-maandtabelankers; fiscale oracle onafhankelijk van productiecalculator.
- 2 authenticated browserruns SUCCEEDED, 4 componentresultaten en 4 interne PASS-aansluitcontroles per run, persisted trace en identieke source/input/result hashes.
- Gerichte engine/package/app-tests, typechecks, lint, i18n, productiebuild en client-secret scan volgens acceptance report GREEN; geen volledige hr-suite-regressierun.
- Code-SHA lokaal: `5d7e9fc5e19ff4582787b51e0104c885ac83370a`; bewijsregistratiecommit `ab2e1d5`.
- Alleen synthetische Lab-artefacten; geen Core-write/migration/permissionwijziging. Geen push/merge/deployment.
- De actieve Codex-run las destijds AA op `b71d663`, vóór de latere AA-documentatiecommits; lees bij de volgende run de **nieuwste** AA-branch inclusief rounding/iterative/IKV-invariants en de vaste LUNA MAX-subagentregel. Niet automatisch mergen.

**Bewijsgrens:** dit is niet algemene Nederlandse payrollcompliance. Buiten scope: pensioen, werkgeverspremies, VCR/YTD, gedeelde grondslagen, multi-IKV, iteratie, reserveringen, aangifte, boven-Lmax en live Core→IKV-sourceacceptatie. GC-NL-001 blijft als aparte synthetische M0-regressiecase bestaan.

Acceptancebron (lokaal op de Payroll worktree, nog niet op GitHub): `docs/payroll/acceptance/PAYLAB03-NL2026-REGULAR-WAGE-20260930.md`.


## Lopend — CONVERGENCE01

Status: **PARTIAL — nog niet vrijgeven**.

Branch:
`work/CONVERGENCE01-20260928`

Laatste vastgelegde HEAD:
`9029f52e20f7559b6dded2682856f0f544db9bcf`

De worktree bevat daarna nog niet-gecommitte wijzigingen; de genoemde HEAD is dus niet gelijk aan alle huidige productwijzigingen.

Geïntegreerd:
- INS01
- CONTROL01
- AI01-A/A2

Remote database:
- de oorspronkelijke vijf convergence migrations zijn eenmaal toegepast en teruggelezen;
- typegen/readback, RLS/grants/policies en relevante RPC's zijn toen gecontroleerd;
- payroll staging grants zijn gehard;
- geen advisor ERROR gemeld;
- later is aanvullend `20260929111847_control01_hr_group_update.sql` eenmaal op TEST toegepast;
- na die latere schema-/UI-wijziging is nog geen nieuwe officiële typegen/advisor/full-regression gate vastgelegd.

## INS01 huidige stand

Bewezen/gebouwd:
- HR Admin / Manager / Employee reportcatalogusscope;
- Frequent Absence parity;
- Bradford reliability/filterfix en duplicate-uitlegfix;
- Upcoming Events managerscope;
- historische labels;
- export/formuleprefixhardening;
- strengere periodinput.

Bekende live catalogus:
- HR Admin: 19 reports;
- Manager: 7 toegestane reports;
- Employee: 0 managementreports.

Belangrijke bewijsgrens:
- INS01 is reliability/scope-hardening;
- niet alle 19 rapporten zijn daarmee automatisch volledig gelijkgetrokken op shell, filters, KPI/chart/table, drilldown en export;
- die systematische harmonisatie is expliciet INS02.

Open bewijs:
- niet de volledige forged context/API/export/drilldownmatrix;
- Bradford-exportroute was succesvol, maar het laatste downloadbestand is niet onafhankelijk opnieuw geparsed;
- niet alle report-/context-/pagination-/historical-label-/Actual Work-varianten zijn live bewezen;
- finale status blijft daarom PARTIAL tot de afgesproken matrix is gesloten.

## CONTROL01 huidige stand

Gebouwd:
- Control Plane UX-convergence;
- tenant/group/administration onboarding;
- OWNER/OPERATOR/AUDITOR;
- first-admin bootstrap/invitation;
- contextselectie;
- payroll import stagingfoundation;
- secure BSN fingerprintmatching;
- synthetic importercontract;
- draft employment wanneer rijke mapping ontbreekt.

Bestaande relevante tabellen:
- `administration_payroll_tax_numbers`
- `payroll_import_batches`
- `payroll_import_persons`
- `payroll_import_income_relationships`

Control OWNER normale lokale OAuth-login is inmiddels door menselijke accountselectie gelukt. De lokale Control callback is via de Supabase Redirect URL allowlist toegestaan zonder de production Site URL te wijzigen. De eerdere redirect naar de hosted HR-login was allowlist/configuratiegedrag, geen reden voor een auth-bypass.

De basis full-circle is live doorlopen: tenant → HR-groep → administratie → first-admin invitation/acceptatie → activatie → HR-contextselectie → geïsoleerde empty state → logout/login → selector opnieuw zichtbaar.

Open:
- token reuse/revoke;
- forged tenant/HR-group/administration;
- AUDITOR write;
- tweede bootstrap;
- cross-tenant bootstrap;
- volledige Control-suite/build na de latere accordion/side-panel UI-wijzigingen.

**Releaseblokkerend importdefect:** de synthetic payrollfinalisatie maakte een medewerker aan maar geen dienstverband/draft. De batch eindigde `COMPLETED_WITH_WARNINGS`; de verwachte `EMPLOYMENT_DRAFT_REQUIRES_CONTRACT_MAPPING`-uitkomst ontstond niet. Exacte DB-fout is nog niet vastgesteld en een blinde retry is onveilig omdat de medewerker al bestaat.

Official Loonaangifte/XSD-productondersteuning blijft CONTROL02-scope.

## AI01-A huidige stand

Gebouwd/bewezen:
- atomic settlement;
- durable audit recovery;
- durable release/recovery;
- legacy recovery;
- server deadline/reaper voor voice;
- server-side permission/session rechecks;
- Team save-switch enforcement;
- remote synthetic concurrencytests zonder providercalls.

Nog onderdeel van lopende closeout:
- feature-toggle na sessiestart;
- scope-intrekking tijdens sessie;
- volledige HR Admin/Manager/Employee forgerymatrix;
- trusted cleanup invariant.

De remote durability/concurrencyprobes zelf blijven sterk bewezen: settlement exactly-once, settle/release-race, dual reconcilers, audit recovery, release recovery en voice reaper no-op bij herhaling.

## Testbaseline in lopende convergence

Oorspronkelijk GREEN vóór latere wijzigingen:
- HR: 480 bestanden / 1.933 tests;
- Control: 2 bestanden / 9 tests;
- TypeScript;
- ESLint;
- i18n;
- HR build 304/304;
- Control build 12/12.

Latere volledige HR-run:
- 1.933 / 1.934 tests geslaagd;
- één bestaande PDF-render-timeout op 5 seconden;
- niet daarna opnieuw volledig uitgevoerd.

Na die run zijn nog UI-, Control- en payrollwijzigingen gedaan. Daardoor gelden de eerdere volledige GREEN-resultaten **niet automatisch** als releasebewijs voor de huidige worktree. Er moet vóór release opnieuw een finale gate op exact de uiteindelijke code draaien.

## Releasepositie

Nog niet uitgevoerd:
- bump naar `1.20260928.1`;
- release-push;
- clean releasecheckout;
- Vercel deploy;
- hosted smoke.

`main` en `origin/main` staan volgens de laatste vastgelegde status nog op `3a0fc67f84bc7dab0acff732afab597142d59ea9`.

Eerstvolgende blocker:
1. synthetic payrollfinalisatie veilig root-causen;
2. minimale fix;
3. veilige retry/recovery zonder duplicate employee;
4. open Control/AI/Insights negatives sluiten;
5. finale volledige gates op de uiteindelijke code.

Pas daarna:
- version bump;
- main/origin synchroniseren;
- clean releasecheckout;
- Vercel deploy;
- hosted safety smoke;
- AA-CURRENT/AA-ACCEPT/AA-NEXT naar de released baseline bijwerken.
