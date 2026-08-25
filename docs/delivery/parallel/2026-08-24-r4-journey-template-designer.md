# R4 Journey Template Designer — parallel handoff

**Status:** `GREEN` — authenticated HR/Manager/Employee acceptance afgerond; geen Journey geactiveerd.
**Baseline:** `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`
**Branch:** `work/r4-journey-template-designer`
**Worktree:** `C:\Users\Edwin\Documents\Apps\LiquidHR.codex-worktrees\r4-journey-template-designer`
**Runtime:** poort `3154`, Next Webpack
**Testprefix:** `R4-JNY-DESIGN`

## Scope

Owned surface:

- `/settings/journeys/templates/[templateId]`;
- `components/journeys/template-designer.tsx`;
- directe Journey template service/API-tests en minimale Journey i18n-labels.

Niet gewijzigd:

- `TemplateCatalog`;
- `/journeys/new` activation;
- Journey DSL/model, schema, migration, RLS, permissions, RPC- of API-contract;
- generieke Foundation-bestanden;
- centrale delivery/statusdocumenten, app-version, package-version, remote TEST/production.

## Implementatie

De bestaande designer gebruikt nu de bestaande Foundation-primitives en -patterns:

- `PageShell`, `PageHeader`, `Surface`, `SectionHeader`, `FormField`, `TextInput`, `Textarea`, `Checkbox`, `DropdownSelect`, `Badge`, `FormActions` en `ConfirmDialog`;
- sticky full-page actions met saving/double-submit protection en zichtbare saved/published/error state;
- echte read-only controls voor viewers zonder writepermission;
- dirty navigation protection voor back/cancel en `beforeunload`;
- ConfirmDialog voor publish, retire en discard; geen `window.confirm`;
- publish/retire zijn geblokkeerd zolang er niet-opgeslagen draftwijzigingen zijn;
- verwijderen van gebruikte fases/rollen/momenten is geblokkeerd om referentiefouten te voorkomen;
- fase-, rol-, moment- en topicbewerking blijft op het bestaande `JourneyTemplateDraft`-contract gericht;
- structurele key-inputs gebruiken een Chromium-v geldige escaped hyphen in de bestaande pattern-validatie;
- NL/EN labels zijn paritair uitgebreid.

De bestaande lifecycle blijft leidend: draft save met optimistic `revision`, publish naar een nieuwe immutable version, retire als bestaande lifecycleactie. Er is geen journey geactiveerd.

## Permissions / security contract

De bestaande server- en RLS-grenzen zijn behouden:

- designer lezen via bestaand `journey-template:read`/write/publish-contract;
- draft mutation via `journey-template:write`;
- publish/retire via `journey-template:publish`;
- moduleguard `JOURNEYS`, actieve tenant en HR-groep blijven server-side afgedwongen;
- geen client-side permission-bypass, schemawijziging of remote migration.

## Tests and local gates

- TemplateDesigner regressietest: **1 bestand / 4 tests groen**;
- volledige hr-suite: **235 testbestanden / 903 tests groen**;
- strict TypeScript: **groen**;
- i18n: **groen**, 33 NL/EN-namespaces met gelijke sleutels;
- volledige ESLint: **groen**;
- `git diff --check`: **groen**;
- Webpack-productiebuild: **groen**, compilatie en 224 statische pagina's;
- standaard Turbopack-build: geblokkeerd vóór compilatie door de worktree-junction naar `node_modules` buiten de filesystem-root; geen codefout.

## Runtime / browser evidence

Preflight:

- canonical `apps/hr-suite/.env.local` was aanwezig en zonder inhoud te tonen naar deze worktree gekopieerd;
- Webpack devserver startte op `3154` en compileerde `/login` en `/dashboard/start` zonder productcompile-error;
- `GET /login` → `200`;
- unauthenticated `GET /api/journeys/templates` → `401`, body `{"error":"Je bent niet ingelogd."}`;
- unauthenticated designer-route → `307` naar `/login?next=...`;
- HR-login bereikte de app; de designer-route gaf HTTP `200`.
- Anonieme `GET /api/journeys/templates` gaf `401`; beschermde designer-route gaf `307` naar login.

Acceptance-run `R4-JNY-DESIGN-20260825132937`:

- HR create: `POST /api/journeys/templates` → `201`; template `ad0e236d-4cf0-46e8-9b7d-eb3cb3169563`, draft `7ecccfa8-1567-4a68-9ef4-f98002df197d`.
- Fresh create-readback: `GET /api/journeys/templates/{templateId}` → `200`, lifecycle `DRAFT`, revision `1`.
- Designer load: route `200`; basisveld gewijzigd naar `R4-JNY-DESIGN-20260825132937 aangepast`; bestaande phase gewijzigd van `Start` naar `Startmoment`.
- Dirty protection: confirmation zichtbaar; annuleren via `Terug naar formulier` behield de designerroute.
- Desktop `1440x900`: `scrollWidth=1440`, geen horizontale overflow. Mobiel `390x844`: `scrollWidth=390`, geen horizontale overflow.
- Save: `PUT /api/journeys/template-drafts/{draftId}` → `200`, revision `2`; fresh GET `200` bevestigde beide wijzigingen.
- Publish: confirmation zichtbaar; `POST .../publish` → `200`, `publishedVersionId=30d669bc-0068-4910-8e88-2a7e34a3e9da`, version `1`, source revision `2`.
- Published readback: fresh GET `200`, lifecycle `PUBLISHED`, published version `1`; write-free preview `200` las version `1`, de aangepaste basisnaam en phase terug. Geen activatie uitgevoerd (`canActivate` bleef previewdata, activation-endpoint is niet aangeroepen).
- Published semantics: opnieuw publiceren met dezelfde revision gaf `409 JOURNEY_TEMPLATE_ALREADY_PUBLISHED`; de gepubliceerde versie bleef afzonderlijk bestaan.
- Retire: confirmation zichtbaar; `POST /api/journeys/templates/{templateId}/retire` → `200`; final fresh GET `200`, lifecycle `RETIRED`, published version `1` bleef zichtbaar.
- Designer-consolecapture na route-load en vóór de intentionele 409: **0 errors**.

Persona-negatives tegen hetzelfde template:

- Manager: list/detail/create/save/publish/retire ieder `403`.
- Employee: list/detail/create/save/publish/retire ieder `403`.
- Anonymous API: `401`.

Cleanup: de definitieve template staat `RETIRED`, conform het bestaande cleanupcontract. Vijf eerdere selector/timing-probes en de laatste definitieve run zijn eveneens `RETIRED` achtergelaten omdat hard-delete niet bestaat: `f1f70e13-b0ce-4c84-b628-ac054da1b244`, `a1b2de7d-7ad1-4877-b917-63b6e813974b`, `1fb62d5d-24e5-4088-9495-30114f830d34`, `bacb3d53-50b4-4463-b7b9-70fe72ed7a42`, `f7c06bf4-ed74-43cb-b29a-784e1aea371e`, `ad0e236d-4cf0-46e8-9b7d-eb3cb3169563`.

## Integration notes

- Alleen de owned designer-route, directe page wrapper, Journey label-loader, NL/EN Journey-labels, componentregressiesuite, Chromium-v regexfix en dit parallel-handoffdocument zijn gewijzigd.
- `apps/hr-suite/next-env.d.ts` is na de Webpack devserver teruggezet naar de tracked baseline en staat niet in de handoffdiff.
- `.env.local` is lokaal aanwezig maar niet tracked/committed.
- Geen push, merge, deployment, remote database write of branch cleanup uitgevoerd.
