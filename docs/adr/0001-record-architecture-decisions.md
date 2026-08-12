# ADR 0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-08-12

## Context

Per `10_DEVELOPER_REVIEW_AND_GIT_WORKFLOW.md`, major architectural choices must
be recorded (context, decision, alternatives, consequences) so the software
consultant/developer can review reasoning, not just code.

## Decision

Use lightweight Architecture Decision Records in `docs/adr/`, one file per
decision, numbered sequentially. Each records context, the decision,
alternatives considered, and consequences.

## Alternatives

- No formal record (rejected: reasoning is lost between reviews).
- A single monolithic decisions doc (rejected: harder to review per-change).

## Consequences

- Reviewers get a durable trail for high-risk areas (auth, RLS, money, FX).
- Small ongoing authoring cost per significant decision.
