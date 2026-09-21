# Acceptance Reporting Standard

Every run reports the sections below, including partial and blocked runs. Use redacted IDs and never include secrets, tokens, passwords or absolute machine paths.

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

| Run ID | Scope | Mode | Result | Classification | Evidence boundary | Commit | Remote head |
|---|---|---|---|---|---|---|---|
| `<id>` | `<journey>` | `<mode>` | `<GREEN/PARTIAL/BLOCKED>` | `<classification>` | `<what is proven>` | `<sha>` | `<sha>` |

For each fix record ID, module/route, persona, symptom, classification, root cause, why missed, what/how, files/migrations, DEV configuration, regression, retest, downstream, security impact, intended/new behavior, commit SHA and prevention lesson. GREEN means all in-scope gates passed; PARTIAL means a required leg is unproven; BLOCKED is reserved for a harness stop condition.
