import { useEffect, useRef, useState } from 'react'
import { APP_THEMES, BOARD_THEMES } from '../theme/themes'

// Palette button in the top bar: a popover to choose the app and board themes.
export default function ThemePicker({ appKey, onAppChange, boardKey, onBoardChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="theme-picker" ref={rootRef}>
      <button
        type="button"
        className="icon-btn"
        title="Themes"
        aria-label="Themes"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        🎨
      </button>
      {open && (
        <div className="theme-popover">
          <div className="theme-group-title" id="app-theme-label">
            App theme
          </div>
          <div className="theme-options" role="radiogroup" aria-labelledby="app-theme-label">
            {Object.entries(APP_THEMES).map(([key, theme]) => (
              <button
                type="button"
                key={key}
                role="radio"
                aria-checked={appKey === key}
                className={`theme-option ${appKey === key ? 'active' : ''}`}
                onClick={() => onAppChange(key)}
              >
                <span
                  className="theme-swatch"
                  style={{
                    background: `linear-gradient(135deg, ${theme.vars['--bg']} 50%, ${theme.vars['--accent']} 50%)`,
                  }}
                />
                {theme.label}
              </button>
            ))}
          </div>
          <div className="theme-group-title" id="board-theme-label">
            Board theme
          </div>
          <div className="theme-options" role="radiogroup" aria-labelledby="board-theme-label">
            {Object.entries(BOARD_THEMES).map(([key, theme]) => (
              <button
                type="button"
                key={key}
                role="radio"
                aria-checked={boardKey === key}
                className={`theme-option ${boardKey === key ? 'active' : ''}`}
                onClick={() => onBoardChange(key)}
              >
                <span
                  className="theme-swatch"
                  style={{
                    background: `conic-gradient(${theme.dark} 25%, ${theme.light} 0 50%, ${theme.dark} 0 75%, ${theme.light} 0)`,
                  }}
                />
                {theme.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
