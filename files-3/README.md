# 🏦 Federal Reserve Rate Advisor

An AI-powered web application that recommends Federal Reserve interest rate changes based on real economic indicators, using a Taylor Rule–inspired model with adjustable weights.

---

## 📁 Folder Structure

```
fed-rate-advisor/
├── public/
│   └── index.html          # Full frontend (HTML/CSS/JS, single file)
├── src/
│   ├── server.js           # Express server & /predict endpoint
│   └── model.js            # Taylor Rule decision model
├── .env.example            # Environment variable template
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- npm

### Steps

```bash
# 1. Clone / extract the project
cd fed-rate-advisor

# 2. Install dependencies
npm install

# 3. (Optional) Copy env template
cp .env.example .env

# 4. Start the server
npm start
# → http://localhost:3000

# For auto-reload during development:
npm run dev
```

---

## 🚂 Deploying on Railway

### Option A — Deploy from GitHub (recommended)

1. Push your project to a GitHub repository.
2. Go to [railway.app](https://railway.app) and sign in.
3. Click **New Project → Deploy from GitHub repo**.
4. Select your repository.
5. Railway will automatically:
   - Detect Node.js
   - Run `npm install`
   - Run `npm start`
6. Click **Generate Domain** to get a public URL.
7. Done! ✅

### Option B — Deploy from CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project (run from project root)
railway init

# Deploy
railway up

# Open your app
railway open
```

### Environment Variables on Railway

Railway sets `PORT` automatically — the app reads `process.env.PORT` so no changes needed.

To add other variables:
1. Go to your Railway project dashboard.
2. Click **Variables** tab.
3. Add key/value pairs.

---

## 🔌 API Reference

### `POST /predict`

**Request body (JSON):**

| Field | Type | Required | Description |
|---|---|---|---|
| `inflation` | number | ✅ | Current inflation rate (%) |
| `inflationTarget` | number | ✅ | Target inflation (default 2.0) |
| `unemployment` | number | ✅ | Current unemployment rate (%) |
| `gdpGrowth` | number | ✅ | Annualized real GDP growth (%) |
| `wageGrowth` | number | — | YoY wage growth (%) |
| `consumerSpending` | number | — | Consumer spending growth (%) |
| `marketConditions` | number | — | Composite market score 0–100 |
| `inflationExpectations` | number | — | 5Y inflation expectations (%) |
| `naturalUnemployment` | number | — | NAIRU estimate (default 4.0) |
| `potentialGdp` | number | — | Long-run GDP potential (default 2.0) |
| `weights` | object | — | Custom model weights (advanced) |

**Example request:**
```json
{
  "inflation": 4.0,
  "inflationTarget": 2.0,
  "unemployment": 3.5,
  "gdpGrowth": 3.0,
  "wageGrowth": 4.5
}
```

**Example response:**
```json
{
  "success": true,
  "recommendation": 0.5,
  "recommendationFormatted": "+0.50%",
  "stance": "Tighten",
  "confidence": "High",
  "explanation": "Inflation at 4% is significantly above the 2% target...",
  "factors": { ... },
  "regimeNotes": [],
  "rawScore": "0.8250"
}
```

### `GET /health`
Returns `{ "status": "ok", "timestamp": "..." }`

---

## 🧠 Model Logic

The model is based on the **Taylor Rule**:

```
rate_change = α(inflation − target) + β(gdp_growth − potential_gdp)
```

Extended with:
- **Labor market**: unemployment gap vs NAIRU, wage growth
- **Demand**: consumer spending momentum
- **Market conditions**: composite sentiment score
- **Inflation expectations**: forward-looking pressure

**Regime detection:**
- *Supply shock*: High inflation + weak growth → dampens tightening by 40%
- *Overheating*: High inflation + tight labor + strong growth → amplifies by 20%
- *Lag dampening*: Very large swings reduced to account for 12–18 month policy lag

**Clamping**: Output is snapped to nearest 0.25% increment, bounded ±1.00%

---

## 📄 License

MIT — for educational use only. Not financial advice.
