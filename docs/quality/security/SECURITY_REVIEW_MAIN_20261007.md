# Securitycheck LiquidHR — huidige remote main

## Besluit en basis

**Security sign-off: HOLD.** De review vindt twee HIGH-risico's die eerst moeten worden afgehandeld: een ontbrekende binding tussen bijlagemetadata en storage-objecten, en een bekende kwetsbaarheid in `sharp`. Er is geen CRITICAL-bevinding vastgesteld. Dit is een begrensde broncode- en dependencyreview, geen volledige penetratietest of verklaring over de actuele Production-configuratie.

| Eigenschap | Vastgesteld |
| --- | --- |
| Datum | 2026-10-07, Europe/Amsterdam |
| Repository | `EdwinCycling/LiquidHR` |
| Beoordeelde main | `249c737941d682cb834e313097a9df009549c11b` |
| Remote verificatie | `git ls-remote origin refs/heads/main`, bij aanvang en afronding dezelfde SHA |
| Commit | Merge PR #8, 2026-10-07 12:44:01 +02:00 |
| Lokale checkout | `main` op `cb73260ff0cd83d19fa29e44c9f0b93749fb10af`, een oudere voorouder van remote main |
| Werkwijze | Bronkopie uit `git archive origin/main`; checkout, branches en bestaande artefacten behouden |
| Wijzigingen | Rapport en compacte contextverwijzing; geen productfix, databaseactie, commit, push of deployment |

De verwijzingen naar code hieronder zijn GitHub-permalinks op de beoordeelde SHA. De huidige lokale checkout bevat niet alle beoordeelde code. Historische GREEN-claims in deliverydocumenten zijn geen nieuw bewijs voor deze main.

## Prioriteiten

Prioriteit is de herstelvolgorde; ernst beschrijft de impact. P1 = eerst oplossen en accepteren vóór security sign-off; P2 = eerstvolgende security-slice; P3 = geplande hardening. Een dependency-advisory is geen bewijs dat een exploit in de gedeployde app bereikbaar is.

| ID | Prioriteit | Ernst | Bevinding | Bewijsniveau |
| --- | --- | --- | --- | --- |
| SEC-01 | P1 | HIGH | Gespreksbijlagen: vrije storage-sleutel kan toegestane metadata aan een vreemd object koppelen | Code/migrations bevestigd; live SQL-exploit niet uitgevoerd |
| SEC-02 | P1 | HIGH | `sharp` 0.35.4 bevat een bekende librsvg-kwetsbaarheid | Lockfile en actuele advisory bevestigd; app-exploit niet bewezen |
| SEC-03 | P2 | MEDIUM | Muterende cookie-API's controleren origin niet consequent | Routegedrag lokaal gereproduceerd; browseraanval conditioneel |
| SEC-04 | P2 | MEDIUM | Control OAuth-callback accepteert een externe redirect via backslash | Werkelijke handler lokaal gereproduceerd met authmock |
| SEC-05 | P2 | MEDIUM | Branding en gespreksbijlagen vertrouwen opgegeven MIME-type | Brandingservice lokaal gereproduceerd; bijlagen statisch bevestigd |
| SEC-06 | P2 | MEDIUM | Dependencyachterstand in build/test-tooling, inclusief `source-map-js` in productieboom | Remote lockfile-audits bevestigd; runtime-aanval niet aangetoond |
| SEC-07 | P3 | LOW | Geen app-CSP; Control mist de HR-baseline voor securityheaders | Bronconfiguratie bevestigd; hosted headers niet gecontroleerd |

## SEC-01 — bijlagemetadata kan een vreemd storage-object aanwijzen

**Locatie:** [attachment migration, regels 55–89](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/hr-suite/supabase/migrations/20260803160142_continuous_appraisal_attachments.sql#L55) en [downloadservice, regel 465](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/hr-suite/lib/continuous-appraisal/service.ts#L465).

De tabel geeft `authenticated` rechtstreeks INSERT. De insertpolicy controleert de eigen uploader, een toegankelijk item en schrijfpermission, maar niet de inhoud van `storage_key`. Er is geen constraint of bijlagetrigger die de sleutel bindt aan `tenant_id`, `item_id` en attachment-id. De audittrigger registreert de rij, maar valideert deze binding niet. De unieke sleutel is `(tenant_id, storage_key)` en verhindert dus geen verwijzing naar dezelfde objectnaam vanuit een andere tenant.

De storage-readpolicy staat lezen toe zodra een zichtbare bijlagerij dezelfde objectnaam heeft. De app-downloadservice leest een zichtbare bijlagerij en maakt met de adminclient een signed URL voor de opgegeven sleutel.

**Aanvalspad en impact:** een actor met een eigen toegankelijk gesprek en bijlagenschrijfrecht kan via de Data API een metadataregel invoegen waarvan de sleutel naar een bestaand vreemd object in dezelfde bucket wijst. Vervolgens kan die metadataregel de storage-readpolicy of de admin-downloadservice toegang tot dat object laten geven. Dit kan vertrouwelijke gespreksbijlagen tussen items of tenants ontsluiten. De aanvaller moet de objectnaam kennen; willekeurige UUID's verminderen ontdekbaarheid, maar vervangen objectautorisatie niet. Dit pad is vastgesteld in de repositorymigrations; toepassing en exploit op een live database zijn niet gecontroleerd.

**Oplossingspad:**

1. Schrijf eerst een transactionele SQL-regressie met twee tenants en twee items: een geldige eigen bijlage werkt, een metadata-insert naar een vreemd object faalt.
2. Sluit de vrije metadata-INSERT af of vervang die door een beperkte, atomische schrijfprimitive. Leid actor en sleutel server-side af. Behoud bestaande permission-, item- en tenantchecks.
3. Dwing in de database de canonieke sleutelbinding af: tenant, item en bijlage-id moeten overeenkomen met de rij. Verifieer ook bucket/object en uploader; vertrouw geen clientvelden voor provenance.
4. Bind de storage-readpolicy aan dezelfde gevalideerde tenant/item/objectrelatie. Laat de downloadservice de binding opnieuw controleren voordat een admin-signed URL ontstaat.
5. Inventariseer bestaande afwijkende metadata eerst read-only; corrigeer die gecontroleerd. Pas een forward migration alleen na expliciete remote toestemming toe, draai advisors en genereer types opnieuw.

**Acceptatie:** anon geweigerd; geldige self/manager/HR-scope toegestaan; ander item, andere tenant, vervalste sleutel, vervalste uploader en ingetrokken toegang geweigerd via zowel Data API, storage als app-download. Een echte PostgreSQL/RLS-test is noodzakelijk.

## SEC-02 — bekende kwetsbaarheid in sharp

**Locatie:** [HR package.json](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/hr-suite/package.json), [lockfile](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/package-lock.json#L8152), [avatarverwerking](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/hr-suite/lib/employees/avatar-image.ts) en [Document Studio asset-policy](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/hr-suite/lib/document-studio/asset-policy.ts).

De remote lockfile bevat `sharp` **0.35.4**. `npm audit --package-lock-only --omit=dev --json` meldt deze dependency als HIGH. De actuele [maintainer-advisory GHSA-wq5f-xc86-pv6w](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) noemt een memoryprobleem in librsvg en mogelijke RCE onder specifieke omstandigheden op glibc-Linux. De gepatchte sharp-versie is **0.35.5**; SVG-decoding blokkeren is een gedocumenteerde tijdelijke mitigatie.

**Bereikbaarheid en grenzen:** de bekeken eigen avatar- en Studio-paden controleren raster-signatures vóór decoding. Dat beperkt SVG-input daar. De avatarconfig blokkeert HEIF, niet SVG. Het bestaan van een kwetsbare dependency bewijst geen RCE in deze app; andere decoderpaden, hostingbinaries en runtimevoorwaarden zijn niet live vastgesteld. De impact rechtvaardigt wel een snelle patch.

**Oplossingspad:** upgrade sharp naar minimaal de genoemde gepatchte versie, werk de lockfile bij en controleer de daadwerkelijk geïnstalleerde native binaries. Overweeg daarnaast centraal SVG-decoding te blokkeren als het product SVG nergens nodig heeft. Behoud signature-, pixel-, byte- en outputlimieten.

**Acceptatie:** productie-audit zonder deze advisory; avatar- en Studio-beeldtests; geldige PNG/JPEG/WebP en ongeldige/vervalste beelden; build en beeldverwerking op het bedoelde Linux-runtimeplatform. Geen `npm audit fix --force` gebruiken.

## SEC-03 — origincontrole ontbreekt op meerdere mutatieroutes

**Locatie:** [rollen-POST](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/hr-suite/app/api/roles/route.ts#L8), [contextselectie](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/hr-suite/app/api/context/select/route.ts#L13), [branding-POST](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/hr-suite/app/api/settings/company-branding/route.ts) en [HeRa-confirm](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/hr-suite/app/api/hera/drafts/%5BdraftId%5D/confirm/route.ts).

Deze routes lezen JSON of multipart en gebruiken de cookiesessie zonder zichtbare Origin-/Fetch-Metadata-/CSRF-check. De JSON-routes controleren daarbij niet consequent het Content-Type. De proxy voegt geen algemene mutatieguard toe. De [Workforce-BFF](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/hr-suite/app/api/internal/workforce-tools/route.ts#L75) bevat al een expliciete same-origincheck.

**Reproductie:** de werkelijke rollen-POST accepteerde in een lokale test een Request met een afwijkende same-site Origin, `Content-Type: text/plain` en geldige JSON: HTTP 201 en aanroep van de gemockte geautoriseerde roleservice. Dit bewijst de ontbrekende routeguard, niet dat een anonieme actor een rol kan maken. De onderliggende service vereist nog steeds `authorization:write`.

**Aanvalspad en impact:** een aanvaller die content onder een andere origin binnen dezelfde site beheerst, kan een eenvoudige POST aan de HR-origin sturen terwijl de browser de cookies van een geautoriseerd slachtoffer meestuurt. SameSite=Lax onderscheidt site en origin en sluit dit scenario niet zelfstandig af. CORS hoeft een eenvoudige POST niet tegen te houden; het kan alleen het teruglezen blokkeren. Voor gewone cross-site requests biedt SameSite wel bescherming. Of er een bruikbare onbetrouwbare same-site origin bestaat, is niet vastgesteld.

**Oplossingspad:** hergebruik een centrale guard voor cookiegeauthenticeerde mutaties met canonieke originresolutie; weiger afwijkende/null origins en definieer bewust het beleid voor ontbrekende Origin. Controleer Fetch Metadata aanvullend en vereis JSON-media-types voor JSON-routes. Gebruik een apart passend model voor bearer-/cron-/webhookroutes en publieke recruitmentintake. Pas de guard toe op alle relevante mutaties, niet alleen de genoemde voorbeelden.

**Acceptatie:** eigen origin werkt; vreemde same-site en cross-site origin, null origin en text/plain JSON worden geweigerd vóór de serviceaanroep. Verifieer met een echte browser en bestaande synthetische cookiesessies. Geen bestaande service- of RLS-permissions verruimen.

## SEC-04 — open redirect in Control OAuth

**Locatie:** [Control callback, regel 4](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/liquidhr-control/app/auth/callback/route.ts#L4) en [Control OAuth-action, regel 34](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/liquidhr-control/lib/auth/actions.ts#L34).

De validator accepteert ieder pad dat met `/` begint maar niet met `//`. Hij weigert geen backslashes. Een waarde `/\example.invalid` passeert en wordt door `new URL(next, request.url)` naar `https://example.invalid/` genormaliseerd. De werkelijke callbackhandler gaf deze externe Location terug in de lokale reproductie, na een gemockte succesvolle code exchange.

**Impact:** een login kan eindigen op een aanvallerssite en een overtuigend phishingvervolg tonen. De reproductie bewijst geen overdracht van een Supabase-cookie of access token naar die site. Er is een geldige OAuth-flow/succesvolle exchange nodig voor de callbackredirect.

**Oplossingspad:** hergebruik de policy van [HR safeNextPath](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/hr-suite/lib/auth/login-rules.ts#L9), die backslashes al weigert. Normaliseer en controleer ook dat de resulterende URL dezelfde origin behoudt. Gebruik dezelfde validator bij initiatie en callback. Harden aansluitend de Control-originresolutie: de fallback vertrouwt forwarded host/protocol zonder de HR-allowlistcontrole; live impact daarvan is niet bewezen.

**Acceptatie:** gewone interne paden en queryparameters werken; absolute URL, `//host`, slash/backslashvarianten en control characters leiden tot de veilige fallback. Handler- en loginflowtests moeten dit aantonen.

## SEC-05 — MIME-spoofing bij branding en gespreksbijlagen

**Locatie:** [brandingservice, regels 60–78](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/hr-suite/lib/settings/branding-service.ts#L60) en [bijlagenupload, regel 428](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/hr-suite/lib/continuous-appraisal/service.ts#L428).

Deze paden controleren opgegeven `File.type` en bestandsgrootte, maar valideren de bytes niet tegen het beweerde bestandstype. Branding kiest zelfs de storage-extensie op basis van dit MIME-type. In een lokale servicetest werden gewone tekstbytes met `type: image/png` als logo aan de storage-upload doorgegeven. De onderliggende storage-call was gemockt; daadwerkelijke opslag is niet getest. De bucket-MIME-allowlist is geen bytevalidator.

**Impact:** bevoegde uploaders kunnen inhoud aanbieden die buiten de bedoelde formatallowlist valt. Dat kan ontvangers aan onbedoelde inhoud of parserrisico's blootstellen en file-integriteit ondermijnen. Een browser-XSS of malwaresucces is hiermee niet aangetoond. Brandingrechten en bijlagenschrijfrechten blijven vereist.

**Oplossingspad:** hergebruik de bestaande file-signatures en `validateDocumentFile` voor ondersteunde bijlagetypes; normaliseer brandingrasterbeelden met byte-, pixel- en dimensielimieten en leid het uiteindelijke MIME-type af van de output. Patch sharp vóór verbreding van het decodergebruik. Voeg waar de productpolicy dat vereist een echte scanner/quarantaine toe; een signaturecheck is geen malwarescan.

**Acceptatie:** correcte formats werken; verkeerde bytes met toegestane MIME, extensie/MIME-conflicten, lege files en overschrijdingen worden geweigerd vóór upload. Controleer ook direct toegankelijke storage-/metadatawrites, zodat alleen API-validatie geen omweg laat bestaan.

## SEC-06 — dependencyachterstand in build- en testpaden

**Locatie:** [remote lockfile](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/package-lock.json#L8319).

De volledige audit van de remote lockfile meldt **12 packagebevindingen: 10 HIGH, 2 MODERATE, 0 CRITICAL**. Dit zijn packages inclusief transitieve meldingen, geen 12 onafhankelijke exploitpaden. De productieboom bevat twee HIGH-meldingen: sharp (SEC-02) en `source-map-js` **1.2.1**. source-map-js is bereikbaar via Next's PostCSS-dependency; dat maakt het nog geen publiek requestpad.

De overige gemelde packages zijn `@next/eslint-plugin-next`, `eslint-config-next`, `fast-glob`, `micromatch`, `braces`, `brace-expansion`, `browserslist`, `js-yaml`, `vitest` en `@vitest/mocker`. De [source-map-js advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) beschrijft event-loop-DoS via onbetrouwbare indexed source maps en noemt **1.2.2** als gepatchte versie. Een pad waarbij HR-gebruikers zulke source maps aanleveren, is niet gevonden.

**Impact:** vooral beschikbaarheid en integriteit van development-/build-/testprocessen die onbetrouwbare input verwerken. Runtime-impact van source-map-js blijft onbewezen. Een extern bereikbare Vitest-server vergroot het risico; zo'n server is niet in deze review gestart of aangetoond.

**Oplossingspad:** werk eerst source-map-js en direct patchbare tooling gecontroleerd bij, en controleer opnieuw de transitieve dependencyboom. Upgrade Vitest tot een versie buiten de advisory-range. Voor lint/glob-ketens: kies een ondersteunde compatibele upgrade of zorgvuldig geteste override. De audit suggereert voor een deel een downgrade van eslint-config-next naar 14.2.35; dat is geen passend automatisch herstel voor dit Next 16-project. Voer geen blinde force-fix uit.

**Acceptatie:** audit per runtime/tooling; lint, relevante tests en build met de bijgewerkte lockfile; geen extern toegankelijke development-/testservers. Houd een eventuele nog niet patchbare melding apart met aantoonbare bereikbaarheid en mitigatie.

## SEC-07 — ontbrekende CSP en ongelijk securityheaderbeleid

**Locatie:** [HR headers](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/hr-suite/lib/security/security-headers.ts) en [Control next.config.ts](https://github.com/EdwinCycling/LiquidHR/blob/249c737941d682cb834e313097a9df009549c11b/apps/liquidhr-control/next.config.ts).

HR definieert HSTS, nosniff, framebeleid, referrerbeleid en permissionsbeleid, maar geen Content-Security-Policy. Control definieert geen vergelijkbaar appheaderbeleid; de Control-proxy vult dit niet aan. Hosting kan aanvullende headers geven, maar dat is niet live gecontroleerd.

**Impact:** ontbrekende defense in depth bij een toekomstige injectiefout; mogelijk ontbrekende framingbescherming op het platformbeheerportaal. Dit is geen vastgestelde XSS. De bekeken documentrenderer ontsnapt tekst en laadt scoped, hashgecontroleerde rasterassets als data-URL's; er is geen concrete document-SSRF vastgesteld.

**Oplossingspad:** deel een consistente baseline tussen HR en Control en voeg een nonce-/hashgeschikte CSP eerst in Report-Only toe. Inventariseer werkelijke connect-, image-, font-, frame- en scriptbronnen. Behoud de beperkte same-origin dossierpreviewuitzondering. Maak CSP daarna enforced zodra normale flows zonder overtredingen werken. Overweeg voor de server-PDF-renderer aanvullend JavaScript en netwerkrequests te blokkeren als het rendercontract die niet nodig heeft.

**Acceptatie:** headers op daadwerkelijke responses van login, dashboard, API en documentpreview; Control weigert ongewenst framing; OAuth, realtime voice, fonts en documentpreview blijven werken. Hosted bewijs is nodig om deze bevinding te sluiten.

## Uitgevoerde verificatie en positieve controles

- Remote main aan begin en eind teruggelezen; ongetrackte bestaande `.tmp-control02-vitest/` en `[f.action` ongemoeid gelaten.
- Gecontroleerde bronnen: centrale permissions/context, auth-/testauthgrenzen, Control OAuth/proxy, Workforce BFF/MCP, controlled actions, geselecteerde Insights/adminservices, file-/document-/beeldpaden en relevante migrations/grants/policies.
- Remote-lockfile volledige audit en productie-audit uitgevoerd. Audit-exitcode 1 betekent hier dat kwetsbaarheden zijn gevonden.
- Negen bestaande gerichte testbestanden: **57/57 tests geslaagd**. Auth permissions, login-rules, Test Auth, securityheaders, PII-crypto, CSV-escaping, HTML-rendering, controlled actions en de APIAI-06-migrationcontracttest.
- Twee tijdelijke reproductietestbestanden: **3/3 tests geslaagd**; open redirect na gemockte exchange, vreemde Origin/text/plain doorgelaten naar gemockte roleservice en branding-MIME-spoofing doorgelaten naar gemockte upload. Deze tests bevestigen de bevindingen, niet herstel ervan.
- De eerste teststart werd door sandbox-EPERM vóór testuitvoering geblokkeerd. Na toegestane uitvoering buiten de sandbox slaagden de bestaande tests. Twee tijdelijke testharnessfouten (importpad en Control-authmock) zijn hersteld vóór de geslaagde reproducties.
- Dependencies uitsluitend in de bronkopie geïnstalleerd met `npm ci --ignore-scripts`; install gaf een enginewarning: aanwezige Node 22.14.0 ligt onder het door Chromium vereiste Node 22.17.0. Er is geen PDF-/buildbewijs onder deze runtime geclaimd.
- Test Auth en MCP hebben bronmatig expliciete lokale runtime-/featuregrenzen. De CSV-helper neutraliseert spreadsheetformules. De adminclient is server-only en bewaart geen sessie. Bekeken views gebruiken `security_invoker`; dit is geen certificering van alle databaseobjecten.
- Canonieke `.env.local` alleen op bestaan gecontroleerd; geen secretwaarden gelezen. Geen wijziging aan `apps/hr-suite/next-env.d.ts`.

## Open bewijs en vervolgvolgorde

Deze punten zijn verificatiegaten, geen extra bewezen kwetsbaarheden:

1. **P1 — PostgreSQL/RLS/storageacceptatie:** voer SEC-01 uit op een geïsoleerde of expliciet toegestane TEST-database; controleer actuele grants, policies, triggers en migrationdrift. Supabase-advisors en volledige table/RPC-inventaris zijn in deze run niet live opgehaald. RLS moet de Data API zelf beschermen; zie de [Supabase RLS-documentatie](https://supabase.com/docs/guides/database/postgres/row-level-security).
2. **P1 — exact deployed SHA en runtime:** deze review bewijst GitHub-main, niet de huidige Vercel-/Supabase-status. Controleer na fixes een kandidaat met exact dezelfde SHA, geïnstalleerde imagebinaries en synthetische persona-negatives. Production is in deze run niet benaderd.
3. **P2 — brede negatieve matrix:** owner/operator/auditor, ingetrokken tenant-/HR-group-/administratietoegang, ESS-blocking, direct API/RPC/storage, cross-tenant en verlopen/ingetrokken sessies. De 57 unit-/contracttests vervangen die matrix niet. Publieke recruitmentconfiguratie is in code fail-closed; actuele Turnstile-/scanner-/limiterconfig is niet live beoordeeld.
4. **P2 — volledige secrets-/supply-chaincontrole:** gerichte server-only- en tracked-filenamecontrole is uitgevoerd, geen volledige Git-history-secretscan, CI-permissionsaudit of SBOM/containeranalyse.

**Aanbevolen uitvoering:** SEC-01 en SEC-02 eerst; daarna één samenhangende origin-/redirect-/uploadvalidatieslice (SEC-03–05); vervolgens toolingpatches en headerhardening (SEC-06–07). Per slice regressies toevoegen en pas sluiten met de beschreven acceptatie. Geen productfixes of remote wijzigingen zijn door deze rapportopdracht uitgevoerd.
