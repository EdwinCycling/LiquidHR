# PAYRUN-ROUTE-01D — Hervatte lokale browseracceptatie — 2026-10-21

**Eindverdict: SECURITY HOLD — browseracceptatie BLOCKED.** De bestaande browsercontext wijkt af van het Mars-only contract. Er zijn geen Payroll-routes of Payroll-data geopend.

## Identiteit en context

De al geopende lokale Chrome-sessie op de bestaande server is read-only gecontroleerd via same-origin GET /api/context.

- HTTP-status: **200**.
- Tenant / HR-groep: **De Sterren holding / Planeten**.
- Geselecteerde administratie: **Jupiter BV**.
- Door de contextservice aangeboden administraties: **Jupiter BV, Mars BV en Mercurius BV**.
- De response bevat geen actor-/user-identiteit of actieve rollen. De identiteit en HR Admin-rol zijn daarom niet bewezen; de sessie kan niet als de canonieke Test HR Admin worden geaccepteerd.
- Het persona-contract schrijft voor dat de bestaande Test HR Admin alleen Mars heeft en geen Jupiter-toegang. De actieve en aangeboden Jupiter-scope is een bewezen acceptatie-afwijking. Of deze huidige sessie door login, role-switch of daadwerkelijke autorisatietoekenning zo breed is, blijft onopgehelderd.

Na deze afwijking is gestopt vóór iedere Payroll-dataread. Er is geen administratie gewisseld, geen rol gewijzigd en geen databasewrite gedaan.

## Payroll-route, performance en controles

- /payroll/runs niet geopend; perioden, runs, werkplek, filters en foutstates niet gecontroleerd.
- Geen routeperformance gemeten. Er is geen meting waarmee cold compilation en applicatieverwerking afzonderlijk kunnen worden vastgesteld.
- Negatieve rol- en administratie-routecontroles niet uitgevoerd: de vereiste Test HR Admin/Mars-preconditie ontbreekt. Geen verboden-scope Payroll-request verstuurd.
- Browseracceptatie blijft geblokkeerd totdat via de bestaande ondersteunde lokale loginroute een bestaande Test HR Admin met uitsluitend Mars-context is bevestigd. Onderzoek eerst waarom deze sessie Jupiter-selectie en Jupiter-toegang bevat; verruim geen rechten.

## Bewijsgrenzen en integriteit

De eerdere build- en gerichte testresultaten op codekandidaat 82558de1dd1f0439c99866de261b35cbf01b85b6 blijven bewijs uit PAYRUN-ROUTE-01C; ze zijn in deze hervatting niet herhaald. Er is geen productcode gewijzigd. De historische SECURITY HOLD is niet opgeheven.
