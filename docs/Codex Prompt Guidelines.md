# Codex Prompt Guidelines (ETQ)

## Purpose

Guide ChatGPT in generating high-quality Codex prompts.

Do not duplicate `AGENTS.md`.

## Input Interpretation

By default, treat all user input as a request to generate an optimised Codex prompt.

Exception:
Text enclosed in `< >` markers is instruction to ChatGPT only and must not be included in the generated prompt.

## Role Split

`AGENTS.md` handles:
- git workflow
- testing
- parity enforcement
- implementation discipline

This file handles:
- prompt clarity
- structure
- scoping
- reasoning level selection

## Core Principles

Prompts must be:
- minimal
- precise
- outcome-focused
- unambiguous

Avoid:
- repeating `AGENTS.md` rules
- unnecessary verbosity

## Scoping Rules

Always define scope explicitly:
- UI rendering
- runtime visibility rules
- validation
- normalization
- field/cell mapping
- financial model math
- parity tooling

If unclear, choose the safest minimal scope.

## Relevant Files to Inspect

When relevant to the task, Codex should inspect:
- `src/main.ts`
- `src/model/index.ts`
- the affected file in `src/model` or `src/ui`
- relevant tests in `specs/runtime` or `specs/ui`

## Explicit File Callouts

If the task touches any of these, mention it explicitly:
- `fieldRegistry.ts`
- `inputSchema.ts`
- `excelAdapter.ts`
- `normalization.ts`
- `validate.ts`
- `runScenario.ts`

## Useful Task Phrases

Use when helpful:
- `this is parity-sensitive`
- `update semantic field ids and keep Excel mapping aligned`
- `change runtime visibility only, not model math`
- `change model math and run full parity checks`

Use sparingly, since they are already enforced globally:
- `preserve Excel parity`
- `plain DOM TypeScript app, not React`

## When to Add Constraints

Only include constraints specific to the task.

Do not include:
- git workflow
- testing instructions
- parity enforcement

## When to Expand Prompt

Add detail only when necessary:
- multi-step behaviour
- interaction design
- edge cases

Otherwise keep it short.

## Good Prompt Example

```text
Task
Fix timeline truncation.

Details
Show only primary event per year.
Add "+N events".
Click expands full list.

Scope
UI rendering only. No model changes.

Reasoning
LOW
```

## Reasoning Level Selection

Every prompt must include:

```text
Reasoning
LOW / MEDIUM / HIGH
```

### LOW

- styling
- text changes
- simple UI tweaks

### MEDIUM

- UI logic
- conditional rendering
- interaction behaviour

### HIGH

- model calculations
- timing / ordering logic
- liquidation logic
- normalization
- Excel mapping
- cross-layer changes

Default to the lowest safe level.

## Prompt Structure

Use clean, copy-paste format.

```text
Task
<what needs to be done>

Details
<specific behaviour>

Scope
<affected layer>

Constraints (only if needed)
<task-specific only>
```

Reasoning level for the user to select, outside the prompt copy/paste pane:

```text
LOW / MEDIUM / HIGH
```

## Bad Prompt Example

```text
Fix timeline truncation.

Preserve Excel parity.
Run tests.
Use git checkpoint.
```

## Default Assumptions

Do not restate:
- Excel parity must be preserved
- tests must pass
- changes must be minimal
- git workflow is required

These are enforced by `AGENTS.md`.

## End
