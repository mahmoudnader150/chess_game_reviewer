// Copies the Stockfish WASM build from node_modules into public/ so Vite
// serves it as a static web worker. Runs automatically before dev/build.
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'stockfish', 'bin')
const dest = join(root, 'public', 'stockfish')
const files = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']

if (!existsSync(src)) {
  console.warn('stockfish package not installed; the built-in engine will be used instead.')
  process.exit(0)
}
mkdirSync(dest, { recursive: true })
for (const f of files) cpSync(join(src, f), join(dest, f))
// Stockfish is GPLv3: its license has to ship with the engine.
cpSync(join(root, 'node_modules', 'stockfish', 'Copying.txt'), join(dest, 'COPYING.txt'))
console.log(`Copied Stockfish to ${dest}`)
