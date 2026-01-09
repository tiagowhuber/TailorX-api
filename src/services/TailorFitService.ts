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

export class TailorFitService {
  private static readonly BED_WIDTH = 2500; // mm
  private static readonly BED_HEIGHT = 1300; // mm
  private static readonly MARGIN = 10; // mm
  private static readonly PLT_SCALE = 40; // units/mm
  private static readonly FLATTEN_STEP = 1; // mm

  /**
   * Process SVG and return PLT content (string or Buffer)
   */
  public async process(svgString: string): Promise<{ content: string | Buffer; mimeType: string; filename: string }> {
    console.log('Starting SVG processing...');
    const pieces = this.parseSVG(svgString);
    console.log(`Parsed ${pieces.length} pieces from SVG.`);
    
    const beds = this.nestPieces(pieces, TailorFitService.BED_WIDTH, TailorFitService.BED_HEIGHT);
    console.log(`Nested pieces into ${beds.length} beds.`);
    
    if (beds.length === 0) {
        throw new Error("No valid pattern pieces found to process.");
    }

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

  public parseSVG(svgString: string): PatternPiece[] {
    const { document } = parseHTML(svgString);
    const paths = document.querySelectorAll('path');
    const pieces: PatternPiece[] = [];

    let idCounter = 0;
    Array.from(paths).forEach((path: any, index) => {
      const classAttr = path.getAttribute('class') || '';
      const idStr = path.getAttribute('id') || `path_${index}`;

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
      
      console.log(`[SVG Debug] Accepted ${idStr} (Class: "${classAttr}", Points: ${points.length})`);
      
      pieces.push({
        id: `piece_${idCounter++}`,
        originalPoints: points,
        points: points, // Initially same as original
        width: bbox.width,
        height: bbox.height,
        rotation: 0
      });
    });

    return pieces;
  }

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

  private hasIgnoredClass(element: any): boolean {
    const ignoredTerms = [
        'grainline', 'note', 'mark', 'text', 'annotation', 'notch', 'cutonfold', 
        'title', 'logo', 'scalebox', 'dimension', 'paperless', 'grid', 'layout',
        'help', 'interface', 'sa', 'contrast', 'hidden'
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

  private shouldIgnore(className: string): boolean {
    // Deprecated, logic moved to hasIgnoredClass
    return false;
  }

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

  public nestPieces(pieces: PatternPiece[], bedWidth: number, bedHeight: number): Bed[] {
    // Pre-rotate pieces to align longest side with X axis (width)
    pieces.forEach(p => {
      const bbox = this.calculateBBox(p.points);
      if (bbox.height > bbox.width) {
        this.rotatePiece(p, 90);
      }
      // Normalize position to 0,0 relative to bbox
      this.normalizePiece(p);
    });

    // Sort by area descending
    const sortedPieces = [...pieces].sort((a, b) => (b.width * b.height) - (a.width * a.height));
    
    const beds: Bed[] = [];
    let remainingPieces = sortedPieces;

    while (remainingPieces.length > 0) {
      const currentBedPieces: PatternPiece[] = [];
      const nextRemaining: PatternPiece[] = [];

      // Try to fit pieces into current bed
      // We use a greedy approach with potpack
      // Since potpack packs everything given, we need to iteratively add pieces
      // and check if they fit.
      
      // Optimization: We can't easily "add one by one" efficiently with potpack because
      // it repacks everything. But for < 100 pieces it's fast.
      
      // However, we need to know WHICH pieces fit.
      // Strategy:
      // 1. Take all remaining pieces.
      // 2. Try to pack them all.
      // 3. If they fit, great.
      // 4. If not, remove the last one (or the one that makes it expand beyond bounds) and retry?
      // Potpack doesn't tell us which one caused expansion.
      
      // Alternative Strategy:
      // Add pieces one by one. If adding a piece exceeds bounds, skip it for this bed.
      
      const boxes: any[] = []; // For potpack
      
      for (const piece of remainingPieces) {
        // Add padding for margins
        // We add MARGIN to width and height.
        // This accounts for the gap between pieces.
        // For the edge of the bed, we will check against (BedSize - MARGIN).
        
        const box = {
          w: piece.width + TailorFitService.MARGIN,
          h: piece.height + TailorFitService.MARGIN,
          piece: piece
        };
        
        // Try packing with this new box
        const testBoxes = [...boxes, box];
        const { w, h } = potpack(testBoxes);
        
        // Check if fits in bed (considering the outer margins)
        // The packed width 'w' is the total width occupied.
        // We need 'w' <= bedWidth - TailorFitService.MARGIN
        // (Because the last piece has +MARGIN, so its right edge is at pos + w_piece + MARGIN.
        //  Wait, potpack returns the container size.
        //  If we use w+MARGIN for each piece, the container size will be Sum(w_i + margin) roughly.
        //  The rightmost edge of the content is 'w'.
        //  We need to ensure that we can place this content into the bed with 10mm margin on all sides.
        //  So we need 10mm left, 10mm top.
        //  So max width available is BedWidth - 10 - 10?
        //  Wait, if we included the margin in the piece size (w+10), then the piece effectively carries its right/bottom margin.
        //  So we only need to worry about Left/Top margin of the bed.
        //  So available space is BedWidth - 10.
        //  Let's verify:
        //  Piece at x=0. Real pos = x+10.
        //  Piece width = pw.
        //  Real end = x+10+pw.
        //  Packed box width = pw+10.
        //  Packed end = x + (pw+10).
        //  So Real end = Packed end.
        //  So if Packed end <= BedWidth, we are good?
        //  Wait. Real end = x + 10 + pw.
        //  Packed end = x + pw + 10.
        //  Yes.
        //  So we just need w <= BedWidth - 10?
        //  Wait. If Packed end = BedWidth.
        //  Real end = BedWidth.
        //  So we have 0 margin on right?
        //  Yes.
        //  So we need w <= BedWidth - 10 to have 10mm margin on right.
        //  So effective max width = BedWidth - 10.
        
        if (w <= (bedWidth - TailorFitService.MARGIN) && h <= (bedHeight - TailorFitService.MARGIN)) {
          boxes.push(box);
          currentBedPieces.push(piece);
        } else {
          nextRemaining.push(piece);
        }
      }
      
      // After filling the bed, we need to update the pieces with their calculated coordinates
      // potpack modifies the boxes array, adding x and y
      boxes.forEach((box: any) => {
        // box.piece is the reference
        // box.x, box.y are the positions
        // We need to apply the bed offset (10mm, 10mm)
        box.piece.x = box.x + TailorFitService.MARGIN;
        box.piece.y = box.y + TailorFitService.MARGIN;
      });

      // Calculate efficiency
      const usedArea = currentBedPieces.reduce((sum, p) => sum + (p.width * p.height), 0);
      const totalArea = bedWidth * bedHeight;
      const efficiency = (usedArea / totalArea) * 100;
      
      console.log(`Bed ${beds.length + 1} Efficiency: ${efficiency.toFixed(2)}%`);

      beds.push({
        pieces: currentBedPieces,
        efficiency,
        width: bedWidth,
        height: bedHeight
      });

      remainingPieces = nextRemaining;
      
      // Safety break to prevent infinite loop if a piece is too big
      if (currentBedPieces.length === 0 && remainingPieces.length > 0) {
        const pieceId = remainingPieces[0]?.id || 'unknown';
        console.warn("Found piece larger than bed dimensions:", pieceId);
        // Force add it or skip it?
        // Requirement: "Warn if any individual piece exceeds bed dimensions"
        // We'll skip it to avoid infinite loop and log warning
        remainingPieces.shift(); 
      }
    }

    return beds;
  }

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

  public rotatePiece(piece: PatternPiece, angle: number) {
    // Rotate points around 0,0 (or center? BBox center?)
    // Easier to rotate around 0,0 then re-normalize
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    piece.points = piece.points.map(p => ({
      x: p.x * cos - p.y * sin,
      y: p.x * sin + p.y * cos
    }));
    
    piece.rotation = (piece.rotation + angle) % 360;
    this.normalizePiece(piece);
  }

  public convertToPLT(bed: Bed): string {
    const commands: string[] = [];
    commands.push('IN;SP1;'); // Initialize, Select Pen 1

    for (const piece of bed.pieces) {
      if (piece.x === undefined || piece.y === undefined) continue;
      
      const offsetX = piece.x;
      const offsetY = piece.y;

      // Move to first point
      if (piece.points.length > 0) {
        const start = piece.points[0];
        if (start) {
            const sx = Math.round((start.x + offsetX) * TailorFitService.PLT_SCALE);
            const sy = Math.round((start.y + offsetY) * TailorFitService.PLT_SCALE);
            commands.push(`PU${sx},${sy};`);
            
            // Cut remaining points
            commands.push('PD');
            const coords = piece.points.slice(1).map(p => {
              const x = Math.round((p.x + offsetX) * TailorFitService.PLT_SCALE);
              const y = Math.round((p.y + offsetY) * TailorFitService.PLT_SCALE);
              return `${x},${y}`;
            }).join(',');
            commands.push(`${coords};`);
            
            commands.push('PU;'); // Pen Up
        }
      }
    }

    commands.push('PU0,0;SP0;'); // Park pen
    return commands.join('\n');
  }
}
