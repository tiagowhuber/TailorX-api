/**
 * Mirrored Pattern Generator
 *
 * This script demonstrates how to generate a mirrored pattern using the
 * plugin-mirror and custom modification logic.
 */

import { Brian } from '@freesewing/brian'
import { pluginTheme as theme } from '@freesewing/plugin-theme'
import { pluginAnnotations as annotations } from '@freesewing/plugin-annotations'
import { pluginMirror as mirror } from '@freesewing/plugin-mirror'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Sample measurements
const measurements = {
  biceps: 387,
  chest: 1105,
  hpsToBust: 230,
  hpsToWaistBack: 502,
  neck: 420,
  shoulderSlope: 13,
  shoulderToShoulder: 481,
  waistToArmpit: 260,
  waistToHips: 139,
  shoulderToWrist: 600,
  wrist: 180,
}

// Pattern settings
const settings = {
  sa: 10, 
  complete: true, 
  paperless: true, 
  measurements,
}

// Create a custom class that mirrors the front part
class MirroredBrian extends Brian {
    draft() {
        super.draft();

        // Iterate over all sets (FreeSewing v3 supports multiple sets of settings, e.g. for grading)
        // usually there is just one set at index 0.
        for (const set in this.parts) {
            const parts = this.parts[set];
            
            // Note: Brian parts are namespaced as 'brian.front'
            if (parts['brian.front']) {
                const part = parts['brian.front'];
                // Define points to mirror around (Center Front)
                // Note: These points must exist in the drafted part
                const p1 = part.points.cfNeck;
                const p2 = part.points.cfHem;

                if (p1 && p2) {
                    console.log('Mirroring front part...');
                    part.macro('mirror', {
                        mirror: [p1, p2],
                        name: 'front'
                    });
                }
            }
        }
        
        return this;
    }
}

async function generatePattern() {
  try {
    console.log(' Generating Mirrored Pattern...')

    const pattern = new MirroredBrian(settings);
    
    pattern.use(theme);
    pattern.use(annotations);
    pattern.use(mirror); // Important: Register the mirror plugin

    pattern.draft();
    const svg = pattern.render();

    const outputDir = join(__dirname, 'output');
    try { mkdirSync(outputDir, { recursive: true }) } catch {}

    const filepath = join(outputDir, 'brian-mirrored.svg');
    writeFileSync(filepath, svg);

    console.log(` Saved to: ${filepath}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

generatePattern();
