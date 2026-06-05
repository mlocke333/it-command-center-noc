import React, { useEffect, useRef, useState } from "react";
import { getSnapshot, subscribeEvents, seedEvents, DATA_SOURCE, REFRESH_SECONDS } from "./adapters/connectors.js";
import { KpiStrip, TenantMatrix, ConnectorStrip, LiveFeed } from "./components/panels.jsx";

const MAX_EVENTS = 40;

export default function App() {
  const seed = DATA_SOURCE === "live" ? [] : seedEvents(7);
  const [snap, setSnap] = useState(null);
  const [events, setEvents] = useState(seed);
  const [now, setNow] = useState(Date.now());
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);

  // Cursor = ts of the newest event we hold; live's first poll (cursor 0)
  // lets the backend default to a recent window.
  const cursorRef = useRef(seed.length ? Math.max(...seed.map((e) => e.ts)) : 0);

  // 1s heartbeat: clock + refresh countdown.
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      setCountdown((c) => (c <= 1 ? REFRESH_SECONDS : c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Snapshot polling on the refresh interval.
  useEffect(() => {
    let alive = true;
    const pull = () => getSnapshot().then((s) => alive && setSnap(s)).catch((e) => alive && setSnap({ error: e.message }));
    pull();
    const t = setInterval(pull, REFRESH_SECONDS * 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Live alert stream: one subscription, transport-agnostic. SSE pushes from
  // the Container App, or polling falls back; mock synthesizes. The merge
  // handler dedupes by id, flashes new rows, and advances the cursor.
  useEffect(() => {
    const merge = (incoming) =>
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        const fresh = incoming.filter((e) => !seen.has(e.id)).map((e) => ({ ...e, fresh: true }));
        if (!fresh.length) return prev;
        cursorRef.current = Math.max(cursorRef.current, ...fresh.map((e) => e.ts));
        return [...fresh.sort((a, b) => b.ts - a.ts), ...prev].slice(0, MAX_EVENTS);
      });

    const unsubscribe = subscribeEvents(merge, () => cursorRef.current);
    return unsubscribe;
  }, []);

  const tenants = snap?.tenants || [];
  const erroredCount = tenants.filter((t) => t.status === "error" || t.errorMessage).length;
  const warnCount = tenants.filter((t) => t.status === "warn").length;
  const health = erroredCount ? "err" : warnCount ? "warn" : "ok";
  const healthLabel = erroredCount ? "Degraded" : warnCount ? "Watch" : "All Systems Go";

  // refresh ring geometry
  const R = 10, C = 2 * Math.PI * R;
  const offset = C * (1 - countdown / REFRESH_SECONDS);

  return (
    <div className="wall">
      <div className="topbar">
        <div className="brand">
          <span className="tag">NOC · <b>Command Center</b></span>
          <span className="sub">MSP Operations · {DATA_SOURCE}</span>
        </div>
        <div className="spacer" />

        <div className={`global-health ${health}`}>
          <span className="beat" />
          {healthLabel}
        </div>

        <div className="refresh">
          <span className="live"><span className="dot" /> Live</span>
          <svg className="ring" viewBox="0 0 26 26">
            <circle className="bg" cx="13" cy="13" r={R} />
            <circle className="fg" cx="13" cy="13" r={R}
              strokeDasharray={C} strokeDashoffset={offset}
              transform="rotate(-90 13 13)" />
          </svg>
          <span>{countdown}s</span>
        </div>

        <div className="clock">
          <div className="t">{new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
          <div className="d">{new Date(now).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</div>
        </div>
      </div>

      {snap?.error && (
        <div className="panel" style={{ marginTop: 12, padding: 24, color: "var(--err)", fontFamily: "var(--mono)" }}>
          DATA SOURCE ERROR — {snap.error}
        </div>
      )}

      {snap && !snap.error && (
        <div className="layout">
          <KpiStrip summary={snap.summary} tenantCount={tenants.length} erroredCount={erroredCount} />
          <TenantMatrix tenants={tenants} />
          <ConnectorStrip connectors={snap.connectors} />
          <LiveFeed events={events} />
        </div>
      )}

      {!snap && <div className="panel" style={{ marginTop: 12, padding: 40, textAlign: "center", color: "var(--txt-dim)", fontFamily: "var(--mono)", letterSpacing: "0.2em" }}>BOOTING WALL…</div>}

      <div className="wallfoot">
        NOC wall on <code>{DATA_SOURCE}</code> data · polling every <code>{REFRESH_SECONDS}s</code> · live feed simulated client-side.
        Set <code>VITE_DATA_SOURCE=live</code> and wire <code>src/adapters/connectors.js</code> to your backend (swap the feed for SSE/WebSocket).
        Credentials stay server-side and are stripped at the boundary via <code>src/lib/sanitize.js</code> — none reach this client.
      </div>
    </div>
  );
}
