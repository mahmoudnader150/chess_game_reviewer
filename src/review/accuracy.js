// Accuracy model (same as Lichess, which tracks chess.com's CAPS closely).

export function moveAccuracy(winLoss) {
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * Math.max(0, winLoss)) - 3.166924740191411
  // +1 "uncertainty bonus" for imperfect analysis, as Lichess does.
  return Math.max(0, Math.min(100, raw + 1))
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

// Rough "Game Rating": the rating at which this accuracy is typical.
const RATING_CURVE = [
  [0, 100],
  [40, 400],
  [50, 700],
  [60, 1000],
  [70, 1350],
  [75, 1550],
  [80, 1750],
  [85, 2000],
  [90, 2300],
  [95, 2650],
  [100, 3000],
]

export function estimateGameRating(accuracy) {
  if (accuracy == null) return null
  for (let i = 1; i < RATING_CURVE.length; i += 1) {
    const [a1, r1] = RATING_CURVE[i]
    if (accuracy <= a1) {
      const [a0, r0] = RATING_CURVE[i - 1]
      const t = (accuracy - a0) / (a1 - a0)
      return Math.round((r0 + t * (r1 - r0)) / 50) * 50
    }
  }
  return 3000
}
