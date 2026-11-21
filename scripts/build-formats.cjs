const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public', 'vendor');
const flashrawDist = path.join(root, 'node_modules', 'flashraw', 'dist');

async function build() {
  fs.mkdirSync(output, { recursive: true });
  await esbuild.build({
    entryPoints: {
      'format-decoder': './scripts/format-decoder-entry.js',
      'flashraw-worker': './node_modules/flashraw/dist/worker-entry.browser.js',
    },
    absWorkingDir: root,
    outdir: 'public/vendor',
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    chunkNames: 'chunks/[name]-[hash]',
  });

  for (const file of ['flashraw.wasm', 'flashraw_simd.wasm', 'flashraw_simd_jxl.wasm']) {
    fs.copyFileSync(path.join(flashrawDist, file), path.join(output, file));
  }
  for (const file of ['LICENSE-MIT', 'LICENSE-APACHE']) {
    fs.copyFileSync(path.join(root, 'node_modules', 'flashraw', file), path.join(output, file));
  }
  fs.copyFileSync(path.join(root, 'node_modules', 'utif', 'LICENSE'), path.join(output, 'LICENSE-UTIF'));
}

build().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
