# LiquidHR AI Improve V1 — Employee Notes

## Scope

AI Improve V1 is the first product capability on the existing AI Foundation. It offers proposal-only text transformation for the Employee detail Notes/Notities description field. The note title and all other employee data remain out of scope.

The capability uses the existing `improve-existing-hr-text` registry entry, server runtime, target permission model, Liquid Credits, provider safety/FUP, structured proposal validation, usage and audit sinks. No parallel AI implementation or database migration is required.

## Contract

The server accepts only `sourceText` (1–4,000 trimmed characters), one of `improve_writing`, `shorten` or `professionalize`, and the requested `nl`/`en` locale. The employee id is used only for `employee-note:write` target authorization and internal invocation scope; it is not sent in provider model input.

The provider receives only the source text, transformation and locale. The output remains the canonical structured human-review proposal. Meaning and existing facts must be preserved; the model must not invent employee facts, names, details, HR judgments or recommendations.

## Authorization and lifecycle

The server checks authentication/context, then `employee-note:write` for the target employee, then `ai:use` and the existing capability/governance gates. The canonical runtime reserves one Efficient Liquid Credit, applies provider safety/FUP, validates the proposal, settles on success and releases on provider or validation failure. Unauthorized requests stop before reservation and provider invocation.

The UI offers the three transformations only when normal note writing and AI capability availability are both true. A proposal is reviewed in a compact surface. Apply changes local form state only; the existing human Save action remains the sole persistence path.
