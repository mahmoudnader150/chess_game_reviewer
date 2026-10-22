import { useState, useEffect, useRef, useCallback } from 'react';
import { classifyMove } from '../services/classification';

export function useAnalysis() {
  const [analysisResults, setAnalysisResults] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const workerRef = useRef(null);

  useEffect(() => {
    // Initialize Web Worker
    workerRef.current = new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'analysis') {
        const { fen, value, san, move } = e.data;
        setAnalysisResults((prev) => ({
          ...prev,
          [fen]: { eval: value, bestMove: san, moveDetails: move }
        }));
      }
    };

    return () => {
      workerRef.current.terminate();
    };
  }, []);

  const analyzeGame = useCallback(async (fens) => {
    setIsAnalyzing(true);
    setProgress(0);
    setAnalysisResults({});

    for (let i = 0; i < fens.length; i++) {
      const fen = fens[i];
      
      // Request analysis from worker
      workerRef.current.postMessage({
        type: 'analyze',
        fen,
        depth: 12, // Sufficient for quick review
        maxTimeMs: 300
      });

      // Wait for result (simplified polling/callback logic for this prototype)
      // In a real app, we'd use a promise-based queue
      await new Promise(resolve => {
        const checkResult = () => {
          if (workerRef.current) {
            // This is a bit hacky, but for a one-turn implementation it works:
            // The worker will send 'analysis' message which updates state.
            // We just wait a bit for the worker to finish.
            setTimeout(resolve, 350); 
          }
        };
        checkResult();
      });
      
      setProgress(Math.round(((i + 1) / fens.length) * 100));
    }

    setIsAnalyzing(false);
  }, []);

  return { analyzeGame, analysisResults, isAnalyzing, progress };
}
