# ETQ Operating Rules

ETQ is a deterministic retirement-planning webapp: plain TypeScript + direct DOM, no framework. The webapp is the source of truth — ignore Excel artifacts and historical parity tooling.

## Defaults

- Make minimal, targeted changes. No broad refactors, new abstractions, or framework migration unless asked.
- `src/main.ts` is intentionally large (~6k lines). Don't propose componentization as incidental cleanup.
- Prefer small diffs, isolated edits, reversible changes. If a change can be done in <30 lines, don't exceed that without justification.
- UI: keep it clean and minimal; clarity over density. UI changes don't touch calculation logic unless the task says so.

## Core invariants — must preserve

- Deterministic model outputs for a given input set.
- Pipeline order: `activation → planned-sale/materialized-order prep → validate → normalize → timing → engine`.
- Pruning of inactive fields before downstream calculation.
- Timing logic, including first-year prorating and month offsets.
- Planned sell years remaining constrained to the active projection window.
- Default liquidation order: cheapest eligible asset first unless user overrides. Liquidation rank `0` = excluded from staged liquidation.

Never introduce hidden sequencing changes or silent behavioural drift.

## High-risk files — extra caution

`src/model/{index,activation,plannedSales,validate,normalization,projectionTiming}.ts`, plus liquidation, planned-sale, timing, and dependency/activation logic. Preserve pipeline order; run full checks before concluding.

## Required checks after code changes

1. `npm run typecheck`
2. `npm run build`
3. `npm test`
4. `npm run test:golden` — when model behaviour changes.

A change isn't complete until these pass. Golden snapshots are the long-term drift detector — only run `npm run test:update-snapshots` after a deliberate logic change, and commit the diff alongside it.

## Prompt interpretation

Prompts are minimal and outcome-focused. Infer the affected layer, choose the safest minimal implementation, don't expand scope. On ambiguity: prioritise safety, minimal impact, and preserving current webapp behaviour. If a change risks core logic or pipeline sequencing, implement the safest minimal version and surface the risk.
