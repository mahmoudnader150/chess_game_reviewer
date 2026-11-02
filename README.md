# Chess Game Reviewer

A chess.com-style **Game Review** for your Chess.com and Lichess games, running
entirely in the browser.

- Fetch recent games by username from the public **Chess.com** and **Lichess** APIs, or paste a PGN
- Engine analysis with **Stockfish 19** (WASM, in a web worker). If Stockfish can't load, it falls back to the built-in JS engine
- Move classifications with icons: Brilliant, Great, Best, Excellent, Good, Book, Forced, Inaccuracy, Mistake, Miss, Blunder
- The classification badge is drawn on the moved piece, and its squares are highlighted in the classification color
- The engine's best move is drawn as an arrow when you didn't play it
- **Accuracy** per player, an estimated **Game Rating**, and per-player classification counts
- Move history with icons. Click a move to jump to it
- Step forward and back with the buttons or the keyboard (← → ↑ ↓ Home End), and press `F` to flip the board
- An evaluation bar and a coach box ("Nf6 is a mistake — Qf6 was best")
- Opening detection (from PGN headers, or the built-in opening book)
- **How the game ended:** checkmate, resignation, time out, abandonment or the type of draw, shown in the game list, the summary, the move list and on the kings in the final position
- **Themes:** 4 app themes and 6 board themes from the 🎨 button, remembered between visits
- **Home page** with an animated demo board, a sample game, game filters (wins / losses / draws), a guide to the move icons and an FAQ. Your last username is remembered
- **Fast analysis:** positions are analyzed in parallel by a pool of Stockfish workers (up to 6 on desktop, 3 on phones/tablets), each position has a time cap, the engine warms up while the intro plays, and finished reviews are saved in `localStorage` so reopening a game is instant
- **Move sounds** (synthesized with the Web Audio API, no audio files): move, capture, castle, check, promotion and game end, plus a short accent for Brilliant / Great / Blunder moves. Toggle with the 🔊 button
- **Intro animation** when the app opens (click, tap or any key skips it; respects "reduce motion")
- **Responsive** for phones, tablets (portrait and landscape) and desktop: on phones the board goes edge to edge, moves scroll in a horizontal strip, the controls stay pinned at the bottom, and you can swipe the board left/right to step through moves

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

`predev` and `prebuild` copy the Stockfish lite single-threaded build from
`node_modules/stockfish` into `public/stockfish/`. That folder is git-ignored.
This build needs no special COOP/COEP headers, so any static host works.

```bash
npm run build            # production build into dist/
npm run perft            # move-generator correctness tests for the built-in engine
npm run check:openings   # verify that every opening-book line is legal
npm run lint
```

## Deploying

The app is hosted on Vercel, which detects the Vite setup automatically:

```bash
npx vercel --prod
```

The output of `npm run build` is a plain static site, so any static host works. Set `VITE_BASE=/some-path/` when building if it isn't served from the domain root.

## How the review works

1. **Parse** the PGN with chess.js into positions `p0 … pN`.
2. **Analyze** each position with Stockfish (Fast: depth 12, max 0.5s per position / Standard: depth 14, max 1.2s / Deep: depth 18, max 3s), using MultiPV 2 so the second-best move is known too. Positions are spread over several workers in parallel.
3. **Correct** the evaluations with a backward minimax pass. A played move is valued by the search of the *next* position, which looks one ply deeper. The engine's other lines are the alternatives. This catches cases where the engine missed something, such as a mate, one ply earlier.
4. **Convert** every evaluation to a win percentage (Lichess' logistic model). Each move's *loss* is the drop in the mover's win% compared with the best move.
5. **Classify** each move (`src/review/classify.js`):

| Classification | Rule (win% loss from the mover's point of view) |
| --- | --- |
| Book | The position after the move is in the opening book, and every earlier move was book too |
| Forced | It was the only legal move |
| Brilliant | Best or near-best (≤ 2%) **and** a sacrifice: a piece is left en prise, or material is still down after the reply. The mover isn't worse afterwards and wasn't already completely winning |
| Great | The engine's top move, and the second-best move is ≥ 15% worse (the "only move"). Not a simple recapture |
| Best | The engine's top move |
| Excellent / Good | ≤ 2% / ≤ 5% |
| Inaccuracy / Mistake / Blunder | ≤ 10% / ≤ 20% / > 20% |
| Miss | A bad move right after the opponent erred, which lets their mistake go unpunished |

6. **Accuracy** per move is `103.17·e^(−0.12·loss) + 14.83`, capped to 0–100. Game accuracy blends a volatility-weighted mean and a harmonic mean, the same method Lichess uses. If Chess.com or Lichess has already reviewed the game, its own accuracy is shown instead, and labelled.
7. **Game Rating** starts from the player's rating and moves up or down by 40 points for each accuracy point above or below what's typical at that rating. Without a known rating, it's the rating where that accuracy is typical.

### How close are the numbers to Chess.com?

Chess.com's accuracy and Game Rating models are private, so they can only be approximated. The accuracy curve was fitted to Chess.com's official accuracy on 57 public games and tested on 25 others, across all rating levels. On the test games, the average error fell from 7.0 to 5.0 points, so expect differences of a few points, and more on some games, when Chess.com hasn't reviewed the game.

Game Rating couldn't be measured this way because Chess.com's API doesn't return it. The typical accuracy per rating comes from real data (4,592 player results), but the 40-points-per-accuracy-point slope is an assumption.

Move classifications are also heuristics that approximate Chess.com's model, not a copy of it.

## Project layout

```
src/
  App.jsx                    app shell, game fetching, settings
  components/                Home, ThemePicker, GameEndBanner, ReviewView, ReviewBoard, MoveList, …
  theme/themes.js            app and board theme definitions
  hooks/useGameReview.js     runs a review (or loads a saved one)
  audio/sounds.js            synthesized move sounds
  review/                    parsing, scoring, classification, accuracy, game end, opening book
  engine/
    stockfishClient.js       UCI wrapper around a Stockfish web worker + parallel EnginePool
    engineManager.js         shared engine instance, warmed up on app start
    localClient.js           same interface over the built-in engine (fallback)
    engine.js, worker.js     built-in 0x88 JavaScript engine
  services/api-service.js    Chess.com and Lichess API clients
scripts/                     perft tests, opening-book check, Stockfish copy step
```
