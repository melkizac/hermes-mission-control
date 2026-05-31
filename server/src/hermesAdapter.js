// hermesAdapter.js
//
// This is where the UI meets a REAL Hermes install. Each function below maps
// to one of three surfaces. Right now they return mock-ish data / no-ops;
// replace the TODO bodies with real calls.
//
//   1) FILESYSTEM  — <HERMES_HOME>/SOUL.md, MEMORY.md, AGENTS.md, config.yaml, skills/
//   2) GATEWAY     — chat sessions, live status, cron/jobs, swarm/Kanban
//   3) CLI         — `hermes profile ...`, `hermes skills ...`
//
// NOTE: confirm the gateway's API surface first (HTTP/WebSocket vs CLI-only).
// That single answer decides how listAgents()/sendMessage() are implemented.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
// import { spawn } from "node:child_process"; // for the CLI wrapper

const HERMES_ROOT = process.env.HERMES_ROOT || join(homedir(), ".hermes");

// ---- 1) FILESYSTEM -------------------------------------------------------

export async function readProfileFiles(profileId) {
  const dir = join(HERMES_ROOT, profileId);
  const names = ["SOUL.md", "MEMORY.md", "AGENTS.md", "config.yaml"];
  const files = [];
  for (const name of names) {
    try {
      const content = await readFile(join(dir, name), "utf8");
      files.push({ name, content, sizeBytes: Buffer.byteLength(content) });
    } catch {
      /* file may not exist yet */
    }
  }
  return files;
}

export async function writeProfileFile(profileId, name, content) {
  // TODO: add git commit here for versioning/rollback.
  await writeFile(join(HERMES_ROOT, profileId, name), content, "utf8");
}

export async function listProfileSkills(profileId) {
  const dir = join(HERMES_ROOT, profileId, "skills");
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

// ---- 2) GATEWAY ----------------------------------------------------------

export async function gatewayStatus() {
  // TODO: GET {GATEWAY_URL}/status  (or read gateway PID / sessions store).
  // Should return per-profile live status: working | waiting | idle | error.
  return { online: true, profiles: [] };
}

export async function gatewaySend(profileId, text) {
  // TODO: open/continue a gateway session for this profile and stream the reply.
  // If the gateway is HTTP/WS, POST a message and relay the stream to the client
  // (e.g. via Server-Sent Events). If CLI-only, spawn `hermes -p <id> chat -q ...`.
  return { ok: true, profileId, echoed: text };
}

// ---- 3) CLI WRAPPER ------------------------------------------------------

export async function cliCreateProfile() {
  // TODO: run(`hermes profile create <id> --clone <template>`)
  return { ok: true };
}

export async function cliDeleteProfile() {
  // TODO: soft-delete — archive the HERMES_HOME dir; never hard-delete config.
  return { ok: true };
}

export async function cliInstallSkill() {
  // TODO: run(`hermes skills install <ownerOrHub>/<skill>`)
  return { ok: true };
}

// Helper for the CLI calls above:
// function run(cmd, args) {
//   return new Promise((resolve, reject) => {
//     const p = spawn(cmd, args);
//     let out = ""; p.stdout.on("data", (d) => (out += d));
//     p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(out))));
//   });
// }
