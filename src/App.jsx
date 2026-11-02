import { useCallback, useEffect, useState } from 'react'
import { Chess } from 'chess.js'
import { fetchChessComGames, fetchLichessGames, gameFromPgn } from './services/api-service'
import { warmUpEngine } from './engine/engineManager'
import { unlockAudio } from './audio/sounds'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useMediaQuery } from './hooks/useMediaQuery'
import GameList from './components/GameList'
import ReviewView from './components/ReviewView'
import Splash from './components/Splash'

// depth = target search depth, movetime = hard cap per position (ms) so a
// single complicated position can't stall the whole review.
const PRESETS = {
  fast: { label: 'Fast', depth: 12, movetime: 500 },
  standard: { label: 'Standard', depth: 14, movetime: 1200 },
  deep: { label: 'Deep', depth: 18, movetime: 3000 },
}

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
  const [presetKey, setPresetKey] = useLocalStorage('settings:analysis', 'standard')
  const [soundOn, setSoundOn] = useLocalStorage('settings:sound', true)
  const [showSplash, setShowSplash] = useState(true)
  const hideSplash = useCallback(() => setShowSplash(false), [])
  const preset = PRESETS[presetKey] ?? PRESETS.standard
  const isPhone = useMediaQuery('(max-width: 700px)')

  // Start compiling Stockfish while the user is still picking a game.
  useEffect(() => {
    warmUpEngine()
  }, [])
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
    <div className="app" onPointerDown={unlockAudio}>
      {showSplash && <Splash onDone={hideSplash} />}
      <header className="topbar">
        <button type="button" className="logo" onClick={() => setSelectedGame(null)}>
          <img src="/knight.svg" alt="" width="28" height="28" />
          <span className="logo-text">Game Reviewer</span>
        </button>
        <div className="topbar-right">
          <button
            type="button"
            className={`icon-btn ${soundOn ? '' : 'off'}`}
            title={soundOn ? 'Mute move sounds' : 'Unmute move sounds'}
            aria-label={soundOn ? 'Mute move sounds' : 'Unmute move sounds'}
            aria-pressed={soundOn}
            onClick={() => {
              unlockAudio()
              setSoundOn((v) => !v)
            }}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <label className="depth-select">
            <span className="depth-label">Analysis</span>
            <select value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
              {Object.entries(PRESETS).map(([key, p]) => (
                <option key={key} value={key}>
                  {isPhone ? p.label : `${p.label} (depth ${p.depth})`}
                </option>
              ))}
            </select>
          </label>
          {selectedGame && (
            <button type="button" className="btn-secondary" onClick={() => setSelectedGame(null)}>
              ←<span className="hide-phone"> Games</span>
            </button>
          )}
        </div>
      </header>

      {selectedGame ? (
        <ReviewView
          key={`${selectedGame.id}-${presetKey}`}
          game={selectedGame}
          analysis={preset}
          soundOn={soundOn}
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
