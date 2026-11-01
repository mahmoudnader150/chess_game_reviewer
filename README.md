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

## How the review works

1. **Parse** the PGN with chess.js into positions `p0 … pN`.
2. **Analyze** each position with Stockfish at the chosen depth (Fast 12 / Standard 14 / Deep 18), using MultiPV 2 so the second-best move is known too.
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

6. **Accuracy** per move is `103.17·e^(−0.0435·loss) − 3.17`. Game accuracy blends a volatility-weighted mean and a harmonic mean, the same method Lichess uses. The **Game Rating** is a rough accuracy-to-Elo mapping.

These are heuristics that approximate chess.com's proprietary model, not a copy of it.

## Project layout

```
src/
  App.jsx                    search screen, PGN input, depth selector
  components/                ReviewView, ReviewBoard, MoveIcon, MoveList, EvalBar, …
  hooks/useGameReview.js     runs a review with Stockfish (or the fallback) and caches it
  review/                    parsing, scoring, classification, accuracy, opening book
  engine/
    stockfishClient.js       UCI wrapper around the Stockfish web worker
    localClient.js           same interface over the built-in engine (fallback)
    engine.js, worker.js     built-in 0x88 JavaScript engine
  services/api-service.js    Chess.com and Lichess API clients
scripts/                     perft tests, opening-book check, Stockfish copy step
```
