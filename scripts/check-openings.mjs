// Validates that every line in the opening book is legal.
import { Chess } from 'chess.js'
import { OPENING_LINES } from '../src/review/openings.js'

let bad = 0
for (const [name, line] of OPENING_LINES) {
  const chess = new Chess()
  for (const [i, san] of line.split(/\s+/).entries()) {
    try {
      chess.move(san)
    } catch {
      console.error(`✗ ${name}: illegal move #${i + 1} "${san}"`)
      bad += 1
      break
    }
  }
}
console.log(bad ? `${bad} broken line(s)` : `All ${OPENING_LINES.length} opening lines are legal`)
process.exit(bad ? 1 : 0)
