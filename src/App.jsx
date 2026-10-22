import React, { useState, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { fetchChessComGames, fetchLichessGames } from './services/api-service';
import { useAnalysis } from './hooks/useAnalysis';
import { classifyMove, calculateAccuracy, MOVE_TYPES } from './services/classification';

function EvalBar({ evaluation }) {
  // Convert evaluation (in centipawns) to a percentage for white
  // 0 is -10 (black winning), 100 is +10 (white winning), 50 is even
  const evalScore = evaluation / 100;
  const percentage = Math.max(0, Math.min(100, (evalScore / 20 + 0.5) * 100));
  
  const displayEval = Math.abs(evalScore).toFixed(1);
  const isWhiteBetter = evalScore >= 0;

  return (
    <div className="eval-bar-container">
      <div className="eval-text" style={{ opacity: isWhiteBetter ? 1 : 0 }}>{displayEval}</div>
      <div className="eval-bar-fill" style={{ height: `${percentage}%` }}></div>
      <div className="eval-text bottom" style={{ opacity: !isWhiteBetter ? 1 : 0 }}>{displayEval}</div>
    </div>
  );
}

function ReviewView({ game }) {
  const [chess, setChess] = useState(new Chess());
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const { analyzeGame, analysisResults, isAnalyzing, progress } = useAnalysis();
  
  // Parse PGN to get all FENs and moves
  const gameData = useMemo(() => {
    const tempChess = new Chess();
    tempChess.loadPgn(game.pgn);
    const history = tempChess.history({ verbose: true });
    const fens = [new Chess().fen()];
    const moves = [];
    
    tempChess.reset();
    history.forEach((move) => {
      tempChess.move(move);
      fens.push(tempChess.fen());
      moves.push(move);
    });
    
    return { fens, moves };
  }, [game.pgn]);

  useEffect(() => {
    analyzeGame(gameData.fens);
  }, [gameData.fens, analyzeGame]);

  const goToMove = (index) => {
    const newChess = new Chess();
    for (let i = 0; i < index; i++) {
      newChess.move(gameData.moves[i]);
    }
    setChess(newChess);
    setCurrentMoveIndex(index);
  };

  // Calculate accuracies
  const accuracies = useMemo(() => {
    if (Object.keys(analysisResults).length < gameData.fens.length) return null;
    
    let whiteLoss = 0;
    let blackLoss = 0;
    let whiteMoves = 0;
    let blackMoves = 0;

    gameData.moves.forEach((move, i) => {
      const prevFen = gameData.fens[i];
      const currentFen = gameData.fens[i + 1];
      const prevEval = analysisResults[prevFen]?.eval || 0;
      const currentEval = analysisResults[currentFen]?.eval || 0;
      
      const loss = Math.abs(prevEval - currentEval);
      if (i % 2 === 0) {
        whiteLoss += loss;
        whiteMoves++;
      } else {
        blackLoss += loss;
        blackMoves++;
      }
    });

    return {
      white: calculateAccuracy(whiteMoves ? whiteLoss / whiteMoves : 0),
      black: calculateAccuracy(blackMoves ? blackLoss / blackMoves : 0)
    };
  }, [analysisResults, gameData]);

  const currentEval = analysisResults[chess.fen()]?.eval || 0;

  return (
    <main className="review-layout">
      <div className="board-section">
        <EvalBar evaluation={currentEval} />
        <div className="board-container">
          <Chessboard 
            position={chess.fen()} 
            boardOrientation={game.white.username.toLowerCase().includes('user') ? 'white' : 'black'}
            customDarkSquareStyle={{ backgroundColor: '#779556' }}
            customLightSquareStyle={{ backgroundColor: '#ebecd0' }}
          />
        </div>
      </div>
      
      <div className="analysis-panel">
        <div className="move-list">
          {isAnalyzing && <div style={{ padding: '10px' }}>Analyzing... {progress}%</div>}
          
          {gameData.moves.map((move, i) => {
            const isWhite = i % 2 === 0;
            if (!isWhite) return null;
            
            const whiteMove = gameData.moves[i];
            const blackMove = gameData.moves[i + 1];
            
            const whiteFen = gameData.fens[i + 1];
            const blackFen = blackMove ? gameData.fens[i + 2] : null;
            
            const whiteRes = analysisResults[whiteFen];
            const blackRes = blackFen ? analysisResults[blackFen] : null;
            
            const whiteClass = whiteRes ? classifyMove(analysisResults[gameData.fens[i]]?.eval || 0, whiteRes.eval, whiteRes.eval) : null;
            const blackClass = blackRes ? classifyMove(whiteRes?.eval || 0, blackRes.eval, blackRes.eval) : null;

            return (
              <div key={i} className="move-row">
                <div style={{ color: 'var(--text-secondary)' }}>{Math.floor(i / 2) + 1}.</div>
                <div 
                  className={`move-cell ${currentMoveIndex === i + 1 ? 'active' : ''}`}
                  onClick={() => goToMove(i + 1)}
                >
                  {whiteMove.san}
                  {whiteClass && whiteClass.symbol && (
                    <div className="badge" style={{ backgroundColor: whiteClass.color }}>{whiteClass.symbol}</div>
                  )}
                </div>
                {blackMove && (
                  <div 
                    className={`move-cell ${currentMoveIndex === i + 2 ? 'active' : ''}`}
                    onClick={() => goToMove(i + 2)}
                  >
                    {blackMove.san}
                    {blackClass && blackClass.symbol && (
                      <div className="badge" style={{ backgroundColor: blackClass.color }}>{blackClass.symbol}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {accuracies && (
          <div className="accuracy-section">
            <div className="accuracy-bars">
              <div className="accuracy-bar">
                <div className="accuracy-fill" style={{ width: `${accuracies.white}%` }}></div>
                <div className="accuracy-text">
                  <span>{game.white.username}</span>
                  <span>{accuracies.white}%</span>
                </div>
              </div>
              <div className="accuracy-bar">
                <div className="accuracy-fill" style={{ width: `${accuracies.black}%`, backgroundColor: '#403d39' }}></div>
                <div className="accuracy-text">
                  <span>{game.black.username}</span>
                  <span>{accuracies.black}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="navigation-controls">
          <button className="btn-nav" onClick={() => goToMove(0)}>«</button>
          <button className="btn-nav" onClick={() => goToMove(Math.max(0, currentMoveIndex - 1))}>‹</button>
          <button className="btn-nav" onClick={() => goToMove(Math.min(gameData.moves.length, currentMoveIndex + 1))}>›</button>
          <button className="btn-nav" onClick={() => goToMove(gameData.moves.length)}>»</button>
        </div>
      </div>
    </main>
  );
}

function App() {
  const [username, setUsername] = useState('');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);

  const handleSearch = async (source) => {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      let fetchedGames = [];
      if (source === 'chess.com') {
        fetchedGames = await fetchChessComGames(username);
      } else {
        fetchedGames = await fetchLichessGames(username);
      }
      setGames(fetchedGames);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGame = (game) => {
    setSelectedGame(game);
  };

  return (
    <div className="app-container">
      <header>
        <div className="logo">CHESS REVIEWER</div>
        {selectedGame && (
          <button className="btn-primary" onClick={() => setSelectedGame(null)}>
            Back to List
          </button>
        )}
      </header>

      {!selectedGame ? (
        <main className="dashboard">
          <section className="search-section">
            <h2>Review Your Games</h2>
            <div className="search-controls">
              <input 
                type="text" 
                placeholder="Enter Username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <button className="btn-primary" onClick={() => handleSearch('chess.com')}>
                Chess.com
              </button>
              <button className="btn-primary" onClick={() => handleSearch('lichess')}>
                Lichess
              </button>
            </div>
          </section>

          {loading && <p>Loading games...</p>}
          {error && <p style={{ color: 'red' }}>{error}</p>}

          <section className="games-list">
            {games.map((game) => (
              <GameCard key={game.id} game={game} onSelect={handleSelectGame} />
            ))}
          </section>
        </main>
      ) : (
        <ReviewView game={selectedGame} />
      )}
    </div>
  );
}

function GameCard({ game, onSelect }) {
  return (
    <div className="game-card" onClick={() => onSelect(game)}>
      <div className="game-info">
        <div className="players">
          <div className={`player ${game.white.result === 'win' ? 'winner' : ''}`}>
            <span>⚪ {game.white.username}</span>
            <span>{game.white.rating}</span>
          </div>
          <div className={`player ${game.black.result === 'win' ? 'winner' : ''}`}>
            <span>⚫ {game.black.username}</span>
            <span>{game.black.rating}</span>
          </div>
        </div>
        <div className="game-meta">
          <span>{game.timeClass}</span>
          <span>{game.date}</span>
          <span>{game.source}</span>
        </div>
      </div>
    </div>
  );
}

export default App;
