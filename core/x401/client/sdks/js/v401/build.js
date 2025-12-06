import esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['index.js'],
  outfile: 'dist/index.js',   // compiled/bundled output
  bundle: true,               // bundle dependencies
  minify: true,               // optional minification
  platform: 'node',
  format: 'esm',              // CommonJS for Node
}).catch(() => process.exit(1));