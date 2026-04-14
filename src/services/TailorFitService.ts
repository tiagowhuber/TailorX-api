import { parseHTML } from 'linkedom';
import { svgPathProperties } from 'svg-path-properties';
import potpack from 'potpack';
import JSZip from 'jszip';
import { getPatternConfig } from '../config/patternConfig';

interface Point {
  x: number;
  y: number;
}

interface PatternPiece {
  id: string;
  originalPoints: Point[];
  points: Point[]; // Current points (rotated)
  width: number;
  height: number;
  x?: number;
  y?: number;
  rotation: number; // 0, 90, 180, 270
}

interface ReusableArea {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number; // mm²
  areaCm2: number; // cm²
}

interface Bed {
  pieces: PatternPiece[];
  efficiency: number;
  width: number;
  height: number;
  reusableArea?: ReusableArea;
  usedHeightMm: number; // safeY computed in nestPieces
}

// ---- Layout Analysis Interfaces ----

interface SvgLayoutStats {
  bboxWidthMm: number;
  bboxHeightMm: number;
  scaleFactor: number;        // BED_WIDTH / bboxWidthMm
  normalizedHeightMm: number; // bboxHeightMm * scaleFactor
  lerHeightMm: number;        // max(0, BED_HEIGHT - normalizedHeightMm)
  lerAreaMm2: number;         // BED_WIDTH * lerHeightMm
  lerRatio: number;           // lerAreaMm2 / (BED_WIDTH * BED_HEIGHT)
}

interface PltBedStats {
  bedIndex: number;
  usedHeightMm: number;
  lerHeightMm: number;
  lerAreaMm2: number;
  lerRatio: number;
  efficiency: number;
  pieceCount: number;
}

interface PltLayoutStats {
  beds: PltBedStats[];
  aggregateLerAreaMm2: number;
  aggregateLerRatio: number;
  totalBeds: number;
}

interface LayoutComparison {
  heightReductionMm: number;
  heightReductionPct: number;
  lerImprovementMm2: number;
  lerImprovementPct: number;
  summary: string;
}

export interface BedVisualization {
  bedIndex: number;           // 1-based
  widthMm: number;
  heightMm: number;
  usedHeightMm: number;       // safeY — where pieces end vertically
  usedWidthMm: number;        // safeX — where pieces end horizontally
  lerHeightMm: number;        // BED_HEIGHT - usedHeightMm
  lerAreaMm2: number;         // LER #1: full-width bottom strip
  ler2WidthMm: number;        // BED_WIDTH - usedWidthMm
  ler2AreaMm2: number;        // LER #2: full-height right strip
  lerUnionAreaMm2: number;    // LER1 + LER2 - overlap (bottom-right corner)
  pieces: { id: string; x: number; y: number; width: number; height: number }[];
}

export interface PatternLayoutStats {
  patternKey: string;
  userId: number;
  userName: string;
  designId: number;
  designName: string;
  pieceCount: number;
  svg: SvgLayoutStats;
  plt: PltLayoutStats;
  pltUnoptimized: PltLayoutStats;
  comparison: LayoutComparison;
  optimizedBeds: BedVisualization[];
  unoptimizedBeds: BedVisualization[];
}

/**
 * TailorFitService: Processes SVG pattern files and converts them to PLT format for cutting machines.
 * 
 * Main workflow:
 * 1. Parse SVG to extract pattern pieces
 * 2. Nest pieces onto physical cutting beds
 * 3. Generate PLT commands for the cutting machine
 */
export class TailorFitService {
  // Physical dimensions of the cutting bed in millimeters
  private static readonly BED_WIDTH = 2500; // mm - Width of cutting bed
  private static readonly BED_HEIGHT = 1300; // mm - Height of cutting bed
  
  // Spacing between pattern pieces on the bed to prevent overlap
  private static readonly MARGIN = 10; // mm - Gap between pieces
  
  // PLT file unit conversion (40 PLT units = 1mm)
  private static readonly PLT_SCALE = 40; // units/mm
  
  // Step size for converting curved SVG paths to straight line segments
  private static readonly FLATTEN_STEP = 1; // mm - Smaller = more accurate but more points

  /**
   * Main entry point: Process SVG pattern and generate PLT cutting files.
   * 
   * @param svgString - Raw SVG content containing pattern pieces
   * @returns Object with content (PLT string or ZIP buffer), mimeType, and filename
   * 
   * Workflow:
   * 1. Parse SVG to extract pattern pieces with their coordinates
   * 2. Nest pieces onto one or more cutting beds using bin-packing algorithm
   * 3. Generate PLT commands (single file) or ZIP archive (multiple beds)
   */
  public async process(
    svgString: string,
    patternCode?: string,
    statsContext?: {
      userId: number; userName: string;
      designId: number; designName: string;
      patternKey: string;
    }
  ): Promise<{ content: string | Buffer; mimeType: string; filename: string; stats: PatternLayoutStats | null }> {
    console.log('\n========== STARTING SVG PROCESSING ==========');

    const pieces = this.parseSVG(svgString, patternCode);
    console.log(`✓ Parsed ${pieces.length} valid pattern pieces from SVG\n`);

    // Capture SVG layout stats BEFORE nestPieces mutates piece.points
    const svgStats = this.computeSvgLayoutStats(pieces);

    const beds = this.nestPieces(pieces, TailorFitService.BED_WIDTH, TailorFitService.BED_HEIGHT);
    console.log(`\n✓ Nested pieces into ${beds.length} bed(s)`);

    if (beds.length === 0) {
        throw new Error("No valid pattern pieces found to process.");
    }

    // Log summary of all beds
    console.log('\n--- BED SUMMARY ---');
    beds.forEach((bed, index) => {
      console.log(`Bed ${index + 1}: ${bed.pieces.length} pieces, ${bed.efficiency.toFixed(2)}% efficiency`);
      if (bed.reusableArea) {
        console.log(`  └─ Reusable Area: ${bed.reusableArea.width.toFixed(1)}×${bed.reusableArea.height.toFixed(1)}mm (${bed.reusableArea.areaCm2.toFixed(2)} cm²)`);
      }
    });
    console.log('==========================================\n');

    // Compute optimized PLT stats and visualizations
    const pltStats = this.computePltLayoutStats(beds);
    const optimizedBeds = this.buildBedVisualizations(beds);

    // Compute unoptimized PLT stats (needed for fair comparison)
    let pltUnoptimized: PltLayoutStats = { beds: [], aggregateLerAreaMm2: 0, aggregateLerRatio: 0, totalBeds: 0 };
    let unoptimizedBeds: BedVisualization[] = [];
    if (statsContext) {
      const freshPieces: PatternPiece[] = pieces.map(p => ({
        ...p,
        points: [...p.originalPoints],
        rotation: 0,
      }));
      const unoptimizedBedsResult = this.nestPiecesUnoptimized(
        freshPieces,
        TailorFitService.BED_WIDTH,
        TailorFitService.BED_HEIGHT
      );
      pltUnoptimized = this.computePltLayoutStats(unoptimizedBedsResult);
      unoptimizedBeds = this.buildBedVisualizations(unoptimizedBedsResult);
    }

    // Compare unoptimized PLT vs optimized PLT
    const comparison = this.buildLayoutComparison(pltUnoptimized, pltStats);

    const stats: PatternLayoutStats | null = statsContext ? {
      patternKey:      statsContext.patternKey,
      userId:          statsContext.userId,
      userName:        statsContext.userName,
      designId:        statsContext.designId,
      designName:      statsContext.designName,
      pieceCount:      pieces.length,
      svg:             svgStats,
      plt:             pltStats,
      pltUnoptimized,
      comparison,
      optimizedBeds,
      unoptimizedBeds,
    } : null;

    // Generate output: single PLT file or ZIP archive with multiple PLT files
    if (beds.length === 1 && beds[0]) {
      const pltContent = this.convertToPLT(beds[0]);
      return {
        content: pltContent,
        mimeType: 'application/plt',
        filename: 'pattern.plt',
        stats
      };
    } else {
      const zip = new JSZip();
      beds.forEach((bed, index) => {
        const pltContent = this.convertToPLT(bed);
        zip.file(`pattern_${String(index + 1).padStart(3, '0')}.plt`, pltContent);
      });
      const content = await zip.generateAsync({ type: 'nodebuffer' });
      return {
        content: content,
        mimeType: 'application/zip',
        filename: 'pattern_set.zip',
        stats
      };
    }
  }

  /**
   * Parse SVG content and extract valid pattern pieces.
   * 
   * Filters paths based on:
   * - Must have class "fabric sa" (fabric with seam allowance)
   * - Not inside <defs>, <symbol>, or other non-renderable containers
   * - No ignored classes (note, mark, text, annotation, etc.)
   * - Not dashed lines (indicated by stroke-dasharray)
   * 
   * @param svgString - Raw SVG content
   * @returns Array of pattern pieces with their coordinates and dimensions
   */
  public parseSVG(svgString: string, patternCode?: string): PatternPiece[] {
    console.log('[PARSE] Starting SVG parsing...');
    const patternCfg = getPatternConfig(patternCode ?? '');
    const { document } = parseHTML(svgString);
    const paths = document.querySelectorAll('path');
    const pieces: PatternPiece[] = [];

    console.log(`[PARSE] Found ${paths.length} total <path> elements in SVG`);
    let idCounter = 0;
    
    Array.from(paths).forEach((path: any, index) => {
      const classAttr = path.getAttribute('class') || '';
      const idStr = path.getAttribute('id') || `path_${index}`;

      const classes = classAttr.split(/\s+/);
      const isFabric = classes.includes('fabric');
      const hasSa = classes.includes('sa');

      // Filter 1: Accept only paths matching this design's outline signature
      const isOutline =
        patternCfg.outlineMatcher === 'fabric-only'
          ? isFabric && !hasSa  // Tamiko: plain fabric path, no sa class
          : isFabric && hasSa;  // default: must have both fabric + sa

      if (!isOutline) {
        console.log(`[SVG Debug] Ignored ${idStr} (Not outline. path_class: "${classAttr}")`);
        return;
      }

      // 1. Check if path is inside a definition or non-renderable container
      if (this.isInsideDef(path)) {
        console.log(`[SVG Debug] Ignored ${idStr} (inside defs/symbol)`);
        return;
      }

      // 2. Check for ignored classes on element or parents
      if (this.hasIgnoredClass(path)) {
        console.log(`[SVG Debug] Ignored ${idStr} (Ignored Class. path_class: "${classAttr}")`);
        return;
      }

      // 3. Check for dashed lines (stroke-dasharray) on element or parents
      if (this.isDashed(path)) {
        console.log(`[SVG Debug] Ignored ${idStr} (Dashed Line. path_class: "${classAttr}")`);
        return;
      }

      let d = path.getAttribute('d');
      if (!d) {
        console.log(`[SVG Debug] Ignored ${idStr} (No d attribute)`);
        return;
      }

      // Strip construction sub-paths when configured (e.g. Tamiko)
      if (patternCfg.stripSubPaths) {
        const zIndex = d.search(/z/i);
        if (zIndex !== -1) {
          d = d.slice(0, zIndex + 1).trim();
        }
      }

      const points = this.flattenCurves(d);
      if (points.length < 2) {
        console.log(`[SVG Debug] Ignored ${idStr} (Not enough points)`);
        return;
      }

      const bbox = this.calculateBBox(points);
      
      console.log(`[SVG Debug] ✓ Accepted ${idStr}`);
      console.log(`  └─ Class: "${classAttr}", Points: ${points.length}`);
      console.log(`  └─ Dimensions: ${bbox.width.toFixed(2)}mm × ${bbox.height.toFixed(2)}mm (${(bbox.width * bbox.height / 100).toFixed(2)} cm²)`);
      
      pieces.push({
        id: `piece_${idCounter++}`,
        originalPoints: points,
        points: points, // Initially same as original
        width: bbox.width,
        height: bbox.height,
        rotation: 0
      });
    });

    console.log(`[PARSE] ✓ Successfully parsed ${pieces.length} valid pattern pieces\n`);
    return pieces;
  }

  /**
   * Check if an SVG element is inside a definition or non-renderable container.
   * 
   * Elements inside <defs>, <symbol>, etc. are templates/definitions, not actual rendered paths.
   * 
   * @param element - SVG element to check
   * @returns true if element is inside a definition container
   */
  private isInsideDef(element: any): boolean {
    let current = element.parentElement;
    while (current) {
        const tagName = current.tagName?.toLowerCase();
        if (['defs', 'symbol', 'clippath', 'mask', 'marker', 'pattern'].includes(tagName)) {
            return true;
        }
        current = current.parentElement;
    }
    return false;
  }

  /**
   * Check if element or any parent has a class that should be ignored.
   * 
   * Ignores annotation/helper elements like:
   * - Notes, marks, text labels
   * - Notches, cut-on-fold indicators
   * - UI elements (scalebox, logo, grid, etc.)
   * 
   * @param element - SVG element to check
   * @returns true if element has an ignored class
   */
  private hasIgnoredClass(element: any): boolean {
    const ignoredTerms = [
        'note', 'mark', 'text', 'annotation', 'notch', 'cutonfold', 
        'title', 'logo', 'scalebox', 'dimension', 'paperless', 'grid', 'layout',
        'help', 'interface', 'contrast', 'hidden'
    ];
    
    let current = element;
    while (current && current.getAttribute) {
        const classAttr = current.getAttribute('class') || '';
        // Split classes by whitespace to check individual words
        const classes = classAttr.split(/\s+/);
        
        if (ignoredTerms.some(term => classes.some((c: string) => c.includes(term)))) {
            return true;
        }
        current = current.parentElement;
    }
    return false;
  }

  /**
   * Check if element has dashed stroke styling.
   * 
   * Dashed lines are typically used for fold lines, grainlines, or other
   * guide marks that shouldn't be cut.
   * 
   * @param element - SVG element to check
   * @returns true if element has stroke-dasharray attribute or style
   */
  private isDashed(element: any): boolean {
    let current = element;
    while (current && current.getAttribute) {
        const dashArray = current.getAttribute('stroke-dasharray');
        if (dashArray && dashArray !== 'none') {
            return true;
        }
        
        const style = current.getAttribute('style') || '';
        if (style.includes('stroke-dasharray') && 
            !style.includes('stroke-dasharray:none') && 
            !style.includes('stroke-dasharray: none')) {
            return true;
        }
        
        current = current.parentElement;
    }
    return false;
  }

  /**
   * Flatten curved SVG paths into discrete points.
   * 
   * Converts Bezier curves, arcs, etc. into a series of straight line segments
   * by sampling points along the path at regular intervals.
   * 
   * @param d - SVG path 'd' attribute (e.g., "M10,10 L20,20 C30,30...")
   * @returns Array of {x, y} points representing the flattened path
   */
  public flattenCurves(d: string): Point[] {
    const properties = new svgPathProperties(d);
    const length = properties.getTotalLength();
    const points: Point[] = [];
    
    // Sample points
    for (let i = 0; i <= length; i += TailorFitService.FLATTEN_STEP) {
      const pt = properties.getPointAtLength(i);
      points.push({ x: pt.x, y: pt.y });
    }
    // Ensure last point is included
    const endPt = properties.getPointAtLength(length);
    if (points.length > 0) {
        const last = points[points.length - 1];
        if (last && (Math.abs(last.x - endPt.x) > 0.001 || Math.abs(last.y - endPt.y) > 0.001)) {
            points.push({ x: endPt.x, y: endPt.y });
        }
    } else {
        points.push({ x: endPt.x, y: endPt.y });
    }

    return points;
  }

  /**
   * Calculate the bounding box of a set of points.
   * 
   * @param points - Array of {x, y} points
   * @returns Object with minX, minY, width, and height of the bounding box
   */
  private calculateBBox(points: Point[]): { minX: number; minY: number; width: number; height: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }

  /**
   * Deep-copy pieces from their originalPoints, optionally pre-rotate so the longest
   * side is horizontal, normalize to (0,0), then sort using the provided comparator.
   */
  private preparePieces(
    pieces: PatternPiece[],
    sortFn: ((a: PatternPiece, b: PatternPiece) => number) | null,
    preRotate: boolean
  ): PatternPiece[] {
    const copied: PatternPiece[] = pieces.map(p => ({
      ...p,
      points: [...p.originalPoints],
      rotation: 0,
    }));

    if (preRotate) {
      copied.forEach(p => {
        const bbox = this.calculateBBox(p.points);
        if (bbox.height > bbox.width) {
          this.rotatePiece(p, 90);
        }
        this.normalizePiece(p);
      });
    } else {
      copied.forEach(p => this.normalizePiece(p));
    }

    if (sortFn) {
      copied.sort(sortFn);
    }

    return copied;
  }

  /**
   * FFDH shelf-packing algorithm.
   * Expects pieces to be already pre-rotated, normalized, and sorted.
   */
  private runShelfPacking(pieces: PatternPiece[], bedWidth: number, bedHeight: number): Bed[] {
    interface Shelf {
      y: number;
      height: number;
      remainingWidth: number;
    }

    const beds: Bed[] = [];
    let remainingPieces = [...pieces];

    while (remainingPieces.length > 0) {
      const currentBedPieces: PatternPiece[] = [];
      const nextRemaining: PatternPiece[] = [];
      const shelves: Shelf[] = [];
      let currentY = TailorFitService.MARGIN;

      for (const piece of remainingPieces) {
        let placed = false;
        const pWidth = piece.width + TailorFitService.MARGIN;
        const pHeight = piece.height + TailorFitService.MARGIN;

        for (const shelf of shelves) {
          if (pWidth <= shelf.remainingWidth) {
            piece.x = bedWidth - shelf.remainingWidth;
            piece.y = shelf.y;
            shelf.remainingWidth -= pWidth;
            placed = true;
            break;
          }
        }

        if (!placed) {
          if (currentY + pHeight <= bedHeight) {
            shelves.push({
              y: currentY,
              height: pHeight,
              remainingWidth: bedWidth - TailorFitService.MARGIN - pWidth,
            });
            piece.x = TailorFitService.MARGIN;
            piece.y = currentY;
            currentY += pHeight;
            placed = true;
          }
        }

        if (placed) {
          currentBedPieces.push(piece);
          console.log(`  ✓ Fitted ${piece.id}: ${piece.width.toFixed(1)}×${piece.height.toFixed(1)}mm at (${piece.x?.toFixed(1)}, ${piece.y?.toFixed(1)})`);
        } else {
          nextRemaining.push(piece);
          console.log(`  ✗ Skipped ${piece.id}: ${piece.width.toFixed(1)}×${piece.height.toFixed(1)}mm (doesn't fit)`);
        }
      }

      const usedArea = currentBedPieces.reduce((sum, p) => sum + p.width * p.height, 0);
      const efficiency = (usedArea / (bedWidth * bedHeight)) * 100;

      let maxUsedX = 0, maxUsedY = 0;
      currentBedPieces.forEach(p => {
        const farX = (p.x ?? 0) + p.width;
        const farY = (p.y ?? 0) + p.height;
        if (farX > maxUsedX) maxUsedX = farX;
        if (farY > maxUsedY) maxUsedY = farY;
      });

      const safeX = Math.min(maxUsedX + TailorFitService.MARGIN, bedWidth);
      const safeY = Math.min(maxUsedY + TailorFitService.MARGIN, bedHeight);

      const rightArea: ReusableArea = {
        x: safeX, y: 0,
        width: Math.max(0, bedWidth - safeX), height: bedHeight,
        area: Math.max(0, bedWidth - safeX) * bedHeight,
        areaCm2: (Math.max(0, bedWidth - safeX) * bedHeight) / 100,
      };
      const bottomArea: ReusableArea = {
        x: 0, y: safeY,
        width: bedWidth, height: Math.max(0, bedHeight - safeY),
        area: bedWidth * Math.max(0, bedHeight - safeY),
        areaCm2: (bedWidth * Math.max(0, bedHeight - safeY)) / 100,
      };

      beds.push({
        pieces: currentBedPieces,
        efficiency,
        width: bedWidth,
        height: bedHeight,
        reusableArea: rightArea.area >= bottomArea.area ? rightArea : bottomArea,
        usedHeightMm: safeY,
      });

      remainingPieces = nextRemaining;

      if (currentBedPieces.length === 0 && remainingPieces.length > 0) {
        console.warn(`⚠️  Piece ${remainingPieces[0]?.id} too large for bed — skipping.`);
        remainingPieces.shift();
      }
    }

    return beds;
  }

  /**
   * Skyline packing algorithm. Tracks the "height profile" (skyline) across the bed width,
   * placing each piece at the lowest available position that fits — including under the
   * "shadows" of taller pieces. This eliminates the interior gaps that shelf packing leaves.
   *
   * Pieces must be pre-rotated, normalized, and sorted before calling this method.
   */
  private runSkylinePacking(pieces: PatternPiece[], bedWidth: number, bedHeight: number): Bed[] {
    interface SkylineNode { x: number; y: number; width: number; }

    const beds: Bed[] = [];
    let remainingPieces = [...pieces];

    while (remainingPieces.length > 0) {
      const currentBedPieces: PatternPiece[] = [];
      const nextRemaining: PatternPiece[] = [];

      // Flat skyline at the top margin
      let skyline: SkylineNode[] = [{ x: TailorFitService.MARGIN, y: TailorFitService.MARGIN, width: bedWidth - TailorFitService.MARGIN }];

      /** Find the lowest Y position where a piece of size pW×pH can be placed. */
      const findBestPlacement = (pW: number, pH: number): { x: number; y: number } | null => {
        let bestY = Infinity, bestX = Infinity;

        for (let i = 0; i < skyline.length; i++) {
          const startX = skyline[i]!.x;
          if (startX + pW > bedWidth) continue;

          // Compute max Y across all nodes the piece would span
          let maxY = 0, coveredW = 0, j = i;
          while (j < skyline.length && coveredW < pW) {
            maxY = Math.max(maxY, skyline[j]!.y);
            coveredW += skyline[j]!.width;
            j++;
          }
          if (coveredW < pW) continue;       // not enough width coverage
          if (maxY + pH > bedHeight) continue; // piece would overflow vertically

          if (maxY < bestY || (maxY === bestY && startX < bestX)) {
            bestY = maxY;
            bestX = startX;
          }
        }

        return bestY < Infinity ? { x: bestX, y: bestY } : null;
      };

      /** Raise the skyline in [px, px+pW] to py+pH, split/merge nodes as needed. */
      const updateSkyline = (px: number, py: number, pW: number, pH: number) => {
        const pieceEnd = px + pW;
        const newY     = py + pH;
        const next: SkylineNode[] = [];

        for (const node of skyline) {
          const ne = node.x + node.width;
          if (ne <= px || node.x >= pieceEnd) {
            next.push({ ...node });
          } else {
            if (node.x < px)      next.push({ x: node.x,   y: node.y, width: px - node.x });
            if (ne   > pieceEnd)  next.push({ x: pieceEnd, y: node.y, width: ne - pieceEnd });
          }
        }
        next.push({ x: px, y: newY, width: pW });
        next.sort((a, b) => a.x - b.x);

        // Merge adjacent nodes at the same height
        skyline = [];
        for (const n of next) {
          const last = skyline[skyline.length - 1];
          if (last && last.y === n.y && last.x + last.width === n.x) {
            last.width += n.width;
          } else {
            skyline.push({ ...n });
          }
        }
      };

      for (const piece of remainingPieces) {
        const pW = piece.width  + TailorFitService.MARGIN;
        const pH = piece.height + TailorFitService.MARGIN;
        const placement = findBestPlacement(pW, pH);
        if (placement) {
          piece.x = placement.x;
          piece.y = placement.y;
          updateSkyline(placement.x, placement.y, pW, pH);
          currentBedPieces.push(piece);
          console.log(`  ✓ [Skyline] ${piece.id}: ${piece.width.toFixed(1)}×${piece.height.toFixed(1)}mm at (${piece.x.toFixed(1)}, ${piece.y.toFixed(1)})`);
        } else {
          nextRemaining.push(piece);
          console.log(`  ✗ [Skyline] ${piece.id}: doesn't fit on this bed`);
        }
      }

      let maxUsedX = 0, maxUsedY = 0;
      currentBedPieces.forEach(p => {
        const farX = (p.x ?? 0) + p.width;
        const farY = (p.y ?? 0) + p.height;
        if (farX > maxUsedX) maxUsedX = farX;
        if (farY > maxUsedY) maxUsedY = farY;
      });
      const safeX = Math.min(maxUsedX + TailorFitService.MARGIN, bedWidth);
      const safeY = Math.min(maxUsedY + TailorFitService.MARGIN, bedHeight);

      const rightArea: ReusableArea = {
        x: safeX, y: 0,
        width: Math.max(0, bedWidth - safeX), height: bedHeight,
        area: Math.max(0, bedWidth - safeX) * bedHeight,
        areaCm2: (Math.max(0, bedWidth - safeX) * bedHeight) / 100,
      };
      const bottomArea: ReusableArea = {
        x: 0, y: safeY,
        width: bedWidth, height: Math.max(0, bedHeight - safeY),
        area: bedWidth * Math.max(0, bedHeight - safeY),
        areaCm2: (bedWidth * Math.max(0, bedHeight - safeY)) / 100,
      };

      const usedArea = currentBedPieces.reduce((s, p) => s + p.width * p.height, 0);
      beds.push({
        pieces: currentBedPieces,
        efficiency: (usedArea / (bedWidth * bedHeight)) * 100,
        width: bedWidth,
        height: bedHeight,
        reusableArea: rightArea.area >= bottomArea.area ? rightArea : bottomArea,
        usedHeightMm: safeY,
      });

      remainingPieces = nextRemaining;
      if (currentBedPieces.length === 0 && remainingPieces.length > 0) {
        console.warn(`⚠️  Piece ${remainingPieces[0]?.id} too large for bed — skipping.`);
        remainingPieces.shift();
      }
    }

    return beds;
  }


  /**
   * Compute total bounding-box area across all beds.
   * Union LER = BED_AREA − bboxArea, so minimising this maximises Union LER.
   */
  private totalBboxArea(beds: Bed[], bedWidth: number): number {
    return beds.reduce((sum, bed) => {
      let maxX = 0;
      bed.pieces.forEach(p => {
        const farX = (p.x ?? 0) + p.width;
        if (farX > maxX) maxX = farX;
      });
      const usedWidth = Math.min(maxX + TailorFitService.MARGIN, bedWidth);
      return sum + usedWidth * bed.usedHeightMm;
    }, 0);
  }

  /**
   * Meta-optimizer: tries FFDH (height/width/area sort), Skyline (height/area sort),
   * and Sequential column packing, then returns the layout with the fewest beds;
   * ties broken by smallest total bounding-box area (= highest Union LER).
   */
  public nestPieces(pieces: PatternPiece[], bedWidth: number, bedHeight: number): Bed[] {
    console.log(`[NEST] Bed dimensions: ${bedWidth}mm × ${bedHeight}mm — trying multiple strategies...\n`);

    type Result = { name: string; beds: Bed[]; bedCount: number; bboxArea: number };
    const results: Result[] = [];

    const sortFns: { name: string; sortFn: (a: PatternPiece, b: PatternPiece) => number }[] = [
      { name: 'height', sortFn: (a, b) => b.height - a.height },
      { name: 'width',  sortFn: (a, b) => b.width  - a.width  },
      { name: 'area',   sortFn: (a, b) => (b.width * b.height) - (a.width * a.height) },
    ];

    for (const s of sortFns) {
      const prepared = this.preparePieces(pieces, s.sortFn, true);
      const beds = this.runShelfPacking(prepared, bedWidth, bedHeight);
      beds.forEach(b => this.compactBed(b));
      results.push({ name: `FFDH-${s.name}`, beds, bedCount: beds.length, bboxArea: this.totalBboxArea(beds, bedWidth) });
    }

    // Skyline with height and area sort (fills gaps below taller pieces)
    for (const s of [sortFns[0]!, sortFns[2]!]) {
      const prepared = this.preparePieces(pieces, s.sortFn, true);
      const beds = this.runSkylinePacking(prepared, bedWidth, bedHeight);
      beds.forEach(b => this.compactBed(b));
      results.push({ name: `Sky-${s.name}`, beds, bedCount: beds.length, bboxArea: this.totalBboxArea(beds, bedWidth) });
    }

    // Row packing with height, width and area sort
    for (const s of sortFns) {
      const prepared = this.preparePieces(pieces, s.sortFn, true);
      const beds = this.runRowPacking(prepared, bedWidth, bedHeight);
      beds.forEach(b => this.compactBed(b));
      results.push({ name: `Row-${s.name}`, beds, bedCount: beds.length, bboxArea: this.totalBboxArea(beds, bedWidth) });
    }

    // Sequential column packing (original order, no rotation)
    const seqPrepared = this.preparePieces(pieces, null, false);
    const seqBeds = this.runColumnPacking(seqPrepared, bedWidth, bedHeight);
    seqBeds.forEach(b => this.compactBed(b));
    results.push({ name: 'Sequential', beds: seqBeds, bedCount: seqBeds.length, bboxArea: this.totalBboxArea(seqBeds, bedWidth) });

    // Select winner: fewest beds first, then smallest bboxArea
    results.sort((a, b) => a.bedCount - b.bedCount || a.bboxArea - b.bboxArea);
    const winner = results[0]!;

    console.log('[NEST] Strategy results:');
    results.forEach(r => {
      const marker = r.name === winner.name ? '★' : ' ';
      console.log(`  ${marker} ${r.name.padEnd(14)} ${r.bedCount} bed(s)  bbox=${(r.bboxArea / 1e6).toFixed(4)} m²`);
    });
    console.log(`\n[NEST] ✓ Winner: ${winner.name} — ${winner.bedCount} bed(s)\n`);

    return winner.beds;
  }

  // ---- Layout Analysis Helpers ----

  /**
   * Compute the SVG layout stats from pieces in their original SVG positions.
   * Must be called BEFORE nestPieces (which mutates piece.points).
   * piece.originalPoints is safe: normalizePiece never touches it.
   */
  private computeSvgLayoutStats(pieces: PatternPiece[]): SvgLayoutStats {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const piece of pieces) {
      for (const p of piece.originalPoints) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }

    const bboxWidthMm  = maxX - minX;
    const bboxHeightMm = maxY - minY;
    const scaleFactor  = bboxWidthMm > 0 ? TailorFitService.BED_WIDTH / bboxWidthMm : 1;
    const normalizedHeightMm = bboxHeightMm * scaleFactor;
    const lerHeightMm = Math.max(0, TailorFitService.BED_HEIGHT - normalizedHeightMm);
    const lerAreaMm2  = TailorFitService.BED_WIDTH * lerHeightMm;
    const lerRatio    = lerAreaMm2 / (TailorFitService.BED_WIDTH * TailorFitService.BED_HEIGHT);

    return { bboxWidthMm, bboxHeightMm, scaleFactor, normalizedHeightMm, lerHeightMm, lerAreaMm2, lerRatio };
  }

  /**
   * Compute PLT layout stats from the nested beds.
   */
  private computePltLayoutStats(beds: Bed[]): PltLayoutStats {
    const bedArea = TailorFitService.BED_WIDTH * TailorFitService.BED_HEIGHT;

    const bedStats: PltBedStats[] = beds.map((bed, idx) => {
      const lerHeightMm = Math.max(0, TailorFitService.BED_HEIGHT - bed.usedHeightMm);
      const lerAreaMm2  = TailorFitService.BED_WIDTH * lerHeightMm;
      return {
        bedIndex:     idx + 1,
        usedHeightMm: bed.usedHeightMm,
        lerHeightMm,
        lerAreaMm2,
        lerRatio:     lerAreaMm2 / bedArea,
        efficiency:   bed.efficiency,
        pieceCount:   bed.pieces.length
      };
    });

    const aggregateLerAreaMm2 = bedStats.reduce((sum, b) => sum + b.lerAreaMm2, 0);
    const aggregateLerRatio   = beds.length > 0 ? aggregateLerAreaMm2 / (beds.length * bedArea) : 0;

    return { beds: bedStats, aggregateLerAreaMm2, aggregateLerRatio, totalBeds: beds.length };
  }

  /**
   * Build a comparison between unoptimized PLT layout and optimized PLT layout.
   * Comparison is always unoptimized bed 1 vs optimized bed 1.
   */
  private buildLayoutComparison(unopt: PltLayoutStats, opt: PltLayoutStats): LayoutComparison {
    const optBed1 = opt.beds[0];
    if (!optBed1) {
      return { heightReductionMm: 0, heightReductionPct: 0, lerImprovementMm2: 0, lerImprovementPct: 0, summary: 'No optimised PLT beds available for comparison.' };
    }

    const unoptBed1 = unopt.beds[0];
    const baseUsedHeight     = unoptBed1?.usedHeightMm ?? optBed1.usedHeightMm;
    const heightReductionMm  = baseUsedHeight - optBed1.usedHeightMm;
    const heightReductionPct = baseUsedHeight > 0 ? (heightReductionMm / baseUsedHeight) * 100 : 0;

    const baseLerAreaMm2    = unoptBed1?.lerAreaMm2 ?? 0;
    const lerImprovementMm2 = optBed1.lerAreaMm2 - baseLerAreaMm2;
    const bedAreaMm2        = TailorFitService.BED_WIDTH * TailorFitService.BED_HEIGHT;
    const lerImprovementPct = bedAreaMm2 > 0 ? (lerImprovementMm2 / bedAreaMm2) * 100 : 0;

    const direction = heightReductionMm >= 0 ? 'reduced' : 'increased';
    const absH      = Math.abs(heightReductionMm).toFixed(1);
    const absHPct   = Math.abs(heightReductionPct).toFixed(1);
    const lerDir    = lerImprovementMm2 >= 0 ? 'gained' : 'lost';
    const absLer    = (Math.abs(lerImprovementMm2) / 1_000_000).toFixed(4);
    const absLerPct = Math.abs(lerImprovementPct).toFixed(1);

    const summary =
      `Optimised PLT ${direction} bed height by ${absH}mm (${absHPct}%) vs unoptimised PLT. ` +
      `Free (LER) area ${lerDir} by ${absLer}m² (${absLerPct}%).`;

    return { heightReductionMm, heightReductionPct, lerImprovementMm2, lerImprovementPct, summary };
  }

  /**
   * Normalize piece coordinates so the bounding box starts at (0, 0).
   *
   * Shifts all points so the top-left corner of the bounding box is at origin.
   * Updates the piece's width and height properties.
   *
   * @param piece - Pattern piece to normalize (modified in place)
   */
  private normalizePiece(piece: PatternPiece) {
    const bbox = this.calculateBBox(piece.points);
    // Shift points so minX, minY is 0,0
    piece.points = piece.points.map(p => ({
      x: p.x - bbox.minX,
      y: p.y - bbox.minY
    }));
    piece.width = bbox.width;
    piece.height = bbox.height;
  }

  /**
   * Rotate a pattern piece by a specified angle.
   * 
   * Uses 2D rotation matrix around origin, then re-normalizes the piece.
   * Rotation formula: x' = x*cos(θ) - y*sin(θ), y' = x*sin(θ) + y*cos(θ)
   * 
   * @param piece - Pattern piece to rotate (modified in place)
   * @param angle - Rotation angle in degrees (typically 90, 180, or 270)
   */
  public rotatePiece(piece: PatternPiece, angle: number) {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Apply rotation matrix to all points
    piece.points = piece.points.map(p => ({
      x: p.x * cos - p.y * sin,
      y: p.x * sin + p.y * cos
    }));
    
    piece.rotation = (piece.rotation + angle) % 360;
    // Re-normalize to ensure bounding box starts at (0, 0)
    this.normalizePiece(piece);
  }

  /**
   * Convert a bed of nested pieces into PLT format for cutting machines.
   * 
   * PLT format is a HPGL-based command language for plotters/cutters:
   * - IN: Initialize plotter
   * - SP1: Select pen 1 (cutting tool)
   * - PU: Pen Up (move without cutting)
   * - PD: Pen Down (cut)
   * - Coordinates are scaled by PLT_SCALE (40 units/mm)
   * 
   * @param bed - Bed containing nested pieces with positions
   * @returns PLT command string ready for cutting machine
   */
  public convertToPLT(bed: Bed): string {
    console.log(`[PLT] Generating PLT commands for ${bed.pieces.length} pieces...`);
    const commands: string[] = [];
    commands.push('IN;SP1;'); // Initialize plotter, Select Pen 1

    for (const piece of bed.pieces) {
      if (piece.x === undefined || piece.y === undefined) continue;
      
      const offsetX = piece.x;
      const offsetY = piece.y;

      // Move to first point (pen up, no cutting)
      if (piece.points.length > 0) {
        const start = piece.points[0];
        if (start) {
            // Convert mm to PLT units and apply bed offset
            const sx = Math.round((start.x + offsetX) * TailorFitService.PLT_SCALE);
            const sy = Math.round((start.y + offsetY) * TailorFitService.PLT_SCALE);
            commands.push(`PU${sx},${sy};`);
            
            // Cut through remaining points (pen down)
            commands.push('PD');
            const coords = piece.points.slice(1).map(p => {
              const x = Math.round((p.x + offsetX) * TailorFitService.PLT_SCALE);
              const y = Math.round((p.y + offsetY) * TailorFitService.PLT_SCALE);
              return `${x},${y}`;
            }).join(',');
            commands.push(`${coords};`);
            
            commands.push('PU;'); // Lift pen after cutting piece
        }
      }
    }

    commands.push('PU0,0;SP0;'); // Return pen to origin and deselect
    console.log(`[PLT] ✓ Generated ${commands.length} PLT commands\n`);
    return commands.join('\n');
  }

  /**
   * Simple (unoptimized) nesting: column-by-column placement in original SVG order,
   * no rotation and no sorting. Pieces are stacked top-to-bottom in a column;
   * when a piece overflows the column vertically, a new column is started to the right.
   * Only when the bed is full horizontally does a new bed begin.
   * Used as a baseline to visualise the benefit of the optimized layout.
   */
  /**
   * Column-packing algorithm: stacks pieces top-to-bottom in columns, adding new columns
   * when vertical space is exhausted. Pieces must already be normalized to (0,0).
   * Used internally by nestPieces (as one candidate strategy) and nestPiecesUnoptimized.
   */
  private runColumnPacking(pieces: PatternPiece[], bedWidth: number, bedHeight: number): Bed[] {
    const beds: Bed[] = [];
    let currentBedPieces: PatternPiece[] = [];

    let colX      = TailorFitService.MARGIN;
    let colWidth  = 0;
    let currentY  = TailorFitService.MARGIN;

    const finalizeBed = () => {
      if (currentBedPieces.length === 0) return;

      let maxUsedX = 0, maxUsedY = 0;
      currentBedPieces.forEach(p => {
        const farX = (p.x ?? 0) + p.width;
        const farY = (p.y ?? 0) + p.height;
        if (farX > maxUsedX) maxUsedX = farX;
        if (farY > maxUsedY) maxUsedY = farY;
      });

      const safeX = Math.min(maxUsedX + TailorFitService.MARGIN, bedWidth);
      const safeY = Math.min(maxUsedY + TailorFitService.MARGIN, bedHeight);

      const rightArea: ReusableArea = {
        x: safeX, y: 0,
        width: Math.max(0, bedWidth - safeX), height: bedHeight,
        area: Math.max(0, bedWidth - safeX) * bedHeight,
        areaCm2: (Math.max(0, bedWidth - safeX) * bedHeight) / 100,
      };
      const bottomArea: ReusableArea = {
        x: 0, y: safeY,
        width: bedWidth, height: Math.max(0, bedHeight - safeY),
        area: bedWidth * Math.max(0, bedHeight - safeY),
        areaCm2: (bedWidth * Math.max(0, bedHeight - safeY)) / 100,
      };

      const usedArea = currentBedPieces.reduce((s, p) => s + p.width * p.height, 0);
      beds.push({
        pieces: currentBedPieces,
        efficiency: (usedArea / (bedWidth * bedHeight)) * 100,
        width: bedWidth,
        height: bedHeight,
        reusableArea: rightArea.area >= bottomArea.area ? rightArea : bottomArea,
        usedHeightMm: safeY,
      });
    };

    const resetBed = () => {
      currentBedPieces = [];
      colX     = TailorFitService.MARGIN;
      colWidth = 0;
      currentY = TailorFitService.MARGIN;
    };

    for (const piece of pieces) {
      this.normalizePiece(piece);

      if (piece.width + TailorFitService.MARGIN * 2 > bedWidth ||
          piece.height + TailorFitService.MARGIN * 2 > bedHeight) {
        console.warn(`[COL] Skipping oversized piece ${piece.id}: ${piece.width.toFixed(1)}×${piece.height.toFixed(1)}mm`);
        continue;
      }

      if (currentY + piece.height + TailorFitService.MARGIN > bedHeight) {
        const nextColX = colX + colWidth + TailorFitService.MARGIN;
        if (nextColX + piece.width + TailorFitService.MARGIN > bedWidth) {
          finalizeBed();
          resetBed();
        } else {
          colX     = nextColX;
          colWidth = 0;
          currentY = TailorFitService.MARGIN;
        }
      }

      piece.x = colX;
      piece.y = currentY;
      if (piece.width > colWidth) colWidth = piece.width;
      currentY += piece.height + TailorFitService.MARGIN;
      currentBedPieces.push(piece);
    }

    finalizeBed();
    return beds;
  }

  /**
   * Row-packing algorithm: places pieces left-to-right in rows, opening a new row below
   * when horizontal space is exhausted. analagous to runColumnPacking but transposed.
   * Pieces must already be normalized to (0,0).
   * Used internally by nestPieces as one candidate strategy.
   */
  private runRowPacking(pieces: PatternPiece[], bedWidth: number, bedHeight: number): Bed[] {
    const beds: Bed[] = [];
    let currentBedPieces: PatternPiece[] = [];

    let rowY      = TailorFitService.MARGIN;
    let rowHeight = 0;
    let currentX  = TailorFitService.MARGIN;

    const finalizeBed = () => {
      if (currentBedPieces.length === 0) return;

      let maxUsedX = 0, maxUsedY = 0;
      currentBedPieces.forEach(p => {
        const farX = (p.x ?? 0) + p.width;
        const farY = (p.y ?? 0) + p.height;
        if (farX > maxUsedX) maxUsedX = farX;
        if (farY > maxUsedY) maxUsedY = farY;
      });

      const safeX = Math.min(maxUsedX + TailorFitService.MARGIN, bedWidth);
      const safeY = Math.min(maxUsedY + TailorFitService.MARGIN, bedHeight);

      const rightArea: ReusableArea = {
        x: safeX, y: 0,
        width: Math.max(0, bedWidth - safeX), height: bedHeight,
        area: Math.max(0, bedWidth - safeX) * bedHeight,
        areaCm2: (Math.max(0, bedWidth - safeX) * bedHeight) / 100,
      };
      const bottomArea: ReusableArea = {
        x: 0, y: safeY,
        width: bedWidth, height: Math.max(0, bedHeight - safeY),
        area: bedWidth * Math.max(0, bedHeight - safeY),
        areaCm2: (bedWidth * Math.max(0, bedHeight - safeY)) / 100,
      };

      const usedArea = currentBedPieces.reduce((s, p) => s + p.width * p.height, 0);
      beds.push({
        pieces: currentBedPieces,
        efficiency: (usedArea / (bedWidth * bedHeight)) * 100,
        width: bedWidth,
        height: bedHeight,
        reusableArea: rightArea.area >= bottomArea.area ? rightArea : bottomArea,
        usedHeightMm: safeY,
      });
    };

    const resetBed = () => {
      currentBedPieces = [];
      rowY      = TailorFitService.MARGIN;
      rowHeight = 0;
      currentX  = TailorFitService.MARGIN;
    };

    for (const piece of pieces) {
      this.normalizePiece(piece);

      if (piece.width + TailorFitService.MARGIN * 2 > bedWidth ||
          piece.height + TailorFitService.MARGIN * 2 > bedHeight) {
        console.warn(`[ROW] Skipping oversized piece ${piece.id}: ${piece.width.toFixed(1)}×${piece.height.toFixed(1)}mm`);
        continue;
      }

      if (currentX + piece.width + TailorFitService.MARGIN > bedWidth) {
        // Overflow horizontally — start a new row below
        const nextRowY = rowY + rowHeight + TailorFitService.MARGIN;
        if (nextRowY + piece.height + TailorFitService.MARGIN > bedHeight) {
          // Overflow vertically too — start a new bed
          finalizeBed();
          resetBed();
        } else {
          rowY      = nextRowY;
          rowHeight = 0;
          currentX  = TailorFitService.MARGIN;
        }
      }

      piece.x = currentX;
      piece.y = rowY;
      if (piece.height > rowHeight) rowHeight = piece.height;
      currentX += piece.width + TailorFitService.MARGIN;
      currentBedPieces.push(piece);
    }

    finalizeBed();
    return beds;
  }

  /**
   * Unoptimized sequential layout — always uses column packing in original piece order
   * with no rotation. Kept as a stable baseline for the comparison report.
   */
  public nestPiecesUnoptimized(pieces: PatternPiece[], bedWidth: number, bedHeight: number): Bed[] {
    return this.runColumnPacking(pieces, bedWidth, bedHeight);
  }

  /**
   * Post-placement compaction pass.
   *
   * After any packing algorithm has laid out pieces on a bed, this pass repeatedly
   * tries to relocate pieces from the boundary inward so the bounding box
   * (usedWidth × usedHeight) shrinks and the Union LER grows.
   *
   * For each piece P (sorted furthest to the right first), it tests two candidate
   * positions relative to every other piece Q already on the bed:
   *   1. On top of Q  — (Q.x, Q.y + Q.height + MARGIN)
   *   2. Right of Q   — (Q.x + Q.width + MARGIN, Q.y)
   *
   * A candidate is accepted when:
   *   - It keeps P fully inside [0, bedWidth] × [0, bedHeight]
   *   - It does not overlap any other piece (AABB with MARGIN padding)
   *   - It strictly reduces usedWidth × usedHeight
   *
   * Iterates until a full pass over all pieces produces no improvement.
   * Complexity: O(n² × iterations), negligible for typical 4–20 pieces per bed.
   *
   * After compaction, bed.usedHeightMm, bed.reusableArea, and bed.efficiency
   * are updated to reflect the new layout.
   */
  private compactBed(bed: Bed): void {
    const M = TailorFitService.MARGIN;
    const W = bed.width;
    const H = bed.height;

    /** AABB overlap test — pieces are solid rectangles, separation = M on each side. */
    const overlaps = (ax: number, ay: number, aw: number, ah: number,
                      bx: number, by: number, bw: number, bh: number): boolean => {
      return ax < bx + bw + M && ax + aw + M > bx &&
             ay < by + bh + M && ay + ah + M > by;
    };

    /** Bounding-box product of the current layout (used for improvement checks). */
    const bboxProduct = (): number => {
      let maxX = 0, maxY = 0;
      for (const p of bed.pieces) {
        const fx = (p.x ?? 0) + p.width;
        const fy = (p.y ?? 0) + p.height;
        if (fx > maxX) maxX = fx;
        if (fy > maxY) maxY = fy;
      }
      return Math.min(maxX + M, W) * Math.min(maxY + M, H);
    };

    let improved = true;
    while (improved) {
      improved = false;

      // Work on pieces sorted by rightmost edge descending — boundary pieces first
      const sorted = [...bed.pieces].sort(
        (a, b) => ((b.x ?? 0) + b.width) - ((a.x ?? 0) + a.width)
      );

      for (const piece of sorted) {
        const currentBbox = bboxProduct();
        let bestBbox = currentBbox;
        let bestX = piece.x!;
        let bestY = piece.y!;

        for (const q of bed.pieces) {
          if (q === piece) continue;

          const candidates: [number, number][] = [
            // On top of Q
            [q.x!, (q.y ?? 0) + q.height + M],
            // Right of Q
            [(q.x ?? 0) + q.width + M, q.y!],
          ];

          for (const [cx, cy] of candidates) {
            // Must stay inside the bed
            if (cx < M || cy < M) continue;
            if (cx + piece.width + M > W) continue;
            if (cy + piece.height + M > H) continue;

            // Must not overlap any other piece
            let collision = false;
            for (const other of bed.pieces) {
              if (other === piece) continue;
              if (overlaps(cx, cy, piece.width, piece.height,
                           other.x!, other.y!, other.width, other.height)) {
                collision = true;
                break;
              }
            }
            if (collision) continue;

            // Check if this reduces the bounding-box product
            const origX = piece.x!;
            const origY = piece.y!;
            piece.x = cx;
            piece.y = cy;
            const newBbox = bboxProduct();
            piece.x = origX;
            piece.y = origY;

            if (newBbox < bestBbox) {
              bestBbox = newBbox;
              bestX = cx;
              bestY = cy;
            }
          }
        }

        if (bestBbox < currentBbox) {
          console.log(`[COMPACT] Moved ${piece.id} from (${piece.x?.toFixed(1)}, ${piece.y?.toFixed(1)}) → (${bestX.toFixed(1)}, ${bestY.toFixed(1)})  bbox ${(currentBbox/1e6).toFixed(4)}→${(bestBbox/1e6).toFixed(4)} m²`);
          piece.x = bestX;
          piece.y = bestY;
          improved = true;
        }
      }
    }

    // Recompute bed metadata after compaction
    let maxUsedX = 0, maxUsedY = 0;
    for (const p of bed.pieces) {
      const farX = (p.x ?? 0) + p.width;
      const farY = (p.y ?? 0) + p.height;
      if (farX > maxUsedX) maxUsedX = farX;
      if (farY > maxUsedY) maxUsedY = farY;
    }
    const safeX = Math.min(maxUsedX + M, W);
    const safeY = Math.min(maxUsedY + M, H);

    bed.usedHeightMm = safeY;

    const rightArea: ReusableArea = {
      x: safeX, y: 0,
      width: Math.max(0, W - safeX), height: H,
      area: Math.max(0, W - safeX) * H,
      areaCm2: (Math.max(0, W - safeX) * H) / 100,
    };
    const bottomArea: ReusableArea = {
      x: 0, y: safeY,
      width: W, height: Math.max(0, H - safeY),
      area: W * Math.max(0, H - safeY),
      areaCm2: (W * Math.max(0, H - safeY)) / 100,
    };
    bed.reusableArea = rightArea.area >= bottomArea.area ? rightArea : bottomArea;

    const usedArea = bed.pieces.reduce((s, p) => s + p.width * p.height, 0);
    bed.efficiency = (usedArea / (W * H)) * 100;
  }

  /**
   * Extract piece positions from already-nested beds for visual rendering.
   */
  private buildBedVisualizations(beds: Bed[]): BedVisualization[] {
    return beds.map((bed, idx) => {
      const lerHeightMm = Math.max(0, TailorFitService.BED_HEIGHT - bed.usedHeightMm);

      // Recompute safeX from piece positions (same formula as nestPieces)
      let maxUsedX = 0;
      bed.pieces.forEach(p => {
        const farX = (p.x ?? 0) + p.width;
        if (farX > maxUsedX) maxUsedX = farX;
      });
      const usedWidthMm = Math.min(maxUsedX + TailorFitService.MARGIN, bed.width);
      const ler2WidthMm = Math.max(0, bed.width - usedWidthMm);
      const ler2AreaMm2 = ler2WidthMm * bed.height;

      // Union = LER1 + LER2 - overlap (the bottom-right corner counted twice)
      const overlapArea = ler2WidthMm * lerHeightMm;
      const lerUnionAreaMm2 = (bed.width * lerHeightMm) + ler2AreaMm2 - overlapArea;

      return {
        bedIndex:         idx + 1,
        widthMm:          bed.width,
        heightMm:         bed.height,
        usedHeightMm:     bed.usedHeightMm,
        usedWidthMm,
        lerHeightMm,
        lerAreaMm2:       bed.width * lerHeightMm,
        ler2WidthMm,
        ler2AreaMm2,
        lerUnionAreaMm2,
        pieces: bed.pieces.map(p => ({
          id:     p.id,
          x:      p.x ?? 0,
          y:      p.y ?? 0,
          width:  p.width,
          height: p.height,
        })),
      };
    });
  }
}
