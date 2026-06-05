// ─────────────────────────────────────────────────────────────────────────
//  Sample data for the NOC wall. FICTIONAL tenants — no real IDs or secrets.
//  Includes a connector-status list, an event pool (for the live alert feed),
//  and small helpers that jitter the numbers on each refresh so the wall
//  visibly "breathes" without a live backend.
// ─────────────────────────────────────────────────────────────────────────

export const tenants = [
  { id: "t-northwind", name: "Northwind Veterinary", domain: "northwindvet.com", status: "active", devices: 31, compliant: 27, endpoints: 31, alerts: 0, lastSyncAt: Date.now() - 4 * 60 * 1000, errorMessage: null },
  { id: "t-brightpath", name: "Brightpath Hospice", domain: "brightpathhospice.com", status: "active", devices: 32, compliant: 30, endpoints: 32, alerts: 0, lastSyncAt: Date.now() - 2 * 60 * 1000, errorMessage: null },
  { id: "t-summit", name: "Summit Physical Therapy", domain: "summitpt.com", status: "error", devices: 0, compliant: 0, endpoints: 0, alerts: 0, lastSyncAt: Date.now() - 26 * 60 * 60 * 1000, errorMessage: "Graph 403 — Account is not provisioned" },
  { id: "t-cedar", name: "Cedar Ridge Dental", domain: "cedarridgedental.com", status: "warn", devices: 18, compliant: 11, endpoints: 18, alerts: 1, lastSyncAt: Date.now() - 9 * 60 * 1000, errorMessage: "Intune 401 — missing consent" },
  { id: "t-harbor", name: "Harbor Point Realty", domain: "harborpointrealty.com", status: "syncing", devices: 0, compliant: 0, endpoints: 0, alerts: 0, lastSyncAt: null, errorMessage: null },
  { id: "t-acme", name: "Acme Logistics", domain: "acmelogistics.com", status: "active", devices: 44, compliant: 41, endpoints: 44, alerts: 0, lastSyncAt: Date.now() - 6 * 60 * 1000, errorMessage: null },
  { id: "t-vista", name: "Vista Family Clinic", domain: "vistafamilyclinic.com", status: "active", devices: 22, compliant: 20, endpoints: 22, alerts: 0, lastSyncAt: Date.now() - 3 * 60 * 1000, errorMessage: null },
  { id: "t-ironwood", name: "Ironwood Capital", domain: "ironwoodcapital.com", status: "active", devices: 16, compliant: 16, endpoints: 16, alerts: 0, lastSyncAt: Date.now() - 5 * 60 * 1000, errorMessage: null },
];

export const connectors = [
  { id: "graph", name: "MS Graph", up: true },
  { id: "intune", name: "Intune", up: true, degraded: true },
  { id: "defender", name: "Defender", up: true },
  { id: "sentinel", name: "Sentinel", up: true },
  { id: "meraki", name: "Meraki", up: true },
  { id: "nsight", name: "N-sight", up: true, degraded: true },
  { id: "exo", name: "Exchange", up: true },
  { id: "spo", name: "SharePoint", up: true },
];

export const baseSummary = {
  siem: { total: 128, active: 31, high: 1, critical: 0 },
  mdm: { managed: 163, compliant: 132, nonCompliant: 31 },
  mdr: { endpoints: 163, healthy: 132, alerts: 1, incidents: 0 },
  meraki: { devices: 20, online: 18, clients: 302, securityEvents: 14 },
  nsight: { devices: 207, online: 122, alerts: 6 },
  migrations: { jobs: 8, failed: 5, active: 1 },
};

// Pool the live feed draws from. Each becomes a timestamped event on arrival.
export const eventPool = [
  { sev: "info", tenant: "Northwind Veterinary", text: "User released quarantined message" },
  { sev: "info", tenant: "Brightpath Hospice", text: "Device check-in — compliant" },
  { sev: "low", tenant: "Vista Family Clinic", text: "New sign-in from managed device" },
  { sev: "medium", tenant: "Cedar Ridge Dental", text: "Multiple failed sign-ins, then success" },
  { sev: "medium", tenant: "Acme Logistics", text: "Inbox forwarding rule created" },
  { sev: "high", tenant: "Cedar Ridge Dental", text: "Atypical travel sign-in detected" },
  { sev: "info", tenant: "Ironwood Capital", text: "Defender scan completed — clean" },
  { sev: "low", tenant: "Acme Logistics", text: "BitLocker key escrowed" },
  { sev: "medium", tenant: "Northwind Veterinary", text: "Impossible-travel flag raised" },
  { sev: "info", tenant: "Brightpath Hospice", text: "Patch ring deployment finished" },
  { sev: "low", tenant: "Vista Family Clinic", text: "MFA registered for new user" },
  { sev: "high", tenant: "Summit Physical Therapy", text: "Connector auth failing (403)" },
  { sev: "info", tenant: "Harbor Point Realty", text: "Initial tenant sync queued" },
  { sev: "medium", tenant: "Ironwood Capital", text: "Risky OAuth grant consented" },
];

// Seed events so the feed isn't empty on first paint.
export function seedEvents(n = 6) {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    const e = eventPool[Math.floor(Math.random() * eventPool.length)];
    return { ...e, id: `seed-${now}-${i}`, ts: now - i * 47_000 };
  });
}

export function nextEvent() {
  const e = eventPool[Math.floor(Math.random() * eventPool.length)];
  return { ...e, id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now() };
}

// Small bounded wobble so KPI tiles move between refreshes.
function jitter(n, spread, min = 0) {
  const delta = Math.round((Math.random() - 0.5) * 2 * spread);
  return Math.max(min, n + delta);
}

export function liveSummary() {
  const s = baseSummary;
  return {
    siem: { ...s.siem, active: jitter(s.siem.active, 3, 0) },
    mdm: s.mdm,
    mdr: s.mdr,
    meraki: { ...s.meraki, online: Math.min(s.meraki.devices, jitter(s.meraki.online, 2)), clients: jitter(s.meraki.clients, 14, 0) },
    nsight: { ...s.nsight, online: Math.min(s.nsight.devices, jitter(s.nsight.online, 6)) },
    migrations: s.migrations,
  };
}
