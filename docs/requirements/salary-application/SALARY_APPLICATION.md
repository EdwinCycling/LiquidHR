# Salaristoepassing

De normatieve productbron voor deze slice is `C:\Users\Edwin\Downloads\SALARY_APPLICATION_PRODUCT_REQUIREMENTS.md`, aangevuld met de UX-instructie in `C:\Users\Edwin\Downloads\SALARY_APPLICATION_CODEX_INSTRUCTION.md` en de meegeleverde bandbreedte-afbeelding.

## Scope

- salarisroutes per administratie: `MANUAL`, `MINIMUM_WAGE`, `SCALE_WITH_STEPS` en `SALARY_BAND`;
- effectief gedateerde route- en structuurverwijzingen op `employment_salaries`;
- minimumloonkeuze `REGULAR`/`BBL` zonder handmatige salarisinvoer;
- decimal-safe bandpositionering, compa-ratio, range penetration en status;
- bandbediening met live koppeling tussen fulltime-equivalent salaris en percentage van het 100%-punt;
- hergebruik van de bestaande instellingen-, wizard-, mutatie- en Salaris-tab-ingangen.

## Huidige worktree-status

De lokale fundering staat in migratie `20260814115318_salary_application_domain.sql`. De routekeuze is aangesloten op de bestaande employment salary timeline en de nieuwe aanmaak-/mutatie-RPC's. De bandvisualisatie gebruikt de bestaande LiquidHR-shell en tokens en volgt de meegeleverde referentie met minimum, 100%-punt, maximum, actuele marker en metric cards. TypeScript, de gerichte positioneringstests, i18n-pariteit en de Webpack-productiebuild met 224 routes zijn lokaal groen.

Nog open voor de volledige productfase: remote migratie/advisors/typegeneratie, authenticated desktop-/mobiele browsermatrix, volledig CAO-intersectie-filter in alle keuzelijsten, datumgebonden revisieresolutie in alle historische projecties, HR-uitzonderingenlijst en releasebewijs.
