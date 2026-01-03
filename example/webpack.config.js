const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      babel: {
        dangerouslyAddModulePathsToTranspile: [
          '@blazium/ton-connect-mobile',
          path.resolve(__dirname, '../src'),
        ],
      },
    },
    argv
  );

  // Resolve source files from parent directory for development
  config.resolve.alias = {
    ...config.resolve.alias,
    '@blazium/ton-connect-mobile': path.resolve(__dirname, '../src'),
  };

  // Ignore .d.ts files in webpack (they're type definitions only)
  config.module.rules.push({
    test: /\.d\.ts$/,
    use: 'ignore-loader',
  });

  return config;
};
