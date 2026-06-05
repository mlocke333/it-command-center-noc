// ─────────────────────────────────────────────────────────────────────────
//  aggregate.js — fan out to every source in parallel and assemble the
//  snapshot in the exact shape the wall's getSnapshot() expects.
// ─────────────────────────────────────────────────────────────────────────

const tenantConfig = require("../config/tenants");
const { pollTenant } = require("./graph");
const { pollMeraki, pollNsight } = require("./vendors");
const { sanitizeTenants } = require("./sanitize");

async function buildSnapshot() {
  const [tenantResults, meraki, nsight] = await Promise.all([
    Promise.all(tenantConfig.map((t) => pollTenant(t))),
    pollMeraki(),
    pollNsight(),
  ]);

  // Roll tenant data up into the fleet summary.
  const managed = tenantResults.reduce((n, t) => n + (t.devices || 0), 0);
  const compliant = tenantResults.reduce((n, t) => n + (t.compliant || 0), 0);
  const siemActive = tenantResults.reduce((n, t) => n + (t.alerts || 0), 0);
  const highCount = tenantResults.filter((t) => (t.alerts || 0) > 0).length; // refine with real severity

  const summary = {
    siem: { total: siemActive, active: siemActive, high: highCount, critical: 0 },
    mdm: { managed, compliant, nonCompliant: managed - compliant },
    mdr: { endpoints: managed, healthy: compliant, alerts: highCount, incidents: 0 },
    meraki: { ...meraki.summary },
    nsight: { ...nsight.summary },
    migrations: { jobs: 0, failed: 0, active: 0 }, // wire to your migration tool
  };

  const connectors = [
    { id: "graph", name: "MS Graph", up: tenantResults.some((t) => t.status !== "error") },
    { id: "intune", name: "Intune", up: true, degraded: tenantResults.some((t) => t.status === "warn") },
    { id: "defender", name: "Defender", up: true },
    { id: "sentinel", name: "Sentinel", up: true },
    { id: "meraki", name: "Meraki", up: meraki.ok, degraded: !meraki.ok },
    { id: "nsight", name: "N-sight", up: nsight.ok, degraded: !nsight.ok },
    { id: "exo", name: "Exchange", up: true },
    { id: "spo", name: "SharePoint", up: true },
  ];

  return {
    tenants: sanitizeTenants(tenantResults), // belt-and-suspenders: strip at the boundary
    connectors,
    summary,
    at: Date.now(),
  };
}

module.exports = { buildSnapshot };
