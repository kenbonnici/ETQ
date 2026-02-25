import { EffectiveInputs, ScenarioOutputs } from "../types";
import { runScenario } from "./runScenario";

export function runScenarioNorm(inputs: EffectiveInputs): ScenarioOutputs {
  return runScenario(inputs, { retirementAge: inputs.statutoryRetirementAge });
}
