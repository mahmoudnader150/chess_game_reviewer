import { useEffect, useState } from 'react'

/** useState that persists to localStorage (JSON). */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : JSON.parse(raw)
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // storage full or unavailable: keep the in-memory value
    }
  }, [key, value])
  return [value, setValue]
}
