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

  test("renter branch asks for monthly rent and skips home value / mortgage", async ({ page }) => {
    await gotoOnboarding(page);
    await answerText(page, "age", "48");
    await answerYesNo(page, "partnerInclude", "NO");
    await answerText(page, "userIncome", "65000");
    await answerText(page, "livingExpenses", "42000");
    await page.locator("[data-onboarding-option=\"TAPER\"]").click();
    await page.locator("[data-toggle-field-id=\"housing.status\"][data-toggle-option=\"Renter\"]").click();
    await expect(page.locator("[data-onboarding-card=\"rent\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-card=\"rent\"]")).toContainText("monthly rent");
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

  test("editing a chip resumes from the next stale question, not an earlier abandoned edit", async ({ page }) => {
    // Repro for the bug where opening an early chip and then jumping to a later
    // chip caused the post-edit flow to snap back to the first earlier edit.
    await gotoOnboarding(page);
    await answerText(page, "age", "48");
    await answerYesNo(page, "partnerInclude", "NO");
    await answerText(page, "userIncome", "65000");
    await answerText(page, "livingExpenses", "40000");
    await page.locator("[data-onboarding-option=\"STEADY\"]").click();
    await page.locator("[data-toggle-field-id=\"housing.status\"][data-toggle-option=\"Renter\"]").click();
    await answerText(page, "rent", "1000");
    await answerText(page, "cash", "50000");
    await answerText(page, "equities", "100000");
    await answerText(page, "equityContrib", "0");
    await answerYesNo(page, "propertiesGate", "YES");
    await answerText(page, "property1Name", "Sliema Flat");
    await answerText(page, "property1Value", "350000");
    await answerText(page, "property1Loan", "0");
    await answerText(page, "property1Rent", "12000");
    await answerText(page, "property1Cost", "2000");
    await answerYesNo(page, "property2Gate", "NO");

    // Open an early chip (partnerInclude), then before re-confirming jump
    // forward to a later chip (property1Name).
    await page.locator("[data-onboarding-chip=\"partnerInclude\"]").click();
    await expect(page.locator("[data-onboarding-card=\"partnerInclude\"]")).toBeVisible();
    await page.locator("[data-onboarding-chip=\"property1Name\"]").click();
    await expect(page.locator("[data-onboarding-card=\"property1Name\"]")).toBeVisible();

    // Re-confirm the property name. Flow must resume at the next valid question
    // after property1Name, not snap back to the abandoned partnerInclude edit
    // or to any other earlier question.
    await page.locator("[data-onboarding-continue=\"property1Name\"]").click();
    await expect(page.locator("[data-onboarding-card=\"property1Value\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-card=\"partnerInclude\"]")).toHaveCount(0);
    await expect(page.locator("[data-onboarding-card=\"userIncome\"]")).toHaveCount(0);
  });

  test("forward and jump-to-latest let the user navigate back-and-forward without re-confirmation", async ({ page }) => {
    await gotoOnboarding(page);
    await answerText(page, "age", "48");
    await answerYesNo(page, "partnerInclude", "NO");
    await answerText(page, "userIncome", "65000");
    await answerText(page, "livingExpenses", "40000");
    await page.locator("[data-onboarding-option=\"STEADY\"]").click();
    await page.locator("[data-toggle-field-id=\"housing.status\"][data-toggle-option=\"Renter\"]").click();
    await answerText(page, "rent", "1000");
    await answerText(page, "cash", "50000");
    await expect(page.locator("[data-onboarding-card=\"equities\"]")).toBeVisible();

    // Jump back five questions to userIncome via its chip.
    await page.locator("[data-onboarding-chip=\"userIncome\"]").click();
    await expect(page.locator("[data-onboarding-card=\"userIncome\"]")).toBeVisible();
    // The legacy edit hint must be gone, so the active card stays in place.
    await expect(page.locator(".ob-edit-hint")).toHaveCount(0);
    await expect(page.locator("[data-onboarding-forward]")).toBeVisible();
    await expect(page.locator("[data-onboarding-jump-latest]")).toBeVisible();

    // Forward steps through stale answers without requiring re-confirm and
    // preserves the previously stored value in the next card's input.
    await page.locator("[data-onboarding-forward]").click();
    await expect(page.locator("[data-onboarding-card=\"livingExpenses\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-input=\"livingExpenses\"]")).toHaveValue("40000");

    // Jump to latest skips remaining stale answers and lands on the frontier.
    await page.locator("[data-onboarding-jump-latest]").click();
    await expect(page.locator("[data-onboarding-card=\"equities\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-forward]")).toHaveCount(0);
    await expect(page.locator("[data-onboarding-jump-latest]")).toHaveCount(0);
  });

  test("repeated back clicks preserve every still-valid answered chip in history", async ({ page }) => {
    // Repro: chained back navigation must not silently drop chips for the
    // intermediate questions whose values are preserved.
    await gotoOnboarding(page);
    await answerText(page, "age", "48");
    await answerYesNo(page, "partnerInclude", "NO");
    await answerText(page, "userIncome", "65000");
    await answerText(page, "livingExpenses", "40000");
    await expect(page.locator("[data-onboarding-card=\"spendingTaper\"]")).toBeVisible();

    // Three back-steps in a row.
    await page.locator("[data-onboarding-card=\"spendingTaper\"] [data-onboarding-back]").click();
    await expect(page.locator("[data-onboarding-card=\"livingExpenses\"]")).toBeVisible();
    await page.locator("[data-onboarding-card=\"livingExpenses\"] [data-onboarding-back]").click();
    await expect(page.locator("[data-onboarding-card=\"userIncome\"]")).toBeVisible();
    await page.locator("[data-onboarding-card=\"userIncome\"] [data-onboarding-back]").click();
    await expect(page.locator("[data-onboarding-card=\"partnerInclude\"]")).toBeVisible();

    // Every previously-answered question (other than the current active one)
    // must still appear in history. Before the fix, userIncome and
    // livingExpenses chips disappeared on the second/third back click.
    await expect(page.locator("[data-onboarding-chip=\"age\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-chip=\"userIncome\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-chip=\"livingExpenses\"]")).toBeVisible();
  });

  test("chained chip-clicks backward preserve every answered chip", async ({ page }) => {
    await gotoOnboarding(page);
    await answerText(page, "age", "48");
    await answerYesNo(page, "partnerInclude", "NO");
    await answerText(page, "userIncome", "65000");
    await answerText(page, "livingExpenses", "40000");
    await page.locator("[data-onboarding-option=\"STEADY\"]").click();
    await page.locator("[data-toggle-field-id=\"housing.status\"][data-toggle-option=\"Renter\"]").click();
    await answerText(page, "rent", "1000");
    await expect(page.locator("[data-onboarding-card=\"cash\"]")).toBeVisible();

    // Click chip far back, then click an even earlier chip. The intermediate
    // first-target chip must still render even though it became stale-edit.
    await page.locator("[data-onboarding-chip=\"livingExpenses\"]").click();
    await expect(page.locator("[data-onboarding-card=\"livingExpenses\"]")).toBeVisible();
    await page.locator("[data-onboarding-chip=\"userIncome\"]").click();
    await expect(page.locator("[data-onboarding-card=\"userIncome\"]")).toBeVisible();

    // livingExpenses (the abandoned previous edit target) and all later
    // answered questions must still be visible as chips.
    await expect(page.locator("[data-onboarding-chip=\"livingExpenses\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-chip=\"spendingTaper\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-chip=\"housingStatus\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-chip=\"rent\"]")).toBeVisible();

    // Continuing from userIncome carries forward the stale cascade — the
    // next active card is livingExpenses (already pre-filled), and the
    // prior chips remain.
    await page.locator("[data-onboarding-continue=\"userIncome\"]").click();
    await expect(page.locator("[data-onboarding-card=\"livingExpenses\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-input=\"livingExpenses\"]")).toHaveValue("40000");
    await expect(page.locator("[data-onboarding-chip=\"userIncome\"]")).toBeVisible();
  });

  test("repeated back clicks keep jump-to-latest visible as the user moves further from the frontier", async ({ page }) => {
    await gotoOnboarding(page);
    await answerText(page, "age", "48");
    await answerYesNo(page, "partnerInclude", "NO");
    await answerText(page, "userIncome", "65000");
    await answerText(page, "livingExpenses", "40000");
    await expect(page.locator("[data-onboarding-card=\"spendingTaper\"]")).toBeVisible();

    // First back: livingExpenses (one back, no jump-to-latest yet).
    await page.locator("[data-onboarding-card=\"spendingTaper\"] [data-onboarding-back]").click();
    await expect(page.locator("[data-onboarding-card=\"livingExpenses\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-jump-latest]")).toHaveCount(0);

    // Second back: userIncome — now two questions away, jump-to-latest appears.
    await page.locator("[data-onboarding-card=\"livingExpenses\"] [data-onboarding-back]").click();
    await expect(page.locator("[data-onboarding-card=\"userIncome\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-jump-latest]")).toBeVisible();

    // Third back: partnerInclude — still further; jump-to-latest must remain.
    await page.locator("[data-onboarding-card=\"userIncome\"] [data-onboarding-back]").click();
    await expect(page.locator("[data-onboarding-card=\"partnerInclude\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-jump-latest]")).toBeVisible();
    await expect(page.locator("[data-onboarding-forward]")).toBeVisible();
  });

  test("jump-to-latest hides when only one question back from the frontier", async ({ page }) => {
    await gotoOnboarding(page);
    await answerText(page, "age", "48");
    await answerYesNo(page, "partnerInclude", "NO");
    await answerText(page, "userIncome", "65000");
    await expect(page.locator("[data-onboarding-card=\"livingExpenses\"]")).toBeVisible();

    // Single step back from the frontier.
    await page.locator("[data-onboarding-card=\"livingExpenses\"] [data-onboarding-back]").click();
    await expect(page.locator("[data-onboarding-card=\"userIncome\"]")).toBeVisible();
    await expect(page.locator("[data-onboarding-forward]")).toBeVisible();
    await expect(page.locator("[data-onboarding-jump-latest]")).toHaveCount(0);
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
    await answerYesNo(page, "creditCardsGate", "NO");
    await answerYesNo(page, "debtsGate", "NO");
    await expect(page.locator("[data-onboarding-card=\"handoff\"]")).toBeVisible();

    const handoffBtn = page.locator("[data-onboarding-handoff]");
    await expect(handoffBtn).toBeVisible();

    const [navResp] = await Promise.all([
      page.waitForURL(/\/ETQ\/calculator\.html#from=onboarding/),
      handoffBtn.click()
    ]);
    void navResp;

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

  test("'Ease me in' seeds the six landing inputs and asks for confirmation, not a blank restart", async ({ page }) => {
    await page.goto("/ETQ/index.html");
    await page.evaluate(() => {
      try { window.localStorage.clear(); window.sessionStorage.clear(); } catch { /* ignore */ }
    });
    await page.goto("/ETQ/index.html");
    await page.locator("#c-age").fill("47");
    await page.locator("#c-income").fill("110000");
    await page.locator("#c-spend").fill("55000");
    await page.locator("#c-savings").fill("40000");
    await page.locator("#c-invest").fill("180000");
    await page.locator("#c-pension").fill("12000");

    await Promise.all([
      page.waitForURL(/\/ETQ\/onboarding\.html/),
      page.locator('a.calc-choice[href="onboarding.html"]').click()
    ]);

    const ageCard = page.locator('[data-onboarding-card="age"]');
    await expect(ageCard).toBeVisible();
    await expect(ageCard).toContainText("does that still feel right?");
    await expect(page.locator('[data-onboarding-input="age"]')).toHaveValue("47");

    await page.locator('[data-onboarding-continue="age"]').click();
    await expect(page.locator('[data-onboarding-card="partnerInclude"]')).toBeVisible();
    await page.locator('[data-onboarding-yesno="partnerInclude"][data-onboarding-option="NO"]').click();

    const incomeCard = page.locator('[data-onboarding-card="userIncome"]');
    await expect(incomeCard).toBeVisible();
    await expect(incomeCard).toContainText("does that still feel right?");
    await expect(page.locator('[data-onboarding-input="userIncome"]')).toHaveValue("110000");
  });

  test("a fresh landing seed wins over a stale onboarding resume state", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem(
          "etq:onboarding:state:v1",
          JSON.stringify({
            version: 1,
            savedAt: new Date().toISOString(),
            fields: { "profile.currentAge": 33, "spending.livingExpenses.annual": 12000 },
            ui: {
              answered: ["age"],
              staleAnswered: [],
              gates: {},
              acceptedAssumptions: [],
              seededQuestions: [],
              activeQuestionId: "partnerInclude"
            }
          })
        );
        window.sessionStorage.setItem(
          "etq:landing:quick-estimate",
          JSON.stringify({ age: 47, livingExpensesAnnual: 55000 })
        );
      } catch { /* ignore */ }
    });
    await page.goto("/ETQ/onboarding.html");
    const ageCard = page.locator('[data-onboarding-card="age"]');
    await expect(ageCard).toBeVisible();
    await expect(page.locator('[data-onboarding-input="age"]')).toHaveValue("47");
    await expect(ageCard).toContainText("does that still feel right?");
  });
});
