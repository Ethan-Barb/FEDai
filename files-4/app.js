/**
 * MACRO|PULSE — Main Application
 * Orchestrates data fetching, computation, rendering, and updates.
 */
(async function App() {
  const loader = document.getElementById('app-loader');

  try {
    // ── 1. Fetch all economic data from FRED ──
    const econ = await DataFetcher.fetchAll();

    // ── 2. Derive current values ──
    const derived = deriveCurrentValues(econ);

    // ── 3. Render KPI strip ──
    renderKPIs(derived, econ);

    // ── 4. Render charts ──
    Charts.renderAll(econ);

    // ── 5. Render equations with live data ──
    Equations.render(document.getElementById('equations-content'), derived);

    // ── 6. Run policy engine ──
    const policyResult = PolicyEngine.analyze(econ, derived);
    PolicyEngine.render(document.getElementById('policy-content'), policyResult);

    // ── 7. Generate and render forecasts ──
    const forecast = Forecast.generate(derived, policyResult);
    Forecast.render(document.getElementById('forecast-content'), forecast);
    Forecast.renderProjections(econ, forecast);

    // ── 8. Update metadata ──
    document.getElementById('last-updated').textContent =
      `Updated: ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

    // ── 9. Hide loader ──
    setTimeout(() => loader.classList.add('hidden'), 600);

  } catch (err) {
    console.error('App initialization failed:', err);
    loader.querySelector('.loader-status').textContent = 'Error loading data. Check console.';
    loader.querySelector('.loader-status').style.color = '#f87171';
  }

  /** Extract latest values from all series */
  function deriveCurrentValues(econ) {
    const val = (series) => {
      const v = DataFetcher.latest(series);
      return v ? v.value : 0;
    };

    const currentInflation = val(econ.cpi);
    const currentUnemployment = val(econ.unemployment);
    const currentFedFunds = val(econ.fedFunds);
    const currentGDP = val(econ.gdpGrowth);

    // Output gap: (Real GDP - Potential GDP) / Potential GDP * 100
    let outputGap = 0;
    if (econ.realGDP && econ.potentialGDP) {
      const rGDP = val(econ.realGDP);
      const pGDP = val(econ.potentialGDP);
      if (pGDP !== 0) outputGap = ((rGDP - pGDP) / pGDP) * 100;
    }

    // Yield spread: 10Y - 2Y
    let yieldSpread = 0;
    if (econ.treasury10y && econ.treasury2y) {
      yieldSpread = val(econ.treasury10y) - val(econ.treasury2y);
    }

    return {
      currentInflation,
      currentUnemployment,
      currentFedFunds,
      currentGDP,
      outputGap,
      yieldSpread,
    };
  }

  /** Render the KPI ticker strip */
  function renderKPIs(derived, econ) {
    const strip = document.getElementById('kpi-strip');
    const kpis = [
      {
        label: 'GDP Growth',
        value: derived.currentGDP,
        suffix: '%',
        prev: getPrevValue(econ.gdpGrowth),
        accent: '#34d399',
      },
      {
        label: 'CPI Inflation',
        value: derived.currentInflation,
        suffix: '%',
        prev: getPrevValue(econ.cpi),
        accent: '#f87171',
      },
      {
        label: 'Unemployment',
        value: derived.currentUnemployment,
        suffix: '%',
        prev: getPrevValue(econ.unemployment),
        accent: '#a78bfa',
      },
      {
        label: 'Fed Funds Rate',
        value: derived.currentFedFunds,
        suffix: '%',
        prev: getPrevValue(econ.fedFunds),
        accent: '#22d3ee',
      },
      {
        label: 'Output Gap',
        value: derived.outputGap,
        suffix: '%',
        prev: null,
        accent: '#fbbf24',
      },
      {
        label: 'Yield Spread',
        value: derived.yieldSpread,
        suffix: 'pp',
        prev: null,
        accent: '#60a5fa',
      },
    ];

    strip.innerHTML = kpis.map(kpi => {
      const delta = kpi.prev !== null ? kpi.value - kpi.prev : null;
      const deltaClass = delta > 0.01 ? 'positive' : delta < -0.01 ? 'negative' : 'neutral';
      const arrow = delta > 0.01 ? '▲' : delta < -0.01 ? '▼' : '—';
      const deltaStr = delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}` : '—';

      return `
        <div class="kpi-card" style="--card-accent:${kpi.accent}">
          <div class="kpi-label">${kpi.label}</div>
          <div class="kpi-value">${kpi.value.toFixed(2)}${kpi.suffix}</div>
          <div class="kpi-delta ${deltaClass}">
            <span class="arrow">${arrow}</span>
            <span>${deltaStr} from prior</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function getPrevValue(series) {
    const p = DataFetcher.previous(series);
    return p ? p.value : null;
  }

})();
