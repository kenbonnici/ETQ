import { runModel } from "../../../src/model";
import { ModelOutputs, ModelUiState, ScenarioMilestoneHint } from "../../../src/model/types";
import type { GoldenPersona } from "./fixtures";

export const GOLDEN_REFERENCE_DATE_ISO = "2026-01-01T00:00:00Z";
export const GOLDEN_REFERENCE_YEAR = 2026;
const CENT_PRECISION = 100;

export interface GoldenMilestoneSnapshot {
  year: number;
  age: number;
  label: string;
  amount?: number;
}

export interface GoldenScenarioSnapshot {
  retirementSuccessful: boolean;
  cashSeries: number[];
  netWorthSeries: number[];
  milestoneHints: GoldenMilestoneSnapshot[];
}

export interface GoldenPersonaSnapshot {
  scenarioNorm: GoldenScenarioSnapshot;
  scenarioEarly: GoldenScenarioSnapshot;
}

export type GoldenSnapshotRecord = Record<string, GoldenPersonaSnapshot>;

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * CENT_PRECISION) / CENT_PRECISION;
}

function serializeMilestoneHint(hint: ScenarioMilestoneHint): GoldenMilestoneSnapshot {
  return hint.amount === undefined
    ? {
        year: hint.year,
        age: hint.age,
        label: hint.label
      }
    : {
        year: hint.year,
        age: hint.age,
        label: hint.label,
        amount: roundMoney(hint.amount)
      };
}

function serializeScenarioSnapshot(
  scenario: ModelOutputs["scenarioNorm"] | ModelOutputs["scenarioEarly"]
): GoldenScenarioSnapshot {
  return {
    retirementSuccessful: scenario.retirementSuccessful,
    cashSeries: scenario.cashSeries.map(roundMoney),
    netWorthSeries: scenario.netWorthSeries.map(roundMoney),
    milestoneHints: scenario.milestoneHints.map(serializeMilestoneHint)
  };
}

export function withFixedNow<T>(fn: () => T, fixedDateIso = GOLDEN_REFERENCE_DATE_ISO): T {
  const RealDate = globalThis.Date;
  const fixedTime = new RealDate(fixedDateIso).getTime();

  class FixedDate extends RealDate {
    constructor(value?: ConstructorParameters<typeof Date>[0]) {
      super(value ?? fixedTime);
    }

    static now(): number {
      return fixedTime;
    }
  }

  Object.defineProperty(FixedDate, "parse", { value: RealDate.parse });
  Object.defineProperty(FixedDate, "UTC", { value: RealDate.UTC });
  globalThis.Date = FixedDate as DateConstructor;

  try {
    return fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

export function runGoldenPersona(persona: GoldenPersona) {
  return withFixedNow(() => runModel(persona.fields, persona.uiState));
}

export function createGoldenPersonaSnapshot(persona: GoldenPersona): GoldenPersonaSnapshot {
  const result = runGoldenPersona(persona);
  return {
    scenarioNorm: serializeScenarioSnapshot(result.outputs.scenarioNorm),
    scenarioEarly: serializeScenarioSnapshot(result.outputs.scenarioEarly)
  };
}

export function cloneUiState(uiState: ModelUiState): ModelUiState {
  return { ...uiState };
}
