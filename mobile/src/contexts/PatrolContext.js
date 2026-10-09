import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { config } from '../constants/config';
import { DEMO_ASSIGNMENT, PATROL_ERRORS } from '../constants/patrol';
import { useAuth } from './AuthContext';
import { patrolEngine, patrolRepository, patrolSync } from '../services/patrol';
import { retryDelayMs as nextRetryDelay, isAccurateFix } from '../services/patrol.core';
import { FLUSH_STATE } from '../services/patrolSync.core';
import { createDeviceLocationSource, createSimulatedLocationSource } from '../services/patrolLocation';

export const SYNC_STATE = Object.freeze({
  IDLE: 'IDLE',
  OFFLINE: 'OFFLINE',
  SYNCING: 'SYNCING',
  RETRYING: 'RETRYING',
});

const PatrolContext = createContext(null);

const EMPTY_STATS = { distanceMeters: 0, trackPointCount: 0, incidentCount: 0, pendingCount: 0 };

/**
 * Owns the ranger's patrol while the app is open: the 10-second tracking loop (foreground
 * only), the local save of every record, and automatic upload with back-off retries.
 */
export function PatrolProvider({ children }) {
  const { profile } = useAuth();
  const rangerId = profile?.id;

  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [gpsWeak, setGpsWeak] = useState(false);
  const [syncState, setSyncState] = useState(SYNC_STATE.IDLE);
  const [retryDelayMs, setRetryDelayMs] = useState(null);
  const [lastSummary, setLastSummary] = useState(null);
  const [ready, setReady] = useState(false);
  const [simulateGps, setSimulateGps] = useState(config.demoMode);
  const [simulation, setSimulation] = useState({ weakGps: false, noGps: false });

  const sourceRef = useRef(null);
  const stopTickingRef = useRef(null);
  const syncingRef = useRef(false);
  const failuresRef = useRef(0);
  const retryTimerRef = useRef(null);
  const simulationRef = useRef({ weakGps: false, noGps: false });

  const getSource = useCallback(() => {
    if (!sourceRef.current) {
      sourceRef.current = simulateGps
        ? createSimulatedLocationSource({ controls: simulationRef.current })
        : createDeviceLocationSource(DEMO_ASSIGNMENT.intervalMs);
    }
    return sourceRef.current;
  }, [simulateGps]);

  useEffect(() => {
    sourceRef.current = null;
  }, [simulateGps]);

  const refreshStats = useCallback(
    async (sessionId) => {
      if (!sessionId) return;
      const summary = await patrolEngine.summarize(sessionId);
      setStats({
        distanceMeters: summary.distanceMeters,
        trackPointCount: summary.trackPointCount,
        incidentCount: summary.incidentCount,
        pendingCount: summary.pendingCount,
      });
    },
    [],
  );

  const refreshPending = useCallback(async () => {
    if (!rangerId) return;
    const pendingCount = await patrolRepository.countPending(rangerId);
    setStats((current) => ({ ...current, pendingCount }));
  }, [rangerId]);

  const runSync = useCallback(async () => {
    if (!rangerId || syncingRef.current) return;
    syncingRef.current = true;
    clearTimeout(retryTimerRef.current);
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected || net.isInternetReachable === false) {
        setSyncState(SYNC_STATE.OFFLINE);
        return;
      }
      setSyncState(SYNC_STATE.SYNCING);
      const result = await patrolSync.flush(rangerId);
      if (result.state === FLUSH_STATE.FAILED) {
        failuresRef.current += 1;
        const delay = nextRetryDelay(failuresRef.current);
        setSyncState(SYNC_STATE.RETRYING);
        setRetryDelayMs(delay);
        retryTimerRef.current = setTimeout(() => runSyncRef.current(), delay);
      } else {
        failuresRef.current = 0;
        setRetryDelayMs(null);
        setSyncState(SYNC_STATE.IDLE);
      }
    } finally {
      syncingRef.current = false;
      await refreshPending();
    }
  }, [rangerId, refreshPending]);

  const runSyncRef = useRef(runSync);
  useEffect(() => {
    runSyncRef.current = runSync;
  }, [runSync]);

  const stopTracking = useCallback(() => {
    stopTickingRef.current?.();
    stopTickingRef.current = null;
  }, []);

  const startTracking = useCallback(
    (activeSession) => {
      stopTracking();
      stopTickingRef.current = getSource().startTicking(async (fix) => {
        if (!isAccurateFix(fix)) {
          setGpsWeak(true);
          return;
        }
        setGpsWeak(false);
        await patrolEngine.recordFix(activeSession.id, fix);
        await refreshStats(activeSession.id);
      });
    },
    [getSource, refreshStats, stopTracking],
  );

  // Resume an unfinished patrol when the app is reopened, and upload anything left over.
  useEffect(() => {
    if (!rangerId) return undefined;
    let active = true;
    (async () => {
      const existing = await patrolEngine.getActiveSession(rangerId);
      if (!active) return;
      if (existing) {
        setSession(existing);
        await refreshStats(existing.id);
        startTracking(existing);
      } else {
        await refreshPending();
      }
      setReady(true);
      runSyncRef.current();
    })();
    return () => {
      active = false;
      stopTracking();
      clearTimeout(retryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangerId]);

  useEffect(() => {
    if (!rangerId) return undefined;
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) runSyncRef.current();
    });
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') runSyncRef.current();
    });
    return () => {
      unsubscribeNet();
      appState.remove();
    };
  }, [rangerId]);

  const startPatrol = useCallback(async () => {
    if (!(await getSource().ensurePermission())) {
      throw Object.assign(new Error('Location permission denied'), { code: PATROL_ERRORS.PERMISSION });
    }
    const started = await patrolEngine.startPatrol({ rangerId, assignment: DEMO_ASSIGNMENT });
    setSession(started);
    setStats(EMPTY_STATS);
    setGpsWeak(false);
    setLastSummary(null);
    await refreshPending();
    startTracking(started);
    return started;
  }, [getSource, rangerId, refreshPending, startTracking]);

  const logIncident = useCallback(
    async (input) => {
      const fix = await getSource().getFix();
      const result = await patrolEngine.logIncident({ ...input, sessionId: session.id, fix });
      await refreshStats(session.id);
      runSyncRef.current();
      return result;
    },
    [getSource, refreshStats, session],
  );

  const endPatrol = useCallback(async () => {
    stopTracking();
    const summary = await patrolEngine.endPatrol(session.id);
    setSession(null);
    setGpsWeak(false);
    setLastSummary(summary);
    await runSyncRef.current();
    return summary;
  }, [session, stopTracking]);

  const retryNow = useCallback(() => {
    failuresRef.current = 0;
    return runSyncRef.current();
  }, []);

  const setSimulationFlag = useCallback((flag, value) => {
    simulationRef.current[flag] = value;
    setSimulation({ ...simulationRef.current });
  }, []);

  const value = useMemo(
    () => ({
      ready,
      session,
      stats,
      gpsWeak,
      syncState,
      retryDelayMs,
      lastSummary,
      assignment: DEMO_ASSIGNMENT,
      simulateGps,
      setSimulateGps,
      simulation,
      setSimulationFlag,
      startPatrol,
      logIncident,
      endPatrol,
      retryNow,
    }),
    [
      ready,
      session,
      stats,
      gpsWeak,
      syncState,
      retryDelayMs,
      lastSummary,
      simulateGps,
      simulation,
      setSimulationFlag,
      startPatrol,
      logIncident,
      endPatrol,
      retryNow,
    ],
  );

  return <PatrolContext.Provider value={value}>{children}</PatrolContext.Provider>;
}

export function usePatrol() {
  const context = useContext(PatrolContext);
  if (!context) throw new Error('usePatrol must be used inside <PatrolProvider>');
  return context;
}
