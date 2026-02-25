import { InputCell } from "./types";

export const ALL_INPUT_CELLS: InputCell[] = [
  "B4", "B6", "B8", "B10", "B12", "B15", "B16", "B17", "B19", "B21", "B23", "B25",
  "B33", "B34", "B35", "B38", "B39", "B40", "B43", "B44", "B45",
  "B50", "B51", "B52", "B55", "B56", "B57", "B60", "B61", "B62",
  "B66", "B67", "B68", "B70", "B71", "B75", "B78", "B79", "B80", "B83", "B84", "B85", "B88", "B89", "B90", "B93", "B94", "B95",
  "B100", "B101", "B102", "B105", "B106", "B107", "B110", "B111", "B112", "B117", "B118", "B119", "B122", "B123", "B124", "B127", "B128", "B129",
  "B134", "B137", "B138", "B139", "B141", "B142", "B143", "B145", "B147", "B149", "B151", "B153", "B155", "B157", "B159", "B161", "B163", "B166", "B167", "B168"
];

export const DEEPER_DIVE_CELLS: InputCell[] = [
  "B33", "B34", "B35", "B38", "B39", "B40", "B43", "B44", "B45",
  "B50", "B51", "B52", "B55", "B56", "B57", "B60", "B61", "B62",
  "B66", "B67", "B68", "B70", "B71", "B75", "B78", "B79", "B80", "B83", "B84", "B85", "B88", "B89", "B90", "B93", "B94", "B95",
  "B100", "B101", "B102", "B105", "B106", "B107", "B110", "B111", "B112", "B117", "B118", "B119", "B122", "B123", "B124", "B127", "B128", "B129"
];

export const FINER_DETAILS_CELLS: InputCell[] = [
  "B134", "B137", "B138", "B139", "B141", "B142", "B143", "B145", "B147", "B149", "B151", "B153", "B155", "B157", "B159", "B161", "B163", "B166", "B167", "B168"
];

// Defaults from Inputs!C for FINER DETAILS when section is unopened.
export const FINER_DETAILS_COL_C_DEFAULTS: Partial<Record<InputCell, number | null>> = {
  B134: 85,
  B137: 0,
  B138: -0.1,
  B139: -0.2,
  B141: null,
  B142: null,
  B143: null,
  B145: 0.025,
  B147: 0.03,
  B149: 0.025,
  B151: 0.08,
  B153: 0.03,
  B155: 0.03,
  B157: 300,
  B159: 20000,
  B161: 0.05,
  B163: 0.15,
  B166: null,
  B167: null,
  B168: null
};

export const VALIDATION_BOUNDS = {
  B4: { min: 18, max: 100 },
  B35: { min: 1, max: 99 },
  B40: { min: 1, max: 99 },
  B45: { min: 1, max: 99 },
  B147: { min: 0, max: 0.5 },
  B166: { min: 0, max: 3 },
  B167: { min: 0, max: 3 },
  B168: { min: 0, max: 3 }
} as const;
