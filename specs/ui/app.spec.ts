import { expect, test, type Page } from "@playwright/test";

const selectors = {
  currentAge: 'input[data-field-id="profile.currentAge"]',
  homeValue: 'input[data-field-id="housing.primaryResidence.marketValue"]',
  housingRent: 'input[data-field-id="housing.rentAnnual"]',
  mortgageBalance: 'input[data-field-id="housing.primaryResidence.mortgage.balance"]',
  dependentName: 'input[data-field-id="dependents.primary.displayName"]',
  dependentAnnualCost: 'input[data-field-id="dependents.primary.annualCost"]',
  cashflowScroll: ".cashflow-table-scroll"
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
  await expect(page.locator("#cashflow-section")).toHaveAttribute("aria-hidden", "false");

  await page.getByRole("button", { name: "Expand all" }).click();
  await expect(page.locator('tr[data-row-id="employment-income"]')).toBeVisible();

  await page.getByRole("button", { name: "Collapse all" }).click();
  await expect(page.locator('tr[data-row-id="employment-income"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Expand all" }).click();
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

  const statutoryButton = page.locator("#cashflow-scenario-norm");
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
