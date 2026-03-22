# XBRL Concept Mapping
# Maps our normalized metric names to SEC XBRL tags.
# Order matters — first match wins for each company.

XBRL_METRIC_MAP = {
    'revenue': [
        'Revenues',
        'RevenueFromContractWithCustomerExcludingAssessedTax',
        'RevenueFromContractWithCustomerIncludingAssessedTax',
        'SalesRevenueNet',
        'SalesRevenueGoodsNet',
        'SalesRevenueServicesNet',
        'TotalRevenuesAndOtherIncome',
        'InterestAndDividendIncomeOperating',
    ],
    'net_income': [
        'NetIncomeLoss',
        'NetIncomeLossAvailableToCommonStockholdersBasic',
        'ProfitLoss',
    ],
    'eps_diluted': [
        'EarningsPerShareDiluted',
        'EarningsPerShareBasic',
    ],
    'gross_profit': [
        'GrossProfit',
    ],
    'operating_income': [
        'OperatingIncomeLoss',
        'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
    ],
    'ebitda': [
        # EBITDA is not a standard XBRL tag — we compute it if possible
        # or fall back to operating_income as a proxy
    ],
    'total_assets': [
        'Assets',
    ],
    'total_liabilities': [
        'Liabilities',
        'LiabilitiesAndStockholdersEquity',
    ],
    'total_equity': [
        'StockholdersEquity',
        'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
    ],
    'total_debt': [
        'LongTermDebt',
        'LongTermDebtAndCapitalLeaseObligations',
        'LongTermDebtNoncurrent',
    ],
    'cash_and_equivalents': [
        'CashAndCashEquivalentsAtCarryingValue',
        'CashCashEquivalentsAndShortTermInvestments',
        'Cash',
    ],
    'operating_cash_flow': [
        'NetCashProvidedByUsedInOperatingActivities',
        'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
    ],
    'capital_expenditures': [
        'PaymentsToAcquirePropertyPlantAndEquipment',
        'PaymentsToAcquireProductiveAssets',
        'PaymentsForCapitalImprovements',
    ],
    'shares_outstanding': [
        'CommonStockSharesOutstanding',
        'EntityCommonStockSharesOutstanding',
        'WeightedAverageNumberOfShareOutstandingBasicAndDiluted',
        'WeightedAverageNumberOfDilutedSharesOutstanding',
    ],
    'dividends_per_share': [
        'CommonStockDividendsPerShareDeclared',
        'CommonStockDividendsPerShareCashPaid',
    ],
}

# Metrics where we want to track 10-K (annual) filings
ANNUAL_FORMS = {'10-K', '10-K/A', '20-F', '20-F/A'}

# Metrics where we want to track 10-Q (quarterly) filings
QUARTERLY_FORMS = {'10-Q', '10-Q/A', '6-K'}

# Sectors where DCF is less applicable
DCF_WARNING_SECTORS = {
    'Financial Services', 'Financials', 'Banks',
    'Real Estate', 'REITs', 'Insurance',
}
