export function processFinancialData(rawData) {
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return {};

  const grouped = {};

  for (const row of rawData) {
    const metric = row.metric_key;
    const value = row.value != null ? Number(row.value) : null;
    const fiscalYear = row.fiscal_year ?? null;
    const fiscalQuarter = row.fiscal_quarter ?? null;
    const isQuarterly = row.period_type === 'quarterly';
    const periodKey = isQuarterly
      ? `${fiscalYear}-Q${fiscalQuarter}`
      : String(fiscalYear ?? row.fiscal_period ?? row.period);
    const label = isQuarterly
      ? `${fiscalYear} Q${fiscalQuarter}`
      : String(fiscalYear ?? row.fiscal_period ?? row.period);
    const sortValue = isQuarterly
      ? ((fiscalYear ?? 0) * 10) + (fiscalQuarter ?? 0)
      : (fiscalYear ?? 0) * 10;

    if (!grouped[metric]) grouped[metric] = {};
    grouped[metric][periodKey] = {
      value,
      label,
      sortValue,
    };
  }

  return grouped;
}

export function collectSortedPeriods(grouped) {
  const allPeriods = new Map();
  for (const metricKey of Object.keys(grouped)) {
    for (const [periodKey, meta] of Object.entries(grouped[metricKey])) {
      if (!allPeriods.has(periodKey)) {
        allPeriods.set(periodKey, meta);
      }
    }
  }

  return Array.from(allPeriods.entries())
    .sort(([, left], [, right]) => left.sortValue - right.sortValue);
}

function safeDivide(numerator, denominator) {
  if (numerator == null || denominator == null || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

function getAverageBalance(grouped, metricKey, periods, periodIndex) {
  const current = grouped[metricKey]?.[periods[periodIndex]?.[0]]?.value ?? null;
  if (current == null) {
    return null;
  }

  if (periodIndex === 0) {
    return current;
  }

  const previous = grouped[metricKey]?.[periods[periodIndex - 1]?.[0]]?.value ?? null;
  if (previous == null) {
    return current;
  }

  return (current + previous) / 2;
}

const DERIVED_METRIC_BUILDERS = {
  free_cash_flow: ({ grouped, periodKey }) => {
    const directFcf = grouped.free_cash_flow?.[periodKey]?.value;
    if (directFcf != null) {
      return directFcf;
    }

    const ocf = grouped.operating_cash_flow?.[periodKey]?.value;
    const capex = grouped.capital_expenditures?.[periodKey]?.value;
    if (ocf != null && capex != null) {
      return ocf - Math.abs(capex);
    }

    return null;
  },
  gross_margin: ({ grouped, periodKey }) => {
    const grossProfit = grouped.gross_profit?.[periodKey]?.value;
    const revenue = grouped.revenue?.[periodKey]?.value;
    return safeDivide(grossProfit, revenue);
  },
  operating_margin: ({ grouped, periodKey }) => {
    const operatingIncome = grouped.operating_income?.[periodKey]?.value;
    const revenue = grouped.revenue?.[periodKey]?.value;
    return safeDivide(operatingIncome, revenue);
  },
  net_margin: ({ grouped, periodKey }) => {
    const netIncome = grouped.net_income?.[periodKey]?.value;
    const revenue = grouped.revenue?.[periodKey]?.value;
    return safeDivide(netIncome, revenue);
  },
  roe: ({ grouped, periods, periodIndex, periodKey }) => {
    const netIncome = grouped.net_income?.[periodKey]?.value;
    const averageEquity = getAverageBalance(grouped, 'shareholders_equity', periods, periodIndex);
    return safeDivide(netIncome, averageEquity);
  },
};

export function buildChartData(grouped, periods, metric, periodType) {
  const deriveValue = DERIVED_METRIC_BUILDERS[metric];

  return periods
    .map(([periodKey, meta], periodIndex) => {
      const value = deriveValue
        ? deriveValue({ grouped, periodKey, periods, periodIndex })
        : grouped[metric]?.[periodKey]?.value ?? null;

      return {
        period: periodKey,
        value,
        label: periodType === 'quarterly' ? meta.label : String(meta.label),
      };
    })
    .filter((datum) => datum.value != null);
}
