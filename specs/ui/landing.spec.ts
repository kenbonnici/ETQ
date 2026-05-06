import { expect, test, type Page } from "@playwright/test";

async function gotoLanding(page: Page): Promise<void> {
  await page.goto("/ETQ/index.html");
  await page.evaluate(() => {
    try { window.localStorage.clear(); window.sessionStorage.clear(); } catch { /* ignore */ }
  });
  await page.goto("/ETQ/index.html");
  await expect(page.locator("#c-age")).toBeVisible();
}

test.describe("Landing handoff", () => {
  test("clicking 'I'm ready' carries the six landing inputs into the calculator", async ({ page }) => {
    await gotoLanding(page);

    await page.locator("#c-age").fill("45");
    await page.locator("#c-income").fill("120000");
    await page.locator("#c-spend").fill("60000");
    await page.locator("#c-savings").fill("50000");
    await page.locator("#c-invest").fill("20000");
    await page.locator("#c-pension").fill("15000");

    await Promise.all([
      page.waitForURL(/\/ETQ\/calculator\.html/),
      page.locator('a.calc-choice[href="calculator.html"]').click()
    ]);

    await expect(page.locator('input[data-field-id="profile.currentAge"]')).toHaveValue("45");
    await expect(page.locator('input[data-field-id="income.employment.netAnnual"]')).toHaveValue(/120,?000/);
    await expect(page.locator('input[data-field-id="spending.livingExpenses.annual"]')).toHaveValue(/60,?000/);
    await expect(page.locator('input[data-field-id="assets.cash.totalBalance"]')).toHaveValue(/50,?000/);
    await expect(page.locator('input[data-field-id="assets.equities.marketValue"]')).toHaveValue(/20,?000/);
    await expect(page.locator('input[data-field-id="retirement.statePension.netAnnualAtStart"]')).toHaveValue(/15,?000/);
  });

  test("clicking 'I'm ready' with all inputs empty does not overwrite an existing draft", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem(
          "etq:scenario:draft:v2",
          JSON.stringify({
            version: 2,
            savedAt: new Date().toISOString(),
            fields: { "profile.currentAge": 60, "spending.livingExpenses.annual": 42000 },
            plannedSellYears: {},
            ui: {
              majorFutureEventsOpen: false,
              advancedAssumptionsOpen: false,
              earlyRetirementAge: 55,
              selectedCurrency: "EUR",
              livingExpensesMode: "single",
              livingExpenseCategoryValues: {}
            }
          })
        );
      } catch { /* ignore */ }
    });
    await page.goto("/ETQ/index.html");
    await expect(page.locator("#c-age")).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/ETQ\/calculator\.html/),
      page.locator('a.calc-choice[href="calculator.html"]').click()
    ]);

    await expect(page.locator('input[data-field-id="profile.currentAge"]')).toHaveValue("60");
    await expect(page.locator('input[data-field-id="spending.livingExpenses.annual"]')).toHaveValue(/42,?000/);
  });
});
