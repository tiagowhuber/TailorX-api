// Load environment variables first
require('dotenv/config');

// Import the Express app (not the server starter)
const app = require('../dist/app').default;

// Export for Vercel serverless
module.exports = app;

