require('dotenv/config');

try {
  const app = require('../dist/app').default;
  module.exports = app;
} catch (error) {
  console.error('Failed to load app:', error);
  console.error('Current directory:', process.cwd());
  console.error('__dirname:', __dirname);
  
  // Export a basic error handler with debugging info
  module.exports = (req, res) => {
    res.status(500).json({ 
      error: 'Server initialization failed',
      message: error.message,
      stack: error.stack,
      cwd: process.cwd(),
      dirname: __dirname
    });
  };
}

