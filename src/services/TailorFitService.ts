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
  bedIndex: number;       // 1-based
  widthMm: number;
  heightMm: number;
  usedHeightMm: number;   // safeY — where pieces end
  lerHeightMm: number;   // BED_HEIGHT - usedHeightMm
  lerAreaMm2: number;
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
   * Nest pattern pieces onto one or more cutting beds using bin-packing algorithm.
   * 
   * Algorithm:
   * 1. Pre-rotate pieces so longest dimension is horizontal
   * 2. Sort by area (largest first) for better packing
   * 3. Use greedy bin-packing (potpack) to fit pieces onto beds
   * 4. Create new bed when pieces don't fit on current bed
   * 
   * @param pieces - Array of pattern pieces to nest
   * @param bedWidth - Width of cutting bed in mm
   * @param bedHeight - Height of cutting bed in mm
   * @returns Array of beds, each containing fitted pieces and efficiency metrics
   */
  public nestPieces(pieces: PatternPiece[], bedWidth: number, bedHeight: number): Bed[] {
    console.log(`[NEST] Starting nesting process...`);
    console.log(`[NEST] Bed dimensions: ${bedWidth}mm × ${bedHeight}mm (${(bedWidth * bedHeight / 1000000).toFixed(2)} m²)`);
    console.log(`[NEST] Margin between pieces: ${TailorFitService.MARGIN}mm\n`);
    
    // Pre-rotate pieces to align longest side with X axis (width)
    console.log('[NEST] Pre-processing pieces (rotate & normalize)...');
    pieces.forEach(p => {
      const bbox = this.calculateBBox(p.points);
      if (bbox.height > bbox.width) {
        console.log(`  └─ Rotating ${p.id} 90° (was ${bbox.width.toFixed(1)}×${bbox.height.toFixed(1)}mm)`);
        this.rotatePiece(p, 90);
      }
      // Normalize position to 0,0 relative to bbox
      this.normalizePiece(p);
    });

    // Sort by height descending (best for shelf packing FFDH)
    // Minimizing total height is our goal if we fill width first
    console.log('[NEST] Sorting pieces by height (tallest first)...');
    const sortedPieces = [...pieces].sort((a, b) => b.height - a.height);
    
    const beds: Bed[] = [];
    let remainingPieces = sortedPieces;

    while (remainingPieces.length > 0) {
      console.log(`\n[NEST] --- Creating Bed ${beds.length + 1} ---`);
      console.log(`[NEST] Attempting to fit ${remainingPieces.length} remaining piece(s)...`);
      
      const currentBedPieces: PatternPiece[] = [];
      const nextRemaining: PatternPiece[] = [];
      
      // Shelf Packing Algorithm (First-Fit Decreasing Height)
      // Shelves fill along BED_WIDTH (X-axis) and stack along BED_HEIGHT (Y-axis)
      interface Shelf {
        y: number;
        height: number;
        remainingWidth: number;
      }
      
      const shelves: Shelf[] = [];
      let currentY = TailorFitService.MARGIN;
      
      for (const piece of remainingPieces) {
        // Find the first shelf where the piece fits
        let placed = false;
        
        // Piece dimensions including margin
        const pWidth = piece.width + TailorFitService.MARGIN;
        const pHeight = piece.height + TailorFitService.MARGIN;

        // Try existing shelves
        for (const shelf of shelves) {
           // We can place it if width fits.
           // Since we sorted by height, the new piece height is <= shelf height (determined by first piece in shelf).
           // So vertical fit is guaranteed within the shelf.
           if (pWidth <= shelf.remainingWidth) {
               piece.x = TailorFitService.BED_WIDTH - shelf.remainingWidth + TailorFitService.MARGIN; // Apply margin offset? 
               // Wait: bed width = 2500.
               // remainingWidth starts at 2500.
               // x = 2500 - 2500 = 0? (If Margin is outside).
               // Let's refine coordinate logic:
               // remainingWidth starts at BedWidth - Margin (if there's a margin at x=0).
               // Yes, we want margin at x=0.
               
               // Logic above needs correction:
               // Initial remainingWidth = BedWidth - Margin.
               // X position = BedWidth - remainingWidth. (This puts it at Margin).
               // Correct.
               
               // But shelf.remainingWidth logic must be consistent.
               // Initial shelf logic needs to be correct.
               
               piece.x = (TailorFitService.BED_WIDTH - shelf.remainingWidth); 
               // For first piece: 2500 - (2500 - 10) = 10. Correct.
               
               piece.y = shelf.y;
               
               shelf.remainingWidth -= pWidth;
               placed = true;
               break;
           }
        }
        
        // If not placed, try to open a new shelf
        if (!placed) {
            // Check if we have vertical space
            // Need margin at bottom? usually yes.
            if (currentY + pHeight <= TailorFitService.BED_HEIGHT) {
                const newShelf: Shelf = {
                    y: currentY,
                    height: pHeight,
                    remainingWidth: TailorFitService.BED_WIDTH - TailorFitService.MARGIN - pWidth 
                    // Initial free space: Width - Margin(Start) - PieceWidth - Margin(End)? 
                    // PieceWidth includes Margin(Right).
                    // So we subtract pWidth.
                    // X = MARGIN.
                };
                
                piece.x = TailorFitService.MARGIN;
                piece.y = currentY;
                
                shelves.push(newShelf);
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

      // Calculate bed utilization efficiency
      const usedArea = currentBedPieces.reduce((sum, p) => sum + (p.width * p.height), 0);
      const totalArea = bedWidth * bedHeight;
      const wastedArea = totalArea - usedArea;
      const efficiency = (usedArea / totalArea) * 100;

      // Calculate Reusable Area (Biggest Rectangular Area)
      // We calculate the bounding box of all fitted pieces
      let maxUsedX = 0;
      let maxUsedY = 0;
      
      currentBedPieces.forEach(p => {
        // Pieces already have x, y set relative to bed origin (0,0)
        // Add width/height to get the far edge
        const farX = (p.x || 0) + p.width;
        const farY = (p.y || 0) + p.height;
        if (farX > maxUsedX) maxUsedX = farX;
        if (farY > maxUsedY) maxUsedY = farY;
      });

      // Add appropriate margins to define the "safe" cut line
      // We add MARGIN to ensure we don't cut into the pieces' clearance zone
      const safeX = Math.min(maxUsedX + TailorFitService.MARGIN, bedWidth);
      const safeY = Math.min(maxUsedY + TailorFitService.MARGIN, bedHeight);

      // Strategy: Check two main potential rectangles
      // 1. Right side (Full height, starting after used X)
      const rightArea: ReusableArea = {
        x: safeX,
        y: 0,
        width: Math.max(0, bedWidth - safeX),
        height: bedHeight,
        area: Math.max(0, bedWidth - safeX) * bedHeight,
        areaCm2: (Math.max(0, bedWidth - safeX) * bedHeight) / 100
      };

      // 2. Bottom side (Full width, starting after used Y)
      const bottomArea: ReusableArea = {
        x: 0,
        y: safeY,
        width: bedWidth,
        height: Math.max(0, bedHeight - safeY),
        area: bedWidth * Math.max(0, bedHeight - safeY),
        areaCm2: (bedWidth * Math.max(0, bedHeight - safeY)) / 100
      };

      // Select the larger one
      const bestReusable = rightArea.area >= bottomArea.area ? rightArea : bottomArea;
      
      console.log(`\n[NEST] Bed ${beds.length + 1} Complete:`);
      console.log(`  └─ Pieces fitted: ${currentBedPieces.length}`);
      console.log(`  └─ Area used: ${(usedArea / 1000000).toFixed(4)} m² (${(usedArea / 100).toFixed(2)} cm²)`);
      console.log(`  └─ Area wasted: ${(wastedArea / 1000000).toFixed(4)} m² (${(wastedArea / 100).toFixed(2)} cm²)`);
      console.log(`  └─ Efficiency: ${efficiency.toFixed(2)}%`);
      console.log(`  └─ Reusable Area: ${bestReusable.width.toFixed(1)}×${bestReusable.height.toFixed(1)}mm (${bestReusable.areaCm2.toFixed(2)} cm²)`);
      console.log(`  └─ Remaining pieces: ${nextRemaining.length}`);

      beds.push({
        pieces: currentBedPieces,
        efficiency,
        width: bedWidth,
        height: bedHeight,
        reusableArea: bestReusable,
        usedHeightMm: safeY
      });

      remainingPieces = nextRemaining;
      
      // Safety: Prevent infinite loop if a piece is too large for the bed
      if (currentBedPieces.length === 0 && remainingPieces.length > 0) {
        const oversizedPiece = remainingPieces[0];
        if (oversizedPiece) {
          console.warn(`\n⚠️  WARNING: ${oversizedPiece.id} is too large for bed!`);
          console.warn(`   Piece size: ${oversizedPiece.width.toFixed(1)}×${oversizedPiece.height.toFixed(1)}mm`);
          console.warn(`   Bed size: ${bedWidth}×${bedHeight}mm`);
          console.warn(`   This piece will be SKIPPED.\n`);
          remainingPieces.shift(); // Remove it to avoid infinite loop
        }
      }
    }

    console.log(`\n[NEST] ✓ Nesting complete: ${beds.length} bed(s) created\n`);
    return beds;
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
  public nestPiecesUnoptimized(pieces: PatternPiece[], bedWidth: number, bedHeight: number): Bed[] {
    const beds: Bed[] = [];
    let currentBedPieces: PatternPiece[] = [];

    // Column state
    let colX      = TailorFitService.MARGIN; // left edge of the current column
    let colWidth  = 0;                       // widest piece placed in the current column
    let currentY  = TailorFitService.MARGIN; // next Y position within the column

    const finalizeBed = () => {
      if (currentBedPieces.length === 0) return;

      let maxUsedX = 0;
      let maxUsedY = 0;
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
      const bestReusable = rightArea.area >= bottomArea.area ? rightArea : bottomArea;

      const usedArea = currentBedPieces.reduce((s, p) => s + p.width * p.height, 0);
      const efficiency = (usedArea / (bedWidth * bedHeight)) * 100;

      beds.push({
        pieces: currentBedPieces,
        efficiency,
        width: bedWidth,
        height: bedHeight,
        reusableArea: bestReusable,
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
      // Normalize to (0,0) so width/height are stable
      this.normalizePiece(piece);

      // Skip pieces that are wider or taller than the whole bed
      if (piece.width + TailorFitService.MARGIN * 2 > bedWidth ||
          piece.height + TailorFitService.MARGIN * 2 > bedHeight) {
        console.warn(`[UNOPT] Skipping oversized piece ${piece.id}: ${piece.width.toFixed(1)}×${piece.height.toFixed(1)}mm`);
        continue;
      }

      // If piece overflows current column vertically, try to open a new column
      if (currentY + piece.height + TailorFitService.MARGIN > bedHeight) {
        const nextColX = colX + colWidth + TailorFitService.MARGIN;

        // If the new column also overflows the bed horizontally, finalize bed and start fresh
        if (nextColX + piece.width + TailorFitService.MARGIN > bedWidth) {
          finalizeBed();
          resetBed();
        } else {
          // Advance to next column on the same bed
          colX     = nextColX;
          colWidth = 0;
          currentY = TailorFitService.MARGIN;
        }
      }

      piece.x = colX;
      piece.y = currentY;

      // Track the widest piece in this column
      if (piece.width > colWidth) colWidth = piece.width;

      currentY += piece.height + TailorFitService.MARGIN;
      currentBedPieces.push(piece);
    }

    finalizeBed();
    return beds;
  }

  /**
   * Extract piece positions from already-nested beds for visual rendering.
   */
  private buildBedVisualizations(beds: Bed[]): BedVisualization[] {
    return beds.map((bed, idx) => {
      const lerHeightMm = Math.max(0, TailorFitService.BED_HEIGHT - bed.usedHeightMm);
      return {
        bedIndex:    idx + 1,
        widthMm:     bed.width,
        heightMm:    bed.height,
        usedHeightMm: bed.usedHeightMm,
        lerHeightMm,
        lerAreaMm2:  bed.width * lerHeightMm,
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
