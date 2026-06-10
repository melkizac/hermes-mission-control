type FetchTiming = {
  type: "api";
  method: string;
  path: string;
  status: number;
  ok: boolean;
  durationMs: number;
  payloadBytes: number;
  backendDurationMs?: number;
  backendHandler?: string;
  backendPayloadBytes?: number;
  slow: boolean;
  view: string;
  route: string;
  startedAt: string;
};

type RouteTiming = {
  type: "route";
  view: string;
  route: string;
  previousView?: string;
  previousRoute?: string;
  sincePreviousRouteMs?: number;
  startedAt: string;
};

const MAX_EVENTS = 400;
const SLOW_API_MS = 750;
const storageKey = "hmc.performance.events";
let installed = false;
let currentView = "unknown";
let lastRoute: { view: string; route: string; at: number } | null = null;

function nowIso() {
  return new Date().toISOString();
}

function safePath(input: RequestInfo | URL): string {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  try {
    const url = new URL(raw, window.location.origin);
    const allowedParams = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      if (/^(q|status|source|state|category|project|tenant|area|limit|days|model|section|agent|agentId|type|risk|health|assigned|board)$/i.test(key)) {
        allowedParams.set(key, value.length > 80 ? `${value.slice(0, 77)}…` : value);
      } else {
        allowedParams.set(key, "[redacted]");
      }
    }
    const query = allowedParams.toString();
    return `${url.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return String(raw).split("?")[0] || "unknown";
  }
}

function readEvents(): Array<FetchTiming | RouteTiming> {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "[]");
  } catch {
    return [];
  }
}

function persistEvent(event: FetchTiming | RouteTiming) {
  const events = [...readEvents(), event].slice(-MAX_EVENTS);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(events));
  } catch {
    // Local storage can be disabled; console + beacon still provide evidence.
  }
  if (event.type === "api" && (event.slow || event.status >= 500)) {
    console.warn("[HMC perf] slow/error API", event);
  } else {
    console.debug("[HMC perf]", event);
  }
  void sendEvent(event);
}

async function sendEvent(event: FetchTiming | RouteTiming) {
  try {
    if (event.type === "api" && event.path.startsWith("/api/performance")) return;
    await window.fetch("/api/performance/events", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch {
    // Telemetry must never break Mission Control navigation.
  }
}

function payloadSize(init: RequestInit | undefined): number {
  const body = init?.body;
  if (!body) return 0;
  if (typeof body === "string") return new Blob([body]).size;
  if (body instanceof Blob) return body.size;
  if (body instanceof URLSearchParams) return new Blob([body.toString()]).size;
  return 0;
}

export function installPerformanceTelemetry() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = performance.now();
    const startedAt = nowIso();
    const path = safePath(input);
    const method = (init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET") || "GET").toUpperCase();
    try {
      const response = await originalFetch(input, init);
      if (path.startsWith("/api/") && !path.startsWith("/api/performance")) {
        const durationMs = Math.round(performance.now() - started);
        const backendDuration = Number(response.headers.get("X-HMC-Duration-Ms") || "");
        const backendPayload = Number(response.headers.get("X-HMC-Payload-Bytes") || "");
        persistEvent({
          type: "api",
          method,
          path,
          status: response.status,
          ok: response.ok,
          durationMs,
          payloadBytes: payloadSize(init),
          backendDurationMs: Number.isFinite(backendDuration) ? backendDuration : undefined,
          backendHandler: response.headers.get("X-HMC-Handler") || undefined,
          backendPayloadBytes: Number.isFinite(backendPayload) ? backendPayload : undefined,
          slow: durationMs >= SLOW_API_MS || backendDuration >= SLOW_API_MS,
          view: currentView,
          route: window.location.pathname,
          startedAt,
        });
      }
      return response;
    } catch (error) {
      if (path.startsWith("/api/") && !path.startsWith("/api/performance")) {
        persistEvent({
          type: "api",
          method,
          path,
          status: 0,
          ok: false,
          durationMs: Math.round(performance.now() - started),
          payloadBytes: payloadSize(init),
          slow: true,
          view: currentView,
          route: window.location.pathname,
          startedAt,
        });
      }
      throw error;
    }
  };
  (window as any).__HMC_PERF__ = {
    events: readEvents,
    clear: () => window.localStorage.removeItem(storageKey),
    summary: () => summarizePerformanceEvents(readEvents()),
  };
}

export function recordRouteTelemetry(view: string) {
  currentView = view;
  const route = window.location.pathname;
  const at = performance.now();
  const event: RouteTiming = {
    type: "route",
    view,
    route,
    previousView: lastRoute?.view,
    previousRoute: lastRoute?.route,
    sincePreviousRouteMs: lastRoute ? Math.round(at - lastRoute.at) : undefined,
    startedAt: nowIso(),
  };
  lastRoute = { view, route, at };
  persistEvent(event);
}

export function summarizePerformanceEvents(events: Array<FetchTiming | RouteTiming>) {
  const apiEvents = events.filter((event): event is FetchTiming => event.type === "api");
  const byView = new Map<string, FetchTiming[]>();
  for (const event of apiEvents) {
    byView.set(event.view, [...(byView.get(event.view) ?? []), event]);
  }
  return Array.from(byView.entries()).map(([view, items]) => {
    const durations = items.map((item) => item.durationMs).sort((a, b) => a - b);
    const payload = items.reduce((sum, item) => sum + (item.backendPayloadBytes || item.payloadBytes || 0), 0);
    return {
      view,
      requests: items.length,
      slow: items.filter((item) => item.slow).length,
      errors: items.filter((item) => !item.ok).length,
      totalPayloadBytes: payload,
      p50Ms: durations[Math.floor(durations.length * 0.5)] ?? 0,
      p95Ms: durations[Math.floor(durations.length * 0.95)] ?? 0,
      endpoints: items.map((item) => `${item.method} ${item.path} ${item.status} ${item.durationMs}ms`),
    };
  });
}
