# MACRO|PULSE — Economic Intelligence Dashboard

A real-time macroeconomic dashboard that fetches live data from the Federal Reserve (FRED), displays the economic models and equations used, recommends monetary policy, and forecasts where the economy is heading.

**[Live Demo →](https://yourusername.github.io/macro-dashboard/)**

![Dashboard Preview](https://img.shields.io/badge/Data-FRED_API-blue) ![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

### 📊 Live Economic Data (FRED API)
- **GDP Growth Rate** — Real GDP quarterly annualized
- **CPI Inflation** — Year-over-year computed from raw CPI index
- **Unemployment Rate** — Monthly civilian unemployment
- **Federal Funds Rate** — Effective monthly rate
- **Output Gap** — Real GDP vs. Potential GDP
- **Yield Curve Spread** — 10-Year minus 2-Year Treasury

### 📐 Models & Equations (KaTeX rendered)
- **Taylor Rule** — Optimal interest rate based on inflation and output gaps
- **Phillips Curve** — Inflation-unemployment tradeoff with expectations
- **Okun's Law** — GDP-unemployment relationship
- **Misery Index** — Composite distress indicator
- **Fisher Equation** — Real vs. nominal interest rates

Each equation displays live computed values from current data.

### 🎯 Policy Recommendation Engine
A weighted scoring algorithm that synthesizes:
1. Taylor Rule rate gap (30%)
2. Inflation gap from target (30%)
3. Unemployment gap from NAIRU (20%)
4. Output gap (10%)
5. Yield curve signal (10%)

Outputs: **Hawkish** (raise rates), **Dovish** (cut rates), or **Hold** — with detailed rationale.

### 🔮 12-Month Economic Forecast
- GDP projection via trend reversion + Okun's Law
- Inflation forecast via Phillips Curve dynamics
- Unemployment via Okun's Law
- Rate path via Taylor Rule gap
- Overall economic outlook classification (Expansion → Recession Risk)

---

## Project Structure

```
macro-dashboard/
├── index.html              # Entry point
├── css/
│   ├── base.css            # Variables, reset, typography, loader
│   ├── dashboard.css       # Grid layout, KPI strip
│   ├── panels.css          # Panel & chart styling
│   ├── equations.css       # Equation rendering styles
│   └── policy.css          # Policy & forecast panel styles
├── js/
│   ├── config.js           # FRED API config & series IDs
│   ├── data-fetcher.js     # FRED API client + YoY computation
│   ├── equations.js        # Economic models + KaTeX rendering
│   ├── charts.js           # Chart.js visualizations
│   ├── policy-engine.js    # Weighted policy scoring algorithm
│   ├── forecast.js         # 12-month economic projections
│   └── app.js              # Main orchestrator
└── README.md
```

## Deploying to GitHub Pages

1. Push to a GitHub repository
2. Go to **Settings → Pages**
3. Set source to **Deploy from a branch** → `main` → `/ (root)`
4. Your dashboard will be live at `https://yourusername.github.io/repo-name/`

No build step needed — it's pure HTML/CSS/JS.

## API Key

The dashboard uses a public FRED demo key. For production use:
1. Get a free key at [fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html)
2. Replace the key in `js/config.js`

## Technologies

- **FRED API** — Federal Reserve Economic Data
- **Chart.js** — Data visualization
- **KaTeX** — LaTeX equation rendering
- Vanilla HTML/CSS/JS — No framework, no build tools

## Disclaimer

This dashboard is for **educational and informational purposes only**. The models are simplified academic frameworks. Do not use for actual investment or policy decisions.

## License

MIT
