// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure proper module resolution and caching
config.resolver = {
  ...config.resolver,
  sourceExts: [...config.resolver.sourceExts, 'cjs', 'mjs'],
  // Add watchFolders to include parent directory for local package
  watchFolders: [
    path.resolve(__dirname, '..'),
  ],
  // Ensure node_modules resolution works correctly
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
  ],
  // Resolve subpath exports for @blazium/ton-connect-mobile/react
  // Metro doesn't fully support package.json exports, so we manually resolve
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === '@blazium/ton-connect-mobile/react') {
      const reactPath = path.resolve(__dirname, 'node_modules/@blazium/ton-connect-mobile/dist/react/index.js');
      const fs = require('fs');
      if (fs.existsSync(reactPath)) {
        return {
          filePath: reactPath,
          type: 'sourceFile',
        };
      }
      // Fallback: try to resolve via package.json in the react subdirectory
      const reactPackagePath = path.resolve(__dirname, 'node_modules/@blazium/ton-connect-mobile/dist/react/package.json');
      if (fs.existsSync(reactPackagePath)) {
        const pkg = JSON.parse(fs.readFileSync(reactPackagePath, 'utf8'));
        const mainPath = path.resolve(path.dirname(reactPackagePath), pkg.main || 'index.js');
        if (fs.existsSync(mainPath)) {
          return {
            filePath: mainPath,
            type: 'sourceFile',
          };
        }
      }
    }
    // Use default resolution
    return context.resolveRequest(context, moduleName, platform);
  },
};

// Optimize transformer for better compatibility
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

module.exports = config;

