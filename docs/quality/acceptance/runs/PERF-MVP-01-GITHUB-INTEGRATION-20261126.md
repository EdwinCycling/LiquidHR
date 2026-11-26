# PERF-MVP-01 GitHub-integratie — 26 november 2026

## Resultaat

De geteste MVP-code is in GitHub `main` geïntegreerd via fast-forward, zonder force-push. De integratiecommit is `68493eb20e2b6ab9109edcf4f922cf34b686280a`; de huidige `main`-SHA na de push is read-only bevestigd als dezelfde commit. De lokale featureworktree blijft op de featurebranch; bestaande dirty bestanden zijn niet meegenomen.

Er is geen Vercel-release, remote SQL-/datawrite, testfixture-mutatie of account-/rechtenmutatie uitgevoerd.

## Deploymentbeveiliging vóór push

- Geteste feature-HEAD `a965c18ee131a43938d8886abac38a4720ca349b` en oorspronkelijke `main` bevatten dezelfde `apps/hr-suite/vercel.json`; Git blob object-ID: `41ef83cb448edcf5729803abd1bdb81938a80b02`.
- De live Vercel-projectinstelling voor `liquidhr` toont Root Directory `apps/hr-suite` (Build and Deployment-instellingen). Dat is de map waarin deze `vercel.json` staat.
- Vercels officiële [Git Configuration-documentatie](https://vercel.com/docs/project-configuration/git-configuration) specificeert `git.deploymentEnabled: false` als uitschakeling van automatische Git-deployments voor alle branches. De [build-/Root Directory-documentatie](https://vercel.com/docs/builds/configure-a-build) beschrijft dat de Root Directory de projectcode-map bepaalt. De configuratie kon daardoor op de effectieve project-root worden toegepast.
- De lokale `vercel.json` was ongewijzigd; er is geen Vercel-projectsetting aangepast.

## Geïntegreerde commits

Deze 20 commits zijn fast-forward geïntegreerd vanaf de op dat moment actuele `main` `b2dd65090acb6a371cf6597fe3fade8b68a61bdb`:

| Commit | Onderwerp |
|---|---|
| `71a521d1ff0227cde72956943f3e94632d8940b9` | feat(performance-reviews): add MVP workflow |
| `4d62d6160cfad699cbba8765a80199eb881e5858` | docs(performance-reviews): record MVP acceptance evidence |
| `7811cf1f8bb9a54cc63741e5fd754f204310abbd` | fix(performance-reviews): expose employee conversation history |
| `91e29ff8ba020af63284c20ef6d369ae6f1e0577` | fix(performance-reviews): correct rating errors and attachment downloads |
| `52ffcac783dc2155565596166ed9a86203de2dca` | fix(a11y): improve sidebar section contrast |
| `624ae6abb2f401d24bb1ec5c194be9921318460c` | fix(a11y): correct product update badge contrast |
| `1c875685b6c867f3eecd2d2f60ff017b46369154` | fix(a11y): improve overdue reminder badge contrast |
| `dba24305ff071b46adbd1b0ce7b9f4046f314b7d` | fix(performance-reviews): show soft deadline warning |
| `ab30dbd48d6a334a731c655b108658e18e0987be` | test(performance-reviews): allow slow persona navigation |
| `11cc310cbb0d31f123a220648acaa72e6e13629d` | fix(performance-reviews): preserve dossier versions in UI |
| `616388988bef7de65f19d3a1ecb50820daa6f309` | fix(performance-reviews): preserve edits during dossier hydration |
| `fae4f92944aeaf174dc881de33d88f4c270b2942` | fix(performance-reviews): render released dossier attachments |
| `07444df5dc163dbf070f6b3115fa49282ab70463` | fix(performance-reviews): serialize round close conflicts |
| `9cfbf13a0a8ba43c870eeacd7760d614c68ecd2e` | docs(acceptance): record PERF-MVP final verification |
| `c3d5fa8e13124b0d3555c7d3d391505ddcb2b244` | fix(performance-reviews): preserve acknowledgement history |
| `7222c9fcf79c5197074cdd108398f31f553a996f` | docs(performance-reviews): record final acceptance closeout |
| `50ed3294a9a3d3c468a3a814d9f7b741f374430d` | docs(performance-reviews): add persona closeout evidence |
| `478086ddba4b54c546e64027234299750f96862f` | docs(performance-reviews): clarify retained TEST fixtures |
| `a965c18ee131a43938d8886abac38a4720ca349b` | test(performance-reviews): add closeout probes |
| `68493eb20e2b6ab9109edcf4f922cf34b686280a` | docs(performance-reviews): close out MVP technical acceptance |

De branchdiff bevat geen Payroll-, WVP-, absence- of leave-bestanden. De drie gedeelde contrastcorrecties horen bij de A30-toegankelijkheidsbevindingen. De lokale wijzigingen aan `next-env.d.ts`, packagebestanden, oude screenshots en diagnostische bestanden bleven buiten commits en push.

## Readback na push

- `git ls-remote origin refs/heads/main` gaf `68493eb20e2b6ab9109edcf4f922cf34b686280a`; lokale feature-HEAD en remote `main` waren gelijk.
- Vercel-project `liquidhr` bleef op READY-deployment `dpl_CwPwQJ8WEp4WTEPwtLqXuptcdbhZ`, source-SHA `3b76be2c614d4e1abbac5f7289925ef8d75eddbd`. De deploymentlijst bleef identiek aan de nulmeting: twee bestaande READY-deployments, geen nieuwe deployment.
- Drie bestaande aliassen bleven ongewijzigd: `liquid-hr-hr-suite.vercel.app`, `liquidhr-edwinitsolutions.vercel.app` en `liquidhr-git-3b76be2c614d4e1abbac5f7289-816bac-edwinitsolutions.vercel.app`.
- De eerdere pushpoging vanuit de sandbox faalde vóór GitHub door Windows-procesisolatie van de credential-helper; dezelfde fast-forwardpush slaagde daarna via de toegestane buiten-sandboxuitvoering. Geen credentials gewijzigd.

## Acceptatie en vervolg

De acceptatiematrix blijft **31 PASS, 1 NOT_RUN, 2 BLOCKED, 0 FAIL**. A13, A26 en A27 blijven OPEN voor latere handmatige/securityacceptatie; er zijn geen fixtures aangemaakt. Zie de [technische A01–A34-closeout](PERF-MVP-01-TECH-CLOSEOUT-20261126-a965c18.md).

PERF-V2-01 issue #102 blijft optioneel en PARKED totdat de MVP functionele én securityacceptatie compleet is. Geen V2-code is onderdeel van deze integratie.
