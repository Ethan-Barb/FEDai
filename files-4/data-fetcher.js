/**
 * MACRO|PULSE Data Fetcher
 * Fetches real economic data from FRED (Federal Reserve Economic Data).
 * Computes derived metrics like YoY inflation from raw CPI.
 */
const DataFetcher = (() => {
  const cache = {};

  async function fetchSeries(seriesId, opts = {}) {
    const {
      limit = 120,
      sort = 'desc',
      freq = null,
      units = null,
    } = opts;

    const cacheKey = `${seriesId}_${limit}_${sort}_${freq}_${units}`;
    if (cache[cacheKey]) return cache[cacheKey];

    const params = new URLSearchParams({
      series_id: seriesId,
      api_key: CONFIG.FRED_API_KEY,
      file_type: 'json',
      sort_order: sort,
      limit: limit.toString(),
    });
    if (freq) params.set('frequency', freq);
    if (units) params.set('units', units);

    try {
      const resp = await fetch(`${CONFIG.FRED_BASE}?${params}`);
      if (!resp.ok) throw new Error(`FRED ${resp.status}`);
      const data = await resp.json();

      const observations = (data.observations || [])
        .filter(o => o.value !== '.')
        .map(o => ({
          date: o.date,
          value: parseFloat(o.value),
        }));

      cache[cacheKey] = observations;
      return observations;
    } catch (err) {
      console.error(`Error fetching ${seriesId}:`, err);
      return null;
    }
  }

  /** Compute YoY % change from a level series */
  function computeYoY(observations) {
    if (!observations || observations.length < 13) return [];
    // observations are sorted desc; we reverse for chronological
    const sorted = [...observations].reverse();
    const yoy = [];
    for (let i = 12; i < sorted.length; i++) {
      const curr = sorted[i].value;
      const prev = sorted[i - 12].value;
      if (prev !== 0) {
        yoy.push({
          date: sorted[i].date,
          value: ((curr - prev) / prev) * 100,
        });
      }
    }
    return yoy;
  }

  /** Fetch all data needed for the dashboard */
  async function fetchAll() {
    const updateStatus = (msg) => {
      const el = document.querySelector('.loader-status');
      if (el) el.textContent = msg;
    };

    updateStatus('Fetching GDP data...');
    const gdpGrowth = await fetchSeries(CONFIG.SERIES.GDP_GROWTH, { limit: 40, freq: 'q' });

    updateStatus('Fetching inflation data...');
    const cpiRaw = await fetchSeries(CONFIG.SERIES.CPI, { limit: 80 });
    const cpi = computeYoY(cpiRaw);

    updateStatus('Fetching employment data...');
    const unemployment = await fetchSeries(CONFIG.SERIES.UNEMPLOYMENT, { limit: 60 });

    updateStatus('Fetching interest rate data...');
    const fedFunds = await fetchSeries(CONFIG.SERIES.FED_FUNDS, { limit: 60 });

    updateStatus('Fetching treasury data...');
    const treasury10y = await fetchSeries(CONFIG.SERIES.TREASURY_10Y, { limit: 30, freq: 'm' });
    const treasury2y = await fetchSeries(CONFIG.SERIES.TREASURY_2Y, { limit: 30, freq: 'm' });

    updateStatus('Fetching potential output...');
    const potentialGDP = await fetchSeries(CONFIG.SERIES.POTENTIAL_GDP, { limit: 20, freq: 'q' });
    const realGDP = await fetchSeries(CONFIG.SERIES.REAL_GDP, { limit: 20, freq: 'q' });

    updateStatus('Processing economic indicators...');

    return {
      gdpGrowth,
      cpi,
      cpiRaw,
      unemployment,
      fedFunds,
      treasury10y,
      treasury2y,
      potentialGDP,
      realGDP,
    };
  }

  /** Get latest value from a series (sorted desc) */
  function latest(series) {
    if (!series || series.length === 0) return null;
    // If sorted chronologically (asc), last element is latest
    // If sorted desc, first element is latest
    // Check dates to be safe
    const first = new Date(series[0].date);
    const last = new Date(series[series.length - 1].date);
    return first > last ? series[0] : series[series.length - 1];
  }

  /** Get previous value */
  function previous(series) {
    if (!series || series.length < 2) return null;
    const first = new Date(series[0].date);
    const last = new Date(series[series.length - 1].date);
    return first > last ? series[1] : series[series.length - 2];
  }

  return { fetchAll, fetchSeries, computeYoY, latest, previous };
})();
