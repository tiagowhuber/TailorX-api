import { parseHTML } from 'linkedom';
import { svgPathProperties } from 'svg-path-properties';
import potpack from 'potpack';
import JSZip from 'jszip';

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

interface Bed {
  pieces: PatternPiece[];
  efficiency: number;
  width: number;
  height: number;
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
  public async process(svgString: string): Promise<{ content: string | Buffer; mimeType: string; filename: string }> {
    console.log('\n========== STARTING SVG PROCESSING ==========');
    
    const pieces = this.parseSVG(svgString);
    console.log(`✓ Parsed ${pieces.length} valid pattern pieces from SVG\n`);
    
    const beds = this.nestPieces(pieces, TailorFitService.BED_WIDTH, TailorFitService.BED_HEIGHT);
    console.log(`\n✓ Nested pieces into ${beds.length} bed(s)`);
    
    if (beds.length === 0) {
        throw new Error("No valid pattern pieces found to process.");
    }

    // Log summary of all beds
    console.log('\n--- BED SUMMARY ---');
    beds.forEach((bed, index) => {
      console.log(`Bed ${index + 1}: ${bed.pieces.length} pieces, ${bed.efficiency.toFixed(2)}% efficiency`);
    });
    console.log('==========================================\n');

    // Generate output: single PLT file or ZIP archive with multiple PLT files
    if (beds.length === 1 && beds[0]) {
      const pltContent = this.convertToPLT(beds[0]);
      return {
        content: pltContent,
        mimeType: 'application/plt',
        filename: 'pattern.plt'
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
        filename: 'pattern_set.zip'
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
  public parseSVG(svgString: string): PatternPiece[] {
    console.log('[PARSE] Starting SVG parsing...');
    const { document } = parseHTML(svgString);
    const paths = document.querySelectorAll('path');
    const pieces: PatternPiece[] = [];

    console.log(`[PARSE] Found ${paths.length} total <path> elements in SVG`);
    let idCounter = 0;
    
    Array.from(paths).forEach((path: any, index) => {
      const classAttr = path.getAttribute('class') || '';
      const idStr = path.getAttribute('id') || `path_${index}`;

      // Filter 1: Only accept 'fabric sa' (fabric with seam allowance)
      if (!classAttr.includes('fabric sa')) {
        console.log(`[SVG Debug] Ignored ${idStr} (Not 'fabric sa'. path_class: "${classAttr}")`);
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

      const d = path.getAttribute('d');
      if (!d) {
        console.log(`[SVG Debug] Ignored ${idStr} (No d attribute)`);
        return;
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
      
      console.log(`\n[NEST] Bed ${beds.length + 1} Complete:`);
      console.log(`  └─ Pieces fitted: ${currentBedPieces.length}`);
      console.log(`  └─ Area used: ${(usedArea / 1000000).toFixed(4)} m² (${(usedArea / 100).toFixed(2)} cm²)`);
      console.log(`  └─ Area wasted: ${(wastedArea / 1000000).toFixed(4)} m² (${(wastedArea / 100).toFixed(2)} cm²)`);
      console.log(`  └─ Efficiency: ${efficiency.toFixed(2)}%`);
      console.log(`  └─ Remaining pieces: ${nextRemaining.length}`);

      beds.push({
        pieces: currentBedPieces,
        efficiency,
        width: bedWidth,
        height: bedHeight
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
}
