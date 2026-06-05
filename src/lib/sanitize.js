// ─────────────────────────────────────────────────────────────────────────
//  sanitize.js — strip secrets before tenant data leaves the backend.
//  Run every tenant-returning endpoint through this. Internal sync code reads
//  secrets straight from the vault, never from a sanitized object.
// ─────────────────────────────────────────────────────────────────────────

const SECRET_FIELDS = ["clientSecret", "accessToken", "refreshToken", "apiKey"];

export function sanitizeTenant(tenant) {
  if (!tenant || typeof tenant !== "object") return tenant;
  const clean = { ...tenant };
  let hadSecret = false;
  for (const field of SECRET_FIELDS) {
    if (field in clean) {
      delete clean[field];
      hadSecret = true;
    }
  }
  clean.hasCredential = hadSecret || Boolean(tenant.hasCredential);
  return clean;
}

export function sanitizeTenants(list = []) {
  return list.map(sanitizeTenant);
}
