import MoveIcon from './MoveIcon'
import { formatScore } from '../review/scoring'
import { SHOW_BEST_FOR } from '../review/classifications'

const PHRASES = {
  brilliant: 'is brilliant',
  great: 'is a great move',
  best: 'is best',
  excellent: 'is excellent',
  good: 'is good',
  book: 'is a book move',
  forced: 'is forced',
  inaccuracy: 'is an inaccuracy',
  mistake: 'is a mistake',
  miss: 'is a miss',
  blunder: 'is a blunder',
}

const DETAILS = {
  brilliant: 'A strong sacrifice that the opponent can’t profitably accept.',
  great: 'The only move that keeps the advantage — everything else is much worse.',
  forced: 'It was the only legal move.',
  miss: 'Your opponent just slipped and this move let the chance go.',
}

// Coach box above the move list describing the current move.
export default function MoveFeedback({ move, info, status, opening }) {
  if (!move) {
    return (
      <div className="feedback">
        <div className="feedback-title">Starting position</div>
        {opening && <div className="feedback-sub">{opening}</div>}
      </div>
    )
  }
  if (!info) {
    return (
      <div className="feedback">
        <div className="feedback-title">
          <span className="feedback-san">{move.san}</span>
        </div>
        <div className="feedback-sub">{status === 'error' ? 'Analysis failed' : 'Analyzing…'}</div>
      </div>
    )
  }

  const c = info.classification
  const showBest = SHOW_BEST_FOR.has(c.key) && info.bestSan && info.bestSan !== move.san
  return (
    <div className="feedback" style={{ '--move-color': c.color }}>
      <div className="feedback-title">
        <MoveIcon classification={c} size={26} />
        <span>
          <span className="feedback-san">{move.san}</span> {PHRASES[c.key]}
        </span>
        <span className="feedback-eval">{formatScore(info.scoreAfter)}</span>
      </div>
      {DETAILS[c.key] && <div className="feedback-sub">{DETAILS[c.key]}</div>}
      {c.key === 'book' && opening && <div className="feedback-sub">{opening}</div>}
      {showBest && (
        <div className="feedback-best">
          <MoveIcon classification={{ key: 'best', label: 'Best', color: '#81b64c' }} size={18} />
          <span>
            <span className="feedback-san">{info.bestSan}</span> was best
          </span>
          <span className="feedback-eval muted">{formatScore(info.bestScore)}</span>
        </div>
      )}
    </div>
  )
}
