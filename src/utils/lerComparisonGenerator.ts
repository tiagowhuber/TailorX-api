import { PatternLayoutStats, BedVisualization } from '../services/TailorFitService';

interface LerComparisonAnalysis {
  generated_at: string;
  total_patterns: number;
  bed_dimensions: { widthMm: number; heightMm: number };
  patterns: PatternLayoutStats[];
}

// ─── SVG Bed Renderer ──────────────────────────────────────────────────────────

const SVG_RENDER_WIDTH = 500; // px — display width of each bed SVG

function renderBedSvg(bed: BedVisualization): string {
  const scale = SVG_RENDER_WIDTH / bed.widthMm;
  const svgH  = Math.round(bed.heightMm * scale);
  const svgW  = SVG_RENDER_WIDTH;

  const lerY      = Math.round(bed.usedHeightMm * scale);
  const lerH      = Math.round(bed.lerHeightMm  * scale);
  const lerAreaM2 = (bed.lerAreaMm2 / 1_000_000).toFixed(4);
  const lerPct    = ((bed.lerAreaMm2 / (bed.widthMm * bed.heightMm)) * 100).toFixed(1);

  // LER #2 — right strip
  const ler2X     = Math.round(bed.usedWidthMm  * scale);
  const ler2W     = Math.round(bed.ler2WidthMm  * scale);
  const ler2AreaM2 = (bed.ler2AreaMm2 / 1_000_000).toFixed(4);
  const ler2Pct   = ((bed.ler2AreaMm2 / (bed.widthMm * bed.heightMm)) * 100).toFixed(1);

  const pieceRects = bed.pieces.map(p => {
    const px = Math.round(p.x      * scale);
    const py = Math.round(p.y      * scale);
    const pw = Math.max(1, Math.round(p.width  * scale));
    const ph = Math.max(1, Math.round(p.height * scale));
    return `<rect x="${px}" y="${py}" width="${pw}" height="${ph}"
              fill="#94a3b8" stroke="#475569" stroke-width="0.5" rx="1"/>`;
  }).join('\n    ');

  // LER #1 — bottom strip (green)
  const lerRect = lerH > 0
    ? `<rect x="0" y="${lerY}" width="${svgW}" height="${lerH}"
          fill="rgba(34,197,94,0.30)" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="6,3"/>`
    : '';

  const lerLabel = lerH > 8
    ? `<text x="${ler2W > 0 ? (svgW - ler2W) / 2 : svgW / 2}" y="${lerY + lerH / 2 + 5}"
          text-anchor="middle" font-size="12" fill="#22c55e" font-weight="600">
        LER ${lerAreaM2} m² (${lerPct}%)
      </text>`
    : '';

  // LER #2 — right strip (purple)
  const ler2Rect = ler2W > 0
    ? `<rect x="${ler2X}" y="0" width="${ler2W}" height="${svgH}"
          fill="rgba(139,92,246,0.25)" stroke="#8b5cf6" stroke-width="1.5" stroke-dasharray="6,3"/>`
    : '';

  const ler2LabelCx = ler2X + ler2W / 2;
  const ler2LabelCy = lerH > 0 ? lerY / 2 : svgH / 2;
  const ler2Label = ler2W > 16
    ? `<text x="${ler2LabelCx}" y="${ler2LabelCy}"
          text-anchor="middle" font-size="11" fill="#8b5cf6" font-weight="600"
          transform="rotate(-90,${ler2LabelCx},${ler2LabelCy})">
        LER2 ${ler2AreaM2}m² (${ler2Pct}%)
      </text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg"
     width="${svgW}" height="${svgH}"
     viewBox="0 0 ${svgW} ${svgH}"
     style="display:block;border:1px solid #334155;border-radius:4px;background:#0f172a;">
  <!-- Pieces -->
  ${pieceRects}
  <!-- LER #1 zone (bottom strip) -->
  ${lerRect}
  ${lerLabel}
  <!-- LER #2 zone (right strip) -->
  ${ler2Rect}
  ${ler2Label}
  <!-- Used height marker -->
  <line x1="0" y1="${lerY}" x2="${svgW}" y2="${lerY}"
        stroke="#f59e0b" stroke-width="1" stroke-dasharray="4,2"/>
</svg>`;
}

// ─── Pattern Section ───────────────────────────────────────────────────────────

function renderPatternSection(pattern: PatternLayoutStats): string {
  const optBeds   = pattern.optimizedBeds   ?? [];
  const unoptBeds = pattern.unoptimizedBeds ?? [];

  const maxBeds = Math.max(optBeds.length, unoptBeds.length, 1);

  const bedRows = Array.from({ length: maxBeds }, (_, i) => {
    const opt   = optBeds[i];
    const unopt = unoptBeds[i];

    const optSvg   = opt   ? renderBedSvg(opt)   : '<p class="no-bed">No bed</p>';
    const unoptSvg = unopt ? renderBedSvg(unopt)  : '<p class="no-bed">No bed</p>';

    const optLerPct    = opt   ? ((opt.lerAreaMm2   / (opt.widthMm   * opt.heightMm))   * 100).toFixed(1) : '—';
    const unoptLerPct  = unopt ? ((unopt.lerAreaMm2 / (unopt.widthMm * unopt.heightMm)) * 100).toFixed(1) : '—';
    const optLer2Pct   = opt   ? ((opt.ler2AreaMm2  / (opt.widthMm   * opt.heightMm))   * 100).toFixed(1) : '—';
    const unoptLer2Pct = unopt ? ((unopt.ler2AreaMm2/ (unopt.widthMm * unopt.heightMm)) * 100).toFixed(1) : '—';

    const optLabel = opt
      ? `LER: ${(opt.lerAreaMm2 / 1_000_000).toFixed(4)} m² (${optLerPct}%) | LER2: ${(opt.ler2AreaMm2 / 1_000_000).toFixed(4)} m² (${optLer2Pct}%) | Union: ${(opt.lerUnionAreaMm2 / 1_000_000).toFixed(4)} m²`
      : '—';
    const unoptLabel = unopt
      ? `LER: ${(unopt.lerAreaMm2 / 1_000_000).toFixed(4)} m² (${unoptLerPct}%) | LER2: ${(unopt.ler2AreaMm2 / 1_000_000).toFixed(4)} m² (${unoptLer2Pct}%) | Union: ${(unopt.lerUnionAreaMm2 / 1_000_000).toFixed(4)} m²`
      : '—';

    return `
    <div class="bed-row">
      <div class="bed-col">
        <p class="bed-label">Bed ${i + 1} &mdash; ${optLabel}</p>
        ${optSvg}
      </div>
      <div class="bed-col">
        <p class="bed-label">Bed ${i + 1} &mdash; ${unoptLabel}</p>
        ${unoptSvg}
      </div>
    </div>`;
  }).join('\n');

  // Aggregate improvement numbers (comparing unoptimized vs optimized)
  const totalOptLer        = optBeds.reduce((s, b) => s + b.lerAreaMm2, 0);
  const totalUnoptLer      = unoptBeds.reduce((s, b) => s + b.lerAreaMm2, 0);
  const totalOptUnion      = optBeds.reduce((s, b) => s + b.lerUnionAreaMm2, 0);
  const totalUnoptUnion    = unoptBeds.reduce((s, b) => s + b.lerUnionAreaMm2, 0);
  const improvementMm2     = totalOptUnion - totalUnoptUnion;
  const baseUnopt          = totalUnoptUnion > 0 ? totalUnoptUnion : 1;
  const improvementPct     = ((improvementMm2 / baseUnopt) * 100).toFixed(1);
  const improvSign         = improvementMm2 >= 0 ? '+' : '';

  const bedCountDiff = unoptBeds.length - optBeds.length;
  const bedCountNote = bedCountDiff > 0
    ? `<span class="stat-badge good">Saved ${bedCountDiff} bed${bedCountDiff !== 1 ? 's' : ''}</span>`
    : bedCountDiff < 0
      ? `<span class="stat-badge warn">Used ${Math.abs(bedCountDiff)} extra bed${Math.abs(bedCountDiff) !== 1 ? 's' : ''}</span>`
      : `<span class="stat-badge neutral">Same bed count</span>`;

  return `
  <section class="pattern-section">
    <div class="pattern-header">
      <h2>${escHtml(pattern.userName)} &mdash; ${escHtml(pattern.designName)}</h2>
      <span class="piece-count">${pattern.pieceCount} pieces</span>
    </div>

    <div class="comparison-headers">
      <div class="col-header after-header">After Optimization (OPTIMIZED)</div>
      <div class="col-header before-header">Before Optimization (sequential)</div>
    </div>

    ${bedRows}

    <div class="summary-row">
      <div class="summary-stat">
        <span class="stat-label">Union LER After</span>
        <span class="stat-value">${(totalOptUnion / 1_000_000).toFixed(4)} m²</span>
      </div>
      <div class="summary-stat">
        <span class="stat-label">Union LER Before</span>
        <span class="stat-value">${(totalUnoptUnion / 1_000_000).toFixed(4)} m²</span>
      </div>
      <div class="summary-stat">
        <span class="stat-label">Union LER Change</span>
        <span class="stat-value ${improvementMm2 >= 0 ? 'positive' : 'negative'}">${improvSign}${(improvementMm2 / 1_000_000).toFixed(4)} m² (${improvSign}${improvementPct}%)</span>
      </div>
      <div class="summary-stat">
        ${bedCountNote}
      </div>
    </div>
  </section>`;
}

// ─── HTML Shell ───────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function generateLerComparisonReport(analysis: LerComparisonAnalysis): string {
  const sections = analysis.patterns.map(renderPatternSection).join('\n');
  const ts = new Date(analysis.generated_at).toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>LER Comparison Report</title>
<style>
  :root {
    --bg:        #0f172a;
    --surface:   #1e293b;
    --border:    #334155;
    --text:      #f1f5f9;
    --muted:     #94a3b8;
    --green:     #22c55e;
    --amber:     #f59e0b;
    --red:       #ef4444;
    --blue:      #3b82f6;
    --purple:    #a855f7;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Segoe UI', system-ui, sans-serif;
    padding: 24px;
    line-height: 1.5;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }
  header h1 { font-size: 1.5rem; font-weight: 700; }
  header .meta { font-size: 0.8rem; color: var(--muted); }

  .legend {
    display: flex; gap: 24px;
    margin-bottom: 24px;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .swatch { width: 14px; height: 14px; border-radius: 2px; }
  .sw-piece { background: #94a3b8; border: 1px solid #475569; }
  .sw-ler   { background: rgba(34,197,94,0.30); border: 1px solid #22c55e; }
  .sw-line  { background: #f59e0b; height: 3px; width: 20px; }

  .pattern-section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 28px;
  }
  .pattern-header {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 14px;
  }
  .pattern-header h2 { font-size: 1.1rem; font-weight: 600; }
  .piece-count {
    font-size: 0.75rem;
    background: var(--border);
    border-radius: 999px;
    padding: 2px 10px;
    color: var(--muted);
  }

  .comparison-headers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 6px;
  }
  .col-header {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 4px 0;
    text-align: center;
  }
  .after-header  { color: var(--green); }
  .before-header { color: var(--amber); }

  .bed-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 14px;
  }
  .bed-col { display: flex; flex-direction: column; gap: 4px; }
  .bed-label { font-size: 0.72rem; color: var(--muted); }
  .bed-col svg { width: 100%; height: auto; }
  .no-bed { color: var(--muted); font-size: 0.8rem; font-style: italic; }

  .summary-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .summary-stat { display: flex; flex-direction: column; gap: 2px; }
  .stat-label { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .stat-value { font-size: 0.95rem; font-weight: 600; }
  .positive { color: var(--green); }
  .negative { color: var(--red); }

  .stat-badge {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 999px;
    margin-top: 2px;
  }
  .stat-badge.good    { background: rgba(34,197,94,0.15);  color: var(--green); }
  .stat-badge.warn    { background: rgba(239,68,68,0.15);  color: var(--red);   }
  .stat-badge.neutral { background: rgba(148,163,184,0.15); color: var(--muted); }

  footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    font-size: 0.75rem;
    color: var(--muted);
    text-align: center;
  }
</style>
</head>
<body>

<header>
  <div>
    <h1>LER Comparison Report</h1>
    <p class="meta">Bed 2500 &times; 1300 mm &nbsp;|&nbsp; ${analysis.total_patterns} pattern(s) &nbsp;|&nbsp; Generated ${escHtml(ts)}</p>
  </div>
</header>

<div class="legend">
  <div class="legend-item"><div class="swatch sw-piece"></div> Pattern piece (bounding box)</div>
  <div class="legend-item"><div class="swatch sw-ler"></div> Largest Empty Rectangle (LER)</div>
  <div class="legend-item"><div class="swatch sw-line" style="border-top:2px dashed #f59e0b;width:20px;height:0;"></div> &nbsp;Used-height boundary</div>
</div>

${sections}

<footer>
  TailorX &mdash; LER Comparison &mdash; ${escHtml(ts)}
</footer>
</body>
</html>`;
}
