require('dotenv/config');
const path = require('path');

try {
  // Try different possible paths for the compiled app
  let app;
  try {
    // First try the standard build output
    app = require('../dist/app').default;
  } catch (e) {
    // If that fails, try loading from the source (Vercel may have copied files)
    try {
      app = require(path.join(__dirname, '../dist/app')).default;
    } catch (e2) {
      throw new Error(`Cannot find app module. Tried: ../dist/app, ${path.join(__dirname, '../dist/app')}. Error: ${e.message}`);
    }
  }
  
  module.exports = app;
} catch (error) {
  console.error('Failed to load app:', error);
  // Export a basic error handler
  module.exports = (req, res) => {
    res.status(500).json({ 
      error: 'Server initialization failed',
      message: error.message,
      details: 'Check Vercel logs for more information',
      cwd: process.cwd(),
      dirname: __dirname
    });
  };
}

