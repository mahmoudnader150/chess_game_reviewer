// Promise-based wrapper around one Stockfish WASM web worker (UCI), plus a
// pool that spreads positions over several workers in parallel.

const ENGINE_URL = '/stockfish/stockfish-19-lite-single.js'

function abortError() {
  return new DOMException('Analysis cancelled', 'AbortError')
}

function parseInfo(line) {
  const tokens = line.split(' ')
  const info = { multipv: 1 }
  for (let i = 1; i < tokens.length; i += 1) {
    const t = tokens[i]
    if (t === 'depth') info.depth = Number(tokens[++i])
    else if (t === 'multipv') info.multipv = Number(tokens[++i])
    else if (t === 'score') {
      info.score = { type: tokens[++i], value: Number(tokens[++i]) }
      if (tokens[i + 1] === 'lowerbound' || tokens[i + 1] === 'upperbound') info.bound = tokens[++i]
    } else if (t === 'pv') {
      // Only the first few moves are ever used; keep results small.
      info.pv = tokens.slice(i + 1, i + 9)
      break
    }
  }
  return info
}

export class StockfishClient {
  constructor(url = ENGINE_URL) {
    this.name = 'Stockfish 19 (lite)'
    this.url = url
    this.worker = null
    this.jobs = [] // waiting jobs
    this.current = null // running job
    this.multiPv = 1
    this.listener = null
  }

  get load() {
    return this.jobs.length + (this.current ? 1 : 0)
  }

  init(timeoutMs = 20000) {
    if (this.ready) return this.ready
    this.ready = new Promise((resolve, reject) => {
      let worker
      try {
        worker = new Worker(this.url)
      } catch (err) {
        reject(err)
        return
      }
      this.worker = worker
      const timer = setTimeout(() => reject(new Error('Stockfish did not start in time')), timeoutMs)
      let started = false
      worker.onerror = (e) => {
        clearTimeout(timer)
        reject(new Error(e.message || 'Stockfish failed to load'))
      }
      worker.onmessage = (e) => {
        const line = typeof e.data === 'string' ? e.data : ''
        if (!started) {
          if (line === 'readyok') {
            started = true
            clearTimeout(timer)
            resolve(this)
          }
          return
        }
        this.listener?.(line)
      }
      worker.postMessage('uci')
      worker.postMessage('setoption name Hash value 16')
      worker.postMessage('isready')
    })
    return this.ready
  }

  send(cmd) {
    this.worker?.postMessage(cmd)
  }

  // Resolves with { lines: [{ score: {type, value}, pv: [uci…], depth }], depth }.
  // Scores are from the side to move's point of view (UCI convention).
  analyze(fen, { depth = 14, multiPv = 2, movetime = 1500 } = {}) {
    return new Promise((resolve, reject) => {
      this.jobs.push({ fen, depth, multiPv, movetime, resolve, reject })
      this.pump()
    })
  }

  pump() {
    if (this.current || this.jobs.length === 0 || !this.worker) return
    const job = (this.current = this.jobs.shift())
    const lines = []
    this.listener = (line) => {
      if (line.startsWith('info') && line.includes(' pv ')) {
        const info = parseInfo(line)
        if (!info.score || !info.pv?.length) return
        const prev = lines[info.multipv - 1]
        // Bound scores are less reliable; keep them only if nothing better exists.
        if (info.bound && prev && !prev.bound && prev.depth >= info.depth) return
        lines[info.multipv - 1] = info
      } else if (line.startsWith('bestmove')) {
        this.listener = null
        this.current = null
        if (job.cancelled) job.reject(abortError())
        else job.resolve({ lines: lines.filter(Boolean), depth: lines[0]?.depth ?? 0 })
        this.pump()
      }
    }
    if (this.multiPv !== job.multiPv) {
      this.send(`setoption name MultiPV value ${job.multiPv}`)
      this.multiPv = job.multiPv
    }
    this.send(`position fen ${job.fen}`)
    this.send(`go depth ${job.depth} movetime ${job.movetime}`)
  }

  // Drop queued work and stop the running search.
  cancelAll() {
    for (const job of this.jobs) job.reject(abortError())
    this.jobs = []
    if (this.current) {
      this.current.cancelled = true
      this.send('stop')
    }
  }

  terminate() {
    this.cancelAll()
    if (this.current) this.current.reject(abortError())
    this.current = null
    this.worker?.terminate()
    this.worker = null
    this.ready = null
  }
}

// Several engines behind the same interface. Each position goes to the least
// busy worker, so a game is analyzed N positions at a time.
export class EnginePool {
  constructor(size) {
    this.clients = Array.from({ length: size }, () => new StockfishClient())
    this.name = `${this.clients[0].name} ×${size}`
  }

  async init() {
    const results = await Promise.allSettled(this.clients.map((c) => c.init()))
    const ok = this.clients.filter((_, i) => results[i].status === 'fulfilled')
    this.clients.filter((c) => !ok.includes(c)).forEach((c) => c.terminate())
    if (ok.length === 0) throw results[0].reason
    this.clients = ok
    this.name = ok.length > 1 ? `Stockfish 19 (lite) ×${ok.length} threads` : 'Stockfish 19 (lite)'
    return this
  }

  analyze(fen, options) {
    const client = this.clients.reduce((a, b) => (b.load < a.load ? b : a))
    return client.analyze(fen, options)
  }

  cancelAll() {
    this.clients.forEach((c) => c.cancelAll())
  }

  terminate() {
    this.clients.forEach((c) => c.terminate())
  }
}

// How many workers to run: leave a core for the UI, use fewer on phones to
// limit heat and memory.
export function defaultPoolSize() {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2
  const isMobile = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  return Math.max(1, Math.min(cores - 1, isMobile ? 3 : 6))
}
