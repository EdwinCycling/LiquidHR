# HeRa UI brief

## Doel

Bouw de persoonlijke HeRa-webchat voor Liquid HR. HeRa is een senior HR-businesspartner: warm, rustig, helder en discreet. De interface moet aanvoelen als een veilige werkplek, niet als een generieke chatbot.

## Route en eigenaarschap

- Route: `apps/hr-suite/app/(dashboard)/hera/page.tsx`
- Componenten uitsluitend onder `apps/hr-suite/components/hera/`
- Voeg geen API-routes, databasecode, sidebar of root redirect toe.

## Structuur

- Desktop: compacte persoonlijke conversatierail links; gesprek en composer centraal; optionele context/actiezone zonder de chat te domineren.
- Mobiel: conversatierail bereikbaar via een duidelijke knop/drawer, composer altijd bereikbaar en geen horizontale overflow.
- Voorzie lege toestand, laden, fout en eerste gesprek.
- Een conceptactie wordt een afzonderlijke controlekaart met samenvatting, gevolgen, annuleren en een expliciete bevestigingsknop. Tekst in chat is nooit voldoende om uit te voeren.
- Gespreksacties: nieuw gesprek, hernoemen, exporteren en verwijderen. Memory vraagt altijd apart toestemming.

## Visuele richting

- Gebruik Liquid HR CSS-variabelen en bestaande Tailwind-patronen; geen hardcoded kleuren en geen nieuwe iconen als SVG.
- Verfijnd liquid-glass met ingetogen gloed, veel ademruimte en duidelijke hiërarchie. Geen paars-op-wit AI-dashboard, geen overdadige gradients, geen marketingcopy.
- Nederlandse UI-tekst via de later door hoofdagent toegevoegde `hera`-namespace: geef de component daarom vertaalstrings als props of werk met tijdelijke neutrale props, geen locale objecten in componenten.

## Technische randvoorwaarden

- Strict TypeScript; geen `any`, geen React Query/SWR.
- Clientcomponent mag alleen API-routes aanroepen; serverpagina bereidt de shell voor.
- Gebruik toegankelijke labels, focusstates en knoppen.
- Ontwerp rond daadwerkelijke endpoints: `GET/POST /api/hera/conversations`, `GET/PATCH/DELETE /api/hera/conversations/:id`, `POST /api/hera/conversations/:id/messages`, export en conceptbevestiging.
