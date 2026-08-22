# Continuous Appraisal — Foundation v1.2 redesign

Status: lokaal geïmplementeerd; authenticated acceptance geblokkeerd door ontbrekende lokale Supabase-env
Route: `/workforce/continuous-appraisal`
Self-service route: `/my-appraisal`
Run: `R3-APPRAISAL-20260822-01`

## Doel

Continuous Appraisal is een gedeelde manager/HR-tijdlijn voor notities, acties, afspraken, feedback, doelen en gespreksverslagen. Deze slice maakt de bestaande workflow rustig, zakelijk en voorspelbaar zonder de bestaande item-, status-, actor/employee-, permission-, comment-, attachment-, API- of businesssemantiek te wijzigen.

## Foundation-beslissingen

- Collectie: één timeline-workbench met normale page scroll; geen generieke view-switch en geen nested card-per-item.
- Filters: `CollectionToolbar` voor zoeken/sorteren/nieuw item, `FilterBar` voor status/eigenaar/periode en `ScrollableTabs` voor typefilter. Filtercontext wordt in de URL bijgehouden.
- Create/Edit: bestaande appraisal-items gebruiken `FormDrawer` met dezelfde flow, vaste Save/Cancel-footer en dirty-form protection. Itemtype en datum blijven bij edit immutable volgens het bestaande contract.
- Item actions: `RowActions` toont alleen edit voor `canEdit`; het append-only “niet meer relevant”-commentaar staat alleen voor schrijvers open. `ActionMenu` blijft de secundaire actie-ingang.
- Status/permission: Foundation `Badge`-tones maken type/status/prioriteit zichtbaar; read-only gebruikers krijgen een expliciete uitleg en geen mutatiecontrols.
- Responsive: desktop gebruikt timelinekolommen en een betekenisvolle opvolgings-aside; circa 390px stapelt de timeline, filtervelden en actions zonder verplichte horizontale pagina-scroll.
- Theme: uitsluitend Foundation semantic tokens en gedeelde primitives; Default en LinkedHR gebruiken dezelfde componentcode.

## Functionele grenzen

Behouden zijn de bestaande routes, services, API-payloads, optimistic version, historische immutability, commentlimiet van 100 tekens, manager-only feedback, tenant/manager/self scope, private attachment-flow en geen delete-route. Er is geen schemawijziging, migration, RLS-, permission- of remote databaseactie uitgevoerd.

Een attachment-control wordt niet meer getoond op historische/vergrendelde items; bestaande attachments blijven leesbaar. Dit voorkomt een zichtbare actie die de bestaande serverregel altijd zou afwijzen.

## Verificatie en open gate

- Gerichte collection-contracttest: 2/2 groen.
- Strict TypeScript: groen na lokale lockfile-conforme dependency-installatie.
- `check:i18n`: groen, 33 NL/EN-namespaces gelijk.
- Gerichte ESLint: groen.
- `git diff --check`: groen.
- Browser/API acceptance op poort 3111: niet uitvoerbaar. De server bereikt geen login/route omdat `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in deze worktree/runtime ontbreken. Er zijn geen mocks, credentials of auth/RLS-bypasses gebruikt.
- Desktop/390px, Default/LinkedHR, positieve persona, CREATE/READ/EDIT/action/status/readback en negative permission/scope blijven daardoor open voor een environment met echte Supabase-configuratie en sessies.
