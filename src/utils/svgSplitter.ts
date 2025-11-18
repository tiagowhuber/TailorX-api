import { parseHTML } from 'linkedom';

/**
 * Configuration for the SVG splitter
 */
interface SplitterConfig {
  maxWidth: number; // in mm
  maxHeight: number; // in mm
  margin: number; // margin to add around pieces in mm
}

/**
 * Represents a single pattern piece
 */
interface PatternPiece {
  id: string;
  name: string;
  groupElement: Element;
  boundingBox: BoundingBox;
  transform: TransformMatrix;
}

/**
 * Bounding box dimensions
 */
interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Transform matrix values
 */
interface TransformMatrix {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotate: number;
}

/**
 * A tile/subdivision of a pattern piece
 */
interface PieceTile {
  pieceId: string;
  pieceName: string;
  tileIndex: number;
  totalTiles: number;
  svg: string;
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * Final output with numbered pieces ready for printing
 */
interface SplitPatternResult {
  pieces: Array<{
    printOrder: number;
    id: string;
    name: string;
    svg: string;
    dimensions: {
      width: number;
      height: number;
    };
    isTiled: boolean;
    tileInfo?: {
      tileNumber: number;
      totalTiles: number;
    };
  }>;
  totalPieces: number;
  originalDimensions: {
    width: number;
    height: number;
  };
}

const DEFAULT_CONFIG: SplitterConfig = {
  maxWidth: 1260, // 126cm in mm
  maxHeight: 860, // 86cm in mm
  margin: 10, // 10mm margin
};

/**
 * Main function to split an SVG pattern into individual pieces
 * @param svgString - The complete SVG string from FreeSewing
 * @param config - Optional configuration for size constraints
 * @returns Split pattern result with numbered pieces
 */
export function splitPattern(
  svgString: string,
  config: Partial<SplitterConfig> = {}
): SplitPatternResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Parse the SVG
  const { document } = parseHTML(svgString);
  
  // Extract original dimensions
  const svgElement = document.querySelector('svg');
  if (!svgElement) {
    throw new Error('Invalid SVG: No root <svg> element found');
  }
  
  const originalDimensions = extractViewBoxDimensions(svgElement);
  
  // Extract all pattern pieces
  const patternPieces = extractPatternPieces(document);
  
  if (patternPieces.length === 0) {
    throw new Error('No pattern pieces found in SVG');
  }
  
  // Extract defs and styles for reuse
  const defs = extractDefs(document);
  const styles = extractStyles(document);
  
  // Process each piece and check if subdivision is needed
  const processedPieces: Array<{
    id: string;
    name: string;
    svg: string;
    dimensions: { width: number; height: number };
    isTiled: boolean;
    tileInfo?: { tileNumber: number; totalTiles: number };
  }> = [];
  
  for (const piece of patternPieces) {
    const pieceWidth = piece.boundingBox.width;
    const pieceHeight = piece.boundingBox.height;
    
    // Check if piece fits within constraints
    if (pieceWidth <= finalConfig.maxWidth && pieceHeight <= finalConfig.maxHeight) {
      // Piece fits - create single SVG
      const svg = createPieceSVG(piece, defs, styles, finalConfig.margin);
      processedPieces.push({
        id: piece.id,
        name: piece.name,
        svg,
        dimensions: {
          width: Math.round(pieceWidth * 10) / 10,
          height: Math.round(pieceHeight * 10) / 10,
        },
        isTiled: false,
      });
    } else {
      // Piece is too large - subdivide into tiles
      const tiles = subdividePiece(piece, defs, styles, finalConfig);
      for (const tile of tiles) {
        processedPieces.push({
          id: `${tile.pieceId}-tile-${tile.tileIndex}`,
          name: `${tile.pieceName} (Tile ${tile.tileIndex}/${tile.totalTiles})`,
          svg: tile.svg,
          dimensions: tile.dimensions,
          isTiled: true,
          tileInfo: {
            tileNumber: tile.tileIndex,
            totalTiles: tile.totalTiles,
          },
        });
      }
    }
  }
  
  // Add print order numbering
  const numberedPieces = processedPieces.map((piece, index) => ({
    printOrder: index + 1,
    ...piece,
  }));
  
  return {
    pieces: numberedPieces,
    totalPieces: numberedPieces.length,
    originalDimensions,
  };
}

/**
 * Extract viewBox dimensions from SVG element
 */
function extractViewBoxDimensions(svgElement: Element): { width: number; height: number } {
  const viewBox = svgElement.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number);
    const width = parts[2] || 0;
    const height = parts[3] || 0;
    return { width, height };
  }
  
  // Fallback to width/height attributes
  const width = parseFloat(svgElement.getAttribute('width') || '0');
  const height = parseFloat(svgElement.getAttribute('height') || '0');
  
  return { width, height };
}

/**
 * Extract all pattern pieces from the document
 */
function extractPatternPieces(document: Document): PatternPiece[] {
  const pieces: PatternPiece[] = [];
  
  // Find all groups with id starting with "fs-stack-"
  const container = document.querySelector('#fs-container');
  if (!container) {
    throw new Error('No fs-container found in SVG');
  }
  
  const stackGroups = container.querySelectorAll('[id^="fs-stack-"]');
  
  stackGroups.forEach((group) => {
    const id = group.getAttribute('id') || '';
    
    // Skip nested "-part-" groups as they're included in parent stack groups
    // We only want top-level pattern pieces (e.g., "fs-stack-brian.back", not "fs-stack-brian.back-part-brian.back")
    if (id.includes('-part-')) {
      return;
    }
    
    // Extract piece name from id (e.g., "fs-stack-brian.back" -> "back")
    const nameMatch = id.match(/fs-stack-[^.]+\.(.+)/);
    const name = nameMatch?.[1] || id;
    
    // Get transform
    const transform = parseTransform(group.getAttribute('transform') || '');
    
    // Calculate bounding box
    const boundingBox = calculateBoundingBox(group, transform);
    
    pieces.push({
      id,
      name,
      groupElement: group,
      boundingBox,
      transform,
    });
  });
  
  return pieces;
}

/**
 * Parse transform attribute to extract translation values
 */
function parseTransform(transformString: string): TransformMatrix {
  const result: TransformMatrix = {
    translateX: 0,
    translateY: 0,
    scaleX: 1,
    scaleY: 1,
    rotate: 0,
  };
  
  // Parse translate
  const translateMatch = transformString.match(/translate\(([-\d.]+)(?:,\s*([-\d.]+))?\)/);
  if (translateMatch) {
    result.translateX = parseFloat(translateMatch[1] || '0');
    result.translateY = parseFloat(translateMatch[2] || '0');
  }
  
  // Parse scale
  const scaleMatch = transformString.match(/scale\(([-\d.]+)(?:,\s*([-\d.]+))?\)/);
  if (scaleMatch) {
    result.scaleX = parseFloat(scaleMatch[1] || '1');
    result.scaleY = parseFloat(scaleMatch[2] || scaleMatch[1] || '1');
  }
  
  // Parse rotate
  const rotateMatch = transformString.match(/rotate\(([-\d.]+)/);
  if (rotateMatch) {
    result.rotate = parseFloat(rotateMatch[1] || '0');
  }
  
  return result;
}

/**
 * Calculate the bounding box of a group element
 */
function calculateBoundingBox(group: Element, transform: TransformMatrix): BoundingBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  // Find all path elements within the group
  const paths = group.querySelectorAll('path');
  
  paths.forEach((path) => {
    const d = path.getAttribute('d');
    if (!d) return;
    
    // Parse path data to extract coordinates
    const coords = extractPathCoordinates(d);
    
    // Get nested transform
    const nestedTransform = parseTransform(path.getAttribute('transform') || '');
    
    coords.forEach(({ x, y }) => {
      // Apply nested transform
      let transformedX = x * nestedTransform.scaleX + nestedTransform.translateX;
      let transformedY = y * nestedTransform.scaleY + nestedTransform.translateY;
      
      // Apply group transform
      transformedX = transformedX * transform.scaleX + transform.translateX;
      transformedY = transformedY * transform.scaleY + transform.translateY;
      
      minX = Math.min(minX, transformedX);
      minY = Math.min(minY, transformedY);
      maxX = Math.max(maxX, transformedX);
      maxY = Math.max(maxY, transformedY);
    });
  });
  
  // Also check text elements and other shapes
  const allElements = group.querySelectorAll('text, circle, rect, line');
  allElements.forEach((element) => {
    const box = getElementBounds(element, transform);
    if (box) {
      minX = Math.min(minX, box.minX);
      minY = Math.min(minY, box.minY);
      maxX = Math.max(maxX, box.maxX);
      maxY = Math.max(maxY, box.maxY);
    }
  });
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Extract coordinates from SVG path data
 */
function extractPathCoordinates(pathData: string): Array<{ x: number; y: number }> {
  const coords: Array<{ x: number; y: number }> = [];
  
  // Remove all command letters and split by spaces/commas
  const numbers = pathData
    .replace(/[a-zA-Z]/g, ' ')
    .split(/[\s,]+/)
    .filter((s) => s.length > 0)
    .map((s) => parseFloat(s))
    .filter((n) => !isNaN(n));
  
  // Extract x,y pairs
  for (let i = 0; i < numbers.length - 1; i += 2) {
    const x = numbers[i];
    const y = numbers[i + 1];
    if (x !== undefined && y !== undefined) {
      coords.push({ x, y });
    }
  }
  
  return coords;
}

/**
 * Get bounding box for non-path elements
 */
function getElementBounds(
  element: Element,
  transform: TransformMatrix
): BoundingBox | null {
  const tagName = element.tagName.toLowerCase();
  
  switch (tagName) {
    case 'text': {
      const x = parseFloat(element.getAttribute('x') || '0');
      const y = parseFloat(element.getAttribute('y') || '0');
      const transformedX = x * transform.scaleX + transform.translateX;
      const transformedY = y * transform.scaleY + transform.translateY;
      // Text has approximate size
      return {
        minX: transformedX,
        minY: transformedY - 10,
        maxX: transformedX + 50,
        maxY: transformedY + 10,
        width: 50,
        height: 20,
      };
    }
    case 'circle': {
      const cx = parseFloat(element.getAttribute('cx') || '0');
      const cy = parseFloat(element.getAttribute('cy') || '0');
      const r = parseFloat(element.getAttribute('r') || '0');
      const transformedCx = cx * transform.scaleX + transform.translateX;
      const transformedCy = cy * transform.scaleY + transform.translateY;
      return {
        minX: transformedCx - r,
        minY: transformedCy - r,
        maxX: transformedCx + r,
        maxY: transformedCy + r,
        width: r * 2,
        height: r * 2,
      };
    }
    case 'rect': {
      const x = parseFloat(element.getAttribute('x') || '0');
      const y = parseFloat(element.getAttribute('y') || '0');
      const width = parseFloat(element.getAttribute('width') || '0');
      const height = parseFloat(element.getAttribute('height') || '0');
      const transformedX = x * transform.scaleX + transform.translateX;
      const transformedY = y * transform.scaleY + transform.translateY;
      return {
        minX: transformedX,
        minY: transformedY,
        maxX: transformedX + width,
        maxY: transformedY + height,
        width,
        height,
      };
    }
    case 'line': {
      const x1 = parseFloat(element.getAttribute('x1') || '0');
      const y1 = parseFloat(element.getAttribute('y1') || '0');
      const x2 = parseFloat(element.getAttribute('x2') || '0');
      const y2 = parseFloat(element.getAttribute('y2') || '0');
      const tx1 = x1 * transform.scaleX + transform.translateX;
      const ty1 = y1 * transform.scaleY + transform.translateY;
      const tx2 = x2 * transform.scaleX + transform.translateX;
      const ty2 = y2 * transform.scaleY + transform.translateY;
      return {
        minX: Math.min(tx1, tx2),
        minY: Math.min(ty1, ty2),
        maxX: Math.max(tx1, tx2),
        maxY: Math.max(ty1, ty2),
        width: Math.abs(tx2 - tx1),
        height: Math.abs(ty2 - ty1),
      };
    }
    default:
      return null;
  }
}

/**
 * Extract <defs> element from document for reuse
 */
function extractDefs(document: Document): string {
  const defsElement = document.querySelector('defs');
  return defsElement ? defsElement.outerHTML : '';
}

/**
 * Extract <style> element from document for reuse
 */
function extractStyles(document: Document): string {
  const styleElement = document.querySelector('style');
  if (!styleElement) return '';
  
  // Get the raw text content to avoid HTML entity encoding issues
  let styleContent = styleElement.textContent || '';
  
  // Remove any existing CDATA wrappers if present
  styleContent = styleContent.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
  
  // Reconstruct the style element with proper CDATA wrapping
  return `<style type="text/css"><![CDATA[\n${styleContent}\n]]></style>`;
}

/**
 * Create an individual SVG for a pattern piece
 */
function createPieceSVG(piece: PatternPiece, defs: string, styles: string, margin: number): string {
  const { boundingBox } = piece;
  
  // Calculate new dimensions with margin
  const viewBoxWidth = boundingBox.width + margin * 2;
  const viewBoxHeight = boundingBox.height + margin * 2;
  
  // Clone the group element
  const clonedGroup = piece.groupElement.cloneNode(true) as Element;
  
  // Adjust transform to position piece at origin (0,0) with margin offset
  // Original transform places piece at its global position
  // We need to shift it so its bounding box min point is at (margin, margin)
  const currentTransform = piece.transform;
  const newTransformX = currentTransform.translateX - boundingBox.minX + margin;
  const newTransformY = currentTransform.translateY - boundingBox.minY + margin;
  
  clonedGroup.setAttribute(
    'transform',
    `translate(${newTransformX}, ${newTransformY})`
  );
  
  // Build the SVG with viewBox starting at 0,0
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink"
     class="freesewing"
     viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}"
     width="${viewBoxWidth}mm"
     height="${viewBoxHeight}mm">
  ${styles}
  ${defs}
  ${clonedGroup.outerHTML}
</svg>`;
  
  return svg;
}

/**
 * Subdivide a pattern piece into smaller tiles that fit within size constraints
 */
function subdividePiece(
  piece: PatternPiece,
  defs: string,
  styles: string,
  config: SplitterConfig
): PieceTile[] {
  const { boundingBox } = piece;
  const tiles: PieceTile[] = [];
  
  // Calculate how many tiles are needed
  const tilesX = Math.ceil(boundingBox.width / config.maxWidth);
  const tilesY = Math.ceil(boundingBox.height / config.maxHeight);
  const totalTiles = tilesX * tilesY;
  
  let tileIndex = 1;
  
  for (let row = 0; row < tilesY; row++) {
    for (let col = 0; col < tilesX; col++) {
      // Calculate tile boundaries in original coordinate space
      const tileMinX = boundingBox.minX + col * config.maxWidth;
      const tileMinY = boundingBox.minY + row * config.maxHeight;
      const tileMaxX = Math.min(tileMinX + config.maxWidth, boundingBox.maxX);
      const tileMaxY = Math.min(tileMinY + config.maxHeight, boundingBox.maxY);
      const tileWidth = tileMaxX - tileMinX;
      const tileHeight = tileMaxY - tileMinY;
      
      // Clone the group
      const clonedGroup = piece.groupElement.cloneNode(true) as Element;
      
      // Adjust transform to position this tile at origin with margin
      const currentTransform = piece.transform;
      const newTransformX = currentTransform.translateX - tileMinX + config.margin;
      const newTransformY = currentTransform.translateY - tileMinY + config.margin;
      
      clonedGroup.setAttribute(
        'transform',
        `translate(${newTransformX}, ${newTransformY})`
      );
      
      // Add viewBox clipping for this tile section
      const viewBoxWidth = tileWidth + config.margin * 2;
      const viewBoxHeight = tileHeight + config.margin * 2;
      
      // Add tile marker text
      const tileMarker = `
  <text x="${viewBoxWidth / 2}" y="20" 
        text-anchor="middle" 
        font-family="Arial, sans-serif" 
        font-size="14" 
        fill="#000000" 
        font-weight="bold">
    ${piece.name.toUpperCase()} - TILE ${tileIndex} of ${totalTiles}
  </text>
  <text x="${viewBoxWidth / 2}" y="40" 
        text-anchor="middle" 
        font-family="Arial, sans-serif" 
        font-size="10" 
        fill="#666666">
    Match edges with adjacent tiles
  </text>`;
      
      // Build tile SVG with viewBox starting at 0,0
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink"
     class="freesewing"
     viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}"
     width="${viewBoxWidth}mm"
     height="${viewBoxHeight}mm">
  ${styles}
  ${defs}
  ${clonedGroup.outerHTML}
  ${tileMarker}
</svg>`;
      
      tiles.push({
        pieceId: piece.id,
        pieceName: piece.name,
        tileIndex,
        totalTiles,
        svg,
        dimensions: {
          width: Math.round(tileWidth * 10) / 10,
          height: Math.round(tileHeight * 10) / 10,
        },
      });
      
      tileIndex++;
    }
  }
  
  return tiles;
}

/**
 * Convenience function to split and save SVG files to disk
 */
export async function splitAndSavePattern(
  svgString: string,
  outputDir: string,
  baseFileName: string,
  config?: Partial<SplitterConfig>
): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const result = splitPattern(svgString, config);
  
  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });
  
  // Save each piece
  for (const piece of result.pieces) {
    const fileName = `${baseFileName}-piece-${piece.printOrder}-${piece.name.replace(/\s+/g, '-')}.svg`;
    const filePath = path.join(outputDir, fileName);
    
    await fs.writeFile(filePath, piece.svg, 'utf-8');
    console.log(`Saved: ${fileName} (${piece.dimensions.width}mm x ${piece.dimensions.height}mm)`);
  }
  
  console.log(`\nTotal pieces generated: ${result.totalPieces}`);
  console.log(`Original pattern size: ${result.originalDimensions.width}mm x ${result.originalDimensions.height}mm`);
}
