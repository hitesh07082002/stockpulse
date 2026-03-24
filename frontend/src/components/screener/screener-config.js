export const SECTORS = [
  'Communication Services',
  'Consumer Discretionary',
  'Consumer Staples',
  'Energy',
  'Financials',
  'Health Care',
  'Industrials',
  'Information Technology',
  'Materials',
  'Real Estate',
  'Utilities',
];

export const MARKET_CAP_PRESETS = [
  { label: 'Large >$10B', min: 10e9, max: '' },
  { label: 'Mid $2-10B', min: 2e9, max: 10e9 },
  { label: 'Small <$2B', min: '', max: 2e9 },
];

export const COLUMNS = [
  { key: 'ticker', label: 'Ticker', sortable: true },
  { key: 'name', label: 'Company', sortable: true },
  { key: 'sector', label: 'Sector', sortable: true },
  { key: 'current_price', label: 'Price', sortable: true, numeric: true },
  { key: 'market_cap', label: 'Market Cap', sortable: true, numeric: true },
  { key: 'pe_ratio', label: 'P/E', sortable: true, numeric: true },
  { key: 'revenue_growth_yoy', label: 'Rev YoY', sortable: true, numeric: true, percent: true },
  { key: 'gross_margin', label: 'Gross Margin', sortable: true, numeric: true, percent: true },
  { key: 'operating_margin', label: 'Op Margin', sortable: true, numeric: true, percent: true },
  { key: 'debt_to_equity', label: 'Debt / Equity', sortable: true, numeric: true },
];

export const SORTABLE_COLUMNS = COLUMNS.filter((column) => column.sortable);

export const INITIAL_FILTERS = {
  sector: '',
  industry: '',
  market_cap_min: '',
  market_cap_max: '',
  pe_min: '',
  pe_max: '',
  positive_fcf: false,
  revenue_growth_min: '',
  revenue_growth_max: '',
  gross_margin_min: '',
  gross_margin_max: '',
  operating_margin_min: '',
  operating_margin_max: '',
  debt_to_equity_min: '',
  debt_to_equity_max: '',
};

export const PERCENT_FILTER_KEYS = new Set([
  'revenue_growth_min',
  'revenue_growth_max',
  'gross_margin_min',
  'gross_margin_max',
  'operating_margin_min',
  'operating_margin_max',
]);

export const DEFAULT_SORT_KEY = 'market_cap';
export const DEFAULT_SORT_DIRECTION = 'desc';

export const INPUT_CLASS = 'min-h-11 w-full rounded-md border border-border bg-elevated px-3 py-2.5 font-body text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none';
export const SECONDARY_BUTTON_CLASS = 'min-h-11 rounded-md border border-border bg-transparent px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30';
export const PRIMARY_BUTTON_CLASS = 'min-h-11 rounded-md border-none bg-accent px-4 py-2.5 font-body text-sm font-semibold text-text-inverse transition-colors hover:bg-accent-hover';
export const CHIP_BUTTON_CLASS = 'rounded-full border border-border bg-transparent px-3 py-1.5 font-body text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent';
