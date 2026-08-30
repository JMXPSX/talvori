# Context

Project context for AI coding agents (and humans), adopting JS Mastery's
[context-driven-dev](https://github.com/jsmastery-pro/context-driven-dev) structure. The
premise: agents fail not because they can't code, but because they don't know the project.

**Read these at the start of each session.** All but the progress tracker are stable reference;
the tracker is updated after every session.

| File | Role |
|------|------|
| [project-overview.md](project-overview.md) | Vision, problem, positioning, users, scope, globalization, brand, a11y, status |
| [architecture.md](architecture.md) | Stack, folders, boundaries, data flows, DB, auth, RLS, retail, invariants |
| [build-plan.md](build-plan.md) | Phased roadmap (0–10) + UX overhaul track, with status |
| [code-standards.md](code-standards.md) | Engineering rules, git/commit, review gates, testing |
| [library-docs.md](library-docs.md) | `lib/*` + external dep usage rules (override training knowledge) |
| [ui-tokens.md](ui-tokens.md) | Design tokens (RN-adapted from `components/theme.ts`) |
| [ui-rules.md](ui-rules.md) | UI behavior: layout, nav, cards, buttons, forms, states (RN) |
| [ui-registry.md](ui-registry.md) | Catalog of `components/ui/` primitives |
| [progress-tracker.md](progress-tracker.md) | **Live** status — done / in-progress / next / blocked / decisions |

## Notes

- This structure supersedes the numbered `00_–11_` root specs, which were removed once their
  content was consolidated here. The originals remain recoverable from git history
  (`git log --all --full-history -- '00_*.md'`).
- Each file's `> Absorbs:` header records which legacy specs it consolidated — that is the
  migration map. `09_` and `11_` (one-time Phase-1 build prompt / future-phase prompt
  templates) were scaffolding, not project knowledge, and live in git history only.
- `CLAUDE.md` at the repo root remains the operational instructions for Claude Code; these
  files are the deeper shared context it points into.
## Deep reference (in this folder — not session-start reading)

All remaining project docs were consolidated here too, so `context/` is the single home:

| Path | What it holds |
|------|----------------|
| [design/](design/) | UX-overhaul handoff bundle — audit, mockups, screenshots (indigo ibilly direction) |
| [ORCHESTRATION.md](ORCHESTRATION.md) | Multi-lane terminal orchestration notes |
| [supabase.md](supabase.md) | `supabase/` migrations/RLS guide (formerly `supabase/README.md`) |

The former `adr/` decision records were folded into
[architecture.md](architecture.md) §"Key decisions & rationale" (a dated decision log); add new
decisions there. The former `specs/` and `plans/` per-slice docs were folded into
[build-plan.md](build-plan.md) **Appendix A** (design specs) and **Appendix B** (execution
plans) — anchor forms `#spec-<stem>` / `#plan-<stem>`.

The repo root keeps only `CLAUDE.md` (Claude Code's operational entry) and `README.md` (the
GitHub/developer front door); both point into this folder.
