// ─────────────────────────────────────────────────────────────────────────
//  GET /api/snapshot — one poll's worth of dashboard state for the wall.
//
//  Azure Functions v4 programming model. authLevel "anonymous" because access
//  is gated at the Static Web Apps layer (Entra ID via staticwebapp.config.json)
//  — change to "function" if you call this from outside SWA.
//
//  A short in-memory cache prevents every wall refresh from fanning out to
//  every tenant/vendor; tune CACHE_MS to your refresh interval.
// ─────────────────────────────────────────────────────────────────────────

const { app } = require("@azure/functions");
const { buildSnapshot } = require("../lib/aggregate");

const CACHE_MS = 8000;
let _cache = { at: 0, data: null };

app.http("snapshot", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const now = Date.now();
      if (_cache.data && now - _cache.at < CACHE_MS) {
        return json(200, { ..._cache.data, cached: true });
      }
      const data = await buildSnapshot();
      _cache = { at: now, data };
      return json(200, data);
    } catch (err) {
      context.error("snapshot failed", err);
      return json(500, { error: err.message || "snapshot failed" });
    }
  },
});

function json(status, body) {
  return {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}
