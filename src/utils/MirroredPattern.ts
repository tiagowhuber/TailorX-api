// Factory to create a Mirrored Brian pattern
// We inject dependencies to handle ESM/CJS interop issues

export const createMirroredPattern = (BasePatternClass: any, pluginMirror: any) => {
  return class MirroredPattern extends BasePatternClass {
    constructor(settings: any = {}) {
      super(settings);
      this.use(pluginMirror);
    }

    draft() {
      // Allow the original draft to happen
      super.draft();

      console.log('--- MirroredPattern Debug Start ---');
      // this.parts is technically a "Store" that behaves like an array of "sets" of parts
      const sets = Object.keys(this.parts);
      console.log('Available sets:', sets);

      // We typically work on the first set (index 0) unless doing multi-size grading
      if (sets.length > 0) {
        // @ts-ignore
        const parts = this.parts[0] || this.parts[sets[0]]; 
        const availablePartNames = Object.keys(parts);
        console.log('Available part names in set 0:', availablePartNames);

        // List of parts to mirror. 
        // We need to handle namespaced names like 'brian.front' or just 'front'
        const baseNames = ['front', 'back'];

        baseNames.forEach(baseName => {
            // Find the actual part name that ends with the baseName
            // e.g. 'brian.front' matches 'front'
            const actualPartName = availablePartNames.find(name => 
                name === baseName || name.endsWith(`.${baseName}`)
            );

            if (actualPartName) {
                console.log(`Found matching part: ${actualPartName} for ${baseName}`);
                const part = parts[actualPartName];
                
                // Debug points
                const pointKeys = Object.keys(part.points);
                console.log(`Points in ${actualPartName}:`, pointKeys.filter(k => k.startsWith('cf') || k.startsWith('cb')));

                // Determine mirror line points
                let p1, p2;
                
                // Front typically mirrors around Center Front (cfNeck -> cfHem)
                if (baseName === 'front') {
                     if (part.points.cfNeck && part.points.cfHem) {
                       p1 = part.points.cfNeck;
                       p2 = part.points.cfHem;
                       console.log(`${actualPartName}: Found cfNeck and cfHem`);
                     } else if (part.points.cfNeck && part.points.cfWaist) {
                       p1 = part.points.cfNeck;
                       p2 = part.points.cfWaist;
                       console.log(`${actualPartName}: Found cfNeck and cfWaist`);
                     } else {
                        console.log(`${actualPartName}: Could not find mirror points (cfNeck/cfHem or cfNeck/cfWaist)`);
                     }
                } 
                // Back typically mirrors around Center Back (cbNeck -> cbHem)
                else if (baseName === 'back') {
                     if (part.points.cbNeck && part.points.cbHem) {
                       p1 = part.points.cbNeck;
                       p2 = part.points.cbHem;
                       console.log(`${actualPartName}: Found cbNeck and cbHem`);
                     } else {
                        console.log(`${actualPartName}: Could not find mirror points (cbNeck/cbHem)`);
                     }
                }

                if (p1 && p2) {
                   console.log(`Applying mirror macro to part: ${actualPartName}`);
                   
                   // Get all paths and points to mirror
                   const pathsToMirror = Object.keys(part.paths);
                   const pointsToMirror = Object.keys(part.points);
      
                   console.log(`Mirroring ${pathsToMirror.length} paths and ${pointsToMirror.length} points`);
      
                   // Attempt to use the macro directly since part.macro() is not available on the Part instance
                   try {
                     if (pluginMirror?.macros?.mirror) {
                        console.log(`Invoking pluginMirror.macros.mirror directly on ${actualPartName}`);
                        pluginMirror.macros.mirror.call(part, {
                            mirror: [p1, p2],
                            paths: pathsToMirror,
                            points: pointsToMirror,
                            name: actualPartName,
                            prefix: 'mirrored_' 
                        });
                     } else {
                        // Fallback: Check if the plugin object structure is different (e.g. wrapper)
                        console.error('pluginMirror.macros.mirror NO available!');
                        console.log('pluginMirror keys:', Object.keys(pluginMirror || {}));
                        if (pluginMirror.plugin && pluginMirror.plugin.macros && pluginMirror.plugin.macros.mirror) {
                             console.log(`Found nested pluginMirror.plugin.macros.mirror, trying that.`);
                             pluginMirror.plugin.macros.mirror.call(part, {
                                mirror: [p1, p2],
                                paths: pathsToMirror,
                                points: pointsToMirror,
                                name: actualPartName,
                                prefix: 'mirrored_' 
                            });
                        }
                     }
                   } catch (err: any) {
                     console.error(`Failed to mirror part ${actualPartName}:`, err);
                     if (err.stack) console.error(err.stack);
                   }
                }
            } else {
                 console.log(`Base part ${baseName} NOT found in available parts.`);
            }
        });
      }
      
      console.log('--- MirroredPattern Debug End ---');
      
      return this;
    }
  };
};
