# PAY-MERGE-FIX-02 — Next.js securitypatch en production-build-gate

- Datum: 23-10-2026
- Branch: `integration/PAYROLL-MERGE-20261022`
- Start-HEAD: `7471ce2312a24e8a9470bb1c196d34baaa845349`
- Dependency/code-commit: `3c02fc230e9b12b3936137fe35ba7fd52628f2f2`
- Verdict: **HOLD — dependencies en regressies groen; volledige production build OPEN**

## Dependencies en securitycontrole

Met npm 10.9.2 en de bestaande root-lockfile zijn beide Next-workspaces bijgewerkt:

| Workspace | Next.js | `eslint-config-next` | React / React DOM | sharp |
| --- | --- | --- | --- | --- |
| `@liquid-hr/hr-suite` | 16.4.2 | 16.4.2 | 19.2.9 / 19.2.9 | 0.35.5 |
| `@liquid-hr/control` | 16.4.2 | 16.4.2 | 19.2.9 / 19.2.9 | 0.35.5 (gededupliceerd) |

Next.js 16.4.2 is de nieuwste stabiele versie in de 16.4-lijn die op 23 oktober 2026 in npm/GitHub-releasemetadata stond. De officiële 14-oktober-update noemt 16.4.1 als gepatchte minimumversie. De gekoppelde React Server Components-advisories noemen 19.2.9 als gepatcht; de opgeloste React- en React DOM-versies voldoen hieraan. De sharp-advisory noemt 0.35.5 als gepatcht; de opgeloste versie is 0.35.5. Zie [Next.js-security-update](https://nextjs.org/blog/nextjs-security-update-october-14-2026), [Next.js v16.4.2-release](https://github.com/vercel/next.js/releases/tag/v16.4.2), [React RCE-advisory](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3), [React DoS-advisory](https://github.com/react/react/security/advisories/GHSA-h3gv-c5rc-p453) en [sharp/librsvg-advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).

`npm ls next react react-dom sharp eslint-config-next --all` bevestigt de bovenstaande opgeloste versies in beide workspaces. De finale `npm audit` vond geen advisorymatch voor `next`, `react`, `react-dom` of `sharp`; in totaal blijven **9 HIGH, 2 MODERATE en 0 CRITICAL** transitive advisories over, waaronder lint-, test- en buildtooling. Die dependencyfamilies zijn niet breed gewijzigd in deze opdracht.

## Buildpogingen en blocker

- Runtime: PATH-Node `22.14.0` bleek lager dan de engine-eis van `@sparticuz/chromium@149.0.0`. De build is daarom ook gecontroleerd met de bestaande Codex-runtime **Node 24.19.0**, die aan die eis voldoet.
- Standaard `npm run build --workspace @liquid-hr/hr-suite`: Next 16.4.2/Turbopack faalt bij junctioncreatie in de Windows-sandbox. Met Node 24.19.0 reproduceert dit op `.next/payrun01/node_modules/sharp-…` met `Access is denied (os error 5)`.
- WSL2 is niet beschikbaar voor deze sessie: `wsl --list --quiet` retourneerde `Wsl/E_ACCESSDENIED`.
- De bestaande buildketen is met de officiële `next build --webpack`-optie, Node 24.19.0 en de bestaande schone distDir-optie gestart. Next faalde in de buildworkerfase met `EPERM: operation not permitted, mkdir …/.next/payrun01-acceptance/server/app/api/context/select`; daarom konden de postbuildcontroles niet draaien. Eerdere Webpack-pogingen onder Node 22 faalden op afzonderlijke route-outputmappen. Er is geen TypeScript- of concrete applicatiecompilefout vastgesteld, maar de build is **niet geslaagd**.
- Webpack is uitsluitend als toegestane lokale buildvalidatie gebruikt. De package-buildconfiguratie en productie-bundlerkeuze zijn niet gewijzigd. Er is geen succesvolle productiebuildprovenance.

De buildgate blijft OPEN voor Runtime/Testinfra: voer de ongewijzigde kandidaat-build uit in een ondersteunde omgeving zonder Windows-sandboxbestandssysteembeperkingen en registreer de exacte runtime/bundler. Geen rechten of Windows-beveiligingsinstellingen aangepast.

## Regressies en gates

- Gerichte Payroll/D0/K2/`/payroll/runs`: **17 bestanden, 130 tests PASS**.
- Volledige hr-suite CONTROLLED, `maxWorkers=4`: **714 bestanden (710 PASS, 4 SKIP); 3.495 tests (3.487 PASS, 8 SKIP, 0 FAIL)**; 199,83 s.
- Control-workspace-tests: **2 bestanden, 11 tests PASS**.
- TypeScript: hr-suite PASS; Control PASS.
- ESLint: hr-suite **0 errors, 8 bestaande warnings**; Control PASS.
- i18n: hr-suite **43 NL/EN-namespaces PASS**; Control **182 keys PASS**.
- `npm audit`: 0 CRITICAL; 9 HIGH en 2 MODERATE overige transitive advisories.
- De dependencycommit bevat alleen `apps/hr-suite/package.json`, `apps/liquidhr-control/package.json` en `package-lock.json`. Geen wijzigingen aan authenticatie, routing, PDF-code, salarisberekeningen of grants.
- `apps/hr-suite/next-env.d.ts` bleef byte-identiek, SHA-256 `1b59d4c6b83807db275d43f3cf2cc8e9323f465fab764eea091cc5becd5bad37`. Door de buildgenerator gewijzigde widgetresource is teruggezet naar HEAD.

Geen main-, PMUX- of andere worktreewijziging, push, merge, Core-write of deployment uitgevoerd. De vorige PAY-QA-FIX-01-acceptatie blijft een historische momentopname; deze kandidaat krijgt geen LOCAL MERGE READY-status zolang de volledige production build niet slaagt.
