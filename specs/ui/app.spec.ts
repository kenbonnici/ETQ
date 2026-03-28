import { expect, test, type Page } from "@playwright/test";
import { EXCEL_BASELINE_SPECIMEN } from "../../src/model/parity/excelBaselineSpecimen";

const selectors = {
  currentAge: 'input[data-field-id="profile.currentAge"]',
  earlyRetAge: "#early-ret-age",
  currencySelector: "#currency-selector",
  livingExpenses: 'input[data-field-id="spending.livingExpenses.annual"]',
  livingExpensesExpandedMode: '[data-living-expenses-mode="expanded"]',
  livingExpensesDerivedTotal: 'input[data-living-expenses-derived-total]',
  livingExpensesGroceries: 'input[data-living-expense-category="groceries"]',
  livingExpensesUtilities: 'input[data-living-expense-category="utilities"]',
  livingExpensesMiscellaneous: 'input[data-living-expense-category="miscellaneous"]',
  homeValue: 'input[data-field-id="housing.01Residence.marketValue"]',
  housingRent: 'input[data-field-id="housing.rentAnnual"]',
  mortgageBalance: 'input[data-field-id="housing.01Residence.mortgage.balance"]',
  mortgageInterest: 'input[data-field-id="housing.01Residence.mortgage.interestRateAnnual"]',
  mortgageRepayment: 'input[data-field-id="housing.01Residence.mortgage.monthlyRepayment"]',
  propertyName: 'input[data-field-id="properties.01.displayName"]',
  property2Name: 'input[data-field-id="properties.02.displayName"]',
  property3Name: 'input[data-field-id="properties.03.displayName"]',
  property4Name: 'input[data-field-id="properties.04.displayName"]',
  property5Name: 'input[data-field-id="properties.05.displayName"]',
  propertyAnnualCost: 'input[data-field-id="properties.01.annualOperatingCost"]',
  dependentName: 'input[data-field-id="dependents.01.displayName"]',
  dependent2Name: 'input[data-field-id="dependents.02.displayName"]',
  dependent3Name: 'input[data-field-id="dependents.03.displayName"]',
  dependent4Name: 'input[data-field-id="dependents.04.displayName"]',
  dependent5Name: 'input[data-field-id="dependents.05.displayName"]',
  dependentAnnualCost: 'input[data-field-id="dependents.01.annualCost"]',
  cashChart: "#cash-chart",
  networthChart: "#nw-chart",
  cashflowScroll: "#cashflow-table-panel .cashflow-table-scroll",
  networthScroll: "#networth-table-panel .cashflow-table-scroll"
} as const;

async function loadSampleData(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();
  await expect(page.locator(selectors.currentAge)).toHaveValue(/\d+/);
  await expect(page.getByRole("button", { name: "Enough to quit?" })).toBeEnabled();
  await expect(page.locator(".timeline-milestone").first()).toBeVisible();
}

async function fillAndBlur(page: Page, selector: string, value: string): Promise<void> {
  const input = page.locator(selector);
  await input.fill(value);
  await input.blur();
}

async function expectActiveElement(page: Page, selector: string): Promise<void> {
  await expect.poll(async () => {
    return page.evaluate((targetSelector) => (
      document.activeElement === document.querySelector(targetSelector)
    ), selector);
  }).toBe(true);
}

test("activates dependent fields and home-owner visibility rules in the rendered UI", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "DEEPER DIVE" }).click();

  await expect(page.locator(selectors.dependentAnnualCost)).toHaveCount(0);
  await fillAndBlur(page, selectors.dependentName, "Chris");
  await expect(page.locator(selectors.dependentAnnualCost)).toBeVisible();

  await expect(page.locator(selectors.housingRent)).toBeVisible();
  await fillAndBlur(page, selectors.homeValue, "600000");
  await expect(page.locator(selectors.housingRent)).toHaveCount(0);
  await expect(page.locator(selectors.mortgageBalance)).toBeVisible();
});

test("reveals dependent slots up to five through the existing add-dependent flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "DEEPER DIVE" }).click();

  await expect(page.locator(selectors.dependent2Name)).toHaveCount(0);
  await expect(page.locator(selectors.dependent4Name)).toHaveCount(0);
  await expect(page.locator(selectors.dependent5Name)).toHaveCount(0);

  await fillAndBlur(page, selectors.dependentName, "Chris");
  await page.locator(".add-dependent-btn").last().click();
  await expect(page.locator(selectors.dependent2Name)).toBeVisible();

  await fillAndBlur(page, selectors.dependent2Name, "Jamie");
  await page.locator(".add-dependent-btn").last().click();
  await expect(page.locator(selectors.dependent3Name)).toBeVisible();

  await fillAndBlur(page, selectors.dependent3Name, "Morgan");
  await page.locator(".add-dependent-btn").last().click();
  await expect(page.locator(selectors.dependent4Name)).toBeVisible();

  await fillAndBlur(page, selectors.dependent4Name, "Taylor");
  await page.locator(".add-dependent-btn").last().click();
  await expect(page.locator(selectors.dependent5Name)).toBeVisible();
});

test("reveals property slots up to five through the existing add-property flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "DEEPER DIVE" }).click();

  await expect(page.locator(selectors.property2Name)).toHaveCount(0);
  await expect(page.locator(selectors.property4Name)).toHaveCount(0);
  await expect(page.locator(selectors.property5Name)).toHaveCount(0);

  await fillAndBlur(page, selectors.propertyName, "Sliema");
  await expect(page.locator(selectors.propertyAnnualCost)).toBeVisible();
  await page.locator(".add-property-btn").last().click();
  await expect(page.locator(selectors.property2Name)).toBeVisible();

  await fillAndBlur(page, selectors.property2Name, "Gzira");
  await page.locator(".add-property-btn").last().click();
  await expect(page.locator(selectors.property3Name)).toBeVisible();

  await fillAndBlur(page, selectors.property3Name, "Qormi");
  await page.locator(".add-property-btn").last().click();
  await expect(page.locator(selectors.property4Name)).toBeVisible();

  await fillAndBlur(page, selectors.property4Name, "Gudja");
  await page.locator(".add-property-btn").last().click();
  await expect(page.locator(selectors.property5Name)).toBeVisible();
});

test("tab order stays in visible dependent field order as groups appear", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "DEEPER DIVE" }).click();

  const dependentName = page.locator(selectors.dependentName);
  await dependentName.fill("Chris");
  await dependentName.press("Tab");
  await expectActiveElement(page, selectors.dependentAnnualCost);

  const dependentAnnualCost = page.locator(selectors.dependentAnnualCost);
  await dependentAnnualCost.fill("2000");
  await dependentAnnualCost.press("Tab");
  await expectActiveElement(page, 'input[data-field-id="dependents.01.supportYearsRemaining"]');

  await page.locator(".add-dependent-btn").click();
  await page.locator('input[data-field-id="dependents.01.supportYearsRemaining"]').press("Tab");
  await expectActiveElement(page, selectors.dependent2Name);

  await page.locator(selectors.dependent2Name).press("Shift+Tab");
  await expectActiveElement(page, 'input[data-field-id="dependents.01.supportYearsRemaining"]');
});

test("tab order skips hidden housing rent and reveals mortgage fields in sequence", async ({ page }) => {
  await page.goto("/");

  const homeValue = page.locator(selectors.homeValue);
  await homeValue.fill("600000");
  await homeValue.press("Tab");
  await expect(page.locator(selectors.housingRent)).toHaveCount(0);
  await expectActiveElement(page, selectors.mortgageBalance);

  await page.locator(selectors.mortgageBalance).fill("50000");
  await page.locator(selectors.mortgageBalance).press("Tab");
  await expectActiveElement(page, selectors.mortgageInterest);

  await page.locator(selectors.mortgageInterest).press("Tab");
  await expectActiveElement(page, selectors.mortgageRepayment);

  await page.locator(selectors.mortgageRepayment).press("Shift+Tab");
  await expectActiveElement(page, selectors.mortgageInterest);
});

test("living expenses default to single-total entry and expanded mode aggregates categories", async ({ page }) => {
  await loadSampleData(page);

  await expect(page.locator(selectors.livingExpenses)).toBeVisible();
  await expect(page.locator(selectors.livingExpensesGroceries)).toHaveCount(0);
  await page.locator(selectors.livingExpensesExpandedMode).click();

  await expect(page.locator(selectors.livingExpenses)).toHaveCount(0);
  await expect(page.locator(selectors.livingExpensesDerivedTotal)).toHaveValue(/50,000/);
  await expect(page.locator(selectors.livingExpensesMiscellaneous)).toHaveValue(/50,000/);

  await fillAndBlur(page, selectors.livingExpensesMiscellaneous, "");
  await fillAndBlur(page, selectors.livingExpensesGroceries, "18000");
  await fillAndBlur(page, selectors.livingExpensesUtilities, "4200");
  await fillAndBlur(page, selectors.livingExpensesMiscellaneous, "27800");

  await expect(page.locator(selectors.livingExpensesDerivedTotal)).toHaveValue(/50,000/);
});

test("load sample data restores dependents 4 and 5 from the Excel specimen", async ({ page }) => {
  await loadSampleData(page);
  await page.getByRole("button", { name: "DEEPER DIVE" }).click();

  await expect(page.locator(selectors.dependent4Name)).toBeVisible();
  await expect(page.locator(selectors.dependent4Name)).toHaveValue("Stephen");
  await expect(page.locator('input[data-field-id="dependents.04.annualCost"]')).toHaveValue(/2,500/);
  await expect(page.locator('input[data-field-id="dependents.04.supportYearsRemaining"]')).toHaveValue("3");

  await expect(page.locator(selectors.dependent5Name)).toBeVisible();
  await expect(page.locator(selectors.dependent5Name)).toHaveValue("Jane");
  await expect(page.locator('input[data-field-id="dependents.05.annualCost"]')).toHaveValue(/2,860/);
  await expect(page.locator('input[data-field-id="dependents.05.supportYearsRemaining"]')).toHaveValue("6");
});

test("load sample data restores properties 4 and 5 from the Excel specimen", async ({ page }) => {
  await loadSampleData(page);
  await page.getByRole("button", { name: "DEEPER DIVE" }).click();

  await expect(page.locator(selectors.property4Name)).toBeVisible();
  await expect(page.locator(selectors.property4Name)).toHaveValue("Gudja");
  await expect(page.locator('input[data-field-id="properties.04.marketValue"]')).toHaveValue(/80,000/);
  await expect(page.locator('input[data-field-id="properties.04.rentalIncomeNetAnnual"]')).toHaveValue(/5,000/);

  await expect(page.locator(selectors.property5Name)).toBeVisible();
  await expect(page.locator(selectors.property5Name)).toHaveValue("Marsa");
  await expect(page.locator('input[data-field-id="properties.05.marketValue"]')).toHaveValue(/120,000/);
  await expect(page.locator('input[data-field-id="properties.05.rentalIncomeNetAnnual"]')).toHaveValue(/6,500/);
});

test("load sample data restores the workbook early-retirement age", async ({ page }) => {
  await loadSampleData(page);

  await expect(page.locator(selectors.earlyRetAge)).toHaveValue(String(EXCEL_BASELINE_SPECIMEN.early_retirement_age));
});

test("deep dive keeps investment properties together before other income and orders other loans cleanly", async ({ page }) => {
  await loadSampleData(page);
  await page.getByRole("button", { name: "DEEPER DIVE" }).click();

  const topHeadings = await page.locator(".section-deeper-dive .group-top").allTextContents();
  expect(topHeadings.filter((heading) => heading.trim() === "Investment Properties")).toHaveLength(1);

  const visibleFieldIds = await page.locator(".section-deeper-dive .field[data-field-id]").evaluateAll((fields) => (
    fields.map((field) => field.getAttribute("data-field-id") ?? "").filter((fieldId) => fieldId.length > 0)
  ));
  const position = (fieldId: string): number => visibleFieldIds.indexOf(fieldId);

  expect(position("properties.05.annualOperatingCost")).toBeGreaterThan(-1);
  expect(position("properties.01.rentalIncomeNetAnnual")).toBeGreaterThan(-1);
  expect(position("income.otherWork.netAnnual")).toBeGreaterThan(-1);
  expect(position("debts.creditCards.balance")).toBeGreaterThan(-1);
  expect(position("properties.01.loan.balance")).toBeGreaterThan(-1);
  expect(position("properties.05.annualOperatingCost")).toBeLessThan(position("properties.01.rentalIncomeNetAnnual"));
  expect(position("properties.01.rentalIncomeNetAnnual")).toBeLessThan(position("income.otherWork.netAnnual"));
  expect(position("income.otherWork.netAnnual")).toBeLessThan(position("properties.01.loan.balance"));
  expect(position("properties.05.loan.monthlyRepayment")).toBeLessThan(position("debts.creditCards.balance"));
  expect(position("debts.creditCards.balance")).toBeLessThan(position("debts.other.balance"));
});

test("equivalent living-expense totals keep downstream projections unchanged across entry modes", async ({ page }) => {
  await loadSampleData(page);
  await fillAndBlur(page, selectors.livingExpenses, "60000");

  await page.getByRole("button", { name: "Open cash flow" }).click();
  await page.locator("#projection-expand-all").click();
  const singleModeRow = await page.locator('tr[data-row-id="living-expenses"]').textContent();

  await page.locator(selectors.livingExpensesExpandedMode).click();
  await fillAndBlur(page, selectors.livingExpensesMiscellaneous, "");
  await fillAndBlur(page, selectors.livingExpensesGroceries, "24000");
  await fillAndBlur(page, selectors.livingExpensesUtilities, "6000");
  await fillAndBlur(page, selectors.livingExpensesMiscellaneous, "30000");

  await expect(page.locator(selectors.livingExpensesDerivedTotal)).toHaveValue(/60,000/);
  const expandedModeRow = await page.locator('tr[data-row-id="living-expenses"]').textContent();

  expect(expandedModeRow).toBe(singleModeRow);
});

test("expanded living expenses surface the existing total-field validation when categories are cleared", async ({ page }) => {
  await loadSampleData(page);
  await page.locator(selectors.livingExpensesExpandedMode).click();

  const miscellaneous = page.locator(selectors.livingExpensesMiscellaneous);
  await miscellaneous.click();
  await miscellaneous.press(`${process.platform === "darwin" ? "Meta" : "Control"}+A`);
  await miscellaneous.press("Backspace");
  await miscellaneous.blur();

  await expect(page.locator('.living-expenses-field .field-feedback.is-error')).toContainText("required");
});

test("retire-check readiness follows projection-blocking validation", async ({ page }) => {
  await loadSampleData(page);

  const retireCheckButton = page.getByRole("button", { name: "Enough to quit?" });
  await expect(retireCheckButton).toBeEnabled();

  await fillAndBlur(page, selectors.currentAge, "");
  await expect(retireCheckButton).toBeDisabled();
  await expect(page.locator(".timeline-empty")).toContainText("Enter your age to see projections.");

  await fillAndBlur(page, selectors.currentAge, "48");
  await expect(retireCheckButton).toBeEnabled();
  await expect(page.locator(".timeline-milestone").first()).toBeVisible();
});

test("cash-flow controls preserve structure and scroll position across scenario switches", async ({ page }) => {
  await loadSampleData(page);

  await page.getByRole("button", { name: "Open cash flow" }).click();
  await expect(page.locator("#projection-section")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#projection-tab-cashflow")).toHaveAttribute("aria-selected", "true");

  await page.locator("#projection-expand-all").click();
  await expect(page.locator('tr[data-row-id="employment-income"]')).toBeVisible();

  await page.locator("#projection-collapse-all").click();
  await expect(page.locator('tr[data-row-id="employment-income"]')).toHaveCount(0);

  await page.locator("#projection-expand-all").click();
  await expect(page.locator('tr[data-row-id="employment-income"]')).toBeVisible();

  const scrollMetrics = await page.locator(selectors.cashflowScroll).evaluate((node) => {
    const scrollEl = node as HTMLElement;
    scrollEl.scrollTop = 360;
    const rows = Array.from(scrollEl.querySelectorAll<HTMLElement>("tr[data-row-id]"));
    const visibleRow = rows.find((row) => row.offsetTop + row.offsetHeight > scrollEl.scrollTop);
    return {
      scrollTop: scrollEl.scrollTop,
      rowId: visibleRow?.dataset.rowId ?? null,
      scrollHeight: scrollEl.scrollHeight,
      clientHeight: scrollEl.clientHeight
    };
  });

  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
  expect(scrollMetrics.rowId).not.toBeNull();

  const statutoryButton = page.locator("#projection-scenario-norm");
  await statutoryButton.click();
  await expect(statutoryButton).toHaveAttribute("aria-selected", "true");

  const restoredMetrics = await page.locator(selectors.cashflowScroll).evaluate((node) => {
    const scrollEl = node as HTMLElement;
    const rows = Array.from(scrollEl.querySelectorAll<HTMLElement>("tr[data-row-id]"));
    const visibleRow = rows.find((row) => row.offsetTop + row.offsetHeight > scrollEl.scrollTop);
    return {
      scrollTop: scrollEl.scrollTop,
      rowId: visibleRow?.dataset.rowId ?? null
    };
  });

  expect(Math.abs(restoredMetrics.scrollTop - scrollMetrics.scrollTop)).toBeLessThanOrEqual(8);
  expect(restoredMetrics.rowId).toBe(scrollMetrics.rowId);
});

test("net-worth section opens independently and keeps scenario selection in sync", async ({ page }) => {
  await loadSampleData(page);

  await page.locator("#open-networth-btn").click();
  await expect(page.locator("#projection-section")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#projection-tab-networth")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(selectors.networthScroll)).toBeVisible();
  await expect(page.locator("#cashflow-table-panel")).toBeHidden();

  await page.locator("#projection-tab-cashflow").click();
  await expect(page.locator("#projection-tab-cashflow")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(selectors.cashflowScroll)).toBeVisible();
  await expect(page.locator("#networth-table-panel")).toBeHidden();

  const networthStatutoryButton = page.locator("#projection-scenario-norm");
  await networthStatutoryButton.click();
  await expect(networthStatutoryButton).toHaveAttribute("aria-selected", "true");
  await page.locator("#projection-tab-networth").click();
  await expect(page.locator("#projection-tab-networth")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#projection-scenario-norm")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#projection-scenario-early")).toHaveAttribute("aria-selected", "false");
});

test("cash chart zero-line emphasis follows the active cash scenario only", async ({ page }) => {
  await loadSampleData(page);

  await fillAndBlur(page, selectors.earlyRetAge, "51");
  await page.getByRole("button", { name: "Open cash flow" }).click();

  await expect(page.locator(selectors.cashChart)).toHaveAttribute("data-zero-line-alert", "true");
  await expect(page.locator(selectors.networthChart)).not.toHaveAttribute("data-zero-line-alert", "true");

  await page.locator("#projection-scenario-norm").click();

  await expect(page.locator(selectors.cashChart)).toHaveAttribute("data-zero-line-alert", "false");
  await expect(page.locator(selectors.networthChart)).not.toHaveAttribute("data-zero-line-alert", "true");

  await page.locator("#projection-scenario-early").click();

  await expect(page.locator(selectors.cashChart)).toHaveAttribute("data-zero-line-alert", "true");
});

test("charts match backing-store size to CSS size for crisp high-DPI rendering", async ({ page }) => {
  await loadSampleData(page);

  for (const selector of [selectors.cashChart, selectors.networthChart]) {
    const metrics = await page.locator(selector).evaluate((node) => {
      const canvas = node as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      return {
        clientWidth: rect.width,
        clientHeight: rect.height,
        backingWidth: canvas.width,
        backingHeight: canvas.height,
        dpr: window.devicePixelRatio
      };
    });

    expect(metrics.backingWidth).toBe(Math.round(metrics.clientWidth * metrics.dpr));
    expect(metrics.backingHeight).toBe(Math.round(metrics.clientHeight * metrics.dpr));
  }
});

test("longer currency prefixes expand y-axis gutter without jitter or clipping", async ({ page }) => {
  await loadSampleData(page);

  const measurePad = async (selector: string) => page.locator(selector).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    return Number(canvas.dataset.plotPadLeft ?? "0");
  });

  const eurPad = await measurePad(selectors.cashChart);
  expect(eurPad).toBeLessThan(72);
  await page.locator(selectors.currencySelector).selectOption("CHF");
  await expect(page.locator(selectors.cashChart)).toBeVisible();

  const chfPad = await measurePad(selectors.cashChart);
  expect(chfPad).toBeGreaterThanOrEqual(eurPad);
  await expect.poll(() => measurePad(selectors.networthChart)).toBe(chfPad);

  await page.getByRole("button", { name: "Open cash flow" }).click();
  await page.locator("#projection-scenario-norm").click();
  const chfPadAfterToggle = await measurePad(selectors.cashChart);
  expect(chfPadAfterToggle).toBeGreaterThanOrEqual(chfPad);
  await expect.poll(() => measurePad(selectors.networthChart)).toBe(chfPadAfterToggle);
});

test("net-worth collapse chevron returns to the top of the dashboard canvas", async ({ page }) => {
  await loadSampleData(page);

  await page.locator("#open-networth-btn").click();
  await expect(page.locator("#projection-section")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#projection-tab-networth")).toHaveAttribute("aria-selected", "true");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);

  await page.locator("#projection-section-collapse").click();

  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeLessThan(20);
  await expect(page.locator("#projection-section")).toHaveAttribute("aria-hidden", "true");
});
