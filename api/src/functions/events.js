// ─────────────────────────────────────────────────────────────────────────
//  GET /api/events?since=<epochMs> — new security alerts for the live feed.
//
//  The wall polls this with the timestamp of the newest event it already has,
//  so each call returns only what's arrived since. SWA managed Functions are
//  HTTP-only, so this is poll-based; for true push, front it with Container
//  Apps / App Service exposing SSE and subscribe from the client instead.
// ─────────────────────────────────────────────────────────────────────────

const { app } = require("@azure/functions");
const { fetchRecentAlerts } = require("../lib/events");

app.http("events", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const sinceRaw = request.query.get("since");
      const since = sinceRaw ? Number(sinceRaw) : undefined;
      const events = await fetchRecentAlerts(since);
      return json(200, { events, at: Date.now() });
    } catch (err) {
      context.error("events failed", err);
      return json(500, { error: err.message || "events failed", events: [] });
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
