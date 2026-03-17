// esbuild.config.js
const { build } = require('esbuild');

build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist/extension.cjs.js',
  sourcemap: true,
  external: [
    'vscode',
    '@mapbox/node-pre-gyp',
    'mock-aws-s3',
    'aws-sdk',
    'nock',
    '@openmcp/service',
    'task-loop.js'
  ], 
  target: ['node22'],   
  loader: {
    '.json': 'json',
    '.html': 'text'
  },
  define: { 'import.meta.url': '_importMetaUrl' },
  banner: {
    js: "const _importMetaUrl=require('url').pathToFileURL(__filename)",
  },
}).catch(() => process.exit(1));
