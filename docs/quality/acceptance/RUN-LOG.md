# Acceptance Run Log

This log contains only known historical outcomes. Detailed screenshots, traces and probes remain under the corresponding `.artifacts` directory and are not moved into the durable Acceptance Library.

| Run | Result | Proven scope | Open boundary |
|---|---|---|---|
| A01 | GREEN | Full DEV persona acceptance for Focus, Absence and Leave | Regression maintenance |
| GJ01 | PARTIAL / EXTERNAL_BLOCKER | HR journey, preview, restrictions and responsive checks | Authenticated future Employee leg; DEV Auth mail delivery returned HTTP 502 |
| GJ02 | GREEN | Canonical batch → snapshot → dossier → signing → SIGNED lifecycle | DOC02 rendering follow-up |
| GJ03 | GREEN | Employee Actual Work create/edit through canonical service/RPC/RLS | AW02 rules/concurrency follow-up |
| T01-20260922-193129 | GREEN | DEV Survey, Team Compass personality and 9-grid lifecycle, persistence, scoring, privacy, negative and responsive checks; local quality gates green; T01 branch pushed and remote SHA verified | No follow-up acceptance run; retain DEV evidence and fixed-defect records |
| T01/F01/F03/S01/T02/R01/P01/F04/F05/I01 | READY | Specification prepared; not executed by this library pass | Future isolated acceptance runs |
| F02 | GREEN | DEV navigation, Focus, Settings, help, onboarding, persistence, negative and responsive acceptance; three in-scope fixes; contextual `Niet meer tonen` hide and Settings re-enable proven; final remote head is recorded in the acceptance response | None for the exercised F02 scope; preboarding and separate out-of-scope Manager personas remain environment-gated |
| GJ01R | WAITING_FOR_DEV_MAIL | Follow-up scope specified; not executed here | DEV mail dependency |
| DOC02/AW02 | READY | Follow-up scope specified; not executed here | Dedicated fixture gate |

## Historical commit anchors

- GJ01: `a4e0af5` — onboarding acceptance
- GJ02: `4d0bfdd` — documents/signing acceptance
- GJ03: `65f8abe` — Employee Actual Work acceptance
- Overnight closure: `7f915ea` — final reports and metadata guard

No historical SHA or completed result is changed by this entry. F02 made only the explicitly authorized DEV Setup Assistant state checks; it made no Supabase schema change, Production action or unrelated business mutation.
