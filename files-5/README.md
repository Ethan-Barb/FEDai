# 🏦 Fed Rate Advisor v2 — AI Edition

Taylor Rule model + Claude Opus AI analysis. Runs 100% in the browser. GitHub Pages compatible.

## 📁 File Structure

```
fed-advisor-v2/
├── index.html        ← Main app shell
├── css/
│   └── style.css     ← All styles
└── js/
    ├── model.js      ← Taylor Rule decision engine (pure JS)
    ├── ui.js         ← DOM rendering, form handling, chart
    └── ai.js         ← Claude Opus API integration
```

## 🚀 Deploy to GitHub Pages

1. Create a new GitHub repo (e.g. `fed-rate-advisor`)
2. Upload all files maintaining the folder structure
3. Go to **Settings → Pages → Source: Deploy from branch → main → / (root) → Save**
4. Your app is live at `https://yourusername.github.io/fed-rate-advisor/`

## 🔑 API Key

Enter your Anthropic API key in the key bar at the top of the app.
- The key is held **only in browser memory** — never stored, never logged
- It is sent directly to `api.anthropic.com` only
- Without a key, the Taylor Rule model still runs fully — AI analysis is optional

## 🧠 How It Works

### Layer 1 — Taylor Rule Model (model.js)
Runs instantly, no API needed.

```
r = α(π − π*) + β(y − y*) + γ(u* − u) + δ·w + ε·c + ζ·m + η·πᵉ
```

| Symbol | Meaning | Default weight |
|--------|---------|---------------|
| π − π* | Inflation gap | α = 1.5 |
| y − y* | Output gap (GDP vs potential) | β = 0.5 |
| u* − u | Unemployment gap vs NAIRU | γ = 0.4 |
| w | Wage growth above neutral (3.5%) | δ = 0.2 |
| c | Consumer spending above neutral (2.5%) | ε = 0.15 |
| m | Market conditions (0–100 normalized) | ζ = 0.1 |
| πᵉ − π* | Expectations gap | η = 0.3 |

**Regime detection:**
- Supply shock (inflation > target+1.5pp AND GDP < 1%) → dampens by 40%
- Overheating (inflation high + tight labor + strong GDP) → amplifies by 20%
- Large signals (|raw| > 0.75) → lag dampening of 15%

**Output clamping:** Snapped to nearest 0.25%, bounded ±1.00%

### Layer 2 — Claude Opus Analysis (ai.js)
Calls `claude-opus-4-5` with a structured prompt requesting:
1. **Policy Recommendation** — agrees/disagrees with model, adds real-world context
2. **Algorithm Explained** — step-by-step equation walkthrough
3. **Economic Outlook** — Bull / Base / Bear scenarios with 12-month projections

## ⚠️ Notes

- Not financial advice. Educational use only.
- The AI layer requires an Anthropic API key with Opus access.
- CORS: Anthropic's API supports direct browser access with the `anthropic-dangerous-direct-browser-access` header.
