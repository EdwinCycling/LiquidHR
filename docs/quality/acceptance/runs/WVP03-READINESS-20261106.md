# WVP03 — re-integratiedossier statusindex

**Status: lokale productcode gebouwd; functionele acceptatie NOT RUN.** Branch `work/wvp03-20261106`, bijgewerkt op `origin/main` `8c580cda`.

## Gebouwd

- De bestaande WVP-casuswerkplek toont per bestaande mijlpaaltaak de status, deadline, rol uit `projectWvpMilestones` en de datum van een aan diezelfde taak gekoppelde `MILESTONE`-gebeurtenis.
- Open taken en voltooide taken zonder gekoppelde mijlpaalgebeurtenis zijn zichtbaar als operationeel aandachtspunt. Custom taken zonder modelrol tonen dat er geen rol is vastgelegd.
- Bestaande werkafspraken en evaluatiedatums blijven zichtbaar in de gebeurtenistijdlijn.
- De documentenlink leidt naar de bestaande medewerkerdocumentenpagina. Die pagina blijft `document:read`, `can_access_employee_dossier` en `listEmployeeDocuments` gebruiken; de WVP-view haalt geen documentmetadata rechtstreeks op.

De WVP-casus blijft via `wvp_list` binnen de bestaande tenant-, HR-groep-, administratie-, team- en eigen-casusscope. De documentenpagina controleert haar eigen medewerker- en documentscope. Er zijn geen rollen, grants, policies, tabellen of migrations toegevoegd. De functionaliteit leest bestaande taken/gebeurtenissen en is niet afhankelijk van de WVP02-START-migratie.

## Grenzen en open werk

- De statusindex is geen wettelijke RIV-compleetheidsbeoordeling; de onderliggende dossieronderdelen en uitzonderingen vereisen gevalideerde requirements.
- Er bestaat geen bestaand veilig contract om een document aan een WVP-casus of mijlpaal te koppelen. Een daadwerkelijke case-documentrelatie vraagt een apart permission-, audit-, RLS- en datacontract. Deze slice toont daarom alleen de bestaande geautoriseerde medewerkerdocumentenroute.
- Er worden geen documenten gegenereerd en geen medische documenten of details in de WVP-view getoond.
- HR Admin-, Manager- en Employee-browseracceptatie, inclusief negatieve cross-team-/administratie-/HR-groep-proeven: **NOT RUN**. Er was geen bestaande LiquidHR HR Suite-tab beschikbaar; volgens de opdracht is geen login- of omgevingsherstelpoging gedaan.

## Checks

- Gericht Vitest-/dossiercontract, TypeScript, ESLint en i18n: **NOT RUN**. De bestaande lokale test-/type-/lintbinaries waren eerder afwezig; er zijn geen installs of nieuwe runtimepogingen gedaan.
- `git diff --check`: PASS op de uiteindelijke staged kandidaat vóór commit.
- Core TEST-read/write, WVP02-migratietoepassing en Vercel-release/deployment: **NOT RUN**.

PR #94 blijft de afzonderlijke, open Draft voor WVP02-SEC01. Voor WVP03 is in deze cyclus geen nieuwe PR aangemaakt.
