// Adapter exposing the built-in JavaScript engine (worker.js) through the
// same interface as StockfishClient. Used as a fallback when Stockfish can't
// load. It only produces a single line (no MultiPV).

const MATE_SCORE = 100000

function toScore(value) {
  if (Math.abs(value) > MATE_SCORE - 1000) {
    const plies = MATE_SCORE - Math.abs(value)
    return { type: 'mate', value: Math.sign(value) * Math.max(1, Math.ceil(plies / 2)) }
  }
  return { type: 'cp', value }
}

export class LocalEngineClient {
  constructor() {
    this.name = 'Built-in engine'
    this.worker = null
    this.jobs = []
    this.current = null
  }

  init() {
    if (this.worker) return Promise.resolve(this)
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
    this.worker.onmessage = (e) => {
      if (e.data?.type !== 'analysis' || !this.current) return
      const job = this.current
      this.current = null
      const { value, uci, depth } = e.data
      if (job.cancelled) job.reject(new DOMException('Analysis cancelled', 'AbortError'))
      else job.resolve({ lines: uci ? [{ score: toScore(value), pv: [uci], depth }] : [], depth: depth ?? 0 })
      this.pump()
    }
    return Promise.resolve(this)
  }

  analyze(fen, { depth = 14, movetime = 1500 } = {}) {
    return new Promise((resolve, reject) => {
      // The JS engine is far slower than Stockfish; cap its depth and time.
      this.jobs.push({ fen, depth: Math.min(depth, 8), movetime: Math.min(movetime, 1000), resolve, reject })
      this.pump()
    })
  }

  pump() {
    if (this.current || this.jobs.length === 0) return
    const job = (this.current = this.jobs.shift())
    this.worker.postMessage({ type: 'analyze', fen: job.fen, depth: job.depth, maxTimeMs: job.movetime })
  }

  cancelAll() {
    for (const job of this.jobs) job.reject(new DOMException('Analysis cancelled', 'AbortError'))
    this.jobs = []
    if (this.current) this.current.cancelled = true
  }

  terminate() {
    this.cancelAll()
    this.worker?.terminate()
    this.worker = null
  }
}
