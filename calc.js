/**
 * Home figures — the maths for one Singapore private home.
 *
 * This file is the spreadsheet, translated. It does not touch the page.
 * app.js calls calculateProperty() and draws whatever comes back.
 * A later comparison screen can call it once per home (see compareProperties).
 * Nothing in here is remembered between calls.
 *
 * Rules follow the Timeline sheet and its Notes. Resale dates are not in
 * that sheet; they live in RESALE_TERMS and are explained in the README.
 *
 * Money is worked out in cents so "75% of the price" cannot become
 * 89999.999999 from the way computers store decimals.
 */

export const STANDARD_ABSD_RATES = [0, 0.05, 0.2, 0.3, 0.6, 0.65];

/** Rates are shares of the price (0.05 means 5%). Days are calendar days. */
export const NEW_LAUNCH_TERMS = {
  optionFeeRate: 0.05,
  forfeitableRate: 0.0125,
  refundableRate: 0.0375,
  furtherPaymentRate: 0.15,
  daysToReceiveSaleAndPurchase: 3,
  daysFromSaleAndPurchaseToExercise: 21,
  stampDutyDaysAfterExercise: 14,
  daysFromBookingToFurtherPayment: 56,
  foundationDaysFromLaunch: 180,
  referenceLtv: 0.75,
  foundationTopUpRate: 0.05,
  firstCashTrancheRate: 0.2,
};

/**
 * Private resale practice used by this app. Not from the spreadsheet.
 * Completion is 10 weeks after exercise, inside the usual 8–12 week range.
 */
export const RESALE_TERMS = {
  optionFeeRate: 0.01,
  exercisePaymentRate: 0.04,
  optionPeriodDays: 14,
  stampDutyDaysAfterExercise: 14,
  completionWeeksAfterExercise: 10,
  completionDaysAfterExercise: 70,
};

/**
 * Progressive stages after the first 20% (option fee 5% + further 15%).
 * Percentages sum to 80%. Months match the spreadsheet. The foundation
 * date itself is launch + 180 days; its "6 months" is not added again.
 */
export const PROGRESSIVE_STAGES = [
  { id: "foundation", label: "Foundation", percent: 0.1, monthsAfterPrevious: 6 },
  { id: "framework", label: "Framework", percent: 0.1, monthsAfterPrevious: 6 },
  { id: "wall", label: "Wall", percent: 0.05, monthsAfterPrevious: 3 },
  { id: "ceiling", label: "Ceiling", percent: 0.05, monthsAfterPrevious: 3 },
  { id: "doors", label: "Door & window", percent: 0.05, monthsAfterPrevious: 3 },
  { id: "carpark", label: "Car park", percent: 0.05, monthsAfterPrevious: 3 },
  { id: "top", label: "TOP", percent: 0.25, monthsAfterPrevious: 12 },
  { id: "csc", label: "CSC", percent: 0.15, monthsAfterPrevious: 12 },
];

const FULL = 1_000_000; // 100% in millionths, so 5% is 50_000

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function rateMillionths(rate) {
  return Math.round(rate * FULL);
}

/** Whole cents. Rounds half up, including on very large prices. */
function portionCents(priceCents, rate) {
  const millionths = BigInt(rateMillionths(rate));
  const cents = BigInt(priceCents);
  return Number((cents * millionths + 500_000n) / 1_000_000n);
}

function dollars(cents) {
  return cents / 100;
}

function priceToCents(price) {
  return Math.round(price * 100);
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function finiteOrNull(value) {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : NaN;
}

/**
 * Residential Buyer's Stamp Duty, in the bands from the spreadsheet:
 * 1% on the first $180k, 2% on the next $180k, 3% on the next $640k,
 * 4% on the next $500k, 5% on the next $1.5M, 6% above $3M.
 * IRAS rounds the tax down to the next dollar. This follows the sheet and keeps cents.
 */
export function buyersStampDuty(price) {
  if (!(price > 0)) return 0;
  const bands = [
    [180_000, 0.01],
    [180_000, 0.02],
    [640_000, 0.03],
    [500_000, 0.04],
    [1_500_000, 0.05],
    [Number.POSITIVE_INFINITY, 0.06],
  ];
  let remainingCents = priceToCents(price);
  let dutyCents = 0;
  for (const [widthDollars, rate] of bands) {
    if (remainingCents <= 0) break;
    const widthCents = widthDollars === Number.POSITIVE_INFINITY
      ? remainingCents
      : Math.round(widthDollars * 100);
    const slice = Math.min(remainingCents, widthCents);
    dutyCents += portionCents(slice, rate);
    remainingCents -= slice;
  }
  return dollars(dutyCents);
}

export function isStandardAbsdRate(rate) {
  if (!Number.isFinite(rate)) return false;
  return STANDARD_ABSD_RATES.some((standard) => rateMillionths(standard) === rateMillionths(rate));
}

/**
 * Income-weighted average age. A higher salary pulls the average toward that age.
 * Returns 0 when nobody has a salary, which is the spreadsheet's signal for
 * "use a 30-year tenure".
 */
export function incomeWeightedAverageAge(buyers) {
  let weighted = 0;
  let salaryTotal = 0;
  for (const buyer of buyers) {
    if (!(buyer.monthlySalary > 0)) continue;
    const age = buyer.age > 0 ? buyer.age : 0;
    weighted += age * buyer.monthlySalary;
    salaryTotal += buyer.monthlySalary;
  }
  if (salaryTotal === 0) return 0;
  return weighted / salaryTotal;
}

/** 30 years when IWAA is 0, otherwise the lesser of 30 and 65 minus IWAA. */
export function maxTenureYears(iwaa) {
  if (iwaa === 0) return 30;
  return Math.min(30, 65 - iwaa);
}

/** 55% when a 30-year loan would run past age 65, otherwise 75%. */
export function ltvFromIwaa(iwaa) {
  if (iwaa > 0 && iwaa + 30 > 65) return 0.55;
  return 0.75;
}

/**
 * Monthly principal-and-interest payment. Same shape as Excel's PMT
 * with the loan stored as a positive number.
 */
export function monthlyRepayment(annualRate, tenureYears, principal) {
  if (!(principal > 0)) return 0;
  if (!(tenureYears > 0) || !Number.isFinite(tenureYears)) return null;
  if (!(annualRate >= 0) || !Number.isFinite(annualRate)) return null;
  const payments = tenureYears * 12;
  if (annualRate === 0) return principal / payments;
  const monthlyRate = annualRate / 12;
  const growth = (1 + monthlyRate) ** payments;
  if (!Number.isFinite(growth) || growth === 1) return null;
  return (principal * monthlyRate * growth) / (growth - 1);
}

/** Excel ROUNDUP(amount, -3): up to the next thousand, exact thousands stay put. */
export function roundUpToThousand(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.ceil(amount / 1000 - 1e-9) * 1000;
}

export function addDays(iso, days) {
  if (!isIsoDate(iso) || !Number.isFinite(days)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Excel EDATE. 31 Jan plus one month is 28 Feb, or 29 Feb in a leap year. */
export function addMonths(iso, months) {
  if (!isIsoDate(iso) || !Number.isFinite(months)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const monthIndex = month - 1 + months;
  const yearShift = Math.floor(monthIndex / 12);
  const nextMonth = monthIndex - yearShift * 12;
  const nextYear = year + yearShift;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
  const nextDay = Math.min(day, lastDay);
  const monthText = String(nextMonth + 1).padStart(2, "0");
  const dayText = String(nextDay).padStart(2, "0");
  return `${nextYear}-${monthText}-${dayText}`;
}

export function formatSgd(amount, options = {}) {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const digits = options.digits ?? 0;
  const negative = amount < 0;
  const factor = 10 ** digits;
  const rounded = Math.round(Math.abs(amount) * factor) / factor;
  const [whole, fraction = ""] = rounded.toFixed(digits).split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}S$${withCommas}${digits ? `.${fraction}` : ""}`;
}

export function formatSgdAuto(amount) {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const cents = Math.round(Math.abs(amount) * 100);
  return formatSgd(amount, { digits: cents % 100 === 0 ? 0 : 2 });
}

export function formatPercent(rate) {
  if (!Number.isFinite(rate)) return "—";
  const percent = Math.round(rate * 10000) / 100;
  return `${percent}%`;
}

export function formatTenure(years) {
  if (!Number.isFinite(years)) return "—";
  const rounded = Math.round(years * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  const unit = Math.abs(rounded) === 1 ? "year" : "years";
  return `${text} ${unit}`;
}

export function formatDate(iso) {
  if (!isIsoDate(iso)) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Stage dates are estimates, so the timeline shows the month and year. */
export function formatMonthYear(iso) {
  if (!isIsoDate(iso)) return "—";
  const [year, month] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

/** Adds cash/CPF paid at each step into a running total. Null payments add nothing. */
function attachRunningCash(steps) {
  let cents = 0;
  return steps.map((step) => {
    cents += Math.round((step.cashDue || 0) * 100);
    return { ...step, runningCash: cents / 100 };
  });
}

function normalizeBuyers(buyers) {
  const source = Array.isArray(buyers) ? buyers : [];
  return source.map((buyer) => ({
    age: finiteOrNull(buyer?.age),
    monthlySalary: finiteOrNull(buyer?.monthlySalary),
  }));
}

function invalid(errors) {
  return { ok: false, errors, warnings: [] };
}

function progressiveStages(priceCents, ltv, annualRate, tenureYears, launchDate) {
  const cashBeyond = Math.max(0, FULL - rateMillionths(ltv) - rateMillionths(NEW_LAUNCH_TERMS.firstCashTrancheRate));
  let previousPercent = 0;
  let cumulativeBankCents = 0;
  let date = isIsoDate(launchDate) ? addDays(launchDate, NEW_LAUNCH_TERMS.foundationDaysFromLaunch) : null;

  return PROGRESSIVE_STAGES.map((stage, index) => {
    const stageScale = rateMillionths(stage.percent);
    const cashScale = Math.min(stageScale, Math.max(0, cashBeyond - previousPercent));
    const bankScale = stageScale - cashScale;
    const cashCents = Math.round(priceCents * cashScale / FULL);
    const bankCents = Math.round(priceCents * bankScale / FULL);
    cumulativeBankCents += bankCents;
    if (index > 0 && date) date = addMonths(date, stage.monthsAfterPrevious);
    previousPercent += stageScale;

    const cumulativeBank = dollars(cumulativeBankCents);
    const interest = cumulativeBank * annualRate / 12;
    const repayment = monthlyRepayment(annualRate, tenureYears, cumulativeBank);
    const principal = repayment == null ? null : repayment - interest;

    return {
      id: stage.id,
      label: stage.label,
      percent: stage.percent,
      monthsAfterPrevious: stage.monthsAfterPrevious,
      date,
      cashAmount: dollars(cashCents),
      bankPercent: bankScale / FULL,
      bankAmount: dollars(bankCents),
      cumulativeBank,
      monthlyInterest: interest,
      monthlyPrincipal: principal,
      monthlyRepayment: repayment,
    };
  });
}

/**
 * One home in, one result out.
 * `mode` is "new_launch" or "resale".
 * Rates are decimals: 0.75 means 75%, 0.04 means 4% a year.
 */
export function calculateProperty(input = {}) {
  const errors = [];
  const mode = input.mode === "resale" ? "resale" : input.mode === "new_launch" ? "new_launch" : null;
  if (!mode) errors.push({ field: "mode", message: "Choose new launch or resale." });

  const price = finiteOrNull(input.price);
  if (!(price > 0)) errors.push({ field: "price", message: "Enter a price above zero." });

  const ltv = finiteOrNull(input.ltv);
  if (!(ltv >= 0) || ltv > 1) {
    errors.push({ field: "ltv", message: "Enter a loan-to-value from 0% to 100%." });
  }

  const annualInterestRate = finiteOrNull(input.annualInterestRate);
  if (!(annualInterestRate >= 0) || annualInterestRate > 1) {
    errors.push({ field: "interest", message: "Enter an interest rate from 0% to 100% a year." });
  }

  const absdRate = finiteOrNull(input.absdRate);
  if (!(absdRate >= 0) || absdRate > 1) {
    errors.push({ field: "absd", message: "Enter an ABSD rate from 0% to 100%." });
  }

  const otherMonthlyDebt = finiteOrNull(input.otherMonthlyDebt) ?? 0;
  if (!(otherMonthlyDebt >= 0)) {
    errors.push({ field: "debt", message: "Other monthly debt cannot be negative." });
  }

  const bankerShow = optionalNonNegative(input.bankerShowFunds);
  const bankerPledge = optionalNonNegative(input.bankerPledgedFunds);
  if (Number.isNaN(bankerShow)) {
    errors.push({ field: "banker-show", message: "The banker's show-funds figure needs to be a number, or blank." });
  }
  if (Number.isNaN(bankerPledge)) {
    errors.push({ field: "banker-pledge", message: "The banker's pledged-funds figure needs to be a number, or blank." });
  }

  let disbursementOverride = null;
  if (input.disbursementDate != null && input.disbursementDate !== "") {
    if (!isIsoDate(input.disbursementDate)) {
      errors.push({ field: "disbursement-date", message: "The first loan payout date is not a real date." });
    } else {
      disbursementOverride = input.disbursementDate;
    }
  }

  const buyers = normalizeBuyers(input.buyers);
  buyers.forEach((buyer, index) => {
    if (buyer.age != null && !(buyer.age >= 0 && buyer.age <= 120)) {
      errors.push({ field: `age-${index + 1}`, message: `Buyer ${index + 1}'s age should be between 0 and 120.` });
    }
    if (Number.isNaN(buyer.age)) {
      errors.push({ field: `age-${index + 1}`, message: `Buyer ${index + 1}'s age is not a number.` });
    }
    if (buyer.monthlySalary != null && !(buyer.monthlySalary >= 0)) {
      errors.push({ field: `salary-${index + 1}`, message: `Buyer ${index + 1}'s salary cannot be negative.` });
    }
    if (Number.isNaN(buyer.monthlySalary)) {
      errors.push({ field: `salary-${index + 1}`, message: `Buyer ${index + 1}'s salary is not a number.` });
    }
  });

  if (errors.length > 0 || mode == null) return invalid(errors);

  const priceCents = priceToCents(price);
  const bsd = buyersStampDuty(price);
  const absd = dollars(portionCents(priceCents, absdRate));
  const totalStampDuty = dollars(priceToCents(bsd) + priceToCents(absd));

  const usableBuyers = buyers.map((buyer) => ({
    age: buyer.age == null || Number.isNaN(buyer.age) ? null : buyer.age,
    monthlySalary: buyer.monthlySalary > 0 ? buyer.monthlySalary : 0,
  }));
  const totalMonthlySalary = usableBuyers.reduce((sum, buyer) => sum + (buyer.monthlySalary || 0), 0);
  const iwaa = incomeWeightedAverageAge(usableBuyers);
  const tenure = maxTenureYears(iwaa);
  const iwaaLtv = ltvFromIwaa(iwaa);

  const loanAtEnteredCents = portionCents(priceCents, ltv);
  const loanAtIwaaCents = portionCents(priceCents, iwaaLtv);
  const estimatedLoanCents = Math.min(loanAtEnteredCents, loanAtIwaaCents);
  const shortfallCents = Math.max(0, loanAtEnteredCents - loanAtIwaaCents);
  const estimatedLoan = dollars(estimatedLoanCents);
  const repayment = monthlyRepayment(annualInterestRate, tenure, estimatedLoan);

  let minSalaryTdsr = null;
  let minSalaryMsr = null;
  let incomeShortfall = null;
  let showFundsUnpledged = null;
  let showFundsPledged = null;
  if (repayment != null) {
    minSalaryTdsr = (repayment + otherMonthlyDebt) / 0.55;
    minSalaryMsr = repayment / 0.3;
    incomeShortfall = Math.max(0, minSalaryTdsr - totalMonthlySalary);
    showFundsUnpledged = roundUpToThousand(incomeShortfall * 48 / 0.3);
    showFundsPledged = roundUpToThousand(incomeShortfall * 48);
  }

  const maxPropertyPrice = ltv > 0 ? dollars(Math.round(estimatedLoanCents * FULL / rateMillionths(ltv))) : null;

  const warnings = [];
  if (!isStandardAbsdRate(absdRate)) warnings.push({ code: "absd-nonstandard" });
  if (shortfallCents > 0) warnings.push({ code: "iwaa-shortfall" });
  if (!(tenure > 0)) warnings.push({ code: "tenure-unavailable" });

  const bookingDate = isIsoDate(input.bookingDate) ? input.bookingDate : null;
  const launchDate = isIsoDate(input.launchDate) ? input.launchDate : null;
  const otpDate = isIsoDate(input.otpDate) ? input.otpDate : null;

  let timeline;
  let paymentTimeline;
  let stages = null;
  let stageCashTotal = null;
  let stageBankTotal = null;
  let newLaunch = null;
  let resale = null;
  let totalCashCents;

  if (mode === "new_launch") {
    const optionCents = portionCents(priceCents, NEW_LAUNCH_TERMS.optionFeeRate);
    const forfeitableCents = portionCents(priceCents, NEW_LAUNCH_TERMS.forfeitableRate);
    const refundableCents = portionCents(priceCents, NEW_LAUNCH_TERMS.refundableRate);
    const furtherCents = portionCents(priceCents, NEW_LAUNCH_TERMS.furtherPaymentRate);
    const foundationCents = portionCents(priceCents, NEW_LAUNCH_TERMS.foundationTopUpRate);
    const additionalRate = Math.max(0, NEW_LAUNCH_TERMS.referenceLtv - ltv);
    const additionalCents = portionCents(priceCents, additionalRate);
    const stampCents = priceToCents(totalStampDuty);
    totalCashCents = optionCents + furtherCents + stampCents + foundationCents + additionalCents;

    stages = progressiveStages(priceCents, ltv, annualInterestRate, tenure, launchDate);
    const stageCashCents = stages.reduce((sum, stage) => sum + priceToCents(stage.cashAmount), 0);
    const stageBankCents = stages.reduce((sum, stage) => sum + priceToCents(stage.bankAmount), 0);
    stageCashTotal = dollars(stageCashCents);
    stageBankTotal = dollars(stageBankCents);

    if (ltv > NEW_LAUNCH_TERMS.referenceLtv) warnings.push({ code: "ltv-above-75" });

    const exerciseDate = bookingDate
      ? addDays(bookingDate, NEW_LAUNCH_TERMS.daysToReceiveSaleAndPurchase + NEW_LAUNCH_TERMS.daysFromSaleAndPurchaseToExercise)
      : null;

    newLaunch = {
      optionFee: dollars(optionCents),
      forfeitable: dollars(forfeitableCents),
      refundable: dollars(refundableCents),
      furtherPayment: dollars(furtherCents),
      foundationTopUp: dollars(foundationCents),
      additionalTopUp: dollars(additionalCents),
      stageCashMatchesTopUp: stageCashCents === foundationCents + additionalCents,
    };

    const receiveDate = bookingDate ? addDays(bookingDate, NEW_LAUNCH_TERMS.daysToReceiveSaleAndPurchase) : null;
    const stampDate = exerciseDate ? addDays(exerciseDate, NEW_LAUNCH_TERMS.stampDutyDaysAfterExercise) : null;
    const pay15Date = bookingDate ? addDays(bookingDate, NEW_LAUNCH_TERMS.daysFromBookingToFurtherPayment) : null;
    const foundationDate = launchDate ? addDays(launchDate, NEW_LAUNCH_TERMS.foundationDaysFromLaunch) : null;

    timeline = [
      { id: "option", date: bookingDate, amount: dollars(optionCents) },
      { id: "receive-sp", date: receiveDate, amount: null },
      { id: "exercise", date: exerciseDate, amount: null },
      { id: "stamp-duty", date: stampDate, amount: totalStampDuty },
      { id: "pay-15", date: pay15Date, amount: dollars(furtherCents) },
      { id: "foundation", date: foundationDate, amount: null },
    ];

    paymentTimeline = attachRunningCash([
      milestone("option", "within-8-weeks", bookingDate, dollars(optionCents), null),
      milestone("receive-sp", "within-8-weeks", receiveDate, null, "Within 2 weeks"),
      milestone("exercise", "within-8-weeks", exerciseDate, null, "Within 3 weeks"),
      milestone("stamp-duty", "within-8-weeks", stampDate, totalStampDuty, "Within 2 weeks"),
      milestone("pay-15", "within-8-weeks", pay15Date, dollars(furtherCents), "Completion"),
      ...stages.map((stage) => ({
        id: stage.id,
        kind: "stage",
        phase: "foundation-call",
        date: stage.date,
        amount: stage.cashAmount,
        cashDue: stage.cashAmount,
        cashAmount: stage.cashAmount,
        bankAmount: stage.bankAmount,
        percent: stage.percent,
        label: stage.label,
        monthlyRepayment: stage.monthlyRepayment,
        windowLabel: null,
      })),
    ]);
  } else {
    const optionCents = portionCents(priceCents, RESALE_TERMS.optionFeeRate);
    const exerciseCents = portionCents(priceCents, RESALE_TERMS.exercisePaymentRate);
    const depositCents = optionCents + exerciseCents;
    const downCents = portionCents(priceCents, 1 - ltv);
    const remainingCents = Math.max(0, downCents - depositCents);
    const stampCents = priceToCents(totalStampDuty);
    totalCashCents = depositCents + remainingCents + stampCents;
    if (downCents < depositCents) warnings.push({ code: "resale-deposit-exceeds-down-payment" });

    const exerciseDate = otpDate ? addDays(otpDate, RESALE_TERMS.optionPeriodDays) : null;
    const completionDate = exerciseDate ? addDays(exerciseDate, RESALE_TERMS.completionDaysAfterExercise) : null;

    resale = {
      optionFee: dollars(optionCents),
      exercisePayment: dollars(exerciseCents),
      deposit: dollars(depositCents),
      remainingDownPayment: dollars(remainingCents),
      depositExceedsDownPayment: downCents < depositCents,
    };

    const stampDate = exerciseDate ? addDays(exerciseDate, RESALE_TERMS.stampDutyDaysAfterExercise) : null;

    timeline = [
      { id: "option", date: otpDate, amount: dollars(optionCents) },
      { id: "exercise", date: exerciseDate, amount: dollars(exerciseCents) },
      { id: "stamp-duty", date: stampDate, amount: totalStampDuty },
      {
        id: "completion",
        date: completionDate,
        amount: dollars(remainingCents),
        loanDisbursed: estimatedLoan,
        monthlyRepayment: repayment,
      },
    ];

    paymentTimeline = attachRunningCash([
      milestone("option", "resale-option", otpDate, dollars(optionCents), null),
      milestone("exercise", "resale-option", exerciseDate, dollars(exerciseCents), "14 days to exercise"),
      milestone("stamp-duty", "resale-completion", stampDate, totalStampDuty, "Within 14 days of exercise"),
      {
        ...milestone("completion", "resale-completion", completionDate, dollars(remainingCents), "10 weeks after exercise"),
        loanDisbursed: estimatedLoan,
        monthlyRepayment: repayment,
      },
    ]);
  }

  return {
    ok: true,
    errors: [],
    warnings,
    mode,
    price,
    bsd,
    absd,
    absdRate,
    absdRateIsStandard: isStandardAbsdRate(absdRate),
    totalStampDuty,
    buyers: usableBuyers,
    totalMonthlySalary,
    salaryEntered: totalMonthlySalary > 0,
    iwaa,
    maxTenureYears: tenure,
    enteredLtv: ltv,
    iwaaLtv,
    loanAtEnteredLtv: dollars(loanAtEnteredCents),
    loanAtIwaaLtv: dollars(loanAtIwaaCents),
    estimatedLoan,
    ltvShortfall: dollars(shortfallCents),
    maxPropertyPrice,
    annualInterestRate,
    otherMonthlyDebt,
    monthlyRepayment: repayment,
    minSalaryTdsr,
    minSalaryMsr,
    incomeShortfall,
    showFundsUnpledged,
    showFundsPledged,
    totalCashCpf: dollars(totalCashCents),
    timeline,
    paymentTimeline,
    cashNeeded: buildCashNeeded(paymentTimeline, mode),
    fundPlan: buildFundPlan({
      mode,
      bookingDate,
      otpDate,
      steps: paymentTimeline,
      showCalculated: showFundsUnpledged,
      pledgeCalculated: showFundsPledged,
      showOverride: Number.isNaN(bankerShow) ? null : bankerShow,
      pledgeOverride: Number.isNaN(bankerPledge) ? null : bankerPledge,
      disbursementOverride,
    }),
    stages,
    stageCashTotal,
    stageBankTotal,
    newLaunch,
    resale,
  };
}

function milestone(id, phase, date, amount, windowLabel) {
  return {
    id,
    kind: "milestone",
    phase,
    date,
    amount,
    cashDue: amount ?? 0,
    windowLabel,
  };
}

function buildCashNeeded(steps, mode) {
  const owing = steps.filter((step) => (step.cashDue || 0) > 0);
  const items = [];

  if (mode === "new_launch") {
    const early = owing.filter((step) => step.phase === "within-8-weeks");
    const later = owing.filter((step) => step.phase !== "within-8-weeks");
    if (early.length > 0) {
      items.push({
        id: "within-8-weeks",
        kind: "group",
        label: "Within 8 weeks of booking",
        date: latestDate(early),
        amount: sumCash(early),
        parts: early.map((step) => cashPart(step, mode)),
      });
    }
    for (const step of later) items.push(cashPart(step, mode));
  } else {
    for (const step of owing) items.push(cashPart(step, mode));
  }

  const firstBank = steps.find((step) => (step.bankAmount || 0) > 0 || (step.loanDisbursed || 0) > 0);
  return {
    items,
    total: sumCash(items.map((item) => ({ cashDue: item.amount }))),
    repaymentsStart: firstBank ? { id: firstBank.id, date: firstBank.date } : null,
  };
}

function cashPart(step, mode) {
  return {
    id: step.id,
    kind: "payment",
    label: cashPartLabel(step, mode),
    date: step.date,
    amount: step.cashDue,
    parts: null,
  };
}

function cashPartLabel(step, mode) {
  if (step.kind === "stage") return step.label;
  if (step.id === "option") return mode === "resale" ? "1% option" : "5% option";
  if (step.id === "exercise") return "Exercise, 4%";
  if (step.id === "pay-15") return "15%";
  if (step.id === "stamp-duty") return "Stamp duty";
  if (step.id === "completion") return "Completion";
  return step.label || step.id;
}

function latestDate(steps) {
  return steps.reduce((latest, step) => {
    if (!step.date) return latest;
    if (!latest || step.date > latest) return step.date;
    return latest;
  }, null);
}

function sumCash(steps) {
  const cents = steps.reduce((sum, step) => sum + Math.round((step.cashDue || 0) * 100), 0);
  return cents / 100;
}

/** Blank stays blank. A negative or non-number is NaN so the caller can reject it. */
function optionalNonNegative(value) {
  if (value == null || value === "") return null;
  const number = finiteOrNull(value);
  if (!Number.isFinite(number) || number < 0) return Number.NaN;
  return number;
}

function fundFigure(calculated, override) {
  const hasOverride = override != null && !Number.isNaN(override);
  return {
    calculated,
    override: hasOverride ? override : null,
    amount: hasOverride ? override : calculated,
  };
}

/**
 * Show funds and pledged funds are savings to have ready, not payments.
 * Dates follow the loan: proof by exercise, then the first time the bank pays out.
 */
function buildFundPlan({
  mode,
  bookingDate,
  otpDate,
  steps,
  showCalculated,
  pledgeCalculated,
  showOverride,
  pledgeOverride,
  disbursementOverride,
}) {
  const exercise = steps.find((step) => step.id === "exercise");
  const firstBank = steps.find((step) => (step.bankAmount || 0) > 0 || (step.loanDisbursed || 0) > 0);
  const estimatedDisbursement = firstBank?.date ?? null;
  const overridden = isIsoDate(disbursementOverride);
  const disbursement = overridden ? disbursementOverride : estimatedDisbursement;

  return {
    mode,
    show: fundFigure(showCalculated, showOverride),
    pledge: fundFigure(pledgeCalculated, pledgeOverride),
    applicationBy: exercise?.date ?? null,
    applicationFrom: mode === "resale" ? otpDate : bookingDate,
    estimatedDisbursement,
    estimatedDisbursementId: firstBank?.id ?? null,
    estimatedDisbursementLabel: disbursementLabel(firstBank),
    disbursement,
    disbursementOverridden: overridden,
    showReadyBy: disbursement ? addDays(disbursement, -7) : null,
    pledgeUntil: disbursement ? addMonths(disbursement, 48) : null,
  };
}

function disbursementLabel(step) {
  if (!step) return null;
  if (step.label) return step.label;
  if (step.id === "completion") return "Completion";
  return null;
}

/** One result per home, in the same order. Used later for a side-by-side view. */
export function compareProperties(inputs) {
  return inputs.map((input) => calculateProperty(input));
}
