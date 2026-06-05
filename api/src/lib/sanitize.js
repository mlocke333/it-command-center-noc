// Server-side redaction — mirror of the frontend's src/lib/sanitize.js.
// Run every tenant record through this before it leaves the API.

const SECRET_FIELDS = ["clientSecret", "accessToken", "refreshToken", "apiKey", "secretName"];

function sanitizeTenant(tenant) {
  if (!tenant || typeof tenant !== "object") return tenant;
  const clean = { ...tenant };
  let hadSecret = false;
  for (const f of SECRET_FIELDS) {
    if (f in clean) {
      delete clean[f];
      hadSecret = true;
    }
  }
  clean.hasCredential = hadSecret || Boolean(tenant.hasCredential);
  return clean;
}

const sanitizeTenants = (list = []) => list.map(sanitizeTenant);

module.exports = { sanitizeTenant, sanitizeTenants };
