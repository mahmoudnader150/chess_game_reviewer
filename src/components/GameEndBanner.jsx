// How the game ended, e.g. "Hikaru won by resignation".
export default function GameEndBanner({ end, compact = false }) {
  const tone = end.winner ? 'decisive' : 'neutral'
  return (
    <div className={`game-end ${tone} ${compact ? 'compact' : ''}`}>
      <span className="game-end-icon" aria-hidden="true">
        {end.icon}
      </span>
      <span className="game-end-text">
        <strong>{end.title}</strong>
        {end.detail && ` ${end.detail}`}
      </span>
    </div>
  )
}
