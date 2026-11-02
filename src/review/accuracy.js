// Accuracy model. The shape comes from Lichess, but the per-move curve is fitted
// to Chess.com's official accuracy on 57 reviewed games, analyzed with this app's
// Standard preset (and checked on 25 more). Chess.com's own model isn't public, so
// this is an approximation. Compared with Lichess's curve, losses under about 1.6%
// count as perfect, larger ones cost more, and even a blunder keeps about 15 points.
const CURVE_SCALE = 103.1668100711649
const CURVE_DECAY = 0.12
const CURVE_OFFSET = 14.83

export function moveAccuracy(winLoss) {
  const raw = CURVE_SCALE * Math.exp(-CURVE_DECAY * Math.max(0, winLoss)) + CURVE_OFFSET
  return Math.max(0, Math.min(100, raw))
}

function stdDev(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

// whiteWins: White win% for every position (length = moves + 1).
// moves: [{ color: 'w'|'b', accuracy }]
// Returns { w, b } game accuracies (0-100), or null for a side without moves.
export function gameAccuracy(whiteWins, moves) {
  if (moves.length === 0) return { w: null, b: null }
  const windowSize = Math.max(2, Math.min(8, Math.floor(moves.length / 10)))

  // One volatility weight per move, from a sliding window of positions.
  const windows = []
  const head = whiteWins.slice(0, windowSize)
  for (let i = 0; i < Math.min(windowSize, whiteWins.length) - 2; i += 1) windows.push(head)
  for (let i = 0; i + windowSize <= whiteWins.length; i += 1) windows.push(whiteWins.slice(i, i + windowSize))
  const weights = moves.map((_, i) => {
    const w = windows[i] ?? windows[windows.length - 1] ?? [50]
    return Math.max(0.5, Math.min(12, stdDev(w)))
  })

  const result = {}
  for (const color of ['w', 'b']) {
    const idx = moves.map((m, i) => (m.color === color ? i : -1)).filter((i) => i >= 0)
    if (idx.length === 0) {
      result[color] = null
      continue
    }
    let weighted = 0
    let weightSum = 0
    let harmonic = 0
    for (const i of idx) {
      const acc = moves[i].accuracy
      weighted += acc * weights[i]
      weightSum += weights[i]
      harmonic += 1 / Math.max(acc, 0.5)
    }
    const weightedMean = weighted / weightSum
    const harmonicMean = idx.length / harmonic
    result[color] = (weightedMean + harmonicMean) / 2
  }
  return result
}

// Typical accuracy at each rating: medians from 4,592 reviewed Chess.com games
// (official accuracy against the player's rating, smoothed to be increasing).
// Accuracy barely moves across a huge rating range, and a single game varies
// by about 10 points at any rating, so accuracy alone can't identify a rating.
const TYPICAL_ACCURACY = [
  [350, 64],
  [650, 68],
  [950, 72],
  [1250, 75.5],
  [1550, 77.5],
  [1850, 79.5],
  [2150, 81],
  [2450, 83],
  [2750, 84],
  [3050, 86],
]

// Rating points per accuracy point above or below what's typical for the player.
// An assumption, not a measurement: Chess.com doesn't publish Game Rating. It
// makes a typical 10-point swing worth 400 rating points.
const RATING_PER_ACCURACY_POINT = 40

function interpolate(table, x, from, to) {
  if (x <= table[0][from]) return table[0][to]
  for (let i = 1; i < table.length; i += 1) {
    if (x <= table[i][from]) {
      const t = (x - table[i - 1][from]) / (table[i][from] - table[i - 1][from])
      return table[i - 1][to] + t * (table[i][to] - table[i - 1][to])
    }
  }
  return table[table.length - 1][to]
}

/**
 * Estimated "Game Rating": how the player's rating would be adjusted for this
 * game's accuracy. Without a known rating, it's the rating where this accuracy
 * is typical. Chess.com's own figure isn't available from its API.
 */
export function estimateGameRating(accuracy, playerRating = null) {
  if (accuracy == null) return null
  const rating = Number(playerRating)
  const estimate =
    Number.isFinite(rating) && rating > 0
      ? rating + (accuracy - interpolate(TYPICAL_ACCURACY, rating, 0, 1)) * RATING_PER_ACCURACY_POINT
      : interpolate(TYPICAL_ACCURACY, accuracy, 1, 0)
  return Math.max(100, Math.min(3200, Math.round(estimate / 50) * 50))
}

const OFFICIAL_SOURCE_NAMES = { 'chess.com': 'Chess.com', lichess: 'Lichess' }

/**
 * The numbers shown in the summary. The source site's own accuracy wins over our
 * estimate when the game was reviewed there.
 */
export function summaryStats(game, review) {
  const official = game.officialAccuracy
  const accuracy = {
    w: official?.w ?? review.accuracy.w,
    b: official?.b ?? review.accuracy.b,
  }
  return {
    accuracy,
    rating: {
      w: estimateGameRating(accuracy.w, game.white.rating),
      b: estimateGameRating(accuracy.b, game.black.rating),
    },
    accuracySource: official ? OFFICIAL_SOURCE_NAMES[game.source] : null,
    sourceName: OFFICIAL_SOURCE_NAMES[game.source] ?? null,
  }
}
