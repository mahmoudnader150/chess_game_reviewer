import { useState } from 'react'
import { Chess } from 'chess.js'
import { fetchChessComGames, fetchLichessGames, gameFromPgn } from './services/api-service'
import GameList from './components/GameList'
import ReviewView from './components/ReviewView'

const DEPTHS = [
  { value: 12, label: 'Fast' },
  { value: 14, label: 'Standard' },
  { value: 18, label: 'Deep' },
]

function perspectiveFor(game, username) {
  const name = username.trim().toLowerCase()
  return name && game.black.username.toLowerCase() === name ? 'black' : 'white'
}

export default function App() {
  const [username, setUsername] = useState('')
  const [source, setSource] = useState('chess.com')
  const [games, setGames] = useState([])
  const [searchedUser, setSearchedUser] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [depth, setDepth] = useState(14)
  const [pgnText, setPgnText] = useState('')
  const [showPgn, setShowPgn] = useState(false)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!username.trim()) return
    setLoading(true)
    setError(null)
    setGames([])
    try {
      const fetched = source === 'chess.com' ? await fetchChessComGames(username) : await fetchLichessGames(username)
      if (fetched.length === 0) setError('No standard games found for this user.')
      setGames(fetched)
      setSearchedUser(username.trim())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePgn = () => {
    try {
      const chess = new Chess()
      chess.loadPgn(pgnText.trim())
      if (chess.history().length === 0) throw new Error('The PGN has no moves')
      setError(null)
      setSelectedGame(gameFromPgn(pgnText.trim(), chess.getHeaders()))
    } catch (err) {
      setError(`Invalid PGN: ${err.message}`)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="logo" onClick={() => setSelectedGame(null)}>
          <img src="/knight.svg" alt="" width="28" height="28" />
          <span>Game Reviewer</span>
        </button>
        <div className="topbar-right">
          <label className="depth-select">
            Analysis
            <select value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
              {DEPTHS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label} (depth {d.value})
                </option>
              ))}
            </select>
          </label>
          {selectedGame && (
            <button type="button" className="btn-secondary" onClick={() => setSelectedGame(null)}>
              ← Games
            </button>
          )}
        </div>
      </header>

      {selectedGame ? (
        <ReviewView
          key={`${selectedGame.id}-${depth}`}
          game={selectedGame}
          depth={depth}
          perspective={perspectiveFor(selectedGame, searchedUser)}
        />
      ) : (
        <main className="dashboard">
          <section className="search-card">
            <h1>Review your games</h1>
            <p className="muted">Fetch your recent games from Chess.com or Lichess and get a move-by-move engine review.</p>
            <form className="search-form" onSubmit={handleSearch}>
              <div className="source-toggle" role="radiogroup" aria-label="Game source">
                {['chess.com', 'lichess'].map((s) => (
                  <button
                    type="button"
                    key={s}
                    role="radio"
                    aria-checked={source === s}
                    className={source === s ? 'active' : ''}
                    onClick={() => setSource(s)}
                  >
                    {s === 'chess.com' ? 'Chess.com' : 'Lichess'}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder={`${source === 'chess.com' ? 'Chess.com' : 'Lichess'} username`}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn-primary" disabled={loading || !username.trim()}>
                {loading ? 'Loading…' : 'Get games'}
              </button>
            </form>
            <button type="button" className="link-btn" onClick={() => setShowPgn((v) => !v)}>
              {showPgn ? 'Hide PGN input' : 'Or paste a PGN'}
            </button>
            {showPgn && (
              <div className="pgn-box">
                <textarea
                  rows={6}
                  placeholder='[Event "..."]&#10;1. e4 e5 2. Nf3 ...'
                  value={pgnText}
                  onChange={(e) => setPgnText(e.target.value)}
                />
                <button type="button" className="btn-primary" onClick={handlePgn} disabled={!pgnText.trim()}>
                  Review PGN
                </button>
              </div>
            )}
            {error && <div className="error-box">{error}</div>}
          </section>

          <GameList games={games} username={searchedUser} onSelect={setSelectedGame} />
        </main>
      )}
    </div>
  )
}
