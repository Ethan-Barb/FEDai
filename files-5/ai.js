/* ================================================================
   ai.js — Claude Opus AI Analysis
   Calls the Anthropic API directly from the browser.
   The API key is never stored — only held in memory per session.
================================================================ */

/**
 * Build the detailed system prompt that tells Opus exactly what
 * this app is and what context it's working in.
 */
function buildSystemPrompt() {
  return `You are a senior Federal Reserve monetary policy analyst with deep expertise in macroeconomics, central banking, and the Taylor Rule framework.

You are embedded in an interactive web application called "Fed Rate Advisor" that:
1. Takes real-time economic indicator inputs from the user (inflation, unemployment, GDP growth, wages, consumer spending, market conditions, inflation expectations)
2. Runs a Taylor Rule–based algorithmic model to compute a recommended federal funds rate change
3. Then asks YOU — Claude Opus — to provide a richer, more nuanced analysis drawing on current economic context

Your role is to:
- Provide expert monetary policy recommendations grounded in the data
- Clearly explain the mathematical algorithm and equations used
- Project realistic economic scenarios (bull/base/bear)
- Reference current real-world economic context where relevant
- Be direct, clear, and educational — the audience includes both economists and curious non-experts

Always structure your response as three distinct sections using these EXACT headers:
[POLICY RECOMMENDATION]
[ALGORITHM EXPLAINED]
[ECONOMIC OUTLOOK]

Each section should be thorough but readable. Use markdown formatting (**bold**, bullet lists, headers with ###) for clarity.`;
}

/**
 * Build the user prompt containing all the economic data,
 * the model's output, and specific instructions for each section.
 */
function buildUserPrompt(inputs, modelResult) {
  const fmt = v => v != null ? `${v}%` : 'Not provided';

  const inputSummary = `
ECONOMIC INDICATORS (user-entered):
- Inflation Rate: ${fmt(inputs.inflation)} (Target: ${fmt(inputs.inflationTarget)})
- Unemployment Rate: ${fmt(inputs.unemployment)} (NAIRU: ${fmt(inputs.naturalUnemployment || 4.0)})
- GDP Growth Rate: ${fmt(inputs.gdpGrowth)} (Potential: ${fmt(inputs.potentialGdp || 2.0)})
- Wage Growth: ${fmt(inputs.wageGrowth)}
- Consumer Spending Growth: ${fmt(inputs.consumerSpending)}
- Market Conditions Score: ${inputs.marketConditions || 50}/100
- Inflation Expectations: ${fmt(inputs.inflationExpectations)}

ALGORITHMIC MODEL OUTPUT:
- Recommended Rate Change: ${modelResult.recommendationFormatted}
- Policy Stance: ${modelResult.stance}
- Model Confidence: ${modelResult.confidence}
- Raw Taylor Score: ${modelResult.rawScore}
- Regime Flags: ${modelResult.regimeNotes.length > 0 ? modelResult.regimeNotes.join('; ') : 'None detected'}

FACTOR CONTRIBUTIONS (from model):
${Object.entries(modelResult.factors).map(([k,v]) => `- ${k}: contribution = ${v.contribution} (input: ${v.value})`).join('\n')}
`;

  return `${inputSummary}

Please provide your analysis in three sections:

[POLICY RECOMMENDATION]
Provide a thorough monetary policy recommendation. Do you agree with the model's suggested rate change of ${modelResult.recommendationFormatted}? Explain your reasoning using the data above. Reference the current real-world Fed environment (2024-2025) where relevant — the current Fed funds rate, recent FOMC decisions, and the economic backdrop. Suggest the specific policy action (raise, cut, or hold), the magnitude, and the key risks on each side. Also suggest what the Fed should watch for in upcoming data releases.

[ALGORITHM EXPLAINED]
Walk through the full Taylor Rule algorithm used in this model step by step:
1. State the classic Taylor Rule formula with all variables defined
2. Show the extended version used here (with unemployment gap, wage pressure, market sentiment, expectations)
3. Explain the regime-detection logic (supply shocks, overheating, lag dampening)
4. Show how the raw score of ${modelResult.rawScore} was computed from these inputs, step by step
5. Explain why the output is clamped to nearest 0.25% Fed increment
6. Note what the model does well and where human judgment should override it

[ECONOMIC OUTLOOK]
Based on these indicators, project three economic scenarios over the next 12–18 months:

### 🟢 Bull Case (Best Outcome)
What conditions would need to materialize for a soft landing? What does inflation, unemployment, and growth look like in this scenario? What rate path would the Fed follow?

### 🟡 Base Case (Most Likely)
What is the most probable trajectory given current data? Include projected inflation, unemployment, and growth paths. What does the rate path look like?

### 🔴 Bear Case (Downside Risk)
What could go wrong? What are the key tail risks (recession, stagflation, financial stability)? How would the Fed respond?

For each scenario, include a rough 12-month projection for: inflation, unemployment, GDP growth, and the federal funds rate.`;
}

/**
 * Parse the raw AI response into three sections.
 */
function parseAIResponse(text) {
  const sections = { policy: '', equation: '', outlook: '' };

  const policyMatch   = text.match(/\[POLICY RECOMMENDATION\]([\s\S]*?)(?=\[ALGORITHM EXPLAINED\]|$)/i);
  const equationMatch = text.match(/\[ALGORITHM EXPLAINED\]([\s\S]*?)(?=\[ECONOMIC OUTLOOK\]|$)/i);
  const outlookMatch  = text.match(/\[ECONOMIC OUTLOOK\]([\s\S]*?)$/i);

  if (policyMatch)   sections.policy   = policyMatch[1].trim();
  if (equationMatch) sections.equation = equationMatch[1].trim();
  if (outlookMatch)  sections.outlook  = outlookMatch[1].trim();

  // Fallback: if parsing fails, put everything in policy tab
  if (!sections.policy && !sections.equation && !sections.outlook) {
    sections.policy = text;
  }

  return sections;
}

/**
 * Loading message rotation for the skeleton state.
 */
const loadingMessages = [
  "Contacting Claude Opus...",
  "Analyzing economic indicators...",
  "Cross-referencing Taylor Rule parameters...",
  "Modeling policy scenarios...",
  "Projecting economic outlook...",
  "Drafting policy recommendation...",
];

let loadingInterval = null;

function startLoadingMessages() {
  let i = 0;
  const el = document.getElementById('ai-loading-msg');
  if (el) el.textContent = loadingMessages[0];
  loadingInterval = setInterval(() => {
    i = (i + 1) % loadingMessages.length;
    if (el) el.textContent = loadingMessages[i];
  }, 2200);
}

function stopLoadingMessages() {
  if (loadingInterval) clearInterval(loadingInterval);
  loadingInterval = null;
}

/**
 * Main AI analysis function.
 * Calls the Anthropic API and renders the response.
 */
async function runAIAnalysis(apiKey, inputs, modelResult) {
  setLoading(true);

  // Show AI section with skeleton loading state
  const aiSection = document.getElementById('ai-section');
  aiSection.style.display = 'block';
  aiSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('ai-loading').style.display = 'block';
  document.getElementById('ai-content').style.display = 'none';
  document.getElementById('ai-badge').textContent = 'Generating...';

  startLoadingMessages();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        system: buildSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: buildUserPrompt(inputs, modelResult),
          }
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    const sections = parseAIResponse(rawText);

    stopLoadingMessages();
    document.getElementById('ai-loading').style.display = 'none';
    document.getElementById('ai-content').style.display = 'block';
    document.getElementById('ai-badge').textContent = 'Complete · ' + new Date().toLocaleTimeString();

    renderAIContent(sections);
    showTab('policy');

  } catch (err) {
    stopLoadingMessages();
    document.getElementById('ai-loading').style.display = 'none';
    document.getElementById('ai-content').style.display = 'block';
    document.getElementById('ai-badge').textContent = 'Error';

    // Show error in the policy tab
    document.getElementById('tab-policy').innerHTML = `
      <div style="background:rgba(224,92,92,0.1);border:1px solid rgba(224,92,92,0.3);
        border-radius:6px;padding:16px;color:#e05c5c;font-size:13px;line-height:1.6;">
        <strong>AI Analysis Failed</strong><br><br>
        ${err.message}<br><br>
        <strong>Common causes:</strong><br>
        · Invalid or expired API key<br>
        · CORS restrictions (try using your own domain or localhost)<br>
        · Rate limits exceeded<br><br>
        The model recommendation above is still valid — the AI layer is optional enhancement.
      </div>`;
    document.getElementById('tab-equation').innerHTML = '';
    document.getElementById('tab-outlook').innerHTML  = '';
    showTab('policy');
  } finally {
    setLoading(false);
  }
}
