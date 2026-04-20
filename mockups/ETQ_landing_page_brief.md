# ETQ (Enough to Quit) — Landing Page Design Brief

## 1. Purpose and motivation

- **Why ETQ exists:** to help people unlock freedom they may not realise they already have. It is far too easy to get stuck in the rut, the race and the peer pressure of "success" and the pursuit of more.
- **Core hypothesis:** most people fail to retire early not only because they do not plan ahead or live within their means, but because they never sit down for 30 minutes to calculate whether they actually can, or they lack the skills to do so. Few have the aptitude, clarity or discipline to build a cash flow projection running to end of life. It feels too hard, so they never start. Instead, they default to the "safer" path: same, same, working to statutory retirement, or pushing the decision out by yet another year.
- **The insight:** when we are young we want to build wealth in order to have freedom, and we hold a more balanced view of success. Somewhere along the way, even once we have enough, we forget to be free.

## 2. Target audience

- Intelligent professionals and executives, broadly aged 35 to 55, in senior and well-paid roles.
- Capable and respected at work, yet carrying a nagging sense that something is missing: real purpose, real freedom, a fuller life.
- Worn down by the daily grind of meetings, email, and tolerating toxic or artificial people for money, and increasingly aware of the life opportunity cost of all of it.

## 3. Look, feel and content guidelines

### Visual identity

- Professional, trustworthy and reassuring. Consistent colour palette with the app itself, with room for variation where it improves visual appeal.
- Reflects independent thinking, personality and maturity. Must not look like another cookie-cutter personal finance landing page built by a 30-year-old founder.

### Credibility

- This is a serious tool built by a subject-matter expert: a career financial professional who retired at 53 and now lives a rich life using a sophisticated Excel version of this very tool.
- It must be unmistakably different from the output of another social media influencer who has read a book, discovered the 4% rule, and is trying to build an audience and a quick income stream while still needing to work.

### Emotional register

- Evokes freedom and living life on one's own terms. Gives the reader hope.
- Communicates that taking control is possible, and that the reader has earned it and deserves it.
- Warm, supportive and positive in tone. The experience should feel like working with a highly competent trusted advisor who is also a close friend the reader looks up to.
- Hooks first-time visitors on the idea of actually **knowing** whether and when they can retire, rather than burying the question out of fear of the answer. It should make them itch to find out.

## 4. Hero headline (recommended)

**Headline:** How many more years do you actually need to work?

**Subhead:** Find out in thirty minutes, with a tool built by someone who actually retired.

Rationale, for the implementing developer's context:

- Mirrors the core hypothesis directly: the 30-minute calculation most people never do.
- Reframes retirement as opportunity cost, which is the emotionally live question for the target audience.
- Asks rather than claims. Senior professionals respond better to being invited to think than to being told.
- Establishes credibility through evidence ("actually retired"), not through title or category swipe.
- Avoids FIRE vocabulary entirely (no "retire early", no "financial independence", no "4% rule").

## 5. Page structure and flow

The landing page should follow this order, top to bottom:

1. **Hero.** Headline, subhead, primary CTA (e.g. "See if you can quit"), hero visual. Carries the emotional hook.
2. **Quick-start calculator.** Placed one scroll below the hero, not above the fold. Credibility and emotional resonance land first, then the utility.
3. **Credibility section.** Who built ETQ and why it is not another 4% rule blog.
4. **Days of freedom unlocked counter.** Live, gently pulsating, visible on the landing page from day one.
5. **How it works.** The progression from quick-start to progressive onboarding to full model, with an option for "pro" users to jump straight into the full model.
6. **Quote accent.** For example: *"We build wealth for freedom, and then we forget to be free."*
7. **Final CTA.**

## 6. Functional requirements

### Quick-start calculator

- Simple 5 to 6 field calculator (e.g. age, income, living expenses, savings, investments) with an elegant, uncluttered visual output.
- Enough to engage the user without feeling gimmicky, and to lead naturally into progressive onboarding for a more accurate result.
- Offer a secondary path for "pro" users to skip straight into the full model.

### Days of freedom unlocked counter

- A live, gently pulsating counter showing total days of freedom unlocked across all users.
- Formula (back end, to be built later): sum over all users of (statutory retirement age minus earliest retirement age produced by ETQ), multiplied by 365.
- Purpose: subtle social proof and a quiet sense of urgency. Others have been set free by this tool, and so can you.
- Display on the landing page from launch. Show the real number rather than a seeded figure, consistent with the tool's no-nonsense positioning.

### Quotes and copy accents

- Use a small number of well-chosen quotes to reinforce the emotional theme. Example: *"We build wealth for freedom, and then we forget to be free."*
- Avoid anything that reads as cliché or motivational-poster.

## 7. Other 

- Attribution of the Munger quote, if used.
- Do not name the founder explicitly in the credibility section.
- Display a dummy number for "days of freedom unlocked" counter, will be integrated with backend later