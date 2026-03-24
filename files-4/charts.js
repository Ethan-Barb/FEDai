/**
 * MACRO|PULSE Charts Module
 * Renders economic data as Chart.js line charts with consistent styling.
 */
const Charts = (() => {
  const instances = {};

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a2438',
        titleFont: { family: CONFIG.CHART.FONT, size: 11 },
        bodyFont: { family: CONFIG.CHART.FONT, size: 12 },
        titleColor: '#8899b0',
        bodyColor: '#e8edf5',
        borderColor: '#2a3a55',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 6,
        displayColors: false,
        callbacks: {
          label: (ctx) => `${ctx.parsed.y.toFixed(2)}%`
        }
      }
    },
    scales: {
      x: {
        grid: { color: CONFIG.CHART.GRID_COLOR, lineWidth: 0.5 },
        ticks: {
          color: CONFIG.CHART.TICK_COLOR,
          font: { family: CONFIG.CHART.FONT, size: 10 },
          maxTicksLimit: 8,
          maxRotation: 0,
        },
        border: { color: CONFIG.CHART.GRID_COLOR }
      },
      y: {
        grid: { color: CONFIG.CHART.GRID_COLOR, lineWidth: 0.5 },
        ticks: {
          color: CONFIG.CHART.TICK_COLOR,
          font: { family: CONFIG.CHART.FONT, size: 10 },
          callback: (v) => v.toFixed(1) + '%',
        },
        border: { color: CONFIG.CHART.GRID_COLOR }
      }
    }
  };

  function formatDateLabel(dateStr) {
    const d = new Date(dateStr);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;
  }

  function createGradient(ctx, color1, color2) {
    const grad = ctx.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    return grad;
  }

  function renderChart(canvasId, data, opts = {}) {
    if (!data || data.length === 0) return null;
    const {
      color = '#4fa3f7',
      fillFrom = 'rgba(79, 163, 247, 0.15)',
      fillTo = 'rgba(79, 163, 247, 0.0)',
      targetLine = null,
      targetLabel = '',
      unitSuffix = '%',
    } = opts;

    // Sort chronologically and limit
    const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-36);
    const labels = sorted.map(d => formatDateLabel(d.date));
    const values = sorted.map(d => d.value);

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');

    if (instances[canvasId]) instances[canvasId].destroy();

    const datasets = [{
      data: values,
      borderColor: color,
      backgroundColor: createGradient(ctx, fillFrom, fillTo),
      fill: true,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: color,
      tension: 0.35,
    }];

    // Target line
    if (targetLine !== null) {
      datasets.push({
        data: Array(values.length).fill(targetLine),
        borderColor: 'rgba(251, 191, 36, 0.5)',
        borderWidth: 1,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
      });
    }

    const chartOpts = JSON.parse(JSON.stringify(baseOptions));
    if (unitSuffix !== '%') {
      chartOpts.scales.y.ticks.callback = (v) => v.toFixed(1) + unitSuffix;
      chartOpts.plugins.tooltip.callbacks = {
        label: (ctx) => `${ctx.parsed.y.toFixed(2)}${unitSuffix}`
      };
    }

    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: chartOpts,
    });

    return instances[canvasId];
  }

  function renderAll(econ) {
    renderChart('chart-gdp', econ.gdpGrowth, {
      color: '#34d399',
      fillFrom: 'rgba(52, 211, 153, 0.12)',
      fillTo: 'rgba(52, 211, 153, 0.0)',
    });

    renderChart('chart-inflation', econ.cpi, {
      color: '#f87171',
      fillFrom: 'rgba(248, 113, 113, 0.12)',
      fillTo: 'rgba(248, 113, 113, 0.0)',
      targetLine: CONFIG.TARGETS.INFLATION,
      targetLabel: 'Fed Target',
    });

    renderChart('chart-unemployment', econ.unemployment, {
      color: '#a78bfa',
      fillFrom: 'rgba(167, 139, 250, 0.12)',
      fillTo: 'rgba(167, 139, 250, 0.0)',
      targetLine: CONFIG.TARGETS.UNEMPLOYMENT_NAIRU,
      targetLabel: 'NAIRU',
    });

    renderChart('chart-rates', econ.fedFunds, {
      color: '#22d3ee',
      fillFrom: 'rgba(34, 211, 238, 0.12)',
      fillTo: 'rgba(34, 211, 238, 0.0)',
    });
  }

  return { renderAll, renderChart };
})();
