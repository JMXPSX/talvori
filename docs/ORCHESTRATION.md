# Multi-agent orchestration

How work is split across Claude Desktop, Claude Terminal, and worktree lanes on this
project. **Read this before starting parallel work.** It exists because this codebase has
several files that cannot tolerate concurrent writers, and rediscovering that list by
hitting merge conflicts is expensive.

## Surface roles

| Surface | Owns | Should not |
|---|---|---|
| **Claude Desktop** | Visual verification against the Stitch mocks, browser preview, Supabase inspection, spec and design review, reading diffs | Write implementation code |
| **Claude Terminal** | Implementation, `typecheck` / `test` / `lint`, atomic commits, migrations authoring | Judge visual fidelity — it cannot see the render |

The split follows capability, not preference. Desktop has the browser and the connectors;
Terminal has fast file editing and git. When Desktop finds a visual defect, it reports the
defect and the file; Terminal fixes it.

## Lanes

One worktree per lane. **Never point two agents at the same working tree** — concurrent
edits silently clobber each other and leave git in a state neither agent can explain.

| Lane | Path | Branch | Web port |
|---|---|---|---|
| main | `C:/dev/Budget App` | `design/ibilly-adoption` | 8090 |
| slice E (ibilly mock fidelity) | `C:/dev/budget-slice-e` | `design/ibilly-slice-e` | 8100 |
| household management | `C:/dev/budget-household` | `wip/household-management` | 8110 |

Port `8081` stays reserved for the human's own `npm start`. Launch configs for every lane
live in `.claude/launch.json`; start one with the lane's config name, never a bare
`expo start`, or two lanes will fight over a port.

### Creating another lane

```bash
git worktree add C:/dev/budget-<name> -b <branch> design/ibilly-adoption
cp ".env" "C:/dev/budget-<name>/.env"        # .env is gitignored — nothing boots without it
cd C:/dev/budget-<name> && npm install       # node_modules cannot be shared across worktrees
```

Then add a `.claude/launch.json` entry with an unused port and record the lane in the table
above.

### Retiring a lane

```bash
git worktree remove C:/dev/budget-<name>
```

Merge or delete the branch first — `worktree remove` refuses if the tree is dirty, which is
the desired behaviour.

## Chokepoints — do not parallelize these

Each of these has exactly one safe writer at a time. Assign them to a single lane and let
the other lanes wait.

| File / process | Why it serializes |
|---|---|
| `supabase/migrations/*.sql` | Applied by hand in the Supabase SQL editor, one at a time. Timestamp-ordered filenames collide if two agents author simultaneously. |
| `lib/database.types.ts` | Hand-maintained mirror of the schema. Two writers guarantee drift. |
| `locales/{en,fil,ar}.json` | `tests/lib/i18n.test.ts` enforces identical key sets across all three. Concurrent key additions produce a three-way conflict every time. |
| `components/theme.ts` | Every screen and primitive reads it. A token change in one lane makes every other lane's visual work stale. |
| `components/ui/index.ts` | The barrel. Every new primitive touches it — the highest-conflict file in the repo. |
| `npm run test:rls` | Needs `SUPABASE_SERVICE_ROLE_KEY` in `.env` temporarily. Exactly one lane may hold it, and it must be removed afterwards. |
| The Supabase project | One project serves all lanes. Two agents seeding demo data clobber each other — see `supabase/seed/demo_data.sql`. |

## What does parallelize

- Screens in different `app/<domain>/` stacks — they share no files
- Pure modules under `features/*/` plus their tests (the `donut.ts` / `flow.ts` shape)
- Specs and docs
- Read-only review and audit passes

## Merge order

Derived from the chokepoint list: whichever lane touches a chokepoint merges **first**, and
the others rebase onto it rather than merging in parallel.

For the current pair: slice E touches `components/theme.ts`, `components/ui/index.ts`, and
`locales/*`. The household lane touches `app/household/` and `features/household/`. They are
genuinely independent, but `wip/household-management` branched from `main` and does **not**
contain the design work — rebase it onto the design branch before merging, or its screens
will arrive with pre-ibilly styling.

## Slice E dependency shape

Slice E is mostly a chain, not a fan. From
`docs/superpowers/specs/2026-08-16-ibilly-mock-fidelity-design.md`:

```
1 refactor(ui): Screen gains appBar + scroll; migrate 3 screens   <- blocks everything
        |-- 3 MetricRow + InsightCard          -+
        |-- 4 flow.ts + tests                   |- independent of each other
        |-- 5 SegmentedControl + FlowBar       -+
                                                -> 6 adopt into the 5 screens  <- joins all
                                                -> 7 docs
```

Steps 3 and 5 both touch `components/ui/index.ts`. Either accept one trivial conflict at the
join, or have step 5 skip the barrel and let step 3 add both exports. Do not fan out steps 1
or 6 — they are single-writer by nature.

## Shared context

`claude-mem` is the cross-surface memory: observations written from Terminal are visible to
Desktop and vice versa, which is how a Desktop session knows what Terminal did earlier.
Specs under `docs/superpowers/specs/` are the durable contract between lanes — when a lane
deviates from its spec, it updates the spec in the same commit rather than leaving the other
lanes reading a stale plan.
