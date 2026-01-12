/**
 * FreeSewing Pattern Generation Utilities
 * 
 * Handles transformation of database measurements to FreeSewing format
 * and dynamic pattern generation for different FreeSewing patterns.
 */

// Import model types
import type UserMeasurement from '../models/UserMeasurement';
import type DesignMeasurement from '../models/DesignMeasurement';
import { createMirroredPattern } from './MirroredPattern';
import { parseHTML } from 'linkedom';

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
 * Dynamic import wrapper to prevent TypeScript from transpiling to require()
 * This is needed because FreeSewing packages are ES Modules
 */
function dynamicImport(moduleName: string) {
  // Using Function constructor to prevent TypeScript from transpiling import()
  return new Function('moduleName', 'return import(moduleName)')(moduleName);
}

/**
 * Get the FreeSewing pattern class based on pattern type
 * 
 * @param patternType - Name of the FreeSewing pattern (e.g., 'aaron', 'brian', 'Brian body block')
 * @returns Pattern constructor class
 * @throws Error if pattern type is not supported
 */
async function getPatternClass(patternType: string) {
  // Normalize pattern type: extract just the pattern code
  // "Brian body block" -> "brian", "Aaron A-shirt" -> "aaron"
  const patternTypeLower = patternType.toLowerCase().trim();
  
  // Check for mirrored request
  const isMirrored = patternTypeLower.includes('mirrored');
  
  // Extract the pattern code from common pattern name formats
  let patternCode = patternTypeLower;
  if (patternTypeLower.includes('brian')) {
    patternCode = 'brian';
  } else if (patternTypeLower.includes('aaron')) {
    patternCode = 'aaron';
  } else if (patternTypeLower.includes('sven')) {
    patternCode = 'sven';
  } else if (patternTypeLower.includes('charlie')) {
    patternCode = 'charlie';
  } else if (patternTypeLower.includes('diana')) {
    patternCode = 'diana';
  } else if (patternTypeLower.includes('lumira')) {
    patternCode = 'lumira';
  }
  
  let PatternClass;

  try {
    switch (patternCode) {
      case 'aaron': {
        // @ts-ignore
        const { Aaron } = await dynamicImport('@freesewing/aaron');
        PatternClass = Aaron;
        break;
      }
      case 'brian': {
        // @ts-ignore
        const { Brian } = await dynamicImport('@freesewing/brian');
        PatternClass = Brian;
        break;
      }
      case 'sven': {
        // @ts-ignore
        const { Sven } = await dynamicImport('@freesewing/sven');
        PatternClass = Sven;
        break;
      }
      case 'charlie': {
        // @ts-ignore
        const { Charlie } = await dynamicImport('@freesewing/charlie');
        PatternClass = Charlie;
        break;
      }
      case 'diana': {
        // @ts-ignore
        const { Diana } = await dynamicImport('@freesewing/diana');
        PatternClass = Diana;
        break;
      }
      case 'lumira': {
        // @ts-ignore
        const { Lumira } = await dynamicImport('@freesewing/lumira');
        PatternClass = Lumira;
        break;
      }
      default:
        throw new Error(`Unsupported pattern type: ${patternType}. Available patterns: aaron, brian, sven, charlie, diana, lumira`);
    }

    if (isMirrored) {
      console.log(`Wrapping ${patternCode} with mirror plugin...`);
      // @ts-ignore
      const { pluginMirror } = await dynamicImport('@freesewing/plugin-mirror');
      // Wrap the pattern class
      PatternClass = createMirroredPattern(PatternClass, pluginMirror);
    }

    return PatternClass;

  } catch (error: any) {
    if (error.message.includes('Unsupported pattern type')) {
      throw error;
    }
    throw new Error(`Failed to load pattern ${patternType}: ${error.message}`);
  }
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
    const PatternClass = await getPatternClass(patternType);
    // @ts-ignore - FreeSewing modules are ESM and may not have type declarations
    const { pluginTheme } = await dynamicImport('@freesewing/plugin-theme');
    // @ts-ignore - FreeSewing modules are ESM and may not have type declarations
    const { pluginAnnotations } = await dynamicImport('@freesewing/plugin-annotations');

    // FreeSewing v4 pattern configuration
    const patternConfig = {
      measurements,
      // Default settings for pattern generation
      sa: settings.sa ?? 10, // Seam allowance in mm
      complete: settings.complete ?? true,
      paperless: settings.paperless ?? true,
      ...settings
    }

    console.log('Generating pattern with config:', patternConfig)

    // Generate the pattern using FreeSewing v4 API
    // Create pattern instance with design config
    const pattern = new PatternClass(patternConfig)
    
    // Use the theme plugin for styling
    pattern.use(pluginTheme)
    
    // Use the annotations plugin for paperless mode (measurements/dimensions)
    pattern.use(pluginAnnotations)
    
    // Draft the pattern
    const draftedPattern = pattern.draft()
    
    // Render to SVG
    const svg = draftedPattern.render()

    // Calculate size in KB
    const sizeKb = Buffer.byteLength(svg, 'utf8') / 1024

    console.log(`Pattern generated successfully. Size: ${sizeKb.toFixed(2)} KB`)

    return {
      svg,
      sizeKb: parseFloat(sizeKb.toFixed(2))
    }
  } catch (error: any) {
    console.error('FreeSewing pattern generation error:', error)
    console.error('Error stack:', error.stack)
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

/**
 * Clean the SVG to contain only fabric sa paths and minimal structure
 * @param svgContent - Raw SVG string
 * @returns Cleaned SVG string
 */
export function cleanMirroredSvg(svgContent: string): string {
  const { document } = parseHTML(svgContent);
  const svg = document.querySelector('svg');
  if (!svg) return svgContent;

  // Set standard attributes
  svg.setAttribute('width', svg.getAttribute('width') || '100%');
  svg.setAttribute('height', svg.getAttribute('height') || '100%');
  
  // Clean attributes
  const keepAttrs = ['xmlns', 'xmlns:xlink', 'class', 'width', 'height', 'viewBox'];
  Array.from(svg.attributes).forEach((attr: any) => {
    if (!keepAttrs.includes(attr.name)) {
        svg.removeAttribute(attr.name);
    }
  });

  // 1. Update Styles
  const style = svg.querySelector('style');
  if (style) {
    style.textContent = `
    svg.freesewing path { fill: none; stroke: #212121; stroke-width: 0.6; stroke-linecap: round; stroke-linejoin: round; }
    svg.freesewing .sa { stroke-dasharray: 0.4, 0.8; }
    `;
  }

  // 2. Remove Defs
  const defs = svg.querySelector('defs');
  if (defs) defs.remove();

  // 3. Clean Nodes
  const cleanNode = (node: Element) => {
    const children = Array.from(node.children);
    let hasValidChildren = false;

    for (const child of children) {
      const tagName = child.tagName.toLowerCase();
      
      if (tagName === 'g') {
         const childResult = cleanNode(child);
         if (!childResult) {
           child.remove();
         } else {
           hasValidChildren = true;
           // Remove IDs from groups to be clean
           child.removeAttribute('id');
         }
      } else if (tagName === 'path') {
         const classList = child.getAttribute('class') || '';
         // Check for fabric AND sa
         if (classList.includes('fabric') && classList.includes('sa')) {
            hasValidChildren = true;
         } else {
            child.remove();
         }
      } else if (tagName === 'style') {
         hasValidChildren = true;
      } else {
         // Remove text, use, etc.
         child.remove();
      }
    }
    return hasValidChildren;
  }

  cleanNode(svg);

  return svg.outerHTML;
}
