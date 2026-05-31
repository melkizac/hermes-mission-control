# Integration guide — wiring to a real Hermes install

The UI never touches Hermes directly. It talks to one interface:
`src/services/hermesClient.ts`. There are two ways to make it real.

## Step 0 — confirm the gateway API surface (do this first)

The whole design hinges on one question: **does the Hermes gateway expose an
HTTP/WebSocket API, or is it CLI/TUI-only?**

- If **HTTP/WS**: `listAgents()` and `sendMessage()` call it directly and stream.
- If **CLI-only**: the backend shells out (`hermes -p <id> chat -q "…"`) and the
  UI polls or subscribes to a tailed log / sessions store for status.

Everything else (config files, skills, profile lifecycle) is filesystem + CLI
regardless, so it's unaffected by this answer.

## Option A — backend bridge (recommended)

1. `cd server && npm install && npm run dev` (starts on :8787).
2. Fill in the TODOs in `server/src/hermesAdapter.js`:
   - **Filesystem**: `readProfileFiles` / `writeProfileFile` already point at
     `~/.hermes/<profile>/`. Add a git commit on write for versioning/rollback.
   - **Gateway**: `gatewayStatus` (per-profile live status) and `gatewaySend`
     (open/continue a session; relay the stream via SSE).
   - **CLI**: `cliCreateProfile` (`hermes profile create --clone`),
     `cliDeleteProfile` (archive the dir — never hard-delete), `cliInstallSkill`
     (`hermes skills install`).
3. Add the remaining routes (`/api/agents`, `/api/approvals`, skills) following
   the two examples already in `server/src/index.js`.
4. In the frontend, create an `HttpHermesClient implements HermesClient` that
   `fetch`es those routes, and swap the one line in `src/services/store.tsx`:

   ```ts
   // const client: HermesClient = new MockHermesClient();
   const client: HermesClient = new HttpHermesClient("http://localhost:8787");
   ```

## Option B — Tauri / Electron (local desktop, no server)

If this ships as a desktop app, skip HTTP: implement `HermesClient` directly
over Node `fs` (config files), `child_process` (the `hermes` CLI), and a gateway
client. Same interface, no network hop.

## Live status

Status dots should update in real time. Cleanest path: an SSE/WebSocket channel
from the bridge that pushes gateway state changes; the store subscribes and
calls its existing `refresh()`. Polling `gatewayStatus()` every few seconds is a
fine v1.

## Output canvas

The Output tab and the inline artifact cards read from each agent's workspace
(convention: `<HERMES_HOME>/workspace/`). Decide how many file types render
natively (xlsx, md, code, pdf, web preview) — that scopes the canvas renderer.

## Safety notes baked into the UI

- Config writes are reversible by design — add git-backed history in the adapter.
- Deletes are **soft** (archive the profile dir); the UI already labels it so.
- `config.yaml`/secrets: surface *which* secrets exist, never render values.
- The Approvals queue is the gate for any external/destructive action.
