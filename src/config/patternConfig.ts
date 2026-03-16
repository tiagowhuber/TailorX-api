/**
 * Per-design SVG processing configuration.
 *
 * This is the single place to declare how each FreeSewing pattern's SVG
 * should be interpreted during mirrored-SVG cleaning and PLT export.
 *
 * outlineMatcher
 *   'fabric-sa'   — the cut outline has BOTH 'fabric' and 'sa' classes (default).
 *                   Only paths carrying both classes are kept.
 *   'fabric-only' — the cut outline has ONLY the 'fabric' class, with no 'sa'
 *                   class (e.g. Tamiko cut-on-fold). Only paths carrying 'fabric'
 *                   but NOT 'sa' are kept.
 *
 * stripSubPaths
 *   When true, everything after the first 'z' in the path data is discarded.
 *   This removes grainline / construction sub-paths that FreeSewing appends to
 *   the main outline in a single <path> element (characteristic of cut-on-fold
 *   patterns like Tamiko).
 */
export interface PatternSvgConfig {
  outlineMatcher: 'fabric-sa' | 'fabric-only';
  stripSubPaths: boolean;
}

const defaultConfig: PatternSvgConfig = {
  outlineMatcher: 'fabric-sa',
  stripSubPaths: false,
};

const patternConfigs: Record<string, PatternSvgConfig> = {
  tamiko: {
    outlineMatcher: 'fabric-only',
    stripSubPaths: true,
  },
};

/**
 * Return the SVG processing config for a given FreeSewing pattern code.
 * Falls back to the default (fabric+sa) config for unknown codes.
 */
export function getPatternConfig(patternCode: string): PatternSvgConfig {
  return patternConfigs[patternCode.toLowerCase()] ?? defaultConfig;
}
