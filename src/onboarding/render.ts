import { QuestionDef } from "./sequence";

export function createCard(q: QuestionDef, progressText: string, onBack?: () => void): HTMLElement {
  const section = document.createElement("section");
  section.className = "ob-card";
  section.setAttribute("data-onboarding-card", q.id);
  section.setAttribute("aria-labelledby", `ob-prompt-${q.id}`);

  if (onBack) {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "ob-back";
    back.setAttribute("aria-label", "Back to previous question");
    back.setAttribute("data-onboarding-back", q.id);
    back.innerHTML = "← <span>back</span>";
    back.addEventListener("click", onBack);
    section.appendChild(back);
  }

  const eyebrow = document.createElement("p");
  eyebrow.className = "ob-eyebrow";
  eyebrow.textContent = progressText;
  section.appendChild(eyebrow);

  const prompt = document.createElement("h2");
  prompt.className = "ob-prompt";
  prompt.id = `ob-prompt-${q.id}`;
  prompt.textContent = q.prompt;
  section.appendChild(prompt);

  if (q.helper) {
    const helper = document.createElement("p");
    helper.className = "ob-helper";
    helper.textContent = q.helper;
    section.appendChild(helper);
  }

  return section;
}

export function createChip(q: QuestionDef, formatted: string, assumptionText?: string): HTMLElement {
  const chip = document.createElement("div");
  chip.className = "ob-chip";
  chip.setAttribute("data-onboarding-chip", q.id);
  chip.setAttribute("role", "button");
  chip.setAttribute("tabindex", "0");

  const label = document.createElement("span");
  label.className = "ob-chip-label";
  label.textContent = `${q.chapterTitle} · ${shortLabel(q)}`;
  chip.appendChild(label);

  const valueWrap = document.createElement("span");
  valueWrap.className = "ob-chip-value";
  valueWrap.textContent = formatted;
  if (assumptionText) {
    const assum = document.createElement("span");
    assum.className = "ob-chip-assumption";
    assum.textContent = assumptionText;
    valueWrap.appendChild(assum);
  }
  chip.appendChild(valueWrap);

  const edit = document.createElement("span");
  edit.className = "ob-chip-edit";
  edit.textContent = "✎ edit";
  chip.appendChild(edit);

  return chip;
}

export function createChapterDivider(title: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "ob-chapter-divider";
  el.textContent = title;
  return el;
}

function shortLabel(q: QuestionDef): string {
  if (q.id === "age") return "your age";
  if (q.id === "partnerInclude") return "partner";
  if (q.id === "partnerAge") return "partner's age";
  if (q.id === "partnerRetiresEarly") return "retire early together";
  if (q.id === "userIncome") return "your take-home";
  if (q.id === "partnerIncome") return "partner's take-home";
  if (q.id === "livingExpenses") return "annual spending";
  if (q.id === "spendingTaper") return "spending by age";
  if (q.id === "housingStatus") return "home status";
  if (q.id === "homeValue") return "home value";
  if (q.id === "propertyGrowth" || q.id === "propertyGrowthRenter") return "property growth";
  if (q.id === "hasMortgage") return "mortgage on it";
  if (q.id === "mortgageBalance") return "mortgage balance";
  if (q.id === "mortgageRate") return "mortgage rate";
  if (q.id === "mortgageRepayment") return "monthly repayment";
  if (q.id === "rent") return "monthly rent";
  if (q.id === "downsizeGate") return "plan to downsize";
  if (q.id === "downsizeYear") return "downsize year";
  if (q.id === "downsizeMode") return "buy or rent next";
  if (q.id === "downsizeCost") return "new home cost";
  if (q.id === "downsizeRent") return "new annual rent";
  if (q.id === "cash") return "liquid savings";
  if (q.id === "equities") return "stock-market investments";
  if (q.id === "equityReturn") return "equity return";
  if (q.id === "equityContrib") return "monthly contribution";
  if (q.id === "rentalGrowth") return "rental growth";
  if (q.id === "propertiesGate") return "investment properties";
  if (q.id === "assetsGate") return "other valuables";
  if (q.id === "dependentsGate") return "supported people";
  if (q.id === "statutoryAge") return "statutory pension age";
  if (q.id === "statePension") return "your state pension";
  if (q.id === "partnerPension") return "partner's state pension";
  if (q.id === "debtsGate") return "other debts";
  if (q.id === "debtBalance") return "debt balance";
  if (q.id === "debtRate") return "debt rate";
  if (q.id === "debtRepayment") return "monthly repayment";
  if (q.id.startsWith("property")) {
    if (q.id.endsWith("Gate")) return "add another?";
    if (q.id.endsWith("Name")) return "property name";
    if (q.id.endsWith("Value")) return "value";
    if (q.id.endsWith("LoanRate")) return "loan rate";
    if (q.id.endsWith("LoanRepayment")) return "monthly repayment";
    if (q.id.endsWith("Loan")) return "loan balance";
    if (q.id.endsWith("Rent")) return "gross annual rent";
    if (q.id.endsWith("Cost")) return "annual cost";
  }
  if (q.id.startsWith("asset")) {
    if (q.id.endsWith("Gate")) return "add another?";
    if (q.id.endsWith("Name")) return "name";
    if (q.id.endsWith("Value")) return "value";
    if (q.id.endsWith("Growth")) return "growth";
    if (q.id.endsWith("LoanRate")) return "loan rate";
    if (q.id.endsWith("LoanRepayment")) return "monthly repayment";
    if (q.id.endsWith("Loan")) return "debt against it";
    if (q.id.endsWith("Cost")) return "annual cost";
  }
  if (q.id.startsWith("dependent")) {
    if (q.id.endsWith("Gate")) return "anyone else?";
    if (q.id.endsWith("Name")) return "dependent name";
    if (q.id.endsWith("Cost")) return "annual cost";
    if (q.id.endsWith("Years")) return "years of support";
  }
  return q.id;
}

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `€${Math.round(n).toLocaleString("en-IE")}`;
}

export function formatPercent(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}
