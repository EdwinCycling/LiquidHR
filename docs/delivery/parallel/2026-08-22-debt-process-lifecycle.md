# Process Automation lifecycle acceptance

Datum: 2026-08-22
Status: GREEN — volledige lifecycle lokaal en in een echte browser/API-sessie geaccepteerd.

## Scope en runtime

- Baseline: `abfa0bbb7db628f588faa3d4818a4f4663f27b46`
- Worktree: `.codex-worktrees/debt-process-lifecycle`
- Branch: `work/debt-process-lifecycle`
- Browser/runtime: exact deze worktree op `http://localhost:3107`
- Auth preflight: `npm.cmd run fixtures:talent-auth -w @liquid-hr/hr-suite` → exit 0; `hr-admin`, `manager` en `employee` bijgewerkt.
- Geen push, merge, deploy of schemawijziging.

## Definitieve acceptance-flow

- Run: `20260822120200-89dbt`
- Naam: `R2-PROCESS-20260822120200-89dbt`
- Key: `r2-process-20260822120200-89dbt`
- Definition ID: `070ccccf-4088-4315-afb0-4bd88bc04696`
- Publicatie-changelog: `R2-PROCESS-20260822120200-89dbt: eerste gevalideerde publicatie.`
- Archiveerreden: `R2-PROCESS-20260822120200-89dbt: acceptance afgerond.`

## HTTP- en lifecyclebewijs

| Stap | Bewijs |
|---|---|
| HR-login en dashboard readback | `200`, `200` |
| Create draft | `POST /api/process-automation/studio` → `201`; dubbele klik leverde exact één geaccepteerde `201` op |
| Draft readback | `GET /api/process-automation/studio/:id` → `200`, status `DRAFT`, unieke key bevestigd |
| Edit draft | draft `POST` → `200`; titel-readback → `200` en waarde bevestigd |
| Verplichte publish-changelog | lege changelog → `400`; ingevulde changelog daadwerkelijk verzonden; readback via `versions[0].definition_json.publishChangelog` bevestigd |
| Publish | echte `POST .../:id/publish` → `200`; catalog → `200`, status `PUBLISHED`, versie `1` |
| Retire | lege reason → `400`; echte `POST .../:id/retire` → `200` |
| History/version readback | `GET .../:id` → `200`, status `RETIRED`, één versie en changelog/versie bevestigd; catalog → `200`, status `RETIRED` |
| Delete-contract | `DELETE .../:id` → `405`; er bestaat geen product-delete-route |

Startability is niet uitgevoerd voor de definitieve unieke flow: de bestaande contractscope voor deze studio-lifecycle eindigt bij publish/catalog/version en retire; een runtime-start zou een aparte procesinstantie/work-item-flow openen. In de baseline-handoff staat afzonderlijk een eerdere `POST .../:id/trial`-proef op record `R2-PROCESS-20260822-123111` met `200` en `writesPerformed: false`; die eerdere proef is niet onderdeel van deze nieuwe flow.

## UX- en securitychecks

- Dirty create: `beforeunload` werd preventief afgevangen; annuleren opende de discard-dialog; “Verder bewerken” behield de invoer; discard sloot de flow.
- Wizard back/close: `Vorige` behield de naam; browser close/back-contract is via dezelfde dirty protection afgedekt.
- Publish- en retire-dialog: confirm-button disabled tijdens pending; Escape sloot de dialog niet; invoer bleef behouden.
- API-error: bewust gesimuleerde publish-response `503` met `TEST_API_ERROR`; changelog bleef zichtbaar en bewerkbaar.
- Desktop: geen horizontale overflow.
- `390x844`: catalog en wizard zonder horizontale overflow; acties `Verder` en `Annuleren` bereikbaar.
- Negative persona: Manager-route gaf een fallback-shell zonder Process Automation-heading; catalog-API gaf `403`. Geen process-UI of write-surface blootgesteld.
- Relevante browser-console-errors: `0` in de definitieve run. Bewuste negatieve HTTP-probes (`400`, `403`, `405`, `503`) zijn afzonderlijk als expected acceptance-status vastgelegd.

## Process-specifieke correctie

De auth-gevoelige Process Automation settings page is expliciet `force-dynamic` gemaakt, zodat permission checks per request worden geëvalueerd. Er is geen generieke Foundation gewijzigd. De uiteindelijke browseracceptance na deze wijziging is volledig groen.

## Testdata-cleanup

Omdat DELETE niet bestaat, zijn herkenbare testrecords retired achtergelaten. De definitieve flow hierboven is het primaire handoff-record. Tussenruns die door selector/assertion-correcties al waren aangemaakt, zijn via het bestaande publish/retire-contract afgerond naar `RETIRED`:

| Definition ID | Key | Eindstatus |
|---|---|---|
| `174c73c0-d27b-4660-9fcd-e91680f1712f` | `r2-process-20260822114441-n0f1b` | `RETIRED` |
| `78b6d250-ddf1-4532-b3e4-fc78cb8839dd` | `r2-process-20260822114608-4qk7g` | `RETIRED` |
| `c7f27dd3-d147-4d7c-b653-f8ea5a5cdcb1` | `r2-process-20260822114753-4ugst` | `RETIRED` |
| `56a870d0-a7be-4a69-9d5f-c974b902f4d0` | `r2-process-20260822114931-4zfnb` | `RETIRED` |
| `2c214ee9-6043-47dd-8af1-c45c32f56810` | `r2-process-20260822115055-c40j8` | `RETIRED` |
| `036da8bc-1fcc-480f-a2bb-d17f0058b488` | `r2-process-20260822115228-ockyc` | `RETIRED` |
| `bef139fd-4fd6-45cc-8b95-80d24711f727` | `r2-process-20260822115409-n4m5m` | `RETIRED` |
| `04e62ee4-258a-49e5-831c-0a7808ffeb4f` | `r2-process-20260822115808-qmblt` | `RETIRED` |
| `58e3dfaa-8179-4ec6-b602-813332ff5fd0` | `r2-process-20260822120026-mwspn` | `RETIRED` |
| `070ccccf-4088-4315-afb0-4bd88bc04696` | `r2-process-20260822120200-89dbt` | `RETIRED` |

Het eerder bestaande record `R2-PROCESS-20260822-123111` is niet door deze run gemuteerd.

## Gates

- Process Automation tests: `9` testfiles, `47` tests passed.
- TypeScript: `tsc --noEmit` passed.
- Targeted lint: `npx.cmd eslint "app/(dashboard)/settings/process-automation/page.tsx"` passed.
- `git diff --check`: passed.
- i18n-check: niet uitgevoerd; er is geen zichtbare tekst of taalmodule gewijzigd.
- Full suite: niet uitgevoerd; wijziging is beperkt tot de process settings page en acceptance-evidence.
