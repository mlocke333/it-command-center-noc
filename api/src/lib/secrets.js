// ─────────────────────────────────────────────────────────────────────────
//  secrets.js — resolve secrets without ever putting them in source.
//
//  Two modes, picked automatically:
//   • If KEY_VAULT_URI is set → fetch from Azure Key Vault using
//     DefaultAzureCredential (the Function App's managed identity in Azure,
//     or your az-login / VS Code identity locally). This is the preferred
//     path: secrets live in the vault, the app holds only a reference.
//   • Otherwise → read from environment / app settings (works with Static
//     Web Apps managed functions, where you can use Key Vault references in
//     application settings).
//
//  Either way, secret VALUES never live in this repo.
// ─────────────────────────────────────────────────────────────────────────

const KEY_VAULT_URI = process.env.KEY_VAULT_URI;

let _vaultClient = null;
const _cache = new Map();

function vaultClient() {
  if (_vaultClient) return _vaultClient;
  // Lazy-require so the app still runs in env-only mode without the packages loaded.
  const { SecretClient } = require("@azure/keyvault-secrets");
  const { DefaultAzureCredential } = require("@azure/identity");
  _vaultClient = new SecretClient(KEY_VAULT_URI, new DefaultAzureCredential());
  return _vaultClient;
}

/**
 * Resolve a secret by its logical name.
 * @param {string} name  Key Vault secret name OR env var name.
 * @returns {Promise<string|undefined>}
 */
async function getSecret(name) {
  if (_cache.has(name)) return _cache.get(name);

  let value;
  if (KEY_VAULT_URI) {
    try {
      const s = await vaultClient().getSecret(name);
      value = s.value;
    } catch (err) {
      // Fall through to env so a missing vault entry doesn't hard-crash the poll.
      value = process.env[name];
    }
  } else {
    value = process.env[name];
  }

  // Short-lived cache to avoid hammering the vault on every poll.
  _cache.set(name, value);
  setTimeout(() => _cache.delete(name), 5 * 60 * 1000).unref?.();
  return value;
}

module.exports = { getSecret, KEY_VAULT_MODE: Boolean(KEY_VAULT_URI) };
