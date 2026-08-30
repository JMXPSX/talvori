# Working with two agents on one codebase

Claude Terminal writes the code. Claude Desktop looks at the result and says what's wrong.
Both work on the **same** checkout at `C:/dev/Budget App`.

**Read this before starting a session in either surface.**

## Why one tree, not two

Separate git worktrees are for running genuinely independent features in parallel. That is
not this setup. A reviewer cannot visually check work that lives in a directory it isn't
looking at — the whole loop depends on both agents sharing one tree, so that a file Terminal
saves appears in the preview Desktop is watching.

The rule that keeps a shared tree safe is not separation. It is: **exactly one writer.**

## Roles

| | Claude Terminal | Claude Desktop |
|---|---|---|
| **Writes files** | Yes — the only writer | **Never** |
| **Runs the dev server** | No | Yes, on port 8090 |
| **Runs typecheck / test / lint** | Yes | No |
| **Commits** | Yes | No |
| **Judges visual fidelity** | No — it cannot see the render | Yes, against `stitch_universal_budget_tracker/` |

Terminal cannot see a rendered screen; Desktop can. Desktop should not edit, because a
second writer reintroduces exactly the clobbering that a single-writer rule prevents.

## The loop

1. **Terminal** implements one step from the active spec (in `build-plan.md` Appendix A), runs
   `npm run typecheck` and `npm test`, and commits.
2. **Desktop** has the preview already running. Metro's HMR pushes the change in; no restart
   needed. Desktop compares the render against the relevant mock.
3. **Desktop reports defects as file plus problem** — "the app bar's action sits too close to
   the edge, `components/ui/AppBar.tsx`" — not as a patch.
4. **Terminal** fixes and commits. Back to 2.

Desktop reviewing a specific commit rather than the live tree is often clearer:
`git show <sha>` for the diff, then the preview for the result.

## Starting each surface

**Terminal** — already in the right place:

```bash
cd "C:/dev/Budget App"
```

**Desktop** — start the dev server through its launch config, never a bare `expo start`, so
the port stays predictable:

```bash
npx expo start --web --port 8090
```

Port `8081` is reserved for the human's own `npm start`. Two servers on one port is the most
common way this setup breaks.

## Handoff between sessions

- **Specs** (in `build-plan.md` Appendix A) are the durable contract. A lane that deviates
  updates the spec in the same commit, so the other surface never reads a stale plan.
- **`claude-mem`** carries observations across surfaces and sessions — this is how a Desktop
  session knows what Terminal did earlier.
- **Git history** is the audit trail. Atomic commits with conventional prefixes mean Desktop
  can review one change at a time instead of a pile.

## Single-writer files

These tolerate exactly one writer even within Terminal. If work is ever split across more
than one implementing session, only one may touch them:

| File / process | Why |
|---|---|
| `supabase/migrations/*.sql` | Applied by hand in the Supabase SQL editor, one at a time. Timestamp-ordered filenames collide if authored simultaneously. |
| `lib/database.types.ts` | Hand-maintained mirror of the schema. Two writers guarantee drift. |
| `locales/{en,fil,ar}.json` | `tests/lib/i18n.test.ts` enforces identical key sets across all three. Concurrent additions conflict every time. |
| `components/theme.ts` | Every screen and primitive reads it. A token change makes other in-flight visual work stale. |
| `components/ui/index.ts` | The barrel — every new primitive touches it. |
| `npm run test:rls` | Needs `SUPABASE_SERVICE_ROLE_KEY` in `.env` temporarily, then removed. One holder at a time. |
| The Supabase project | One project, shared. Two agents seeding demo data clobber each other — see `supabase/seed/demo_data.sql`. |

## Demo data

`supabase/seed/demo_data.sql` creates a throwaway `Demo Household` with ~90 days of
multi-currency activity, so screens have something real to render. Paste it into the Supabase
SQL editor. It is re-runnable and its teardown is one `delete` documented in the file header.

## When you *would* want worktrees

If two genuinely independent features are in flight — say the ibilly design work and the
`wip/household-management` branch, which touch disjoint files — then a worktree per feature
is correct, each with its own branch, its own `npm install`, a copy of the gitignored `.env`,
and its own Metro port. That is a different setup from the one described above, and it is not
what this project is doing today.
