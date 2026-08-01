const BASE_RATES = Object.freeze({
  bank: 5,
  commercial: 7,
});

const HEALTH_PENALTIES = Object.freeze({
  critical: Object.freeze({ bank: 5, commercial: 7 }),
  warning: Object.freeze({ bank: 2, commercial: 3 }),
  deficit: Object.freeze({ bank: 2, commercial: 3 }),
});

/**
 * @param {'bank' | 'commercial' | string} loanType
 * @param {string} [financialHealthStatus]
 */
export function computeLoanRate({ loanType, financialHealthStatus }) {
  const type = loanType === 'commercial' ? 'commercial' : 'bank';
  let rate = BASE_RATES[type];

  if (financialHealthStatus === 'critical') {
    rate += HEALTH_PENALTIES.critical[type];
  } else if (
    financialHealthStatus === 'warning' ||
    financialHealthStatus === 'deficit'
  ) {
    rate += HEALTH_PENALTIES.warning[type];
  }

  return rate;
}

/** @param {string} [financialHealthStatus] */
export function computeLoanRatesByType(financialHealthStatus) {
  return {
    bank: computeLoanRate({ loanType: 'bank', financialHealthStatus }),
    commercial: computeLoanRate({ loanType: 'commercial', financialHealthStatus }),
  };
}

/** @param {number} amount @param {number} interestRatePercent */
export function computeLoanInterestAmount(amount, interestRatePercent) {
  return Math.round(amount * (interestRatePercent / 100));
}
