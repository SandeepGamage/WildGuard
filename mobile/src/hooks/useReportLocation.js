import { useCallback, useEffect, useState } from 'react';
import { getCurrentCoordinates } from '../services/location';
import { resolveReportLocation } from '../services/reportLocation';

const LOCATING = { isLocating: true, result: null };

/**
 * Detects the reporter location once the village list is available.
 * Exposes `retry` so the reporter can try GPS again.
 * @param {object[]|undefined} villages Gazetteer; detection waits until it is loaded.
 * @returns {{ isLocating: boolean, result: object|null, retry: () => void }}
 */
export function useReportLocation(villages) {
  const [state, setState] = useState(LOCATING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!villages) return undefined;
    let cancelled = false;
    resolveReportLocation({ getCoordinates: getCurrentCoordinates, villages }).then((result) => {
      if (!cancelled) setState({ isLocating: false, result });
    });
    return () => {
      cancelled = true;
    };
  }, [villages, attempt]);

  const retry = useCallback(() => {
    setState(LOCATING);
    setAttempt((count) => count + 1);
  }, []);

  return { ...state, retry };
}
