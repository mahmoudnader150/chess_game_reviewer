import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseGame } from '../review/reviewGame'
import { SHOW_BEST_FOR } from '../review/classifications'
import { useGameReview } from '../hooks/useGameReview'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { playMove, playSound, soundForMove } from '../audio/sounds'
import ReviewBoard from './ReviewBoard'
import EvalBar from './EvalBar'
import MoveList from './MoveList'
import MoveFeedback from './MoveFeedback'
import ReviewSummary from './ReviewSummary'
import NavControls from './NavControls'
import PlayerBar from './PlayerBar'

export default function ReviewView({ game, analysis, soundOn = true, perspective = 'white' }) {
  const parsed = useMemo(() => parseGame(game.pgn), [game.pgn])
  const { status, progress, review, engineName, error } = useGameReview(parsed, game.pgn, analysis)
  const isPhone = useMediaQuery('(max-width: 700px)')
  const [ply, setPly] = useState(0)
  const [orientation, setOrientation] = useState(perspective)
  const [panel, setPanel] = useState('summary')

  const maxPly = parsed.moves.length

  // Every navigation goes through here so the move sound plays from the
  // user's gesture (required by iOS). Forward plays the move's sound plus an
  // accent for brilliant / great / blunder moves; back plays the undone move.
  const navigate = useCallback(
    (target) => {
      const next = Math.max(0, Math.min(maxPly, target))
      setPanel('moves')
      if (next === ply) return
      if (soundOn) {
        if (next > ply) {
          const accent = next === ply + 1 ? review?.moves[next - 1]?.classification.key : undefined
          playMove(parsed.moves[next - 1], accent)
        } else {
          playSound(soundForMove(parsed.moves[ply - 1]) === 'capture' ? 'capture' : 'move')
        }
      }
      setPly(next)
    },
    [maxPly, ply, soundOn, review, parsed],
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.target instanceof HTMLSelectElement) return
      const actions = {
        ArrowLeft: () => navigate(ply - 1),
        ArrowRight: () => navigate(ply + 1),
        ArrowUp: () => navigate(0),
        Home: () => navigate(0),
        ArrowDown: () => navigate(maxPly),
        End: () => navigate(maxPly),
        f: () => setOrientation((o) => (o === 'white' ? 'black' : 'white')),
      }
      const action = actions[e.key]
      if (!action) return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, ply, maxPly])

  // Swipe left / right on the board to step through the game on touch screens.
  const touchRef = useRef(null)
  const onTouchStart = (e) => {
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    const start = touchRef.current
    touchRef.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    navigate(ply + (dx < 0 ? 1 : -1))
  }

  const move = ply > 0 ? parsed.moves[ply - 1] : null
  const info = ply > 0 ? review?.moves[ply - 1] : null
  const fen = parsed.positions[ply].fen
  const score = review ? review.scores[ply] : null
  const bestArrow = info && SHOW_BEST_FOR.has(info.classification.key) && info.bestUci !== move.uci ? info.bestUci : null

  const top = orientation === 'white' ? { player: game.black, color: 'black' } : { player: game.white, color: 'white' }
  const bottom = orientation === 'white' ? { player: game.white, color: 'white' } : { player: game.black, color: 'black' }
  const sideToMove = parsed.positions[ply].turn === 'w' ? 'white' : 'black'

  const selectMove = navigate

  return (
    <main className={`review-layout ${panel === 'moves' ? 'show-moves' : 'show-summary'}`}>
      <section className="board-column">
        <PlayerBar {...top} toMove={sideToMove === top.color} />
        <div className="board-row">
          <EvalBar score={score} orientation={orientation} pending={!review} />
          <div className="board-wrap" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <ReviewBoard
              fen={fen}
              lastMove={move}
              classification={info?.classification}
              bestMove={bestArrow}
              orientation={orientation}
            />
          </div>
        </div>
        <PlayerBar {...bottom} toMove={sideToMove === bottom.color} />
      </section>

      <aside className="side-panel">
        <div className="panel-header">
          <span className="panel-title">★ Game Review</span>
          <div className="tabs">
            <button type="button" className={panel === 'summary' ? 'active' : ''} onClick={() => setPanel('summary')}>
              Summary
            </button>
            <button type="button" className={panel === 'moves' ? 'active' : ''} onClick={() => setPanel('moves')}>
              Moves
            </button>
          </div>
        </div>

        {error && <div className="error-box">Analysis error: {error}</div>}

        {panel === 'summary' ? (
          <ReviewSummary
            game={game}
            review={review}
            status={status}
            progress={progress}
            engineName={engineName}
            onSelectFirst={() => selectMove(1)}
          />
        ) : (
          <>
            <MoveFeedback move={move} info={info} status={status} opening={review?.opening} />
            {!review && status !== 'error' && (
              <div className="progress slim">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            )}
            <MoveList
              moves={parsed.moves}
              reviewed={review?.moves}
              ply={ply}
              onSelect={selectMove}
              variant={isPhone ? 'strip' : 'table'}
            />
          </>
        )}

        <NavControls
          ply={ply}
          maxPly={maxPly}
          onChange={selectMove}
          onFlip={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
        />
      </aside>
    </main>
  )
}
