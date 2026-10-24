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
  bankerShow: "",
  bankerPledge: "",
  disbursementDate: "",
};

const form = document.querySelector("#planner");
const summary = document.querySelector("#summary");
const timeline = document.querySelector("#timeline");
const detail = document.querySelector("#detail");
const live = document.querySelector("#live");
const status = document.querySelector("#status");
const tenureOut = document.querySelector("#tenure-out");

/** Which disclosures stay open when the figures are redrawn. */
const openSections = new Set();

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
    title: "Pay 5%",
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
    title: "Stamp duty",
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
    title: "Pay 1%",
    payWith: "Cheque / cashier's order",
    todo: "This takes the option. If you do not exercise, this 1% is normally forfeited.",
    timing: "OTP date",
  },
  exercise: {
    title: "Exercise + 4%",
    payWith: "Cheque / cashier's order",
    todo: "With the option fee, the deposit is 5%.",
    timing: "14 days from the OTP",
  },
  "stamp-duty": {
    title: "Stamp duty",
    payWith: "Cheque / cashier's order / CPF",
    todo: "Buyer's stamp duty plus any ABSD.",
    timing: "14 days from exercise",
  },
  completion: {
    title: "Completion",
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
  for (const id of ["price", "debt", "salary-1", "salary-2", "salary-3", "salary-4", "banker-show", "banker-pledge"]) {
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
  form.elements["banker-show"].value = state.bankerShow ?? "";
  form.elements["banker-pledge"].value = state.bankerPledge ?? "";
  form.elements["disbursement-date"].value = state.disbursementDate ?? "";
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
    bankerShow: form.elements["banker-show"].value,
    bankerPledge: form.elements["banker-pledge"].value,
    disbursementDate: form.elements["disbursement-date"].value,
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
    bankerShow: state.bankerShow.trim(),
    bankerPledge: state.bankerPledge.trim(),
    disbursementDate: state.disbursementDate,
  };
}

function draw() {
  const state = collectState();
  syncVisibility(state);
  status.textContent = sameAsExample(state)
    ? "Spreadsheet example. Figures update as you type."
    : "Figures update as you type and stay in this browser.";

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
  showTenure(result.maxTenureYears);
  summary.innerHTML = renderSummary(result);
  renderFunds(result);
  timeline.innerHTML = renderPaymentTimeline(result);
  detail.innerHTML = renderDetail(result);
  mountDisclosures(summary);
  mountDisclosures(timeline);
  mountDisclosures(detail);
  live.textContent = [
    `Total cash and CPF ${money(result.totalCashCpf)}.`,
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
  const bankerShow = optionalMoney(state.bankerShow, "banker-show", "The banker's show-funds figure needs to be a number, or blank.", problems);
  const bankerPledge = optionalMoney(state.bankerPledge, "banker-pledge", "The banker's pledged-funds figure needs to be a number, or blank.", problems);
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
      bankerShowFunds: bankerShow,
      bankerPledgedFunds: bankerPledge,
      disbursementDate: state.disbursementDate || null,
    },
  };
}

function optionalMoney(raw, field, message, problems) {
  if (raw.trim() === "") return null;
  const value = parseMoney(raw);
  if (value == null || Number.isNaN(value) || value < 0) {
    problems.push({ field, message });
    return null;
  }
  return value;
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

function showTenure(years) {
  if (!(years > 0)) {
    tenureOut.textContent = "—";
    return;
  }
  const rounded = Math.round(years * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  tenureOut.textContent = `${text} yrs`;
}

function formatRate(rate) {
  if (!Number.isFinite(rate)) return "—";
  return `${(Math.round(rate * 10000) / 100).toFixed(2)}%`;
}

function renderProblems(problems) {
  const calm = problems.every((problem) => problem.calm);
  const items = problems.map((problem) => `<p>${esc(problem.message)}</p>`).join("");
  showTenure(null);
  summary.innerHTML = calm
    ? `<section class="results"><p class="result-line">${esc(problems[0].message)}</p></section>`
    : `<div class="note">${items}</div>`;
  document.getElementById("funds").hidden = true;
  timeline.innerHTML = "";
  detail.innerHTML = "";
  live.textContent = problems[0].message;
}

function renderSummary(result) {
  const monthly = result.monthlyRepayment == null ? "—" : money(result.monthlyRepayment);
  const salary = result.minSalaryTdsr == null ? "—" : money(result.minSalaryTdsr);
  const tenureNote = result.maxTenureYears > 0
    ? `${tenureOut.textContent} at ${formatRate(result.annualInterestRate)}`
    : "No usable tenure";

  return `
    <section class="results" aria-label="Main figures">
      <div class="figures">
        <article class="figure-total">
          <h2>Total cash / CPF</h2>
          <p class="figure">${esc(money(result.totalCashCpf))}</p>
          <p class="figure-note">Not all of this is due at booking.</p>
        </article>
        ${whenNeeded(result)}
        <article class="figure-monthly">
          <h2>Monthly repayment</h2>
          <p class="figure">${esc(monthly)}</p>
          <p class="figure-note">${esc(tenureNote)}</p>
        </article>
        <article class="figure-salary">
          <h2>Minimum salary (55% TDSR)</h2>
          <p class="figure">${esc(salary)}</p>
          <p class="figure-note">Combined gross monthly</p>
        </article>
      </div>
      <div class="facts" aria-label="More of the main figures">
        ${fact("Loan", result.estimatedLoan == null ? "—" : money(result.estimatedLoan))}
        ${fact("Stamp duty", money(result.totalStampDuty))}
      </div>
    </section>
    ${summaryNotes(result)}
  `;
}

function whenNeeded(result) {
  const needed = result.cashNeeded;
  if (!needed || needed.items.length === 0) return "";
  const total = needed.total || result.totalCashCpf;
  const bar = needed.items.map((item) => {
    const share = total > 0 ? (item.amount / total) * 100 : 0;
    return `<span style="width:${share}%"></span>`;
  }).join("");
  const rows = needed.items.map((item) => {
    if (item.kind === "group") {
      const parts = (item.parts || []).map((part) => `
        <li>
          <span>${esc(part.date ? formatDate(part.date) : "Add the date")}</span>
          <span>${esc(part.label)}</span>
          <span>${esc(money(part.amount))}</span>
        </li>
      `).join("");
      return `
        <li>
          <details class="when-group" data-keep="when-${esc(item.id)}">
            <summary>
              <span class="when-when">${esc(item.date ? `By ${formatDate(item.date)}` : "Add the date")}</span>
              <span class="when-label">${esc(item.label)}</span>
              <span class="when-amt">${esc(money(item.amount))}</span>
            </summary>
            <ul>${parts}</ul>
          </details>
        </li>
      `;
    }
    const when = item.date
      ? (result.mode === "new_launch" ? formatMonthYear(item.date) : formatDate(item.date))
      : "Add the date";
    return `
      <li class="when-row">
        <span class="when-when">${esc(when)}</span>
        <span class="when-label">${esc(item.label)}</span>
        <span class="when-amt">${esc(money(item.amount))}</span>
      </li>
    `;
  }).join("");
  const start = needed.repaymentsStart;
  const startLine = start
    ? `<p class="when-loan">${esc(start.date ? `Loan repayments start around ${formatMonthYear(start.date)}.` : "Loan repayments start when the bank first pays out.")}</p>`
    : "";

  return `
    <div class="when">
      <h3>When you'll need it</h3>
      <div class="when-bar" aria-hidden="true">${bar}</div>
      <ol>${rows}</ol>
      ${startLine}
    </div>
  `;
}

function summaryNotes(result) {
  const blocks = [];
  if (result.warnings.some((warning) => warning.code === "iwaa-shortfall")) {
    blocks.push(`<p>The age rule cuts the loan to ${esc(formatPercent(result.iwaaLtv))} of the price, ${esc(money(result.ltvShortfall))} less than the LTV you typed. The total cash / CPF follows the LTV you typed, same as the spreadsheet. If the bank uses the lower limit, that shortfall is extra cash or CPF.</p>`);
  }
  if (result.warnings.some((warning) => warning.code === "ltv-above-75")) {
    blocks.push(`<p>The LTV you typed is above 75%. The spreadsheet still adds a 5% foundation top-up, so the total cash / CPF does not fall any further. The stage table follows the LTV you typed, and above 75% those two can disagree. Most bank loans for a private home stop at 75%, or 55% when the loan would run past age 65.</p>`);
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
    fold("cash", "How the total cash / CPF is built", cashSection(result)),
    fold("loan", "The loan, age and LTV", loanSection(result)),
    fold("income", "Salary and show funds", incomeSection(result)),
  ].join("");
}

function fold(key, title, body) {
  return `<details class="fold" data-keep="${esc(key)}"><summary>${esc(title)}</summary><div class="fold-body">${body}</div></details>`;
}

function cashSection(result) {
  if (result.mode === "new_launch") {
    const launch = result.newLaunch;
    const match = launch.stageCashMatchesTopUp
      ? "The foundation top-up and any extra for an LTV under 75% are not another bill on top of the stage table. Added together, they equal the Cash / CPF column there. The earliest stages take that cash first."
      : "Above a 75% LTV the spreadsheet still adds the 5% foundation top-up, while the stage table follows the LTV you typed. Do not add the two totals together.";
    return `
      <section>
        <p class="section-lead">${esc(match)}</p>
        ${line("Option fee, 5%", launch.optionFee, "Paid on the booking date to receive the option.")}
        ${line("Of which 1.25% is forfeitable", launch.forfeitable, "Kept by the developer if you do not exercise.", "sub")}
        ${line("Of which 3.75% is refundable", launch.refundable, "Returned if you do not exercise.", "sub")}
        ${line("Further 15%", launch.furtherPayment, "Due 8 weeks after booking.")}
        ${line("Buyer's stamp duty (BSD)", result.bsd, "Tax in rising steps. Not a flat percentage of the whole price.")}
        ${line(`Additional buyer's stamp duty (ABSD) at ${formatPercent(result.absdRate)}`, result.absd, "Price multiplied by the ABSD rate you chose.")}
        ${line("Foundation top-up", launch.foundationTopUp, "The spreadsheet always includes this 5%. It is the cash piece inside a 75% loan.")}
        ${line("Additional top-up, LTV under 75%", launch.additionalTopUp, "MAX(0, 75% minus your LTV) times the price. Zero when your LTV is 75% or more.")}
        ${line("Total cash / CPF", result.totalCashCpf, "The sum of the lines above. Below 75% LTV, some of it is paid as the building goes up.", "total")}
      </section>
    `;
  }

  const resale = result.resale;
  return `
    <section>
      <p class="section-lead">Resale cash is the 5% deposit, stamp duty, and whatever down payment is still left at completion. Cash and CPF stay together.</p>
      ${line("Option fee, 1%", resale.optionFee, "Paid on the OTP date. Normally forfeited if you do not exercise.")}
      ${line("Exercise payment, 4%", resale.exercisePayment, "14 days later. Brings the deposit to 5%.")}
      ${line("Buyer's stamp duty (BSD)", result.bsd, "Same residential steps as a new launch.")}
      ${line(`Additional buyer's stamp duty (ABSD) at ${formatPercent(result.absdRate)}`, result.absd, "Price multiplied by the ABSD rate you chose.")}
      ${line("Rest of the down payment", resale.remainingDownPayment, "Due at completion. This is your LTV's down payment, minus the 5% deposit.")}
      ${line("Total cash / CPF", result.totalCashCpf, "Deposit, stamp duty and the completion balance.", "total")}
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
      <p class="section-lead">The repayment uses the lower of the loan you asked for and the age-based limit. That is the spreadsheet's estimated loan.</p>
      ${line("LTV you typed", null, `${formatPercent(result.enteredLtv)} of the price.`, "", formatPercent(result.enteredLtv))}
      ${line("Loan at that LTV", result.loanAtEnteredLtv)}
      ${line("Income-weighted average age", null, "Each buyer's age, weighted by monthly salary. Blank rows are ignored.", "", iwaaText)}
      ${line("Max loan tenure", null, result.iwaa === 0 ? "30 years when the weighted age is 0, including when no salary is entered." : "The lesser of 30 years and 65 minus the weighted age.", "", formatTenure(result.maxTenureYears))}
      ${line("Age-based LTV limit", null, "55% if the weighted age plus 30 years is over 65. Otherwise 75%.", "", formatPercent(result.iwaaLtv))}
      ${line("Loan at the age-based limit", result.loanAtIwaaLtv)}
      ${line("Estimated loan", result.estimatedLoan, "The lower of the two loans. The monthly repayment is based on this.")}
      ${line("LTV shortfall", result.ltvShortfall, "How much less the age rule lends, compared with the LTV you typed.")}
      ${line("Highest price this loan supports", null, "Estimated loan divided by the LTV you typed. It drops below your price when the age rule cuts the loan.", "", priceLine)}
      ${line("Exact monthly repayment", null, "Salary figures are rounded from this exact amount, not from the already-rounded figure at the top.", "", result.monthlyRepayment == null ? "—" : formatSgd(result.monthlyRepayment, { digits: 2 }))}
    </section>
  `;
}

function incomeSection(result) {
  return `
    <section>
      <p class="section-lead">TDSR is the test banks apply to private homes. MSR is shown beside it because HDB and executive condos use 30%.</p>
      ${line("Monthly repayment", result.monthlyRepayment, "Rounded to the nearest dollar here. The exact amount is in the loan section.", "", result.monthlyRepayment == null ? "—" : money(result.monthlyRepayment))}
      ${line("Other monthly debt", result.otherMonthlyDebt)}
      ${line("Minimum salary at 55% TDSR", result.minSalaryTdsr, "Repayment plus other debt, divided by 0.55. Rounded to the nearest dollar.")}
      ${line("Minimum salary at 30% MSR", result.minSalaryMsr, "Repayment divided by 0.3. Other debt is not included. For comparison.")}
      ${line("Salary entered", result.totalMonthlySalary, "The monthly salaries you typed, added up.")}
      ${line("Income shortfall", result.incomeShortfall, "How far the entered salary is below the TDSR minimum. Zero if income is already enough.")}
      ${line("Show funds, unpledged", result.fundPlan.show.amount, fundWhy(result.fundPlan.show, "Shortfall × 48 months ÷ 0.3, rounded up to the next S$1,000. Unpledged savings are only counted at 30%. Not part of the total cash / CPF."))}
      ${line("Show funds, pledged", result.fundPlan.pledge.amount, fundWhy(result.fundPlan.pledge, "Shortfall × 48 months, rounded up to the next S$1,000. Locked for 48 months. Not part of the total cash / CPF."))}
    </section>
  `;
}

function renderPaymentTimeline(result) {
  const groups = groupPhases(withFundMarkers(result));
  const phases = groups.map((group) => phaseBlock(result, group)).join("");
  const table = result.mode === "new_launch" ? stageTable(result) : "";

  return `
    <section class="pay-timeline" aria-labelledby="timeline-heading">
      <h2 id="timeline-heading">Payment timeline</h2>
      ${phases}
      ${stepNotes(result)}
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
  return `
    <section class="phase phase-${esc(group.id)}">
      <h3 class="phase-label">${esc(phase.title)}</h3>
      <div class="rail-scroll" tabindex="0" aria-label="${esc(phase.title)}">
        <ol class="rail">${items}</ol>
      </div>
    </section>
  `;
}

function withFundMarkers(result) {
  const steps = result.paymentTimeline.map((step) => ({ ...step }));
  const plan = result.fundPlan;
  if (!plan || !((plan.show.amount || 0) > 0 || (plan.pledge.amount || 0) > 0)) return steps;

  const inserts = [];
  const exerciseIndex = steps.findIndex((step) => step.id === "exercise");
  if (exerciseIndex >= 0) {
    inserts.push({
      index: exerciseIndex,
      marker: {
        id: "fund-application",
        kind: "marker",
        phase: steps[exerciseIndex].phase,
        date: plan.applicationBy,
      },
    });
  }
  const payoutIndex = steps.findIndex((step) => step.id === plan.estimatedDisbursementId);
  if (payoutIndex >= 0) {
    inserts.push({
      index: payoutIndex,
      marker: {
        id: "fund-before-payout",
        kind: "marker",
        phase: steps[payoutIndex].phase,
        date: plan.showReadyBy || plan.disbursement,
      },
    });
  }
  inserts.sort((a, b) => b.index - a.index);
  for (const item of inserts) steps.splice(item.index, 0, item.marker);
  return steps;
}

function stepCard(result, step) {
  if (step.kind === "marker") return markerCard(result, step);
  const copy = stepCopy(result, step);
  const when = !step.date
    ? "Add the date"
    : step.kind === "stage"
      ? formatMonthYear(step.date)
      : formatDate(step.date);
  return `
    <li class="step">
      <p class="step-date">${esc(when)}</p>
      <h4>${esc(copy.title)}</h4>
      <p class="step-amount">${esc(stepAmount(step))}</p>
      ${stepMeta(step) ? `<p class="meta">${esc(stepMeta(step))}</p>` : ""}
    </li>
  `;
}

function markerCard(result, step) {
  const plan = result.fundPlan;
  const title = step.id === "fund-application"
    ? "Loan application: show proof of funds"
    : "Before first loan payout: show funds ready / pledge in fixed deposit";
  const when = step.date ? `By ${formatDate(step.date)}` : "Add the date";
  const amounts = [];
  if (plan.show.amount > 0) amounts.push(`Show ${money(plan.show.amount)}`);
  if (plan.pledge.amount > 0) amounts.push(`Pledge ${money(plan.pledge.amount)}`);
  const note = step.id === "fund-application"
    ? "Not a payment. The letter of offer is signed before you exercise."
    : "Not a payment. Have the money ready, or in a fixed deposit, before the bank pays out.";
  return `
    <li class="step step-marker">
      <p class="step-date">${esc(when)}</p>
      <h4>${esc(title)}</h4>
      <p class="step-amount"></p>
      <p class="meta">${esc([...amounts, note].join(" · "))}</p>
    </li>
  `;
}

function stepAmount(step) {
  if (step.kind === "stage") {
    if (step.cashAmount > 0) return money(step.cashAmount);
    return step.monthlyRepayment == null ? "" : `${money(step.monthlyRepayment)}/mo`;
  }
  if (!(step.amount > 0)) return "";
  return money(step.amount);
}

function stepMeta(step) {
  const soFar = `Total cash / CPF so far ${money(step.runningCash)}`;
  if (step.kind === "stage") {
    const bits = [formatPercent(step.percent)];
    if (step.cashAmount > 0 && step.bankAmount > 0) bits.push("cash + bank");
    else if (step.bankAmount > 0) bits.push("bank");
    if (step.cashAmount > 0 && step.monthlyRepayment != null) bits.push(`${money(step.monthlyRepayment)}/mo`);
    bits.push(soFar);
    return bits.join(" · ");
  }
  if (!(step.amount > 0) && step.loanDisbursed == null) return "";
  const bits = [];
  if (step.loanDisbursed != null) bits.push(`loan ${money(step.loanDisbursed)}`);
  if (step.monthlyRepayment != null) bits.push(`${money(step.monthlyRepayment)}/mo`);
  bits.push(soFar);
  return bits.join(" · ");
}

function stepNotes(result) {
  const items = result.paymentTimeline.map((step) => {
    const copy = stepCopy(result, step);
    const note = [copy.timing, copy.todo].filter(Boolean).join(" ");
    if (!note) return "";
    return `<li><strong>${esc(copy.title)}</strong> ${esc(note)}</li>`;
  }).join("");
  if (!items) return "";
  return `<details class="fold" data-keep="step-notes"><summary>What to do at each step</summary><ul class="notes">${items}</ul></details>`;
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

function mountDisclosures(root) {
  for (const details of root.querySelectorAll("details[data-keep]")) {
    const key = details.dataset.keep;
    details.open = openSections.has(key);
    details.addEventListener("toggle", () => {
      if (details.open) openSections.add(key);
      else openSections.delete(key);
    });
  }
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
    <details class="stage-table" data-keep="stage-table">
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

function renderFunds(result) {
  const card = document.getElementById("funds");
  const plan = result.fundPlan;
  card.hidden = false;
  paintFund("show", plan.show, "income shortfall × 48 ÷ 0.3");
  paintFund("pledge", plan.pledge, "income shortfall × 48");
  document.getElementById("show-steps").innerHTML = plan.show.amount > 0 ? showChecklist(plan) : "";
  document.getElementById("pledge-steps").innerHTML = plan.pledge.amount > 0 ? pledgeChecklist(plan) : "";
  document.getElementById("disbursement-hint").textContent = disbursementHint(plan);
}

function paintFund(key, fund, formula) {
  const amount = document.getElementById(`${key}-amount`);
  const source = document.getElementById(`${key}-source`);
  const calc = document.getElementById(`${key}-calc`);
  amount.textContent = fund.amount == null ? "—" : money(fund.amount);
  if (fund.override != null) {
    source.textContent = "Banker's figure";
    const calculated = fund.calculated == null ? "—" : money(fund.calculated);
    calc.textContent = `Calculated: ${calculated} (${formula})`;
  } else if (fund.calculated === 0) {
    source.textContent = "Not needed based on the salaries entered.";
    calc.textContent = "";
  } else if (fund.calculated == null) {
    source.textContent = "No repayment to test against.";
    calc.textContent = "";
  } else {
    source.textContent = "Calculated";
    calc.textContent = "";
  }
}

function showChecklist(plan) {
  return `
    <li>
      <p class="fund-when">${esc(byDate(plan.applicationBy))}</p>
      <p>During the loan application, show proof of these funds, such as a bank statement or a screenshot.</p>
      ${letterNote(plan)}
    </li>
    <li>
      <p class="fund-when">${esc(plan.showReadyBy ? `Have ready by ${formatDate(plan.showReadyBy)}` : "Add the date of the first loan payout")}</p>
      <p>A few days before the loan is paid out, at the law firm. The firm will tell you the exact day. Have the funds ready at least one week before${plan.disbursement ? ` ${esc(formatDate(plan.disbursement))}` : " the payout"}.</p>
    </li>
  `;
}

function pledgeChecklist(plan) {
  const until = plan.pledgeUntil ? formatDate(plan.pledgeUntil) : null;
  const about = plan.disbursementOverridden ? "" : "about ";
  const hold = until
    ? `Keep them there for at least 4 years, until ${about}${until}.`
    : "Keep them there for at least 4 years.";
  return `
    <li>
      <p class="fund-when">${esc(byDate(plan.applicationBy))}</p>
      <p>During the loan application, show a screenshot of these funds in a bank statement.</p>
      ${letterNote(plan)}
    </li>
    <li>
      <p class="fund-when">${esc(plan.disbursement ? `Before ${formatDate(plan.disbursement)}` : "Before the first loan payout")}</p>
      <p>Place them in a fixed deposit with your lending bank, and set that up before the loan is paid out. ${esc(hold)}</p>
    </li>
  `;
}

function letterNote(plan) {
  const from = plan.applicationFrom ? formatDate(plan.applicationFrom) : null;
  const anchor = plan.mode === "resale" ? "the OTP date" : "the booking date";
  return `<p class="fund-note">The bank's letter of offer must be signed before you exercise the sale and purchase. Start around ${from ? esc(from) : anchor}.</p>`;
}

function byDate(iso) {
  return iso ? `By ${formatDate(iso)}` : "Add a booking or OTP date";
}

function disbursementHint(plan) {
  if (!plan.estimatedDisbursement) {
    return "The timeline has no bank payout yet. A date here is used for the checklist.";
  }
  const estimated = `${formatDate(plan.estimatedDisbursement)}${plan.estimatedDisbursementLabel ? `, ${plan.estimatedDisbursementLabel}` : ""}`;
  if (plan.disbursementOverridden) {
    return `Using ${formatDate(plan.disbursement)} for these funds. The timeline still estimates the first bank payout on ${estimated}.`;
  }
  return `Estimated first payout: ${estimated}. Leave this blank to keep that date.`;
}

function fundWhy(fund, base) {
  if (fund.override == null) return base;
  const calculated = fund.calculated == null ? "—" : money(fund.calculated);
  return `Banker's figure in use. Calculated: ${calculated}. ${base}`;
}

function fact(label, value) {
  return `<p class="fact"><span>${esc(label)}</span>${esc(value)}</p>`;
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
