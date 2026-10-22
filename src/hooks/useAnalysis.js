import { useState, useEffect, useRef, useCallback } from 'react';

export function useAnalysis() {
  const [analysisResults, setAnalysisResults] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const workerRef = useRef(null);
  const queueRef = useRef([]);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'analysis') {
        const { fen, value, san, move } = e.data;
        setAnalysisResults((prev) => {
          const newResults = {
            ...prev,
            [fen]: { eval: value, bestMove: san, moveDetails: move }
          };
          
          // Calculate progress based on how many FENs we've analyzed
          const totalRequested = queueRef.current.length;
          const analyzedCount = Object.keys(newResults).length;
          setProgress(Math.round((analyzedCount / totalRequested) * 100));
          
          if (analyzedCount === totalRequested) {
            setIsAnalyzing(false);
          }
          
          return newResults;
        });
      }
    };

    return () => {
      workerRef.current.terminate();
    };
  }, []);

  const analyzeGame = useCallback((fens) => {
    if (!fens || fens.length === 0) return;
    
    setIsAnalyzing(true);
    setProgress(0);
    setAnalysisResults({});
    queueRef.current = fens;

    // Send all moves to worker at once. 
    // The worker will process them sequentially in its own thread.
    fens.forEach((fen) => {
      workerRef.current.postMessage({
        type: 'analyze',
        fen,
        depth: 10, // Lower depth for speed, but still decent
        maxTimeMs: 150 // Faster processing per move
      });
    });
  }, []);

  const stopAnalysis = useCallback(() => {
    workerRef.current.postMessage({ type: 'stop' });
    setIsAnalyzing(false);
  }, []);

  return { analyzeGame, stopAnalysis, analysisResults, isAnalyzing, progress };
}
