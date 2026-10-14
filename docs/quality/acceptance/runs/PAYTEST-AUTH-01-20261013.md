# PAYTEST-AUTH-01 — lokale Payroll-testpersona's

**Verdict: PARTIAL / BLOCKED — niet GREEN.** Dit rapport is de evidence voor kandidaatcode gebaseerd op `origin/main` `fd89ad5f957cfb1222501d546a26d72983ef1c89`. Geen Auth-account, credential, employee-, ESS-, rol-, scope- of Payroll-data is aangemaakt of gewijzigd.

## Gebouwd

- Canonieke JSON-catalogus en leesbare verwijzing met de bestaande employee-, employment-, scope- en runreferenties.
- Vaste role-switchkeys voor Lisa, Jaap en Frits; Test HR Admin, Test Manager en Test Employee blijven behouden.
- Payroll-targets vereisen een reeds bestaande Auth-gebruiker voordat de lokale magiclink-handoff start. Een ontbrekende account wordt geweigerd; de switchroute maakt die niet aan.
- Terugkeerknop is beschikbaar voor de drie Payroll-testpersona's via de bestaande Test HR Admin-flow. De route kent geen rechten of context toe.
- NL- en EN-labels, gerichte unit-testdekking en vaste toekomstige documentatie-ingangen zijn toegevoegd.
- Herbruikbare `check-test-personas.ps1` en browserpreflight toegevoegd voor projectrefs, credentials, directe login, vaste role-switch, scope, ESS, self-only/dossier, desktop/mobiel en terugkeer. De checker rapporteert per persona `READY`, `READY_WITH_EXPECTED_GAP` of `BLOCKED`.

## Waargenomen bewijs

- De guarded launcher slaagde met de bestaande centrale TEST-runtime nadat het echte Windows `LOCALAPPDATA`-pad was aangewezen; configuratiewaarden bleven verborgen.
- Lokale Test HR Admin-login werkte. De Admin-context bood alleen Mars BV. De browsercheck bereikte via de bestaande Admin→Edwin-Auth-handoff `/context/select`, maar de catalogus-tenant De Sterren holding was daar niet selecteerbaar. Er volgde geen context-submit; er is geen Jupiter-recht toegekend of omzeild.
- De gerichte browserrun bevestigde de normale Test HR Admin-login en handoff-redirects (`303`/`307`) en laadde `/context/select` met `200`. De payroll-personahandoff en directe persona-login zijn in deze run niet bereikt; de eerste strandde op de ontbrekende bestaande Jupiter-context. De credentialcheck noemt alleen de zes ontbrekende variabelen. Er was geen vastgestelde React-hydrationfout.
- De bestaande scope-gated handoff naar Lisa slaagde na controle van haar employee-, ESS- en actieve employment-binding binnen Jupiter. Lisa's `/my-salary` toonde de bestaande 2026-10 FINALIZED-salarisstrook.
- Op die Lisa-pagina was geen PDF- of downloadcontrol zichtbaar. Dit bewijst geen ontbrekend artifact, maar de gevraagde ESS-PDF-flow is OPEN.
- De Frits-run `338ef391-fbf6-435a-a4d7-e28a8024ebc2` toont Frits in de runheader en `Jan` in de berekeningstrace. De juiste runbron is niet bevestigd. PFZW blijft SOURCE_GAP en netto blijft niet-definitief.
- Gerichte verificatie: 48/48 role-switch/helper/UI-/handoff-tests geslaagd; NL/EN i18n-check geslaagd (43 namespaces); niet-incrementele TypeScript-check, gewijzigde bestanden-ESLint, PowerShell-parser, Node-syntax en lokale guarded Core/Payroll-runtime-preflight geslaagd. Vitest had één Windows-EPERM vóór testcollectie; de gerichte retry slaagde. De persona-preflight rapporteerde de zes ontbrekende credentialvariabelen zonder waarden te tonen.

## Blokkades

- `%LOCALAPPDATA%\LiquidHR\TestRuntime\payroll-test-personas.env` ontbreekt. Er zijn geen wachtwoorden gegenereerd of opgeslagen.
- Jaap en Frits hebben geen gekoppelde Auth-identiteit. De bestaande uitnodigingsservice gebruikt het bestaande privécontactadres en verstuurt e-mail; er is geen bestaande veilige TEST-provisioning voor een vaste `@liquidhr.test`-login die zowel Auth aanmaakt als de employee-link via normale services afrondt. Er is geen directe SQL/service-role-bypass toegevoegd.
- De aparte persona-credentialbron en accounts ontbreken, waardoor hun login, ESS-, self-only-, dossier-, PDF- en desktop/mobielacceptatie niet uitvoerbaar is.
- De huidige browsercheck kan Lisa’s eerder bevestigde ESS-flow niet opnieuw bereiken doordat de bestaande Admin→Edwin-handoff geen selecteerbare De Sterren-context oplevert. De directe persona-logins blijven geblokkeerd door ontbrekende credentials; Jaap en Frits hebben bovendien geen gekoppelde Auth-identiteit. De onafhankelijke schone eindworktree, publieke Preview/Production-probe, PR-merge en releasecontrole zijn niet voltooid. De bestaande Vercel-kanalen zijn niet gewijzigd of gedeployed.

## Gate

Laat deze slice PARTIAL/BLOCKED totdat de reeds toegestane Jupiter-context via een bestaande account-/contextflow aantoonbaar bereikbaar is, Jaap en Frits via een bestaande goedgekeurde TEST-provisioner zijn gekoppeld, de ACL-beveiligde credentialfile geldig is, alle persona's via directe login en role-switch zijn bewezen, de negatieve scopes en beschikbare documenten zijn gecontroleerd, de Frits-bron is opgelost en een onafhankelijke schone worktree de volledige preflight doorstaat. Geen GREEN op basis van alleen code of unit-tests.
