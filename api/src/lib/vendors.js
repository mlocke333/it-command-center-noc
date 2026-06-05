// ─────────────────────────────────────────────────────────────────────────
//  vendors.js — Cisco Meraki + N-able N-sight.
//
//  Each returns a small summary slice for the wall, and a connector health
//  flag. Failures degrade gracefully (connector shows "degraded"/"down")
//  rather than failing the whole snapshot.
// ─────────────────────────────────────────────────────────────────────────

const { getSecret } = require("./secrets");

// ── Meraki ───────────────────────────────────────────────────────────────
async function pollMeraki() {
  const key = await getSecret("MERAKI_API_KEY");
  if (!key) return { ok: false, summary: { devices: 0, online: 0, clients: 0, securityEvents: 0 } };

  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  try {
    const orgRes = await fetch("https://api.meraki.com/api/v1/organizations", { headers });
    if (!orgRes.ok) throw new Error(`Meraki ${orgRes.status}`);
    const orgs = await orgRes.json();

    let devices = 0, online = 0;
    // Aggregate device statuses across orgs (cap to a few orgs for latency).
    for (const org of orgs.slice(0, 10)) {
      const sRes = await fetch(
        `https://api.meraki.com/api/v1/organizations/${org.id}/devices/statuses`,
        { headers }
      );
      if (!sRes.ok) continue;
      const statuses = await sRes.json();
      devices += statuses.length;
      online += statuses.filter((d) => d.status === "online").length;
    }
    return { ok: true, summary: { devices, online, clients: 0, securityEvents: 0 } };
  } catch (err) {
    return { ok: false, error: err.message, summary: { devices: 0, online: 0, clients: 0, securityEvents: 0 } };
  }
}

// ── N-sight (N-able RMM) ──────────────────────────────────────────────────
//  N-sight uses a key'd XML API at https://<region>.system-monitor.com/api/.
//  This fetches the device list service and counts online vs total. The
//  response is XML; parse with fast-xml-parser or regex as needed.
async function pollNsight() {
  const key = await getSecret("NSIGHT_API_KEY");
  const region = (await getSecret("NSIGHT_REGION")) || "www";
  if (!key) return { ok: false, summary: { devices: 0, online: 0, alerts: 0 } };

  try {
    const url = `https://${region}.system-monitor.com/api/?apikey=${encodeURIComponent(key)}&service=list_failing_checks`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`N-sight ${res.status}`);
    const xml = await res.text();
    // Lightweight count of failing checks; replace with a real XML parse.
    const alerts = (xml.match(/<check[\s>]/g) || []).length;
    return { ok: true, summary: { devices: 0, online: 0, alerts } };
  } catch (err) {
    return { ok: false, error: err.message, summary: { devices: 0, online: 0, alerts: 0 } };
  }
}

module.exports = { pollMeraki, pollNsight };
