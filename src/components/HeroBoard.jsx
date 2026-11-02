import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { SAMPLE_PGN } from '../review/sampleGame'

const STEP_MS = 1300
const HOLD_STEPS = 4 // how long the final mate stays up before the game restarts

function sampleFens() {
  const chess = new Chess()
  chess.loadPgn(SAMPLE_PGN)
  const moves = chess.history({ verbose: true })
  return [moves[0].before, ...moves.map((m) => m.after)]
}

// Plays the sample game on a loop, in the selected board theme.
export default function HeroBoard({ boardTheme }) {
  const fens = useMemo(() => sampleFens(), [])
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (reduced) return undefined
    const timer = setInterval(() => setStep((s) => (s + 1) % (fens.length + HOLD_STEPS)), STEP_MS)
    return () => clearInterval(timer)
  }, [fens, reduced])

  const fen = reduced ? fens[fens.length - 1] : fens[Math.min(step, fens.length - 1)]

  return (
    <figure className="hero-board">
      <Chessboard
        options={{
          id: 'hero-board',
          position: fen,
          allowDragging: false,
          allowDrawingArrows: false,
          showAnimations: !reduced,
          animationDurationInMs: 300,
          darkSquareStyle: { backgroundColor: boardTheme.dark },
          lightSquareStyle: { backgroundColor: boardTheme.light },
          darkSquareNotationStyle: { color: boardTheme.light, fontWeight: 600 },
          lightSquareNotationStyle: { color: boardTheme.dark, fontWeight: 600 },
          boardStyle: { borderRadius: '6px', overflow: 'hidden' },
        }}
      />
      <figcaption className="muted">Morphy’s Opera Game, Paris 1858</figcaption>
    </figure>
  )
}
