// Entry point for deployment
// This file loads the compiled TypeScript code from dist folder
require('dotenv/config');

// Check if dist folder exists, if not, build first
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distPath = path.join(__dirname, 'dist');

if (!fs.existsSync(distPath)) {
  console.log('⚠️  dist folder not found. Running build...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build completed successfully');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

require('./dist/index.js');
