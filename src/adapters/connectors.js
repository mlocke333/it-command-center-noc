// ─────────────────────────────────────────────────────────────────────────
//  connectors.js — data access for the NOC wall.
//
//  getSnapshot()  → one poll's worth of dashboard state (tenants, summary,
//                   connector health). Called on the refresh interval.
//  getEvent()     → a single new alert for the live feed.
//
//  Mock mode jitters numbers and synthesizes events so the wall feels live.
//  For live mode, point these at YOUR backend aggregation endpoints (which
//  hold secrets server-side and return already-sanitized JSON).
// ─────────────────────────────────────────────────────────────────────────

import * as mock from "../data/mockData.js";
import { sanitizeTenants } from "../lib/sanitize.js";

const SOURCE = import.meta.env.VITE_DATA_SOURCE || "mock";
export const REFRESH_SECONDS = Number(import.meta.env.VITE_REFRESH_SECONDS) || 10;

// Base URL for the backend. Empty = same origin (SWA managed Functions).
// Set to your Container App URL when the push service is a different origin.
const API_BASE = import.meta.env.VITE_API_BASE || "";
// "sse" uses the Container Apps push stream; "poll" hits /api/events on a timer.
const TRANSPORT = import.meta.env.VITE_EVENT_TRANSPORT || "poll";

async function snapshotMock() {
  await new Promise((r) => setTimeout(r, 180));
  return {
    tenants: sanitizeTenants(mock.tenants),
    connectors: mock.connectors,
    summary: mock.liveSummary(),
    at: Date.now(),
  };
}

async function snapshotLive() {
  // Same origin (SWA managed Functions) by default; API_BASE for a Container App.
  const res = await fetch(`${API_BASE}/api/snapshot`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  // Data is already sanitized server-side; sanitize again defensively.
  return { ...data, tenants: sanitizeTenants(data.tenants || []) };
}

export async function getSnapshot() {
  return SOURCE === "live" ? snapshotLive() : snapshotMock();
}

// Fetch alert events newer than `sinceMs`, newest-first. Used by the poll path.
export async function getEventsSince(sinceMs) {
  if (SOURCE === "live") {
    try {
      const res = await fetch(`${API_BASE}/api/events?since=${sinceMs || ""}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      return data.events || [];
    } catch {
      return []; // a failed poll just means no new rows this tick
    }
  }
  // Mock: usually emit one fresh synthetic event, occasionally none.
  return Math.random() < 0.8 ? [mock.nextEvent()] : [];
}

// Unified event subscription. onEvents(arrayNewestFirst) is called as events
// arrive. getCursor() returns the ts of the newest event already shown (poll
// path only). Returns an unsubscribe function.
//
//  • live + SSE   → opens an EventSource to the Container Apps push stream
//  • live + poll  → polls /api/events on a timer (SWA-friendly)
//  • mock         → synthesizes a trickle through the poll path
export function subscribeEvents(onEvents, getCursor) {
  if (SOURCE === "live" && TRANSPORT === "sse") {
    const es = new EventSource(`${API_BASE}/api/events/stream`);
    es.onmessage = (msg) => {
      try {
        const batch = JSON.parse(msg.data);
        if (Array.isArray(batch) && batch.length) onEvents(batch);
      } catch { /* ignore keep-alive / malformed frames */ }
    };
    // EventSource reconnects automatically on error; nothing to do here.
    return () => es.close();
  }

  let alive = true;
  let timer;
  const tick = async () => {
    if (!alive) return;
    const batch = await getEventsSince(getCursor());
    if (alive && batch.length) onEvents(batch);
    timer = setTimeout(tick, 4000 + Math.random() * 2000);
  };
  timer = setTimeout(tick, 2500);
  return () => { alive = false; clearTimeout(timer); };
}

export function seedEvents(n) {
  return mock.seedEvents(n);
}

export { SOURCE as DATA_SOURCE };
