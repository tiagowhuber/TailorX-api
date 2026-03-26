/**
 * removeShoulderSlopeDesignMeasurements.ts
 *
 * Removes `shoulderSlope` from all design_measurements rows so it is no longer
 * treated as a required measurement that users must provide. The value is now
 * defaulted to 13° at pattern generation time (see freesewing.ts), which is
 * FreeSewing's documented community average.
 *
 * The underlying MeasurementType row is intentionally kept — TailorVision can
 * still detect and store a user's actual shoulder slope angle, and that stored
 * value will automatically override the default at generation time.
 *
 * This script is idempotent: running it multiple times is safe.
 *
 * Usage:
 *   npx tsx "src/scripts/implementation scripts/removeShoulderSlopeDesignMeasurements.ts"
 *   npx tsx "src/scripts/implementation scripts/removeShoulderSlopeDesignMeasurements.ts" --dry-run
 */

import dotenv from 'dotenv';
dotenv.config();

import { DesignMeasurement, MeasurementType, Design, sequelize } from '../../models';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  if (DRY_RUN) console.log('Running in DRY-RUN mode — no DB changes will be made.\n');

  await sequelize.authenticate();
  console.log('Database connected.\n');

  // Find the shoulderSlope MeasurementType
  const measurementType = await MeasurementType.findOne({
    where: { freesewing_key: 'shoulderSlope' },
  });

  if (!measurementType) {
    console.log('ℹ️  MeasurementType with freesewing_key="shoulderSlope" not found. Nothing to do.');
    await sequelize.close();
    return;
  }

  console.log(`Found MeasurementType: "${measurementType.name}" (id=${measurementType.id})\n`);

  // Find all design_measurements rows that reference this type
  const rows = await DesignMeasurement.findAll({
    where: { measurement_type_id: measurementType.id },
    include: [{ model: Design, as: 'design', attributes: ['id', 'name'] }],
  });

  if (rows.length === 0) {
    console.log('✅ No design_measurements rows found for shoulderSlope. Already clean.');
    await sequelize.close();
    return;
  }

  console.log(`Found ${rows.length} design_measurements row(s) to remove:\n`);
  for (const row of rows) {
    const designName = (row as any).design?.name ?? `design_id=${row.design_id}`;
    console.log(`  • ${designName} (design_id=${row.design_id}, measurement_type_id=${row.measurement_type_id})`);
  }

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] No rows were deleted.');
  } else {
    const deletedCount = await DesignMeasurement.destroy({
      where: { measurement_type_id: measurementType.id },
    });
    console.log(`\n✅ Deleted ${deletedCount} row(s) from design_measurements.`);
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
