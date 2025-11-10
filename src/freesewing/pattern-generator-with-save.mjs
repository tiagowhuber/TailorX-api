/**
 * FreeSewing Pattern Generator with File Output
 *
 * This script generates a pattern and saves it to an SVG file.
 * You can customize the design, measurements, and settings.
 */

import { Brian } from '@freesewing/brian'
import { pluginTheme as theme } from '@freesewing/plugin-theme'
import { pluginAnnotations as annotations } from '@freesewing/plugin-annotations'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Sample measurements (in millimeters)
// Replace these with actual measurements
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
  sa: 10, // Seam allowance in mm (0 for no seam allowance)
  complete: true, // Generate complete pattern with all details
  paperless: true, // Set to true for a paperless pattern (with dimensions)
  measurements, // Pass in the measurements
}

async function generatePattern() {
  try {
    console.log(' FreeSewing Pattern Generator')
    console.log('=' .repeat(50))
    console.log('\n Using measurements:')
    Object.entries(measurements).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}mm`)
    })

    console.log('\n  Pattern settings:')
    console.log(`   Seam allowance: ${settings.sa}mm`)
    console.log(`   Complete: ${settings.complete}`)
    console.log(`   Paperless: ${settings.paperless}`)

    console.log('\n Generating pattern...')

    // Generate the pattern
    const svg = new Brian(settings)
      .use(theme) // Load theme plugin for styled SVG
      .use(annotations) // Load annotations plugin for paperless mode (measurements)
      .draft() // Draft the pattern
      .render() // Render to SVG

    // Create output directory if it doesn't exist
    const outputDir = join(__dirname, 'output')
    try {
      mkdirSync(outputDir, { recursive: true })
    } catch {
      // Directory might already exist
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const filename = `brian-pattern-${timestamp}.svg`
    const filepath = join(outputDir, filename)

    // Save the SVG file
    writeFileSync(filepath, svg)

    console.log('\n Pattern generated successfully!')
    console.log(` Saved to: ${filepath}`)
    console.log(` File size: ${(svg.length / 1024).toFixed(2)} KB`)
    console.log('\n Tip: Open the SVG file in a browser or SVG viewer to see your pattern!')

  } catch (error) {
    console.error('\n Error generating pattern:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Run the generator
generatePattern()
