import { expect, test, type Page } from "@playwright/test";

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
  homeValue: 'input[data-field-id="housing.primaryResidence.marketValue"]',
  housingRent: 'input[data-field-id="housing.rentAnnual"]',
  mortgageBalance: 'input[data-field-id="housing.primaryResidence.mortgage.balance"]',
  dependentName: 'input[data-field-id="dependents.primary.displayName"]',
  dependentAnnualCost: 'input[data-field-id="dependents.primary.annualCost"]',
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

  await fillAndBlur(page, selectors.earlyRetAge, "53");
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
