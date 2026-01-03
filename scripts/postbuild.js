/**
 * Post-build script to create package.json in dist/react for Metro bundler compatibility
 */
const fs = require('fs');
const path = require('path');

const reactDir = path.join(__dirname, '..', 'dist', 'react');
const packageJsonPath = path.join(reactDir, 'package.json');

// Ensure directory exists
if (!fs.existsSync(reactDir)) {
  fs.mkdirSync(reactDir, { recursive: true });
}

// Create package.json
const packageJson = {
  main: './index.js',
  types: './index.d.ts',
};

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('Created dist/react/package.json for Metro bundler compatibility');

