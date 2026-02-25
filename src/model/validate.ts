import { RawInputs } from "./types";

export interface ValidationIssue {
  cell: string;
  message: string;
}

export function validateRawInputs(raw: RawInputs): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const n = (v: unknown): number | null => {
    if (v === null || v === undefined || String(v).trim() === "") return null;
    const num = Number(v);
    return Number.isFinite(num) ? num : null;
  };

  const b4 = n(raw.B4);
  if (b4 !== null && (b4 < 18 || b4 > 100)) {
    issues.push({ cell: "B4", message: "Your age must be between 18 and 100." });
  }

  for (const cell of ["B35", "B40", "B45"] as const) {
    const v = n(raw[cell]);
    if (v !== null && (v < 1 || v > 99 || !Number.isInteger(v))) {
      issues.push({ cell, message: "Years to support must be a whole number between 1 and 99." });
    }
  }

  const b147 = n(raw.B147);
  if (b147 !== null && (b147 < 0 || b147 > 0.5)) {
    issues.push({ cell: "B147", message: "Property annual appreciation must be between 0 and 0.5." });
  }

  for (const cell of ["B166", "B167", "B168"] as const) {
    const v = n(raw[cell]);
    if (v !== null && (v < 0 || v > 3 || !Number.isInteger(v))) {
      issues.push({ cell, message: "Property liquidation order must be an integer between 0 and 3." });
    }
  }
  const ranks = (["B166", "B167", "B168"] as const)
    .map((cell) => ({ cell, value: n(raw[cell]) }))
    .filter((x) => x.value !== null && Number.isInteger(x.value) && (x.value as number) > 0) as Array<{ cell: "B166" | "B167" | "B168"; value: number }>;
  for (let i = 0; i < ranks.length; i += 1) {
    for (let j = i + 1; j < ranks.length; j += 1) {
      if (ranks[i].value === ranks[j].value) {
        issues.push({
          cell: ranks[j].cell,
          message: "Property liquidation order ranks 1-3 must be unique (0 can repeat for never sell)."
        });
      }
    }
  }

  const b134 = n(raw.B134);
  if (b4 !== null && b134 !== null) {
    if (!(b134 > b4 && b134 <= 100)) {
      issues.push({ cell: "B134", message: "Plan to live until age must be greater than current age and at most 100." });
    }
  }

  return issues;
}
