// Worker wrapper around the Engine. Receives messages, returns analysis results.
// Protocol:
//   { type: 'init', fen }
//   { type: 'analyze', fen, depth, maxTimeMs }
//   { type: 'evaluate', fen }
//   { type: 'stop' }

import { Engine } from './engine.js'

let engine = null

self.onmessage = (event) => {
  const msg = event.data
  if (!msg || typeof msg.type !== 'string') return

  switch (msg.type) {
    case 'init': {
      engine = new Engine()
      if (msg.fen) engine.setFen(msg.fen)
      self.postMessage({ type: 'ready' })
      break
    }
    case 'analyze': {
      if (!engine) {
        engine = new Engine()
        if (msg.fen) engine.setFen(msg.fen)
      }
      engine.setFen(msg.fen)
      const result = engine.iterativeDeepening(msg.depth ?? 15, msg.maxTimeMs ?? 1500)
      self.postMessage({ type: 'analysis', fen: msg.fen, ...result })
      break
    }
    case 'evaluate': {
      if (!engine) {
        engine = new Engine()
        if (msg.fen) engine.setFen(msg.fen)
      }
      engine.setFen(msg.fen)
      const value = engine.evaluate()
      self.postMessage({ type: 'evaluation', fen: msg.fen, value })
      break
    }
    case 'stop':
      if (engine) engine.aborted = true
      break
    default:
      break
  }
}