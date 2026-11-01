import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseGame } from '../review/reviewGame'
import { SHOW_BEST_FOR } from '../review/classifications'
import { useGameReview } from '../hooks/useGameReview'
import ReviewBoard from './ReviewBoard'
import EvalBar from './EvalBar'
import MoveList from './MoveList'
import MoveFeedback from './MoveFeedback'
import ReviewSummary from './ReviewSummary'
import NavControls from './NavControls'
import PlayerBar from './PlayerBar'

export default function ReviewView({ game, depth, perspective = 'white' }) {
  const parsed = useMemo(() => parseGame(game.pgn), [game.pgn])
  const { status, progress, review, engineName, error } = useGameReview(parsed, game.pgn, depth)
  const [ply, setPly] = useState(0)
  const [orientation, setOrientation] = useState(perspective)
  const [panel, setPanel] = useState('summary')

  const maxPly = parsed.moves.length
  const goTo = useCallback((target) => setPly(Math.max(0, Math.min(maxPly, target))), [maxPly])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const actions = {
        ArrowLeft: () => setPly((p) => Math.max(0, p - 1)),
        ArrowRight: () => setPly((p) => Math.min(maxPly, p + 1)),
        ArrowUp: () => setPly(0),
        Home: () => setPly(0),
        ArrowDown: () => setPly(maxPly),
        End: () => setPly(maxPly),
        f: () => setOrientation((o) => (o === 'white' ? 'black' : 'white')),
      }
      const action = actions[e.key]
      if (!action) return
      e.preventDefault()
      action()
      if (e.key !== 'f') setPanel('moves')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [maxPly])

  const move = ply > 0 ? parsed.moves[ply - 1] : null
  const info = ply > 0 ? review?.moves[ply - 1] : null
  const fen = parsed.positions[ply].fen
  const score = review ? review.scores[ply] : null
  const bestArrow = info && SHOW_BEST_FOR.has(info.classification.key) && info.bestUci !== move.uci ? info.bestUci : null

  const top = orientation === 'white' ? { player: game.black, color: 'black' } : { player: game.white, color: 'white' }
  const bottom = orientation === 'white' ? { player: game.white, color: 'white' } : { player: game.black, color: 'black' }
  const sideToMove = parsed.positions[ply].turn === 'w' ? 'white' : 'black'

  const selectMove = (target) => {
    goTo(target)
    setPanel('moves')
  }

  return (
    <main className="review-layout">
      <section className="board-column">
        <PlayerBar {...top} toMove={sideToMove === top.color} />
        <div className="board-row">
          <EvalBar score={score} orientation={orientation} pending={!review} />
          <div className="board-wrap">
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
            <MoveList moves={parsed.moves} reviewed={review?.moves} ply={ply} onSelect={selectMove} />
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
