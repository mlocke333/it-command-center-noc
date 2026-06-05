// ─────────────────────────────────────────────────────────────────────────
//  tenants.js — which tenants to poll.
//
//  IMPORTANT: this file holds IDs and a *reference* to where each tenant's
//  client secret lives (its Key Vault secret name) — never the secret itself.
//  secrets.js resolves `secretName` at runtime from Key Vault or app settings.
//
//  Replace these fictional entries with your real tenants. For a large fleet,
//  load this from a database or a JSON app setting instead of hard-coding.
// ─────────────────────────────────────────────────────────────────────────

module.exports = [
  {
    id: "t-northwind",
    name: "Northwind Veterinary",
    domain: "northwindvet.com",
    tenantId: "00000000-0000-0000-0000-000000000001",
    clientId: "10000000-0000-0000-0000-000000000001",
    secretName: "northwind-client-secret",
  },
  {
    id: "t-brightpath",
    name: "Brightpath Hospice",
    domain: "brightpathhospice.com",
    tenantId: "00000000-0000-0000-0000-000000000002",
    clientId: "10000000-0000-0000-0000-000000000002",
    secretName: "brightpath-client-secret",
  },
  // … add the rest of your tenants here …
];
