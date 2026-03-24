/**
 * MACRO|PULSE Forecast Module
 * Projects economic indicators 12 months forward using:
 * - Phillips Curve for inflation
 * - Okun's Law for unemployment
 * - Trend extrapolation with mean reversion
 * - Taylor Rule for rate path
 */
const Forecast = (() => {

  function generate(derived, policyResult) {
    const {
      currentInflation,
      currentUnemployment,
      currentFedFunds,
      currentGDP,
      outputGap,
    } = derived;

    // ── GDP Forecast ──
    // Mean reversion toward potential growth (~2%) with momentum
    const gdpTrend = 2.0;
    const gdpMomentum = (currentGDP - gdpTrend) * 0.6; // decays
    const gdp12m = gdpTrend + gdpMomentum * 0.4;
    const gdpLow = gdp12m - 1.2;
    const gdpHigh = gdp12m + 0.8;
    const gdpDirection = gdp12m > currentGDP ? 'up' : gdp12m < currentGDP ? 'down' : 'flat';

    // ── Inflation Forecast ──
    // Phillips Curve: inflation responds to unemployment gap
    const phillipsBeta = 0.5;
    const uGap = currentUnemployment - CONFIG.TARGETS.UNEMPLOYMENT_NAIRU;
    const phillipsEffect = -phillipsBeta * uGap;
    // Mean reversion toward target
    const inflMeanRevert = (CONFIG.TARGETS.INFLATION - currentInflation) * 0.3;
    const infl12m = currentInflation + phillipsEffect * 0.5 + inflMeanRevert;
    const inflLow = infl12m - 0.6;
    const inflHigh = infl12m + 0.8;
    const inflDirection = infl12m > currentInflation ? 'up' : infl12m < currentInflation ? 'down' : 'flat';

    // ── Unemployment Forecast ──
    // Okun's Law: ΔU ≈ -0.5 × (GDP growth - trend)
    const okunDelta = -0.5 * (gdp12m - gdpTrend);
    const unem12m = Math.max(3.0, currentUnemployment + okunDelta);
    const unemLow = Math.max(3.0, unem12m - 0.4);
    const unemHigh = unem12m + 0.6;
    const unemDirection = unem12m > currentUnemployment ? 'up' : unem12m < currentUnemployment ? 'down' : 'flat';

    // ── Fed Funds Forecast ──
    // Based on Taylor Rule gap and policy stance
    let rateChange = 0;
    if (policyResult.stance === 'hawkish') {
      rateChange = Math.min(1.0, policyResult.rateGap * 0.4);
    } else if (policyResult.stance === 'dovish') {
      rateChange = Math.max(-1.0, policyResult.rateGap * 0.4);
    }
    const rate12m = Math.max(0, currentFedFunds + rateChange);
    const rateLow = Math.max(0, rate12m - 0.5);
    const rateHigh = rate12m + 0.5;
    const rateDirection = rate12m > currentFedFunds ? 'up' : rate12m < currentFedFunds ? 'down' : 'flat';

    // ── Overall Economic Outlook ──
    let outlook, outlookNarrative;
    const riskScore = (Math.abs(policyResult.inflationGap) * 2) +
                      (Math.max(0, policyResult.unemploymentGap) * 3) +
                      (policyResult.yieldSpread < 0 ? 15 : 0) +
                      (currentGDP < 0 ? 20 : 0);

    if (riskScore < 5) {
      outlook = 'Expansion';
      outlookNarrative = 'The economy appears well-positioned for continued expansion. Inflation is near target, the labor market is balanced, and growth momentum is positive. Risks are tilted toward overheating if conditions persist without policy adjustment.';
    } else if (riskScore < 15) {
      outlook = 'Late Cycle';
      outlookNarrative = 'The economy is in the late stages of expansion. Tightening labor markets or above-target inflation may prompt further policy adjustment. Watch for signs of deceleration in leading indicators.';
    } else if (riskScore < 30) {
      outlook = 'Slowdown';
      outlookNarrative = 'Economic momentum is fading. Rising unemployment or falling growth suggests the expansion is losing steam. Monetary policy may need to pivot toward accommodation to support the economy.';
    } else {
      outlook = 'Recession Risk';
      outlookNarrative = 'Multiple indicators signal elevated recession risk. An inverted yield curve, weak growth, and rising unemployment point to a potential contraction. Aggressive policy response may be warranted.';
    }

    return {
      gdp: { current: currentGDP, forecast: gdp12m, low: gdpLow, high: gdpHigh, direction: gdpDirection },
      inflation: { current: currentInflation, forecast: infl12m, low: inflLow, high: inflHigh, direction: inflDirection },
      unemployment: { current: currentUnemployment, forecast: unem12m, low: unemLow, high: unemHigh, direction: unemDirection },
      rates: { current: currentFedFunds, forecast: rate12m, low: rateLow, high: rateHigh, direction: rateDirection },
      outlook,
      outlookNarrative,
      riskScore,
      confidence: Math.max(20, 80 - riskScore),
    };
  }

  function render(container, forecast) {
    container.innerHTML = '';

    // Outlook header
    const outlookSection = document.createElement('div');
    outlookSection.className = 'forecast-section fade-in';
    outlookSection.innerHTML = `
      <div class="forecast-indicator">Overall Outlook</div>
      <div class="forecast-direction">
        <span class="forecast-range" style="color:${getOutlookColor(forecast.outlook)}">${forecast.outlook}</span>
      </div>
      <div class="forecast-narrative">${forecast.outlookNarrative}</div>
      <div class="confidence-bar">
        <span class="confidence-label">Confidence</span>
        <div class="confidence-track">
          <div class="confidence-fill" style="width:${forecast.confidence}%"></div>
        </div>
        <span class="confidence-label">${forecast.confidence}%</span>
      </div>
    `;
    container.appendChild(outlookSection);

    // Individual forecasts
    const indicators = [
      { key: 'gdp', label: 'GDP Growth', unit: '%' },
      { key: 'inflation', label: 'Inflation (CPI)', unit: '%' },
      { key: 'unemployment', label: 'Unemployment', unit: '%' },
      { key: 'rates', label: 'Fed Funds Rate', unit: '%' },
    ];

    indicators.forEach(ind => {
      const f = forecast[ind.key];
      const section = document.createElement('div');
      section.className = 'forecast-section fade-in';

      const arrowClass = f.direction === 'up' ? 'up' : f.direction === 'down' ? 'down' : 'flat';
      const arrowChar = f.direction === 'up' ? '↑' : f.direction === 'down' ? '↓' : '→';

      section.innerHTML = `
        <div class="forecast-indicator">${ind.label}</div>
        <div class="forecast-direction">
          <span class="forecast-arrow ${arrowClass}">${arrowChar}</span>
          <span class="forecast-range">${f.forecast.toFixed(1)}${ind.unit}</span>
          <span style="color:var(--text-muted);font-size:0.72rem;font-family:var(--font-mono)">
            (${f.low.toFixed(1)} – ${f.high.toFixed(1)})
          </span>
        </div>
        <div class="forecast-narrative" style="font-size:0.68rem;">
          Current: ${f.current.toFixed(1)}${ind.unit} → 12-month: ${f.forecast.toFixed(1)}${ind.unit}
        </div>
      `;
      container.appendChild(section);
    });
  }

  function renderProjections(econ, forecast) {
    // GDP projection
    const projGdp = document.getElementById('proj-gdp');
    if (projGdp) {
      projGdp.innerHTML = `
        <span class="proj-label">12-Month Projection (Okun's Law + Trend Reversion)</span>
        <span class="proj-value">${forecast.gdp.forecast.toFixed(1)}%</span>
        <span> range: ${forecast.gdp.low.toFixed(1)}% – ${forecast.gdp.high.toFixed(1)}%</span>
      `;
    }
    // Inflation projection
    const projInfl = document.getElementById('proj-inflation');
    if (projInfl) {
      projInfl.innerHTML = `
        <span class="proj-label">12-Month Projection (Phillips Curve)</span>
        <span class="proj-value">${forecast.inflation.forecast.toFixed(1)}%</span>
        <span> range: ${forecast.inflation.low.toFixed(1)}% – ${forecast.inflation.high.toFixed(1)}%</span>
      `;
    }
    // Unemployment projection
    const projUnem = document.getElementById('proj-unemployment');
    if (projUnem) {
      projUnem.innerHTML = `
        <span class="proj-label">12-Month Projection (Okun's Law)</span>
        <span class="proj-value">${forecast.unemployment.forecast.toFixed(1)}%</span>
        <span> range: ${forecast.unemployment.low.toFixed(1)}% – ${forecast.unemployment.high.toFixed(1)}%</span>
      `;
    }
  }

  function getOutlookColor(outlook) {
    const map = {
      'Expansion': '#34d399',
      'Late Cycle': '#fbbf24',
      'Slowdown': '#fb923c',
      'Recession Risk': '#f87171',
    };
    return map[outlook] || '#60a5fa';
  }

  return { generate, render, renderProjections };
})();
