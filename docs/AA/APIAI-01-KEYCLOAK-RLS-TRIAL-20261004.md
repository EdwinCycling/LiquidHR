# APIAI-01 — Keycloak → LiquidHR → Supabase RLS-proef

**Datum:** 2026-10-04 (Europe/Amsterdam)
**Status:** **PARTIAL / INTEGRATIE NIET BEWEZEN / ROUTES ONGEMOUNT**
**Worktree:** `C:\Users\Edwin\.codex\worktrees\apiai01-build-20261003\LiquidHR`
**Branch:** `work/apiai-01-build-20261003`
**Code-checkpoint bij start van deze proef:** `3a02911f8f48a9e743574ba4c98212dc45220f50`
**GitHub `origin/main` bij start:** `6349d02538351cd01fc51f298c6e6fa0ba88006c`

Dit document rapporteert uitsluitend de Keycloak-proef en de grens naar de
bestaande LiquidHR-authenticatie en Supabase RLS. Het is geen providerselectie,
securitygoedkeuring, OAuth-activatie of bewijs dat APIAI-01 live-ready is.

## 1. Opdracht en veiligheidsgrens

De proef moest vaststellen of een Keycloak access token veilig door de keten
kan lopen:

```text
Keycloak access token
  → providerverificatie en actuele tokenstatus
  → unieke (issuer, subject)-koppeling naar auth.users.id
  → Supabase-client met exact dezelfde bearer
  → Supabase Auth claims / auth.uid()
  → actuele LiquidHR AuthContext en bestaande servicechecks
  → RLS-begrensde Development Plans-read
```

Binnen deze run heb ik:

- geen provider-, client-, realm-, Supabase-, TEST- of OAuth-configuratie
  gewijzigd;
- geen shared `.env.local` gelezen, gekopieerd of gewijzigd;
- geen remote call uitgevoerd die schrijft;
- geen route gemount, geen schemawijziging toegepast en geen service-role-client
  gebruikt;
- geen ander worktree, app-authbestand of RLS-bestand gewijzigd.

## 2. Bestaand Keycloak-bewijs

De repository bevat geen Keycloak-harness of providerconfiguratie om opnieuw
te starten. De eerder uitgevoerde, geïsoleerde Keycloak 26.8.0-proef is wel in
de APIAI-acceptatiedocumentatie vastgelegd. Dat bewijs is provider-only en is
in deze run niet opnieuw uitgevoerd:

| Controle | Vastgelegd resultaat | Wat dit wel bewijst | Wat dit niet bewijst |
| --- | --- | --- | --- |
| Dynamic Client Registration | HTTP `201` | Een geïsoleerde Keycloak-client kon worden geregistreerd | Geen LiquidHR-clientregistry of duurzame clientgoedkeuring |
| Authorization Code + PKCE | `S256` en consent slaagden; verkeerde verifier gaf HTTP `400` | De geteste Keycloak-clientflow en PKCE-negatieve | Geen LiquidHR callback, accountlink of route-auth |
| Discovery/JWKS | Discovery en JWKS slaagden; er waren twee sleutels | Provider metadata en sleutelpublicatie in de tijdelijke proef | Geen verificatie in de APIAI-provideradapter |
| Access token/UserInfo | Geldige bearer HTTP `200`; tampered bearer HTTP `401` | Keycloak valideerde de bearer op UserInfo | Geen Supabase JWT en geen `auth.uid()` |
| Logout/revoke | Dezelfde nog geldige access bearer gaf na refresh-token logout HTTP `401`; verlopen token gaf ook `401` | De beschreven tijdelijke Keycloak UserInfo-lifecycle | Geen revocatiegedrag door een LiquidHR-route of gateway |
| Audience | Een expliciete audience mapper was nodig | Audience moet bewust in het Keycloak-tokencontract worden opgenomen | Geen vastgestelde API-resource-audience voor LiquidHR |

Bronnen in de repository:

- [`APIAI-01-ACCEPTANCE-RUN-20261003.md`](./APIAI-01-ACCEPTANCE-RUN-20261003.md), sectie 17, regel 180 van het actuele worktree-bestand.
- [`APIAI-01-SECURITY-INTEGRATION-20261004.md`](./APIAI-01-SECURITY-INTEGRATION-20261004.md), sectie 5, regel 70.
- [`APIAI-01-SECURITY-INTEGRATION-DECISIONS-20261004.md`](./APIAI-01-SECURITY-INTEGRATION-DECISIONS-20261004.md), P-01, regel 14.

Er zijn geen tokens, subjects, e-mailadressen, client secrets, JWKS-inhoud of
andere providercredentials in dit document opgenomen.

## 3. Actuele lokale omgevingscontrole

De controle is uitgevoerd vanuit de toegewezen APIAI-01-worktree. De
uitkomsten zijn:

| Component | Resultaat |
| --- | --- |
| Docker CLI | Aanwezig (`C:\Program Files\Docker\Docker\resources\bin\docker.exe`) |
| Docker daemon | Niet bereikbaar: named pipe `docker_engine` bestaat niet / daemon draait niet |
| Java | Niet gevonden in `PATH` |
| Keycloak CLI/runtime | Niet gevonden in `PATH` |
| Supabase CLI | Niet gevonden in `PATH` |
| Local Keycloak kandidaatpoorten `8080`, `8081`, `8180` | Vrij; geen lokale providerlistener |
| Local Supabase/Auth/PostgREST kandidaatpoorten `54321`, `54322`, `54323` | Vrij; geen lokale Supabase-stack |

Daarom waren er in deze worktree geen reeds geautoriseerde lokale componenten
om een geïntegreerde proef veilig tegen uit te voeren. Een nieuwe Keycloak- of
Supabase-stack zou Docker, tijdelijke providerconfiguratie, synthetische
accounts en een lokale database-runtime vereisen. Die componenten zijn niet
aanwezig en het maken van gedeelde TEST-configuratie valt buiten deze opdracht.

Er is dus bewust geen bearer naar een LiquidHR-HTTP-route gestuurd. Een
`401`/`404` zonder route en zonder providerstack zou geen RLS-bewijs zijn.

## 4. Wat de huidige LiquidHR-codecontracten afdwingen

De statische inspectie van de huidige kandidaat bevestigt dat de integratie nog
een adapter- en infrastructuurgat bevat, maar dat de richting fail-closed is:

1. `apps/hr-suite/lib/api-v1/auth/delegated.ts:9-35` definieert het
   providerresultaat als geïnjecteerd contract. De provideradapter moet zelf
   signature/JWKS, issuer, audience, expiry en revocation controleren. Er staat
   geen Keycloak-adapter of providerconfiguratie in deze module.
2. `delegated.ts:47-52` resolveert uitsluitend de exacte `(issuer, subject)`-
   combinatie. E-mailmatching is geen fallback. Ontbrekende of dubbele links
   worden geweigerd.
3. `delegated.ts:199-231` hercontroleert issuer, audience, expiry en actieve
   revocation en controleert daarna per request de actieve clientregistratie.
4. `apps/hr-suite/lib/api-v1/auth/bearer-rls.ts:287-316` vereist dat de
   provideradapter een RLS-client maakt met de exact ontvangen access token en
   dat die binding intern overeenkomt met de geverifieerde identiteit.
5. `bearer-rls.ts:356-405` leest claims en de actuele tenant/HR-groep/
   administratiecontext via diezelfde bearergebonden client. De Supabase `sub`
   moet exact gelijk zijn aan de gekoppelde LiquidHR `auth.users.id`; anders
   volgt `RLS_SUBJECT_MISMATCH`. Ambigue contextselectie faalt gesloten.
6. `bearer-rls.ts:425-486` weigert service-role-keys, zet geen cookie storage of
   refreshflow aan en stuurt de bearer expliciet in REST- en Auth-verzoeken.
   Daarmee is een Keycloak-bearer op zichzelf nog geen Supabase Auth-bearer:
   er moet een goedgekeurde bridge/providerroute bestaan die een voor Supabase
   geldig subject-token oplevert of de Supabase Auth-laag daarvoor configureert.
7. De tests in `apps/hr-suite/lib/api-v1/auth/delegated.test.ts:18` noemen de
   tokens expliciet synthetisch en de provider doubles lokaal. Zij bewijzen
   contractgedrag, geen Keycloak-token, netwerkvalidatie, `auth.uid()` of RLS.

De tracked lokale Supabaseconfiguratie noemt Keycloak alleen als een mogelijk
extern provider-type in het commentaar
(`apps/hr-suite/supabase/config.toml:319-321`). De OAuth-server staat expliciet
uit (`config.toml:365-372`, `enabled = false`) en er is geen geconfigureerde
Keycloak-client of realm in deze worktree.

## 5. Integratiebeoordeling

| Schakel | Status in deze run | Bewijsgrens |
| --- | --- | --- |
| Keycloak Authorization Code + PKCE S256 | **Historisch provider-only bewijs** | Vastgelegd in acceptatiedocumentatie; geen huidige lokale harness |
| Keycloak issuer/audience/JWKS/revocation | **Gedeeltelijk** | Providerproef en codecontract; geen huidige LiquidHR-verifier |
| Keycloak subject → bestaande LiquidHR-user | **Niet bewezen** | Geen echte account-link store of provider bearer in deze run |
| Keycloak bearer → Supabase Auth geldig token | **Niet bewezen** | Keycloak JWT wordt niet automatisch een Supabase Auth JWT |
| Supabase `auth.uid()` = gekoppelde `auth.users.id` | **Niet bewezen** | Geen lokale Auth/PostgREST/PostgreSQL-listener |
| RLS read voor self-only Development Plans | **Niet bewezen** | Routes zijn ongemount; geen echte bearer-HTTP-read |
| Tenant/HR-groep/administratie/actor-negatives | **Niet bewezen** | Geen live RLS-context beschikbaar |
| Same-token revoke direct na intrekking via LiquidHR | **Niet bewezen** | UserInfo-providerbewijs is geen route/gatewaybewijs |

De centrale technische conclusie is daarom:

> De bestaande Keycloak-proef bewijst dat Keycloak in een geïsoleerde providerflow
> een geldig/tampered token en een revoke-negatieve UserInfo-call kan behandelen.
> Zij bewijst niet dat dezelfde access token in LiquidHR de gekoppelde Supabase
> `auth.uid()` oplevert of door de Development Plans-query door Supabase RLS wordt
> geaccepteerd. Zonder een expliciet geteste bridge zou een directe doorsturing
> van een Keycloak-token naar Supabase een ongeldige identity-aanname zijn.

## 6. Officiële documentatie die de grens ondersteunt

- [Keycloak OIDC layers](https://www.keycloak.org/securing-apps/oidc-layers): discovery, JWKS, token introspection en token revocation zijn afzonderlijke endpoints. Introspection is volgens de documentatie alleen voor confidential clients beschikbaar.
- [Keycloak 26.8 Server Administration Guide](https://www.keycloak.org/docs/26.8.0/server_admin/): PKCE kan per client op `S256` worden vereist en audience moet via een mapper worden opgenomen. De sessie-/revocationdocumentatie waarschuwt dat uitloggen niet automatisch alle reeds uitgegeven access tokens intrekt voor iedere adapter; dit maakt een directe same-bearer-negatieve in de uiteindelijke LiquidHR-keten noodzakelijk.
- [Supabase Token Security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security): Supabase OAuth-tokens bevatten Supabase Auth-claims, OAuth-scopes bepalen identitydata en RLS bepaalt datatoegang. Een Keycloak-token krijgt die Supabase claims niet vanzelf.
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): zonder geldig Auth-token is `auth.uid()` `null`; een positieve RLS-proef vereist dus een door Supabase Auth geaccepteerde bearer.
- [Supabase OAuth 2.1 Server](https://supabase.com/docs/guides/auth/oauth-server): Supabase kan zelf OAuth-tokens uitgeven die bestaande RLS respecteren, maar de lokale repositoryconfiguratie heeft deze server niet ingeschakeld en er is geen geïntegreerde proef uitgevoerd.

## 7. Resterende technische gate

APIAI-01 blijft **niet bouw-/route-activatie-GREEN** op deze gate. Voor een
volgende geïsoleerde proef zijn minimaal nodig:

1. Een volledig geïsoleerde, reproduceerbare Keycloak-stack of expliciet
   gekozen alternatief met S256-required, vaste issuer/resource-audience,
   asymmetrische JWKS, clientregistratie en vastgelegde introspectie/revoke-
   liveness.
2. Een expliciet goedgekeurde identity bridge: een bewijsbare mapping van
   `(issuer, subject)` naar exact één bestaande `auth.users.id`, plus een
   Supabase-geaccepteerd tokenpad. Een Keycloak JWT, ID-token, e-mailadres of
   browsercookie mag niet als vervanging worden gebruikt.
3. Een lokale Supabase/PostgreSQL-stack of andere expliciet goedgekeurde
   geïsoleerde testtarget waarop `auth.uid()` en RLS daadwerkelijk kunnen worden
   gelezen met de bearergebonden client.
4. Positieve self-only Development Plans-read en negatieve proeven voor actor,
   subject, tenant, HR-groep, administratie, permission, module, client,
   malformed/tampered token en dezelfde bearer onmiddellijk na revoke.
5. Bewijs dat limiter en READ-audit pas na dezelfde routeketen worden
   uitgevoerd; geen directe service-role-read of door de caller vervalste audit-
   status/correlation.

Tot die tijd blijven de drie APIAI-01-routes ongemount. Dit document doet geen
providerkeuze en verandert geen approvalstatus.
