/**
 * Draws one home. The maths live in calc.js.
 * A second home, later, would be another call to calculateProperty()
 * and a second column — this file only reads one form.
 */

import {
  calculateProperty,
  formatDate,
  formatMonthYear,
  formatPercent,
  formatSgd,
  formatSgdAuto,
  formatTenure,
} from "./calc.js";

const STORAGE_KEY = "home-figures-inputs-v1";

const DEFAULTS = {
  version: 1,
  mode: "new_launch",
  price: "1,800,000",
  bookingDate: "2026-10-31",
  launchDate: "2026-10-31",
  otpDate: "2026-10-31",
  absd: "0",
  absdCustom: "",
  ages: ["", "", "", ""],
  salaries: ["", "", "", ""],
  interest: "4",
  debt: "",
  ltv: "75",
};

const form = document.querySelector("#planner");
const summary = document.querySelector("#summary");
const timeline = document.querySelector("#timeline");
const detail = document.querySelector("#detail");
const live = document.querySelector("#live");
const status = document.querySelector("#status");

/** Stays open across live updates, which replace the timeline markup. */
let stageTableOpen = false;

const PHASES = {
  "within-8-weeks": {
    title: "Within 8 weeks",
    lead: "Booking through the 15% payment.",
  },
  "foundation-call": {
    title: "Call for foundation payment",
    lead: "Estimated 6 months (180 days) from the launch date. The developer will call for payment progressively.",
  },
  "resale-option": {
    title: "Option",
    lead: "The 1% option fee, then 14 days to exercise and pay the rest of the deposit.",
  },
  "resale-completion": {
    title: "Stamp duty and completion",
    lead: "Duty within 14 days of exercise. The rest of the down payment, and the whole loan, at completion.",
  },
};

const NEW_LAUNCH_STEPS = {
  option: {
    title: "Pay 5% › receive OTP",
    payWith: "Cheque / cashier's order",
    todo: "Confirm law firm details and forward the OTP copy to the banker and the law firm.",
    timing: "Booking date",
  },
  "receive-sp": {
    title: "Receive S&P",
    payWith: "No payment this day",
    todo: "Ensure the letter of offer is signed before meeting the law firm to exercise the S&P.",
    timing: "3 days from booking",
  },
  exercise: {
    title: "Exercise S&P",
    payWith: "No payment this day",
    todo: "Ensure the law firm applies CPF for stamp duty to IRAS, and for the 15% payment, if that applies.",
    timing: "21 days from receiving the S&P",
  },
  "stamp-duty": {
    title: "Pay stamp duty",
    payWith: "Cheque / cashier's order / CPF",
    todo: "Pay the balance of the down payment and the progressive payments.",
    timing: "14 days from exercise",
  },
  "pay-15": {
    title: "Pay 15%",
    payWith: "Cheque / cashier's order / CPF",
    todo: "Completion payment, 8 weeks from booking.",
    timing: "8 weeks from booking",
  },
};

const RESALE_STEPS = {
  option: {
    title: "Pay 1% option",
    payWith: "Cheque / cashier's order",
    todo: "This takes the option. If you do not exercise, this 1% is normally forfeited.",
    timing: "OTP date",
  },
  exercise: {
    title: "Exercise and pay 4%",
    payWith: "Cheque / cashier's order",
    todo: "With the option fee, the deposit is 5%.",
    timing: "14 days from the OTP",
  },
  "stamp-duty": {
    title: "Pay stamp duty",
    payWith: "Cheque / cashier's order / CPF",
    todo: "Buyer's stamp duty plus any ABSD.",
    timing: "14 days from exercise",
  },
  completion: {
    title: "Completion, with the loan",
    payWith: "Cash / CPF, and the bank loan",
    todo: "Pay the rest of the down payment. The bank releases the whole loan and the monthly repayment starts.",
    timing: "10 weeks after exercise",
  },
};

const STAGE_NOTES = {
  foundation: "180 days from the launch date. Same cash as the foundation top-up in the total above — not a second bill.",
  top: "Temporary occupation. You can move in.",
  csc: "Legal completion of the project.",
};

init();

function init() {
  applyState(loadState());
  form.addEventListener("input", onEdit);
  form.addEventListener("change", onEdit);
  form.addEventListener("submit", (event) => event.preventDefault());
  document.querySelector("#restore").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    applyState(DEFAULTS);
    draw();
  });
  for (const id of ["price", "debt", "salary-1", "salary-2", "salary-3", "salary-4"]) {
    document.getElementById(id).addEventListener("blur", () => {
      const input = document.getElementById(id);
      const value = parseMoney(input.value);
      if (value != null && !Number.isNaN(value) && value >= 0) input.value = plainNumber(value);
      onEdit();
    });
  }
  draw();
}

function onEdit() {
  persist(collectState());
  draw();
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || saved.version !== 1) return structuredClone(DEFAULTS);
    return {
      ...structuredClone(DEFAULTS),
      ...saved,
      ages: Array.isArray(saved.ages) ? saved.ages.slice(0, 4) : DEFAULTS.ages,
      salaries: Array.isArray(saved.salaries) ? saved.salaries.slice(0, 4) : DEFAULTS.salaries,
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function applyState(state) {
  form.elements.mode.value = state.mode;
  form.elements.price.value = state.price;
  form.elements.bookingDate.value = state.bookingDate;
  form.elements.launchDate.value = state.launchDate;
  form.elements.otpDate.value = state.otpDate;
  form.elements.absd.value = state.absd;
  form.elements.absdCustom.value = state.absdCustom;
  form.elements.interest.value = state.interest;
  form.elements.debt.value = state.debt;
  form.elements.ltv.value = state.ltv;
  state.ages.forEach((age, index) => {
    form.elements[`age-${index + 1}`].value = age ?? "";
  });
  state.salaries.forEach((salary, index) => {
    form.elements[`salary-${index + 1}`].value = salary ?? "";
  });
}

function collectState() {
  return {
    version: 1,
    mode: form.elements.mode.value,
    price: form.elements.price.value,
    bookingDate: form.elements.bookingDate.value,
    launchDate: form.elements.launchDate.value,
    otpDate: form.elements.otpDate.value,
    absd: form.elements.absd.value,
    absdCustom: form.elements.absdCustom.value,
    ages: [1, 2, 3, 4].map((n) => form.elements[`age-${n}`].value),
    salaries: [1, 2, 3, 4].map((n) => form.elements[`salary-${n}`].value),
    interest: form.elements.interest.value,
    debt: form.elements.debt.value,
    ltv: form.elements.ltv.value,
  };
}

function persist(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Private mode can refuse storage. The page still calculates. */
  }
}

function sameAsExample(state) {
  const example = structuredClone(DEFAULTS);
  return JSON.stringify(normalizeState(state)) === JSON.stringify(normalizeState(example));
}

function normalizeState(state) {
  return {
    mode: state.mode,
    price: state.price.trim(),
    bookingDate: state.bookingDate,
    launchDate: state.launchDate,
    otpDate: state.otpDate,
    absd: state.absd,
    absdCustom: state.absdCustom.trim(),
    ages: state.ages.map((value) => value.trim()),
    salaries: state.salaries.map((value) => value.trim()),
    interest: state.interest.trim(),
    debt: state.debt.trim(),
    ltv: state.ltv.trim(),
  };
}

function draw() {
  const state = collectState();
  syncVisibility(state);
  status.textContent = sameAsExample(state)
    ? "These boxes match the spreadsheet's example. Change anything — the figures update as you type, and stay on this device."
    : "Figures update as you type and stay in this browser. They are not sent anywhere.";

  const { input, problems } = interpret(state);
  showFieldErrors(problems);
  if (problems.length > 0) {
    renderProblems(problems);
    return;
  }

  const result = calculateProperty(input);
  if (!result.ok) {
    showFieldErrors(result.errors);
    renderProblems(result.errors);
    return;
  }
  summary.innerHTML = renderSummary(result);
  timeline.innerHTML = renderPaymentTimeline(result);
  bindStageTable();
  detail.innerHTML = renderDetail(result);
  live.textContent = [
    `Upfront cash and CPF ${money(result.totalCashCpf)}.`,
    `Monthly repayment ${result.monthlyRepayment == null ? "not available" : money(result.monthlyRepayment)}.`,
    `Minimum salary ${result.minSalaryTdsr == null ? "not available" : money(result.minSalaryTdsr)}.`,
  ].join(" ");
}

function syncVisibility(state) {
  document.getElementById("new-launch-dates").hidden = state.mode !== "new_launch";
  document.getElementById("resale-dates").hidden = state.mode !== "resale";
  document.getElementById("absd-custom-wrap").hidden = state.absd !== "other";
}

function interpret(state) {
  const problems = [];
  const price = requiredMoney(state.price, "price", "Enter the price and the figures will appear here.", problems);
  const interest = requiredPercent(state.interest, "interest", "Enter an interest rate. 4% is the usual starting point.", problems);
  const ltv = requiredPercent(state.ltv, "ltv", "Enter a loan-to-value. 75% is the usual starting point.", problems);
  const debt = state.debt.trim() === "" ? 0 : parseMoney(state.debt);
  if (state.debt.trim() !== "" && (debt == null || Number.isNaN(debt))) {
    problems.push({ field: "debt", message: "Other monthly debt needs to be a number, or blank." });
  } else if (debt < 0) {
    problems.push({ field: "debt", message: "Other monthly debt cannot be negative." });
  }

  let absdRate = 0;
  if (state.absd === "other") {
    if (state.absdCustom.trim() === "") {
      problems.push({ field: "absd", message: "Enter your ABSD rate, or pick one from the list." });
    } else {
      absdRate = parsePercent(state.absdCustom);
      if (absdRate == null || Number.isNaN(absdRate)) {
        problems.push({ field: "absd", message: "ABSD needs to be a number, such as 35." });
      }
    }
  } else {
    absdRate = Number(state.absd) / 100;
  }

  const buyers = [1, 2, 3, 4].map((n) => {
    const ageRaw = state.ages[n - 1].trim();
    const salaryRaw = state.salaries[n - 1].trim();
    const age = ageRaw === "" ? null : parseMoney(ageRaw);
    const salary = salaryRaw === "" ? null : parseMoney(salaryRaw);
    if (ageRaw !== "" && (age == null || Number.isNaN(age))) {
      problems.push({ field: `age-${n}`, message: "Age needs to be a number." });
    }
    if (salaryRaw !== "" && (salary == null || Number.isNaN(salary))) {
      problems.push({ field: `salary-${n}`, message: "Salary needs to be a number." });
    }
    return { age, monthlySalary: salary };
  });

  return {
    problems,
    input: {
      mode: state.mode,
      price,
      bookingDate: state.bookingDate || null,
      launchDate: state.launchDate || null,
      otpDate: state.otpDate || null,
      absdRate,
      buyers,
      annualInterestRate: interest,
      otherMonthlyDebt: debt,
      ltv,
    },
  };
}

function requiredMoney(raw, field, emptyMessage, problems) {
  if (raw.trim() === "") {
    problems.push({ field, message: emptyMessage, calm: true });
    return null;
  }
  const value = parseMoney(raw);
  if (value == null || Number.isNaN(value)) {
    problems.push({ field, message: "This needs to be a number." });
    return null;
  }
  return value;
}

function requiredPercent(raw, field, emptyMessage, problems) {
  if (raw.trim() === "") {
    problems.push({ field, message: emptyMessage, calm: true });
    return null;
  }
  const value = parsePercent(raw);
  if (value == null || Number.isNaN(value)) {
    problems.push({ field, message: "This needs to be a number." });
    return null;
  }
  return value;
}

function parseMoney(raw) {
  const cleaned = String(raw).trim().replace(/[S$,\s]/gi, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : NaN;
}

function parsePercent(raw) {
  const cleaned = String(raw).trim().replace(/%/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value / 100 : NaN;
}

function plainNumber(amount) {
  return formatSgdAuto(amount).replace("S$", "");
}

function showFieldErrors(problems) {
  for (const element of form.querySelectorAll(".field-error")) {
    element.hidden = true;
    element.textContent = "";
  }
  for (const element of form.querySelectorAll("[aria-invalid]")) {
    element.removeAttribute("aria-invalid");
  }
  for (const problem of problems) {
    const slot = document.getElementById(`${problem.field}-error`);
    if (!slot) continue;
    slot.hidden = false;
    slot.textContent = problem.message;
    const control = form.elements[problem.field] || document.getElementById(problem.field);
    if (control && "setAttribute" in control) control.setAttribute("aria-invalid", "true");
  }
}

function renderProblems(problems) {
  const calm = problems.every((problem) => problem.calm);
  const items = problems.map((problem) => `<p>${esc(problem.message)}</p>`).join("");
  summary.innerHTML = calm
    ? `<section class="hero"><p class="hero-kicker">Waiting for a price</p><p class="figure-note">${esc(problems[0].message)}</p></section>`
    : `<div class="note">${items}</div>`;
  timeline.innerHTML = "";
  detail.innerHTML = "";
  live.textContent = problems[0].message;
}

function renderSummary(result) {
  const monthly = result.monthlyRepayment == null ? "—" : money(result.monthlyRepayment);
  const salary = result.minSalaryTdsr == null ? "—" : money(result.minSalaryTdsr);
  const modeLabel = result.mode === "new_launch" ? "New launch" : "Resale / completed";
  const tenureBit = result.maxTenureYears > 0 ? formatTenure(result.maxTenureYears) : "no usable tenure";

  return `
    <section class="hero">
      <p class="hero-kicker">${esc(modeLabel)} · ${esc(money(result.price))} · ${esc(formatPercent(result.enteredLtv))} LTV · ${esc(formatPercent(result.annualInterestRate))} interest · ${esc(tenureBit)}</p>
      <div class="figures">
        <article>
          <h2>Upfront cash and CPF</h2>
          <p class="figure">${esc(money(result.totalCashCpf))}</p>
          <p class="figure-note">Option fee, stamp duty and your cash share of the price, as one total.</p>
        </article>
        <article>
          <h2>Monthly repayment</h2>
          <p class="figure">${esc(monthly)}</p>
          <p class="figure-note">${esc(monthlyNote(result))}</p>
        </article>
        <article>
          <h2>Minimum salary, 55% TDSR</h2>
          <p class="figure">${esc(salary)}</p>
          <p class="figure-note">${esc(salaryNote(result))}</p>
        </article>
      </div>
    </section>
    <section class="facts" aria-label="More of the main figures">
      ${fact("Loan used for the repayment", result.estimatedLoan == null ? "—" : money(result.estimatedLoan))}
      ${fact("Minimum salary, 30% MSR", result.minSalaryMsr == null ? "—" : money(result.minSalaryMsr))}
      ${fact("Show funds, unpledged", result.showFundsUnpledged == null ? "—" : money(result.showFundsUnpledged))}
      ${fact("Show funds, pledged 48 months", result.showFundsPledged == null ? "—" : money(result.showFundsPledged))}
    </section>
    ${summaryNotes(result)}
  `;
}

function monthlyNote(result) {
  if (!(result.maxTenureYears > 0)) {
    return "The weighted age leaves no positive loan tenure in the spreadsheet, so there is no repayment to show.";
  }
  const exact = formatSgd(result.monthlyRepayment, { digits: 2 });
  return `Rounded to the nearest dollar. The exact estimate is ${exact}, on the loan over ${formatTenure(result.maxTenureYears)} at ${formatPercent(result.annualInterestRate)}.`;
}

function salaryNote(result) {
  if (result.minSalaryTdsr == null) return "Salary tests need a repayment first.";
  if (result.otherMonthlyDebt > 0) {
    return `Gross monthly income so this repayment plus ${money(result.otherMonthlyDebt)} of other debt stays within 55%.`;
  }
  return "Gross monthly income so this repayment stays within 55%. No other monthly debt is entered.";
}

function summaryNotes(result) {
  const blocks = [];
  if (!result.salaryEntered && result.showFundsUnpledged > 0) {
    blocks.push(`<p>No monthly salary has been entered, so the whole minimum salary is treated as a gap. These show-funds amounts are what that gap implies. Add each buyer's salary and they shrink or drop to zero.</p>`);
  }
  if (result.warnings.some((warning) => warning.code === "iwaa-shortfall")) {
    blocks.push(`<p>The age rule cuts the loan to ${esc(formatPercent(result.iwaaLtv))} of the price, ${esc(money(result.ltvShortfall))} less than the LTV you typed. The upfront total follows the LTV you typed, same as the spreadsheet. If the bank uses the lower limit, that shortfall is extra cash or CPF.</p>`);
  }
  if (result.warnings.some((warning) => warning.code === "ltv-above-75")) {
    blocks.push(`<p>The LTV you typed is above 75%. The spreadsheet still adds a 5% foundation top-up, so the upfront total does not fall any further. The stage table follows the LTV you typed, and above 75% those two can disagree. Most bank loans for a private home stop at 75%, or 55% when the loan would run past age 65.</p>`);
  }
  if (result.warnings.some((warning) => warning.code === "absd-nonstandard")) {
    blocks.push(`<p>${esc(formatPercent(result.absdRate))} is not on the spreadsheet's ABSD list (0%, 5%, 20%, 30%, 60%, 65%). Kept anyway. 35% is a real rate for some buyers, such as a permanent resident buying a third home — confirm it applies to you.</p>`);
  }
  if (result.warnings.some((warning) => warning.code === "resale-deposit-exceeds-down-payment")) {
    blocks.push(`<p>The usual 5% deposit is more than the down payment at this LTV. The timetable still shows 1% then 4%. Ask the lawyer before relying on that.</p>`);
  }
  if (result.warnings.some((warning) => warning.code === "tenure-unavailable")) {
    blocks.push(`<p>Income-weighted age is ${esc(result.iwaa.toFixed(1))}, so the spreadsheet's max tenure is ${esc(formatTenure(result.maxTenureYears))}. A repayment is not calculated.</p>`);
  }
  if (blocks.length === 0) return "";
  return `<div class="note">${blocks.join("")}</div>`;
}

function renderDetail(result) {
  return [
    cashSection(result),
    loanSection(result),
    incomeSection(result),
  ].join("");
}

function cashSection(result) {
  if (result.mode === "new_launch") {
    const launch = result.newLaunch;
    const match = launch.stageCashMatchesTopUp
      ? "The foundation top-up and any extra for an LTV under 75% are not another bill on top of the stage table. Added together, they equal the Cash / CPF column there. The earliest stages take that cash first."
      : "Above a 75% LTV the spreadsheet still adds the 5% foundation top-up, while the stage table follows the LTV you typed. Do not add the two totals together.";
    return `
      <section>
        <h2>How the upfront total is built</h2>
        <p class="section-lead">${esc(match)}</p>
        ${line("Option fee, 5%", launch.optionFee, "Paid on the booking date to receive the option.")}
        ${line("Of which 1.25% is forfeitable", launch.forfeitable, "Kept by the developer if you do not exercise.", "sub")}
        ${line("Of which 3.75% is refundable", launch.refundable, "Returned if you do not exercise.", "sub")}
        ${line("Further 15%", launch.furtherPayment, "Due 8 weeks after booking.")}
        ${line("Buyer's stamp duty (BSD)", result.bsd, "Tax in rising steps. Not a flat percentage of the whole price.")}
        ${line(`Additional buyer's stamp duty (ABSD) at ${formatPercent(result.absdRate)}`, result.absd, "Price multiplied by the ABSD rate you chose.")}
        ${line("Foundation top-up", launch.foundationTopUp, "The spreadsheet always includes this 5%. It is the cash piece inside a 75% loan.")}
        ${line("Additional top-up, LTV under 75%", launch.additionalTopUp, "MAX(0, 75% minus your LTV) times the price. Zero when your LTV is 75% or more.")}
        ${line("Total cash and CPF", result.totalCashCpf, "The sum of the lines above.", "total")}
      </section>
    `;
  }

  const resale = result.resale;
  return `
    <section>
      <h2>How the upfront total is built</h2>
      <p class="section-lead">Resale cash is the 5% deposit, stamp duty, and whatever down payment is still left at completion. Cash and CPF stay together.</p>
      ${line("Option fee, 1%", resale.optionFee, "Paid on the OTP date. Normally forfeited if you do not exercise.")}
      ${line("Exercise payment, 4%", resale.exercisePayment, "14 days later. Brings the deposit to 5%.")}
      ${line("Buyer's stamp duty (BSD)", result.bsd, "Same residential steps as a new launch.")}
      ${line(`Additional buyer's stamp duty (ABSD) at ${formatPercent(result.absdRate)}`, result.absd, "Price multiplied by the ABSD rate you chose.")}
      ${line("Rest of the down payment", resale.remainingDownPayment, "Due at completion. This is your LTV's down payment, minus the 5% deposit.")}
      ${line("Total cash and CPF", result.totalCashCpf, "Deposit, stamp duty and the completion balance.", "total")}
    </section>
  `;
}

function loanSection(result) {
  const priceLine = result.maxPropertyPrice == null
    ? "—"
    : money(result.maxPropertyPrice);
  const iwaaText = result.salaryEntered
    ? `${result.iwaa.toFixed(1)} years`
    : "No salary entered";
  return `
    <section>
      <h2>The loan</h2>
      <p class="section-lead">The repayment uses the lower of the loan you asked for and the age-based limit. That is the spreadsheet's "estimated loan".</p>
      ${line("LTV you typed", null, `${formatPercent(result.enteredLtv)} of the price.`, "", formatPercent(result.enteredLtv))}
      ${line("Loan at that LTV", result.loanAtEnteredLtv)}
      ${line("Income-weighted average age", null, "Each buyer's age, weighted by monthly salary. Blank rows are ignored.", "", iwaaText)}
      ${line("Max loan tenure", null, result.iwaa === 0 ? "30 years when the weighted age is 0, including when no salary is entered." : "The lesser of 30 years and 65 minus the weighted age.", "", formatTenure(result.maxTenureYears))}
      ${line("Age-based LTV limit", null, "55% if the weighted age plus 30 years is over 65. Otherwise 75%.", "", formatPercent(result.iwaaLtv))}
      ${line("Loan at the age-based limit", result.loanAtIwaaLtv)}
      ${line("Estimated loan", result.estimatedLoan, "The lower of the two loans. The monthly repayment is based on this.")}
      ${line("LTV shortfall", result.ltvShortfall, "How much less the age rule lends, compared with the LTV you typed.")}
      ${line("Highest price this loan supports", null, "Estimated loan divided by the LTV you typed. It drops below your price when the age rule cuts the loan.", "", priceLine)}
      ${line("Exact monthly repayment", null, "Salary figures are rounded from this exact amount, not from the already-rounded figure in the green panel.", "", result.monthlyRepayment == null ? "—" : formatSgd(result.monthlyRepayment, { digits: 2 }))}
    </section>
  `;
}

function incomeSection(result) {
  return `
    <section>
      <h2>Salary and show funds</h2>
      <p class="section-lead">TDSR is the test banks apply to private homes. MSR is shown beside it because HDB and executive condos use 30%.</p>
      ${line("Monthly repayment", result.monthlyRepayment, "Rounded to the nearest dollar here. The exact amount is in the loan section.", "", result.monthlyRepayment == null ? "—" : money(result.monthlyRepayment))}
      ${line("Other monthly debt", result.otherMonthlyDebt)}
      ${line("Minimum salary at 55% TDSR", result.minSalaryTdsr, "Repayment plus other debt, divided by 0.55. Rounded to the nearest dollar.")}
      ${line("Minimum salary at 30% MSR", result.minSalaryMsr, "Repayment divided by 0.3. Other debt is not included. For comparison.")}
      ${line("Salary entered", result.totalMonthlySalary, "The monthly salaries you typed, added up.")}
      ${line("Income shortfall", result.incomeShortfall, "How far the entered salary is below the TDSR minimum. Zero if income is already enough.")}
      ${line("Show funds, unpledged", result.showFundsUnpledged, "Shortfall × 48 months ÷ 0.3, rounded up to the next S$1,000. Unpledged savings are only counted at 30%.")}
      ${line("Show funds, pledged", result.showFundsPledged, "Shortfall × 48 months, rounded up to the next S$1,000. This money would be locked for 48 months.")}
    </section>
  `;
}

function renderPaymentTimeline(result) {
  const groups = groupPhases(result.paymentTimeline);
  const phases = groups.map((group) => phaseBlock(result, group)).join("");
  const lead = result.mode === "new_launch"
    ? "Same order as the spreadsheet. Pay 5% and receive the OTP, then the S&P, exercise, stamp duty and the 15%, all inside eight weeks. The foundation call is 180 days after launch, and the later stages follow as the building goes up. Cash and CPF so far counts your money only. The bank’s share is shown beside it."
    : "Same kind of timeline, with the shorter resale steps. These dates are not in the spreadsheet. This page uses a common private-resale practice: 1% on the OTP date, 14 days to exercise and pay 4%, stamp duty 14 days after that, and completion 10 weeks after exercise. Completion is often somewhere from 8 to 12 weeks. The whole loan is released at completion.";
  const table = result.mode === "new_launch" ? stageTable(result) : "";

  return `
    <section class="pay-timeline" aria-labelledby="timeline-heading">
      <h2 id="timeline-heading">Payment timeline</h2>
      <p class="section-lead">${esc(lead)}</p>
      ${phases}
      ${table}
    </section>
  `;
}

function groupPhases(steps) {
  const groups = [];
  for (const step of steps) {
    const last = groups.at(-1);
    if (!last || last.id !== step.phase) groups.push({ id: step.phase, steps: [step] });
    else last.steps.push(step);
  }
  return groups;
}

function phaseBlock(result, group) {
  const phase = PHASES[group.id];
  const items = group.steps.map((step) => stepCard(result, step)).join("");
  const hint = group.id === "foundation-call"
    ? `<p class="scroll-hint">On a wide screen, scroll sideways for the later stages.</p>`
    : "";
  return `
    <section class="phase phase-${esc(group.id)}">
      <div class="phase-band">
        <h3>${esc(phase.title)}</h3>
        <p>${esc(phase.lead)}</p>
      </div>
      ${hint}
      <div class="rail-scroll" tabindex="0" aria-label="${esc(phase.title)}">
        <ol class="rail">${items}</ol>
      </div>
    </section>
  `;
}

function stepCard(result, step) {
  const copy = stepCopy(result, step);
  const when = !step.date
    ? "Add the date"
    : step.kind === "stage"
      ? formatMonthYear(step.date)
      : formatDate(step.date);
  const window = step.windowLabel ? `<p class="window">${esc(step.windowLabel)}</p>` : "";
  const timing = copy.timing ? `<p class="timing">${esc(copy.timing)}</p>` : "";
  const todo = copy.todo ? `<p class="todo"><span>To do</span> ${esc(copy.todo)}</p>` : "";

  return `
    <li class="step">
      ${window}
      <p class="step-date">${esc(when)}</p>
      <h4>${esc(copy.title)}</h4>
      ${timing}
      ${step.kind === "stage" ? stageMoney(step) : milestoneMoney(step)}
      <p class="pay-with">${esc(copy.payWith)}</p>
      ${todo}
      <p class="running">Cash / CPF so far <strong>${esc(money(step.runningCash))}</strong></p>
    </li>
  `;
}

function stepCopy(result, step) {
  if (step.kind === "stage") {
    const bank = step.bankAmount;
    const cash = step.cashAmount;
    let payWith = "Cash / CPF for your share. The bank pays the rest.";
    if (cash === 0 && bank > 0) payWith = "The bank pays this stage.";
    else if (bank === 0 && cash > 0) payWith = "Cash / CPF. Nothing from the bank at this stage.";
    return {
      title: step.label,
      payWith,
      todo: STAGE_NOTES[step.id] || "",
      timing: step.id === "foundation" ? "180 days from launch" : "",
    };
  }
  const book = result.mode === "new_launch" ? NEW_LAUNCH_STEPS : RESALE_STEPS;
  return book[step.id];
}

function milestoneMoney(step) {
  const due = step.amount == null ? "No payment" : money(step.amount);
  const loan = step.loanDisbursed == null
    ? ""
    : `<p class="loan-line">Loan released <strong>${esc(money(step.loanDisbursed))}</strong></p>`;
  const repay = step.monthlyRepayment == null
    ? ""
    : `<p class="repay">Monthly repayment starts at <strong>${esc(money(step.monthlyRepayment))}</strong></p>`;
  return `
    <p class="kicker">Due</p>
    <p class="step-amount">${esc(due)}</p>
    ${loan}
    ${repay}
  `;
}

function stageMoney(step) {
  const repay = step.monthlyRepayment == null ? "—" : money(step.monthlyRepayment);
  return `
    <p class="kicker">Est. monthly repayment</p>
    <p class="step-amount">${esc(repay)}</p>
    <dl class="split">
      <div><dt>Stage</dt><dd>${esc(formatPercent(step.percent))}</dd></div>
      <div><dt>Cash / CPF</dt><dd>${esc(money(step.cashAmount))}</dd></div>
      <div><dt>Bank</dt><dd>${esc(money(step.bankAmount))}</dd></div>
    </dl>
  `;
}

function bindStageTable() {
  const details = timeline.querySelector(".stage-table");
  if (!details) return;
  details.open = stageTableOpen;
  details.addEventListener("toggle", () => {
    stageTableOpen = details.open;
  });
}

function stageTable(result) {
  const rows = result.stages.map((stage) => `
    <tr>
      <th scope="row">${esc(stage.label)}</th>
      <td>${esc(formatPercent(stage.percent))}</td>
      <td>${esc(`${stage.monthsAfterPrevious} mths`)}</td>
      <td>${esc(stage.date ? formatDate(stage.date) : "Add a launch date")}</td>
      <td>${esc(money(stage.cashAmount))}</td>
      <td>${esc(formatPercent(stage.bankPercent))}</td>
      <td>${esc(money(stage.bankAmount))}</td>
      <td>${esc(cents(stage.monthlyInterest))}</td>
      <td>${esc(stage.monthlyPrincipal == null ? "—" : cents(stage.monthlyPrincipal))}</td>
      <td>${esc(stage.monthlyRepayment == null ? "—" : cents(stage.monthlyRepayment))}</td>
    </tr>
  `).join("");

  const share = result.stages.reduce((sum, stage) => sum + stage.percent, 0);
  const bankShare = result.stages.reduce((sum, stage) => sum + stage.bankPercent, 0);

  return `
    <details class="stage-table">
      <summary>Full stage table</summary>
      <p class="section-lead">The same stages, with the spreadsheet’s interest and principal columns. Cash and CPF beyond the first 20% go to the earliest stages first. The rest of each stage is what the bank releases. From each stage, the estimate repays principal and interest on the running total the bank has released, over the full tenure. There is no interest-only period during construction. The monthly figure on the timeline is this repayment, rounded to the nearest dollar.</p>
      <p class="hint">Swipe sideways for the bank's monthly interest, principal and repayment.</p>
      <div class="table-scroll" tabindex="0">
        <table>
          <caption>Stage percentages, dates and amounts. Foundation is launch plus 180 days. Each later date is the previous date plus the months shown.</caption>
          <thead>
            <tr>
              <th scope="col">Stage</th>
              <th scope="col">Share</th>
              <th scope="col">Months</th>
              <th scope="col">Est. date</th>
              <th scope="col">Cash / CPF</th>
              <th scope="col">Bank share</th>
              <th scope="col">Bank amount</th>
              <th scope="col">Interest / month</th>
              <th scope="col">Principal / month</th>
              <th scope="col">Repayment / month</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>${esc(formatPercent(share))}</td>
              <td></td>
              <td></td>
              <td>${esc(money(result.stageCashTotal))}</td>
              <td>${esc(formatPercent(bankShare))}</td>
              <td>${esc(money(result.stageBankTotal))}</td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </details>
  `;
}

function fact(label, value) {
  return `
    <div>
      <p class="fact-label">${esc(label)}</p>
      <p class="fact">${esc(value)}</p>
    </div>
  `;
}

function line(label, amount, why = "", kind = "", display = null) {
  const shown = display ?? (amount == null ? "—" : money(amount));
  const whyHtml = why ? `<p class="why">${esc(why)}</p>` : "";
  return `
    <div class="line ${kind}">
      <p class="label">${esc(label)}</p>
      <p class="money">${esc(shown)}</p>
      ${whyHtml}
    </div>
  `;
}

function money(amount) {
  return formatSgd(amount);
}

function cents(amount) {
  return formatSgd(amount, { digits: 2 });
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character]));
}
