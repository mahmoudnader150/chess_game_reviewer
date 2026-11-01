const TIME_ICONS = { bullet: '⁍', blitz: '⚡', rapid: '⏱', classical: '♜', daily: '☀', correspondence: '✉', ultraBullet: '⁍' }

function outcomeFor(game, username) {
  const name = username?.toLowerCase()
  const side = game.white.username.toLowerCase() === name ? game.white : game.black.username.toLowerCase() === name ? game.black : null
  return side?.result ?? null
}

export default function GameList({ games, username, onSelect }) {
  if (games.length === 0) return null
  return (
    <div className="game-list">
      {games.map((game) => {
        const outcome = outcomeFor(game, username)
        return (
          <button type="button" key={game.id} className="game-card" onClick={() => onSelect(game)}>
            <span className="game-time" title={game.timeClass}>
              {TIME_ICONS[game.timeClass] ?? '♟'}
            </span>
            <span className="game-players">
              <span className={`game-player ${game.white.result === 'win' ? 'winner' : ''}`}>
                <span className="player-swatch white" /> {game.white.username}
                {game.white.rating !== '' && <span className="muted"> ({game.white.rating})</span>}
              </span>
              <span className={`game-player ${game.black.result === 'win' ? 'winner' : ''}`}>
                <span className="player-swatch black" /> {game.black.username}
                {game.black.rating !== '' && <span className="muted"> ({game.black.rating})</span>}
              </span>
            </span>
            <span className={`game-result ${outcome ?? ''}`}>{game.result}</span>
            <span className="game-meta">
              <span>{game.date.toLocaleDateString()}</span>
              <span className="muted">{game.source}</span>
            </span>
            <span className="game-review-cta">Review</span>
          </button>
        )
      })}
    </div>
  )
}
