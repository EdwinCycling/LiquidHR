# AA-CURRENT — Current LiquidHR State

Status: **ACTUEEL / LIVING**  
Momentopname: 2026-09-29

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

## Lopend — CONVERGENCE01

Branch:
`work/CONVERGENCE01-20260928`

Laatste bekende HEAD:
`9029f52e20f7559b6dded2682856f0f544db9bcf`

Geïntegreerd:
- INS01
- CONTROL01
- AI01-A/A2

Remote database:
- vijf convergence migrations toegepast;
- typegen/readback uitgevoerd;
- payroll staging grants gehard;
- geen advisor ERROR gemeld;
- bestaande projectbrede warnings buiten scope niet opportunistisch opgeschoond.

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

Nog onderdeel van lopende closeout:
- resterende forged context/API/export/drilldownmatrix;
- finale classification GREEN/PARTIAL.

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

Control OWNER normale lokale OAuth-login is inmiddels door menselijke accountselectie gelukt; resterende full-circle/import/securityacceptatie loopt.

Official Loonaangifte ondersteuning blijft CONTROL02-scope.

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
- persona authorization;
- feature/voice disable;
- scope revocation/forgery;
- trusted cleanup invariant.

## Testbaseline in lopende convergence

Eerder GREEN op de geïntegreerde code:
- volledige HR-suite: 480 bestanden / 1.933 tests;
- Control: 2 bestanden / 9 tests;
- strict TypeScript;
- HR ESLint;
- HR build 304/304;
- Control build 12/12.

Na latere Bradfordtestuitbreiding telde de full suite 481 bestanden / 1.934 tests; één bestaande PDF-render-test timeoutte. Release-closeout moet dit volgens AA-TEST/AA-REL verdedigbaar GREEN afsluiten.

## Eerstvolgende update na release

Als CONVERGENCE01 GREEN/RELEASED:
1. definitieve version invullen;
2. release/main/origin SHA gelijk vastleggen;
3. Vercel deployment/READY/alias vastleggen;
4. INS01/CONTROL01/AI01-A naar AA-ACCEPT promoveren;
5. AA-NEXT CURRENT verplaatsen naar CONTROL02.
