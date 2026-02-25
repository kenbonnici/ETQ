import { EffectiveInputs, ScenarioOutputs } from "../types";
import { runScenario } from "./runScenario";

export function runScenarioEarly(inputs: EffectiveInputs, earlyRetirementAge: number): ScenarioOutputs {
  return runScenario(inputs, { retirementAge: earlyRetirementAge });
}
