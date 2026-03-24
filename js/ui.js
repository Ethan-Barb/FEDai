/* ================================================================
   ui.js — DOM rendering, form handling, chart
================================================================ */

let currentMode = 'basic';
let chartInstance = null;

/* ── Mode toggle ─────────────────────────────────────────────── */
function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-toggle button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  const ws = document.getElementById('weights-section');
  ws.style.display = mode === 'advanced' ? 'block' : 'none';
}

/* ── API key visibility toggle ───────────────────────────────── */
function toggleKeyVisibility() {
  const inp = document.getElementById('apiKey');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

/* ── Show AI tab ─────────────────────────────────────────────── */
function showTab(tab) {
  ['policy', 'equation', 'outlook'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.ai-tab').forEach((btn, i) => {
    btn.classList.toggle('active', ['policy','equation','outlook'][i] === tab);
  });
}

/* ── Collect inputs from form ────────────────────────────────── */
function collectInputs() {
  const v = id => document.getElementById(id).value.trim();

  const inflation        = v('inflation');
  const inflationTarget  = v('inflationTarget');
  const unemployment     = v('unemployment');
  const gdpGrowth        = v('gdpGrowth');

  const errors = [];
  if (!inflation)       errors.push('Inflation Rate is required.');
  if (!inflationTarget) errors.push('Inflation Target is required.');
  if (!unemployment)    errors.push('Unemployment Rate is required.');
  if (!gdpGrowth)       errors.push('GDP Growth Rate is required.');

  if (errors.length) return { errors };

  const inputs = {
    inflation:             parseFloat(inflation),
    inflationTarget:       parseFloat(inflationTarget),
    unemployment:          parseFloat(unemployment),
    gdpGrowth:             parseFloat(gdpGrowth),
    wageGrowth:            v('wageGrowth')            !== '' ? parseFloat(v('wageGrowth'))            : null,
    consumerSpending:      v('consumerSpending')      !== '' ? parseFloat(v('consumerSpending'))      : null,
    marketConditions:      parseFloat(document.getElementById('marketConditions').value),
    inflationExpectations: v('inflationExpectations') !== '' ? parseFloat(v('inflationExpectations')) : null,
  };

  const weights = {};
  if (currentMode === 'advanced') {
    inputs.naturalUnemployment = parseFloat(document.getElementById('naturalUnemployment').value);
    inputs.potentialGdp        = parseFloat(document.getElementById('potentialGdp').value);
    weights.inflationGap    = parseFloat(document.getElementById('w_inflation').value);
    weights.outputGap       = parseFloat(document.getElementById('w_output').value);
    weights.unemploymentGap = parseFloat(document.getElementById('w_unemployment').value);
    weights.expectations    = parseFloat(document.getElementById('w_expectations').value);
  }

  return { inputs, weights };
}

/* ── Main run function ───────────────────────────────────────── */
async function runAll() {
  const errBanner = document.getElementById('error-banner');
  errBanner.classList.remove('visible');

  const { inputs, weights, errors } = collectInputs();
  if (errors) {
    errBanner.textContent = errors.join(' ');
    errBanner.classList.add('visible');
    return;
  }

  const apiKey = document.getElementById('apiKey').value.trim();

  // Run local model immediately
  const modelResult = predictRateChange(inputs, weights);
  renderModelResult(modelResult, inputs);

  // Run AI analysis if key provided
  if (apiKey) {
    await runAIAnalysis(apiKey, inputs, modelResult);
  } else {
    // Show the model result panel without AI section
    document.getElementById('ai-section').style.display = 'none';
  }
}

/* ── Render model result ─────────────────────────────────────── */
function renderModelResult(data, inputs) {
  document.getElementById('result-empty').style.display = 'none';
  const filled = document.getElementById('result-filled');
  filled.style.display = 'block';
  filled.classList.add('fade-up');
  setTimeout(() => filled.classList.remove('fade-up'), 500);

  document.getElementById('result-badge').textContent = new Date().toLocaleTimeString();

  // Rate + stance
  const rateEl = document.getElementById('result-rate');
  rateEl.textContent = data.recommendationFormatted;
  rateEl.className   = 'result-rate ' + data.stance;

  const pill = document.getElementById('stance-pill');
  pill.textContent = data.stance;
  pill.className   = 'result-stance-pill ' + data.stance;

  // Confidence
  const fill = document.getElementById('confidence-fill');
  fill.className = 'confidence-fill ' + data.confidence +
    (data.stance === 'Loosen' ? ' loosen' : '');
  document.getElementById('confidence-val').textContent = data.confidence;

  // Regime alerts
  const alertsEl = document.getElementById('regime-alerts');
  alertsEl.innerHTML = '';
  (data.regimeNotes || []).forEach(note => {
    const div = document.createElement('div');
    div.className = 'regime-alert';
    div.textContent = note;
    alertsEl.appendChild(div);
  });

  // Equation display
  const eqBlock = document.getElementById('equation-block');
  eqBlock.style.display = 'block';
  document.getElementById('equation-formula').textContent =
    data.equationParts.formula + '\n\n' + data.equationParts.substituted;

  const legend = data.equationParts.legend;
  document.getElementById('equation-legend').innerHTML = Object.entries(legend)
    .map(([k, v]) => `<span class="eq-var">${k}</span> = ${v}`)
    .join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  // Factor breakdown
  const factorsList = document.getElementById('factors-list');
  factorsList.innerHTML = '';
  const maxC = Math.max(...Object.values(data.factors).map(f => Math.abs(parseFloat(f.contribution))), 0.01);

  Object.entries(data.factors).forEach(([name, f]) => {
    const contrib = parseFloat(f.contribution);
    const pct     = Math.min(100, (Math.abs(contrib) / maxC) * 100);
    const isPos   = contrib >  0.001;
    const isNeg   = contrib < -0.001;

    const row = document.createElement('div');
    row.className = 'factor-row';
    row.innerHTML = `
      <span class="factor-name">${name}</span>
      <div class="factor-bar-wrapper">
        <div class="factor-bar-track" style="
          width:${pct/2}%;
          left:${isNeg ? (50-pct/2)+'%' : '50%'};
          background:${isPos ? 'var(--tighten)' : isNeg ? 'var(--loosen)' : 'var(--text-dim)'};
          opacity:0.7;">
        </div>
      </div>
      <span class="factor-contrib ${isPos ? 'positive' : isNeg ? 'negative' : 'neutral'}">
        ${isPos ? '+' : ''}${contrib.toFixed(3)}
      </span>`;
    factorsList.appendChild(row);
  });

  // Chart
  renderChart(inputs.inflation, inputs.inflationTarget);
}

/* ── Chart ───────────────────────────────────────────────────── */
function renderChart(inflation, target) {
  const container = document.getElementById('chart-container');
  container.style.display = 'block';
  const ctx = document.getElementById('inflationChart').getContext('2d');

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Current Inflation', 'Target Inflation'],
      datasets: [{
        data: [inflation, target],
        backgroundColor: [
          inflation > target ? 'rgba(224,92,92,0.7)' : 'rgba(92,184,160,0.7)',
          'rgba(200,169,110,0.5)',
        ],
        borderColor: [
          inflation > target ? '#e05c5c' : '#5cb8a0',
          '#c8a96e',
        ],
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(1)}%` },
          backgroundColor: '#1e2433',
          titleColor: '#c8a96e',
          bodyColor: '#e8e6df',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: { color: '#7a7d8a', font: { family: 'DM Mono', size: 11 } },
          grid: { display: false },
          border: { color: 'rgba(255,255,255,0.07)' },
        },
        y: {
          ticks: {
            color: '#7a7d8a',
            font: { family: 'DM Mono', size: 11 },
            callback: v => v + '%',
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
          border: { display: false },
        },
      },
    },
  });
}

/* ── Render AI content from parsed sections ──────────────────── */
function renderAIContent(sections) {
  const safe = s => (s || '').trim();

  // Format markdown-like text to HTML
  function md(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h3>$1</h3>')
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hup])/gm, '')
      .trim();
  }

  function wrap(html) {
    return `<p>${html}</p>`.replace(/<p><\/p>/g, '').replace(/<p>(<[hup])/g, '$1').replace(/(<\/[hup][^>]*>)<\/p>/g, '$1');
  }

  document.getElementById('tab-policy').innerHTML   = wrap(md(safe(sections.policy)));
  document.getElementById('tab-equation').innerHTML = wrap(md(safe(sections.equation)));

  // Outlook: try to find bull/base/bear scenarios
  let outlookHTML = wrap(md(safe(sections.outlook)));
  document.getElementById('tab-outlook').innerHTML = outlookHTML;
}

/* ── Set button loading state ────────────────────────────────── */
function setLoading(loading) {
  const btn     = document.getElementById('runBtn');
  const spinner = document.getElementById('spinner');
  const text    = document.getElementById('btnText');
  btn.disabled      = loading;
  spinner.className = loading ? 'spinner visible' : 'spinner';
  text.textContent  = loading ? 'Running...' : 'Run Model + AI Analysis';
}

/* ── Enter key ───────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement?.tagName === 'INPUT'
      && document.activeElement.type === 'number') {
    runAll();
  }
});
