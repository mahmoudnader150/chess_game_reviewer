import {
  EMPTY,
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
  WHITE,
  BLACK,
  CASTLE_WK,
  CASTLE_WQ,
  CASTLE_BK,
  CASTLE_BQ,
  MOVE_CAPTURE,
  MOVE_EP,
  MOVE_CASTLE,
  MOVE_DOUBLE,
  MOVE_PROMOTION,
  MOVE_CHECK,
  MOVE_MATE,
  MATE_SCORE,
  INFINITY,
  MG_VALUE,
  EG_VALUE,
  squareName,
  squareIndex,
  pieceType,
} from './constants.js'
import { MG_PST, EG_PST, MOBILITY_MG, MOBILITY_EG } from './tables.js'

// 0x88 board: a row is 16 bytes wide, so one rank up is +16, one file right is +1.
const KNIGHT_OFFSETS = [14, 18, 31, 33, -14, -18, -31, -33]
const KING_OFFSETS = [1, 15, 16, 17, -1, -15, -16, -17]
const DIAGONALS = [15, 17, -15, -17]
const ORTHOGONALS = [1, 16, -1, -16]
const ALL_DIRS = [1, 15, 16, 17, -1, -15, -16, -17]
const isDiagonalOffset = (offset) => Math.abs(offset) === 15 || Math.abs(offset) === 17
// A step is only valid when it stays on the board and lands on a sensible file:
// vertical steps (±16) keep the file, horizontal/diagonal steps change it by one.
const stepKeepsFile = (from, to, offset) => {
  const diff = fileDiff(from, to)
  return Math.abs(offset) === 16 ? diff === 0 : diff === 1
}

const PROMOTION_PIECES = [QUEEN, ROOK, BISHOP, KNIGHT]

const onBoard = (sq) => sq >= 0 && sq < 128 && (sq & 0x88) === 0
const fileOf = (sq) => sq & 7
const rankOf = (sq) => sq >> 4
const fileDiff = (a, b) => Math.abs(fileOf(a) - fileOf(b))

const A1 = 0x00
const B1 = 0x01
const C1 = 0x02
const D1 = 0x03
const E1 = 0x04
const F1 = 0x05
const G1 = 0x06
const H1 = 0x07
const A8 = 0x70
const B8 = 0x71
const C8 = 0x72
const D8 = 0x73
const E8 = 0x74
const F8 = 0x75
const G8 = 0x76
const H8 = 0x77

export class Engine {
  constructor() {
    this.board = new Int8Array(128)
    this.turn = WHITE
    this.castling = 0
    this.ep = -1
    this.halfmove = 0
    this.fullmove = 1
    this.kings = { 1: -1, '-1': -1 }
    this.undoStack = []
    this.nodes = 0
    this.deadline = 0
    this.aborted = false
    this.killers = []
    this.history = new Int32Array(128 * 128)
    this.setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  }

  // ---------------------------------------------------------------- positions

  setFen(fen) {
    const parts = fen.trim().split(/\s+/)
    const placement = parts[0] ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'
    const active = parts[1] ?? 'w'
    const castlePart = parts[2] ?? '-'
    const epPart = parts[3] ?? '-'

    this.board.fill(EMPTY)
    this.kings = { 1: -1, '-1': -1 }

    let rank = 7
    let file = 0
    for (const ch of placement) {
      if (ch === '/') {
        rank -= 1
        file = 0
      } else if (ch >= '1' && ch <= '8') {
        file += Number(ch)
      } else {
        const type = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING }[ch.toLowerCase()]
        const color = ch === ch.toLowerCase() ? BLACK : WHITE
        const sq = rank * 16 + file
        this.board[sq] = color * type
        if (type === KING) this.kings[color] = sq
        file += 1
      }
    }

    this.turn = active === 'b' ? BLACK : WHITE
    this.castling = 0
    if (castlePart.includes('K')) this.castling |= CASTLE_WK
    if (castlePart.includes('Q')) this.castling |= CASTLE_WQ
    if (castlePart.includes('k')) this.castling |= CASTLE_BK
    if (castlePart.includes('q')) this.castling |= CASTLE_BQ
    this.ep = epPart && epPart !== '-' ? squareIndex(epPart) : -1
    this.halfmove = parts[4] ? Number(parts[4]) : 0
    this.fullmove = parts[5] ? Number(parts[5]) : 1
    this.undoStack.length = 0
  }

  fen() {
    let placement = ''
    for (let rank = 7; rank >= 0; rank -= 1) {
      let empty = 0
      for (let file = 0; file < 8; file += 1) {
        const piece = this.board[rank * 16 + file]
        if (piece === EMPTY) {
          empty += 1
        } else {
          if (empty > 0) {
            placement += empty
            empty = 0
          }
          const type = ['', 'p', 'n', 'b', 'r', 'q', 'k'][Math.abs(piece)]
          placement += piece < 0 ? type : type.toUpperCase()
        }
      }
      if (empty > 0) placement += empty
      if (rank > 0) placement += '/'
    }

    let castling = ''
    if (this.castling & CASTLE_WK) castling += 'K'
    if (this.castling & CASTLE_WQ) castling += 'Q'
    if (this.castling & CASTLE_BK) castling += 'k'
    if (this.castling & CASTLE_BQ) castling += 'q'
    if (!castling) castling = '-'

    return [
      placement,
      this.turn === WHITE ? 'w' : 'b',
      castling,
      this.ep >= 0 ? squareName(this.ep) : '-',
      this.halfmove,
      this.fullmove,
    ].join(' ')
  }

  clone() {
    const copy = new Engine()
    copy.board.set(this.board)
    copy.turn = this.turn
    copy.castling = this.castling
    copy.ep = this.ep
    copy.halfmove = this.halfmove
    copy.fullmove = this.fullmove
    copy.kings = { ...this.kings }
    return copy
  }

  // ------------------------------------------------------------- attack logic

  isSquareAttacked(sq, byColor) {
    const board = this.board

    // Pawns: a pawn of `byColor` attacks `sq` when it stands diagonally behind it.
    const pawnSource = byColor === WHITE ? sq - 15 : sq + 17
    if (onBoard(pawnSource) && board[pawnSource] === byColor * PAWN) return true
    const pawnSource2 = byColor === WHITE ? sq - 17 : sq + 15
    if (onBoard(pawnSource2) && board[pawnSource2] === byColor * PAWN) return true

    for (const offset of KNIGHT_OFFSETS) {
      const from = sq + offset
      if (!onBoard(from)) continue
      if (fileDiff(from, sq) > 2) continue
      if (board[from] === byColor * KNIGHT) return true
    }

    for (const offset of KING_OFFSETS) {
      const from = sq + offset
      if (!onBoard(from)) continue
      if (fileDiff(from, sq) > 1) continue
      if (board[from] === byColor * KING) return true
    }

    if (this.bishopAttacks(sq, byColor)) return true
    if (this.rookAttacks(sq, byColor)) return true
    return false
  }

  bishopAttacks(sq, byColor) {
    const board = this.board
    for (const offset of DIAGONALS) {
      let cur = sq + offset
      while (onBoard(cur)) {
        if (!stepKeepsFile(sq, cur, offset)) break
        const piece = board[cur]
        if (piece !== EMPTY) {
          if ((piece > 0 ? WHITE : BLACK) === byColor) {
            if (pieceType(piece) === BISHOP || pieceType(piece) === QUEEN) return true
          }
          break
        }
        cur += offset
      }
    }
    return false
  }

  rookAttacks(sq, byColor) {
    const board = this.board
    for (const offset of ORTHOGONALS) {
      let cur = sq + offset
      while (onBoard(cur)) {
        if (!stepKeepsFile(sq, cur, offset)) break
        const piece = board[cur]
        if (piece !== EMPTY) {
          if ((piece > 0 ? WHITE : BLACK) === byColor) {
            if (pieceType(piece) === ROOK || pieceType(piece) === QUEEN) return true
          }
          break
        }
        cur += offset
      }
    }
    return false
  }

  inCheck(color = this.turn) {
    const kingSq = this.kings[color]
    if (kingSq < 0) return false
    const by = color === WHITE ? BLACK : WHITE
    return this.isSquareAttacked(kingSq, by)
  }

  // ---------------------------------------------------------- move generation

  generateMoves({ capturesOnly = false } = {}) {
    const moves = []
    const board = this.board
    const us = this.turn
    const them = -us

    for (let sq = 0; sq < 128; sq += 1) {
      if (sq & 0x88) continue
      const piece = board[sq]
      if (piece === EMPTY || (piece > 0 ? WHITE : BLACK) !== us) continue
      const type = pieceType(piece)

      if (type === PAWN) {
        this.generatePawnMoves(sq, us, them, moves, capturesOnly)
        continue
      }

      if (type === KNIGHT || type === KING) {
        const offsets = type === KNIGHT ? KNIGHT_OFFSETS : KING_OFFSETS
        const maxFileDiff = type === KNIGHT ? 2 : 1
        for (const offset of offsets) {
          const to = sq + offset
          if (!onBoard(to)) continue
          if (fileDiff(to, sq) > maxFileDiff) continue
          const target = board[to]
          if (target !== EMPTY && (target > 0 ? WHITE : BLACK) === us) continue
          if (capturesOnly && target === EMPTY) continue
          moves.push(this.buildMove(sq, to, target))
        }
        continue
      }

      const dirs = type === BISHOP ? DIAGONALS : type === ROOK ? ORTHOGONALS : ALL_DIRS
      for (const offset of dirs) {
        let to = sq + offset
        while (onBoard(to)) {
          if (!stepKeepsFile(sq, to, offset)) break
          const target = board[to]
          if (target !== EMPTY && (target > 0 ? WHITE : BLACK) === us) break
          if (!capturesOnly || target !== EMPTY) moves.push(this.buildMove(sq, to, target))
          if (target !== EMPTY) break
          to += offset
        }
      }
    }

    if (!capturesOnly) this.generateCastles(moves)
    return moves
  }

  generatePawnMoves(sq, us, them, moves, capturesOnly) {
    const board = this.board
    const forward = us === WHITE ? 16 : -16
    const startRank = us === WHITE ? 1 : 6
    const promoRank = us === WHITE ? 7 : 0
    const rank = rankOf(sq)

    const one = sq + forward
    if (onBoard(one) && board[one] === EMPTY) {
      if (rankOf(one) === promoRank) {
        if (!capturesOnly) for (const p of PROMOTION_PIECES) moves.push(this.buildMove(sq, one, EMPTY, p))
      } else if (!capturesOnly) {
        moves.push(this.buildMove(sq, one, EMPTY))
        if (rank === startRank) {
          const two = one + forward
          if (onBoard(two) && board[two] === EMPTY) moves.push(this.buildMove(sq, two, EMPTY, 0, MOVE_DOUBLE))
        }
      }
    }

    for (const offset of [15, 17]) {
      const to = sq + (us === WHITE ? offset : -offset)
      if (!onBoard(to)) continue
      if (fileDiff(to, sq) !== 1) continue
      const target = board[to]
      if (target !== EMPTY && (target > 0 ? WHITE : BLACK) === them) {
        if (rankOf(to) === promoRank) {
          for (const p of PROMOTION_PIECES) moves.push(this.buildMove(sq, to, target, p, MOVE_CAPTURE))
        } else {
          moves.push(this.buildMove(sq, to, target, 0, MOVE_CAPTURE))
        }
      } else if (to === this.ep && target === EMPTY) {
        moves.push(this.buildMove(sq, to, EMPTY, 0, MOVE_CAPTURE | MOVE_EP))
      }
    }
  }

  generateCastles(moves) {
    const board = this.board
    const us = this.turn
    if (us === WHITE) {
      if (this.castling & CASTLE_WK && board[H1] === WHITE * ROOK && board[F1] === EMPTY && board[G1] === EMPTY) {
        if (!this.isSquareAttacked(E1, BLACK) && !this.isSquareAttacked(F1, BLACK) && !this.isSquareAttacked(G1, BLACK)) {
          moves.push(this.buildMove(E1, G1, EMPTY, 0, MOVE_CASTLE))
        }
      }
      if (this.castling & CASTLE_WQ && board[A1] === WHITE * ROOK && board[D1] === EMPTY && board[C1] === EMPTY && board[B1] === EMPTY) {
        if (!this.isSquareAttacked(E1, BLACK) && !this.isSquareAttacked(D1, BLACK) && !this.isSquareAttacked(C1, BLACK)) {
          moves.push(this.buildMove(E1, C1, EMPTY, 0, MOVE_CASTLE))
        }
      }
    } else {
      if (this.castling & CASTLE_BK && board[H8] === BLACK * ROOK && board[F8] === EMPTY && board[G8] === EMPTY) {
        if (!this.isSquareAttacked(E8, WHITE) && !this.isSquareAttacked(F8, WHITE) && !this.isSquareAttacked(G8, WHITE)) {
          moves.push(this.buildMove(E8, G8, EMPTY, 0, MOVE_CASTLE))
        }
      }
      if (this.castling & CASTLE_BQ && board[A8] === BLACK * ROOK && board[D8] === EMPTY && board[C8] === EMPTY && board[B8] === EMPTY) {
        if (!this.isSquareAttacked(E8, WHITE) && !this.isSquareAttacked(D8, WHITE) && !this.isSquareAttacked(C8, WHITE)) {
          moves.push(this.buildMove(E8, C8, EMPTY, 0, MOVE_CASTLE))
        }
      }
    }
  }

  buildMove(from, to, captured, promotion = 0, extra = 0) {
    let flags = extra
    if (captured !== EMPTY) flags |= MOVE_CAPTURE
    if (promotion) flags |= MOVE_PROMOTION
    return {
      from,
      to,
      captured,
      promotion,
      flags,
      piece: this.board[from],
    }
  }

  legalMoves() {
    const pseudo = this.generateMoves()
    const legal = []
    for (const move of pseudo) {
      this.makeMove(move)
      if (!this.inCheck(this.turn)) legal.push(move)
      this.unmakeMove()
    }
    return legal
  }

  // ------------------------------------------------------------- make / unmake

  makeMove(move) {
    const board = this.board
    this.undoStack.push({
      board: board.slice(),
      turn: this.turn,
      castling: this.castling,
      ep: this.ep,
      halfmove: this.halfmove,
      fullmove: this.fullmove,
      kings: { ...this.kings },
    })

    const { from, to, flags } = move
    const piece = board[from]
    const us = this.turn
    const type = pieceType(piece)

    if (flags & MOVE_EP) {
      const capturedPawn = us === WHITE ? to - 16 : to + 16
      board[capturedPawn] = EMPTY
    }

    board[from] = EMPTY
    if (move.promotion) {
      board[to] = us * move.promotion
    } else {
      board[to] = piece
    }

    if (flags & MOVE_CASTLE) {
      if (to === 0x06) {
        board[0x07] = EMPTY
        board[0x05] = us * ROOK
      } else if (to === 0x02) {
        board[0x00] = EMPTY
        board[0x03] = us * ROOK
      } else if (to === 0x76) {
        board[0x77] = EMPTY
        board[0x75] = us * ROOK
      } else if (to === 0x72) {
        board[0x70] = EMPTY
        board[0x73] = us * ROOK
      }
    }

    if (type === KING) {
      this.kings[us] = to
      this.castling &= us === WHITE ? ~(CASTLE_WK | CASTLE_WQ) : ~(CASTLE_BK | CASTLE_BQ)
    }

    if (from === A1 || to === A1) this.castling &= ~CASTLE_WQ
    if (from === H1 || to === H1) this.castling &= ~CASTLE_WK
    if (from === A8 || to === A8) this.castling &= ~CASTLE_BQ
    if (from === H8 || to === H8) this.castling &= ~CASTLE_BK

    this.ep = flags & MOVE_DOUBLE ? (from + to) >> 1 : -1
    this.halfmove = type === PAWN || flags & MOVE_CAPTURE ? 0 : this.halfmove + 1
    if (us === BLACK) this.fullmove += 1
    this.turn = -us
  }

  unmakeMove() {
    const state = this.undoStack.pop()
    if (!state) return null
    this.board.set(state.board)
    this.turn = state.turn
    this.castling = state.castling
    this.ep = state.ep
    this.halfmove = state.halfmove
    this.fullmove = state.fullmove
    this.kings = state.kings
    return state
  }

  // -------------------------------------------------------------- evaluation

  evaluate() {
    const board = this.board
    const pawnFiles = { 1: new Array(8).fill(0), '-1': new Array(8).fill(0) }
    const pawnRanks = { 1: Array.from({ length: 8 }, () => []), '-1': Array.from({ length: 8 }, () => []) }
    const bishopCount = { 1: 0, '-1': 0 }
    let mg = 0
    let eg = 0
    let phase = 0

    for (let sq = 0; sq < 128; sq += 1) {
      if (sq & 0x88) continue
      const piece = board[sq]
      if (piece === EMPTY) continue
      const type = pieceType(piece)
      const color = piece > 0 ? WHITE : BLACK
      const sign = color === WHITE ? 1 : -1
      const row = 7 - rankOf(sq)
      const col = fileOf(sq)
      const idx = row * 8 + col

      mg += sign * (MG_VALUE[type] + MG_PST[type][idx])
      eg += sign * (EG_VALUE[type] + EG_PST[type][idx])

      if (type === KNIGHT || type === BISHOP) phase += 1
      else if (type === ROOK) phase += 2
      else if (type === QUEEN) phase += 4

      if (type === PAWN) {
        pawnFiles[color][col] += 1
        pawnRanks[color][col].push(rankOf(sq))
      } else if (type === BISHOP) {
        bishopCount[color] += 1
      }

      const mobility = this.countMobility(sq, type, color)
      mg += sign * mobility * MOBILITY_MG[type]
      eg += sign * mobility * MOBILITY_EG[type]
    }

    if (bishopCount[1] >= 2) {
      mg += 30
      eg += 50
    }
    if (bishopCount[-1] >= 2) {
      mg -= 30
      eg -= 50
    }

    // Pawn structure
    for (const color of [WHITE, BLACK]) {
      const sign = color === WHITE ? 1 : -1
      const own = pawnFiles[color]
      const enemy = pawnFiles[-color]
      for (let file = 0; file < 8; file += 1) {
        if (own[file] > 1) {
          mg -= 12 * (own[file] - 1)
          eg -= 18 * (own[file] - 1)
        }
        const hasNeighbour = (file > 0 && own[file - 1] > 0) || (file < 7 && own[file + 1] > 0)
        if (own[file] > 0 && !hasNeighbour) {
          mg -= 15
          eg -= 22
        }
      }

      for (let file = 0; file < 8; file += 1) {
        for (const rank of pawnRanks[color][file]) {
          let passed = true
          for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1) && passed; f += 1) {
            for (const enemyRank of pawnRanks[-color][f]) {
              const closer = color === WHITE ? enemyRank > rank : enemyRank < rank
              if (closer) {
                passed = false
                break
              }
            }
          }
          if (passed) {
            const progress = color === WHITE ? rank : 7 - rank
            mg += 8 + 10 * progress
            eg += 15 + 25 * progress
          }
        }
      }

      // Rooks on open / semi-open files
      for (let sq = 0; sq < 128; sq += 1) {
        if (sq & 0x88) continue
        const piece = board[sq]
        if (piece !== color * ROOK) continue
        const file = fileOf(sq)
        if (own[file] === 0) {
          mg += enemy[file] === 0 ? 25 : 12
          eg += enemy[file] === 0 ? 12 : 6
        }
      }

      // King safety: pawn shield in front of the king
      const kingSq = this.kings[color]
      if (kingSq >= 0) {
        const kingFile = fileOf(kingSq)
        const kingRank = rankOf(kingSq)
        let shield = 0
        for (let f = Math.max(0, kingFile - 1); f <= Math.min(7, kingFile + 1); f += 1) {
          for (const rank of pawnRanks[color][f]) {
            const ahead = color === WHITE ? rank > kingRank : rank < kingRank
            if (ahead) shield += 1
          }
        }
        mg += shield * 9
        if (shield === 0) {
          const centrality = Math.abs(3.5 - kingFile) + Math.abs(3.5 - kingRank)
          mg -= 22 - centrality * 4
        }
        // King in the centre without protection in the endgame is bad.
        eg += (3.5 - Math.abs(3.5 - kingFile)) * 6 + (3.5 - Math.abs(3.5 - kingRank)) * 4
      }
    }

    const mgPhase = Math.min(phase, 24)
    const egPhase = 24 - mgPhase
    let score = (mg * mgPhase + eg * egPhase) / 24
    score += 10 // tempo
    return this.turn === WHITE ? score : -score
  }

  countMobility(sq, type, color) {
    const board = this.board
    let count = 0
    if (type === KNIGHT) {
      for (const offset of KNIGHT_OFFSETS) {
        const to = sq + offset
        if (!onBoard(to) || fileDiff(to, sq) > 2) continue
        const target = board[to]
        if (target !== EMPTY && (target > 0 ? WHITE : BLACK) === color) continue
        count += 1
      }
      return count
    }
    if (type === KING) return 0
    const dirs = type === BISHOP ? DIAGONALS : type === ROOK ? ORTHOGONALS : ALL_DIRS
    for (const offset of dirs) {
      let to = sq + offset
      while (onBoard(to)) {
        if (!stepKeepsFile(sq, to, offset)) break
        const target = board[to]
        if (target !== EMPTY && (target > 0 ? WHITE : BLACK) === color) break
        count += 1
        if (target !== EMPTY) break
        to += offset
      }
    }
    return count
  }

  // ------------------------------------------------------------------ search

  search(depth, { maxTimeMs = 2000, timeLimitMs } = {}) {
    this.nodes = 0
    this.aborted = false
    this.killers = []
    this.history.fill(0)
    this.deadline = Date.now() + (timeLimitMs ?? maxTimeMs)
    const value = this.negamax(depth, -INFINITY, INFINITY, 0)
    return { value: this.aborted ? 0 : value, nodes: this.nodes, aborted: this.aborted }
  }

  negamax(depth, alpha, beta, ply) {
    this.nodes += 1
    if ((this.nodes & 1023) === 0 && Date.now() > this.deadline) {
      this.aborted = true
      return 0
    }
    if (this.aborted) return 0

    if (depth <= 0) return this.quiescence(alpha, beta, ply)

    const moves = this.legalMoves()
    if (moves.length === 0) {
      return this.inCheck() ? -MATE_SCORE + ply : 0
    }

    this.orderMoves(moves, ply)

    let best = -INFINITY
    for (const move of moves) {
      this.makeMove(move)
      const score = -this.negamax(depth - 1, -beta, -alpha, ply + 1)
      this.unmakeMove()
      if (this.aborted) return 0
      if (score > best) best = score
      if (best > alpha) alpha = best
      if (alpha >= beta) {
        this.recordCutoff(move, depth, ply)
        break
      }
    }
    return best
  }

  quiescence(alpha, beta, ply) {
    this.nodes += 1
    if ((this.nodes & 1023) === 0 && Date.now() > this.deadline) {
      this.aborted = true
      return 0
    }
    if (this.aborted) return 0
    if (ply > 40) return this.evaluate()

    const inCheck = this.inCheck()
    const standPat = inCheck ? -INFINITY : this.evaluate()
    if (!inCheck) {
      if (standPat >= beta) return beta
      if (standPat > alpha) alpha = standPat
    }

    const moves = this.generateMoves({ capturesOnly: !inCheck })
    if (inCheck) {
      const legal = []
      for (const move of moves) {
        this.makeMove(move)
        if (!this.inCheck(this.turn)) legal.push(move)
        this.unmakeMove()
      }
      moves.length = 0
      moves.push(...legal)
    }
    this.orderMoves(moves, ply, true)

    for (const move of moves) {
      this.makeMove(move)
      const score = -this.quiescence(-beta, -alpha, ply + 1)
      this.unmakeMove()
      if (this.aborted) return 0
      if (score > alpha) {
        alpha = score
        if (alpha >= beta) return beta
      }
    }

    if (inCheck && alpha === -INFINITY) return -MATE_SCORE + ply
    return alpha
  }

  orderMoves(moves, ply, capturesOnly = false) {
    const killers = this.killers[ply] ?? []
    for (const move of moves) {
      let score = 0
      if (move.flags & MOVE_CAPTURE) {
        const victim = move.flags & MOVE_EP ? PAWN : move.captured
        score = 1000000 + MG_VALUE[pieceType(victim)] * 10 - MG_VALUE[pieceType(move.piece)]
      } else if (move.flags & MOVE_PROMOTION) {
        score = 900000 + MG_VALUE[move.promotion]
      }
      if (!capturesOnly) {
        if (killers.includes(move.to)) score += 80000
        score += this.history[move.from * 128 + move.to]
      }
      move.order = score
    }
    moves.sort((a, b) => b.order - a.order)
  }

  recordCutoff(move, depth, ply) {
    this.history[move.from * 128 + move.to] += depth * depth
    if (!(move.flags & (MOVE_CAPTURE | MOVE_PROMOTION))) {
      const killers = this.killers[ply] ?? (this.killers[ply] = [])
      if (killers.length < 2) killers.push(move.to)
      else killers[1] = killers[0]
      killers[0] = move.to
    }
  }

  // Run iterative deepening from depth 1 up to `maxDepth`, returning the
  // best move found so far on every completed iteration. Respects the time
  // budget and never blocks past `maxTimeMs` total.
  iterativeDeepening(maxDepth = 20, maxTimeMs = 2000) {
    const moves = this.legalMoves()
    if (moves.length === 0) return null
    this.orderMoves(moves, 0)

    this.nodes = 0
    this.aborted = false
    this.killers = []
    this.history.fill(0)
    const deadline = Date.now() + maxTimeMs
    let best = moves[0]
    let bestValue = -INFINITY

    for (let depth = 1; depth <= maxDepth; depth += 1) {
      this.deadline = deadline
      let iterationBest = null
      let iterationValue = -INFINITY
      let alpha = -INFINITY
      const beta = INFINITY

      for (const move of moves) {
        this.makeMove(move)
        const score = -this.negamax(depth - 1, -beta, -alpha, 1)
        this.unmakeMove()
        if (this.aborted) break
        if (score > iterationValue) {
          iterationValue = score
          iterationBest = move
        }
        if (score > alpha) alpha = score
      }

      if (this.aborted) break
      if (iterationBest) {
        best = iterationBest
        bestValue = iterationValue
      }
      if (Date.now() > deadline) break
    }

    return {
      move: best,
      value: this.aborted ? 0 : bestValue,
      san: this.moveToSan(best),
      nodes: this.nodes,
      aborted: this.aborted,
    }
  }

  // Best move from the current position, with its value and SAN.
  bestMove(depth, options = {}) {
    const moves = this.legalMoves()
    if (moves.length === 0) return null
    this.orderMoves(moves, 0)

    this.nodes = 0
    this.aborted = false
    this.killers = []
    this.history.fill(0)
    this.deadline = Date.now() + (options.timeLimitMs ?? options.maxTimeMs ?? 2000)

    let best = null
    let bestValue = -INFINITY
    let alpha = -INFINITY
    const beta = INFINITY

    for (const move of moves) {
      this.makeMove(move)
      const score = -this.negamax(depth - 1, -beta, -alpha, 1)
      this.unmakeMove()
      if (this.aborted) break
      if (score > bestValue) {
        bestValue = score
        best = move
      }
      if (score > alpha) alpha = score
    }

    if (!best) best = moves[0]
    return {
      move: best,
      value: this.aborted ? 0 : bestValue,
      san: this.moveToSan(best),
      nodes: this.nodes,
    }
  }

  // --------------------------------------------------------------------- SAN

  moveToSan(move) {
    const type = pieceType(move.piece)
    const legal = this.legalMoves()
    const isCapture = Boolean(move.flags & MOVE_CAPTURE)
    let san = ''

    if (move.flags & MOVE_CASTLE) {
      san = fileOf(move.to) === 6 ? 'O-O' : 'O-O-O'
    } else {
      if (type !== PAWN) san += ['', '', 'N', 'B', 'R', 'Q', 'K'][type]
      const others = legal.filter((m) => m !== move && m.to === move.to && pieceType(m.piece) === type)
      if (others.length > 0) {
        const sameFile = others.some((m) => fileOf(m.from) === fileOf(move.from))
        const sameRank = others.some((m) => rankOf(m.from) === rankOf(move.from))
        if (!sameFile) san += 'abcdefgh'[fileOf(move.from)]
        else if (!sameRank) san += String(rankOf(move.from) + 1)
        else san += 'abcdefgh'[fileOf(move.from)] + String(rankOf(move.from) + 1)
      }
      if (isCapture) san += 'x'
      san += squareName(move.to)
      if (move.promotion) san += '=' + ['', '', 'N', 'B', 'R', 'Q', 'K'][move.promotion]
    }

    this.makeMove(move)
    if (this.inCheck()) san += this.legalMoves().length === 0 ? '#' : '+'
    this.unmakeMove()
    return san
  }

  // Find the move matching a from/to/promotion triple.
  findMove(from, to, promotion = 0) {
    const legal = this.legalMoves()
    return (
      legal.find(
        (m) =>
          m.from === from &&
          m.to === to &&
          (promotion ? m.promotion === promotion : true) &&
          (promotion ? true : m.promotion === 0),
      ) ?? null
    )
  }
}

export { squareName, squareIndex, pieceType }
