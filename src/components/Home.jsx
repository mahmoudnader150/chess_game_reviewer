import MoveIcon from './MoveIcon'
import GameList from './GameList'
import HeroBoard from './HeroBoard'
import { CLASSIFICATIONS } from '../review/classifications'

const FACTS = [
  ['Stockfish 19', 'running in your browser'],
  ['11', 'move classifications'],
  ['3', 'analysis depths'],
  ['No account', 'and nothing to install'],
]

const FEATURES = [
  ['🔍', 'Move-by-move review', 'See what every move was worth, what the engine preferred, and the evaluation at each point in the game.'],
  ['📊', 'Accuracy and game rating', 'Compare both players at a glance. Chess.com and Lichess accuracy is shown when the site has reviewed the game.'],
  ['🏁', 'How the game ended', 'Checkmate, resignation, time out, abandonment or the type of draw, in your game list and at the end of the review.'],
  ['📖', 'Opening detection', 'Book moves are recognized, and the opening you played is named in the summary.'],
  ['🎨', 'Themes', 'Choose an app theme and a board theme from the palette button. Your choice is remembered.'],
  ['📱', 'Works on any screen', 'On phones, swipe the board to step through moves. On desktop, use the keyboard.'],
]

const STEPS = [
  ['Find your game', 'Enter a Chess.com or Lichess username, or paste a PGN from anywhere.'],
  ['Let the engine work', 'Stockfish analyzes every position on your device. A finished review is saved, so reopening it is instant.'],
  ['Learn from it', 'Start with the summary, then step through the moves to see where the game turned.'],
]

const MEANINGS = {
  brilliant: 'A sound sacrifice that keeps you in the game.',
  great: 'The only good move in the position.',
  best: 'The engine’s first choice.',
  excellent: 'Almost as strong as the best move.',
  good: 'A reasonable move that gives up a little.',
  book: 'Known opening theory.',
  forced: 'The only legal move.',
  inaccuracy: 'A small slip that gives up some advantage.',
  mistake: 'A clear error that hurts your position.',
  miss: 'Your opponent slipped and you didn’t punish it.',
  blunder: 'A serious error that can cost the game.',
}

const SHORTCUTS = [
  ['←  →', 'Previous / next move'],
  ['↑  ↓', 'Start / end of the game'],
  ['F', 'Flip the board'],
]

const FAQS = [
  [
    'Why don’t my numbers always match Chess.com?',
    'Chess.com’s accuracy and Game Rating come from a private model and a different engine setup, so a separate review can’t reproduce them exactly. When Chess.com or Lichess has already reviewed a game, its own accuracy is shown and labelled as such. Otherwise the accuracy is an estimate, and Game Rating is always an estimate.',
  ],
  [
    'Is my data uploaded anywhere?',
    'No. Your browser fetches games directly from Chess.com or Lichess, the analysis runs on your device, and reviews and settings stay in this browser’s local storage.',
  ],
  [
    'Which analysis setting should I use?',
    'Standard suits most games. Fast is good for a quick look, and Deep is slower but more reliable in sharp positions. Your device speed affects how long each one takes.',
  ],
]

export default function Home({
  username,
  onUsernameChange,
  source,
  onSourceChange,
  loading,
  error,
  onSearch,
  showPgn,
  onTogglePgn,
  pgnText,
  onPgnTextChange,
  onReviewPgn,
  onReviewSample,
  games,
  searchedUser,
  onSelectGame,
  boardTheme,
  isPhone,
}) {
  const sourceName = source === 'chess.com' ? 'Chess.com' : 'Lichess'
  return (
    <main className="home">
      <section className="hero">
        <div className="hero-copy">
          <h1>Understand every move you play</h1>
          <p className="hero-sub">
            A free game review for your Chess.com and Lichess games, powered by Stockfish and running entirely in your
            browser.
          </p>
          <form className="search-form" onSubmit={onSearch}>
            <div className="source-toggle" role="radiogroup" aria-label="Game source">
              {['chess.com', 'lichess'].map((s) => (
                <button
                  type="button"
                  key={s}
                  role="radio"
                  aria-checked={source === s}
                  className={source === s ? 'active' : ''}
                  onClick={() => onSourceChange(s)}
                >
                  {s === 'chess.com' ? 'Chess.com' : 'Lichess'}
                </button>
              ))}
            </div>
            <div className="search-row">
              <input
                type="text"
                placeholder={`${sourceName} username`}
                aria-label={`${sourceName} username`}
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                autoFocus={!isPhone}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button type="submit" className="btn-primary" disabled={loading || !username.trim()}>
                {loading ? 'Loading…' : 'Get games'}
              </button>
            </div>
          </form>
          <div className="hero-links">
            <button type="button" className="link-btn" onClick={onTogglePgn}>
              {showPgn ? 'Hide PGN input' : 'Paste a PGN'}
            </button>
            <button type="button" className="link-btn" onClick={onReviewSample}>
              Try a sample game
            </button>
          </div>
          {showPgn && (
            <div className="pgn-box">
              <textarea
                rows={6}
                aria-label="PGN"
                placeholder='[Event "..."]&#10;1. e4 e5 2. Nf3 ...'
                value={pgnText}
                onChange={(e) => onPgnTextChange(e.target.value)}
              />
              <button type="button" className="btn-primary" onClick={onReviewPgn} disabled={!pgnText.trim()}>
                Review PGN
              </button>
            </div>
          )}
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
        </div>
        {!isPhone && <HeroBoard boardTheme={boardTheme} />}
      </section>

      {loading && (
        <div className="game-skeletons" aria-label="Loading games">
          {Array.from({ length: 5 }, (_, i) => (
            <div className="game-skeleton" key={i} />
          ))}
        </div>
      )}
      <GameList games={games} username={searchedUser} onSelect={onSelectGame} />

      <ul className="facts">
        {FACTS.map(([value, label]) => (
          <li key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <section className="home-section">
        <h2>Everything you need from a review</h2>
        <div className="feature-grid">
          {FEATURES.map(([icon, title, text]) => (
            <article className="feature-card" key={title}>
              <span className="feature-icon" aria-hidden="true">
                {icon}
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2>How it works</h2>
        <ol className="steps">
          {STEPS.map(([title, text]) => (
            <li key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section">
        <h2>What the move icons mean</h2>
        <ul className="legend">
          {Object.values(CLASSIFICATIONS).map((c) => (
            <li key={c.key}>
              <MoveIcon classification={c} size={24} />
              <span>
                <strong>{c.label}</strong>
                <span className="legend-text">{MEANINGS[c.key]}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {!isPhone && (
        <section className="home-section">
          <h2>Keyboard shortcuts</h2>
          <ul className="shortcuts">
            {SHORTCUTS.map(([keys, label]) => (
              <li key={label}>
                <kbd>{keys}</kbd>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="home-section">
        <h2>Questions</h2>
        <div className="faq">
          {FAQS.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <p>Not affiliated with Chess.com or Lichess.</p>
        <p>
          Analysis by{' '}
          <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noreferrer">
            Stockfish.js
          </a>
          , licensed under the{' '}
          <a href={`${import.meta.env.BASE_URL}stockfish/COPYING.txt`} target="_blank" rel="noreferrer">
            GPLv3
          </a>
          .
        </p>
      </footer>
    </main>
  )
}
