# R4 Journey Template Designer — parallel handoff

**Status:** `NOT EXECUTED — TOOLING LIMITATION` voor de authenticated mutation-lifecycle; lokale implementatie- en testgates zijn GREEN.
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

- TemplateDesigner + directe service/API-tests: **9/9 groen**;
- volledige hr-suite: **235 testbestanden / 902 tests groen**;
- strict TypeScript: **groen**;
- i18n: **groen**, 33 NL/EN-namespaces met gelijke sleutels;
- gerichte ESLint: **groen**;
- `git diff --check`: **groen**;
- productiebuild: niet uitgevoerd; volgens het R4 parallel contract voor centrale integratie gereserveerd.

## Runtime / browser evidence

Preflight:

- canonical `apps/hr-suite/.env.local` was aanwezig en zonder inhoud te tonen naar deze worktree gekopieerd;
- Webpack devserver startte op `3154` en compileerde `/login` en `/dashboard/start` zonder productcompile-error;
- `GET /login` → `200`;
- unauthenticated `GET /api/journeys/templates` → `401`, body `{"error":"Je bent niet ingelogd."}`;
- unauthenticated designer-route → `307` naar `/login?next=...`;
- één echte TEST HR-login werd in de Playwright-run door de app als `POST /login` → `200` gelogd en `/dashboard/start` werd authenticated gerenderd;
- authenticated startpage snapshot: `0` console-errors, alleen dev/HMR/CSS-preload warnings.

De Playwright CLI echoot ingevulde textboxwaarden in het tooltranscript. Na die toolingbeperking is geen nieuwe secret-invoer geprobeerd. Daardoor zijn de volgende owned acceptance-stappen **niet uitgevoerd**:

- eigen `R4-JNY-DESIGN-*` template aanmaken via bestaande API;
- draft GET, veilige basiswijziging, phase/moment/topic/role-edit, save en fresh GET/readback;
- exacte save/publish/retire statuses, revision/version readback en validatie via echte authenticated API;
- HR designer browserflow, Manager/Employee read-only/negative persona’s;
- designer desktop/`390x844`, theme- en designer-consolecheck.

Er zijn door deze slice geen TEST-records aangemaakt; cleanup en residual IDs zijn daarom `N/A`.

## Integration notes

- Alleen de owned designer-route, directe page wrapper, Journey label-loader, NL/EN Journey-labels, componentregressiesuite en dit parallel-handoffdocument zijn gewijzigd.
- `apps/hr-suite/next-env.d.ts` is na de Webpack devserver teruggezet naar de tracked baseline en staat niet in de handoffdiff.
- `.env.local` is lokaal aanwezig maar niet tracked/committed.
- Geen push, merge, deployment, remote database write of branch cleanup uitgevoerd.
