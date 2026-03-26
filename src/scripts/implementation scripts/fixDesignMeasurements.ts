/**
 * fixDesignMeasurements.ts
 *
 * Syncs design_measurements rows to match FreeSewing's canonical required
 * measurement lists. This is an additive-only, idempotent operation — it
 * never removes existing rows.
 *
 * Measurement lists were extracted directly from @freesewing/* package
 * designConfig.parts on 2026-03-25. Run again after upgrading FreeSewing
 * packages if new required measurements are introduced.
 *
 * Usage:
 *   npx tsx "src/scripts/implementation scripts/fixDesignMeasurements.ts"
 *   npx tsx "src/scripts/implementation scripts/fixDesignMeasurements.ts" --dry-run
 */

import dotenv from 'dotenv';
dotenv.config();

import { Design, MeasurementType, DesignMeasurement, sequelize } from '../../models';

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Canonical measurement lists extracted from @freesewing/* designConfig.parts
// ---------------------------------------------------------------------------
interface DesignSpec {
  key: string;
  required: string[];
  optional: string[];
}

const DESIGN_SPECS: DesignSpec[] = [
  {
    key: 'brian',
    required: [
      'biceps', 'chest', 'hpsToBust', 'hpsToWaistBack', 'neck',
      'shoulderToShoulder', 'shoulderSlope', 'waistToArmpit',
      'waistToHips', 'shoulderToWrist', 'wrist',
    ],
    optional: ['highBust'],
  },
  {
    key: 'sven',
    required: [
      'hips', 'waist', 'biceps', 'chest', 'hpsToBust', 'hpsToWaistBack',
      'neck', 'shoulderToShoulder', 'shoulderSlope', 'waistToArmpit',
      'waistToHips', 'shoulderToWrist', 'wrist',
    ],
    optional: ['highBust'],
  },
  {
    key: 'diana',
    required: [
      'biceps', 'chest', 'hpsToWaistBack', 'hips', 'waist', 'waistToHips',
      'neck', 'shoulderSlope', 'shoulderToShoulder', 'shoulderToWrist',
      'wrist', 'hpsToBust', 'waistToArmpit',
    ],
    optional: ['highBust'],
  },
  {
    key: 'sandy',
    required: ['waist', 'waistToFloor', 'waistToHips', 'hips'],
    optional: [],
  },
  {
    key: 'teagan',
    required: [
      'hips', 'waist', 'biceps', 'chest', 'hpsToBust', 'hpsToWaistBack',
      'neck', 'shoulderToShoulder', 'shoulderSlope', 'waistToArmpit',
      'waistToHips',
    ],
    optional: ['highBust'],
  },
  {
    key: 'tamiko',
    required: [
      'shoulderToShoulder', 'chest', 'hpsToWaistBack', 'shoulderSlope',
      'waistToHips',
    ],
    optional: ['highBust'],
  },
  {
    key: 'waralee',
    required: ['seat', 'inseam', 'crotchDepth', 'waistToHips'],
    optional: ['waist', 'waistBack'],
  },
];

// MeasurementType rows that may not exist yet in older DB instances
const MISSING_TYPE_DEFAULTS: Record<string, { name: string; description: string }> = {
  highBust: {
    name: 'Busto alto',
    description: 'Circunferencia en la parte alta del busto (sobre el pecho).',
  },
};

// ---------------------------------------------------------------------------

async function ensureMeasurementType(key: string): Promise<MeasurementType> {
  const existing = await MeasurementType.findOne({ where: { freesewing_key: key } });
  if (existing) return existing;

  const defaults = MISSING_TYPE_DEFAULTS[key] ?? {
    name: key.charAt(0).toUpperCase() + key.slice(1),
    description: `Measurement for FreeSewing key: ${key}`,
  };

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would create MeasurementType: ${defaults.name} (${key})`);
    // Return a fake object so the rest of the loop can continue
    return { id: -1, freesewing_key: key, name: defaults.name } as any;
  }

  const created = await MeasurementType.create({
    name: defaults.name,
    description: defaults.description,
    freesewing_key: key,
  });
  console.log(`  ✚ Created MeasurementType: ${defaults.name} (${key})`);
  return created;
}

async function syncDesign(spec: DesignSpec): Promise<void> {
  const design = await Design.findOne({ where: { freesewing_pattern: spec.key } });
  if (!design) {
    console.log(`  — Design "${spec.key}" not found in DB, skipping.`);
    return;
  }
  console.log(`\n▶ Design: ${design.name} (id=${design.id}, pattern=${spec.key})`);

  const allKeys = [...spec.required, ...spec.optional];
  let addedCount = 0;
  let skippedCount = 0;

  for (const key of allKeys) {
    const isRequired = spec.required.includes(key);
    const mt = await ensureMeasurementType(key);

    if (mt.id === -1) {
      // dry-run placeholder — skip linking
      addedCount++;
      continue;
    }

    const existing = await DesignMeasurement.findOne({
      where: { design_id: design.id, measurement_type_id: mt.id },
    });

    if (existing) {
      skippedCount++;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `  [DRY-RUN] Would link: ${key} (is_required=${isRequired})`,
      );
      addedCount++;
    } else {
      await DesignMeasurement.create({
        design_id: design.id,
        measurement_type_id: mt.id,
        is_required: isRequired,
      });
      console.log(`  ✚ Linked: ${key} (is_required=${isRequired})`);
      addedCount++;
    }
  }

  console.log(
    `  → ${addedCount} added, ${skippedCount} already present.`,
  );
}

async function main() {
  if (DRY_RUN) console.log('Running in DRY-RUN mode — no DB changes will be made.\n');

  await sequelize.authenticate();
  console.log('Database connected.\n');

  for (const spec of DESIGN_SPECS) {
    await syncDesign(spec);
  }

  console.log('\n✅ Done.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
