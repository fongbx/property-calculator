# Home figures

A plain-language calculator for **one** Singapore private home. It estimates the cash and CPF for the purchase, when that money is due, the loan, the monthly repayment, and the salary a bank’s 55% test would ask for.

It is for a family working through a purchase together. Cash and CPF stay as one combined total. Nothing on the page is a bank offer or a tax bill.

The maths for a **new launch** (a home bought from a developer, still being built) follow the spreadsheet `Project Investment Timeline`: the Timeline sheet and the Notes sheet. A **resale or completed** home uses the same stamp duty, loan and salary rules, with a shorter payment timetable described below. That resale timetable is not in the spreadsheet.

## Run it

No install and no build step. From this folder:

```bash
python3 -m http.server
```

Open [http://localhost:8000](http://localhost:8000). The page uses relative links, so the same files work on GitHub Pages. `.nojekyll` is included so GitHub does not rewrite the site.

The boxes start on the spreadsheet’s example (a S$1,800,000 new launch). Change anything and the figures update as you type. The last inputs stay in this browser only (`localStorage`). They are not sent anywhere.

## Tests

The calculations live in `calc.js`, separate from the page. Tests use Node’s built-in test runner. Nothing to install.

```bash
node --test
```

`npm test` runs the same command.

The main example (new launch, price S$1,800,000, LTV 75%, interest 4%, ABSD 0%, no ages or salaries so the tenure stays at its 30-year maximum, no other debt) is asserted as:

| Figure | Amount |
| --- | --- |
| Total cash / CPF | S$509,600 |
| Loan | S$1,350,000 |
| Full monthly repayment | S$6,445 (nearest dollar), from about Oct 2030 |
| Minimum salary at 55% TDSR | S$11,718 |
| Minimum salary at 30% MSR | S$21,484 |
| Show funds, unpledged | S$1,875,000 |
| Show funds, pledged | S$563,000 |

Other tests cover BSD tier boundaries, ABSD (including a rate that is not on the dropdown), income-weighted age and tenure, the extra cash when LTV is under 75%, the stage-by-stage cash waterfall, and the resale timetable.

## How the code is split

| File | What it is |
| --- | --- |
| `calc.js` | The maths for one home. No page, no saved memory. |
| `test/calc.test.js` | The checks above. |
| `index.html` | The form, the word list, and the disclaimer. |
| `app.js` | Reads the form and draws one result. |
| `styles.css` | Layout. Key inputs and the three main figures sit at the top. On a phone the timeline stacks. On a wider screen it runs across. |

A later side-by-side view can call `calculateProperty()` once per home, or use `compareProperties([...])`. The screen currently draws one home only.

## New launch, as in the spreadsheet

- **Booking date** starts the early timetable. Sale & Purchase arrives 3 days later. Exercise is 21 days after that. Stamp duty is 14 days after exercise. The further 15% is 56 days (8 weeks) after booking.
- The page draws that order as one timeline, in the spreadsheet’s two bands: **Within 8 weeks**, then **Call for foundation payment**. Each early step shows the date, the amount, how it can be paid, and the short to-do from the sheet. The construction stages continue on the same timeline (month and year, stage share, cash / CPF, bank, and the monthly repayment after that stage). A running cash / CPF total sits on every step. The full stage table, with interest and principal, is under “Full stage table”.
- **Launch date** plus 180 days is the foundation stage. Each later stage is dated from the one before, adding the months in that row (the same rule as Excel’s EDATE). The “6 months” on the foundation row is not added on top of the 180 days.
- **Option fee** is 5%. Of that, 1.25% is forfeited if you do not exercise, and 3.75% is refundable.
- **BSD** (Buyer’s Stamp Duty), residential bands: 1% on the first S$180,000, 2% on the next S$180,000, 3% on the next S$640,000, 4% on the next S$500,000, 5% on the next S$1.5 million, 6% above S$3 million.
- **ABSD** is the price times the rate you pick. The list is 0%, 5%, 20%, 30%, 60%, 65%. Another rate is allowed, with a note that it is not on that list.
- **Total cash / CPF** = 5% option + 15% + BSD + ABSD + a 5% foundation top-up + any extra because the LTV you typed is under 75%. The extra is `max(0, 75% − your LTV) × price`. It is not all due at booking. Below a 75% LTV, part of it is called stage by stage during construction. The page lists those dates under “When you'll need it”.
- After the first 20%, the remaining 80% is paid in eight stages (foundation through CSC). Cash beyond that 20% is applied to the **earliest stages first**. The rest of each stage is what the bank releases.
- From each stage, the monthly figure is a full principal-and-interest repayment on the running total the bank has released, over the tenure chosen. On the S$1,800,000 example at 75% that starts at about S$430 in Apr 2027 and reaches the full S$6,445 at CSC, about Oct 2030. At 55% the first payment is about S$430 in Apr 2028 and the full amount is about S$4,726. Some banks charge interest only during construction, which would make the early months lower. The salary tests use the full repayment.
- **IWAA** (income-weighted average age) leans toward whoever earns more. No salary entered means IWAA is 0, the longest tenure is 30 years, and the age-based loan limit stays 75%.
- Otherwise the longest tenure is the lesser of 30 years and 65 minus IWAA. The page starts on that maximum. A shorter tenure can be chosen, in whole years, down to 5 and not past the maximum. The monthly repayment, the TDSR and MSR salaries, the income shortfall and the show or pledge funds follow the years chosen. If IWAA + 30 is over 65, the age-based limit drops to 55%. That 75% or 55% cut follows the age, not a shorter tenure.
- **Estimated loan** is the lower of “price × the LTV you typed” and “price × the age-based limit”. The monthly repayment uses that loan, over the tenure chosen.
- **TDSR** minimum salary = (repayment + other monthly debt) / 0.55. **MSR** = repayment / 0.3, and it ignores other debt. MSR is only there for comparison (it is the HDB / executive condo test).
- **Show funds** and **pledge funds** are alternatives. You pick one. The income gap is how far the salaries you typed sit below the TDSR minimum. With no salary, the whole minimum counts as the gap. Unpledged = gap × 48 / 0.3. Pledged = gap × 48. Both round **up** to the next S$1,000. These are savings you have to show or lock up. They are not added to the total cash / CPF. The page starts on pledge funds, the smaller amount. The choice is remembered in this browser.
- If the salaries already cover the TDSR minimum, and you have not typed a banker's figure for the option you picked, the card closes to one line: income covers the loan. You can open it again if the bank still asks.
- A **banker's figure**, if you type one for the option you picked, replaces that calculated amount on the page and on the timeline. The calculated amount stays underneath in small type. Leave the box blank and the calculation is used. Show and pledge each keep their own figure.
- Proof is shown during the loan application, by the exercise date. The bank's letter of offer is signed before you exercise. Show funds are then ready at the law firm at least a week before the first loan payout. Pledged funds go into a fixed deposit with your lending bank before that payout, and stay there for at least 4 years.
- The first payout is the first stage the bank actually pays. At 75% that is foundation. At a lower loan-to-value it can be a later stage, such as the ceiling. On a resale it is completion. A date you type replaces that estimate for the fund checklist only.
- The total cash / CPF follows the LTV you typed, same as the spreadsheet. If the age rule lends less, that shortfall is shown separately and is not folded into the total.

## Resale assumptions

These are ordinary private-resale steps. They are not in the spreadsheet.

- **Option fee is 1%** of the price, paid on the OTP date. If you do not exercise, that 1% is normally forfeited.
- You have **14 days** to exercise. On that day you pay **another 4%**, so the deposit is 5%.
- **Stamp duty is due 14 days after exercise.** BSD and ABSD use the same bands and rate as a new launch.
- **Completion is 10 weeks after exercise.** Private resale completion is often somewhere between 8 and 12 weeks; 10 weeks is the figure this page uses.
- At completion you pay whatever down payment is left after the 5% deposit. The bank releases the **whole loan at once**, and the monthly repayment starts then. There is no stage table.
- The loan, TDSR, MSR and show-funds rules are the same as a new launch. The total cash / CPF uses the LTV you typed. If that LTV leaves less than 5% of the price to pay, the page still shows the 1% + 4% deposit and says so.
- Cash and CPF stay one total.

## Worth knowing

- Above a 75% LTV the spreadsheet still adds the 5% foundation top-up, so the total cash / CPF does not fall any further. The stage table follows the LTV you typed, and above 75% those two totals can disagree. The page says so when it happens. Most bank loans for a private home stop at 75%, or 55% when the loan would run past age 65.
- The stage table’s monthly repayments follow the money released at the LTV you typed. The big monthly figure uses the lower, age-based loan when that limit is tighter. They differ only in that case.
- CPF Ordinary Account contribution is a box on the spreadsheet marked “not used in calculations”, so it is not an input here.
- IRAS rounds BSD and ABSD **down** to the next dollar (with a minimum of S$1). The spreadsheet, and this page, keep the exact cent. On the S$1,800,000 example there is no difference.
- IRAS charges duty on the higher of price and market value. This page only asks for the price.
- 35% ABSD (a permanent resident buying a third home, on IRAS’s table) is not in the spreadsheet’s dropdown. Choose Other and type 35. The page keeps it and notes that it is not on the short list. Confirm the rate that actually applies: [IRAS stamp duty](https://www.iras.gov.sg/quick-links/tax-rates/stamp-duty).
- The BSD bands are the residential scale (in force since 15 February 2023). Non-residential property is not covered.
- A weighted age of 65 or more makes the spreadsheet’s tenure zero or negative. The page does not invent a repayment in that case.
- Show funds with no salary entered are large on purpose. They are the gap against the whole minimum salary, not a guess of anyone’s real income.

## Disclaimer

All payments, dates and salary figures are estimates only. Actual construction may vary from each project. A bank’s letter of offer, the lawyer’s completion date and IRAS can all differ from this page. This is not advice. Check the figures before anyone pays anything.

## Fonts

Inter is included under the SIL Open Font License. See `fonts/OFL.txt`. Numbers use tabular figures.
