import { expect, test, type Page } from "@playwright/test";

async function gotoOnboarding(page: Page): Promise<void> {
  await page.goto("/ETQ/onboarding.html");
  await page.evaluate(() => {
    try { window.localStorage.clear(); window.sessionStorage.clear(); } catch { /* ignore */ }
  });
  await page.goto("/ETQ/onboarding.html");
  await expect(page.locator("[data-onboarding-card=\"age\"]")).toBeVisible();
}

async function answerText(page: Page, questionId: string, value: string): Promise<void> {
  const input = page.locator(`[data-onboarding-input="${questionId}"]`);
  await input.fill(value);
  await page.locator(`[data-onboarding-continue="${questionId}"]`).click();
}

async function answerYesNo(page: Page, questionId: string, option: "YES" | "NO"): Promise<void> {
  await page.locator(`[data-onboarding-yesno="${questionId}"][data-onboarding-option="${option}"]`).click();
}

test.describe("Progressive Onboarding", () => {
  test("renders the first question and an empty estimate panel on load", async ({ page }) => {
    await gotoOnboarding(page);
    await expect(page.locator("#ob-estimate-age")).toHaveText("—");
    await expect(page.locator("#ob-estimate-placeholder")).toBeVisible();
    await expect(page.locator("#ob-chart-wrap")).toHaveAttribute("data-visible", /false|^$/);
  });

  test("partner No branch skips partner follow-ups and exposes the income question", async ({ page }) => {
    await gotoOnboarding(page);
    await answerText(page, "age", "48");
    await answerYesNo(page, "partnerInclude", "NO");
    await expect(page.locator("[data-onboarding-card=\"userIncome\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-card=\"partnerAge\"]")).toHaveCount(0);
  });

  test("renter branch asks for annual rent and skips home value / mortgage", async ({ page }) => {
    await gotoOnboarding(page);
    await answerText(page, "age", "48");
    await answerYesNo(page, "partnerInclude", "NO");
    await answerText(page, "userIncome", "65000");
    await answerText(page, "livingExpenses", "42000");
    await page.locator("[data-onboarding-option=\"TAPER\"]").click();
    await page.locator("[data-toggle-field-id=\"housing.status\"][data-toggle-option=\"Renter\"]").click();
    await expect(page.locator("[data-onboarding-card=\"rent\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-card=\"homeValue\"]")).toHaveCount(0);
    await expect(page.locator("[data-onboarding-card=\"hasMortgage\"]")).toHaveCount(0);
  });

  test("chart stays hidden before cash, appears after cash answer", async ({ page }) => {
    await gotoOnboarding(page);
    await answerText(page, "age", "48");
    await answerYesNo(page, "partnerInclude", "NO");
    await answerText(page, "userIncome", "80000");
    await answerText(page, "livingExpenses", "40000");
    await page.locator("[data-onboarding-option=\"TAPER\"]").click();
    await page.locator("[data-toggle-field-id=\"housing.status\"][data-toggle-option=\"Renter\"]").click();
    await answerText(page, "rent", "18000");
    await expect(page.locator("#ob-chart-wrap")).toHaveAttribute("data-visible", /false|^$/);
    await answerText(page, "cash", "50000");
    await expect(page.locator("#ob-chart-wrap")).toHaveAttribute("data-visible", "true");
  });

  test("editing an owner->renter chip invalidates mortgage answers", async ({ page }) => {
    await gotoOnboarding(page);
    await answerText(page, "age", "48");
    await answerYesNo(page, "partnerInclude", "NO");
    await answerText(page, "userIncome", "80000");
    await answerText(page, "livingExpenses", "40000");
    await page.locator("[data-onboarding-option=\"TAPER\"]").click();
    await page.locator("[data-toggle-field-id=\"housing.status\"][data-toggle-option=\"Owner\"]").click();
    await answerText(page, "homeValue", "500000");
    await answerYesNo(page, "hasMortgage", "NO");
    // Click the housing-status chip to re-open
    await page.locator("[data-onboarding-chip=\"housingStatus\"]").click();
    await page.locator("[data-toggle-field-id=\"housing.status\"][data-toggle-option=\"Renter\"]").click();
    await expect(page.locator("[data-onboarding-card=\"rent\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-chip=\"homeValue\"]")).toHaveCount(0);
    await expect(page.locator("[data-onboarding-chip=\"hasMortgage\"]")).toHaveCount(0);
  });

  test("handoff writes the draft snapshot and navigates with #from=onboarding", async ({ page }) => {
    await gotoOnboarding(page);
    await answerText(page, "age", "48");
    await answerYesNo(page, "partnerInclude", "NO");
    await answerText(page, "userIncome", "200000");
    await answerText(page, "livingExpenses", "30000");
    await page.locator("[data-onboarding-option=\"TAPER\"]").click();
    await page.locator("[data-toggle-field-id=\"housing.status\"][data-toggle-option=\"Renter\"]").click();
    await answerText(page, "rent", "12000");
    await answerText(page, "cash", "200000");
    await answerText(page, "equities", "2000000");
    await answerText(page, "equityContrib", "0");
    await answerYesNo(page, "propertiesGate", "NO");
    await answerYesNo(page, "assetsGate", "NO");
    await answerYesNo(page, "dependentsGate", "NO");
    await answerText(page, "statutoryAge", "65");
    await answerText(page, "statePension", "14000");
    await answerYesNo(page, "debtsGate", "NO");
    await expect(page.locator("[data-onboarding-card=\"handoff\"]")).toBeVisible();

    const handoffBtn = page.locator("[data-onboarding-handoff]");
    await expect(handoffBtn).toBeVisible();

    const [navResp] = await Promise.all([
      page.waitForURL(/\/ETQ\/calculator\.html#from=onboarding/),
      handoffBtn.click()
    ]);
    void navResp;

    await expect(page.locator("#onboarding-handoff-banner")).toBeVisible();

    const draftRaw = await page.evaluate(() => window.localStorage.getItem("etq:scenario:draft:v2"));
    expect(draftRaw).not.toBeNull();
    const draft = JSON.parse(String(draftRaw));
    expect(draft.version).toBe(2);
    expect(draft.fields["profile.currentAge"]).toBe(48);
    expect(draft.fields["spending.livingExpenses.annual"]).toBe(30000);
  });

  test("sessionStorage seed pre-fills the age question", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.sessionStorage.setItem(
          "etq:landing:quick-estimate",
          JSON.stringify({ age: 52, netAnnualIncome: 90000, livingExpensesAnnual: 48000 })
        );
      } catch { /* ignore */ }
    });
    await page.goto("/ETQ/onboarding.html");
    const ageInput = page.locator("[data-onboarding-input=\"age\"]");
    await expect(ageInput).toHaveValue("52");
  });
});
