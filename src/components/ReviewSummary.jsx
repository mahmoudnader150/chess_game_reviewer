import MoveIcon from './MoveIcon'
import { CLASSIFICATIONS, SUMMARY_ORDER } from '../review/classifications'

function Accuracy({ value, side }) {
  return <div className={`accuracy-box ${side}`}>{value == null ? '—' : value.toFixed(1)}</div>
}

// Accuracy, game rating and classification counts for both players.
export default function ReviewSummary({ game, review, status, progress, engineName, onSelectFirst }) {
  if (!review) {
    return (
      <div className="summary">
        <div className="summary-loading">
          <div className="spinner" />
          <div>
            {status === 'loading' && 'Loading engine…'}
            {status === 'analyzing' && `Analyzing with ${engineName} — ${progress}%`}
            {status === 'error' && 'Analysis failed.'}
          </div>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    )
  }

  const { accuracy, rating, counts } = review
  return (
    <div className="summary">
      <div className="summary-grid">
        <div />
        <div className="summary-player" title={game.white.username}>
          {game.white.username}
        </div>
        <div />
        <div className="summary-player" title={game.black.username}>
          {game.black.username}
        </div>

        <div className="summary-label">Accuracy</div>
        <Accuracy value={accuracy.w} side="white" />
        <div />
        <Accuracy value={accuracy.b} side="black" />

        {SUMMARY_ORDER.map((key) => {
          const c = CLASSIFICATIONS[key]
          return (
            <div className="summary-row" key={key} style={{ '--move-color': c.color }}>
              <div className="summary-label">{c.label}</div>
              <div className="summary-count">{counts.w[key]}</div>
              <MoveIcon classification={c} size={20} />
              <div className="summary-count">{counts.b[key]}</div>
            </div>
          )
        })}

        <div className="summary-label">Game Rating</div>
        <div className="rating-box">{rating.w ?? '—'}</div>
        <div />
        <div className="rating-box">{rating.b ?? '—'}</div>
      </div>
      {review.opening && <div className="summary-opening">📖 {review.opening}</div>}
      <button type="button" className="btn-primary wide" onClick={onSelectFirst}>
        Start Review
      </button>
      <div className="summary-engine">Engine: {engineName}</div>
    </div>
  )
}
