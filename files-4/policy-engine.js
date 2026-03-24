/**
 * MACRO|PULSE Policy Engine
 * Analyzes current economic conditions and recommends monetary policy.
 *
 * Algorithm:
 * 1. Compute Taylor Rule recommended rate
 * 2. Compare with current Fed Funds rate → rate gap
 * 3. Assess inflation gap (actual − target)
 * 4. Assess unemployment gap (actual − NAIRU)
 * 5. Check output gap (real GDP − potential GDP)
 * 6. Compute yield curve spread (10Y − 2Y)
 * 7. Weight all signals into a composite policy score
 * 8. Map score to dovish/hawkish/neutral recommendation
 */
const PolicyEngine = (() => {

  function analyze(econ, derived) {
    const {
      currentInflation,
      currentUnemployment,
      currentFedFunds,
      currentGDP,
      outputGap,
      yieldSpread,
    } = derived;

    // 1. Taylor Rule
    const taylorRate = Equations.computeTaylorRate(derived);
    const rateGap = taylorRate - currentFedFunds;  // positive = should hike

    // 2. Inflation gap
    const inflationGap = currentInflation - CONFIG.TARGETS.INFLATION;

    // 3. Unemployment gap
    const unemploymentGap = currentUnemployment - CONFIG.TARGETS.UNEMPLOYMENT_NAIRU;

    // 4. Real rate
    const realRate = currentFedFunds - currentInflation;

    // 5. Misery index
    const miseryIndex = currentInflation + currentUnemployment;

    // ── Composite Scoring ──
    // Score from -100 (very dovish/cut) to +100 (very hawkish/hike)
    let score = 0;

    // Taylor Rule signal (weight: 30%)
    score += clamp(rateGap * 15, -30, 30);

    // Inflation signal (weight: 30%)
    score += clamp(inflationGap * 15, -30, 30);

    // Unemployment signal (weight: 20%) — high unemployment → dovish
    score -= clamp(unemploymentGap * 10, -20, 20);

    // Output gap signal (weight: 10%)
    score += clamp(outputGap * 5, -10, 10);

    // Yield curve signal (weight: 10%) — inverted curve → dovish
    if (yieldSpread < 0) {
      score -= clamp(Math.abs(yieldSpread) * 10, 0, 10);
    } else {
      score += clamp(yieldSpread * 3, 0, 10);
    }

    score = clamp(score, -100, 100);

    // ── Determine Stance ──
    let stance, action, rationale;
    const absScore = Math.abs(score);

    if (score > 20) {
      stance = 'hawkish';
      if (score > 60) {
        action = `Raise Rates by ${Math.min(75, Math.round(rateGap * 25))} bps`;
        rationale = buildRationale('strongly hawkish', inflationGap, unemploymentGap, taylorRate, currentFedFunds, realRate, yieldSpread);
      } else {
        action = `Raise Rates by 25 bps`;
        rationale = buildRationale('moderately hawkish', inflationGap, unemploymentGap, taylorRate, currentFedFunds, realRate, yieldSpread);
      }
    } else if (score < -20) {
      stance = 'dovish';
      if (score < -60) {
        action = `Cut Rates by ${Math.min(75, Math.round(Math.abs(rateGap) * 25))} bps`;
        rationale = buildRationale('strongly dovish', inflationGap, unemploymentGap, taylorRate, currentFedFunds, realRate, yieldSpread);
      } else {
        action = `Cut Rates by 25 bps`;
        rationale = buildRationale('moderately dovish', inflationGap, unemploymentGap, taylorRate, currentFedFunds, realRate, yieldSpread);
      }
    } else {
      stance = 'neutral-stance';
      action = 'Hold Rates Steady';
      rationale = buildRationale('neutral', inflationGap, unemploymentGap, taylorRate, currentFedFunds, realRate, yieldSpread);
    }

    // ── Score breakdown for meters ──
    const meters = [
      {
        label: 'Inflation',
        value: normalize(inflationGap, -3, 5),
        color: inflationGap > 1 ? '#f87171' : inflationGap < -0.5 ? '#34d399' : '#fbbf24',
      },
      {
        label: 'Employment',
        value: normalize(-unemploymentGap, -3, 3),
        color: unemploymentGap > 0.5 ? '#f87171' : unemploymentGap < -0.5 ? '#34d399' : '#fbbf24',
      },
      {
        label: 'Taylor Gap',
        value: normalize(rateGap, -4, 4),
        color: rateGap > 0.5 ? '#f87171' : rateGap < -0.5 ? '#34d399' : '#60a5fa',
      },
      {
        label: 'Output Gap',
        value: normalize(outputGap, -5, 5),
        color: outputGap > 0 ? '#34d399' : '#f87171',
      },
      {
        label: 'Yield Curve',
        value: normalize(yieldSpread, -2, 3),
        color: yieldSpread < 0 ? '#f87171' : '#34d399',
      },
    ];

    return {
      score,
      stance,
      action,
      rationale,
      meters,
      taylorRate,
      rateGap,
      inflationGap,
      unemploymentGap,
      realRate,
      miseryIndex,
      yieldSpread,
    };
  }

  function buildRationale(mode, inflGap, uGap, taylor, fedFunds, realRate, yieldSpread) {
    let r = '';
    if (mode.includes('hawkish')) {
      r += `Inflation is running ${Math.abs(inflGap).toFixed(1)}pp ${inflGap > 0 ? 'above' : 'below'} the 2% target. `;
      r += `The Taylor Rule suggests a rate of ${taylor.toFixed(2)}%, which is ${(taylor - fedFunds).toFixed(2)}pp above the current fed funds rate. `;
      if (uGap < 0) r += `The labor market remains tight with unemployment ${Math.abs(uGap).toFixed(1)}pp below NAIRU, adding upward pressure on wages and prices. `;
      r += `The real interest rate stands at ${realRate.toFixed(2)}%. `;
      if (realRate < 0) r += `Negative real rates indicate policy is still accommodative despite nominal tightening. `;
    } else if (mode.includes('dovish')) {
      r += `The economy shows signs of weakness. `;
      if (uGap > 0) r += `Unemployment at ${(CONFIG.TARGETS.UNEMPLOYMENT_NAIRU + uGap).toFixed(1)}% is ${uGap.toFixed(1)}pp above the estimated natural rate, suggesting slack in the labor market. `;
      if (inflGap < 0) r += `Inflation running below target at ${(CONFIG.TARGETS.INFLATION + inflGap).toFixed(1)}% provides room for monetary easing. `;
      r += `The Taylor Rule prescribes a rate of ${taylor.toFixed(2)}%, which is ${(fedFunds - taylor).toFixed(2)}pp below current policy. `;
      if (yieldSpread < 0) r += `An inverted yield curve (spread: ${yieldSpread.toFixed(2)}pp) signals recession risk. `;
    } else {
      r += `The economy is near equilibrium. `;
      r += `Inflation at ${(CONFIG.TARGETS.INFLATION + inflGap).toFixed(1)}% is close to the 2% target. `;
      r += `Unemployment at ${(CONFIG.TARGETS.UNEMPLOYMENT_NAIRU + uGap).toFixed(1)}% is near the estimated natural rate. `;
      r += `The Taylor Rule rate of ${taylor.toFixed(2)}% is approximately in line with the current fed funds rate of ${fedFunds.toFixed(2)}%. `;
      r += `Current policy appears appropriately calibrated for prevailing conditions. `;
    }
    return r;
  }

  function render(container, result) {
    container.innerHTML = '';

    // Policy Card
    const card = document.createElement('div');
    card.className = `policy-card ${result.stance} fade-in`;

    const stanceEl = document.createElement('div');
    stanceEl.className = `policy-stance ${result.stance}`;
    stanceEl.textContent = result.stance.replace('-stance', '') + ` (score: ${result.score.toFixed(0)})`;
    card.appendChild(stanceEl);

    const actionEl = document.createElement('div');
    actionEl.className = 'policy-action';
    actionEl.textContent = result.action;
    card.appendChild(actionEl);

    const rationaleEl = document.createElement('div');
    rationaleEl.className = 'policy-rationale';
    rationaleEl.textContent = result.rationale;
    card.appendChild(rationaleEl);

    container.appendChild(card);

    // Meters
    const metersWrap = document.createElement('div');
    metersWrap.className = 'score-meters fade-in';

    result.meters.forEach(m => {
      const row = document.createElement('div');
      row.className = 'meter-row';
      row.innerHTML = `
        <div class="meter-label">${m.label}</div>
        <div class="meter-track">
          <div class="meter-fill" style="width:${(m.value * 100).toFixed(0)}%;background:${m.color}"></div>
        </div>
        <div class="meter-val">${(m.value * 100).toFixed(0)}%</div>
      `;
      metersWrap.appendChild(row);
    });

    container.appendChild(metersWrap);
  }

  // Helpers
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function normalize(v, min, max) { return clamp((v - min) / (max - min), 0, 1); }

  return { analyze, render };
})();
