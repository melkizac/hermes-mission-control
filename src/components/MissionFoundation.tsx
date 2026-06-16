import type { EvidenceRecord, MissionArtifact, MissionResult, PhaseCheckpoint, RiskLevel } from "../types";

const riskLabels: Record<string, string> = {
  safe: "Safe",
  "approval-required": "Approval required",
  "external-facing": "External facing",
  destructive: "Destructive",
  "account-sensitive": "Account sensitive",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  passed: "Passed",
  blocked: "Blocked",
  failed: "Failed",
};

function compactDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-SG", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Singapore",
  });
}

export function ProvenanceChips({ evidence }: { evidence: EvidenceRecord[] }) {
  if (!evidence.length) return <span className="tag muted">No evidence yet</span>;
  return (
    <div className="mc-foundation-chips" aria-label="Evidence provenance">
      {evidence.slice(0, 5).map((item) => (
        <span key={item.id} className="tag muted" title={item.summary || item.title}>
          {item.kind} · {item.source}
        </span>
      ))}
      {evidence.length > 5 && <span className="tag muted">+{evidence.length - 5} more</span>}
    </div>
  );
}

export function RiskBadges({ risks }: { risks: RiskLevel[] }) {
  if (!risks.length) return <span className="mc-risk-badge safe">Safe</span>;
  return (
    <div className="mc-risk-badges" aria-label="Risk and approval metadata">
      {risks.map((risk) => (
        <span key={risk} className={`mc-risk-badge ${risk.replace(/[^a-z0-9]/gi, "-")}`}>
          {riskLabels[risk] || risk}
        </span>
      ))}
    </div>
  );
}

function artifactFormatLabel(artifact: MissionArtifact) {
  return (artifact.format || artifact.mime || artifact.kind || "artifact").toString().replace(/[-_]/g, " ").toUpperCase();
}

function artifactQaClass(status?: string) {
  const value = (status || "not-run").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `qa-${value || "not-run"}`;
}

function safeArtifactHref(value?: string | null) {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function ArtifactCard({ artifact }: { artifact: MissionArtifact }) {
  const previewHref = safeArtifactHref(artifact.previewUrl || artifact.url);
  const downloadHref = safeArtifactHref(artifact.downloadUrl || artifact.download_url || artifact.url);
  const driveHref = safeArtifactHref(artifact.driveUrl || (artifact.url?.includes("drive.google.com") ? artifact.url : undefined));
  const qaStatus = artifact.qaStatus || artifact.redactionStatus || artifact.redaction_status || "not-run";
  const sizeLabel = artifact.sizeBytes ? `${Math.max(1, Math.round(artifact.sizeBytes / 1024))} KB` : "size unknown";
  const locatorKind = artifact.locatorKind || artifact.kind;
  const owner = artifact.runtimeId || artifact.runtime_id || artifact.profileId || artifact.profile_id;

  return (
    <article className={`mc-artifact-card ${artifact.format || artifact.kind}`} aria-label={`Artifact ${artifact.title}`}>
      <div className="mc-artifact-icon">{artifactFormatLabel(artifact).slice(0, 1)}</div>
      <div className="mc-artifact-main">
        <div className="mc-artifact-title-row">
          <b>{artifact.title}</b>
          <span className={`mc-artifact-qa ${artifactQaClass(qaStatus)}`}>{qaStatus}</span>
        </div>
        {artifact.summary && <p>{artifact.summary}</p>}
        {artifact.preview && <pre className="mc-artifact-preview">{artifact.preview}</pre>}
        <div className="mc-artifact-meta">
          <span>{artifactFormatLabel(artifact)}</span>
          <span>{String(locatorKind).replace(/[_-]/g, " ")}</span>
          {owner && <span>{owner}</span>}
          {artifact.evidenceHash || artifact.evidence_hash ? <span>hash verified</span> : <span>{artifact.version || "v1"}</span>}
          <span>{sizeLabel}</span>
          <span>{compactDate(artifact.createdAt)}</span>
        </div>
        <div className="mc-artifact-actions" aria-label="Artifact actions">
          {previewHref ? <a href={previewHref} target="_blank" rel="noreferrer">Preview</a> : <button type="button" disabled>Preview</button>}
          {downloadHref ? <a href={downloadHref} target="_blank" rel="noreferrer" download>Download</a> : <button type="button" disabled>Download</button>}
          {driveHref && <a href={driveHref} target="_blank" rel="noreferrer">Drive</a>}
          <button type="button" disabled title="Regenerate is queued through the task workflow">Regenerate</button>
          <button type="button" disabled title="Revision requests are captured as task comments">Revise</button>
        </div>
      </div>
    </article>
  );
}

export function EvidenceTimeline({ evidence }: { evidence: EvidenceRecord[] }) {
  const counts = evidence.reduce((acc, item) => {
    const key = item.type || item.kind || "evidence";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return (
    <div className="mc-evidence-wrap">
      {evidence.length > 0 && (
        <div className="mc-evidence-summary" aria-label="Evidence summary by type">
          {Object.entries(counts).slice(0, 6).map(([key, value]) => <span key={key}>{key.replace(/[_-]/g, " ")} · {value}</span>)}
        </div>
      )}
      <ol className="mc-evidence-timeline" aria-label="Evidence timeline">
        {evidence.length === 0 && <li className="empty">No evidence has been attached yet.</li>}
        {evidence.map((item) => {
          const timestamp = item.createdAt || item.created_at;
          const reference = item.reference || item.runId || item.taskId || item.artifactId || item.sourceId;
          return (
            <li key={item.id}>
              <span className="mc-evidence-dot" />
              <div>
                <div className="mc-evidence-title-row">
                  <b>{item.title}</b>
                  <span>{item.type || item.kind}</span>
                </div>
                {item.summary && <p>{item.summary}</p>}
                <small>{item.kind} · {item.source} · {compactDate(timestamp)}{reference ? ` · ref: ${reference}` : ""}{item.verificationStatus ? ` · ${item.verificationStatus}` : ""}{item.redacted ? " · redacted" : ""}</small>
                {item.checks && item.checks.length > 0 && <div className="mc-evidence-checks">{item.checks.map((check) => <em key={check}>{check}</em>)}</div>}
                {item.url && <a className="mc-evidence-link" href={item.url} target="_blank" rel="noreferrer">Open reference</a>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ResultSummaryPanel({ result }: { result: MissionResult }) {
  const risks = result.approvalGates.map((gate) => gate.risk);
  return (
    <section className="mc-result-summary" aria-label="Result summary">
      <div className="mc-result-head">
        <span className="tag muted">{result.workItem.kind}</span>
        <h3>{result.workItem.title}</h3>
        <RiskBadges risks={risks} />
      </div>
      <p>{result.summary}</p>
      <ProvenanceChips evidence={result.evidence} />
      {result.artifacts.length > 0 && (
        <div className="mc-artifact-grid">
          {result.artifacts.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} />)}
        </div>
      )}
      {result.nextActions.length > 0 && (
        <ul className="mc-next-actions">
          {result.nextActions.map((action) => <li key={action}>{action}</li>)}
        </ul>
      )}
    </section>
  );
}

export function PhaseCheckpointCard({ checkpoint }: { checkpoint: PhaseCheckpoint }) {
  return (
    <section className={`mc-phase-checkpoint ${checkpoint.status}`} aria-label="Phase checkpoint">
      <div className="mc-phase-checkpoint-head">
        <span className="tag muted">{checkpoint.phase}</span>
        <h3>{checkpoint.title}</h3>
        <b>{statusLabels[checkpoint.status] || checkpoint.status}</b>
      </div>
      <div className="mc-phase-checkpoint-grid">
        <div>
          <h4>Dependencies</h4>
          <ul>
            {checkpoint.dependencies.map((dep) => <li key={dep.id}>{dep.label} — {statusLabels[dep.status] || dep.status}</li>)}
          </ul>
        </div>
        <div>
          <h4>Tests</h4>
          <ul>
            {checkpoint.tests.map((test) => <li key={test.command}><code>{test.command}</code> — {statusLabels[test.status] || test.status}</li>)}
          </ul>
        </div>
      </div>
      <EvidenceTimeline evidence={checkpoint.evidence} />
    </section>
  );
}
