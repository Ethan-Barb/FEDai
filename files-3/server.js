/**
 * Federal Reserve Rate Advisor — Express Server
 * 
 * Serves the frontend and exposes the /predict API endpoint.
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const { predictRateChange } = require("./model");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// --- Validation helpers ---
function validateNumber(val, name, min, max) {
  const num = parseFloat(val);
  if (isNaN(num)) return `"${name}" must be a number.`;
  if (min !== undefined && num < min) return `"${name}" must be at least ${min}.`;
  if (max !== undefined && num > max) return `"${name}" must be at most ${max}.`;
  return null;
}

// --- /predict endpoint ---
app.post("/predict", (req, res) => {
  const {
    inflation,
    inflationTarget,
    unemployment,
    naturalUnemployment,
    gdpGrowth,
    potentialGdp,
    wageGrowth,
    consumerSpending,
    marketConditions,
    inflationExpectations,
    weights,
  } = req.body;

  // Required field validation
  const errors = [];
  const requiredFields = [
    { val: inflation, name: "inflation", min: -5, max: 30 },
    { val: inflationTarget, name: "inflationTarget", min: 0, max: 10 },
    { val: unemployment, name: "unemployment", min: 0, max: 30 },
    { val: gdpGrowth, name: "gdpGrowth", min: -20, max: 20 },
  ];

  for (const field of requiredFields) {
    const err = validateNumber(field.val, field.name, field.min, field.max);
    if (err) errors.push(err);
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  try {
    const inputs = {
      inflation: parseFloat(inflation),
      inflationTarget: parseFloat(inflationTarget) || 2.0,
      unemployment: parseFloat(unemployment),
      naturalUnemployment: parseFloat(naturalUnemployment) || 4.0,
      gdpGrowth: parseFloat(gdpGrowth),
      potentialGdp: parseFloat(potentialGdp) || 2.0,
      wageGrowth: wageGrowth !== "" && wageGrowth !== undefined ? parseFloat(wageGrowth) : undefined,
      consumerSpending: consumerSpending !== "" && consumerSpending !== undefined ? parseFloat(consumerSpending) : undefined,
      marketConditions: marketConditions !== "" && marketConditions !== undefined ? parseFloat(marketConditions) : 50,
      inflationExpectations: inflationExpectations !== "" && inflationExpectations !== undefined ? parseFloat(inflationExpectations) : undefined,
    };

    const result = predictRateChange(inputs, weights || {});
    return res.json({ success: true, ...result });

  } catch (err) {
    console.error("Model error:", err);
    return res.status(500).json({ error: "Model computation failed.", details: err.message });
  }
});

// --- Health check ---
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- Fallback to index.html ---
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`\n🏦 Fed Rate Advisor running on http://localhost:${PORT}\n`);
});

module.exports = app;
