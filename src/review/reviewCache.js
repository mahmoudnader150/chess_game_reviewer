// Persists engine evaluations in localStorage so a reviewed game opens
// instantly, even after a reload. Only the raw evaluations are stored; the
// review itself is rebuilt from them (cheap, and picks up rule changes).

const PREFIX = 'review:v1:'
const INDEX_KEY = 'review:v1:index'
const MAX_ENTRIES = 40

function hash(text) {
  let h = 5381
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export function cacheKey(pgn, depth) {
  return `${depth}:${hash(pgn)}:${pgn.length}`
}

function readIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY)) ?? []
  } catch {
    return []
  }
}

export function loadEvals(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    // Mark as recently used.
    const index = readIndex().filter((k) => k !== key)
    index.push(key)
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveEvals(key, evals) {
  const slim = evals.map((e) => ({
    score: e.score,
    depth: e.depth,
    lines: e.lines.map((l) => ({ uci: l.uci, pv: l.pv.slice(0, 4), score: l.score })),
  }))
  const data = JSON.stringify(slim)
  let index = readIndex().filter((k) => k !== key)
  for (let attempt = 0; attempt < 10; attempt += 1) {
    while (index.length >= MAX_ENTRIES) localStorage.removeItem(PREFIX + index.shift())
    try {
      localStorage.setItem(PREFIX + key, data)
      index.push(key)
      localStorage.setItem(INDEX_KEY, JSON.stringify(index))
      return
    } catch {
      // Quota exceeded: evict the oldest entry and retry.
      if (index.length === 0) return
      localStorage.removeItem(PREFIX + index.shift())
    }
  }
}
