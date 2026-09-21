# Acceptance Reporting Standard

Every run report uses the following sections, including partial, blocked and environment-gated runs. Reports must distinguish proven behavior, unproven behavior, fixture drift, harness friction and external dependencies. Never include secrets, tokens, passwords or absolute machine paths.

## Required report sections

1. Executive Summary
2. Coverage
3. Role Matrix
4. Functional Results
5. Negative/Security Results
6. Mobile/Responsive Results
7. Data/DB Readback
8. Quality Gates
9. Fixed During Run
10. Environment-Gated
11. Product Decisions
12. Not Fixed
13. Lessons/Patterns
14. Commits/Remote Head
15. Final Verdict

## Summary table

Use exactly these columns:

| ID | Area | What broke | Why | Fix | Regression | Result |
|---|---|---|---|---|---|---|
| `<id>` | `<module/route>` | `<symptom>` | `<root cause>` | `<change>` | `<test/readback>` | `<GREEN/PARTIAL/BLOCKED>` |

## Fixed-issue record

For every fixed issue, require all fields below:

- ID;
- module/route;
- persona;
- symptom;
- classification;
- technical root cause;
- why previous tests missed it;
- what changed;
- how it was fixed;
- files/migrations;
- whether DEV data/configuration changed;
- regression test;
- retest result;
- downstream areas rechecked;
- security/privacy impact;
- intended behavior restoration versus genuinely new product behavior;
- commit SHA;
- prevention lesson.

## Classification sections

The report must contain explicit sections titled `ENVIRONMENT-GATED`, `PRODUCT DECISIONS`, `NOT FIXED` and `LESSONS/PATTERNS`. Environment-gated behavior is not silently converted into a product failure. Product decisions are not silently implemented as permissions. Not-fixed items name their evidence boundary and recommended next action.

## Verdict rules

`GREEN` means every in-scope positive, negative, persistence, responsive and quality gate passed. `PARTIAL` means useful scope passed but a required assertion remains unproven. `BLOCKED` is reserved for a stop condition that prevents safe continuation. A report must never claim a browser or database result that was not actually observed.
