import { defineConfig } from 'vite';
import copy from 'rollup-plugin-copy';
import fs from 'fs';
import path from 'path';
import NodeGlobalsPolyfillPlugin from '@esbuild-plugins/node-globals-polyfill';
import NodeModulesPolyfillPlugin from '@esbuild-plugins/node-modules-polyfill';


const wasmContentTypePlugin = {
  name: 'wasm-content-type-plugin',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
        const newPath = req.url.replace('deps', 'dist');
        const targetPath = path.join(__dirname, newPath);
        const wasmContent = fs.readFileSync(targetPath);
        return res.end(wasmContent);
      }
      next();
    });
  },
};

export default defineConfig(({ command }) => {
  return {
    plugins: [
      copy({
        targets: [{ src: 'node_modules/**/*.wasm', dest: 'node_modules/.vite/dist' }],
        copySync: true,
        hook: 'buildStart',
      }),
      command === 'serve' ? wasmContentTypePlugin : [],
      NodeGlobalsPolyfillPlugin({
        buffer: true
      }),
      NodeModulesPolyfillPlugin()
    ],
    resolve: {
      alias: {
        // Aliases for polyfills
        'buffer': 'buffer/',
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        // Specify plugins for esbuild
        plugins: [
          NodeGlobalsPolyfillPlugin({
            process: true,
            buffer: true
          }),
          NodeModulesPolyfillPlugin()
        ]
      }
    }
  };
});
