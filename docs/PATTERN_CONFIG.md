# Per-Design SVG/PLT Processing Config

**File:** `src/config/patternConfig.ts`

Every FreeSewing pattern generates SVG with different path class conventions. The config maps a **pattern code** (the `freesewing_pattern` column in the `designs` table, e.g. `"tamiko"`) to two processing rules that control how the cut outline is identified during mirrored-SVG cleaning and PLT export.

---

## Config options

### `outlineMatcher`

Controls which `<path>` elements are considered the cut outline:

| Value | Keeps paths with | Use when |
|---|---|---|
| `'fabric-sa'` | both `fabric` **and** `sa` classes | Normal patterns (Brian, Teagan, etc.) — the seam-allowance outline is a separate path |
| `'fabric-only'` | `fabric` class **without** `sa` | Cut-on-fold patterns (Tamiko) — the outline path has no `sa` class |

### `stripSubPaths`

When `true`, everything after the first `z` in the path `d` attribute is discarded. FreeSewing sometimes appends grainline/construction strokes as extra sub-paths inside the same `<path>` element. Tamiko does this; standard patterns don't.

---

## Step-by-step: adding a new design with custom config

**1. Identify the pattern code** — it's the `freesewing_pattern` value in the `designs` DB table (e.g. `"waralee"`).

**2. Open the SVG** generated for that design and inspect the cut outline `<path>` element. Check its `class` attribute:
- `class="fabric sa"` → use `outlineMatcher: 'fabric-sa'`
- `class="fabric"` (no `sa`) → use `outlineMatcher: 'fabric-only'`

**3. Check if sub-paths exist** — look at the path's `d` attribute. If it contains multiple `M` / `z` segments, set `stripSubPaths: true`.

**4. Add one entry to `src/config/patternConfig.ts`:**

```ts
const patternConfigs: Record<string, PatternSvgConfig> = {
  tamiko: {
    outlineMatcher: 'fabric-only',
    stripSubPaths: true,
  },
  // Add your new design here, e.g.:
  waralee: {
    outlineMatcher: 'fabric-only',
    stripSubPaths: false,
  },
};
```

That's it — no other files need touching. The config is automatically picked up by:
- `cleanMirroredSvg` in `src/utils/freesewing.ts` (what gets stored in `svg_mirrored` at payment time)
- `TailorFitService.parseSVG` + `process` in `src/services/TailorFitService.ts` (what gets exported as PLT)

The `patternCode` flows through the whole pipeline starting from `design.freesewing_pattern` at the DB level.

---

## How the config flows through the pipeline

```
designs.freesewing_pattern  (DB)
        │
        ▼
paymentController → cleanMirroredSvg(svg, patternCode)
                            │
                            ▼
                    stored as ordered_patterns.svg_mirrored
                            │
                            ▼
patternController → exportOrderedPatternToPLT
                            │
                            ├─ resolves patternCode via OrderedPattern → Pattern → Design
                            │
                            ▼
                    TailorFitService.process(svg, patternCode)
                            │
                            ▼
                    TailorFitService.parseSVG(svg, patternCode)
                            │
                            ▼
                    getPatternConfig(patternCode)  ← patternConfig.ts
```

---

## Defaults

Any design **not** listed in `patternConfigs` automatically uses:

```ts
{
  outlineMatcher: 'fabric-sa',
  stripSubPaths: false,
}
```

This matches the original behavior of all standard FreeSewing patterns.
