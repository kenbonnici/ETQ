import { formatParityReport, runSpecimenParity } from "./model/parity/index.js";

const report = runSpecimenParity();
console.log(formatParityReport(report));
