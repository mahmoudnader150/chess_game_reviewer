import { useEffect, useRef } from 'react'
import MoveIcon from './MoveIcon'
import GameEndBanner from './GameEndBanner'

// Move history, two plies per row. Clicking a move jumps to it.
// variant 'table': two plies per row (desktop / tablet).
// variant 'strip': one horizontally scrolling line (phones).
export default function MoveList({ moves, reviewed, ply, onSelect, variant = 'table', gameEnd }) {
  const activeRef = useRef(null)
  const containerRef = useRef(null)

  // Keep the current move visible by scrolling the list itself only.
  // (scrollIntoView would also scroll the page on stacked mobile layouts.)
  useEffect(() => {
    const box = containerRef.current
    const el = activeRef.current
    if (!box) return
    if (!el) {
      if (ply === 0) box.scrollTo({ top: 0, left: 0 })
      return
    }
    if (variant === 'strip') {
      box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2, behavior: 'smooth' })
    } else if (el.offsetTop < box.scrollTop || el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2 })
    }
  }, [ply, variant])

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

  if (variant === 'strip') {
    return (
      <div className="move-strip" role="list" ref={containerRef}>
        {moves.map((move, index) => {
          const showNumber = move.color === 'w' || index === 0
          const number = startNumber + Math.floor((index + offset) / 2)
          return (
            <span className="strip-item" key={index} role="listitem">
              {showNumber && (
                <span className="move-number">
                  {number}
                  {move.color === 'w' ? '.' : '…'}
                </span>
              )}
              {cell(index)}
            </span>
          )
        })}
        {gameEnd && (
          <span className="strip-end">
            <GameEndBanner end={gameEnd} compact />
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="move-list" role="list" ref={containerRef}>
      {rows.map((i, row) => (
        <div className="move-row" key={i} role="listitem">
          <span className="move-number">{startNumber + row}.</span>
          {cell(i)}
          {cell(i + 1)}
        </div>
      ))}
      {gameEnd && (
        <div className="move-list-end">
          <GameEndBanner end={gameEnd} compact />
        </div>
      )}
    </div>
  )
}
