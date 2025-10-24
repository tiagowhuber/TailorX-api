/**
 * Migration script to add profile_picture_url column to users table
 * Run this script to update existing databases
 */

import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from '../../models';
import { QueryTypes } from 'sequelize';

async function addProfilePictureColumn() {
  try {
    console.log('Starting migration: Adding profile_picture_url column to users table...');
    
    // Check if column already exists
    const columns = await sequelize.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'users' 
       AND column_name = 'profile_picture_url';`,
      { type: QueryTypes.SELECT }
    );

    if (columns.length > 0) {
      console.log('✓ Column profile_picture_url already exists. No migration needed.');
      return;
    }

    // Add the column
    await sequelize.query(
      `ALTER TABLE users 
       ADD COLUMN profile_picture_url VARCHAR(500);`
    );

    console.log('✓ Successfully added profile_picture_url column to users table.');
    console.log('✓ Migration completed successfully!');
    
  } catch (error) {
    console.error('✗ Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the migration
addProfilePictureColumn()
  .then(() => {
    console.log('Migration script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
