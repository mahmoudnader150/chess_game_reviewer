// Score helpers. Engine scores are converted to White's point of view and
// then to a win percentage (0-100) using Lichess' logistic model, which is
// what accuracy and classifications are based on.

export function winPercentFromCp(cp) {
  const clamped = Math.max(-1000, Math.min(1000, cp))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1)
}

// score: { type: 'cp' | 'mate', value } from the side-to-move POV.
// Returns the same score from White's POV.
export function toWhitePov(score, turn) {
  if (!score) return null
  return turn === 'w' ? { ...score } : { type: score.type, value: -score.value }
}

// Win% for White given a White-POV score.
export function whiteWinPercent(score) {
  if (!score) return 50
  if (score.type === 'mate') {
    if (score.value > 0) return 100
    if (score.value < 0) return 0
    return score.winner === 'w' ? 100 : 0
  }
  return winPercentFromCp(score.value)
}

// Human readable evaluation, e.g. "+1.24", "-0.30", "M3", "-M2", "1-0".
export function formatScore(score) {
  if (!score) return '0.0'
  if (score.type === 'mate') {
    if (score.value === 0) return score.winner === 'w' ? '1-0' : '0-1'
    return `${score.value < 0 ? '-' : ''}M${Math.abs(score.value)}`
  }
  const pawns = score.value / 100
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`
}

// Short form used inside the evaluation bar.
export function formatScoreShort(score) {
  if (!score) return '0.0'
  if (score.type === 'mate') {
    if (score.value === 0) return score.winner === 'w' ? '1-0' : '0-1'
    return `M${Math.abs(score.value)}`
  }
  const pawns = Math.abs(score.value / 100)
  return pawns >= 10 ? pawns.toFixed(0) : pawns.toFixed(1)
}
