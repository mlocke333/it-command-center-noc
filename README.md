# NOC · Command Center

A dense **network-operations-center wall display** for MSP operations — built to
live on a monitor in the ops room and be read across the room. Status-lit KPIs,
a tenant health matrix with pulsing LEDs, a connector up/down strip, and a
**live alert feed** that streams new events with auto-refresh.

Runs on **sample data** out of the box, with auto-refresh and a simulated event
stream so the wall actually moves — then wire in live connectors when ready.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default http://localhost:5173). No credentials needed.
Throw it on a spare monitor in fullscreen for the full effect.

## What's on the wall

- **Operational Metrics** — eight status-lit KPI tiles (tenants online, SIEM
  active, device compliance, MDR incidents, network/RMM online, security events,
  failed migrations). Glow color tracks health.
- **Tenant Health Matrix** — one cell per tenant, color-coded by status with a
  pulsing LED; errored tenants pulse red and float to the top.
- **Connector Status** — Graph / Intune / Defender / Sentinel / Meraki /
  N-sight / Exchange / SharePoint up · degraded · down.
- **Live Alert Feed** — newest first, severity-colored, new events flash in.

The top bar carries a global health indicator, a live clock, and a refresh ring
counting down to the next poll, with a blinking **LIVE** light.

## Live behavior

- Snapshots poll every `VITE_REFRESH_SECONDS` (default 10s). In mock mode the
  numbers jitter slightly each poll so tiles breathe.
- The alert feed pushes a new synthesized event every few seconds.

Tune the cadence in `.env` (`VITE_REFRESH_SECONDS`).

## Deploy to GitHub Pages

1. Push to GitHub on branch `main`.
2. **Settings → Pages → Source: GitHub Actions**.
3. The included workflow builds and publishes. It sets
   `BASE_PATH=/it-command-center-noc/` — change it if you rename the repo.

> Pages serves static files only. The mock wall runs there fine; live data needs
> a backend you host elsewhere (Pages can't hold secrets).

## Going live on Azure Static Web Apps (included backend)

This repo ships with a working backend in **`api/`** — Azure Functions (v4)
that fan out to Graph / Intune / Defender / Meraki / N-sight, hold secrets
server-side, and return the exact shape the wall consumes at `GET /api/snapshot`.
The frontend's `snapshotLive()` already calls it.

### 1. Create the Static Web App
- In the Azure portal, create a **Static Web App**, linked to this GitHub repo.
- Build settings: **app location** `/`, **api location** `api`, **output
  location** `dist`. The included `.github/workflows/azure-swa.yml` handles CI/CD
  (it needs the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret, added automatically
  when you link the repo). Use **either** this workflow or the Pages one — not both.

### 2. Put secrets in Key Vault (recommended)
- Create a Key Vault and add one secret per tenant client secret, named to match
  `secretName` in `api/src/config/tenants.js` (e.g. `northwind-client-secret`),
  plus `MERAKI_API_KEY` and `NSIGHT_API_KEY`.
- Give the Static Web App's **managed identity** the *Key Vault Secrets User*
  role on the vault.
- Set the app setting `KEY_VAULT_URI` to your vault URI. `api/src/lib/secrets.js`
  then pulls secrets via `DefaultAzureCredential` at runtime.

> No vault? Leave `KEY_VAULT_URI` unset and put the same names as **application
> settings** instead (optionally as Key Vault references). The code falls back to
> them automatically. Either way, **secret values never live in this repo.**

### 3. Configure tenants
Edit `api/src/config/tenants.js` with your real `tenantId` / `clientId` and the
Key Vault `secretName` for each tenant — **IDs only, never the secret value.**
Each app registration needs admin consent for `DeviceManagementManagedDevices.Read.All`,
`SecurityAlert.Read.All`, and `Organization.Read.All`. Prefer certificate or
federated credentials over client secrets where you can.

### 4. Flip the frontend to live
Set `VITE_DATA_SOURCE=live` (build-time env / app setting). The wall now polls
`/api/snapshot` on the same origin — no CORS, no base URL.

### 5. (Optional) Lock it to your tenant
`staticwebapp.config.json` includes an Entra ID auth block and route protection.
Replace `<YOUR_TENANT_ID>`, add `AAD_CLIENT_ID` / `AAD_CLIENT_SECRET` app
settings from an app registration, and only signed-in users in your tenant can
load the wall. Remove the `auth`/`routes` blocks to make it public.

### About the live feed
Both `getSnapshot()` and the alert feed are live. The feed uses one
transport-agnostic `subscribeEvents()` call:

- `VITE_EVENT_TRANSPORT=poll` (default) — polls `/api/events`, SWA-friendly.
- `VITE_EVENT_TRANSPORT=sse` — opens an EventSource to the push service below
  for true, instant streaming.

Mock mode synthesizes a trickle through the same path.

## True push streaming (Azure Container Apps)

Static Web Apps managed Functions are HTTP-only, so for *instant* alert push
this repo includes **`server/`** — a tiny Express service that holds SSE
connections open and broadcasts new alerts as a server-side loop finds them. It
reuses the exact same `api/src/lib` aggregation/Graph/secrets code, so there's
one source of truth.

It serves `GET /api/snapshot`, `GET /api/events/stream` (SSE), and `GET /healthz`,
and can optionally serve the built frontend from the same container.

### Deploy

```bash
# 1. Build the image (context = repo root)
docker build -f server/Dockerfile -t command-center-push .

# 2. Push to Azure Container Registry
az acr login --name <yourRegistry>
docker tag command-center-push <yourRegistry>.azurecr.io/command-center-push:latest
docker push <yourRegistry>.azurecr.io/command-center-push:latest

# 3. Deploy to Container Apps
az containerapp create \
  --name command-center-push \
  --resource-group <rg> \
  --environment <containerapps-env> \
  --image <yourRegistry>.azurecr.io/command-center-push:latest \
  --target-port 3000 --ingress external \
  --min-replicas 1 \
  --system-assigned                      # managed identity for Key Vault
```

Then:
- Grant the Container App's managed identity the **Key Vault Secrets User** role,
  and set `KEY_VAULT_URI` (plus `ALLOWED_ORIGIN` = your wall's origin) as
  environment variables. Same secret names as the Functions path.
- Keep **min replicas at 1** — SSE needs a warm instance; scale-to-zero would
  drop streams.
- Point the wall at it: set `VITE_API_BASE=https://<your-container-app-url>` and
  `VITE_EVENT_TRANSPORT=sse`, rebuild the frontend, redeploy.

Run it locally:
```bash
cd server && npm install && KEY_VAULT_URI=... npm start    # :3000
# then, from repo root, against it:
VITE_DATA_SOURCE=live VITE_API_BASE=http://localhost:3000 VITE_EVENT_TRANSPORT=sse npm run dev
```

> Want one box instead of two? Run `npm run build` at the repo root, uncomment
> the `COPY dist ./dist` line in `server/Dockerfile`, and the container serves
> the wall and the API together — no separate frontend host needed.

### Run the backend locally
```bash
cd api
npm install
func start            # requires Azure Functions Core Tools
# in another shell, from the repo root:
VITE_DATA_SOURCE=live npm run dev
```

## Security (before going live)

- **No secrets in the client.** Anything `VITE_`-prefixed ships to the browser.
  Keys and client secrets live only on the backend, in a secret store.
- **Redact at the boundary.** `sanitizeTenant()` strips secret fields from
  tenant records and exposes only a `hasCredential` flag. Route every
  tenant-returning endpoint through it.
- **Prefer certificate / federated credentials** over long-lived client
  secrets; store the secret *value* (not the Secret ID); rotate on a schedule
  and immediately on exposure.
- **Least privilege** per app registration, with admin consent per tenant.

## License

Use it, fork it, make it yours.
