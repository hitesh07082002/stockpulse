export function toNumber(value) {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCurrency(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

export function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatPercentWithoutSign(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)}%`;
}

export function formatUnsignedPercent(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.abs(value).toFixed(2)}%`;
}

export function formatCompact(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(2);
}

export function buildProjection(currentMetric, growthRate, terminalMultiple, years, currentPrice) {
  if (
    currentMetric == null || currentMetric <= 0
    || growthRate == null
    || terminalMultiple == null || terminalMultiple <= 0
    || years <= 0
  ) {
    return [];
  }

  const data = [];
  if (currentPrice != null && currentPrice > 0) {
    data.push({
      label: 'Today',
      projectedPrice: currentPrice,
      projectedMetric: currentMetric,
    });
  }

  for (let year = 1; year <= years; year += 1) {
    const projectedMetric = currentMetric * ((1 + growthRate / 100) ** year);
    data.push({
      label: `Y${year}`,
      projectedMetric,
      projectedPrice: projectedMetric * terminalMultiple,
    });
  }

  return data;
}

function resolveDraftValue(modeDraft, fallbackValue) {
  // Preserve an explicit empty string so clearing a field does not silently restore defaults.
  return modeDraft ?? (fallbackValue != null ? String(fallbackValue) : '');
}

export function buildValuationViewModel({ data, modeKey, modeDraft = {} }) {
  const currentPrice = toNumber(data?.current_price);
  const projectionYears = Number(data?.projection_years_default || 5);
  const modeData = modeKey === 'cashFlow' ? data?.cash_flow_mode : data?.earnings_mode;

  const currentMetric = resolveDraftValue(
    modeDraft.currentMetric,
    modeData?.current_metric_value,
  );
  const growthRate = resolveDraftValue(
    modeDraft.growthRate,
    modeData?.growth_rate_default,
  );
  const terminalMultiple = resolveDraftValue(
    modeDraft.terminalMultiple,
    modeData?.terminal_multiple_default,
  );
  const desiredReturn = resolveDraftValue(
    modeDraft.desiredReturn,
    modeData?.desired_return_default,
  );

  const metricValue = toNumber(currentMetric);
  const growthValue = toNumber(growthRate);
  const multipleValue = toNumber(terminalMultiple);
  const desiredReturnValue = toNumber(desiredReturn);
  const projectionBlocked = data?.not_applicable
    || !modeData?.available
    || metricValue == null
    || metricValue <= 0
    || growthValue == null
    || multipleValue == null
    || multipleValue <= 0;

  const projectionData = projectionBlocked
    ? []
    : buildProjection(metricValue, growthValue, multipleValue, projectionYears, currentPrice);

  const futurePrice = projectionData.at(-1)?.projectedPrice ?? null;
  const annualizedReturn = (
    futurePrice == null || currentPrice == null || currentPrice <= 0
  )
    ? null
    : (((futurePrice / currentPrice) ** (1 / projectionYears)) - 1) * 100;
  const totalReturn = (
    futurePrice == null || currentPrice == null || currentPrice <= 0
  )
    ? null
    : ((futurePrice - currentPrice) / currentPrice) * 100;

  const entryPrice = (futurePrice == null || desiredReturnValue == null)
    ? null
    : futurePrice / ((1 + desiredReturnValue / 100) ** projectionYears);

  return {
    currentPrice,
    projectionYears,
    modeData,
    currentMetric,
    growthRate,
    terminalMultiple,
    desiredReturn,
    desiredReturnValue,
    currentTradingMultiple: toNumber(modeData?.current_trading_multiple),
    currentMetricLabel: modeData?.current_metric_label || 'Current Metric',
    terminalLabel: modeKey === 'cashFlow'
      ? 'Appropriate FCF Multiple'
      : 'Appropriate EPS Multiple',
    visibleWarnings: [...(data?.warnings || []), ...(modeData?.warnings || [])],
    projectionMessage: modeData?.available
      ? 'Adjust the current metric and assumptions to see the five-year projection.'
      : (modeData?.availability_reason || 'Insufficient data for valuation'),
    projectionData,
    futurePrice,
    annualizedReturn,
    totalReturn,
    entryPrice,
  };
}
