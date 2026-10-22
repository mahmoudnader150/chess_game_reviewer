/**
 * Move Classification Heuristics
 * Mimics Chess.com's classification based on eval changes.
 */

export const MOVE_TYPES = {
  BRILLIANT: { label: 'Brilliant', symbol: '!!', color: '#26c2a3', bg: '#26c2a3' },
  GREAT: { label: 'Great Move', symbol: '!', color: '#5c8bb0', bg: '#5c8bb0' },
  BEST: { label: 'Best Move', symbol: '★', color: '#96bc4b', bg: '#96bc4b' },
  EXCELLENT: { label: 'Excellent', symbol: '', color: '#96bc4b', bg: '#96bc4b' },
  GOOD: { label: 'Good', symbol: '', color: '#96bc4b', bg: '#96bc4b' },
  BOOK: { label: 'Book', symbol: '📖', color: '#a88865', bg: '#a88865' },
  INACCURACY: { label: 'Inaccuracy', symbol: '?!', color: '#f0c15c', bg: '#f0c15c' },
  MISTAKE: { label: 'Mistake', symbol: '?', color: '#e6912c', bg: '#e6912c' },
  MISS: { label: 'Miss', symbol: '?', color: '#ff6b6b', bg: '#ff6b6b' },
  BLUNDER: { label: 'Blunder', symbol: '??', color: '#b33430', bg: '#b33430' },
  FORCED: { label: 'Forced', symbol: '➡', color: '#abbac3', bg: '#abbac3' },
};

/**
 * Classifies a move based on centipawn evaluation changes.
 */
export function classifyMove(prevEval, currentEval, bestPossibleEval, isBook = false) {
  if (isBook) return MOVE_TYPES.BOOK;
  
  // Normalize evals from POV of the player who moved.
  // prevEval is evaluation BEFORE move (from POV of side to move)
  // currentEval is evaluation AFTER move (from POV of side who moved)
  // bestPossibleEval is evaluation if BEST move was played (from POV of side who moved)
  
  const loss = bestPossibleEval - currentEval;
  
  // Brilliant: Hard to detect without deep search, using simple heuristic for now
  // If move was "surprising" (low initial eval for this piece) but result is top-tier
  if (loss <= 0 && currentEval > prevEval + 50 && currentEval > 0) {
    return MOVE_TYPES.BRILLIANT;
  }

  if (loss <= 0) return MOVE_TYPES.BEST;
  if (loss < 15) return MOVE_TYPES.EXCELLENT;
  if (loss < 40) return MOVE_TYPES.GOOD;
  if (loss < 100) return MOVE_TYPES.INACCURACY;
  if (loss < 250) return MOVE_TYPES.MISTAKE;
  
  // Miss: A blunder that misses a winning sequence
  if (bestPossibleEval > 200 && currentEval < 0) return MOVE_TYPES.MISS;
  
  return MOVE_TYPES.BLUNDER;
}


/**
 * Calculates accuracy percentage based on average centipawn loss.
 */
export function calculateAccuracy(avgLoss) {
  // Simple formula: accuracy = 100 * exp(-0.005 * avgLoss)
  return Math.max(0, Math.min(100, Math.round(100 * Math.exp(-0.004 * avgLoss))));
}
