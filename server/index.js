// ─────────────────────────────────────────────────────────────────────────
//  Command Center push service (Azure Container Apps / App Service).
//
//  Serves the same data as the SWA managed Functions, but holds SSE
//  connections open and PUSHES new alerts the instant a server-side poll
//  finds them — true streaming, no client polling. Reuses the exact same
//  aggregation/Graph/secrets logic from ../api/src/lib so there's one source
//  of truth.
//
//  Endpoints:
//    GET /healthz             liveness probe for Container Apps
//    GET /api/snapshot        same shape as the wall's getSnapshot()
//    GET /api/events/stream   Server-Sent Events: each message is a JSON array
//                             of new alerts (newest-first)
//
//  Secrets resolve via ../api/src/lib/secrets.js — Key Vault (managed identity)
//  when KEY_VAULT_URI is set, else environment. No secrets in source.
// ─────────────────────────────────────────────────────────────────────────

const path = require("path");
const fs = require("fs");
const express = require("express");

const { buildSnapshot } = require("../api/src/lib/aggregate");
const { fetchRecentAlerts } = require("../api/src/lib/events");

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const STREAM_INTERVAL_MS = Number(process.env.STREAM_INTERVAL_MS) || 5000;
const SNAPSHOT_CACHE_MS = Number(process.env.SNAPSHOT_CACHE_MS) || 8000;

const app = express();

// CORS (the wall may live on a different origin, e.g. Static Web Apps).
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/healthz", (_req, res) => res.json({ ok: true, clients: clients.size }));

// ── Snapshot (cached) ─────────────────────────────────────────────────────
let snapCache = { at: 0, data: null };
app.get("/api/snapshot", async (_req, res) => {
  try {
    const now = Date.now();
    if (!snapCache.data || now - snapCache.at >= SNAPSHOT_CACHE_MS) {
      snapCache = { at: now, data: await buildSnapshot() };
    }
    res.set("Cache-Control", "no-store").json(snapCache.data);
  } catch (err) {
    res.status(500).json({ error: err.message || "snapshot failed" });
  }
});

// ── SSE event stream ───────────────────────────────────────────────────────
const clients = new Set();

app.get("/api/events/stream", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  });
  res.write("retry: 5000\n\n"); // client reconnect backoff

  clients.add(res);
  req.on("close", () => clients.delete(res));

  // Seed the new client with the last few minutes so the feed isn't blank.
  try {
    const seed = await fetchRecentAlerts(Date.now() - 10 * 60 * 1000);
    if (seed.length) res.write(`data: ${JSON.stringify(seed)}\n\n`);
  } catch { /* non-fatal */ }
});

function broadcast(events) {
  const frame = `data: ${JSON.stringify(events)}\n\n`;
  for (const res of clients) res.write(frame);
}

// Heartbeat comment keeps proxies from closing idle SSE connections.
setInterval(() => {
  for (const res of clients) res.write(": ping\n\n");
}, 20000).unref?.();

// Server-side poll loop: find new alerts once, push to everyone.
let cursor = Date.now() - 60 * 1000;
const seenIds = new Set();
async function pump() {
  try {
    if (clients.size > 0) {
      const batch = await fetchRecentAlerts(cursor);
      const fresh = batch.filter((e) => !seenIds.has(e.id));
      if (fresh.length) {
        fresh.forEach((e) => seenIds.add(e.id));
        cursor = Math.max(cursor, ...fresh.map((e) => e.ts));
        if (seenIds.size > 2000) seenIds.clear(); // bound memory
        broadcast(fresh);
      }
    }
  } catch { /* swallow; next tick retries */ }
  setTimeout(pump, STREAM_INTERVAL_MS);
}
pump();

// ── Optionally serve the built frontend (single all-in-one container) ──────
const distDir = path.join(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.listen(PORT, () => console.log(`Command Center push service on :${PORT}`));
