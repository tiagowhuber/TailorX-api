import dotenv from 'dotenv';
dotenv.config();

import { initializeDatabase } from '../utils/initDb';

const main = async () => {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
};

main();