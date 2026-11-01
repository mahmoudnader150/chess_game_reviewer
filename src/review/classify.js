import { Chess } from 'chess.js'
import { CLASSIFICATIONS as C } from './classifications.js'

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

// Win% thresholds (in percentage points lost, from the mover's POV).
const EXCELLENT_MAX = 2
const GOOD_MAX = 5
const INACCURACY_MAX = 10
const MISTAKE_MAX = 20

function lossClass(loss) {
  if (loss <= EXCELLENT_MAX) return C.excellent
  if (loss <= GOOD_MAX) return C.good
  if (loss <= INACCURACY_MAX) return C.inaccuracy
  if (loss <= MISTAKE_MAX) return C.mistake
  return C.blunder
}

// A piece is "hanging" if the opponent can take it and come out ahead:
// it's attacked by something cheaper, or attacked and not defended at all.
function hangingValue(chess, color) {
  const enemy = color === 'w' ? 'b' : 'w'
  let total = 0
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== color || piece.type === 'k' || piece.type === 'p') continue
      const attackers = chess.attackers(piece.square, enemy)
      if (attackers.length === 0) continue
      const value = PIECE_VALUE[piece.type]
      const cheapest = Math.min(...attackers.map((sq) => PIECE_VALUE[chess.get(sq).type]))
      const defended = chess.attackers(piece.square, color).length > 0
      if (cheapest < value || !defended) total = Math.max(total, value)
    }
  }
  return total
}

// Material from `color`'s point of view.
function materialBalance(chess, color) {
  let sum = 0
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.type === 'k') continue
      sum += piece.color === color ? PIECE_VALUE[piece.type] : -PIECE_VALUE[piece.type]
    }
  }
  return sum
}

function playUci(chess, uci) {
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  } catch {
    return null
  }
}

// Did the move give up material on purpose? True if after the move the mover
// leaves a piece en prise (worth more than what was just captured), or if
// after the engine's best reply (and our follow-up) the mover is still down.
export function isSacrifice(fenBefore, move, replyPv) {
  const chess = new Chess(fenBefore)
  const color = chess.turn()
  const balanceBefore = materialBalance(chess, color)
  const played = playUci(chess, move)
  if (!played) return false

  const captured = played.captured ? PIECE_VALUE[played.captured] : 0
  const hanging = hangingValue(chess, color)
  if (hanging >= 3 && hanging > captured + 1) return true

  // Follow the opponent's best reply and our follow-up: if we are still two
  // or more points down, material was given up. Looking further ahead would
  // credit this move with later sacrifices in the line.
  const line = (replyPv ?? []).slice(0, 2)
  let played2 = 0
  for (const uci of line) {
    if (!playUci(chess, uci)) break
    played2 += 1
  }
  return played2 > 0 && materialBalance(chess, color) <= balanceBefore - 2
}

/**
 * Classify one move.
 *
 * ctx:
 *   fenBefore, uci, san, color
 *   legalMoveCount     legal moves available before the move
 *   isBook             position after the move is opening theory
 *   winBefore          mover's win% with best play (from the position before)
 *   winAfter           mover's win% after the played move
 *   secondBestWin      mover's win% after the engine's 2nd choice (or null)
 *   bestUci            engine's top move
 *   replyPv            engine's best line for the opponent after the move
 *   prevLoss           win% the opponent lost on their previous move
 *   prevWinBefore      mover's win% before the opponent's previous move
 *   prevMove           the opponent's previous move (chess.js verbose) or null
 */
export function classifyMove(ctx) {
  const loss = Math.max(0, ctx.winBefore - ctx.winAfter)

  if (ctx.isBook) return { classification: C.book, loss }
  if (ctx.legalMoveCount === 1) return { classification: C.forced, loss }

  const isTop = ctx.uci === ctx.bestUci || loss <= 0.3

  if (isTop || loss <= EXCELLENT_MAX) {
    // Brilliant: a good sacrifice that doesn't leave us worse, and wasn't
    // played in an already completely winning position.
    if (
      loss <= EXCELLENT_MAX &&
      ctx.winAfter >= 50 &&
      ctx.winBefore <= 97 &&
      isSacrifice(ctx.fenBefore, ctx.uci, ctx.replyPv)
    ) {
      return { classification: C.brilliant, loss }
    }

    // Great: the only good move. The engine's second choice is much worse and
    // this isn't a trivial recapture.
    const isRecapture = ctx.prevMove?.captured && ctx.uci.slice(2, 4) === ctx.prevMove.to
    if (
      isTop &&
      ctx.secondBestWin != null &&
      ctx.winBefore - ctx.secondBestWin >= 15 &&
      ctx.winAfter >= 35 &&
      ctx.winBefore <= 97 &&
      !isRecapture
    ) {
      return { classification: C.great, loss }
    }

    if (isTop) return { classification: C.best, loss }
  }

  const base = lossClass(loss)

  // Miss: the opponent just made an error that gave us a chance, and we let it
  // slip (without making things worse than before their error).
  if (
    (base === C.mistake || base === C.blunder || base === C.inaccuracy) &&
    loss >= 8 &&
    ctx.prevLoss >= 10 &&
    ctx.winBefore >= 60 &&
    ctx.prevWinBefore != null &&
    ctx.winAfter >= ctx.prevWinBefore - 5
  ) {
    return { classification: C.miss, loss }
  }

  return { classification: base, loss }
}
