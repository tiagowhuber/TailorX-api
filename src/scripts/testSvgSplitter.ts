import * as fs from 'fs/promises';
import * as path from 'path';
import { splitPattern, splitAndSavePattern } from '../utils/svgSplitter';

/**
 * Test script for the SVG splitter utility
 */
async function main() {
  try {
    console.log('=== SVG Pattern Splitter Test ===\n');
    
    // Path to the test SVG file
    const inputSvgPath = path.join(
      __dirname,
      '../../src/freesewing/output/Brian body block - Tiago Huber - 13 nov 2025.svg'
    );
    
    console.log(`Reading SVG from: ${inputSvgPath}`);
    
    // Read the SVG file
    const svgContent = await fs.readFile(inputSvgPath, 'utf-8');
    
    console.log(`SVG file size: ${(svgContent.length / 1024).toFixed(2)} KB\n`);
    
    // Test 1: Split with default config (126cm x 86cm)
    console.log('--- Test 1: Default Configuration ---');
    console.log('Max size: 126cm x 86cm (1260mm x 860mm)\n');
    
    const result = splitPattern(svgContent);
    
    console.log(`Original pattern dimensions: ${result.originalDimensions.width}mm x ${result.originalDimensions.height}mm`);
    console.log(`Total pieces after split: ${result.totalPieces}\n`);
    
    result.pieces.forEach((piece) => {
      const status = piece.isTiled ? '⚠️  TILED' : '✅ OK';
      console.log(`[${piece.printOrder}] ${piece.name}`);
      console.log(`    ${status} - ${piece.dimensions.width}mm x ${piece.dimensions.height}mm`);
      if (piece.tileInfo) {
        console.log(`    Tile ${piece.tileInfo.tileNumber} of ${piece.tileInfo.totalTiles}`);
      }
    });
    
    // Test 2: Save split files to output directory
    console.log('\n--- Test 2: Saving Split Files ---\n');
    
    const outputDir = path.join(__dirname, '../../src/freesewing/output/split-patterns');
    
    await splitAndSavePattern(
      svgContent,
      outputDir,
      'brian-body-block',
      {
        maxWidth: 1260,
        maxHeight: 860,
        margin: 10,
      }
    );
    
    console.log(`\n✅ All pieces saved to: ${outputDir}`);
    
    // Test 3: Try with smaller constraints to force tiling
    console.log('\n--- Test 3: Smaller Constraints (Force Tiling) ---');
    console.log('Max size: 50cm x 50cm (500mm x 500mm)\n');
    
    const smallResult = splitPattern(svgContent, {
      maxWidth: 500,
      maxHeight: 500,
      margin: 5,
    });
    
    console.log(`Total pieces with smaller constraint: ${smallResult.totalPieces}`);
    
    const tiledCount = smallResult.pieces.filter((p) => p.isTiled).length;
    console.log(`Tiled pieces: ${tiledCount}`);
    console.log(`Non-tiled pieces: ${smallResult.totalPieces - tiledCount}`);
    
    console.log('\n=== Test Complete ===');
  } catch (error) {
    console.error('Error during test:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
main();
