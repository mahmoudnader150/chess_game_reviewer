import { useLayoutEffect } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { APP_THEMES, BOARD_THEMES, DEFAULT_APP_THEME, DEFAULT_BOARD_THEME } from '../theme/themes'

/** The selected app and board themes, applied to the document before paint. */
export function useThemes() {
  const [appKey, setAppKey] = useLocalStorage('settings:appTheme', DEFAULT_APP_THEME)
  const [boardKey, setBoardKey] = useLocalStorage('settings:boardTheme', DEFAULT_BOARD_THEME)
  const appTheme = APP_THEMES[appKey] ?? APP_THEMES[DEFAULT_APP_THEME]
  const boardTheme = BOARD_THEMES[boardKey] ?? BOARD_THEMES[DEFAULT_BOARD_THEME]

  useLayoutEffect(() => {
    const root = document.documentElement
    for (const [name, value] of Object.entries(appTheme.vars)) root.style.setProperty(name, value)
    root.style.setProperty('--board-light', boardTheme.light)
    root.style.setProperty('--board-dark', boardTheme.dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', appTheme.vars['--bg-dark'])
  }, [appTheme, boardTheme])

  return { appKey, setAppKey, boardKey, setBoardKey, boardTheme }
}
