import { useEffect, useState } from 'react'

const SQUARES = Array.from({ length: 16 }, (_, i) => ({ row: Math.floor(i / 4), col: i % 4 }))
const DURATION_MS = 2100
const EXIT_MS = 450

// Intro shown when the app opens: a small board ripples in, the knight
// drops onto it, then the title slides up. Click / tap / any key skips it.
export default function Splash({ onDone }) {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const leaveTimer = setTimeout(() => setLeaving(true), reduced ? 300 : DURATION_MS)
    const skip = () => setLeaving(true)
    window.addEventListener('keydown', skip)
    return () => {
      clearTimeout(leaveTimer)
      window.removeEventListener('keydown', skip)
    }
  }, [reduced])

  useEffect(() => {
    if (!leaving) return undefined
    const t = setTimeout(onDone, EXIT_MS)
    return () => clearTimeout(t)
  }, [leaving, onDone])

  return (
    <div className={`splash ${leaving ? 'leaving' : ''} ${reduced ? 'reduced' : ''}`} onPointerDown={() => setLeaving(true)}>
      <div className="splash-stage">
        <div className="splash-board">
          {SQUARES.map(({ row, col }) => (
            <span
              key={`${row}-${col}`}
              className={`splash-square ${(row + col) % 2 ? 'dark' : 'light'}`}
              style={{ animationDelay: `${(row + col) * 70}ms` }}
            />
          ))}
          <img className="splash-knight" src="/knight.svg" alt="" />
        </div>
        <div className="splash-title">
          Game <span>Reviewer</span>
        </div>
        <div className="splash-tagline">Every move, explained.</div>
        <div className="splash-loader">
          <span />
        </div>
      </div>
    </div>
  )
}
