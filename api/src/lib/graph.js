// ─────────────────────────────────────────────────────────────────────────
//  graph.js — per-tenant Microsoft Graph access (app-only / client creds).
//
//  Pulls just what the wall needs: device compliance (Intune) and security
//  alerts (Defender/Sentinel). Every call is wrapped so a single tenant's
//  failure surfaces as that tenant's error rather than taking down the poll.
//
//  Required application permissions (admin-consented per tenant):
//    • DeviceManagementManagedDevices.Read.All   (managed devices)
//    • SecurityAlert.Read.All                     (security/alerts_v2)
//    • Organization.Read.All                      (org display name)
//  Prefer certificate or federated credentials over client secrets in prod.
// ─────────────────────────────────────────────────────────────────────────

const { getSecret } = require("./secrets");

const LOGIN = "https://login.microsoftonline.com";
const GRAPH = "https://graph.microsoft.com/v1.0";

async function getToken(tenant) {
  const secret = await getSecret(tenant.secretName);
  if (!secret) throw new Error(`no secret resolved for ${tenant.secretName}`);

  const body = new URLSearchParams({
    client_id: tenant.clientId,
    scope: "https://graph.microsoft.com/.default",
    client_secret: secret,
    grant_type: "client_credentials",
  });

  const res = await fetch(`${LOGIN}/${tenant.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    // Surface the AADSTS code so the wall shows a meaningful tenant error.
    const code = json.error_description?.match(/AADSTS\d+/)?.[0] || json.error || res.status;
    throw new Error(`token failed: ${code}`);
  }
  return json.access_token;
}

async function graphGet(token, path) {
  const res = await fetch(`${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    const msg = txt.includes("not provisioned")
      ? "Graph 403 — Account is not provisioned"
      : `Graph ${res.status} on ${path.split("?")[0]}`;
    throw new Error(msg);
  }
  return res.json();
}

/** Returns { status, devices, compliant, endpoints, alerts, errorMessage }. */
async function pollTenant(tenant) {
  const base = {
    id: tenant.id,
    name: tenant.name,
    domain: tenant.domain,
    hasCredential: true,
    lastSyncAt: Date.now(),
  };

  let token;
  try {
    token = await getToken(tenant);
  } catch (err) {
    return { ...base, status: "error", devices: 0, compliant: 0, endpoints: 0, alerts: 0, errorMessage: err.message };
  }

  // Devices (Intune). $select keeps the payload small; $top caps it.
  let devices = 0, compliant = 0, deviceErr = null;
  try {
    const data = await graphGet(token, "/deviceManagement/managedDevices?$select=complianceState&$top=999");
    const items = data.value || [];
    devices = items.length;
    compliant = items.filter((d) => d.complianceState === "compliant").length;
  } catch (err) {
    deviceErr = err.message;
  }

  // Security alerts (Defender / Sentinel) — count active.
  let alerts = 0;
  try {
    const data = await graphGet(token, "/security/alerts_v2?$filter=status eq 'new'&$top=999&$count=true");
    alerts = (data.value || []).length;
  } catch {
    // Non-fatal; leave alerts at 0 if the scope isn't consented.
  }

  return {
    ...base,
    status: deviceErr ? "warn" : "active",
    devices,
    compliant,
    endpoints: devices,
    alerts,
    errorMessage: deviceErr,
  };
}

module.exports = { pollTenant, getToken, graphGet };
