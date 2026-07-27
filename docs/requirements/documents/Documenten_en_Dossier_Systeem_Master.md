# Functionele specificatie: Documenten, mappen en dossier

Dit document is de leidende vertaling van `C:\Users\Edwin\Downloads\documenten.md` naar LiquidHR. De drie documentstromen blijven bewust gescheiden:

1. het medewerkersdossier met platte mappen;
2. bedrijfsdocumenten zonder mappen;
3. loonstroken met een eigen autorisatiemodel en eigen tab.

## 1. Medewerkersdossier

Het dossier is beschikbaar op de medewerkerkaart onder **Documenten**. Documenten zijn gekoppeld aan één medewerker en één platte documentcategorie. HR-beheer maakt, hernoemt, activeert en deactiveert categorieën via **Stamtabellen**. Een categorie mag alleen definitief worden verwijderd wanneer er binnen de volledige tenant geen document meer aan gekoppeld is. De server controleert dit expliciet en de UI toont bij blokkade dat de categorie eerst bij alle medewerkers moet worden leeggemaakt.

De dossierweergave toont categorie, titel, bestandsnaam, uploadmoment en bestandsgrootte, met signed downloads en een inline viewer voor PDF, tekst, CSV en afbeeldingen. Office-bestanden krijgen een veilige downloadfallback wanneer een inline viewer geen betrouwbaar resultaat kan leveren. De bestaande documentmetadata ondersteunt titel, omschrijving, tags, categorie, zichtbaarheid, vervaldatum en reminders; uitbreiding met generieke vrije velden blijft aansluiten op het bestaande custom-fieldsmodel.

Het medewerkersdashboard toont de meest recente dossierdocumenten zonder voorbeelddata. De documenttabel en opslag zijn tenant- en administratiegebonden; documenten worden niet tussen parallelle dienstverbanden samengevoegd.

## 2. Bedrijfsdocumenten

Bedrijfsdocumenten vormen één platte, tenantbrede lijst. Iedere ingelogde gebruiker mag beschikbare documenten bekijken en downloaden. Alleen gebruikers met `company-document:write` mogen uploaden; verwijderen vereist `company-document:delete`. De opslag is private, metadata bevat minimaal titel, oorspronkelijke bestandsnaam, MIME-type, grootte, checksum, uploader en timestamps, en verwijdering is soft-delete.

De lijst is bereikbaar via de instellingenhub voor HR-beheer en via `/company-documents`. De dashboardcatalogus bevat de widget **Bedrijfsdocumenten**, die naar deze lijst linkt. De widget toont alleen echte gegevens; een lege tenant blijft leeg.

## 3. Loonstroken

Loonstroken zijn geen dossierdocumenten en hebben een eigen tab **Loonstroken** op de medewerkerkaart. Ze zijn gekoppeld aan zowel medewerker als dienstverband en worden op loonperiode/kalenderjaar gesorteerd. De database ondersteunt de bronnen `NMBRS`, `LOKET` en `MANUAL_IMPORT`; import- en bulkverwerking volgen in een latere integratieslice.

Een medewerker mag uitsluitend de eigen loonstroken lezen. HR-admins mogen alle loonstroken binnen hun toegestane administratie lezen en beheren. Managers hebben standaard geen toegang; een expliciete `payslip:read`-toekenning kan dit later autorisatiegestuurd mogelijk maken. Deze regels worden zowel server-side als met RLS/storage policies afgedwongen.

## 4. Bestand, viewer en beveiliging

Medewerkers- en bedrijfsdocumenten hebben een maximum van 25 MB. Loonstroken zijn uitsluitend PDF en maximaal 10 MB. Toegestane dossier-/bedrijfsformaten zijn PDF, TXT, MD, CSV, DOC, DOCX, XLS, XLSX, JPG/JPEG, PNG, WEBP en BMP. Preview gebruikt korte signed URLs; opslagbuckets zijn private. Onbekende of niet betrouwbaar inline te tonen formaten krijgen een downloadfallback.

Alle reads en downloads lopen via tenant-, administratie-, medewerker- en permission-scopes. Checksums worden bij upload berekend. Testdata mag zonder migratiecompatibiliteitsbehoud worden verwijderd wanneer dat nodig is voor dit model; productie-import of deployment valt buiten deze slice.

## 5. Implementatiestatus van deze slice

- Medewerkersdossier: bestaand fundament behouden en uitgebreid met viewer, expliciete categorie-verwijderguardrail en recente documentpresentatie.
- Bedrijfsdocumenten: schema, private storage, RLS, HR-beheer, lijst, viewer, downloads en dashboardwidget toegevoegd.
- Loonstroken: schema, private storage, RLS, eigen medewerkerkaart-tab en veilige downloads toegevoegd; bulkimport en Nmbrs/Loket-koppelingen zijn nog niet gebouwd.
- AI/OCR/RAG en ESS: bewust buiten scope; hiervoor wordt geen fake data of schijnfunctionaliteit toegevoegd.
