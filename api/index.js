require('dotenv/config');

try {
  const app = require('../dist/app').default;
  
  // Wrap the Express app to handle Vercel serverless function format
  module.exports = (req, res) => {
    // Ensure CORS headers are set for all responses
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://tailorxsewing.netlify.app'
    ];
    
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    
    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    // Pass request to Express app
    return app(req, res);
  };
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

