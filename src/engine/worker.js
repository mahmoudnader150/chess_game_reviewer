// Worker wrapper around the Engine. Receives messages, returns analysis results.
// Protocol:
//   { type: 'init', fen }
//   { type: 'analyze', fen, depth, maxTimeMs }
//   { type: 'evaluate', fen }
//   { type: 'stop' }

import { Engine, squareName } from './engine.js'

const PROMO = ['', '', 'n', 'b', 'r', 'q']

function toUci(move) {
  if (!move) return null
  return squareName(move.from) + squareName(move.to) + (move.promotion ? PROMO[move.promotion] : '')
}

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
      if (!result) {
        // No legal moves: checkmate or stalemate.
        self.postMessage({ type: 'analysis', fen: msg.fen, value: 0, uci: null, san: null, depth: 0 })
        break
      }
      self.postMessage({
        type: 'analysis',
        fen: msg.fen,
        value: result.value,
        san: result.san,
        uci: toUci(result.move),
        depth: result.depth,
      })
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