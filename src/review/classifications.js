// Move classifications, chess.com style. Colors follow chess.com's palette.

export const CLASSIFICATIONS = {
  brilliant: { key: 'brilliant', label: 'Brilliant', symbol: '!!', color: '#1baca6' },
  great: { key: 'great', label: 'Great', symbol: '!', color: '#5c8bb0' },
  best: { key: 'best', label: 'Best', symbol: '★', color: '#81b64c' },
  excellent: { key: 'excellent', label: 'Excellent', symbol: '👍', color: '#96bc4b' },
  good: { key: 'good', label: 'Good', symbol: '✓', color: '#95b776' },
  book: { key: 'book', label: 'Book', symbol: '📖', color: '#a88865' },
  forced: { key: 'forced', label: 'Forced', symbol: '→', color: '#97af8b' },
  inaccuracy: { key: 'inaccuracy', label: 'Inaccuracy', symbol: '?!', color: '#f7c631' },
  mistake: { key: 'mistake', label: 'Mistake', symbol: '?', color: '#ffa459' },
  miss: { key: 'miss', label: 'Miss', symbol: '✕', color: '#ff7769' },
  blunder: { key: 'blunder', label: 'Blunder', symbol: '??', color: '#fa412d' },
}

// Display order of the summary table.
export const SUMMARY_ORDER = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
]

// Classifications for which we show the engine's best move as an alternative.
export const SHOW_BEST_FOR = new Set(['excellent', 'good', 'inaccuracy', 'mistake', 'miss', 'blunder'])
