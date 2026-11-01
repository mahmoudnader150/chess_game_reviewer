import { Chess } from 'chess.js'
import { OPENING_LINES } from './openings.js'

// Positions are compared without the move counters so transpositions match.
export function positionKey(fen) {
  return fen.split(' ').slice(0, 4).join(' ')
}

let bookCache = null

// Map of position key -> opening name. A line names the position it ends
// on; positions it only passes through take the most general (shortest)
// name among the lines that reach them.
export function getBook() {
  if (bookCache) return bookCache
  const book = new Map()
  const rank = new Map()
  for (const [name, line] of OPENING_LINES) {
    const sans = line.split(/\s+/)
    const chess = new Chess()
    sans.forEach((san, i) => {
      if (rank.get('broken:' + name)) return
      try {
        chess.move(san)
      } catch {
        if (import.meta.env?.DEV) console.warn(`Illegal book move "${san}" in ${name}`)
        rank.set('broken:' + name, true)
        return
      }
      const key = positionKey(chess.fen())
      const isEnd = i === sans.length - 1
      const score = (isEnd ? 0 : 1000) + name.length
      const prev = rank.get(key)
      if (prev === undefined || score < prev) {
        book.set(key, name)
        rank.set(key, score)
      }
    })
  }
  bookCache = book
  return book
}

export function lookupBook(fen) {
  return getBook().get(positionKey(fen)) ?? null
}
