import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from '../../models';

async function checkConstraints() {
  try {
    await sequelize.authenticate();
    const [results] = await sequelize.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'user_measurements'::regclass
      AND contype = 'f';
    `);
    console.log('Foreign keys on user_measurements:', results);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkConstraints();
