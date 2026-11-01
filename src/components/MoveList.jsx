import { useEffect, useRef } from 'react'
import MoveIcon from './MoveIcon'

// Move history, two plies per row. Clicking a move jumps to it.
export default function MoveList({ moves, reviewed, ply, onSelect }) {
  const activeRef = useRef(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [ply])

  const rows = []
  const firstIsBlack = moves[0]?.color === 'b'
  const offset = firstIsBlack ? 1 : 0
  for (let i = -offset; i < moves.length; i += 2) rows.push(i)

  const startNumber = moves[0] ? Number(moves[0].before.split(' ')[5] ?? 1) : 1

  const cell = (index) => {
    if (index < 0 || index >= moves.length) return <div className="move-cell empty" />
    const move = moves[index]
    const info = reviewed?.[index]
    const active = ply === index + 1
    return (
      <button
        type="button"
        ref={active ? activeRef : null}
        className={`move-cell ${active ? 'active' : ''}`}
        onClick={() => onSelect(index + 1)}
        style={info ? { '--move-color': info.classification.color } : undefined}
      >
        {info && <MoveIcon classification={info.classification} size={16} />}
        <span className="move-san">{move.san}</span>
      </button>
    )
  }

  return (
    <div className="move-list" role="list">
      {rows.map((i, row) => (
        <div className="move-row" key={i} role="listitem">
          <span className="move-number">{startNumber + row}.</span>
          {cell(i)}
          {cell(i + 1)}
        </div>
      ))}
    </div>
  )
}
