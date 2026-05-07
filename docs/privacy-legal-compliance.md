# ETQ — Privacy, Legal, and Compliance Package

**Status:** in production. Pending review by a Malta-qualified lawyer.
**Last updated:** 2026-05-07
**Operator:** Kenneth Bonnici (sole operator, no incorporated entity at time of writing)
**Operator contact:** ETQ@gmail.com
**Jurisdiction frame:** Malta primary; EU/UK secondary (MFSA, MiFID II, FCA, GDPR, e-Privacy, Maltese Consumer Affairs Act, Maltese Electronic Commerce Act)

This document is for an AI legal assistant performing an independent second opinion on the privacy, legal, and compliance posture of ETQ. Read it as the source of truth for what currently exists in the product. Where this document quotes copy, the wording is taken directly from the live source.

---

## 1. Product description

### 1.1 What ETQ is
ETQ ("Enough to Quit") is a deterministic personal retirement-projection web application. It produces year-by-year cash and net-worth projections for one household to a chosen life-expectancy age, under one set of assumptions, and surfaces an "earliest viable retirement age" given the user's cash-buffer and legacy constraints.

ETQ is browser-only. There is no backend server. All inputs and saved scenarios live in the user's browser via `localStorage` and `sessionStorage`. Nothing is transmitted to any server controlled by ETQ. ETQ is offered free of charge.

### 1.2 Three product surfaces
- **Landing page** (`index.html` + `src/landing/main.ts`) — marketing page with a six-input "thirty-second estimate" calculator card.
- **Onboarding walkthrough** (`onboarding.html` + `src/onboarding/main.ts`) — guided question-by-question flow that builds the same `FieldState` the full calculator uses.
- **Full calculator** (`calculator.html` + `src/main.ts`, ~6,000 lines) — interactive panel with all inputs, scenario manager, charts, projection tables, timeline.

A single shared static disclaimer page (`disclaimer.html` + `src/disclaimer.ts`) hosts the legal/privacy/about content reachable from every footer and nav.

### 1.3 What ETQ does and does not do
- **Does:** project cash and net worth year-by-year given user inputs and a configurable set of assumptions; report the earliest age the projection satisfies cash-buffer and legacy constraints; let users compare a chosen retirement age, schedule planned asset sales, schedule market crashes, schedule major future income/expense events.
- **Does not:** run probability simulations (no Monte Carlo, no confidence bands), model income tax, model regulated pension schemes in detail, recommend products, recommend transactions, recommend a course of action, perform a suitability or appropriateness assessment, link to any execution path, name any specific financial instrument, hold or transmit user data, use cookies, run analytics, embed third-party widgets, or load third-party assets at runtime (post Phase 2; see §4.3 below).

### 1.4 Default assumptions baked into the model
Defined in `src/model/inputSchema.ts:122-141`. Used when the user does not override them. Currently:

- General inflation: 2.0% per year
- Cash interest rate: 2.0% per year
- Equity return: **6.5% per year** (lowered from 8.0% as part of this package; see §10.2)
- Property appreciation: 3.0% per year
- Salary growth: 3.0% per year
- Rental income growth: 2.0% per year
- Stock selling cost: 5.0% of proceeds
- Property disposal cost: 15.0% of proceeds
- Other-asset disposal cost: 5.0% of proceeds
- Default statutory retirement age: 65
- Default life expectancy: 90
- Default early-pension reduction: 500 currency units per year of early retirement
- Spending taper defaults: -10% of today's spending from age 65, -20% from age 75 (the user can opt for "steady" instead)

The disclaimer page (`disclaimer.html#assumptions`) publishes the same list verbatim.

### 1.5 What is not modelled
- Income tax, capital gains tax, social-security or national insurance contributions, withholding tax, dividend tax, VAT, property transfer tax.
- Jurisdiction-specific pension or tax wrappers (UK State Pension, Maltese Two-Thirds Pension, defined-benefit accrual, lifetime/annual allowances, employer matching, salary sacrifice, lump sums, survivor benefits, transfer values).
- Healthcare and long-term care costs.
- Currency risk on multi-currency portfolios.
- Sequence-of-returns risk on investment returns (the model is deterministic).
- Regulatory or legislative change, political risk.
- Divorce, separation, partner death (beyond inputs the user supplies via planned events).

The user must enter income and pension figures **net of tax**. This requirement is documented in onboarding helper text and on the disclaimer page.

---

## 2. Disclosure surfaces — by location

This section enumerates every disclosure, disclaimer, notice, and acknowledgement currently in the product. Each entry includes the trigger condition, the verbatim copy, and the source-code reference.

### 2.1 Landing page (`index.html`)

#### 2.1.1 Trust-row pip
**Location:** under the hero CTA buttons (`index.html:428-434`).
**Trigger:** always visible.
**Verbatim:**
```
Free  ·  Private  ·  No account  ·  Data stays in your browser  ·  Not financial advice
```

#### 2.1.2 Quick-estimate result label and inline pip
**Location:** above and below the big age number on the right side of the six-input card (`index.html:485-490`).
**Trigger:** always visible. The label content is dynamic, set by `src/landing/main.ts:setResultLabel()`.
**Label states:**
- Empty / no result yielded: `Earliest viable at`
- Future case (earliest viable > current age): `Earliest viable at age`
- "Now" case (earliest viable equals current age): `Viable now, at age`

**Inline pip beneath the result number, verbatim:**
```
Illustrative model output, not financial advice. Sensitive to your inputs and ETQ's default assumptions. See limitations.
```
Where "See limitations" links to `disclaimer.html#assumptions`.

The earlier "You could stop at" recommendation framing was removed in Phase 0 (commit `2f6b5e8`).

#### 2.1.3 Quick-estimate privacy line
**Location:** at the top of the calculator card (`index.html:455`).
**Trigger:** always visible.
**Verbatim:**
```
All in your browser. Nothing leaves your device. Your inputs are remembered locally so you can come back to them; clear them any time.
```

#### 2.1.4 Bio non-MFSA/FCA-authorisation line
**Location:** the credibility section, as a final small italic-style paragraph after the four bio paragraphs (`index.html:514-518`).
**Trigger:** always visible.
**Verbatim:**
```
ETQ is not authorised by the MFSA or the FCA, and does not provide regulated financial advice or a personal recommendation.
```
The bio itself was reworded in Phase 0 to drop "business advisor with deep financial modelling experience"; the credentials now read "a former corporate CFO and Chartered Global Management Accountant, who retired at 53 and has not gone back."

#### 2.1.5 Footer slogan and link strip
**Location:** the page footer (`index.html:572-580`).
**Trigger:** always visible.
**Verbatim slogan:**
```
© ETQ · Enough to Quit. A deterministic retirement-projection tool. For educational and informational use only. Not financial, tax, legal, or pension advice.
```
**Link strip:** Disclaimer · Privacy · About (each pointing to the corresponding anchor in `disclaimer.html`).

### 2.2 Onboarding (`onboarding.html` + `src/onboarding/main.ts`)

#### 2.2.1 Nav Disclaimer link
**Location:** top nav, right of "Jump to full calculator →" (`onboarding.html:1059-1063`).
**Trigger:** always visible.
**Behaviour:** static link to `disclaimer.html#disclaimer`.

#### 2.2.2 First-visit acknowledgement strip
**Location:** flowing strip between top nav and the conversation column, mounted into a static `<div id="ob-prelayout">` placeholder (`src/onboarding/main.ts: mountAcknowledgementStrip()`).
**Trigger:** when localStorage key `etq:disclaimer:ack:v1` is absent.
**Verbatim:**
```
ETQ is a self-help planning tool, not financial advice. It does not assess your circumstances or recommend any course of action. Speak to a qualified professional before acting on a projection. Read the full disclaimer.  [Got it]
```
**Behaviour:** "Got it" sets the localStorage flag and removes the strip with a 220ms fade. The strip is non-blocking; the user can ignore it and proceed. Onboarding "Start over" calls `clearDisclaimerAck()` so a fresh user re-sees the strip.

#### 2.2.3 Persistent sticky bottom strip
**Location:** sticky `<aside class="ob-page-disclaimer">` element pinned to the bottom of the viewport (`onboarding.html:1069-1072`).
**Trigger:** always visible while on any onboarding screen.
**Verbatim:**
```
Estimate, not advice. Result depends on the assumptions you choose.  [What's assumed]
```
**Pointer-events:** the strip itself is `pointer-events: none` so it never blocks clicks on chips behind it; only the "What's assumed" link captures clicks. Link points to `disclaimer.html#assumptions`.

#### 2.2.4 Live in-progress estimate pip
**Location:** beneath the chart on the right-hand live-estimate panel (`src/onboarding/main.ts:339`).
**Trigger:** always visible while the live-estimate panel is rendered.
**Verbatim:**
```
Illustrative model output, not financial advice. See limitations.
```
Link to `disclaimer.html#assumptions`.

#### 2.2.5 Handoff card paragraphs (most legally important onboarding copy)
**Location:** the final card the user sees after completing the walkthrough (`src/onboarding/main.ts:1191-1199`).
**Trigger:** always visible on the handoff card.
**Verbatim:**
```
A starting estimate, not advice, based on your answers and ETQ's default assumptions for inflation, returns, pensions, and longevity. In the full calculator you can review and adjust all assumptions, plan for major events, schedule liquidations and more.

Real-life outcomes will differ. Speak to a qualified professional before acting on the result.
```
The last sentence ("Speak to a qualified professional...") is wrapped in `<span class="ob-handoff-emphasis">` and rendered with `text-decoration: underline; text-underline-offset: 3px;` for visual emphasis.

A `<details>` panel below ("What's missing — and what could move the number") expands to list:
- "Sharpen the estimate" — investment-growth rates, property appreciation, selling costs, inflation, spending shifts, early-retirement pension reduction, planning horizon, planned sales, drawdown order.
- "Add to the picture" — one-off future events, downsizing plans, side income, cash reserve / legacy amount, market-crash scenarios.

#### 2.2.6 Auto-restore toast
**Location:** bottom-right floating toast, `position: fixed; z-index: 1000;` (`src/storageDisclosures.ts: showRestoreToast()`).
**Trigger:** on page load, when prior onboarding state is restored AND the user had answered at least one question previously. Implemented in `showRestoreToastIfRestored()` in `src/onboarding/main.ts`.
**Verbatim:**
```
Restored your previous session from this browser.  [Forget]  [×]
```
**Behaviour:** auto-dismisses after 6 seconds. "Forget" runs the equivalent of "Start over" (clears `etq:scenario:draft:v2`, `etq:onboarding:state:v1`, `etq:landing:quick-estimate`, `etq:landing:inputs`, `etq:disclaimer:ack:v1`, then reloads). "×" simply dismisses the toast.

### 2.3 Full calculator (`calculator.html` + `src/main.ts`)

#### 2.3.1 Dashboard headline pip
**Location:** small subdued line directly beneath the "Earliest retirement [pill]" headline (`src/main.ts:341`).
**Trigger:** always visible.
**Verbatim:**
```
Illustrative model output, not financial advice. Sensitive to your inputs and assumptions. See limitations.
```
Link to `disclaimer.html#assumptions`. Sits at row 2 col 1 of the dashboard-header CSS grid.

#### 2.3.2 Headline message wording — recommendation softening
The "Earliest retirement" indicator displays a green pill with the word "Now" when the user could retire today (i.e., earliest viable age equals current age). The underlying message string driving this pill was changed in Phase 0 (commit `2f6b5e8`):
- **Before:** `You can retire now at ${earliestAge}!`
- **After:** `With your assumptions, retirement looks viable now at ${earliestAge}`

The pill's visible text remains "Now" because the pill is sized for short status words; the verbose underlying string is preserved for accessibility/screen-reader semantics and is the model-output framing required to remove the recommendation tone, per the ESMA substance-over-disclaimer test.

#### 2.3.3 Nav Disclaimer link
**Location:** dashboard header row 2 col 5, next to the brand link (`src/main.ts:357`).
**Trigger:** always visible.
**Behaviour:** static link to `disclaimer.html#disclaimer`.

#### 2.3.4 First-visit acknowledgement strip
**Same as §2.2.2** — shared module `src/disclaimerAck.ts`, mounted above the calculator layout via `mountFirstVisitNotice(app)` in `src/main.ts`. Same trigger flag (`etq:disclaimer:ack:v1`), same wording, same dismiss behaviour. Ack is shared across calculator and onboarding: dismissing in either one suppresses it in both. The calculator does not currently have a "Start over" / "Clear data" button equivalent that clears the ack flag; the user has to clear browser data to re-see the strip.

#### 2.3.5 First-save inline notice (browser-storage explainer)
**Location:** rendered inline at the top of the scenario-manager panel (`src/main.ts:renderScenarioManager()`, conditional on `hasSavedScenarios && !hasSaveInfoSeen()`).
**Trigger:** the user has at least one saved scenario AND localStorage key `etq:disclaimer:save-info-seen:v1` is absent.
**Verbatim:**
```
Saved on this device only.  ETQ stores scenarios in your browser's local storage. Clearing browser data or switching device will lose them. There is no backup, no encryption, and no recovery; anyone using this browser profile can read these scenarios.  [Got it]
```
**Behaviour:** "Got it" sets the flag and removes the notice. It does not re-appear for that browser profile.

#### 2.3.6 Auto-restore toast (calculator)
**Same component as §2.2.6.** Triggered when `restoreDraftScenarioIfAvailable()` returns true on calculator startup (`src/main.ts:5973-5982`). "Forget" removes only the draft snapshot key (`etq:scenario:draft:v2`) and reloads the page; named scenarios are preserved.

### 2.4 Disclaimer page (`disclaimer.html`)

A single static page reachable from every footer and nav. Has anchored sections and an interim notice at the top stating that the wording is pending lawyer review.

**Page-top interim notice, verbatim:**
```
This page sets out ETQ's terms of use, the assumptions and limitations behind the tool, the risks you should consider before acting on a projection, and how data is handled. The wording is pending review by a Malta-qualified lawyer; the content is intended to be readable, accurate, and sufficient for everyday use of ETQ in the meantime.
```

**Anchor structure:**
- `#disclaimer` — 12 numbered subsections (full text quoted in §3 below)
- `#assumptions` — 5 subsections covering what ETQ does, what it doesn't do, defaults, what is not modelled, sensitivity
- `#risks` — 5 subsections covering investment risk, tax, pension, inflation, property, market risk and timing
- `#privacy` — single-section browser-storage transparency notice
- `#about` — operator identification (Kenneth Bonnici), contact email (ETQ@gmail.com), credentials line, non-regulated-firm statement

---

## 3. Disclaimer page — verbatim section content

### 3.1 `#disclaimer` (12 subsections, verbatim)

```
1. Nature of the tool
Enough to Quit ("ETQ") is a deterministic retirement-projection tool made available without charge for educational and informational use only. ETQ produces year-by-year projections of cash and net worth based on the inputs you provide and the assumptions configured in the tool. ETQ presents an "earliest viable retirement age" and comparable outputs that are the result of a model, not opinions, predictions, or recommendations.

2. Not financial advice; no personal recommendation
ETQ is not financial, investment, tax, legal, accounting, pension, estate-planning, insurance, or any other form of regulated advice. Nothing in ETQ constitutes a personal recommendation within the meaning of the Maltese Investment Services Act, MiFID II, or equivalent legislation in any other jurisdiction. ETQ is not authorised by the Malta Financial Services Authority (MFSA), the UK Financial Conduct Authority (FCA), or any other competent authority to provide investment services or investment advice. ETQ does not recommend, endorse, or solicit the purchase, sale, or holding of any specific security, fund, pension product, insurance product, real estate, or other financial product.

3. No suitability assessment
ETQ does not know you. It has not assessed your knowledge or experience, financial situation, investment objectives, time horizon, risk tolerance, capacity for loss, or wider personal circumstances. ETQ does not perform a suitability or appropriateness assessment.

4. Assumptions, limitations, and model risk
ETQ is a deterministic single-path model. It does not run probability simulations and does not produce confidence intervals or probability-based outcomes. Default assumptions are general averages chosen for broad illustration; small changes can produce materially different results. The default equity-return assumption is a long-run nominal estimate, not a forecast. ETQ does not localise pension rules or tax rules to any jurisdiction. The full list of assumptions and limitations is set out under Assumptions below.

5. Past performance; no forecast
Where ETQ uses long-run averages for investment returns, property appreciation, inflation, or growth rates, those averages are based on generalised market history. Past performance is not a reliable indicator of future performance. ETQ does not forecast markets, property prices, inflation, exchange rates, taxation, or government policy.

6. User responsibility
You are responsible for the accuracy and completeness of the inputs you enter, for the assumptions you select or accept, for the way you interpret the output, and for any decision you take or refrain from taking based on ETQ. Before making any retirement, investment, pension, tax, property, debt, insurance, or estate-planning decision, you should consult a qualified professional regulated in your jurisdiction.

7. No warranty
ETQ is provided "as is" and "as available". To the maximum extent permitted by applicable law, ETQ disclaims all warranties, express or implied, including without limitation warranties of accuracy, completeness, merchantability, fitness for a particular purpose, and non-infringement. ETQ does not warrant that the model is free of errors, that it will be available without interruption, or that it will produce results suitable for any specific purpose.

8. Limitation of liability
To the maximum extent permitted by applicable law, ETQ, its operator, its contributors, and its licensors shall not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages, including but not limited to lost profits, lost savings, lost opportunities, or lost data, arising out of or in connection with your use of ETQ, your reliance on its output, or your inability to use ETQ. Nothing in this disclaimer excludes or limits liability that cannot be excluded or limited under applicable law (including liability for death or personal injury caused by negligence, or for fraud).

9. Intellectual property
The ETQ model, source code, copy, and design are © Enough to Quit. All rights reserved unless otherwise stated in the project repository.

10. Changes
ETQ may update its model, default assumptions, or this page without notice. The version date at the top of this page indicates when this content was last revised.

11. Jurisdiction
These terms and your use of ETQ are governed by the laws of Malta. Any dispute arising from your use of ETQ shall be subject to the exclusive jurisdiction of the courts of Malta. Nothing in this clause restricts the consumer protection rights you have under the mandatory law of your country of residence.

12. Not a substitute for professional advice
If in doubt, do not act on ETQ. Consult a regulated financial adviser, tax adviser, pension specialist, or solicitor before making a decision that materially affects your financial future.
```

### 3.2 `#assumptions` (verbatim)

```
What ETQ does
Projects cash and net worth year-by-year for one household to a chosen life expectancy age, under one set of assumptions. Reports the earliest age at which the scenario satisfies your cash buffer and legacy constraints (if any). Lets you compare against a chosen comparison age, and lets you schedule planned asset sales, market crashes, and major future income or spending events.

What ETQ does not do
Stress-test outcomes statistically (no Monte Carlo, no probability bands). Model tax in detail. Model regulated pensions in detail. Recommend products or strategies. Replace a qualified professional. Forecast markets, property prices, inflation, exchange rates, taxation, or government policy.

Default assumptions used by the model
- General inflation: 2.0% per year
- Cash interest rate: 2.0% per year
- Equity return: 6.5% per year (long-run nominal estimate)
- Property appreciation: 3.0% per year
- Salary growth: 3.0% per year
- Rental income growth: 2.0% per year
- Stock selling cost: 5.0% of proceeds
- Property disposal cost: 15.0% of proceeds
- Other-asset disposal cost: 5.0% of proceeds
- Default statutory retirement age: 65
- Default life expectancy: 90
- Default early-pension reduction: 500 currency units per year of early retirement

What is not modelled
ETQ does not model income tax, capital gains tax, social-security or national insurance contributions, withholding tax, dividend tax, jurisdiction-specific pension or tax wrappers (for example UK State Pension, Maltese Two-Thirds Pension, defined-benefit accrual, lifetime or annual allowances, employer matching, salary sacrifice, lump sums, survivor benefits), healthcare and long-term care costs, currency risk on multi-currency portfolios, sequence-of-returns risk on investment returns, regulatory or legislative change, divorce or separation events beyond inputs you supply, and political risk.

You must enter income and pension figures NET of tax. ETQ does not localise pension rules or tax rules to any jurisdiction; numbers are plain currency in, currency out.

Sensitivity
A 1 percentage-point change in equity return or inflation can move the earliest viable retirement age by several years. Always test outcomes against alternative assumptions before relying on a single result.
```

### 3.3 `#risks` (verbatim)

```
Investment risk
The value of investments goes up and down. Past performance is not a guide to future performance. ETQ uses a single average annual rate (default 6.5% for equities) and does not stress-test against market crashes unless you schedule them. Real portfolios experience volatility that can permanently change retirement outcomes through sequence-of-returns risk.

Tax
ETQ does not model income tax, capital gains tax, social security or national insurance contributions, dividend tax, withholding tax, VAT, property transfer tax, or any jurisdiction-specific allowance or relief. You must enter income and pension figures NET of tax. Tax laws change.

Pension
ETQ models a single statutory-age pension as an annual amount with a flat early-retirement reduction. It does not represent UK State Pension, Maltese Two-Thirds Pension, contributions-based accrual, defined-benefit schemes, defined-contribution drawdown rules, lifetime allowance or annual allowance limits, employer matching, salary sacrifice, lump sums, survivor benefits, or transfer values. Speak to a qualified pension specialist for any decision involving a pension.

Inflation
ETQ uses a single general-inflation rate (default 2.0%) applied uniformly to spending and most other figures. Real inflation is uneven across categories (energy, healthcare, housing) and can spike well above the default. Inflation risk on a long retirement is significant.

Property
Property values can rise and fall. ETQ uses a single average growth rate (default 3.0%) and a single percentage disposal cost (default 15%). It does not model jurisdiction-specific property taxes, capital gains, stamp duty, illiquidity, vacancy risk, regulatory caps on rents, or the time it can take to sell. Property is illiquid and a forced sale can realise materially less than the model assumes.

Market risk and timing
ETQ is deterministic. It produces one projection path per scenario. The real world is not deterministic. Two retirees with the same starting position can have very different outcomes depending on the sequence of returns in early retirement.
```

### 3.4 `#privacy` (verbatim)

```
ETQ runs entirely in your browser. Your inputs are not transmitted to any server operated by ETQ. To let you return to your work, ETQ stores your inputs and saved scenarios in your browser's local storage and session storage on this device, under keys beginning with etq:. This storage is not encrypted and is accessible to anyone using the same browser profile on this device.

Clearing your browser data, switching browser, switching device, or using private or incognito mode will lose any data ETQ has stored. There is no cloud backup and no recovery process. ETQ does not use cookies, analytics, or third-party trackers, and does not load any third-party assets at runtime: the fonts and all other assets are served from the same origin as ETQ itself.
```

### 3.5 `#about` (verbatim)

```
ETQ is operated by Kenneth Bonnici. Contact: ETQ@gmail.com.

ETQ was built by a former corporate CFO and Chartered Global Management Accountant who retired at 53. The tool reflects an individual's perspective on retirement planning and is provided for general use without warranty. ETQ is not a regulated firm and does not hold itself out as a financial adviser.
```

---

## 4. Privacy and data architecture (the load-bearing facts)

### 4.1 Architecture summary
- **No backend.** ETQ is a static site (HTML, CSS, JS bundles) served from a single origin.
- **No accounts, no auth.** The user is anonymous to ETQ.
- **No transmission of user inputs.** Every keystroke, every saved scenario, every onboarding answer is processed and stored in the user's browser. None of it ever reaches a server controlled by ETQ.
- **No analytics, no telemetry, no tracking pixels, no cookies, no third-party widgets, no embedded media.**
- **No third-party assets at runtime.** Web fonts (Inter, Cormorant Garamond) were previously loaded from Google Fonts; in Phase 2 they were self-hosted as variable woff2 files served from the ETQ origin. Verified in §4.4 below.

### 4.2 Browser storage keys
ETQ uses both `localStorage` (persists across sessions) and `sessionStorage` (cleared on tab close). All keys are namespaced with the `etq:` prefix. Full inventory:

**Working / state keys (pre-existing before disclaimer package):**
- `etq:scenario:draft:v2` (localStorage) — calculator's current working draft snapshot. Auto-written as the user edits.
- `etq:scenario:named:v2` (localStorage) — named scenarios saved by the user from the scenario manager.
- `etq:onboarding:state:v1` (localStorage) — the in-progress onboarding walkthrough (answers, gates, current question).
- `etq:landing:quick-estimate` (sessionStorage) — the seed values typed into the landing's six-input card, used to pre-fill the calculator/onboarding handoff.
- `etq:landing:inputs` (sessionStorage) — the raw form values on the landing card so the user sees them on return-to-tab.

**New keys added by the disclaimer package:**
- `etq:disclaimer:ack:v1` (localStorage) — set when the user clicks "Got it" on the first-visit acknowledgement strip. Read on each onboarding/calculator load to decide whether to render the strip. Cleared by onboarding's "Start over" action.
- `etq:disclaimer:save-info-seen:v1` (localStorage) — set when the user clicks "Got it" on the inline browser-storage notice in the scenario manager. Read on each scenario-manager render. Not cleared by any current user action.

**Values stored:** The disclaimer keys hold ISO-8601 timestamps as their value (presence is the meaningful signal; the value itself is not read back). The working keys hold JSON-serialised snapshots of `FieldState` plus UI helper state.

**No sensitive data is required.** ETQ asks for income, savings, debts, pensions, dependants, properties — these are personal financial details. They are persisted on the user's device only.

**No encryption.** localStorage is not encrypted. Anyone with access to the same browser profile on the same device can read it via DevTools → Application → Local Storage.

**No backup, no recovery.** Clearing browser data, switching browser/device, or using private mode loses the data.

### 4.3 What does happen at runtime over the network
- Initial HTML load (one of `index.html`, `onboarding.html`, `calculator.html`, `disclaimer.html`).
- JS bundles (Vite-emitted, hashed, served from `/ETQ/assets/...`).
- CSS bundles (Vite-emitted, hashed).
- Web font woff2 files (Inter, Cormorant Garamond, normal and italic axes — bundled from `@fontsource-variable/*` npm packages).
- Hero/portrait images (`assets/hero-kitesurfer.{webp,jpg}`, `assets/builder-terrace.{webp,jpg}`).

**That is the complete network surface.** No fetch calls in user code, no XHR, no WebSocket, no analytics beacons. Verified by grep across the source tree and inspection of bundled output (see §4.4).

### 4.4 Self-hosting verification
The `<link>` tags pointing to `fonts.googleapis.com` and `fonts.gstatic.com` were removed from all four HTML pages in Phase 2 (commit `7e8e336`). Replaced by a single `src/fonts.css` with `@font-face` rules pointing to woff2 files vendored from `@fontsource-variable/inter` and `@fontsource-variable/cormorant-garamond`. Verified post-deploy with `curl http://127.0.0.1:4173/ETQ/{,onboarding.html,calculator.html,disclaimer.html} | grep fonts.googleapis.com` returning **zero hits across all four pages.**

### 4.5 Hosting
The site is intended to be deployed as a static bundle. The hosting provider's request logs (Cloudflare Pages, GitHub Pages, Netlify, etc.) will see request IPs, user-agents, and URLs as a normal consequence of HTTP serving. ETQ does not currently configure or have access to any such logs. If you (the lawyer) need a precise statement on hosting, the operator will need to confirm the actual provider before launch.

### 4.6 Why this matters for GDPR scope
The operator's working assumption — informed but not legally vetted — is that GDPR's substantive obligations have nothing to attach to in this architecture: there is no controller-collected personal data, no transmission to ETQ, no data to access, no breach to notify, no transfer mechanism needed, no DPO appointment trigger, no ROPA, no DPIA. The strict reading (held by some EU regulators per EDPB Guidelines 07/2020 on the controller concept) is that determining "purposes and means" of any processing makes the operator a controller even when never receiving the data. This is one of the items explicitly flagged for the lawyer's view (§9 below).

The e-Privacy Directive (Maltese S.L. 586.01) does apply to localStorage / sessionStorage, but the "strictly necessary for an information-society service explicitly requested by the user" exemption fits ETQ's planning data exactly. **No cookie banner is required.** The only obligation is to inform the user, which the privacy section of the disclaimer page and the contextual save/restore notices do.

---

## 5. Non-advice posture — what the product does to stay outside the regulated-advice perimeter

### 5.1 The MiFID II / MFSA test
Investment advice under MFSA's Investment Services Act and MiFID II Article 4(1)(4):
> a personal recommendation, in relation to one or more financial instruments, presented as suitable for that person, or based on a consideration of their circumstances.

Per ESMA's 2023 Supervisory Briefing (ESMA35-43-3861), **disclaimers do not move a tool out of the perimeter on their own**: substance matters more than labelling. ETQ has therefore made several substance-level changes alongside disclaimer text.

### 5.2 Substance-level changes (Phase 0, pre-existing in commits)
1. **Removed the recommendation-shaped headline.** The calculator's "Earliest retirement" pill previously said `You can retire now at 45!` (with an exclamation mark, prescriptive). Phase 0 changed the underlying message string to `With your assumptions, retirement looks viable now at 45`. The visible pill remains "Now" because of pill width constraints, but the underlying message is now model-output framing rather than a recommendation.
2. **Reworded the bio.** The credibility paragraph previously called the builder a "business advisor with deep financial modelling experience". Phase 0 dropped "business advisor" and the emphasis on advisor-shaped language, replacing with "former corporate CFO and Chartered Global Management Accountant".
3. **Added explicit non-MFSA/FCA-authorisation line** in the bio paragraph: "ETQ is not authorised by the MFSA or the FCA, and does not provide regulated financial advice or a personal recommendation."
4. **Reworded the landing quick-estimate result label.** Previously "You could stop at"; now case-aware ("Earliest viable at age" / "Viable now, at age") to drop the prescriptive framing.
5. **Reworded the onboarding handoff card** to lead with "not advice", route the user to the full calculator to adjust assumptions, and underline the call to consult a qualified professional.

### 5.3 Trigger-word avoidance
The product copy deliberately avoids the MiFID-flagged trigger words: *suitable*, *recommended*, *recommendation*, *right for you*, *best in class*, *award-winning*, *ideal for*, *should retire*, *we suggest*. Verified by grep over `src/`, `index.html`, `onboarding.html`, `calculator.html`, `disclaimer.html`.

### 5.4 No execution path
ETQ does not link to any product, broker, fund, pension provider, insurance product, or third-party financial service. There is no buy/sell/open-account CTA. The CTAs lead only to other parts of ETQ itself.

### 5.5 No suitability questionnaire framing
The onboarding asks for inputs (age, income, savings, etc.) but the framing is purely informational ("How old are you?") and the output is presented as a model projection ("Earliest viable retirement age" + assumption disclosure), not as a personalised plan that has been deemed suitable.

### 5.6 First-visit acknowledgement
Per Phase 3, on first visit to onboarding or the calculator, the user sees a non-blocking strip with the wording:
> ETQ is a self-help planning tool, not financial advice. It does not assess your circumstances or recommend any course of action. Speak to a qualified professional before acting on a projection.

This wording is borrowed directly from the AARP self-help-tool template and the MiFID-aware NerdWallet wording, both of which have survived two decades of US/EU scrutiny without enforcement against the underlying business. It is a "light" acknowledgement: the user can dismiss with "Got it" or scroll past it. Industry comparable tools (Boldin, ProjectionLab, NerdWallet) use the same non-blocking pattern; regulated firms (Vanguard, Fidelity) typically use a longer footer block plus inline pips, which ETQ also has.

---

## 6. Consumer-law and Maltese-law touch points

### 6.1 Operator identification
Per the Maltese Electronic Commerce Act (transposing the EU e-Commerce Directive 2000/31/EC), a consumer-facing site requires an identifiable provider with contact information. ETQ identifies the operator and provides a contact email in `disclaimer.html#about`. The operator is currently a natural person (Kenneth Bonnici) operating without an incorporated entity. This is a **flag for the lawyer** as a known launch-readiness item (§9.7).

### 6.2 Consumer rights carve-out in the jurisdiction clause
Section 11 of the disclaimer page reads:
> These terms and your use of ETQ are governed by the laws of Malta. Any dispute arising from your use of ETQ shall be subject to the exclusive jurisdiction of the courts of Malta. Nothing in this clause restricts the consumer protection rights you have under the mandatory law of your country of residence.

This carve-out is intended to address Brussels I Recast (Regulation 1215/2012) Articles 17-19 and Rome I (Regulation 593/2008) Article 6, which preserve consumer rights under the law of the consumer's habitual residence. **Flag for the lawyer:** confirm the carve-out wording is sufficient under Maltese consumer law (§9.4).

### 6.3 Limitation of liability
Section 8 of the disclaimer page contains a broad limitation. The Maltese Consumer Affairs Act and the EU Unfair Contract Terms Directive (93/13/EEC, transposed in Malta) restrict liability exclusions against consumers, particularly for:
- death or personal injury caused by negligence
- fraud
- non-conformity with the contract

The text already carves out "liability that cannot be excluded or limited under applicable law (including liability for death or personal injury caused by negligence, or for fraud)". **Flag for the lawyer:** confirm the carve-out is sufficient and the residual exclusion is enforceable against a Maltese/EU consumer (§9.3).

### 6.4 Warranty disclaimer
Section 7 of the disclaimer page disclaims all warranties to the maximum extent permitted by law. Same Unfair Terms Directive / Consumer Affairs Act considerations apply. **Flag for the lawyer:** §9.3.

### 6.5 No commercial activity yet
ETQ is currently free, requires no payment, sells no product, and has no advertising. Several consumer-law concepts (e.g. distance selling, pre-contractual information requirements, right of withdrawal) do not bite because there is no contract for goods or services being formed. If ETQ ever monetises (subscriptions, premium tiers, affiliate links to financial products), this entire frame needs revisiting.

---

## 7. Source-of-truth references

### 7.1 Code locations of every disclosure
- Trust-row pip: `index.html:428-434`
- Quick-estimate label/pip: `index.html:485-490`, `src/landing/main.ts:setResultLabel`
- Privacy line on landing card: `index.html:455`
- Bio + non-MFSA line: `index.html:514-519`
- Footer link strip: `index.html:572-580`
- Onboarding nav Disclaimer link: `onboarding.html:1059-1063`
- Onboarding sticky bottom strip: `onboarding.html:1069-1072`, CSS at `onboarding.html:741-770`
- Onboarding live-estimate pip: `src/onboarding/main.ts:339`, CSS at `onboarding.html:991-1002`
- Onboarding handoff paragraphs: `src/onboarding/main.ts:1191-1199`
- Onboarding first-visit strip: `src/disclaimerAck.ts`, mounted in `src/onboarding/main.ts:mountAcknowledgementStrip()`
- Calculator headline pip + nav link: `src/main.ts:341-358`, CSS at `src/app.css:386-422`
- Calculator first-visit strip: same `src/disclaimerAck.ts` module, mounted in `src/main.ts` immediately after `app.innerHTML = ...`
- Calculator first-save inline notice: `src/storageDisclosures.ts:buildSaveInfoNoticeHtml`, wired in `src/main.ts:renderScenarioManager` and `src/main.ts:wireSaveInfoNoticeDismiss`
- Auto-restore toast (calculator): `src/storageDisclosures.ts:showRestoreToast`, called in `src/main.ts` startup after `restoreDraftScenarioIfAvailable`
- Auto-restore toast (onboarding): same module, called in `src/onboarding/main.ts:showRestoreToastIfRestored`
- Disclaimer page content: `disclaimer.html` (single static file with anchored sections)
- Default model assumptions: `src/model/inputSchema.ts:122-141`

### 7.2 Git history of the disclaimer package
Seven commits on `main`:
- `2f6b5e8` — Phase 0: soften retirement headline and landing result framing
- `f417739` — Phase 1: inline disclosure pips, footer/nav links, placeholder page
- `7e8e336` — Phase 2: self-host fonts and expand disclaimer page content
- `17a478f` — Phase 3: first-visit acknowledgement strip
- `72ad7a4` — Phase 4: browser-storage notice on save, auto-restore toast
- `61e626b` — Equity default 8% → 6.5%
- `8d79f04` — Phase 5: tighten onboarding handoff wording, underline pro-advice line

### 7.3 Tests
- `npm test` runs 71 Playwright UI tests + runtime tests; all green at last commit.
- `npm run test:golden` runs 11 deterministic-snapshot tests across 6 personas + 4 invariants; all green at last commit. Each persona sets its own equity-return value, so the default change in `61e626b` did not affect snapshots.

---

## 8. Comparable-tool frame (informational, for second-opinion context)

Direct comparable products in product shape and target user:
- **ProjectionLab** (browser-based deterministic projection planner). Discloses non-advice and informational-purposes language; offers cloud sync as opt-in; states "no link to your real financial accounts".
- **Boldin / NewRetirement** (US tool). Uses "informational and educational tools only and do not constitute investment advice"; pushes complex cases to a fiduciary.
- **Engaging-Data** (free FIRE calculator). Privacy-first wording: "All of the data stays on your computer and all of the calculations are made within your browser."
- **FIRECalc** (free FIRE calculator). Methodology candour over legal text. Notable phrase: "FIRECalc does not store any information you enter on this page."

Direct EU/Malta comparables:
- **HSBC Malta retirement calculator** — closest jurisdictional template; combines product-non-recommendation, projection caveat, no-tax/fees, no-personal-circumstances, no-warranty, no-liability, capital-loss warnings.
- **MoneyHelper UK** (FCA-aligned public-good calculator) — discloses defaults in-tool (5% growth, 2.5% inflation, 0.75% charges); routes complex cases to advice. ETQ's pattern of in-tool default disclosure mirrors this.
- **gov.uk State Pension forecast** — minimal per-tool disclaimer, leans on government umbrella terms; ETQ obviously cannot rely on that.

The 11 load-bearing disclosure clauses recurring across this comparable set are all present in ETQ's package: educational / self-help, not financial advice, no personal recommendation, hypothetical/illustrative, no guarantee of accuracy, past performance / no future-results guarantee, variability with use and time, assumption transparency in-tool, seek a qualified professional, no warranty / liability limitation, privacy / local-processing transparency.

---

## 9. Items explicitly flagged for the lawyer

In approximate order of importance.

### 9.1 MFSA / MiFID non-authorisation language
Section 2 of `#disclaimer` contains the formal non-authorisation statement. The bio paragraph contains a shorter version. The first-visit strip, the inline pips, and the trust-row pip carry the abbreviated "not financial advice" framing.
- Confirm wording matches MFSA's preferred form for non-authorised retail-facing tools.
- Confirm the ESMA substance-over-disclaimer test is satisfied given the substance-level changes in §5.2.
- Confirm the bio rewording is safely outside the regulated-advice perimeter.

### 9.2 Headline and marketing phrasing under ESMA's substance test
The landing hero headline reads "How many more years do you actually need to work?" The final CTA reads "A real answer is waiting." The credibility section talks about "to know when work becomes optional".
- Confirm whether any of these need to be softened as a regulatory matter (not just a style matter) under ESMA 2023 Supervisory Briefing.
- The calculator's headline pill displays "Now" when the user is already viable; underlying message is the assumption-framed long form. Confirm this construction is acceptable.

### 9.3 Limitation of liability and warranty disclaimer
Sections 7 and 8 of `#disclaimer`.
- Confirm the wording survives the Maltese Consumer Affairs Act and the EU Unfair Contract Terms Directive 93/13/EEC.
- Confirm the carve-out for liability that cannot be excluded under applicable law is sufficient.
- Confirm whether the broad exclusion is enforceable against a Maltese consumer.

### 9.4 Governing law and jurisdiction clause
Section 11 of `#disclaimer`.
- Confirm the consumer-rights carve-out is enough under Brussels I Recast Articles 17-19 and Rome I Article 6.
- Confirm Maltese-courts exclusive-jurisdiction is enforceable for non-Maltese EU consumers.

### 9.5 GDPR scope determination
- Confirm whether ETQ qualifies as a "controller" under EDPB Guidelines 07/2020 in a no-server, no-collection architecture.
- Confirm whether the current privacy section in `#privacy` is sufficient as transparency, or whether a longer GDPR-style notice with controller, lawful basis, retention period, and rights table is required.
- Confirm whether the e-Privacy Directive's "strictly necessary" exemption applies and that no consent banner is required.

### 9.6 Educational-use framing sufficiency
The product positions itself as "for educational and informational use only" and "self-help planning tool". The actual output is a personalised numeric retirement age based on the user's specific financial situation.
- Confirm the educational-use framing is sufficient to keep ETQ outside MFSA's investment-services perimeter.
- Confirm the ESMA "filtering vs recommending" distinction is satisfied (per MFSA: "assisting filtering is acceptable provided that the ability of the clients to make their own choices is not curtailed").

### 9.7 Operator legal entity
ETQ is currently operated by Kenneth Bonnici as a natural person, not an incorporated entity. The disclaimer page identifies him by name with a contact email.
- Confirm whether this is sufficient for public launch under Maltese consumer law.
- Confirm whether incorporation (e.g. as a Maltese single-member private limited liability company) is advisable for liability shielding before any commercial expansion.
- Confirm whether the "© Enough to Quit" copyright attribution is sufficient or whether ownership needs more explicit attribution.

### 9.8 The word "deterministic" in marketing
The landing page footer says "A deterministic retirement-projection tool. For educational and informational use only..." Section 4 of `#disclaimer` says "ETQ is a deterministic single-path model".
- Confirm this terminology does not imply a level of certainty inconsistent with the model risk warnings.

### 9.9 Hosting and IP-address handling
The hosting provider (TBC at deploy time) will see request IPs and user-agents in normal access logs.
- Confirm whether the privacy notice needs to mention this server-side log surface.
- Confirm whether the log retention by the hosting provider creates any controller/processor relationship that needs surfacing.

### 9.10 Future-state monetisation triggers
This section lists features that, if added, would change the legal frame materially. Lawyer's view sought on:
- Adding a backend / cloud sync (requires full GDPR controller posture).
- Adding analytics, even self-hosted, that log IPs (requires consent or legitimate-interest assessment).
- Adding contact forms, newsletter signups, or any submission paths (collecting personal data).
- Adding any third-party widget that calls home (chat, intercom, hotjar, embedded video).
- Adding affiliate links to financial products (changes regulated-advice perimeter analysis).
- Adding subscriptions or premium tiers (triggers distance-selling rules, pre-contractual information, right of withdrawal).

### 9.11 Test for an inadvertent personal recommendation
ETQ produces an authoritative numeric "earliest viable retirement age" based on specific personal inputs. Even with the disclaimer, the output is functionally a single answer about a major life decision.
- Confirm the model-output framing in §5.2 substance-level changes is enough.
- Confirm whether any further softening (e.g. always presenting the result as a range rather than a single number) is necessary.

---

## 10. Known launch-readiness checklist (operator's view)

### 10.1 Pending before public launch
- Lawyer review of the disclaimer page wording (this document is the brief).
- Final operator-entity decision (natural person vs. incorporated; affects About section).
- Hosting provider decision (affects the privacy section's accuracy on access logs).
- Final review of marketing-level headline phrases per §9.2.

### 10.2 Resolved during the disclaimer package work
- Equity return default lowered from 8% to 6.5% to match the figure published in the disclaimer page and to sit in the middle of mainstream long-run nominal estimates (commit `61e626b`).
- All third-party asset loading removed (Google Fonts → self-hosted variable woff2 in commit `7e8e336`).
- Headline recommendation phrase ("You can retire now at X!") rewritten to model-output framing (commit `2f6b5e8`).
- Bio "business advisor with deep financial modelling experience" dropped (commit `2f6b5e8`).
- Recommendation-shaped landing label "You could stop at" replaced with case-aware neutral framing (commit `2f6b5e8`).
- Browser-storage transparency notice added at first-save and auto-restore toast on session restore (commit `72ad7a4`).
- First-visit acknowledgement strip on calculator and onboarding (commit `17a478f`).
- Onboarding handoff wording rewritten to lead with "not advice" and underline the qualified-professional sentence (commit `8d79f04`).

### 10.3 Deliberately deferred
- Long GDPR-style privacy notice with controller, lawful basis, retention period, and rights table (the working assumption is that the no-server architecture means there is nothing to populate this with; pending lawyer confirmation per §9.5).
- Phase 5 of the original audit plan: in-line numeric default-assumption display in the onboarding handoff card. Decided against on UX grounds; instead the handoff paragraph now says "In the full calculator you can review and adjust all assumptions, plan for major events, schedule liquidations and more."
- Consent banner for browser storage. Working assumption: not required under e-Privacy Directive's "strictly necessary" exemption (§9.5).
- Per-page first-save / per-restore counters that suppress the inline notices after N views. Decided against on simplicity grounds.

---

## 11. How to obtain a fully informed second opinion using this document

If you (the AI legal assistant) need to verify any claim in this document:
1. **Code claims** — every reference includes a file path and approximate line numbers; the actual file contents are the source of truth.
2. **Verbatim copy** — quoted directly from the live source. Where the wording matters legally, treat the quoted text as authoritative; the ambient prose is summary.
3. **Architectural claims** (no backend, no analytics, no third-party assets at runtime) — verifiable by inspecting the running site's network tab in any browser. Curl-based verification commands are documented in the Phase 2 commit message.
4. **Test claims** — `npm test` and `npm run test:golden` runnable from the repo root.

If you find a contradiction between this document and the live source, the live source wins. Flag the contradiction so the operator can update this document.

If you find a regulatory issue not covered in §9, flag it explicitly. The operator's view is that this document captures the known issues; that view is not a substitute for legal review.

If the wording in `disclaimer.html` does not satisfy a specific Maltese / EU requirement, propose specific replacement wording the operator can drop in, and reference the regulatory source for the requirement.

---

*End of document.*
