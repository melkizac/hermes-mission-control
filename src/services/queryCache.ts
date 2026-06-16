type QueryCacheEntry<T> = {
  data?: T;
  updatedAt: number;
  inFlight?: Promise<T>;
};

type QueryCacheOptions = {
  staleAfterMs?: number;
  force?: boolean;
  enabled?: boolean;
};

const DEFAULT_STALE_AFTER_MS = 30_000;
const QUERY_CACHE_EVENT = "hmc:query-cache-updated";
const cache = new Map<string, QueryCacheEntry<unknown>>();

function now() {
  return Date.now();
}

function emitQueryCacheUpdated(key: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(QUERY_CACHE_EVENT, { detail: { key, updatedAt: now() } }));
}

function fetchAndStore<T>(key: string, fetcher: () => Promise<T>) {
  const existing = cache.get(key) as QueryCacheEntry<T> | undefined;
  const request = fetcher()
    .then((data) => {
      cache.set(key, { data, updatedAt: now() });
      emitQueryCacheUpdated(key);
      return data;
    })
    .catch((err) => {
      if (existing?.data !== undefined) {
        cache.set(key, { data: existing.data, updatedAt: existing.updatedAt });
      } else {
        cache.delete(key);
      }
      throw err;
    });
  cache.set(key, { data: existing?.data, updatedAt: existing?.updatedAt ?? 0, inFlight: request });
  return request;
}

export function queryCacheEventName() {
  return QUERY_CACHE_EVENT;
}

export function invalidateQueryCache(match?: string | RegExp) {
  if (!match) {
    cache.clear();
    return;
  }
  for (const key of Array.from(cache.keys())) {
    if (typeof match === "string" ? key.includes(match) : match.test(key)) {
      cache.delete(key);
    }
  }
}

export function getQueryCacheSnapshot() {
  return Array.from(cache.entries()).map(([key, entry]) => ({
    key,
    hasData: entry.data !== undefined,
    updatedAt: entry.updatedAt,
    inFlight: Boolean(entry.inFlight),
  }));
}

export function cachedJsonRequest<T>(key: string, fetcher: () => Promise<T>, options: QueryCacheOptions = {}): Promise<T> {
  const { staleAfterMs = DEFAULT_STALE_AFTER_MS, force = false, enabled = true } = options;
  if (!enabled) return fetcher();

  const entry = cache.get(key) as QueryCacheEntry<T> | undefined;
  const age = entry?.updatedAt ? now() - entry.updatedAt : Number.POSITIVE_INFINITY;
  const hasUsableData = entry?.data !== undefined;
  const isStale = age > staleAfterMs;

  if (force) {
    if (entry?.inFlight) return entry.inFlight;
    return fetchAndStore(key, fetcher);
  }

  if (hasUsableData) {
    if (isStale && !entry?.inFlight) {
      void fetchAndStore(key, fetcher).catch(() => {
        // Keep stale data available; foreground loaders surface errors on the next uncached/forced fetch.
      });
    }
    return Promise.resolve(entry.data as T);
  }

  if (entry?.inFlight) return entry.inFlight;
  return fetchAndStore(key, fetcher);
}
