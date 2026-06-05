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

export function ArtifactCard({ artifact }: { artifact: MissionArtifact }) {
  const href = artifact.url || artifact.path || undefined;
  const body = (
    <>
      <div className="mc-artifact-icon">{artifact.kind.slice(0, 1).toUpperCase()}</div>
      <div className="mc-artifact-main">
        <b>{artifact.title}</b>
        {artifact.summary && <p>{artifact.summary}</p>}
        <span>{artifact.kind} · {compactDate(artifact.createdAt)}</span>
      </div>
    </>
  );

  if (href) {
    return (
      <a className="mc-artifact-card" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" aria-label="Open artifact">
        {body}
      </a>
    );
  }
  return <div className="mc-artifact-card" aria-label="Open artifact">{body}</div>;
}

export function EvidenceTimeline({ evidence }: { evidence: EvidenceRecord[] }) {
  return (
    <ol className="mc-evidence-timeline" aria-label="Evidence timeline">
      {evidence.length === 0 && <li className="empty">No evidence has been attached yet.</li>}
      {evidence.map((item) => (
        <li key={item.id}>
          <span className="mc-evidence-dot" />
          <div>
            <b>{item.title}</b>
            {item.summary && <p>{item.summary}</p>}
            <small>{item.kind} · {item.source} · {compactDate(item.createdAt)}{item.redacted ? " · redacted" : ""}</small>
          </div>
        </li>
      ))}
    </ol>
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
