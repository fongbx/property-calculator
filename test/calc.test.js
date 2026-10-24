import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROGRESSIVE_STAGES,
  addDays,
  addMonths,
  buyersStampDuty,
  calculateProperty,
  compareProperties,
  formatDate,
  formatSgd,
  formatSgdAuto,
  ltvFromIwaa,
  maxTenureYears,
  roundUpToThousand,
} from "../calc.js";

const example = {
  mode: "new_launch",
  price: 1_800_000,
  bookingDate: "2026-10-31",
  launchDate: "2026-10-31",
  absdRate: 0,
  buyers: [],
  annualInterestRate: 0.04,
  otherMonthlyDebt: 0,
  ltv: 0.75,
};

function cents(amount) {
  return Math.round(amount * 100);
}

describe("the spreadsheet example", () => {
  const result = calculateProperty(example);

  it("matches the agreed new-launch figures", () => {
    assert.equal(result.ok, true);
    assert.equal(result.totalCashCpf, 509_600);
    assert.equal(result.loanAtEnteredLtv, 1_350_000);
    assert.equal(result.estimatedLoan, 1_350_000);
    assert.equal(Math.round(result.monthlyRepayment), 6_445);
    assert.equal(Math.round(result.minSalaryTdsr), 11_718);
    assert.equal(Math.round(result.minSalaryMsr), 21_484);
    assert.equal(result.showFundsUnpledged, 1_875_000);
    assert.equal(result.showFundsPledged, 563_000);
  });

  it("keeps the exact repayment that those rounded figures come from", () => {
    assert.ok(Math.abs(result.monthlyRepayment - 6445.106488783626) < 1e-6);
    assert.equal(result.bsd, 59_600);
    assert.equal(result.absd, 0);
    assert.equal(result.totalStampDuty, 59_600);
    assert.equal(result.iwaa, 0);
    assert.equal(result.maxTenureYears, 30);
    assert.equal(result.iwaaLtv, 0.75);
    assert.equal(result.maxPropertyPrice, 1_800_000);
    assert.equal(result.incomeShortfall, result.minSalaryTdsr);
    assert.equal(result.salaryEntered, false);
  });

  it("builds upfront cash the way the sheet does", () => {
    assert.equal(result.newLaunch.optionFee, 90_000);
    assert.equal(result.newLaunch.forfeitable, 22_500);
    assert.equal(result.newLaunch.refundable, 67_500);
    assert.equal(result.newLaunch.furtherPayment, 270_000);
    assert.equal(result.newLaunch.foundationTopUp, 90_000);
    assert.equal(result.newLaunch.additionalTopUp, 0);
    assert.equal(result.newLaunch.stageCashMatchesTopUp, true);
    const timed = result.timeline.reduce((sum, event) => sum + (event.amount ?? 0), 0);
    assert.equal(cents(timed + result.stageCashTotal), cents(result.totalCashCpf));
  });

  it("uses the sheet's key dates", () => {
    const byId = Object.fromEntries(result.timeline.map((event) => [event.id, event]));
    assert.equal(byId.option.date, "2026-10-31");
    assert.equal(byId["receive-sp"].date, "2026-11-03");
    assert.equal(byId.exercise.date, "2026-11-24");
    assert.equal(byId["stamp-duty"].date, "2026-12-08");
    assert.equal(byId["stamp-duty"].amount, 59_600);
    assert.equal(byId["pay-15"].date, "2026-12-26");
    assert.equal(byId["pay-15"].amount, 270_000);
    assert.equal(byId.foundation.date, "2027-04-29");
    assert.equal(byId.exercise.amount, null);
  });

  it("applies the cash waterfall to the foundation stage only, at 75% LTV", () => {
    assert.equal(result.stages.length, 8);
    assert.equal(result.stages[0].cashAmount, 90_000);
    assert.equal(result.stages[0].bankAmount, 90_000);
    for (const stage of result.stages.slice(1)) {
      assert.equal(stage.cashAmount, 0);
    }
    assert.equal(result.stageCashTotal, 90_000);
    assert.equal(result.stageBankTotal, 1_350_000);
    assert.equal(result.stages.at(-1).cumulativeBank, 1_350_000);
    assert.ok(Math.abs(result.stages.at(-1).monthlyRepayment - result.monthlyRepayment) < 1e-6);
  });

  it("charges interest and a full repayment on the loan released so far", () => {
    const foundation = result.stages[0];
    assert.equal(foundation.date, "2027-04-29");
    assert.ok(Math.abs(foundation.monthlyInterest - 300) < 1e-9);
    assert.ok(Math.abs(foundation.monthlyRepayment - 429.6737659189084) < 1e-6);
    assert.ok(Math.abs(foundation.monthlyPrincipal - (foundation.monthlyRepayment - 300)) < 1e-6);
    assert.deepEqual(result.stages.map((stage) => stage.date), [
      "2027-04-29",
      "2027-10-29",
      "2028-01-29",
      "2028-04-29",
      "2028-07-29",
      "2028-10-29",
      "2029-10-29",
      "2030-10-29",
    ]);
  });
});

describe("Buyer's Stamp Duty tier boundaries", () => {
  const cases = [
    [0, 0],
    [180_000, 1_800],
    [180_001, 1_800.02],
    [360_000, 5_400],
    [360_001, 5_400.03],
    [1_000_000, 24_600],
    [1_000_001, 24_600.04],
    [1_500_000, 44_600],
    [1_500_001, 44_600.05],
    [1_800_000, 59_600],
    [3_000_000, 119_600],
    [3_000_001, 119_600.06],
  ];

  for (const [price, duty] of cases) {
    it(`prices S$${price.toLocaleString("en-SG")} at S$${duty.toLocaleString("en-SG")}`, () => {
      assert.equal(buyersStampDuty(price), duty);
    });
  }

  it("does not invent a duty for a negative price", () => {
    assert.equal(buyersStampDuty(-1), 0);
  });
});

describe("ABSD", () => {
  it("is the price times the rate, added to BSD", () => {
    const result = calculateProperty({ ...example, absdRate: 0.2 });
    assert.equal(result.absd, 360_000);
    assert.equal(result.totalStampDuty, 419_600);
    assert.equal(result.totalCashCpf, 869_600);
    assert.equal(result.absdRateIsStandard, true);
  });

  it("accepts 35%, which is not on the spreadsheet list, and says so", () => {
    const result = calculateProperty({ ...example, absdRate: 0.35 });
    assert.equal(result.absd, 630_000);
    assert.equal(result.absdRateIsStandard, false);
    assert.ok(result.warnings.some((warning) => warning.code === "absd-nonstandard"));
  });

  it("treats every dropdown rate as standard", () => {
    for (const rate of [0, 0.05, 0.2, 0.3, 0.6, 0.65]) {
      const result = calculateProperty({ ...example, absdRate: rate });
      assert.equal(result.absdRateIsStandard, true, String(rate));
    }
  });
});

describe("IWAA, tenure and the age-based LTV", () => {
  it("stays at 30 years and 75% when no salary is entered", () => {
    assert.equal(maxTenureYears(0), 30);
    assert.equal(ltvFromIwaa(0), 0.75);
  });

  it("weights two salaries and keeps 75% when age plus 30 does not pass 65", () => {
    const result = calculateProperty({
      ...example,
      buyers: [
        { age: 30, monthlySalary: 8_000 },
        { age: 45, monthlySalary: 2_000 },
        { age: 60, monthlySalary: 0 },
        { age: null, monthlySalary: null },
      ],
    });
    assert.equal(result.iwaa, 33);
    assert.equal(result.totalMonthlySalary, 10_000);
    assert.equal(result.maxTenureYears, 30);
    assert.equal(result.iwaaLtv, 0.75);
    assert.equal(result.estimatedLoan, 1_350_000);
    assert.equal(result.ltvShortfall, 0);
  });

  it("treats age 35 as still on the 75% side, because 35 + 30 is not above 65", () => {
    const result = calculateProperty({
      ...example,
      buyers: [{ age: 35, monthlySalary: 9_000 }],
    });
    assert.equal(result.iwaa, 35);
    assert.equal(result.maxTenureYears, 30);
    assert.equal(result.iwaaLtv, 0.75);
  });

  it("drops to 55% and a shorter tenure once the weighted age passes 35", () => {
    const result = calculateProperty({
      ...example,
      buyers: [
        { age: 32, monthlySalary: 8_000 },
        { age: 40, monthlySalary: 12_000 },
      ],
    });
    assert.ok(Math.abs(result.iwaa - 36.8) < 1e-9);
    assert.ok(Math.abs(result.maxTenureYears - 28.2) < 1e-9);
    assert.equal(result.iwaaLtv, 0.55);
    assert.equal(result.loanAtEnteredLtv, 1_350_000);
    assert.equal(result.estimatedLoan, 990_000);
    assert.equal(result.ltvShortfall, 360_000);
    assert.equal(result.maxPropertyPrice, 1_320_000);
    assert.ok(Math.abs(result.monthlyRepayment - 4883.7353449944585) < 1e-6);
    assert.ok(result.warnings.some((warning) => warning.code === "iwaa-shortfall"));
    // Upfront cash still follows the typed 75% LTV, as the spreadsheet does.
    assert.equal(result.totalCashCpf, 509_600);
  });

  it("counts a salary with a blank age as age 0, which leaves tenure at 30", () => {
    const result = calculateProperty({
      ...example,
      buyers: [{ age: null, monthlySalary: 5_000 }],
    });
    assert.equal(result.iwaa, 0);
    assert.equal(result.maxTenureYears, 30);
    assert.equal(result.iwaaLtv, 0.75);
    assert.equal(result.totalMonthlySalary, 5_000);
    assert.ok(result.incomeShortfall < result.minSalaryTdsr);
  });
});

describe("income tests and show funds", () => {
  it("includes other debt in TDSR and leaves it out of MSR", () => {
    const result = calculateProperty({ ...example, otherMonthlyDebt: 500 });
    assert.equal(Math.round(result.minSalaryTdsr), 12_627);
    assert.equal(Math.round(result.minSalaryMsr), 21_484);
  });

  it("shrinks show funds once salary covers part of the TDSR minimum", () => {
    const result = calculateProperty({
      ...example,
      buyers: [{ age: 32, monthlySalary: 10_000 }],
    });
    assert.equal(result.iwaaLtv, 0.75);
    assert.ok(Math.abs(result.incomeShortfall - 1718.375434152047) < 1e-6);
    assert.equal(result.showFundsUnpledged, 275_000);
    assert.equal(result.showFundsPledged, 83_000);
  });

  it("asks for no show funds when salary already clears the TDSR test", () => {
    const result = calculateProperty({
      ...example,
      buyers: [{ age: 30, monthlySalary: 20_000 }],
    });
    assert.equal(result.incomeShortfall, 0);
    assert.equal(result.showFundsUnpledged, 0);
    assert.equal(result.showFundsPledged, 0);
  });

  it("rounds show funds up, and leaves an exact thousand alone", () => {
    assert.equal(roundUpToThousand(1_874_940.07), 1_875_000);
    assert.equal(roundUpToThousand(562_482.02), 563_000);
    assert.equal(roundUpToThousand(1_000), 1_000);
    assert.equal(roundUpToThousand(1_000.01), 2_000);
    assert.equal(roundUpToThousand(0), 0);
  });
});

describe("LTV below 75% and the stage waterfall", () => {
  it("adds the extra top-up and spends it on the earliest stages", () => {
    const result = calculateProperty({ ...example, ltv: 0.6 });
    assert.equal(result.newLaunch.foundationTopUp, 90_000);
    assert.equal(result.newLaunch.additionalTopUp, 270_000);
    assert.equal(result.totalCashCpf, 779_600);
    assert.equal(result.estimatedLoan, 1_080_000);
    assert.equal(result.newLaunch.stageCashMatchesTopUp, true);

    const cash = result.stages.map((stage) => stage.cashAmount);
    const bank = result.stages.map((stage) => stage.bankAmount);
    assert.deepEqual(cash, [180_000, 180_000, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(bank, [0, 0, 90_000, 90_000, 90_000, 90_000, 450_000, 270_000]);
    assert.equal(result.stageCashTotal, 360_000);
    assert.equal(result.stageBankTotal, 1_080_000);
    assert.equal(result.stages[0].monthlyRepayment, 0);
    assert.equal(result.stages[2].cumulativeBank, 90_000);
  });

  it("at 70% puts the whole 10% cash piece on foundation", () => {
    const result = calculateProperty({ ...example, ltv: 0.7 });
    assert.equal(result.newLaunch.additionalTopUp, 90_000);
    assert.equal(result.totalCashCpf, 599_600);
    assert.equal(result.stages[0].cashAmount, 180_000);
    assert.equal(result.stages[0].bankAmount, 0);
    assert.equal(result.stages[1].cashAmount, 0);
    assert.equal(result.stageCashTotal, 180_000);
  });

  it("still adds a 5% foundation top-up when the typed LTV is above 75%", () => {
    const result = calculateProperty({ ...example, ltv: 0.8 });
    assert.equal(result.loanAtEnteredLtv, 1_440_000);
    assert.equal(result.newLaunch.foundationTopUp, 90_000);
    assert.equal(result.newLaunch.additionalTopUp, 0);
    assert.equal(result.totalCashCpf, 509_600);
    assert.equal(result.stageCashTotal, 0);
    assert.equal(result.stageBankTotal, 1_440_000);
    assert.equal(result.newLaunch.stageCashMatchesTopUp, false);
    assert.ok(result.warnings.some((warning) => warning.code === "ltv-above-75"));
  });
});

describe("resale", () => {
  const resale = {
    ...example,
    mode: "resale",
    otpDate: "2026-10-31",
  };

  it("uses a 1% option, 4% on exercise, stamp duty, then the rest at completion", () => {
    const result = calculateProperty(resale);
    assert.equal(result.resale.optionFee, 18_000);
    assert.equal(result.resale.exercisePayment, 72_000);
    assert.equal(result.resale.deposit, 90_000);
    assert.equal(result.resale.remainingDownPayment, 360_000);
    assert.equal(result.totalCashCpf, 509_600);
    assert.equal(result.estimatedLoan, 1_350_000);
    assert.equal(Math.round(result.monthlyRepayment), 6_445);
    assert.equal(result.stages, null);
    assert.equal(result.showFundsUnpledged, 1_875_000);

    const byId = Object.fromEntries(result.timeline.map((event) => [event.id, event]));
    assert.equal(byId.option.date, "2026-10-31");
    assert.equal(byId.option.amount, 18_000);
    assert.equal(byId.exercise.date, "2026-11-14");
    assert.equal(byId.exercise.amount, 72_000);
    assert.equal(byId["stamp-duty"].date, "2026-11-28");
    assert.equal(byId["stamp-duty"].amount, 59_600);
    assert.equal(byId.completion.date, "2027-01-23");
    assert.equal(byId.completion.amount, 360_000);
    assert.equal(byId.completion.loanDisbursed, 1_350_000);
    assert.equal(Math.round(byId.completion.monthlyRepayment), 6_445);

    const paid = result.timeline.reduce((sum, event) => sum + event.amount, 0);
    assert.equal(paid, result.totalCashCpf);
  });

  it("grows the completion cheque when the LTV is under 75%", () => {
    const result = calculateProperty({ ...resale, ltv: 0.55 });
    assert.equal(result.resale.remainingDownPayment, 720_000);
    assert.equal(result.totalCashCpf, 18_000 + 72_000 + 720_000 + 59_600);
    assert.equal(result.resale.depositExceedsDownPayment, false);
  });

  it("keeps the 5% deposit even when the typed LTV leaves less than 5% to pay", () => {
    const result = calculateProperty({ ...resale, ltv: 0.97 });
    assert.equal(result.resale.remainingDownPayment, 0);
    assert.equal(result.resale.depositExceedsDownPayment, true);
    assert.equal(result.totalCashCpf, 90_000 + 59_600);
    assert.ok(result.warnings.some((warning) => warning.code === "resale-deposit-exceeds-down-payment"));
  });

  it("shares BSD, ABSD and the age rule with a new launch", () => {
    const result = calculateProperty({
      ...resale,
      absdRate: 0.05,
      buyers: [{ age: 40, monthlySalary: 15_000 }],
    });
    assert.equal(result.absd, 90_000);
    assert.equal(result.iwaaLtv, 0.55);
    assert.equal(result.estimatedLoan, 990_000);
    assert.equal(result.maxTenureYears, 25);
    assert.equal(result.resale.remainingDownPayment, 360_000);
  });
});

describe("dates and formatting", () => {
  it("steps months the way Excel EDATE does", () => {
    assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
    assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
    assert.equal(addMonths("2026-10-31", 6), "2027-04-30");
    assert.equal(addDays("2026-10-31", 180), "2027-04-29");
  });

  it("formats money, including the rounded hero figures", () => {
    assert.equal(formatSgd(6445.106488783626), "S$6,445");
    assert.equal(formatSgd(6445.106488783626, { digits: 2 }), "S$6,445.11");
    assert.equal(formatSgd(1_875_000), "S$1,875,000");
    assert.equal(formatSgdAuto(119_600.06), "S$119,600.06");
    assert.equal(formatSgdAuto(90_000), "S$90,000");
    assert.equal(formatSgd(null), "—");
    assert.equal(formatDate("2026-10-31"), "31 Oct 2026");
  });
});

describe("edges and a second home", () => {
  it("rejects a blank price, a negative rate and an impossible LTV", () => {
    assert.equal(calculateProperty({ ...example, price: 0 }).ok, false);
    assert.equal(calculateProperty({ ...example, annualInterestRate: -0.01 }).ok, false);
    assert.equal(calculateProperty({ ...example, ltv: 1.1 }).ok, false);
  });

  it("repays a zero-interest loan as principal split over the months", () => {
    const result = calculateProperty({ ...example, annualInterestRate: 0 });
    assert.equal(result.monthlyRepayment, 1_350_000 / 360);
  });

  it("does not invent a repayment when the weighted age is 65 or more", () => {
    const result = calculateProperty({
      ...example,
      buyers: [{ age: 66, monthlySalary: 8_000 }],
    });
    assert.ok(result.maxTenureYears < 0);
    assert.equal(result.monthlyRepayment, null);
    assert.equal(result.showFundsUnpledged, null);
    assert.ok(result.warnings.some((warning) => warning.code === "tenure-unavailable"));
  });

  it("calculates two homes separately, with no shared memory", () => {
    const [first, second] = compareProperties([
      example,
      { ...example, mode: "resale", price: 900_000, otpDate: "2026-10-31" },
    ]);
    assert.equal(first.totalCashCpf, 509_600);
    assert.equal(second.bsd, 21_600);
    assert.equal(second.estimatedLoan, 675_000);
    assert.equal(second.totalCashCpf, 246_600);
    assert.equal(calculateProperty(example).totalCashCpf, first.totalCashCpf);
    const stageShare = PROGRESSIVE_STAGES.reduce((sum, stage) => sum + stage.percent, 0);
    assert.ok(Math.abs(stageShare - 0.8) < 1e-9);
  });
});
