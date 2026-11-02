/**
 * Fetch finished games from the public Chess.com and Lichess APIs and
 * normalize them to a common shape:
 *
 * { id, source, url, pgn, white, black, result, date, timeClass, timeControl, termination, officialAccuracy }
 *   white/black: { username, rating, result: 'win'|'loss'|'draw' }
 *   termination: how the game ended, see review/gameEnd.js (null if unknown)
 *   officialAccuracy: { w, b } from the source site, only for games already
 *     reviewed there (null otherwise)
 */

import { chessComTermination, lichessTermination, pgnTermination } from '../review/gameEnd'

const CHESS_COM_DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'])

function chessComResult(code) {
  if (code === 'win') return 'win'
  if (CHESS_COM_DRAWS.has(code)) return 'draw'
  return 'loss'
}

function resultString(white, black) {
  if (white === 'win') return '1-0'
  if (black === 'win') return '0-1'
  return '½-½'
}

/**
 * Most recent Chess.com games (standard chess only). Reads monthly archives
 * newest first until `limit` games are collected (max 3 archives).
 */
export async function fetchChessComGames(username, limit = 40) {
  const user = username.trim().toLowerCase()
  const archivesRes = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`)
  if (archivesRes.status === 404) throw new Error(`Chess.com user "${username}" not found`)
  if (!archivesRes.ok) throw new Error(`Chess.com API error (${archivesRes.status})`)
  const { archives = [] } = await archivesRes.json()

  const games = []
  for (const url of archives.slice(-3).reverse()) {
    const res = await fetch(url)
    if (!res.ok) continue
    const data = await res.json()
    games.push(...(data.games ?? []).filter((g) => g.rules === 'chess' && g.pgn).reverse())
    if (games.length >= limit) break
  }

  return games.slice(0, limit).map((game) => {
    const white = chessComResult(game.white.result)
    const black = chessComResult(game.black.result)
    return {
      id: game.uuid ?? game.url,
      source: 'chess.com',
      url: game.url,
      pgn: game.pgn,
      white: { username: game.white.username, rating: game.white.rating, result: white },
      black: { username: game.black.username, rating: game.black.rating, result: black },
      result: resultString(white, black),
      date: new Date(game.end_time * 1000),
      timeClass: game.time_class,
      timeControl: game.time_control,
      termination: chessComTermination(game.white.result, game.black.result),
      officialAccuracy: game.accuracies ? { w: game.accuracies.white ?? null, b: game.accuracies.black ?? null } : null,
    }
  })
}

function lichessPlayer(player = {}) {
  if (player.user) return { username: player.user.name, rating: player.rating ?? '?' }
  if (player.aiLevel) return { username: `Stockfish level ${player.aiLevel}`, rating: '' }
  return { username: 'Anonymous', rating: '' }
}

/** Most recent Lichess games (standard chess only). */
export async function fetchLichessGames(username, limit = 40) {
  const params = new URLSearchParams({
    max: String(limit),
    pgnInJson: 'true',
    moves: 'true',
    accuracy: 'true',
    perfType: 'ultraBullet,bullet,blitz,rapid,classical,correspondence',
  })
  const response = await fetch(
    `https://lichess.org/api/games/user/${encodeURIComponent(username.trim())}?${params}`,
    { headers: { Accept: 'application/x-ndjson' } },
  )
  if (response.status === 404) throw new Error(`Lichess user "${username}" not found`)
  if (response.status === 429) throw new Error('Lichess rate limit reached, please wait a minute')
  if (!response.ok) throw new Error(`Lichess API error (${response.status})`)

  const text = await response.text()
  const games = text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
    .filter((g) => g.variant === 'standard' && g.pgn && g.moves)

  return games.map((game) => {
    const white = game.winner === 'white' ? 'win' : game.winner === 'black' ? 'loss' : 'draw'
    const black = game.winner === 'black' ? 'win' : game.winner === 'white' ? 'loss' : 'draw'
    const whiteAccuracy = game.players.white.analysis?.accuracy ?? null
    const blackAccuracy = game.players.black.analysis?.accuracy ?? null
    const clock = game.clock ? `${game.clock.initial}+${game.clock.increment}` : null
    return {
      id: game.id,
      source: 'lichess',
      url: `https://lichess.org/${game.id}`,
      pgn: game.pgn,
      white: { ...lichessPlayer(game.players.white), result: white },
      black: { ...lichessPlayer(game.players.black), result: black },
      result: resultString(white, black),
      date: new Date(game.lastMoveAt ?? game.createdAt),
      timeClass: game.speed,
      timeControl: clock,
      termination: lichessTermination(game.status, Boolean(game.winner)),
      officialAccuracy: whiteAccuracy != null || blackAccuracy != null ? { w: whiteAccuracy, b: blackAccuracy } : null,
    }
  })
}

/** Build a game object from a pasted PGN. */
export function gameFromPgn(pgn, rawHeaders) {
  // chess.js fills missing tags with "?"; treat those as absent.
  const headers = Object.fromEntries(
    Object.entries(rawHeaders).filter(([, v]) => v && v !== '?' && !/^\?+[.?]*$/.test(v)),
  )
  const result = headers.Result ?? '*'
  const toResult = (side) => {
    if (result === '1/2-1/2') return 'draw'
    if (result === '1-0') return side === 'w' ? 'win' : 'loss'
    if (result === '0-1') return side === 'b' ? 'win' : 'loss'
    return 'draw'
  }
  return {
    id: `pgn-${Date.now()}`,
    source: 'pgn',
    url: null,
    pgn,
    white: { username: headers.White ?? 'White', rating: headers.WhiteElo ?? '', result: toResult('w') },
    black: { username: headers.Black ?? 'Black', rating: headers.BlackElo ?? '', result: toResult('b') },
    result: result === '1/2-1/2' ? '½-½' : result,
    date: headers.Date ? new Date(headers.Date.replace(/\./g, '-')) : new Date(),
    timeClass: headers.TimeControl ?? 'pgn',
    timeControl: headers.TimeControl ?? null,
    termination: pgnTermination(headers),
    officialAccuracy: null,
  }
}
