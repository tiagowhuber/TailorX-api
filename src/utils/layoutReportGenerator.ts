import { PatternLayoutStats } from '../services/TailorFitService';

interface LayoutAnalysis {
  generated_at: string;
  total_patterns: number;
  bed_dimensions: { widthMm: number; heightMm: number };
  patterns: PatternLayoutStats[];
}

export function generateLayoutReport(analysis: LayoutAnalysis): string {
  const { patterns, bed_dimensions, generated_at } = analysis;

  // Group patterns by design
  const byDesign = new Map<string, PatternLayoutStats[]>();
  for (const p of patterns) {
    const key = `${p.designId}|${p.designName}`;
    if (!byDesign.has(key)) byDesign.set(key, []);
    byDesign.get(key)!.push(p);
  }

  // Unique users across all patterns (preserve insertion order)
  const userNames = [...new Set(patterns.map((p) => p.userName))];

  // Palette for users
  const COLORS = [
    '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
  ];
  const userColor = (name: string) => COLORS[userNames.indexOf(name) % COLORS.length] as string;
  const userColorAlpha = (name: string, a: number) => {
    const hex = userColor(name).replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  // Chart datasets for height reduction %
  const heightDatasets = userNames.map((name) => ({
    label: name,
    data: [...byDesign.values()].map(
      (group) => group.find((p) => p.userName === name)?.comparison.heightReductionPct ?? null,
    ),
    backgroundColor: userColorAlpha(name, 0.85),
    borderColor: userColor(name),
    borderWidth: 1,
    borderRadius: 4,
  }));

  // Chart datasets for LER improvement %
  const lerDatasets = userNames.map((name) => ({
    label: name,
    data: [...byDesign.values()].map(
      (group) => group.find((p) => p.userName === name)?.comparison.lerImprovementPct ?? null,
    ),
    backgroundColor: userColorAlpha(name, 0.85),
    borderColor: userColor(name),
    borderWidth: 1,
    borderRadius: 4,
  }));

  const designLabels = [...byDesign.keys()].map((k) => k.split('|')[1]);

  // Scatter data: heightReductionPct vs lerImprovementPct
  const scatterDatasets = userNames.map((name) => ({
    label: name,
    data: patterns
      .filter((p) => p.userName === name)
      .map((p) => ({
        x: +p.comparison.heightReductionPct.toFixed(1),
        y: +p.comparison.lerImprovementPct.toFixed(1),
        design: p.designName,
      })),
    backgroundColor: userColorAlpha(name, 0.9),
    borderColor: userColor(name),
    pointRadius: 7,
    pointHoverRadius: 10,
  }));

  // Summary stats
  const avgHeightReduction =
    patterns.reduce((s, p) => s + p.comparison.heightReductionPct, 0) / patterns.length;
  const avgLerImprovement =
    patterns.reduce((s, p) => s + p.comparison.lerImprovementPct, 0) / patterns.length;
  const totalBeds = patterns.reduce((s, p) => s + p.plt.totalBeds, 0);
  const bestPattern = ([...patterns].sort(
    (a, b) => b.comparison.heightReductionPct - a.comparison.heightReductionPct,
  )[0] as PatternLayoutStats | undefined);

  // Table rows
  const tableRows = patterns
    .map((p) => {
      const hPct = p.comparison.heightReductionPct.toFixed(1);
      const hMm = p.comparison.heightReductionMm.toFixed(0);
      const lerM2 = (p.comparison.lerImprovementMm2 / 1_000_000).toFixed(4);
      const lerPct = p.comparison.lerImprovementPct.toFixed(1);
      const eff = p.plt.beds[0]?.efficiency.toFixed(1) ?? '—';
      const hColor = p.comparison.heightReductionPct >= 80 ? '#10b981' : p.comparison.heightReductionPct >= 60 ? '#f59e0b' : '#ef4444';
      return `<tr>
        <td>${p.userName}</td>
        <td>${p.designName}</td>
        <td>${p.pieceCount}</td>
        <td>${p.pltUnoptimized.beds[0]?.usedHeightMm.toFixed(0) ?? '—'}</td>
        <td>${p.plt.beds[0]?.usedHeightMm.toFixed(0) ?? '—'}</td>
        <td style="color:${hColor};font-weight:600">${hMm} mm (${hPct}%)</td>
        <td>${lerM2} m² (${lerPct}%)</td>
        <td>${eff}%</td>
        <td>${p.plt.totalBeds}</td>
      </tr>`;
    })
    .join('\n');

  const legendItems = userNames
    .map(
      (name) =>
        `<span class="legend-dot" style="background:${userColor(name)}"></span><span>${name}</span>`,
    )
    .join('');

  const date = new Date(generated_at).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>TailorX — Batch Layout Analysis Report</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f172a;
    --surface: #1e293b;
    --surface2: #273549;
    --border: #334155;
    --text: #f1f5f9;
    --muted: #94a3b8;
    --accent: #6366f1;
    --green: #10b981;
    --amber: #f59e0b;
    --red: #ef4444;
  }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
  header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 1.5rem 2rem; display: flex; align-items: center; gap: 1rem; }
  header h1 { font-size: 1.5rem; font-weight: 700; }
  header .meta { color: var(--muted); font-size: 0.875rem; margin-left: auto; }
  .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
  .section-title { font-size: 1.1rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 1.25rem; }
  /* Summary cards */
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2.5rem; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem 1.5rem; }
  .card .label { font-size: 0.8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem; }
  .card .value { font-size: 2rem; font-weight: 700; }
  .card .sub { font-size: 0.8rem; color: var(--muted); margin-top: 0.2rem; }
  .card.green .value { color: var(--green); }
  .card.amber .value { color: var(--amber); }
  .card.accent .value { color: var(--accent); }
  /* Charts */
  .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2.5rem; }
  @media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr; } }
  .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; }
  .chart-card h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 1rem; color: var(--text); }
  .chart-card canvas { width: 100% !important; }
  .chart-card.wide { grid-column: 1 / -1; }
  /* Legend */
  .legend { display: flex; flex-wrap: wrap; gap: 0.75rem 1.5rem; margin-bottom: 1.5rem; }
  .legend-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
  .legend span { font-size: 0.85rem; color: var(--text); vertical-align: middle; }
  /* Table */
  .table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: auto; margin-bottom: 2.5rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  thead { background: var(--surface2); }
  th { padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: var(--muted); white-space: nowrap; border-bottom: 1px solid var(--border); }
  td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); color: var(--text); white-space: nowrap; }
  tbody tr:hover { background: var(--surface2); }
  tbody tr:last-child td { border-bottom: none; }
  /* Bed dimensions */
  .bed-info { display: inline-flex; align-items: center; gap: 0.5rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 0.4rem 0.9rem; font-size: 0.85rem; margin-bottom: 2rem; }
  .bed-info span { color: var(--muted); }
  footer { text-align: center; padding: 2rem; color: var(--muted); font-size: 0.8rem; border-top: 1px solid var(--border); margin-top: 1rem; }
</style>
</head>
<body>
<header>
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="#6366f1"/>
    <path d="M8 24 L16 8 L24 24" stroke="white" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
    <path d="M11 19 L21 19" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>
  <h1>Batch Layout Analysis Report</h1>
  <div class="meta">Generated: ${date} &nbsp;·&nbsp; ${analysis.total_patterns} patterns</div>
</header>

<div class="container">

  <div class="bed-info">
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1.5" stroke="#94a3b8" stroke-width="1.5"/></svg>
    <span>Cutting bed:</span>
    <strong>${bed_dimensions.widthMm} × ${bed_dimensions.heightMm} mm</strong>
    <span>(${(bed_dimensions.widthMm / 1000).toFixed(2)} × ${(bed_dimensions.heightMm / 1000).toFixed(2)} m)</span>
  </div>

  <!-- Summary cards -->
  <div class="section-title">Overview</div>
  <div class="cards">
    <div class="card green">
      <div class="label">Avg. Height Reduction</div>
      <div class="value">${avgHeightReduction.toFixed(1)}%</div>
      <div class="sub">vs. unoptimised PLT</div>
    </div>
    <div class="card accent">
      <div class="label">Avg. Free Area Gained</div>
      <div class="value">${avgLerImprovement.toFixed(1)}%</div>
      <div class="sub">vs. unoptimised PLT</div>
    </div>
    <div class="card">
      <div class="label">Total Patterns</div>
      <div class="value">${analysis.total_patterns}</div>
      <div class="sub">${[...byDesign.keys()].length} designs · ${userNames.length} users</div>
    </div>
    <div class="card amber">
      <div class="label">Total Beds Used</div>
      <div class="value">${totalBeds}</div>
      <div class="sub">across all patterns</div>
    </div>
    <div class="card green">
      <div class="label">Best Height Reduction</div>
      <div class="value">${bestPattern?.comparison.heightReductionPct.toFixed(1) ?? '—'}%</div>
      <div class="sub">${bestPattern?.userName ?? ''} — ${bestPattern?.designName ?? ''}</div>
    </div>
  </div>

  <!-- Legend -->
  <div class="legend">${legendItems}</div>

  <!-- Charts -->
  <div class="section-title">Comparisons by Design</div>
  <div class="charts-grid">
    <div class="chart-card">
      <h3>Bed Height Reduction (%) per User &amp; Design — Optimised vs Unoptimised PLT</h3>
      <canvas id="chartHeight" height="280"></canvas>
    </div>
    <div class="chart-card">
      <h3>Free Area (LER) Gained (% of bed) — Optimised vs Unoptimised PLT</h3>
      <canvas id="chartLer" height="280"></canvas>
    </div>
    <div class="chart-card wide">
      <h3>Height Reduction % vs Free Area Gained % — Scatter</h3>
      <canvas id="chartScatter" height="200"></canvas>
    </div>
  </div>

  <!-- Table -->
  <div class="section-title">Detailed Results</div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Design</th>
          <th>Pieces</th>
          <th>Unopt. Height (mm)</th>
          <th>Opt. Height (mm)</th>
          <th>Height Reduction</th>
          <th>Free Area Gained</th>
          <th>Efficiency</th>
          <th>Beds</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>

</div>

<footer>TailorX · Batch Layout Report · ${date}</footer>

<script>
const CHART_DEFAULTS = {
  plugins: {
    legend: { labels: { color: '#f1f5f9', font: { size: 11 } } },
    tooltip: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1, titleColor: '#f1f5f9', bodyColor: '#cbd5e1' },
  },
  scales: {
    x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#1e293b' }, border: { color: '#334155' } },
    y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#334155' }, border: { color: '#334155' } },
  },
};

// Height reduction chart
new Chart(document.getElementById('chartHeight'), {
  type: 'bar',
  data: {
    labels: ${JSON.stringify(designLabels)},
    datasets: ${JSON.stringify(heightDatasets)},
  },
  options: {
    responsive: true,
    plugins: { ...CHART_DEFAULTS.plugins },
    scales: {
      ...CHART_DEFAULTS.scales,
      y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 100, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => v + '%' } },
    },
  },
});

// LER improvement chart
new Chart(document.getElementById('chartLer'), {
  type: 'bar',
  data: {
    labels: ${JSON.stringify(designLabels)},
    datasets: ${JSON.stringify(lerDatasets)},
  },
  options: {
    responsive: true,
    plugins: { ...CHART_DEFAULTS.plugins },
    scales: {
      ...CHART_DEFAULTS.scales,
      y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 100, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => v + '%' } },
    },
  },
});

// Scatter chart
new Chart(document.getElementById('chartScatter'), {
  type: 'scatter',
  data: { datasets: ${JSON.stringify(scatterDatasets)} },
  options: {
    responsive: true,
    plugins: {
      ...CHART_DEFAULTS.plugins,
      tooltip: {
        ...CHART_DEFAULTS.plugins.tooltip,
        callbacks: {
          label: ctx => {
            const raw = ctx.raw;
            return \`\${ctx.dataset.label} — \${raw.design}: H↓\${raw.x}% · LER↑\${raw.y}%\`;
          },
        },
      },
    },
    scales: {
      x: { ...CHART_DEFAULTS.scales.x, min: 0, max: 100, title: { display: true, text: 'Height Reduction (%)', color: '#94a3b8' }, ticks: { ...CHART_DEFAULTS.scales.x.ticks, callback: v => v + '%' } },
      y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 100, title: { display: true, text: 'Free Area Gained (%)', color: '#94a3b8' }, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => v + '%' } },
    },
  },
});
</script>
</body>
</html>`;
}
