require('dotenv/config');

try {
  const app = require('../dist/app').default;
  module.exports = app;
} catch (error) {
  console.error('Failed to load app:', error);
  // Export a basic error handler
  module.exports = (req, res) => {
    res.status(500).json({ 
      error: 'Server initialization failed',
      message: error.message,
      details: 'Check Vercel logs for more information'
    });
  };
}

