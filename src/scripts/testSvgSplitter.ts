import * as fs from 'fs/promises';
import * as path from 'path';
import { splitPattern, splitAndSavePattern } from '../utils/svgSplitter';

/**
 * Test script for the SVG splitter utility
 */
async function main() {
  try {
    console.log('=== SVG Pattern Splitter Test ===\n');

    const args = process.argv.slice(2);
    const testNumber = args[0];
    const customInputPath = args[1];
    
    // Path to the test SVG file
    let inputSvgPath: string;
    
    if (customInputPath) {
      // Check if it's an absolute path or relative
      if (path.isAbsolute(customInputPath)) {
        inputSvgPath = customInputPath;
      } else {
        inputSvgPath = path.resolve(process.cwd(), customInputPath);
      }
    } else {
      inputSvgPath = path.join(
        __dirname,
        '../../src/freesewing/output/Brian body block - Tiago Huber - 20 nov 2025.svg'
      );
    }
    
    const baseFileName = path.basename(inputSvgPath, '.svg').replace(/\s+/g, '-').toLowerCase();
    
    console.log(`Reading SVG from: ${inputSvgPath}`);
    
    // Read the SVG file
    const svgContent = await fs.readFile(inputSvgPath, 'utf-8');
    
    console.log(`SVG file size: ${(svgContent.length / 1024).toFixed(2)} KB\n`);
    
    // Test 1: Split with default config (126cm x 86cm, paired mode)
    if (!testNumber || testNumber === '1' || testNumber === 'all') {
      console.log('--- Test 1: Paired Mode (Default) ---');
      console.log('Max size: 126cm x 86cm (1260mm x 860mm)');
      console.log('Pairing: Enabled\n');
      
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
    }
    
    // Test 2: Separate mode - each piece gets its own SVG
    if (!testNumber || testNumber === '2' || testNumber === 'all') {
      console.log('\n--- Test 2: Separate Mode ---');
      console.log('Max size: 126cm x 86cm (1260mm x 860mm)');
      console.log('Pairing: Disabled\n');
      
      const separateResult = splitPattern(svgContent, { pairingMode: 'separate' });
      
      console.log(`Total pieces after split: ${separateResult.totalPieces}\n`);
      
      separateResult.pieces.forEach((piece) => {
        const status = piece.isTiled ? '⚠️  TILED' : '✅ OK';
        console.log(`[${piece.printOrder}] ${piece.name}`);
        console.log(`    ${status} - ${piece.dimensions.width}mm x ${piece.dimensions.height}mm`);
        if (piece.tileInfo) {
          console.log(`    Tile ${piece.tileInfo.tileNumber} of ${piece.tileInfo.totalTiles}`);
        }
      });
    }
    
    // Test 3: Save split files to output directory
    if (!testNumber || testNumber === '3' || testNumber === 'all') {
      console.log('\n--- Test 3: Saving Split Files (Paired Mode) ---\n');
      
      const outputDir = path.join(__dirname, '../../src/freesewing/output/split-patterns');
      
      // Clear output directory
      console.log(`Clearing output directory...`);
      await fs.rm(outputDir, { recursive: true, force: true });
      await fs.mkdir(outputDir, { recursive: true });

      await splitAndSavePattern(
        svgContent,
        outputDir,
        baseFileName,
        {
          maxWidth: 1260,
          maxHeight: 860,
          margin: 10,
        }
      );
      
      console.log(`\n✅ All pieces saved to: ${outputDir}`);
    }
    
    // Test 4: Try with smaller constraints to force tiling
    if (!testNumber || testNumber === '4' || testNumber === 'all') {
      console.log('\n--- Test 4: Smaller Constraints (Force Tiling) ---');
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
    }

    // Test 5: Save split files (Separate Mode)
    if (!testNumber || testNumber === '5' || testNumber === 'all') {
      console.log('\n--- Test 5: Saving Split Files (Separate Mode) ---\n');
      
      const outputDir = path.join(__dirname, '../../src/freesewing/output/split-patterns');
      
      // Clear output directory
      console.log(`Clearing output directory...`);
      await fs.rm(outputDir, { recursive: true, force: true });
      await fs.mkdir(outputDir, { recursive: true });

      await splitAndSavePattern(
        svgContent,
        outputDir,
        `${baseFileName}-separate`,
        {
          maxWidth: 1260,
          maxHeight: 860,
          margin: 10,
          pairingMode: 'separate'
        }
      );
      
      console.log(`\n✅ All pieces saved to: ${outputDir}`);
    }

    // Test 6: Save split files (Paired Mode)
    if (!testNumber || testNumber === '6' || testNumber === 'all') {
      console.log('\n--- Test 6: Saving Split Files (Paired Mode) ---\n');
      
      const outputDir = path.join(__dirname, '../../src/freesewing/output/split-patterns');
      
      // Clear output directory
      console.log(`Clearing output directory...`);
      await fs.rm(outputDir, { recursive: true, force: true });
      await fs.mkdir(outputDir, { recursive: true });

      await splitAndSavePattern(
        svgContent,
        outputDir,
        `${baseFileName}-paired`,
        {
          maxWidth: 860,
          maxHeight: 1260,
          margin: 10,
          pairingMode: 'paired'
        }
      );
      
      console.log(`\n✅ All pieces saved to: ${outputDir}`);
    }
    
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
