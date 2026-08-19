/**
 * Build the browser bundle at client/client.js: esbuild-bundled CJS wrapped
 * in the __ModuleLoader__ factory banner, with react/react-dom as externals
 * (resolved by the loader's shared module table, like dshmarket's bundle).
 */
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'

const result = await build({
  entryPoints: ['src/client/index.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom'],
  write: false,
  minify: false,
  sourcemap: false,
  logLevel: 'info',
})

const code = result.outputFiles[0].text
const banner =
  'window.__ModuleLoader__.load({ id: "dsh-wsl-expose", factory: (require) => {\n' +
  '\t\tvar module = { exports: {} };\n' +
  '\t\tvar exports = module.exports;\n'
const footer = '\n\t\treturn module.exports;\n\t}\n});\n'

mkdirSync('client', { recursive: true })
writeFileSync('client/client.js', banner + code + footer)
console.log(`built client/client.js (${code.length} bytes of bundle body)`)
