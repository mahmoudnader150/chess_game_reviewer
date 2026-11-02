// How a game ended. The APIs and PGN headers each describe this differently,
// so they are all normalized to one `method` key here.

const METHODS = {
  checkmate: { label: 'Checkmate', phrase: 'by checkmate', icon: '#' },
  resignation: { label: 'Resignation', phrase: 'by resignation', icon: '🏳' },
  timeout: { label: 'Time out', phrase: 'on time', icon: '⏱' },
  abandonment: { label: 'Abandoned', phrase: 'by abandonment', icon: '🚪' },
  infraction: { label: 'Rules infraction', phrase: 'by rules infraction', icon: '⚠' },
  stalemate: { label: 'Stalemate', phrase: 'by stalemate', icon: '½' },
  agreement: { label: 'Agreement', phrase: 'by agreement', icon: '½' },
  repetition: { label: 'Repetition', phrase: 'by repetition', icon: '½' },
  insufficient: { label: 'Insufficient material', phrase: 'by insufficient material', icon: '½' },
  fiftyMove: { label: '50-move rule', phrase: 'by the 50-move rule', icon: '½' },
  timeoutVsInsufficient: { label: 'Timeout vs insufficient', phrase: 'by timeout vs insufficient material', icon: '½' },
  aborted: { label: 'Aborted', phrase: '', icon: '✕' },
}

const CHESS_COM_LOSS_CODES = {
  checkmated: 'checkmate',
  resigned: 'resignation',
  timeout: 'timeout',
  abandoned: 'abandonment',
}

const CHESS_COM_DRAW_CODES = {
  agreed: 'agreement',
  repetition: 'repetition',
  stalemate: 'stalemate',
  insufficient: 'insufficient',
  '50move': 'fiftyMove',
  timevsinsufficient: 'timeoutVsInsufficient',
}

/** Chess.com puts the method in the result code of the player who didn't win. */
export function chessComTermination(whiteCode, blackCode) {
  const code = whiteCode === 'win' ? blackCode : whiteCode
  return CHESS_COM_LOSS_CODES[code] ?? CHESS_COM_DRAW_CODES[code] ?? null
}

// "timeout" on Lichess means a player left and the win was claimed; running
// out of clock is "outoftime". A plain "draw" doesn't say why, so it is refined
// from the final position later on.
const LICHESS_STATUS = {
  mate: 'checkmate',
  resign: 'resignation',
  stalemate: 'stalemate',
  timeout: 'abandonment',
  cheat: 'infraction',
  aborted: 'aborted',
  noStart: 'aborted',
}

export function lichessTermination(status, hasWinner) {
  if (status === 'outoftime') return hasWinner ? 'timeout' : 'timeoutVsInsufficient'
  return LICHESS_STATUS[status] ?? null
}

// Matches the PGN Termination tag of Chess.com ("X won by resignation", "Game
// drawn by repetition") and Lichess ("Time forfeit", "Abandoned", "Normal").
const TERMINATION_PATTERNS = [
  [/timeout vs insufficient/i, 'timeoutVsInsufficient'],
  [/checkmate/i, 'checkmate'],
  [/resign/i, 'resignation'],
  [/abandon/i, 'abandonment'],
  [/on time|time forfeit|timeout/i, 'timeout'],
  [/rules infraction/i, 'infraction'],
  [/stalemate/i, 'stalemate'],
  [/agreement/i, 'agreement'],
  [/repetition/i, 'repetition'],
  [/insufficient/i, 'insufficient'],
  [/50[- ]move|fifty/i, 'fiftyMove'],
]

/**
 * Method from a PGN's headers. Lichess writes "Normal" for both mate and
 * resignation, so a decisive "Normal" reads as a resignation here and
 * describeGameEnd overrides it if the final position is mate.
 */
export function pgnTermination(headers) {
  const text = headers?.Termination
  if (!text) return null
  if (/^normal$/i.test(text.trim())) return headers.Result === '1-0' || headers.Result === '0-1' ? 'resignation' : null
  return TERMINATION_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? null
}

/**
 * Combine what the source reported with what the final position shows.
 * `board` is parseGame's `ending` ('checkmate' | 'stalemate' | 'insufficient' |
 * 'repetition' | 'fiftyMove' | null). Mate and stalemate on the board are facts
 * and always win; the others could still have been played on, so they only fill
 * in for a draw whose reason wasn't reported.
 *
 * Returns { winner: 'white'|'black'|null, method, title, detail, label, icon }.
 */
export function describeGameEnd(game, board = null, finalTurn = null) {
  let method = game.termination ?? null
  let winner = game.white.result === 'win' ? 'white' : game.black.result === 'win' ? 'black' : null
  const unfinished = game.result === '*'

  if (board === 'checkmate') {
    method = 'checkmate'
    if (finalTurn) winner = finalTurn === 'w' ? 'black' : 'white'
  } else if (board === 'stalemate') {
    method = 'stalemate'
    winner = null
  } else if (!method && !winner && !unfinished) {
    method = board
  }

  if (unfinished && !method) {
    return { winner: null, method: null, title: 'Game not finished', detail: '', label: 'Unfinished', icon: '…' }
  }

  const info = METHODS[method] ?? null
  if (method === 'aborted') {
    return { winner: null, method, title: 'Game aborted', detail: '', label: info.label, icon: info.icon }
  }
  const name = winner ? game[winner].username : null
  return {
    winner,
    method,
    title: winner ? `${name} won` : 'Draw',
    detail: info?.phrase ?? '',
    label: info?.label ?? (winner ? 'Win' : 'Draw'),
    icon: info?.icon ?? (winner ? '★' : '½'),
  }
}
