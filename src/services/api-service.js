/**
 * Service to fetch games from Chess.com and Lichess APIs.
 */

/**
 * Fetches the last games for a user from Chess.com.
 * Uses the monthly archives API.
 * @param {string} username 
 */
export async function fetchChessComGames(username) {
  try {
    // 1. Get archives
    const archivesRes = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
    if (!archivesRes.ok) throw new Error('Chess.com user not found or API error');
    const { archives } = await archivesRes.json();
    
    if (archives.length === 0) return [];
    
    // 2. Fetch the latest month's games
    const latestArchiveUrl = archives[archives.length - 1];
    const gamesRes = await fetch(latestArchiveUrl);
    if (!gamesRes.ok) throw new Error('Failed to fetch latest Chess.com games');
    const { games } = await gamesRes.json();
    
    // 3. Format games
    return games.reverse().map(game => ({
      id: game.uuid,
      source: 'chess.com',
      url: game.url,
      pgn: game.pgn,
      white: {
        username: game.white.username,
        rating: game.white.rating,
        result: game.white.result
      },
      black: {
        username: game.black.username,
        rating: game.black.rating,
        result: game.black.result
      },
      date: new Date(game.end_time * 1000).toLocaleDateString(),
      timeClass: game.time_class,
      fen: game.fen
    }));
  } catch (error) {
    console.error('Chess.com Fetch Error:', error);
    throw error;
  }
}

/**
 * Fetches the last games for a user from Lichess.
 * @param {string} username 
 * @param {number} limit 
 */
export async function fetchLichessGames(username, limit = 20) {
  try {
    const response = await fetch(`https://lichess.org/api/games/user/${username}?max=${limit}&pgnInJson=true`, {
      headers: { 'Accept': 'application/x-ndjson' }
    });
    
    if (!response.ok) throw new Error('Lichess user not found or API error');
    
    const text = await response.text();
    const games = text.trim().split('\n').map(line => JSON.parse(line));
    
    return games.map(game => ({
      id: game.id,
      source: 'lichess',
      url: `https://lichess.org/${game.id}`,
      pgn: game.pgn,
      white: {
        username: game.players.white.user.name,
        rating: game.players.white.rating,
        result: game.winner === 'white' ? 'win' : (game.winner === 'black' ? 'loss' : 'draw')
      },
      black: {
        username: game.players.black.user.name,
        rating: game.players.black.rating,
        result: game.winner === 'black' ? 'win' : (game.winner === 'white' ? 'loss' : 'draw')
      },
      date: new Date(game.createdAt).toLocaleDateString(),
      timeClass: game.speed,
      fen: game.lastFen
    }));
  } catch (error) {
    console.error('Lichess Fetch Error:', error);
    throw error;
  }
}
