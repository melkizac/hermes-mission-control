// Minimal Express server exposing the HermesClient surface as REST.
// Currently returns stub data; fill in hermesAdapter.js to go live.
import express from "express";
import cors from "cors";
import {
  readProfileFiles,
  writeProfileFile,
  gatewayStatus,
  gatewaySend,
} from "./hermesAdapter.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/gateway", async (_req, res) => res.json(await gatewayStatus()));

app.get("/api/agents/:id/files", async (req, res) =>
  res.json(await readProfileFiles(req.params.id)),
);

app.put("/api/agents/:id/files/:name", async (req, res) => {
  await writeProfileFile(req.params.id, req.params.name, req.body.content ?? "");
  res.json({ ok: true });
});

app.post("/api/agents/:id/messages", async (req, res) =>
  res.json(await gatewaySend(req.params.id, req.body.text ?? "")),
);

// TODO: /api/agents (list), /api/approvals, /api/agents/:id/skills, etc.

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`Hermes bridge on http://localhost:${PORT}`));
