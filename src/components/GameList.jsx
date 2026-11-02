import { useState } from 'react'
import { describeGameEnd } from '../review/gameEnd'

const TIME_ICONS = { bullet: '⁍', blitz: '⚡', rapid: '⏱', classical: '♜', daily: '☀', correspondence: '✉', ultraBullet: '⁍' }

const FILTERS = [
  ['all', 'All'],
  ['win', 'Wins'],
  ['loss', 'Losses'],
  ['draw', 'Draws'],
]

function outcomeFor(game, username) {
  const name = username?.toLowerCase()
  const side = game.white.username.toLowerCase() === name ? game.white : game.black.username.toLowerCase() === name ? game.black : null
  return side?.result ?? null
}

export default function GameList({ games, username, onSelect }) {
  const [filter, setFilter] = useState('all')
  if (games.length === 0) return null
  const visible = filter === 'all' ? games : games.filter((game) => outcomeFor(game, username) === filter)
  return (
    <section className="game-section">
      <div className="game-section-header">
        <h2>
          {games.length} recent {games.length === 1 ? 'game' : 'games'}
          {username && <span className="muted"> for {username}</span>}
        </h2>
        <div className="tabs" role="group" aria-label="Filter games by result">
          {FILTERS.map(([key, label]) => (
            <button type="button" key={key} className={filter === key ? 'active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="game-list">
        {visible.length === 0 && <p className="muted game-list-empty">No games match this filter.</p>}
        {visible.map((game) => {
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
              <span className="game-outcome">
                <span className={`game-result ${outcome ?? ''}`}>{game.result}</span>
                <span className="game-end-label">{describeGameEnd(game).label}</span>
              </span>
              <span className="game-meta">
                <span>{game.date.toLocaleDateString()}</span>
                <span className="muted">{game.source}</span>
              </span>
              <span className="game-review-cta">Review</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
