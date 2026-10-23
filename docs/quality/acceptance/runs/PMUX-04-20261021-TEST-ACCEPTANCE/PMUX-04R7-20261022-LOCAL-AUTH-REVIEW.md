# PMUX-04R7 — lokale persona-authenticatie (22 oktober 2026)

## Scope en runtime

- Werkboom: work/BRANCH-SPLIT-PMUX-20261021, start-HEAD 87e7dcea1cd3a1011cbe29ae6da53bc6986068f7.
- Alleen lokale PMUX-code aangepast. Geen schema/migratie, Supabase-account-, wachtwoord-, rol- of businessdatawijziging; geen push, merge of deployment.
- R3-bootstrap-preflight geslaagd; de bestaande centrale TEST-config is via de bootstrap geladen zonder waarden te tonen. Development-runtime startte op loopback 127.0.0.1:3011.
- De browseractie op de aparte Codex In-App Browser werd door diens URL-policy geweigerd. De tool verbood alternatieve browser-, HTTP- of CDP-routes. Daarom zijn in R7 geen echte persona-login, routebezoek of PNG-capture uitgevoerd.

## Implementatie en lokale securityreview

- /local/sign-in biedt alleen hr-admin, manager en employee aan. Een knop verschijnt uitsluitend als de bijbehorende servervariabele niet leeg is; ontbrekende configuratie toont alleen de veilige variabelenaam.
- De server gebruikt de bestaande SSR Supabase-client en auth.signInWithPassword. Er is geen service-role-client, handgemaakte JWT, credentials in clientcode of tweede authmechanisme.
- Na login controleert de server getClaims() plus getUser(), exact geverifieerd e-mailadres, RLS-zichtbare tenant 07249eb9-545c-883b-b26b-d52f83b4f4a1, HR-groep Planeten 6ba6f1df-e376-40f2-abff-ffdf000172e1, en de werkelijk via requireAuthContext opgeloste rol.
- Manager moet DIRECT_MANAGER en employee-link 9048f02b-4fdc-3c4c-e1aa-fd339660029c hebben. Employee moet EMPLOYEE en employee-link c6b1c7a9-c250-3d19-b1a0-87e317e80b13 hebben. Manager/Employee met HR-adminrechten worden geweigerd. HR Admin moet TENANT_ADMIN hebben.
- De geselecteerde tenant/groep wordt pas na verificatie in de bestaande contextcookies gezet. Bij mismatch wordt de normale Supabase lokale sessie beëindigd; bij mislukte cleanup volgt 503.
- De route vereist de bestaande lokale runtime-guard op zowel Host als URL, loopback, expliciete lokale TEST-vlag, canonieke Supabase TEST-projectref en same-origin POST. Hosted en niet-loopback verkeer wordt geweigerd.
- De owner-only /local/personas en role-switcher zijn niet gewijzigd. Review van deze code en de negatieve tests: PASS lokaal. Dit is geen onafhankelijke externe securityreview en geen bewijs van live TEST-roltoekenning.

## Credentials en feitelijke authenticatie

- Geen persona is tijdens deze run in een browser aangemeld; geen serverrol, tenant-/HR-groep- of teamscope is live bewezen.
- R3 preflight bevestigde de vereiste centrale runtimeconfiguratie, niet de beschikbaarheid van persona-wachtwoorden.
- De implementatie gebruikt alleen de bestaande beheerde keys: TALENT_HR_ADMIN_PASSWORD, TALENT_MANAGER_PASSWORD, TALENT_EMPLOYEE_PASSWORD. Hun aanwezigheid is in R7 niet vastgesteld omdat de In-App Browser de serverpagina niet toegankelijk maakte; waarden zijn niet gelezen.
- Geen extra TEST-only authenticatieharnas geïmplementeerd. Als TALENT_MANAGER_PASSWORD of TALENT_EMPLOYEE_PASSWORD ontbreekt in de goedgekeurde centrale lokale TEST-config, blijft die key de exacte aanvullende configuratiebeslissing. Geen alternatief geactiveerd.
- Eerdere R5 HR Admin-browserbewijzen blijven historisch en zijn niet als R7-sessie hergebruikt.

## Screenshotstatus

Geen R7-PNG is gemaakt. De bestaande R5-captures in het screenshotindex blijven historisch; ze zijn niet als R7-bewijs hergebruikt. De R7-capturelijst staat in hetzelfde indexbestand op NOT CAPTURED — IAB policy blocked.

## Technische checks

- Nieuwe lokale auth-testsubset: 30/30.
- Auth + bestaande owner-only role-switch/context-select regressies: 80/80 (6 testbestanden).
- ESLint gewijzigde TS/TSX-bestanden: geslaagd, 0 meldingen.
- i18n: 43 namespaces, NL/EN-sleutels gelijk.
- TypeScript strict: geslaagd; tsBuildInfoFile stond in de unieke task-visualizationmap. apps/hr-suite/next-env.d.ts-hash bleef gelijk.
- git diff --check: geslaagd (alleen bestaande CRLF-normalisatiewaarschuwingen, geen whitespacefouten).
- Bestaande 94-testacceptance is niet volledig herhaald; de gewijzigde subset en auth/context regressies zijn uitgevoerd.

## Status

LOCAL AUTH IMPLEMENTATION: READY FOR REVIEW. PMUX-04 AUTHENTICATED BROWSER ACCEPTANCE: OPEN.
De securityguard-code en gerichte regressies zijn hervatbaar. De volledige PMUX-04-securitygate blijft OPEN tot de aparte IAB weer toegang geeft en de echte Manager-/Employee-credentials, sessies, serverrollen, scope, routes en PNG-captures zijn bewezen.
