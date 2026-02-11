import dotenv from 'dotenv';
dotenv.config();

import app from "./app";
import { sequelize } from "./models";

const PORT = process.env.PORT || 3000;

// Database connection and server start
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Sync models (be careful in production!)
    if (process.env.NODE_ENV === 'development') {
      // alter: true can cause issues with existing constraints, using safe sync instead
      await sequelize.sync();
      console.log('Database models synchronized.');
    }
    
    app.listen(PORT, async () => {
      console.log(`Server running at http://localhost:${PORT}`);

      // Ping TailorVision
      const tailorVisionUrl = process.env.TAILORVISION_URL || 'http://localhost:8000';
      try {
        // Attempt to fetch root URL or docs to check connectivity
        await fetch(tailorVisionUrl);
        console.log(`TailorVision: Connected at ${tailorVisionUrl}`);
      } catch (error) {
        console.error(`TailorVision: Connection failed (${tailorVisionUrl})`);
      }
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();

