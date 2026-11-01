// One shared engine for the whole app. It starts loading as soon as the app
// opens (warmUpEngine), so the first review doesn't wait for WASM to compile.
import { EnginePool, defaultPoolSize } from './stockfishClient'
import { LocalEngineClient } from './localClient'

let enginePromise = null

async function createEngine() {
  const pool = new EnginePool(defaultPoolSize())
  try {
    return await pool.init()
  } catch (err) {
    console.warn('Stockfish unavailable, falling back to the built-in engine:', err)
    pool.terminate()
    return new LocalEngineClient().init()
  }
}

export function getEngine() {
  if (!enginePromise) enginePromise = createEngine()
  return enginePromise
}

export function warmUpEngine() {
  getEngine().catch(() => {
    enginePromise = null
  })
}
