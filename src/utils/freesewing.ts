/**
 * FreeSewing Pattern Generation Utilities
 * 
 * Handles transformation of database measurements to FreeSewing format
 * and dynamic pattern generation for different FreeSewing patterns.
 */

// Use require for FreeSewing packages to avoid TypeScript module resolution issues
const Aaron = require('@freesewing/aaron').Aaron;
const theme = require('@freesewing/plugin-theme').pluginTheme;

// Import model types
//import type MeasurementType from '../models/MeasurementType';
import type UserMeasurement from '../models/UserMeasurement';
import type DesignMeasurement from '../models/DesignMeasurement';

interface FreeSewingMeasurements {
  [key: string]: number
}

interface PatternSettings {
  sa?: number
  complete?: boolean
  paperless?: boolean
  measurements?: FreeSewingMeasurements
  [key: string]: any
}

interface GeneratePatternOptions {
  patternType: string
  measurements: FreeSewingMeasurements
  settings?: PatternSettings
}

interface GeneratePatternResult {
  svg: string
  sizeKb: number
}

/**
 * Transform database user measurements to FreeSewing format
 * 
 * @param userMeasurements - Array of user measurements from database
 * @returns Object with freesewing_key as keys and values in mm
 */
export function transformMeasurementsForFreeSewing(
  userMeasurements: UserMeasurement[]
): FreeSewingMeasurements {
  const transformed: FreeSewingMeasurements = {}

  for (const measurement of userMeasurements) {
    const freesewingKey = measurement.measurementType?.freesewing_key
    
    if (freesewingKey) {
      // FreeSewing expects measurements in mm as numbers
      // Convert to number in case DB returns string
      transformed[freesewingKey] = Number(measurement.value)
    }
  }

  console.log('Transformed measurements for FreeSewing:', transformed)
  return transformed
}

/**
 * Validate that all required measurements are present
 * 
 * @param userMeasurements - User's measurements in FreeSewing format
 * @param requiredKeys - Array of required FreeSewing measurement keys
 * @returns Object with isValid flag and array of missing keys
 */
export function validateRequiredMeasurements(
  userMeasurements: FreeSewingMeasurements,
  requiredKeys: string[]
): { isValid: boolean; missing: string[] } {
  const missing: string[] = []

  for (const key of requiredKeys) {
    if (!(key in userMeasurements) || userMeasurements[key] === null || userMeasurements[key] === undefined) {
      missing.push(key)
    }
  }

  return {
    isValid: missing.length === 0,
    missing
  }
}

/**
 * Get the FreeSewing pattern class based on pattern type
 * 
 * @param patternType - Name of the FreeSewing pattern (e.g., 'aaron', 'brian')
 * @returns Pattern constructor class
 * @throws Error if pattern type is not supported
 */
function getPatternClass(patternType: string) {
  const patterns: { [key: string]: any } = {
    aaron: Aaron,
    // Add more patterns as they are installed:
    // brian: require('@freesewing/brian').Brian,
    // bella: require('@freesewing/bella').Bella,
    // etc.
  }

  const PatternClass = patterns[patternType.toLowerCase()]
  
  if (!PatternClass) {
    throw new Error(`Unsupported pattern type: ${patternType}. Available patterns: ${Object.keys(patterns).join(', ')}`)
  }

  return PatternClass
}

/**
 * Generate a FreeSewing pattern and return SVG string
 * 
 * @param options - Pattern generation options
 * @returns Object with SVG string and size in KB
 * @throws Error if pattern generation fails
 */
export async function generateFreeSewingPattern(
  options: GeneratePatternOptions
): Promise<GeneratePatternResult> {
  const { patternType, measurements, settings = {} } = options

  try {
    // Get the appropriate pattern class
    const PatternClass = getPatternClass(patternType)

    // Merge measurements into settings
    const patternSettings: PatternSettings = {
      ...settings,
      measurements
    }

    // Generate the pattern
    const svg = new PatternClass(patternSettings)
      .use(theme) // Load theme plugin for styled SVG
      .draft() // Draft the pattern
      .render() // Render to SVG string

    // Calculate size in KB
    const sizeKb = Buffer.byteLength(svg, 'utf8') / 1024

    return {
      svg,
      sizeKb: parseFloat(sizeKb.toFixed(2))
    }
  } catch (error: any) {
    console.error('FreeSewing pattern generation error:', error)
    throw new Error(`Failed to generate ${patternType} pattern: ${error.message}`)
  }
}

/**
 * Generate an auto-formatted pattern name
 * 
 * @param designName - Name of the design (e.g., "Aaron A-Shirt")
 * @param userName - Optional user name for personalization
 * @returns Formatted pattern name with timestamp
 */
export function generatePatternName(designName: string, userName?: string): string {
  const date = new Date()
  const dateStr = date.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  if (userName) {
    return `${designName} - ${userName} - ${dateStr}`
  }

  return `${designName} - ${dateStr}`
}

/**
 * Extract required measurement keys from design_measurements
 * 
 * @param designMeasurements - Array of design measurement requirements
 * @returns Array of FreeSewing measurement keys
 */
export function extractRequiredMeasurementKeys(
  designMeasurements: DesignMeasurement[]
): string[] {
  return designMeasurements
    .filter(dm => dm.measurementType?.freesewing_key)
    .map(dm => dm.measurementType!.freesewing_key!)
}
