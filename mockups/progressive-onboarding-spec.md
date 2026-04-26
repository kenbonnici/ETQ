# Progressive Onboarding — Hi-Fi Design Spec

**Document status:** v1.2 — reconciled with shipped implementation
**Last updated:** 2026-04-26 (revisions: configurable assumptions deferred to a right-panel list rather than inline; downsizing flow expanded into year + buy-vs-rent + cost/rent; chip-edit semantics reaffirmed as non-destructive stale-and-rewalk; mid-walkthrough persistence)
**Scope:** design spec only. No implementation in this document.

---

## 1. Purpose & positioning

A calm, single-page guided walkthrough that sits between the landing-page 30-second estimator and the full calculator. It takes the user through the calculator's real input sequence — but one question at a time, in conversational language — while a live projection panel on the right builds confidence as answers accumulate.

**Outcome:** by the time the user lands on the full calculator, the numbers already look like *theirs*.

**Voice:** a trusted advisor who asks one question, waits, then asks the next. Never a form. Warm but composed. No exclamation marks, no "Great!", no "Awesome!".

---

## 2. Entry points & handoff

### 2.1 Where the page is reached from

The landing page already has a three-card *progression* block in the "Start light. Go deep…" section (`index.html:484–497`). Two of those cards are already clickable. The middle card, **Guided walkthrough** (`index.html:490`), is currently text-only. Make it symmetrical with its siblings:

```html
<article class="step">
  <h3><a href="onboarding.html" class="step-link">Guided walkthrough<span class="step-link-arrow">→</span></a></h3>
  <p>A guided walkthrough — one question at a time…</p>
</article>
```

And in the 30-second estimate section, change only the **first** of the two existing `.calc-choice` links (`index.html:436`) to point at `onboarding.html`. Leave the "I love numbers" link pointing at `calculator.html` unchanged.

**Final entry map:**

| Source on landing | Destination |
|---|---|
| `.calc-choice` "Ease me in…" | `onboarding.html` |
| `.step` middle card "Guided walkthrough" | `onboarding.html` |
| `.calc-choice` "I love numbers…" | `calculator.html` (unchanged) |
| `.step` third card "Full model" | `calculator.html` (unchanged) |

No new copy is needed on the landing page — the existing "Guided walkthrough" description ("one question at a time uncovering all income, expenses, assets, commitments, sales and scenarios… No jargon, no friction") already frames the page accurately.

### 2.2 Handoff in from the 30-second estimate

If the user completed the 30-second estimator on the landing page, pre-fill:

- `profile.currentAge`
- `income.employment.netAnnual`
- `spending.livingExpenses.annual`
- `assets.cash.totalBalance`
- `assets.equities.marketValue`
- `retirement.statePension.netAnnualAtStart`

…from `sessionStorage`, and skip or soft-confirm those questions: *"You told us you earn €X — does that still feel right?"*

### 2.3 Handoff out to the full calculator

On completion, persist `FieldState` to `localStorage` under the same key the full calculator reads, then navigate to `calculator.html#from=onboarding`. The calculator detects that hash and shows a gentle one-session banner: *"Here's what you built. Edit anything, or keep exploring."*

---

## 3. Page composition

```
┌───────────────────────────────────────────────────────────────────────┐
│  NAV (same as landing: ETQ wordmark left, link back to landing)       │
├───────────────────────┬───────────────────────────────────────────────┤
│                       │                                               │
│   CONVERSATION        │   LIVE ESTIMATE PANEL (sticky)                │
│   (left, ~52%)        │   (right, ~48%)                               │
│                       │                                               │
│   scrollable stack    │   does not scroll with questions              │
│   of answered chips   │                                               │
│   + the active card   │                                               │
│                       │                                               │
└───────────────────────┴───────────────────────────────────────────────┘
```

- Outer container: `max-width: 1280px`, `padding: 48px 40px 120px`.
- Two-column CSS grid: `grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 72px`.
- Below 960px viewport: single column, right panel becomes a compact sticky header (age + delta only, no chart).
- Background: `--cream` (same as landing), with a faint `radial-gradient(at 85% 15%, rgba(178,116,42,0.08), transparent 60%)` for warmth — mirrors the hero gradient idiom.

---

## 4. Left column — the conversation

### 4.1 Structure

A vertical stack. Top-to-bottom, oldest to newest. Only **one card is "active"** (current question) at a time.

Three states per question:

1. **Upcoming** — not yet revealed. Not rendered.
2. **Active** — full card, serif prompt, input, primary "Continue" button, optional "skip for now" ghost link. Slight elevation (`box-shadow: 0 24px 48px -32px rgba(31,58,53,0.18)`), 1px `--rule` border, `--cream-soft` fill.
3. **Answered** — collapses into a compact *answer chip*: small sans-serif label + the user's answer in serif, with a faint "Edit" pencil on hover. Tapping expands it back to a full active card (and re-locks everything below it until re-confirmed — see §4.5).

### 4.2 Active-card anatomy

```
┌───────────────────────────────────────────────────────┐
│  [ small eyebrow, uppercase: "About you · 2 of 14" ]  │  ← progress, unassertive
│                                                       │
│  Cormorant 40–44 px, weight 500, --forest-deep        │
│  "And roughly how much do you and your household      │
│   spend in a typical year?"                           │
│                                                       │
│  Inter 15 px, --ink-soft, 1 line of reassurance:      │
│  "An honest guess is better than a precise one."      │
│                                                       │
│  ┌─────────────────────────────────────────────┐      │
│  │  €  [ 48,000 ]                              │      │  ← underline input, serif 22 px
│  └─────────────────────────────────────────────┘      │
│                                                       │
│  [ Continue → ]    skip for now                       │
└───────────────────────────────────────────────────────┘
```

- Padding: `36px 40px`, radius `4px` (slightly softer than landing's 2px buttons to feel more inviting).
- Prompt copy: **always a question, always in second person, never a field label**. Examples in §6.
- Helper line: optional. Used for reassurance, context, or a micro-definition. Never for instructions.
- Input: reuse `.calc-input` styling (Cormorant Garamond, 20–22 px, underline only). Currency symbol is a muted prefix inside the input row, not a label.
- Primary button: `.btn-primary` from landing (forest fill, cream text, 2px radius).
- Keyboard: **Enter** submits.
- "skip for now": ghost link only appears where the input is legitimately optional (see field list in §6).

### 4.3 Answer chips

```
 ABOUT YOU · YOUR AGE
 48                                              ✎ edit
 ───────────────────────────────────────────────────
```

- 12px uppercase eyebrow in `--muted`.
- Answer in Cormorant 20px.
- 1px bottom divider.
- Compact, ~44px tall.
- Stack them freely — the column can grow long; that's fine, it reads like a transcript.

### 4.4 Reveal animation

- New active card: `opacity 0 → 1, translateY(12px → 0)` over 320 ms ease-out.
- Card collapse on answer: fade + height transition to chip over 240 ms.
- Never animate the right panel's big number — see §5.3.

### 4.5 Edit-in-place rule

Editing any answered chip revives it as the active card and **invalidates all chips below it** (they grey to 50% opacity via `data-stale="true"`). User must Continue through each again — most will just be Enter-Enter-Enter since values are retained. This prevents stale dependent answers (e.g. changing "Owner" to "Renter" must drop the mortgage answers, which it does via `pruneOrphanedAnswers`).

**Implementation note:** stale entries remain in the persisted answered set with retained field values; a parallel `staleAnswered` set tracks which still need re-confirmation. The walkthrough is not "complete" until `staleAnswered` is empty.

---

## 5. Right column — the live estimate

### 5.1 Layout, top to bottom

1. **Hero number** — "You could stop working at" (Inter 14px, uppercase, `--muted`) over a huge serif age: Cormorant 500, `clamp(96px, 10vw, 144px)`, `--forest-deep`. Tabular numerals.

2. **Delta line** — "That's 9 years earlier than the statutory age of 66." Inter 16px, `--ink-soft`. Hidden until we know both early and statutory ages.

3. **Confidence meter** — 3-dot row: `● ● ○` with a label like "Rough estimate · add 4 more answers to sharpen it." Dots fill as the model gains enough inputs to reduce the assumption cone.

4. **Mini chart** — appears progressively (see §5.2).

5. **Assumptions line** — tiny `--muted` 12px at the very bottom of the panel: "Assuming 5% real returns. You can fine-tune this later." Tappable; scrolls the conversation to the relevant in-chapter assumption question.

### 5.2 Mini-chart staging (three phases)

1. **Hidden** — before Chapter 5 (Savings & Investments). Right panel shows only the hero age, delta, and confidence dots. The space the chart will occupy is *not* reserved — when it appears, the panel grows downward rather than showing an empty rectangle.

2. **Cash-only** — triggered the moment the user answers question 15 (`assets.cash.totalBalance`). Single teal line (`--accent`), soft area fill below, a single "€0" zero-line in `--rule`. X-axis: age ticks every 5 years from current age to 95. No Y-axis labels — hover tooltips give exact numbers. 360ms fade-in.

3. **Cash + net worth** — net-worth line fades in the first time the model produces a non-trivial net-worth series distinct from cash (i.e. after any of: home value, property value, other-asset value, or non-zero equities). Net worth rendered in `--forest` as a lighter-weight 1.5px line *above* the cash area fill. Tiny legend appears: two dots + labels "cash" and "net worth". 360ms cross-fade; cash line does not jump position.

If the user edits backward and removes all net-worth sources, the net-worth line fades out — chart returns to cash-only — but the legend stays, greyed, so the user sees what's no longer there.

### 5.3 Empty / early state

Before the first two numbers come in, the hero number reads "—" with a warm placeholder: *"The age will start to appear as you answer."* No chart. No delta. Just calm.

### 5.4 Live update behavior

- Call `runModel(fieldState, uiState)` (from `src/model/index.ts:36`) on every answer commit, debounced 150 ms.
- **Animate the age change numerically**: tween from old → new integer over 600ms ease-out. Never flash, never jitter mid-typing.
- If `validationMessages` contains blockers, show the age as "—" and a single Inter 14px line in `--amber`: *"One of the numbers needs a second look."* No scary red.
- If the model says retirement is not achievable before 95, show the age as "—" with *"With today's numbers, it's tight. Keep going — the next few questions often move this."* Never show "95" as a depressing result.

---

## 6. Question sequence & dependency logic

The onboarding uses the real calculator field sequence but groups it into **chapters**. Each chapter opens with its own small eyebrow ("About you", "Money coming in", etc.).

**Configurable assumptions are surfaced in the right-panel "Adjust in the full calculator" list, not inline.** An earlier draft of this spec inlined assumption confirmations (property growth, equity returns, rental growth) into their natural chapters. In implementation we found that pattern bloated the transcript and made the early walkthrough feel like a settings dialogue. The shipped design uses defaults silently and lists them under the live estimate so the user sees what's been assumed and where to adjust later, without being asked. **Per-asset** assumptions (e.g. an art collection's appreciation choice) remain inline because they are genuinely per-item rather than global. The legacy 7a/9a/16a/24a/24b rows below are kept for reference but are **not** asked in the conversation.

**Only configurable assumptions are surfaced.** The calculator's model engine hard-codes inflation for some quantities — they track the global inflation rate automatically, with no per-item knob. These are **not** asked in the onboarding, because presenting them as optional would be dishonest. Specifically:

| Quantity | Treatment |
|---|---|
| Dependent cost inflation | Hard-coded — always tracks inflation (`runScenario.ts:484`). |
| State / statutory pension growth | Hard-coded — always tracks inflation (`runScenario.ts:412–420`). |
| Monthly equities contribution | Applied as a flat dollar amount — no inflation adjustment exists in the model (`runScenario.ts:476`). Not surfaced as a choice. |

The **global inflation rate itself** is set in the full calculator (under Advanced Assumptions). The onboarding uses the model's default. If the user wants to change it, the handoff copy in Chapter 10 nudges them toward the full calculator.

**Global vs per-item assumptions.** Where the calculator stores a single shared rate (property growth, rental growth, equity returns), the onboarding asks **once**. Where it stores a rate per item (other-asset appreciation), the onboarding asks **per item**.

### Chapter 1 — *About you*  (essential, ~30 seconds)

| # | Prompt | Field | Type | Notes |
|---|---|---|---|---|
| 1 | "Let's start simple — how old are you?" | `profile.currentAge` | integer | No skip. |
| 2 | "Is there a partner sharing this plan with you?" | `partner.include` | Yes/No | If No, skip 3–4. |
| 3 | "And how old is your partner?" | `partner.profile.currentAge` | integer | Conditional. |
| 4 | "Would you and your partner like to retire early together?" | `partner.retirement.alsoRetiresEarly` | Yes/No | Conditional. Explicitly frames this as *early* retirement together, to avoid ambiguity with statutory retirement which is set separately later. |

### Chapter 2 — *Money coming in*

| 5 | "What's your annual take-home pay from your main job?" | `income.employment.netAnnual` | currency | Helper: "After tax, after pension contributions. Just you — we'll ask about your partner next." Phrasing is deliberately singular ("your") so the answer covers the user only; partner income is captured separately in Q6. |
| 6 | "And your partner's take-home from their main job?" | `partner.income.employment.netAnnual` | currency | Conditional on partner. |

### Chapter 3 — *Money going out*

| 7 | "And roughly how much do you spend in a typical year?" | `spending.livingExpenses.annual` | currency | Helper: "An honest guess is better than a precise one." Offer "I'd rather break it down" → expands into the calculator's categorized spending; otherwise a single number is fine. |
| 7a | *(assumption, inline)* "Most people spend a bit less as they age — less commuting, less going out. Should we taper your spending gently, or hold it steady?" | spending-by-age bundle | taper / hold steady / let me set it | Default: taper gently. |

### Chapter 4 — *Where you live*

| 8 | "Do you own your home, or rent?" | `housing.status` | Owner / Renter | Two large chip buttons, not a dropdown. Dependency branch below. |

**If Owner:**

| 9  | "What's your home worth today, roughly?" | `housing.01Residence.marketValue` | currency | |
| 9a | *(assumption, inline, global)* "And we'll let property values drift up about 2% a year — that rate covers your home, and any investment properties you might add later. Sound right?" | `assumptions.propertyAppreciationRateAnnual` | accept / set a rate | Default 2%. Writes the single global property-growth assumption. Because this is global, it is **not** re-asked per investment property in Chapter 6. |
| 10 | "Is there a mortgage still on it?" | *(derived)* | Yes/No | If No, skip 11–13. |
| 11 | "How much is still owed?" | `housing.01Residence.mortgage.balance` | currency | |
| 12 | "At what interest rate?" | `housing.01Residence.mortgage.interestRateAnnual` | percent | |
| 13 | "And the monthly repayment?" | `housing.01Residence.mortgage.monthlyRepayment` | currency | |
| 14  | "Any plans to downsize one day?" | *(gate)* `downsizingGate` | Yes/No | Skippable; Owner only. If Yes, walks through the four follow-ups below. |
| 14a | "In what year are you thinking?" | `housing.downsize.year` | integer (calendar year) | Validated to be a future year inside the planning horizon. |
| 14b | "Will you buy the new place, or rent it?" | `housing.downsize.newHomeMode` | Buy / Rent | Two chip buttons. Selecting one clears the irrelevant field below. |
| 14c | "Roughly what would the new place cost?" | `housing.downsize.newHomePurchaseCost` | currency | Active only when 14b = Buy. |
| 14d | "And roughly what annual rent?" | `housing.downsize.newRentAnnual` | currency | Active only when 14b = Rent. |

**If Renter:**

| 9 | "What's the monthly rent?" | `housing.rentAnnual` (÷12 converted on commit) | currency | |

### Chapter 5 — *What you've set aside*

| 15 | "How much do you have in liquid savings — current accounts, savings, bonds, term deposits?" | `assets.cash.totalBalance` | currency | Helper: "Everything you could reach within a month or two. Stocks come next." Field tooltip in the calculator already reads "Current and savings accounts, bonds, and term deposits" — this prompt matches. *** Chart appears here (cash-only). *** |
| 16 | "And invested in the stock market — ETFs, funds, pensions?" | `assets.equities.marketValue` | currency | Helper: "Rough total across everything is fine." |
| 16a | *(assumption, inline, global)* "We're assuming those grow around 5% a year above inflation. Change that, or leave it?" | `assumptions.equityReturnRateAnnual` | accept / set a rate | Default 5%. |
| 17 | "Are you adding to that each month?" | `assets.equities.monthlyContribution` | currency | Skippable; defaults to 0. No follow-up inflation question — the model applies the contribution as a flat monthly amount by design. |

### Chapter 6A — *Investment properties* (gated)

Investment properties and other valuables are handled as **separate chapters**, mirroring how the calculator separates them, so the conversation doesn't force unlike things into the same sequence.

| # | Prompt | Field | Type | Notes |
|---|---|---|---|---|
| 18 | "Do you own any investment properties — somewhere you rent out, or plan to?" | *(gate)* | Yes/No | If No, skip to Chapter 6B. |
| 19 | "Let's add the first one. What should we call it?" | `properties.NN.displayName` | text | Friendly name — "London flat", "the cottage". |
| 20 | "What's it worth today?" | `properties.NN.marketValue` | currency | |
| 21 | "Any mortgage or debt against it?" | `properties.NN.mortgage.balance` | currency | Skippable; if entered, follow-up for rate and monthly repayment. |
| 22 | "Roughly what does it bring in each year in rent?" | `properties.NN.rentalIncome` | currency | Skippable (not every property is tenanted yet). |
| 23 | "And what does it cost to run each year — maintenance, management, the bits that don't earn you anything?" | `properties.NN.annualOperatingCost` | currency | Skippable. |

After each property, a soft "Add another property" link appears. **Up to 5 properties** (matches `PROPERTY_GROUPS` in `src/model/inputSchema.ts`).

**Closing the chapter** — once the user declines to add another:

| # | Prompt | Field | Type | Notes |
|---|---|---|---|---|
| 24a | *(assumption, inline, global — asked only if ≥1 property has non-zero `rentalIncome`)* "And we'll assume the rent rises each year with inflation. OK, or would you like a different rate?" | `assumptions.rentalIncomeGrowthRateAnnual` | accept / set a rate | Default: tracks inflation. Asked once globally, not per-property, because the calculator uses a single shared rate. |
| 24b | *(assumption, inline, global — asked **only** if the user is a renter and thus skipped Q9a)* "One last thing: we'll let property values drift up about 2% a year. Sound right?" | `assumptions.propertyAppreciationRateAnnual` | accept / set a rate | Default 2%. If the user is an owner, this was already set at Q9a — do not re-ask. |

### Chapter 6B — *Other things of value* (gated)

| # | Prompt | Field | Type | Notes |
|---|---|---|---|---|
| 25 | "Anything else you'd count — art, a second car, a boat, a collection?" | *(gate)* | Yes/No | If No, skip to Chapter 7. |
| 26 | "What's it called?" | `assetsOfValue.NN.displayName` | text | |
| 27 | "What's it worth today?" | `assetsOfValue.NN.marketValue` | currency | |
| 28 | *(per-asset assumption)* "Is it holding its value, growing, or slowly losing value?" | `assetsOfValue.NN.appreciationRateAnnual` | 3 chip options → `0%` / `+inflation` / `−inflation`, plus "set a specific rate" | Per-asset because the calculator genuinely stores a rate per asset. |
| 29 | "Any debt against it?" | *(related asset-debt field, if present in schema)* | currency | Skippable. |
| 30 | "And anything it costs you each year to keep — insurance, storage, upkeep?" | `assetsOfValue.NN.annualCosts` | currency | Skippable. |

"Add another" soft link after each — **up to 5 other assets** (matches `ASSET_OF_VALUE_GROUPS` in `src/model/inputSchema.ts`).

### Chapter 7 — *People you support*

| 20 | "Anyone you support financially — kids, parents, someone else?" | *(gate)* | Yes/No | |
| 21 | "Who, and roughly what does it cost a year?" | `dependents.01.*` | text + currency + years | Up to 5 slots. No inflation follow-up — the model automatically inflates dependent costs with the global inflation rate (`runScenario.ts:484`), so presenting it as optional would be misleading. |

### Chapter 8 — *The pension that kicks in later*

| 22 | "When does your state or statutory pension start?" | `retirement.statutoryAge` | integer | Helper: "In most places this is somewhere between 65 and 68." |
| 23 | "And roughly how much a year?" | `retirement.statePension.netAnnualAtStart` | currency | Skippable. No inflation follow-up — the model automatically uplifts the pension with the global inflation rate (`runScenario.ts:412–420`). |
| 24 | "What about your partner's?" | `partner.retirement.statePension.netAnnualAtStart` | currency | Conditional + skippable. Same: automatically inflated. |

### Chapter 9 — *Any debts we haven't mentioned?*

Gated Yes/No. If Yes, one loan row at a time (balance, rate, monthly), with an "Add another" soft link after each.

### Chapter 10 — *Handoff*

Final card, different shape (wider, warmer). Copy:

> **"That's the picture. You could stop working at 57."**
>
> "There's more you *can* explore in the full model — stock-market downturns, one-off future events like a downsize or an inheritance, the order we'd sell things in if you needed to. None of it is required."
>
> **[ Take me to the full calculator → ]**  &nbsp;&nbsp;  save and come back later

Primary CTA writes `FieldState` to `localStorage` and navigates to `calculator.html#from=onboarding`.

---

## 7. Dependency-logic implementation note

Reuse `applySectionActivation` from `src/model/activation.ts` to decide which questions are live. The onboarding's own linear sequence layers **on top** of activation — if activation says a field is inactive, the onboarding skips that question entirely rather than asking and discarding.

Order of operations on each commit:

1. Write value into `fieldState`.
2. Run `applySectionActivation` to get the new active set.
3. Advance pointer to the next question in the canonical sequence that is (a) active and (b) not yet answered.
4. Call `runModel` for the right panel.

This keeps the pipeline invariant from `CLAUDE.md` intact — activation → validate → normalize → timing → engine — and means the conversation *cannot* diverge from the real model's visibility rules.

---

## 8. Copy-tone rules

- Always a **question**, never a label. "Your age" → "How old are you?"
- **One** reassurance line maximum per card. Never two.
- No jargon on the first pass. "Net annual household income" → "take-home in a year". The real field name can appear as a tiny tooltip on hover for the curious.
- No exclamation marks. No "Great!". No "Awesome!". The advisor is warm but composed.
- Numbers shown back to the user (in chips, in the estimate) are always formatted with locale separators and currency symbol.
- Skip copy: "skip for now" (lowercase, understated). Never "I don't know" — that shames the user.
- Every assumption question has a sensible default **loaded before the question is asked**, so pressing Enter through the whole onboarding still produces a valid, reasonable projection.

---

## 9. Visual tokens

Reused verbatim from landing so the two pages feel like one product.

### Color

| Token | Hex | Role |
|---|---|---|
| `--cream` | `#f8f2e6` | page bg |
| `--cream-soft` | `#fbf6ec` | active card bg |
| `--paper` | `#fffdf8` | right panel bg (subtle contrast) |
| `--ink` | `#1a2327` | body text |
| `--ink-soft` | `#415058` | helper text |
| `--muted` | `#7d8a90` | eyebrows, meta |
| `--forest` | `#1f3a35` | primary buttons, retirement-age number |
| `--forest-deep` | `#12231f` | headings |
| `--accent` | `#0f766e` | links, the age token itself, cash line |
| `--amber` | `#b2742a` | gentle warnings, hover underline |
| `--rule` | `#e3d9c4` | dividers, input underlines |

### Type

| Role | Family | Size | Weight |
|---|---|---|---|
| Display / prompt | Cormorant Garamond | 40–44 px | 500 |
| Big number | Cormorant Garamond | `clamp(96, 10vw, 144) px`, tabular-nums | 500 |
| Body | Inter | 15–16 px, line-height 1.55 | 400 |
| Eyebrow | Inter | 12 px, uppercase, letter-spacing 0.08em | 500 |
| Input | Cormorant Garamond | 22 px, underline only | 500 |

### Radii & spacing

- Buttons: `2px`
- Cards: `4px`
- Chart area: `6px`
- Spacing rhythm: `8 · 12 · 20 · 32 · 48 · 72 px`

---

## 10. State & persistence

- **Single source of truth:** the same `FieldState` object the calculator uses. No shadow schema.
- Persist on every commit so users can close the tab and resume:
  - Onboarding-specific blob at `etq:onboarding:state:v1` carries `FieldState` plus the `OnboardingUiState` (`answered`, `staleAnswered`, `gates`, `acceptedAssumptions`, `activeQuestionId`). On load this is preferred over the seed.
  - Calculator-compatible draft at `etq:scenario:draft:v2` is written only at handoff or via "save and come back later", so opening the calculator separately doesn't pick up half-finished onboarding state.
- The earlier "UI state is deterministic from FieldState alone" position was abandoned in implementation: gates and assumption-acceptance flags are not derivable from `FieldState`, so they are persisted alongside it.
- On Restart or successful handoff, both keys are cleared.

---

## 11. Edge cases

- **Unreasonable answer** (age 300, negative income): block the Continue button, show the same tone of gentle validation message used in the calculator, never a red banner.
- **Skipping a required field:** not possible — required fields have no "skip for now" link.
- **Editing an early answer that invalidates later ones** (Owner → Renter): later chips animate to 50% opacity, then silently drop when the user reaches them again in the re-walk.
- **Narrow viewport (<960px):** right panel collapses to a sticky top strip showing only the hero age + delta; chart hidden; resume in full layout above 960.
- **Reduced-motion users:** all transitions swap to instant; the age number does not tween.

---

## 12. Accessibility

- Each active card is a `<section aria-labelledby>` with the prompt as its `<h2>`; the conversation list is `<ol>` so screen readers announce position.
- Focus management: on Continue, programmatically focus the next active card's input. On edit, focus the chip's input.
- The big retirement-age number has `aria-live="polite"` with a compact verbal form ("Estimated earliest retirement age: 57") so screen readers don't read every tween frame.
- Full keyboard flow: **Enter** submits, **Shift+Tab** returns to previous chip to edit, **Escape** collapses an edited chip back to its answered state.

---

## 13. Out of scope for v1

Flag these explicitly — surface in the full calculator later if at all:

- **Saving to an account.** There are no accounts yet; the landing page is explicit: "no account".
- **Branching by country.** Statutory pension age is asked directly, not inferred.
- **Multi-scenario comparison on the right.** The onboarding shows one projection only; comparison lives in the full calculator.
- **Stock-market crash scenarios.** These live in the full calculator's *Major Future Events* panel. The handoff copy names them as a reason to continue.
- **Liquidation priority editing.** Default (cheapest-first) is used throughout onboarding. User reorders in the full calculator.
- **Global inflation rate.** The onboarding uses the model default. The user sets this once in the full calculator's Advanced Assumptions; changing it there reshapes every inflation-tracked quantity (dependent costs, pension, rental growth default, property growth default).

---

## 14. Implementation notes (for downstream)

- New file: `onboarding.html` — mirror structure of `calculator.html` (`<div id="app"></div>` + Vite module entry).
- Detect page in `src/main.ts` via `window.location.pathname` and branch to an onboarding render path. Do not duplicate the engine.
- Reuse `.btn-primary`, `.btn-ghost`, `.calc-input`, `.section-eyebrow` styles from landing's inline `<style>` — extract to a shared `landing.css` if preferred, or duplicate in `onboarding.html`'s own `<style>` block. Do not introduce a framework.
- Chart rendering reuses `drawChart` primitives from `src/main.ts`. A thin wrapper produces the single-series (cash) and dual-series (cash + net worth) variants described in §5.2.
- All interactions testable via Playwright using the same `data-*` selector conventions as the rest of the app.

---

*End of spec.*
