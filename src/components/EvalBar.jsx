import { formatScoreShort, whiteWinPercent } from '../review/scoring'

// Vertical evaluation bar. White's share grows from White's side of the board.
export default function EvalBar({ score, orientation = 'white', pending = false }) {
  const whiteWin = score ? whiteWinPercent(score) : 50
  const whiteAhead = whiteWin >= 50
  const label = pending ? '…' : formatScoreShort(score)
  const flipped = orientation === 'black'

  return (
    <div className={`eval-bar ${flipped ? 'flipped' : ''}`} aria-label={`Evaluation ${label}`}>
      <div className="eval-bar-white" style={{ height: `${whiteWin}%` }} />
      <span className={`eval-bar-label ${whiteAhead ? 'on-white' : 'on-black'}`}>{label}</span>
    </div>
  )
}
