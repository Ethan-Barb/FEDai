/**
 * MACRO|PULSE Equations Module
 * Renders the economic models and algorithms used for analysis.
 * Uses KaTeX for beautiful math rendering.
 */
const Equations = (() => {

  const models = [
    {
      name: 'Taylor Rule',
      description: 'Determines the optimal federal funds rate based on inflation and output gaps.',
      latex: 'i_t = r^* + \\pi_t + 0.5(\\pi_t - \\pi^*) + 0.5(y_t - \\bar{y}_t)',
      variables: [
        ['i_t', 'Recommended nominal interest rate'],
        ['r^*', 'Equilibrium real rate (neutral rate)'],
        ['\\pi_t', 'Current inflation rate'],
        ['\\pi^*', 'Target inflation rate (2%)'],
        ['y_t - \\bar{y}_t', 'Output gap (actual − potential GDP)'],
      ],
      compute: (data) => {
        const inflation = data.currentInflation;
        const outputGap = data.outputGap;
        const r_star = CONFIG.TARGETS.NEUTRAL_RATE;
        const pi_star = CONFIG.TARGETS.INFLATION;
        const rate = r_star + inflation + 0.5 * (inflation - pi_star) + 0.5 * outputGap;
        return {
          result: rate,
          label: 'Taylor Rule Rate',
          unit: '%',
          inputs: { 'r*': r_star, 'π': inflation, 'π*': pi_star, 'gap': outputGap }
        };
      }
    },
    {
      name: 'Phillips Curve (Expectations-Augmented)',
      description: 'Models the inverse relationship between unemployment and inflation, incorporating expectations.',
      latex: '\\pi_t = \\pi_t^e - \\beta(u_t - u^*) + \\varepsilon_t',
      variables: [
        ['\\pi_t', 'Actual inflation'],
        ['\\pi_t^e', 'Expected inflation (anchored at target)'],
        ['\\beta', 'Sensitivity coefficient (≈ 0.5)'],
        ['u_t', 'Current unemployment rate'],
        ['u^*', 'NAIRU (natural rate of unemployment)'],
      ],
      compute: (data) => {
        const pi_e = CONFIG.TARGETS.INFLATION;
        const beta = 0.5;
        const u_gap = data.currentUnemployment - CONFIG.TARGETS.UNEMPLOYMENT_NAIRU;
        const predicted = pi_e - beta * u_gap;
        return {
          result: predicted,
          label: 'Predicted Inflation',
          unit: '%',
          inputs: { 'πᵉ': pi_e, 'β': beta, 'u': data.currentUnemployment, 'u*': CONFIG.TARGETS.UNEMPLOYMENT_NAIRU }
        };
      }
    },
    {
      name: "Okun's Law",
      description: 'Relates changes in unemployment to GDP growth deviations from trend.',
      latex: '\\Delta u_t \\approx -\\frac{1}{2}(g_{y,t} - \\bar{g}_y)',
      variables: [
        ['\\Delta u_t', 'Change in unemployment rate'],
        ['g_{y,t}', 'Actual real GDP growth rate'],
        ['\\bar{g}_y', 'Trend/potential GDP growth (≈ 2%)'],
      ],
      compute: (data) => {
        const trendGrowth = 2.0;
        const predictedDeltaU = -0.5 * (data.currentGDP - trendGrowth);
        return {
          result: predictedDeltaU,
          label: 'Predicted ΔUnemployment',
          unit: 'pp',
          inputs: { 'g_y': data.currentGDP, 'ḡ_y': trendGrowth }
        };
      }
    },
    {
      name: 'Misery Index',
      description: 'A simple composite indicator summing inflation and unemployment — higher values indicate greater economic distress.',
      latex: 'M = \\pi_t + u_t',
      variables: [
        ['M', 'Misery index value'],
        ['\\pi_t', 'Current inflation rate'],
        ['u_t', 'Current unemployment rate'],
      ],
      compute: (data) => {
        const misery = data.currentInflation + data.currentUnemployment;
        return {
          result: misery,
          label: 'Misery Index',
          unit: '',
          inputs: { 'π': data.currentInflation, 'u': data.currentUnemployment }
        };
      }
    },
    {
      name: 'Real Interest Rate (Fisher Equation)',
      description: 'Computes the real interest rate by subtracting inflation from the nominal rate.',
      latex: 'r = i - \\pi',
      variables: [
        ['r', 'Real interest rate'],
        ['i', 'Nominal interest rate (Fed Funds)'],
        ['\\pi', 'Inflation rate (CPI YoY)'],
      ],
      compute: (data) => {
        const real = data.currentFedFunds - data.currentInflation;
        return {
          result: real,
          label: 'Real Rate',
          unit: '%',
          inputs: { 'i': data.currentFedFunds, 'π': data.currentInflation }
        };
      }
    }
  ];

  function render(container, data) {
    container.innerHTML = '';

    models.forEach(model => {
      const block = document.createElement('div');
      block.className = 'equation-block fade-in';

      // Name
      const nameEl = document.createElement('div');
      nameEl.className = 'equation-name';
      nameEl.textContent = model.name;
      block.appendChild(nameEl);

      // LaTeX render
      const mathEl = document.createElement('div');
      mathEl.className = 'equation-render';
      try {
        katex.render(model.latex, mathEl, { displayMode: true, throwOnError: false });
      } catch {
        mathEl.textContent = model.latex;
      }
      block.appendChild(mathEl);

      // Compute live values
      let computed = null;
      try {
        computed = model.compute(data);
      } catch { /* data might be incomplete */ }

      // Description + live result
      const descEl = document.createElement('div');
      descEl.className = 'equation-desc';
      let descHTML = model.description;
      if (computed) {
        descHTML += `<br><br><strong>Live Calculation:</strong> `;
        const inputStr = Object.entries(computed.inputs)
          .map(([k, v]) => `<code>${k} = ${v.toFixed(2)}</code>`)
          .join(' · ');
        descHTML += inputStr;
        descHTML += `<br>→ <span class="live-val">${computed.label} = ${computed.result.toFixed(2)}${computed.unit}</span>`;
      }
      descEl.innerHTML = descHTML;
      block.appendChild(descEl);

      // Variable table
      const table = document.createElement('table');
      table.className = 'var-table';
      model.variables.forEach(([sym, desc]) => {
        const row = document.createElement('tr');
        const symCell = document.createElement('td');
        try {
          katex.render(sym, symCell, { throwOnError: false });
        } catch {
          symCell.textContent = sym;
        }
        const descCell = document.createElement('td');
        descCell.textContent = desc;
        row.appendChild(symCell);
        row.appendChild(descCell);
        table.appendChild(row);
      });
      block.appendChild(table);

      container.appendChild(block);
    });
  }

  function computeTaylorRate(data) {
    return models[0].compute(data).result;
  }

  return { render, models, computeTaylorRate };
})();
