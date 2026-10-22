/**
 * Move Classification Heuristics
 * Mimics Chess.com's classification based on eval changes.
 */

export const MOVE_TYPES = {
  BRILLIANT: { label: 'Brilliant', symbol: '!!', color: 'var(--brilliant)' },
  GREAT: { label: 'Great Move', symbol: '!', color: 'var(--great)' },
  BEST: { label: 'Best Move', symbol: '*', color: 'var(--best)' },
  EXCELLENT: { label: 'Excellent', symbol: '', color: 'var(--excellent)' },
  GOOD: { label: 'Good', symbol: '', color: 'var(--good)' },
  INACCURACY: { label: 'Inaccuracy', symbol: '?!', color: 'var(--inaccuracy)' },
  MISTAKE: { label: 'Mistake', symbol: '?', color: 'var(--mistake)' },
  BLUNDER: { label: 'Blunder', symbol: '??', color: 'var(--blunder)' },
  FORCED: { label: 'Forced', symbol: '', color: 'var(--forced)' },
  BOOK: { label: 'Book', symbol: '', color: 'var(--excellent)' },
};

/**
 * Classifies a move based on centipawn evaluation changes.
 * @param {number} prevEval Evaluation before the move (from POV of side to move)
 * @param {number} currentEval Evaluation after the move (from POV of side who moved)
 * @param {number} bestEval Evaluation if the best move was played
 * @param {boolean} isWin Is the position clearly winning?
 */
export function classifyMove(prevEval, currentEval, bestEval) {
  // Convert all to centipawns. Evaluation is from White's perspective normally.
  // We need to handle the loss relative to the best possible move.
  
  const loss = Math.abs(bestEval - currentEval);
  
  // Chess.com simplified logic
  if (loss === 0) return MOVE_TYPES.BEST;
  if (loss < 10) return MOVE_TYPES.EXCELLENT;
  if (loss < 30) return MOVE_TYPES.GOOD;
  if (loss < 70) return MOVE_TYPES.INACCURACY;
  if (loss < 150) return MOVE_TYPES.MISTAKE;
  return MOVE_TYPES.BLUNDER;
}

/**
 * Calculates accuracy percentage based on average centipawn loss.
 */
export function calculateAccuracy(avgLoss) {
  // Simple formula: accuracy = 100 * exp(-0.005 * avgLoss)
  return Math.max(0, Math.min(100, Math.round(100 * Math.exp(-0.004 * avgLoss))));
}
