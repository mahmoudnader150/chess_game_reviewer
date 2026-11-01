import { useMemo } from 'react'
import { Chessboard } from 'react-chessboard'
import MoveIcon from './MoveIcon'

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

const DEFAULT_HIGHLIGHT = 'rgba(255, 255, 51, 0.45)'

/**
 * The board for the current ply. Highlights the last move's squares in its
 * classification color, puts the classification badge on the moved piece,
 * and draws the engine's best move as an arrow when it differs.
 */
export default function ReviewBoard({ fen, lastMove, classification, bestMove, orientation }) {
  const squareStyles = useMemo(() => {
    if (!lastMove) return {}
    const background = classification ? hexToRgba(classification.color, 0.5) : DEFAULT_HIGHLIGHT
    return {
      [lastMove.from]: { backgroundColor: background },
      [lastMove.to]: { backgroundColor: background },
    }
  }, [lastMove, classification])

  const arrows = useMemo(() => {
    if (!bestMove) return []
    return [{ startSquare: bestMove.slice(0, 2), endSquare: bestMove.slice(2, 4), color: 'rgba(129, 182, 76, 0.85)' }]
  }, [bestMove])

  const badgeSquare = lastMove?.to
  // Keep the badge inside the board on the top rank / right file.
  const topEdge = badgeSquare && badgeSquare[1] === (orientation === 'white' ? '8' : '1')
  const rightEdge = badgeSquare && badgeSquare[0] === (orientation === 'white' ? 'h' : 'a')

  const options = {
    id: 'review-board',
    position: fen,
    boardOrientation: orientation,
    allowDragging: false,
    allowDrawingArrows: true,
    arrows,
    clearArrowsOnPositionChange: true,
    showAnimations: true,
    animationDurationInMs: 180,
    darkSquareStyle: { backgroundColor: '#739552' },
    lightSquareStyle: { backgroundColor: '#ebecd0' },
    darkSquareNotationStyle: { color: '#ebecd0', fontWeight: 600 },
    lightSquareNotationStyle: { color: '#739552', fontWeight: 600 },
    boardStyle: { borderRadius: '4px', overflow: 'visible' },
    squareRenderer: ({ square, children }) => (
      <div className="board-square" style={squareStyles[square]}>
        {children}
        {square === badgeSquare && classification && (
          <div className={`board-badge ${topEdge ? 'top-edge' : ''} ${rightEdge ? 'right-edge' : ''}`}>
            <MoveIcon classification={classification} size={100} />
          </div>
        )}
      </div>
    ),
  }

  return <Chessboard options={options} />
}
