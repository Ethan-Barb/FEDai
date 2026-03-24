/**
 * MACRO|PULSE Configuration
 * FRED API: Free key from https://fred.stlouisfed.org/docs/api/api_key.html
 * Uses a public demo key — replace with your own for production.
 */
const CONFIG = {
  FRED_API_KEY: '0d47099dd979bd9ce0be0a50e6372c25',  // Public demo key
  FRED_BASE: 'https://api.stlouisfed.org/fred/series/observations',

  // FRED series IDs
  SERIES: {
    GDP_GROWTH:     'A191RL1Q225SBEA',  // Real GDP growth rate (quarterly, annualized)
    CPI:            'CPIAUCSL',          // CPI for All Urban Consumers (monthly)
    CORE_CPI:       'CPILFESL',          // Core CPI (monthly)
    UNEMPLOYMENT:   'UNRATE',            // Unemployment Rate (monthly)
    FED_FUNDS:      'FEDFUNDS',          // Effective Federal Funds Rate (monthly)
    PCE:            'PCEPI',             // PCE Price Index (monthly)
    GDP_NOMINAL:    'GDP',               // Nominal GDP (quarterly)
    REAL_GDP:       'GDPC1',             // Real GDP (quarterly)
    POTENTIAL_GDP:  'GDPPOT',            // Potential GDP (quarterly)
    LABOR_FORCE:    'CLF16OV',           // Civilian Labor Force (monthly)
    TREASURY_10Y:   'DGS10',            // 10-Year Treasury (daily)
    TREASURY_2Y:    'DGS2',             // 2-Year Treasury (daily)
  },

  // Economic targets (Fed dual mandate)
  TARGETS: {
    INFLATION: 2.0,         // Fed's inflation target (%)
    UNEMPLOYMENT_NAIRU: 4.2, // Estimated NAIRU (%)
    NEUTRAL_RATE: 2.5,      // Estimated neutral real rate (%)
  },

  // Chart styling
  CHART: {
    GRID_COLOR: 'rgba(30, 42, 63, 0.6)',
    TICK_COLOR: '#556580',
    FONT: "'DM Mono', monospace",
  }
};
