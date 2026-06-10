import { useCallback, useEffect, useMemo, useRef, useState, type DependencyList } from "react";
import { queryCacheEventName } from "../services/queryCache";

declare global {
  interface Window {
    __hmcRefreshMode?: string;
  }
}

export type RefreshMode = "initial" | "manual" | "poll" | "focus" | "event";

type RealtimeRefreshOptions = {
  pollMs?: number;
  staleAfterMs?: number;
  debounceMs?: number;
  eventName?: string;
  enabled?: boolean;
};

export type RealtimeRefreshState = {
  initialLoading: boolean;
  refreshing: boolean;
  stale: boolean;
  lastLoadedAt: number | null;
  lastAttemptAt: number | null;
  error: string | null;
  refresh: (mode?: RefreshMode) => Promise<void>;
  statusLabel: string;
  ageLabel: string;
};

const DEFAULT_POLL_MS = 15_000;
const DEFAULT_STALE_AFTER_MS = 45_000;
const DEFAULT_DEBOUNCE_MS = 180;
const DEFAULT_EVENT_NAME = "hmc:realtime-refresh";

function formatAge(now: number, timestamp: number | null) {
  if (!timestamp) return "not loaded yet";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export function useRealtimeRefresh(
  loader: (mode: RefreshMode) => Promise<void>,
  dependencies: DependencyList,
  options: RealtimeRefreshOptions = {},
): RealtimeRefreshState {
  const {
    pollMs = DEFAULT_POLL_MS,
    staleAfterMs = DEFAULT_STALE_AFTER_MS,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    eventName = DEFAULT_EVENT_NAME,
    enabled = true,
  } = options;
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const [lastAttemptAt, setLastAttemptAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const lastLoadedAtRef = useRef<number | null>(null);

  const refresh = useCallback(async (mode: RefreshMode = "manual") => {
    if (!enabled || inFlight.current) return;
    const startedAt = Date.now();
    inFlight.current = true;
    setLastAttemptAt(startedAt);
    if (lastLoadedAtRef.current) setRefreshing(true);
    else setInitialLoading(true);
    try {
      const previousRefreshMode = window.__hmcRefreshMode;
      window.__hmcRefreshMode = mode;
      try {
        await loader(mode);
      } finally {
        window.__hmcRefreshMode = previousRefreshMode;
      }
      if (!mounted.current) return;
      const completedAt = Date.now();
      lastLoadedAtRef.current = completedAt;
      setLastLoadedAt(completedAt);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : String(err || "Refresh failed"));
    } finally {
      if (mounted.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
      inFlight.current = false;
    }
  }, [enabled, loader]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setTimeout(() => void refresh("initial"), debounceMs);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refresh, debounceMs, ...dependencies]);

  useEffect(() => {
    if (!enabled || pollMs <= 0) return undefined;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void refresh("poll");
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [enabled, pollMs, refresh]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onFocus = () => void refresh("focus");
    const onVisibility = () => {
      if (!document.hidden) void refresh("focus");
    };
    const onEvent = () => void refresh("event");
    const onQueryCacheUpdated = () => void refresh("event");
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(eventName, onEvent);
    window.addEventListener(queryCacheEventName(), onQueryCacheUpdated);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(eventName, onEvent);
      window.removeEventListener(queryCacheEventName(), onQueryCacheUpdated);
    };
  }, [enabled, eventName, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const stale = Boolean(lastLoadedAt && now - lastLoadedAt > staleAfterMs);
  const ageLabel = useMemo(() => formatAge(now, lastLoadedAt), [now, lastLoadedAt]);
  const statusLabel = initialLoading
    ? "Loading real backend data…"
    : refreshing
      ? `Refreshing · last ${ageLabel}`
      : stale
        ? `Stale · last ${ageLabel}`
        : `Live · last ${ageLabel}`;

  return { initialLoading, refreshing, stale, lastLoadedAt, lastAttemptAt, error, refresh, statusLabel, ageLabel };
}
