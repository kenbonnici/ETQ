import { RawInputs, ModelUiState } from "./types";

export interface ActivationResult {
  activatedInputs: RawInputs;
  canCollapseDeeperDive: boolean;
  canCollapseFinerDetails: boolean;
}

export function applySectionActivation(raw: RawInputs, uiState: ModelUiState): ActivationResult {
  void uiState;
  const activatedInputs: RawInputs = { ...raw };

  return {
    activatedInputs,
    canCollapseDeeperDive: true,
    canCollapseFinerDetails: true
  };
}
