# ETQ Agent Instructions

## Regression Testing Policy
- Run `npm run typecheck`, `npm run build`, and `npm run parity` after every code change.
- Also run `npm run parity:live` at checkpoints:
  - before any commit,
  - after changes affecting model math, timing/order-of-operations, liquidation logic, or input mapping,
  - whenever `specs/excel_prototype/ETQ.xlsx` changes.

