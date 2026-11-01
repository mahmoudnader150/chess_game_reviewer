import { useEffect, useState } from 'react'
import { getEngine } from '../engine/engineManager'
import { analyzeGame, buildReview } from '../review/reviewGame'
import { cacheKey, loadEvals, saveEvals } from '../review/reviewCache'

/**
 * Runs an engine review of `game` (a parsed game, see parseGame).
 * Returns { status, progress, review, engineName, error }.
 * status: 'idle' | 'loading' | 'analyzing' | 'done' | 'error'
 */
export function useGameReview(game, pgn, { depth, movetime }) {
  const [state, setState] = useState({ status: 'idle', progress: 0, review: null, engineName: null, error: null })

  useEffect(() => {
    if (!game) return undefined
    const key = cacheKey(pgn, depth)
    const cached = loadEvals(key)
    if (cached && cached.length === game.positions.length) {
      try {
        const review = buildReview(game, cached)
        setState({ status: 'done', progress: 100, review, engineName: 'saved review', error: null })
        return undefined
      } catch (err) {
        console.warn('Ignoring unreadable saved review', err)
      }
    }

    const controller = new AbortController()
    setState({ status: 'loading', progress: 0, review: null, engineName: null, error: null })

    ;(async () => {
      try {
        const engine = await getEngine()
        if (controller.signal.aborted) return
        setState((s) => ({ ...s, status: 'analyzing', engineName: engine.name }))
        const evals = await analyzeGame(game, engine, {
          depth,
          movetime,
          signal: controller.signal,
          onProgress: (done, total) => setState((s) => ({ ...s, progress: Math.round((done / total) * 100) })),
        })
        const review = buildReview(game, evals)
        saveEvals(key, evals)
        setState({ status: 'done', progress: 100, review, engineName: engine.name, error: null })
      } catch (err) {
        if (controller.signal.aborted || err?.name === 'AbortError') return
        console.error(err)
        setState((s) => ({ ...s, status: 'error', error: err?.message ?? String(err) }))
      }
    })()

    // Leaving the game cancels its queued positions; the engine stays warm.
    return () => controller.abort()
  }, [game, pgn, depth, movetime])

  return state
}
