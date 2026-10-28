# PMUX-SECURITY-FIXTURE-ACCEPTANCE-05 — Core TEST

**Datum:** 27 oktober 2026

**Status:** **PARTIAL** — positieve Manager- en Employee-readchecks, negatieve scopechecks en één toegestane Manager-claim PASS; verouderde kandidaat en WVP-procesacceptatie OPEN/BLOCKED.

**Project:** LiquidHR Core TEST `wnpfloqpjvaacobppbpk`

**Codebasis:** `work/pmux-security-authorization-hardening-01-20261026`, HEAD `25a5042986bb758f292dad6e74ef8a12ddb2fca7`

**PR:** [#52](https://github.com/EdwinCycling/LiquidHR/pull/52), open en Draft; head-SHA is gelijk aan de lokale codebasis.

## Hergebruikte fixtures en scopes

Geen nieuwe persona, werknemer, tewerkstelling, administratie of procesinstantie aangemaakt. De bestaande synthetische TEST-persona's en processen zijn hergebruikt.

| Actor | Subject | Administratie / teamscope | Proces en werkitem | Bewijs |
| --- | --- | --- | --- | --- |
| Test HR Admin (`TENANT_ADMIN`) | Geen; werkbakfilter | Planeten / Jupiter BV `8483abc9-f275-c80b-5a23-fedc54ce9f0a` | Werkbak | Geldige context: HTTP 200, 9 items. Onbekende administratie-ID `00000000-0000-4000-8000-000000000099`: HTTP 200, 0 items. |
| Manager Yara; user `71e35860-95c9-4ba3-ac9a-6b366096d8ec`, employee `9048f02b-4fdc-3c4c-e1aa-fd339660029c` | Noah `c6b1c7a9-c250-3d19-b1a0-87e317e80b13` | Jupiter; Yara is directe manager in de bestaande teamscope | Leave-instance `e651d6bd-f696-4b84-8add-505efe3fabfc`; taak `5204a656-3eb6-4004-9095-2b8c363fe2d7` | Proces en taak lezen: HTTP 200. `canAct=true`, `canClaim=true`. Claim: HTTP 200. Status `OPEN` v1 → `CLAIMED` v2. Geen verlofbesluit uitgevoerd. |
| Manager Lisa; user `685971ca-b68d-4fea-9da8-d9c2806aa7d4`, employee `64ad3a23-f59a-4ed0-af41-26dda20ff067` | Noah `c6b1c7a9-c250-3d19-b1a0-87e317e80b13` | Jupiter; Lisa valt buiten Noahs directe teamscope | Leave `e651…` / `5204…`; P9 request `28b2d925-ed7b-4c2f-b4a3-1d297c6ece8a` / `137155e4-fba5-4eac-8550-a8e95cc0ba31`; P9 source approval `07752a3a-5ef4-43ff-95c8-e6723b031b0f` / `5448be60-d891-4efd-a160-126ed7c3d77e`; P10 `7199db2f-2dcc-4943-a0d9-10eec541f89a` / `52520a62-aac9-47fc-8d6d-dc4c648f7dfc` | Proces-/taakread, Leave-claim en Leave-actie: 403. P9-claim en P9 transfer-commit: 403. P10-claim: 403. P10 document-acknowledgement en generieke ACK: HTTP 400; beide geweigerd zonder status-, versie- of toewijzingswijziging. |
| Employee Noah; user `f38fe229-494e-4294-822d-90c19188232f`, employee `c6b1c7a9-c250-3d19-b1a0-87e317e80b13` | Eigen proces en taak | Jupiter; eigen scope | Eigen Leave `e651…`; eigen P10-item `52520…` | Eigen proces-/taakread: HTTP 200. |
| Employee Noah, dezelfde actor | Yara `9048f02b-4fdc-3c4c-e1aa-fd339660029c` | Jupiter; cross-employee | Proces `c20e10fd-14ca-44bb-bb4f-09d6a999b320`; item `a614ac9b-3f97-489c-95ee-4afd4b308c19` | Vreemd proces, item en claim: HTTP 403. |

## Neveneffecten en audit

De enige positieve procesmutatie was de vooraf toegestane claim van Manager Yara op Leave-taak `5204a656-3eb6-4004-9095-2b8c363fe2d7`. De normale API veranderde die taak van `OPEN` naar `CLAIMED`, versie 1 naar 2. De proceshistorie bevat `WORK_ITEM_CLAIMED` op sequentie 5, met actor user `71e35860-95c9-4ba3-ac9a-6b366096d8ec` en employee `9048f02b-4fdc-3c4c-e1aa-fd339660029c`. Er is geen tweede claim geprobeerd. Deze eventrij bevat geen idempotency key.

Read-only database-readback na de proeven:

- Procesinstanties: 14; werkitems: 26; kandidaatrijen: 26; procesevents: 80 (79 vooraf, plus de ene geautoriseerde claim).
- Leave-claimtaak: `CLAIMED`, versie 2. P9 `137155…`: `OPEN`, versie 1. P9 `5448…`: `CLAIMED`, versie 2. P10 `52520…`: `OPEN`, versie 1. De negatieve acties wijzigden deze statussen, versies of kandidaten niet.
- De 26 bestaande kandidaatrijen bevatten 0 rijen met `is_eligible=false`. Voor de out-of-team Manager Lisa bestaat geen kandidaatrij op de gebruikte workflows. Daarmee is geen echte verouderde kandidaatrij getest.
- Geen notificatie verzonden, geen proces gestart, geen nieuwe fixture toegevoegd en geen migratie opnieuw toegepast.

De gerichte browser/API-acceptatie gebruikte de officiële lokale TEST-launcher op loopback `3012`, de bestaande lokale Test Auth-flow en de reguliere app/API-routes. Er is geen service-role- of directe SQL-write-bypass gebruikt. De eerder vastgelegde lokale securitycontracttests `39/39 PASS` zijn niet herhaald; er is geen algemene suite uitgevoerd.

## WVP01

Read-only verificatie bevestigde dat de WVP-basismigratie (`20261026055349`, geregistreerd als `20261026131216`), WVP-auditcorrectie (`20261026172808`, geregistreerd als `20261026175140`) en PMUX-securitymigratie (`20261026190604`, geregistreerd als `20261027170458`) aanwezig zijn. Geen migratie is in deze run uitgevoerd.

De bestaande casus `356e0c99-5d67-4e7a-a0da-3b7219ef617f` is `ACTIVE`, met eerste verzuimdag 26 oktober 2026. Er zijn 0 WVP-guidance-links en geen procesinstantie voor deze casus.

De gepubliceerde WVP-definitie `02bfc76b-e55c-4802-b74d-da04f2168e24`, versie 1 `568f9ca3-cd6a-498c-8b36-42d14d998b8b`, heeft voor participant `case-owner` zowel `permission` als `selector.permission` op `process-definition:publish`, met queue `wvp01` en Jupiter-scope. Deze permissieconfiguratie is niet geschikt als bewijs van normale taakuitvoeringsautorisatie. WVP-processtart is daarom **BLOCKED**; geen taak, mijlpaal of audit-event is voor WVP aangemaakt.

## Open acceptatiepunten en advies

1. **Verouderde kandidaat — OPEN.** De bestaande rijen zijn actueel bevoegd. De passende Manager-taken horen bij Noah, die meerdere actieve Leave/P9/P10-processen en de WVP-casus heeft. Een tijdelijke teamverplaatsing zou meerdere bestaande workflows tegelijk beïnvloeden. Er is geen geïsoleerde bestaande fixture gevonden waarmee dit veilig kon worden bewezen. Er is geen nieuwe testpersoon of proces aangemaakt.
2. **P10-adapterstatus — PARTIAL.** De twee ongeautoriseerde P10-actieproeven faalden zonder neveneffect, maar rapporteerden HTTP 400 in plaats van de verwachte 403. Read en claim waren respectievelijk toegestaan voor de eigen medewerker en geweigerd voor de out-of-team Manager. De afwijkende statusmapping blijft te beoordelen.
3. **WVP — BLOCKED.** De gepubliceerde definitie gebruikt `process-definition:publish` in de taakselectie; start zou de ontbrekende Manager-/Employee-taakautorisatie niet aantonen.

**Merge PR #52: HOLD. TEST-release: HOLD.** De positieve Manager-claim en positieve eigen Employee-read zijn aangetoond; de ontbrekende stale-candidate-proef, P10-statusmapping en onveilige WVP-definitie verhinderen volledige acceptatie.

## Wijzigingen in deze run

Geen code-, schema-, grant-, RLS-, rol-, scope-, persona- of procesdefinitiewijziging. Er is precies één bestaande synthetische Leave-taak geclaimd zoals hierboven vastgelegd. PR #52 is niet gewijzigd, blijft Draft en is niet gemerged. Geen push of deployment uitgevoerd.

De werkboom had `apps/hr-suite/next-env.d.ts` gewijzigd toen de Git-status werd gecontroleerd. Dit beschermde bestand is niet aangepast of gestaged. Het rapport is het enige nieuwe acceptance-bestand.
