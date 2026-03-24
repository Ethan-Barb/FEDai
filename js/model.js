/* ================================================================
   model.js — Taylor Rule Decision Engine
   All computation runs in the browser. No backend required.

   Core formula (Taylor, 1993):
     r = r* + π + α(π − π*) + β(y − y*)

   Extended with: labor market gap, wage pressure,
   consumer spending momentum, market sentiment,
   and forward inflation expectations.
================================================================ */

/**
 * Clamp a raw rate change to the nearest 0.25% Fed increment,
 * bounded between -1.00% and +1.00%.
 */
function clampToFedIncrements(rawChange) {
  const clamped = Math.max(-1.0, Math.min(1.0, rawChange));
  return Math.round(clamped / 0.25) * 0.25;
}

/**
 * Supply shock detector:
 * High inflation + weak/negative growth = stagflationary signal.
 * The Fed faces a painful trade-off here — tightening too hard
 * risks tipping into recession. We dampen the response by 40%.
 */
function detectSupplyShock(inflationGap, gdpGrowth) {
  if (inflationGap > 1.5 && gdpGrowth < 1.0) {
    return {
      detected: true,
      dampener: 0.6,
      note: "Supply shock detected (high inflation + weak growth). Policy response dampened to reduce recession risk."
    };
  }
  return { detected: false, dampener: 1.0, note: null };
}

/**
 * Overheating detector:
 * Inflation significantly above target + tight labor + strong growth
 * = more aggressive tightening warranted.
 */
function detectOverheat(inflationGap, unemploymentGap, gdpGrowth) {
  if (inflationGap > 1.0 && unemploymentGap < -0.5 && gdpGrowth > 2.5) {
    return {
      detected: true,
      amplifier: 1.2,
      note: "Economy shows signs of overheating. More aggressive tightening is warranted."
    };
  }
  return { detected: false, amplifier: 1.0, note: null };
}

/**
 * Main model function.
 *
 * @param {object} inputs  - Economic indicators from the user
 * @param {object} weights - Adjustable model weights (advanced mode)
 * @returns {object}       - Decision output
 */
function predictRateChange(inputs, weights) {
  weights = weights || {};

  // ── Unpack inputs ──────────────────────────────────────
  const inflation             = inputs.inflation;
  const inflationTarget       = inputs.inflationTarget       ?? 2.0;
  const unemployment          = inputs.unemployment;
  const naturalUnemployment   = inputs.naturalUnemployment   ?? 4.0;
  const gdpGrowth             = inputs.gdpGrowth;
  const potentialGdp          = inputs.potentialGdp          ?? 2.0;
  const wageGrowth            = inputs.wageGrowth;
  const consumerSpending      = inputs.consumerSpending;
  const marketConditions      = inputs.marketConditions      ?? 50;
  const inflationExpectations = inputs.inflationExpectations;

  // ── Weights (Taylor Rule defaults + extended) ──────────
  const w = {
    inflationGap:     weights.inflationGap     ?? 1.5,   // standard Taylor: 1.5
    outputGap:        weights.outputGap        ?? 0.5,   // standard Taylor: 0.5
    unemploymentGap:  weights.unemploymentGap  ?? 0.4,
    wageGrowth:       weights.wageGrowth       ?? 0.2,
    consumerSpending: weights.consumerSpending ?? 0.15,
    marketSentiment:  weights.marketSentiment  ?? 0.1,
    expectations:     weights.expectations     ?? 0.3,
  };

  // ── Compute gaps ───────────────────────────────────────
  const inflationGap    = inflation - inflationTarget;
  const unemploymentGap = naturalUnemployment - unemployment; // + = tight labor
  const outputGap       = gdpGrowth - potentialGdp;           // + = overheating

  // ── Taylor Rule core ───────────────────────────────────
  let taylorComponent = (w.inflationGap * inflationGap) + (w.outputGap * outputGap);

  // ── Labor market component ─────────────────────────────
  let laborComponent = w.unemploymentGap * unemploymentGap;
  if (wageGrowth != null && wageGrowth !== '') {
    laborComponent += w.wageGrowth * (wageGrowth - 3.5); // 3.5% = neutral wage growth
  }

  // ── Demand component ───────────────────────────────────
  let demandComponent = 0;
  if (consumerSpending != null && consumerSpending !== '') {
    demandComponent = w.consumerSpending * (consumerSpending - 2.5);
  }

  // ── Market sentiment component ─────────────────────────
  let marketComponent = 0;
  if (marketConditions != null) {
    marketComponent = w.marketSentiment * ((marketConditions - 50) / 50);
  }

  // ── Inflation expectations component ───────────────────
  let expectationsComponent = 0;
  if (inflationExpectations != null && inflationExpectations !== '') {
    expectationsComponent = w.expectations * (inflationExpectations - inflationTarget);
  }

  // ── Raw signal ─────────────────────────────────────────
  let rawChange = taylorComponent + laborComponent + demandComponent
                + marketComponent + expectationsComponent;

  // ── Regime adjustments ─────────────────────────────────
  const supplyShock = detectSupplyShock(inflationGap, gdpGrowth);
  const overheat    = detectOverheat(inflationGap, unemploymentGap, gdpGrowth);
  const regimeNotes = [];

  if (supplyShock.detected) { rawChange *= supplyShock.dampener; regimeNotes.push(supplyShock.note); }
  if (overheat.detected)    { rawChange *= overheat.amplifier;   regimeNotes.push(overheat.note);    }

  // ── Lag effect dampening ───────────────────────────────
  // Monetary policy takes 12–18 months to work through the economy.
  // Very large swings are dampened to avoid overcorrection.
  const lagDampener = Math.abs(rawChange) > 0.75 ? 0.85 : 1.0;
  rawChange *= lagDampener;
  if (lagDampener < 1.0) {
    regimeNotes.push(
      "Monetary policy operates with a 12–18 month lag. A moderate dampener is applied to avoid overcorrection."
    );
  }

  // ── Final output ───────────────────────────────────────
  const recommendation = clampToFedIncrements(rawChange);
  const stance = recommendation > 0 ? "Tighten" : recommendation < 0 ? "Loosen" : "Hold";

  const signalStrength = Math.abs(rawChange);
  const confidence = signalStrength >= 0.6 ? "High" : signalStrength >= 0.25 ? "Medium" : "Low";

  // ── Factor contributions (for display) ─────────────────
  const factors = {
    "Inflation Gap": {
      value: inflationGap.toFixed(2) + " pp",
      contribution: (w.inflationGap * inflationGap).toFixed(3),
      weight: w.inflationGap,
    },
    "Output Gap (GDP)": {
      value: outputGap.toFixed(2) + " pp",
      contribution: (w.outputGap * outputGap).toFixed(3),
      weight: w.outputGap,
    },
    "Labor Market": {
      value: unemploymentGap.toFixed(2) + " pp",
      contribution: laborComponent.toFixed(3),
      weight: w.unemploymentGap,
    },
    "Demand (Spending)": {
      value: consumerSpending != null ? consumerSpending + "%" : "N/A",
      contribution: demandComponent.toFixed(3),
      weight: w.consumerSpending,
    },
    "Market Conditions": {
      value: marketConditions,
      contribution: marketComponent.toFixed(3),
      weight: w.marketSentiment,
    },
    "Inflation Expectations": {
      value: inflationExpectations != null ? inflationExpectations + "%" : "N/A",
      contribution: expectationsComponent.toFixed(3),
      weight: w.expectations,
    },
  };

  // ── Equation strings (for display) ─────────────────────
  const equationParts = {
    formula: `r = α(π − π*) + β(y − y*) + γ(u* − u) + δ·w + ε·c + ζ·m + η·πᵉ`,
    substituted:
      `r = ${w.inflationGap}×(${inflation}−${inflationTarget}) + ${w.outputGap}×(${gdpGrowth}−${potentialGdp})\n` +
      `  + ${w.unemploymentGap}×(${naturalUnemployment}−${unemployment})\n` +
      `  = ${w.inflationGap}×(${inflationGap.toFixed(2)}) + ${w.outputGap}×(${outputGap.toFixed(2)}) + ${laborComponent.toFixed(3)}...\n` +
      `  ≈ ${rawChange.toFixed(4)} → clamped to ${recommendation >= 0 ? '+' : ''}${recommendation.toFixed(2)}%`,
    legend: {
      "π": `Inflation (${inflation}%)`,
      "π*": `Target inflation (${inflationTarget}%)`,
      "y": `GDP growth (${gdpGrowth}%)`,
      "y*": `Potential GDP (${potentialGdp}%)`,
      "u": `Unemployment (${unemployment}%)`,
      "u*": `NAIRU (${naturalUnemployment}%)`,
      "α": `Inflation weight (${w.inflationGap})`,
      "β": `Output gap weight (${w.outputGap})`,
      "γ": `Unemployment weight (${w.unemploymentGap})`,
    }
  };

  return {
    recommendation,
    recommendationFormatted: recommendation >= 0
      ? `+${recommendation.toFixed(2)}%`
      : `${recommendation.toFixed(2)}%`,
    stance,
    confidence,
    factors,
    equationParts,
    regimeNotes,
    rawScore: rawChange.toFixed(4),
    inputs: { ...inputs, inflationGap, outputGap, unemploymentGap, w },
  };
}
