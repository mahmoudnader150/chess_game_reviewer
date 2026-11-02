import { Chess } from 'chess.js'
import { lookupBook } from './book.js'
import { classifyMove } from './classify.js'
import { moveAccuracy, gameAccuracy, estimateGameRating } from './accuracy.js'
import { toWhitePov, whiteWinPercent } from './scoring.js'
import { SUMMARY_ORDER } from './classifications.js'

/**
 * Parse a PGN into the list of positions and moves of the main line.
 * positions[i] is the position before moves[i]; positions[moves.length] is final.
 */
export function parseGame(pgn) {
  const chess = new Chess()
  chess.loadPgn(pgn)
  const headers = chess.getHeaders()
  const moves = chess.history({ verbose: true })
  const startFen = moves.length ? moves[0].before : chess.fen()

  const positions = [{ fen: startFen }]
  for (const m of moves) positions.push({ fen: m.after })

  // Legal-move counts and terminal states.
  const probe = new Chess()
  for (const pos of positions) {
    probe.load(pos.fen)
    pos.turn = probe.turn()
    pos.legalMoveCount = probe.moves().length
    pos.checkmate = probe.isCheckmate()
    pos.draw = !pos.checkmate && (probe.isStalemate() || probe.isInsufficientMaterial())
  }

  return {
    headers,
    startFen,
    positions,
    ending: boardEnding(chess),
    moves: moves.map((m, i) => ({
      ply: i + 1,
      color: m.color,
      san: m.san,
      uci: m.from + m.to + (m.promotion ?? ''),
      from: m.from,
      to: m.to,
      piece: m.piece,
      captured: m.captured ?? null,
      before: m.before,
      after: m.after,
    })),
  }
}

// What the final position itself says about the end of the game.
function boardEnding(chess) {
  if (chess.isCheckmate()) return 'checkmate'
  if (chess.isStalemate()) return 'stalemate'
  if (chess.isInsufficientMaterial()) return 'insufficient'
  if (chess.isThreefoldRepetition()) return 'repetition'
  if (chess.isDrawByFiftyMoves()) return 'fiftyMove'
  return null
}

function uciToSan(fen, uci) {
  if (!uci) return null
  try {
    const chess = new Chess(fen)
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san
  } catch {
    return null
  }
}

// Turn raw engine output into a normalized evaluation for a position.
function evaluatePosition(pos, raw) {
  if (pos.checkmate) {
    // Side to move is mated.
    const winner = pos.turn === 'w' ? 'b' : 'w'
    return { score: { type: 'mate', value: 0, winner }, lines: [] }
  }
  if (pos.draw || !raw || raw.lines.length === 0) {
    return { score: { type: 'cp', value: 0 }, lines: [] }
  }
  const lines = raw.lines.map((l) => ({
    uci: l.pv[0],
    pv: l.pv,
    score: toWhitePov(l.score, pos.turn),
  }))
  return { score: lines[0].score, lines, depth: raw.depth }
}

/**
 * Analyze a parsed game with an engine client and build the full review.
 * onProgress(done, total) is called after each position.
 */
export async function analyzeGame(game, engine, { depth = 14, movetime = 1500, signal, onProgress } = {}) {
  const { positions } = game
  const onAbort = () => engine.cancelAll?.()
  signal?.addEventListener('abort', onAbort)
  try {
    let done = 0
    // All positions are queued at once; a pool engine works on several in parallel.
    const evals = await Promise.all(
      positions.map(async (pos) => {
        const needsEngine = !pos.checkmate && !pos.draw
        const raw = needsEngine ? await engine.analyze(pos.fen, { depth, movetime, multiPv: 2 }) : null
        done += 1
        if (!signal?.aborted) onProgress?.(done, positions.length)
        return evaluatePosition(pos, raw)
      }),
    )
    if (signal?.aborted) throw new DOMException('Review cancelled', 'AbortError')
    return evals
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Analyze and review in one go. */
export async function reviewGame(game, engine, options = {}) {
  return buildReview(game, await analyzeGame(game, engine, options))
}

const pov = (color, whiteWin) => (color === 'w' ? whiteWin : 100 - whiteWin)

// Score of the position before a move, given the score after it. Mate
// distances grow by one when stepping back over a move of the mating side.
function scoreBeforeMove(scoreAfter, moverColor) {
  if (scoreAfter.type !== 'mate') return scoreAfter
  const winner = scoreAfter.value > 0 ? 'w' : scoreAfter.value < 0 ? 'b' : scoreAfter.winner
  const n = Math.abs(scoreAfter.value) + (winner === moverColor ? 1 : 0)
  return { type: 'mate', value: winner === 'w' ? n : -n }
}

// Candidate moves at position i, best first, from the mover's POV. Engine
// lines are the alternatives; the played move's own value comes from the
// (corrected) evaluation of the next position, which looked one ply deeper.
function candidatesAt(i, move, evals, corrected) {
  const color = move.color
  const list = evals[i].lines
    .filter((l) => l.uci !== move.uci)
    .map((l) => ({ uci: l.uci, win: pov(color, whiteWinPercent(l.score)), score: l.score }))
  list.push({
    uci: move.uci,
    win: pov(color, corrected[i + 1].win),
    score: scoreBeforeMove(corrected[i + 1].score, color),
  })
  return list.sort((a, b) => b.win - a.win)
}

// Backward minimax pass: a position is worth the best of its candidates.
// This fixes engine oversights such as a mate that only becomes visible
// a couple of plies later.
function correctEvaluations(game, evals) {
  const { moves } = game
  const corrected = evals.map((e) => ({ score: e.score, win: whiteWinPercent(e.score) }))
  for (let i = moves.length - 1; i >= 0; i -= 1) {
    if (evals[i].lines.length === 0) continue
    const best = candidatesAt(i, moves[i], evals, corrected)[0]
    corrected[i] = { score: best.score, win: pov(moves[i].color, best.win) }
  }
  return corrected
}

// Pure function: given per-position evaluations, classify every move.
export function buildReview(game, evals) {
  const { positions, moves } = game
  const corrected = correctEvaluations(game, evals)
  const whiteWins = corrected.map((c) => c.win)

  let stillInBook = true
  let opening = null
  const reviewed = []

  moves.forEach((move, i) => {
    const color = move.color
    const hasLines = evals[i].lines.length > 0
    const candidates = candidatesAt(i, move, evals, corrected)
    const winAfter = pov(color, whiteWins[i + 1])
    const best = hasLines ? candidates[0] : null
    const second = evals[i].lines.length > 1 ? candidates[1] : null
    const winBefore = best ? best.win : winAfter

    const bookName = stillInBook ? lookupBook(move.after) : null
    if (bookName) opening = bookName
    else stillInBook = false

    const prev = reviewed[i - 1]
    const { classification, loss } = classifyMove({
      fenBefore: move.before,
      uci: move.uci,
      san: move.san,
      color,
      legalMoveCount: positions[i].legalMoveCount,
      isBook: Boolean(bookName),
      winBefore,
      winAfter,
      secondBestWin: second ? second.win : null,
      bestUci: best?.uci ?? null,
      replyPv: evals[i + 1].lines[0]?.pv ?? [],
      prevLoss: prev?.loss ?? 0,
      prevWinBefore: prev ? 100 - prev.winBefore : null,
      prevMove: i > 0 ? moves[i - 1] : null,
    })

    reviewed.push({
      ...move,
      classification,
      loss,
      winBefore,
      winAfter,
      accuracy: moveAccuracy(loss),
      scoreAfter: corrected[i + 1].score,
      scoreBefore: corrected[i].score,
      bestUci: best?.uci ?? null,
      bestSan: best ? uciToSan(move.before, best.uci) : null,
      bestScore: best?.score ?? null,
    })
  })

  const accuracy = gameAccuracy(whiteWins, reviewed)
  const counts = { w: {}, b: {} }
  for (const color of ['w', 'b']) for (const key of SUMMARY_ORDER) counts[color][key] = 0
  for (const m of reviewed) counts[m.color][m.classification.key] = (counts[m.color][m.classification.key] ?? 0) + 1

  const headerOpening = game.headers.Opening ?? openingFromEcoUrl(game.headers.ECOUrl)

  return {
    moves: reviewed,
    evals,
    scores: corrected.map((c) => c.score),
    whiteWins,
    accuracy,
    rating: { w: estimateGameRating(accuracy.w), b: estimateGameRating(accuracy.b) },
    counts,
    opening: headerOpening ?? opening,
  }
}

function openingFromEcoUrl(url) {
  if (!url) return null
  // e.g. ".../Sicilian-Defense-Canal-Attack...10.h3-Bh5" or ".../Italian-Game-3...Bc5"
  const slug = decodeURIComponent(url.split('/').pop() ?? '')
    .split('...')[0]
    .replace(/-\d+\..*$/, '')
    .replace(/-\d+$/, '')
  return slug ? slug.replace(/-/g, ' ') : null
}
