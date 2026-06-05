// ─────────────────────────────────────────────────────────────────────────
//  events.js — recent security alerts across all tenants, newest first,
//  mapped to the wall's feed event shape: { id, sev, tenant, text, ts }.
//
//  Backs GET /api/events?since=<ms>. Each tenant is polled independently and
//  failures are swallowed per-tenant so one bad tenant can't stall the feed.
//  Source: Microsoft Graph security/alerts_v2 (needs SecurityAlert.Read.All).
// ─────────────────────────────────────────────────────────────────────────

const tenantConfig = require("../config/tenants");
const { getToken, graphGet } = require("./graph");

// Graph alerts_v2 severity → feed severity buckets the UI styles.
const SEV = { high: "high", medium: "medium", low: "low", informational: "info", unknownFutureValue: "info" };

async function tenantAlerts(tenant, sinceIso) {
  let token;
  try {
    token = await getToken(tenant);
  } catch {
    return []; // auth issues already surface via the snapshot's tenant status
  }

  // Filter by creation time so we only pull what's new since the cursor.
  const filter = encodeURIComponent(`createdDateTime ge ${sinceIso}`);
  const path = `/security/alerts_v2?$filter=${filter}&$orderby=createdDateTime desc&$top=50`;

  let data;
  try {
    data = await graphGet(token, path);
  } catch {
    return [];
  }

  return (data.value || []).map((a) => ({
    id: a.id,
    sev: SEV[a.severity] || "info",
    tenant: tenant.name,
    text: a.title || a.displayName || "Security alert",
    ts: a.createdDateTime ? new Date(a.createdDateTime).getTime() : Date.now(),
  }));
}

/**
 * @param {number} sinceMs  epoch ms; only alerts created after this are returned
 * @returns {Promise<Array>} events newest-first across all tenants
 */
async function fetchRecentAlerts(sinceMs) {
  // Default to the last 10 minutes if no cursor is supplied.
  const since = Number.isFinite(sinceMs) ? sinceMs : Date.now() - 10 * 60 * 1000;
  const sinceIso = new Date(since).toISOString();

  const batches = await Promise.all(tenantConfig.map((t) => tenantAlerts(t, sinceIso)));
  return batches
    .flat()
    .filter((e) => e.ts > since)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 60);
}

module.exports = { fetchRecentAlerts };
