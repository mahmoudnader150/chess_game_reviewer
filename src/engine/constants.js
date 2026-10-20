// Piece encoding. Positive values are white, negative values are black.
export const EMPTY = 0
export const PAWN = 1
export const KNIGHT = 2
export const BISHOP = 3
export const ROOK = 4
export const QUEEN = 5
export const KING = 6

export const WHITE = 1
export const BLACK = -1

export const PIECE_LETTERS = ['', 'p', 'n', 'b', 'r', 'q', 'k']

// Castling right bits
export const CASTLE_WK = 1
export const CASTLE_WQ = 2
export const CASTLE_BK = 4
export const CASTLE_BQ = 8

export const MOVE_CAPTURE = 1
export const MOVE_EP = 2
export const MOVE_CASTLE = 4
export const MOVE_DOUBLE = 8
export const MOVE_PROMOTION = 16
export const MOVE_CHECK = 32
export const MOVE_MATE = 64

export const MATE_SCORE = 100000
export const INFINITY = 1000000

// Material values, indexed by piece type.
export const MG_VALUE = [0, 100, 320, 330, 500, 900, 0]
export const EG_VALUE = [0, 120, 330, 340, 560, 950, 0]

const FILES = 'abcdefgh'

export function squareName(sq) {
  if (sq < 0) return '-'
  return FILES[sq & 7] + ((sq >> 4) + 1)
}

export function squareIndex(name) {
  if (!name || name === '-') return -1
  const file = FILES.indexOf(name[0])
  const rank = name.charCodeAt(1) - 49
  if (file < 0 || rank < 0) return -1
  return rank * 16 + file
}

export function pieceType(piece) {
  return piece < 0 ? -piece : piece
}

export function pieceColor(piece) {
  return piece < 0 ? BLACK : WHITE
}
