/**
 * Federal Reserve Rate Decision Model
 * 
 * Based on the Taylor Rule and extended with additional macroeconomic factors.
 * Taylor Rule: r = r* + π + 0.5(π - π*) + 0.5(y - y*)
 *   where r* is neutral rate, π is inflation, π* is target, y-y* is output gap
 */

/**
 * Normalize a value to a -1 to +1 range with a given scale factor.
 */
function normalize(value, scale) {
  return Math.max(-1, Math.min(1, value / scale));
}

/**
 * Clamp a rate change to realistic Fed increments.
 * The Fed typically moves in 0.25% steps, max ±1.00% at once.
 */
function clampToFedIncrements(rawChange) {
  const clamped = Math.max(-1.0, Math.min(1.0, rawChange));
  // Round to nearest 0.25
  return Math.round(clamped / 0.25) * 0.25;
}

/**
 * Detect supply shock: high inflation paired with weak or negative growth.
 * In this scenario, the Fed faces a difficult trade-off — tightening too
 * aggressively risks recession. We apply a dampening factor.
 */
function detectSupplyShock(inflationGap, gdpGrowth) {
  const highInflation = inflationGap > 1.5;
  const weakGrowth = gdpGrowth < 1.0;
  if (highInflation && weakGrowth) {
    return {
      detected: true,
      dampener: 0.6, // Reduce rate hike aggressiveness by 40%
      note: "Supply shock conditions detected (high inflation + weak growth). Policy response is moderated to avoid recession risk."
    };
  }
  return { detected: false, dampener: 1.0, note: null };
}

/**
 * Detect if the economy is in overheat territory:
 * strong growth + low unemployment + above-target inflation.
 */
function detectOverheat(inflationGap, unemploymentGap, gdpGrowth) {
  if (inflationGap > 1.0 && unemploymentGap < -0.5 && gdpGrowth > 2.5) {
    return {
      detected: true,
      amplifier: 1.2,
      note: "Economy shows signs of overheating. More aggressive tightening warranted."
    };
  }
  return { detected: false, amplifier: 1.0, note: null };
}

/**
 * Main prediction function.
 * @param {object} inputs - Economic indicators from the user
 * @param {object} weights - Adjustable weights for each factor (optional)
 * @returns {object} Decision output
 */
function predictRateChange(inputs, weights = {}) {
  const {
    inflation,
    inflationTarget = 2.0,
    unemployment,
    naturalUnemployment = 4.0, // NAIRU estimate
    gdpGrowth,
    potentialGdp = 2.0,        // Long-run potential GDP growth
    wageGrowth,
    consumerSpending,
    marketConditions = 50,      // 0-100 composite score; 50 = neutral
    inflationExpectations,
  } = inputs;

  // --- Weights (defaults inspired by Taylor Rule and Fed research) ---
  const w = {
    inflationGap: weights.inflationGap ?? 1.5,      // Inflation deviation weight
    outputGap: weights.outputGap ?? 0.5,            // GDP gap weight  
    unemploymentGap: weights.unemploymentGap ?? 0.4,// Unemployment gap weight
    wageGrowth: weights.wageGrowth ?? 0.2,          // Wage pressure weight
    consumerSpending: weights.consumerSpending ?? 0.15, // Spending momentum
    marketSentiment: weights.marketSentiment ?? 0.1,    // Market conditions
    expectations: weights.expectations ?? 0.3,      // Inflation expectations
  };

  // --- Compute gaps ---
  const inflationGap = inflation - inflationTarget;
  // Negative = unemployment above natural rate (slack), positive = tight labor market
  const unemploymentGap = naturalUnemployment - unemployment;
  const outputGap = gdpGrowth - potentialGdp;

  // --- Core Taylor Rule component ---
  // Positive = tighten, Negative = loosen
  let taylorComponent = (w.inflationGap * inflationGap) + (w.outputGap * outputGap);

  // --- Labor market component ---
  // Tight labor market (low unemployment, high wages) = inflationary pressure
  let laborComponent = 0;
  if (unemployment !== undefined && unemployment !== null) {
    laborComponent += w.unemploymentGap * unemploymentGap;
  }
  if (wageGrowth !== undefined && wageGrowth !== null) {
    // Wage growth above ~3.5% is considered inflationary
    const wageGap = wageGrowth - 3.5;
    laborComponent += w.wageGrowth * wageGap;
  }

  // --- Demand-side component ---
  let demandComponent = 0;
  if (consumerSpending !== undefined && consumerSpending !== null) {
    // Spending growth above ~2.5% suggests strong demand
    const spendingGap = consumerSpending - 2.5;
    demandComponent += w.consumerSpending * spendingGap;
  }

  // --- Market conditions component ---
  // Market score 0-100; 50 = neutral; >70 = strong/risky, <30 = weak/fragile
  let marketComponent = 0;
  if (marketConditions !== undefined && marketConditions !== null) {
    const marketNormalized = (marketConditions - 50) / 50; // -1 to +1
    marketComponent = w.marketSentiment * marketNormalized;
  }

  // --- Inflation expectations component ---
  let expectationsComponent = 0;
  if (inflationExpectations !== undefined && inflationExpectations !== null) {
    const expectationsGap = inflationExpectations - inflationTarget;
    expectationsComponent = w.expectations * expectationsGap;
  }

  // --- Raw rate change before adjustments ---
  let rawChange = taylorComponent + laborComponent + demandComponent + marketComponent + expectationsComponent;

  // --- Apply regime-specific adjustments ---
  const supplyShock = detectSupplyShock(inflationGap, gdpGrowth);
  const overheat = detectOverheat(inflationGap, unemploymentGap, gdpGrowth);

  let regimeNotes = [];
  if (supplyShock.detected) {
    rawChange *= supplyShock.dampener;
    regimeNotes.push(supplyShock.note);
  }
  if (overheat.detected) {
    rawChange *= overheat.amplifier;
    regimeNotes.push(overheat.note);
  }

  // --- Lag effect: current policy already has ~12-18mo lag ---
  // We model this by slightly dampening large swings (mean reversion)
  const lagDampener = Math.abs(rawChange) > 0.75 ? 0.85 : 1.0;
  rawChange *= lagDampener;
  if (lagDampener < 1.0) {
    regimeNotes.push("Monetary policy operates with a 12–18 month lag. The model applies a moderate dampening to avoid overcorrection.");
  }

  // --- Final clamped recommendation ---
  const recommendation = clampToFedIncrements(rawChange);

  // --- Policy stance ---
  let stance;
  if (recommendation > 0) stance = "Tighten";
  else if (recommendation < 0) stance = "Loosen";
  else stance = "Hold";

  // --- Confidence level ---
  const signalStrength = Math.abs(rawChange);
  let confidence;
  if (signalStrength >= 0.6) confidence = "High";
  else if (signalStrength >= 0.25) confidence = "Medium";
  else confidence = "Low";

  // --- Factor breakdown (for transparency) ---
  const factors = {
    "Inflation Gap": { value: inflationGap.toFixed(2), contribution: (w.inflationGap * inflationGap).toFixed(3) },
    "Output Gap (GDP)": { value: outputGap.toFixed(2), contribution: (w.outputGap * outputGap).toFixed(3) },
    "Labor Market": { value: unemploymentGap.toFixed(2), contribution: laborComponent.toFixed(3) },
    "Demand (Spending)": { value: (consumerSpending ?? "N/A"), contribution: demandComponent.toFixed(3) },
    "Market Conditions": { value: marketConditions ?? "N/A", contribution: marketComponent.toFixed(3) },
    "Inflation Expectations": { value: inflationExpectations ?? "N/A", contribution: expectationsComponent.toFixed(3) },
  };

  // --- Plain English explanation ---
  const explanation = buildExplanation({
    inflationGap,
    outputGap,
    unemploymentGap,
    inflation,
    inflationTarget,
    gdpGrowth,
    unemployment,
    recommendation,
    stance,
    confidence,
    regimeNotes,
    wageGrowth,
  });

  return {
    recommendation,
    recommendationFormatted: recommendation >= 0 ? `+${recommendation.toFixed(2)}%` : `${recommendation.toFixed(2)}%`,
    stance,
    confidence,
    explanation,
    factors,
    regimeNotes,
    rawScore: rawChange.toFixed(4),
  };
}

/**
 * Build a plain-English explanation of the recommendation.
 */
function buildExplanation({ inflationGap, outputGap, unemploymentGap, inflation,
  inflationTarget, gdpGrowth, unemployment, recommendation, stance, confidence, regimeNotes, wageGrowth }) {

  const parts = [];

  // Inflation assessment
  if (inflationGap > 1.5) {
    parts.push(`Inflation at ${inflation}% is significantly above the ${inflationTarget}% target — a strong signal to tighten policy.`);
  } else if (inflationGap > 0.5) {
    parts.push(`Inflation at ${inflation}% is moderately above the ${inflationTarget}% target, adding upward pressure on rates.`);
  } else if (inflationGap < -0.5) {
    parts.push(`Inflation at ${inflation}% is below the ${inflationTarget}% target, supporting a rate cut to stimulate price growth.`);
  } else {
    parts.push(`Inflation at ${inflation}% is close to the ${inflationTarget}% target — broadly on track.`);
  }

  // Growth assessment
  if (outputGap > 1.0) {
    parts.push(`GDP growth of ${gdpGrowth}% is running above potential, suggesting demand-driven inflationary pressure.`);
  } else if (outputGap < -1.0) {
    parts.push(`GDP growth of ${gdpGrowth}% is below potential, indicating slack in the economy that may argue for stimulus.`);
  } else {
    parts.push(`GDP growth of ${gdpGrowth}% is near the long-run potential.`);
  }

  // Labor market
  if (unemployment !== undefined && unemployment !== null) {
    if (unemploymentGap > 0.5) {
      parts.push(`Unemployment at ${unemployment}% is above the natural rate, indicating labor market slack that moderates the need for tightening.`);
    } else if (unemploymentGap < -0.5) {
      parts.push(`Unemployment at ${unemployment}% is below the natural rate — a tight labor market that could fuel wage-price spirals.`);
    } else {
      parts.push(`The labor market at ${unemployment}% unemployment is near equilibrium.`);
    }
  }

  // Wage growth
  if (wageGrowth !== undefined && wageGrowth !== null) {
    if (wageGrowth > 4.5) {
      parts.push(`Wage growth of ${wageGrowth}% is elevated, a key driver of services inflation and a reason for caution.`);
    } else if (wageGrowth < 2.5) {
      parts.push(`Modest wage growth of ${wageGrowth}% suggests limited pass-through inflation risk from labor costs.`);
    }
  }

  // Regime notes
  if (regimeNotes.length > 0) {
    regimeNotes.forEach(note => parts.push(note));
  }

  // Concluding sentence
  if (stance === "Tighten") {
    parts.push(`Given the balance of evidence, a rate increase of ${recommendation >= 0 ? "+" : ""}${recommendation.toFixed(2)}% is recommended to bring inflation back toward target.`);
  } else if (stance === "Loosen") {
    parts.push(`Given the balance of evidence, a rate cut of ${recommendation.toFixed(2)}% is recommended to support economic activity.`);
  } else {
    parts.push(`The balance of evidence suggests holding rates steady while monitoring incoming data.`);
  }

  return parts.join(" ");
}

module.exports = { predictRateChange };
