import { useEffect, useMemo, useState } from "react";
import type { CapabilityAssignmentRef, CapabilityIntakeRecord, CapabilityRegistryRecord, CapabilityRegistryTab, EvidenceRecord } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { SlideOverDrawer } from "../components/SlideOverDrawer";
import { Icon } from "../components/Icon";
import { InfoTooltip } from "../components/InfoTooltip";
import { buildMissionControlUrl } from "../services/deepLinks";

const client = new HttpHermesClient();

type ViewMode = "cards" | "list";

type RegistryTab = {
  id: CapabilityRegistryTab;
  label: string;
  hint: string;
};

const tabs: RegistryTab[] = [
  { id: "installed", label: "Installed", hint: "Enabled, installed, registered, or approved capabilities ready for operators." },
  { id: "available", label: "Available/Pilots", hint: "Draft, assessing, intake, and pilot-ready sources that are not yet broadly enabled." },
  { id: "intake", label: "Intake Queue", hint: "Requested capability sources waiting for assessment, sandboxing, or approval." },
  { id: "broken", label: "Broken/Needs Review", hint: "Broken, degraded, failing, stale, disabled, rejected, or approval-blocked sources." },
  { id: "assigned", label: "Assigned by Agent", hint: "Capability sources grouped by assigned agents, routines, and tasks." },
];

const installedStatuses = new Set(["approved", "registered", "installed", "enabled", "assigned"]);
const availableStatuses = new Set(["draft", "intake", "assessing", "needs-info"]);
const brokenStatuses = new Set(["awaiting-approval", "degraded", "broken", "disabled", "rejected"]);
const brokenHealth = new Set(["warning", "failing", "stale", "unknown"]);

function assignmentCount(record: CapabilityRegistryRecord) {
  const assignment = record.assignment ?? {};
  return (assignment.assignedAgents?.length ?? 0)
    + (assignment.assignedRoutines?.length ?? 0)
    + (assignment.assignedTasks?.length ?? 0)
    + (assignment.usageCount ?? 0);
}

function displayName(record: CapabilityRegistryRecord) {
  return record.displayName || record.name || record.id;
}

function titleCase(value?: string | null) {
  const raw = String(value || "unknown").replace(/[-_]/g, " ");
  return raw.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compact(value: number | undefined | null) {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value ?? 0);
}

function toneForStatus(status?: string, health?: string) {
  if (status === "enabled" || status === "installed" || status === "approved" || health === "passing") return "good";
  if (status === "broken" || status === "rejected" || health === "failing") return "bad";
  if (status === "awaiting-approval" || status === "degraded" || health === "warning" || health === "stale") return "warn";
  return "muted";
}

function isBroken(record: CapabilityRegistryRecord) {
  const approvalPending = record.governance?.approvalStatus === "pending" || record.policyEvidence?.approvalStatus === "pending";
  return brokenStatuses.has(record.status || "") || brokenHealth.has(record.health?.state || "") || approvalPending;
}

export function CapabilityRegistry() {
  const [records, setRecords] = useState<CapabilityRegistryRecord[]>([]);
  const [intake, setIntake] = useState<CapabilityIntakeRecord[]>([]);
  const [summary, setSummary] = useState({ total: 0, enabled: 0, assigned: 0, awaitingApproval: 0, degraded: 0, requiringSecrets: 0 });
  const [intakeSummary, setIntakeSummary] = useState({ total: 0, awaitingApproval: 0, requiringSecrets: 0 });
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<CapabilityRegistryTab>("installed");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [next, nextIntake] = await Promise.all([
        client.listCapabilities({ q, type, category, status }),
        client.listCapabilityIntake({ q, type, status }),
      ]);
      setRecords(next.capabilities ?? []);
      setSummary(next.summary ?? { total: 0, enabled: 0, assigned: 0, awaitingApproval: 0, degraded: 0, requiringSecrets: 0 });
      setIntake(nextIntake.intake ?? []);
      setIntakeSummary(nextIntake.summary ?? { total: 0, awaitingApproval: 0, requiringSecrets: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load capability registry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [q, type, category, status]);

  useEffect(() => {
    if (type && type !== "skill" && category) setCategory("");
  }, [type, category]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const types = useMemo(() => Array.from(new Set(records.map((item) => item.type).filter(Boolean))).sort(), [records]);
  const skillCategories = useMemo(
    () => Array.from(new Set(records.filter((item) => item.type === "skill").map((item) => item.category).filter(Boolean) as string[])).sort(),
    [records],
  );
  const statuses = useMemo(() => Array.from(new Set([...records.map((item) => item.status || "unknown"), ...intake.map((item) => item.status || "intake")])).sort(), [records, intake]);

  const tabRecords = useMemo(() => {
    if (tab === "installed") return records.filter((item) => installedStatuses.has(item.status || "") || item.enabled === true);
    if (tab === "available") return records.filter((item) => availableStatuses.has(item.status || "") && !isBroken(item));
    if (tab === "broken") return records.filter(isBroken);
    if (tab === "assigned") return records.filter((item) => assignmentCount(item) > 0);
    return records;
  }, [records, tab]);

  const selectedRecord = useMemo(() => records.find((item) => item.id === selected), [records, selected]);
  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[0];

  return (
    <div className="skills-page capability-registry-page skills-drawer-first scroll">
      <header className="skills-hero">
        <div>
          <span className="stub-tag">CAPABILITY REGISTRY</span>
          <div className="hero-title-with-help">
            <h1>Capability Registry</h1>
            <InfoTooltip label="About Capability Registry">
              Admin registry surface for governing, assigning, and auditing skills, tools, plugins, pilots, and intake requests across workspaces. User-mode Skills, Tools, and Plugins remain workspace resource views; Admin manages them here as capabilities.
            </InfoTooltip>
          </div>
        </div>
        <div className="task-hero-actions">
          <button className="task-icon-action dark" aria-label="Refresh capability registry" title="Refresh capability registry" onClick={() => void load()}>
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </header>

      <section className="skills-metrics capability-metrics">
        <Metric label="Registered" value={summary.total} sub="Visible capability records" />
        <Metric label="Enabled" value={summary.enabled} sub="Installed or active" tone="good" />
        <Metric label="Assigned" value={summary.assigned} sub="Agent, routine, or task usage" />
        <Metric label="Needs review" value={summary.awaitingApproval + summary.degraded + intakeSummary.total} sub="Approvals, degraded health, intake" tone={summary.awaitingApproval + summary.degraded + intakeSummary.total > 0 ? "bad" : undefined} />
      </section>

      <section className="capability-tabs" aria-label="Capability registry sections">
        {tabs.map((item) => (
          <button key={item.id} className={tab === item.id ? "on" : ""} onClick={() => setTab(item.id)}>
            <span>{item.label}</span>
            <small>{item.id === "intake" ? compact(intakeSummary.total) : compact(countForTab(item.id, records))}</small>
          </button>
        ))}
      </section>

      <section className="skills-filters capability-filters">
        <div className="filter-search-with-view">
          <label>
            <span>Search</span>
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="capability, source, description, agent…" />
          </label>
          <div className="view-switch filter-view-switch" aria-label="Capability registry view mode">
            <button className={viewMode === "cards" ? "on" : ""} onClick={() => setViewMode("cards")}>Cards</button>
            <button className={viewMode === "list" ? "on" : ""} onClick={() => setViewMode("list")}>List</button>
          </div>
        </div>
        <label>
          <span>Type</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">All types</option>
            {types.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
          </select>
        </label>
        <label>
          <span>Skill category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            disabled={Boolean(type && type !== "skill")}
            title={type && type !== "skill" ? "Categories apply to Skills only" : "Filter skill capabilities by category"}
          >
            <option value="">All skill categories</option>
            {skillCategories.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
          </select>
        </label>
        <InfoTooltip className="filter-help" label="About capability filters">
          {activeTab.hint} Type filters cover Skills, Tools, Plugins, and other capability classes; the Category filter is intentionally skill-only because Tools and Plugins do not use skill categories. Non-admin workspaces only see records allowed by the backend visibility boundary.
        </InfoTooltip>
      </section>

      {error && <div className="skills-error">{error}</div>}

      {tab === "intake" ? (
        <>
          <CapabilityIntakeWizard onChanged={() => void load()} />
          <IntakeQueue intake={intake} loading={loading} onChanged={() => void load()} />
        </>
      ) : tab === "assigned" ? (
        <AssignedByAgent records={tabRecords} loading={loading} onSelect={setSelected} />
      ) : viewMode === "cards" ? (
        <section className="skills-grid skills-grid-full capability-grid">
          <div className="skills-panel-head"><span>{activeTab.label} capability cards</span><small>{loading ? "Loading…" : `${tabRecords.length} shown`}</small></div>
          {tabRecords.map((record) => <CapabilityCard key={record.id} record={record} active={record.id === selectedRecord?.id} onSelect={() => setSelected(record.id)} />)}
          {!loading && tabRecords.length === 0 && <div className="empty big">No capability records matched this section.</div>}
        </section>
      ) : (
        <section className="ops-list capability-list-view">
          <div className="ops-list-head"><span>{activeTab.label} capability list</span><small>{loading ? "Loading…" : `${tabRecords.length} shown`}</small></div>
          {tabRecords.map((record) => <CapabilityListRow key={record.id} record={record} active={record.id === selectedRecord?.id} onSelect={() => setSelected(record.id)} />)}
          {!loading && tabRecords.length === 0 && <div className="empty big">No capability records matched this section.</div>}
        </section>
      )}

      {selectedRecord && <CapabilityDrawer record={selectedRecord} onClose={() => setSelected(null)} />}
    </div>
  );
}

function countForTab(tab: CapabilityRegistryTab, records: CapabilityRegistryRecord[]) {
  if (tab === "installed") return records.filter((item) => installedStatuses.has(item.status || "") || item.enabled === true).length;
  if (tab === "available") return records.filter((item) => availableStatuses.has(item.status || "") && !isBroken(item)).length;
  if (tab === "broken") return records.filter(isBroken).length;
  if (tab === "assigned") return records.filter((item) => assignmentCount(item) > 0).length;
  return records.length;
}

function Metric({ label, value, sub, tone }: { label: string; value: number | string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className={`skills-metric ${tone ?? ""}`}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  );
}

function StatusTag({ status, health }: { status?: string; health?: string }) {
  return <span className={`tag ${toneForStatus(status, health)}`}>{titleCase(status || health || "unknown")}</span>;
}

const approvedStatuses = new Set(["approved", "installed", "enabled", "registered"]);

type IntakeMode = "url" | "package" | "image";

function isApprovedIntake(item: CapabilityIntakeRecord) {
  return approvedStatuses.has(item.status || "");
}

function formatList(values?: Array<string | number | boolean> | null, fallback = "None recorded") {
  const clean = (values ?? []).map((value) => String(value)).filter(Boolean);
  return clean.length ? clean.join(", ") : fallback;
}

function formatUnknown(value: unknown, fallback = "None recorded") {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) return formatList(value as Array<string | number | boolean>, fallback);
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .slice(0, 5)
      .map(([key, v]) => `${titleCase(key)}: ${Array.isArray(v) ? v.join("/") : String(v)}`);
    return entries.length ? entries.join(" · ") : fallback;
  }
  return String(value);
}

function approvalSummary(item: CapabilityIntakeRecord) {
  const risks = item.riskLevels ?? [];
  if (isApprovedIntake(item)) return "Approval present — sandbox smoke tests and install registration can proceed.";
  if (risks.length) return `Approval required before install/run: ${risks.join(", ")}.`;
  return "Low-risk intake still needs operator approval before any install/run action.";
}

function DetailGrid({ item }: { item: CapabilityIntakeRecord }) {
  const install = item.installMethod ?? {};
  const rollback = item.rollbackNotes ?? {};
  const secrets = [...(item.requiredSecrets ?? []), ...(install.requiredSecrets ?? [])];
  const permissions = [...(item.permissions ?? []), ...(install.requiredPermissions ?? [])];
  return (
    <div className="capability-assessment-grid" aria-label="Assessment result details">
      <Mini label="Category" value={titleCase(item.category || item.sourceType)} />
      <Mini label="Source type" value={titleCase(item.sourceType)} />
      <Mini label="Install" value={titleCase(install.kind || "manual")} />
      <Mini label="License" value={`${item.license?.name || "unknown"}${item.license?.allowed === false ? " · review" : ""}`} />
      <Mini label="Maintenance" value={formatUnknown(item.maintenanceSignals)} />
      <Mini label="Risk flags" value={formatList(item.riskLevels, "read-only / low risk")} />
      <Mini label="Secrets" value={formatList(secrets)} />
      <Mini label="Permissions" value={formatList(permissions)} />
      <Mini label="Wrapper" value={titleCase(item.suggestedWrapperType || install.wrapperType || "skill")} />
      <Mini label="Smoke test" value={item.smokeTestCommand || formatUnknown(item.healthPlan?.smokeTestCommand, "Sandbox dry-run required")} />
      <Mini label="Rollback" value={formatUnknown(rollback)} />
      <Mini label="Approval" value={approvalSummary(item)} />
    </div>
  );
}

function CapabilityIntakeWizard({ onChanged }: { onChanged: () => void }) {
  const [mode, setMode] = useState<IntakeMode>("url");
  const [source, setSource] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageName, setImageName] = useState("");
  const [assessment, setAssessment] = useState<CapabilityIntakeRecord | null>(null);
  const [busy, setBusy] = useState<"assess" | "save" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const sourceType = mode === "package" ? "npm-package" : mode === "image" ? "internal-tool" : undefined;
  const sourceValue = mode === "image" ? (imageName ? `image:${imageName}` : source) : source;
  const canAssess = sourceValue.trim().length > 2;

  const assess = async () => {
    if (!canAssess) return;
    setBusy("assess");
    setLocalError(null);
    setMessage(null);
    try {
      const result = await client.assessCapabilitySource({
        source: sourceValue,
        sourceType,
        title: title || undefined,
        description: description || undefined,
        hints: { submittedAs: mode, imageName: imageName || undefined },
      });
      setAssessment({ ...(result.assessment ?? {}), title: title || result.assessment?.title || result.assessment?.displayName || sourceValue, description: description || result.assessment?.description });
      setMessage("Assessment ready. Review governance, smoke test, rollback, and approval requirements before submitting.");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Assessment failed");
    } finally {
      setBusy(null);
    }
  };

  const saveForApproval = async () => {
    const payload: Partial<CapabilityIntakeRecord> = assessment ?? { sourceType: sourceType || "github-project", sourceUri: sourceValue, title, description };
    setBusy("save");
    setLocalError(null);
    try {
      const result = await client.createCapabilityIntake({
        ...payload,
        title: title || payload.title || payload.displayName || sourceValue,
        description: description || payload.description,
        status: isApprovedIntake(payload as CapabilityIntakeRecord) ? payload.status : "awaiting-approval",
      });
      setAssessment(result.intake);
      setMessage(`Submitted ${result.intake?.id || "intake request"} for approval. Install/run controls remain locked until approval is recorded.`);
      onChanged();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Unable to submit intake request");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="capability-intake-wizard" aria-label="Capability intake wizard">
      <div className="capability-wizard-head">
        <div>
          <span className="stub-tag">OSS INTAKE WIZARD</span>
          <h2>Submit URL, package, or image source</h2>
          <p>Assess first, then save the request for approval. No install or run action is available until approval exists.</p>
        </div>
        <div className="capability-mode-switch" role="tablist" aria-label="Submission type">
          {(["url", "package", "image"] as IntakeMode[]).map((item) => (
            <button key={item} type="button" className={mode === item ? "on" : ""} onClick={() => setMode(item)}>{titleCase(item)}</button>
          ))}
        </div>
      </div>
      <div className="capability-wizard-form">
        <label>
          <span>{mode === "package" ? "Package name" : mode === "image" ? "Image or screenshot" : "Repository / source URL"}</span>
          {mode === "image" ? (
            <input type="file" accept="image/*" onChange={(event) => setImageName(event.target.files?.[0]?.name || "")} />
          ) : (
            <input value={source} onChange={(event) => setSource(event.target.value)} placeholder={mode === "package" ? "@modelcontextprotocol/server-filesystem" : "https://github.com/org/repo"} />
          )}
        </label>
        <label>
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Operator-facing capability name" />
        </label>
        <label className="capability-wizard-wide">
          <span>Description / notes</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this capability should do, expected wrapper, or review notes" />
        </label>
        <div className="capability-wizard-actions">
          <button type="button" className="task-icon-action dark" disabled={!canAssess || busy !== null} onClick={() => void assess()}>{busy === "assess" ? "Assessing…" : "Assess source"}</button>
          <button type="button" className="task-icon-action" disabled={(!assessment && !canAssess) || busy !== null} onClick={() => void saveForApproval()}>{busy === "save" ? "Submitting…" : "Submit for approval"}</button>
        </div>
      </div>
      {localError && <div className="skills-error install-status">{localError}</div>}
      {message && <div className="capability-approval-note">{message}</div>}
      {assessment && (
        <div className="capability-assessment-card">
          <div className="ops-row-top"><b>{assessment.title || assessment.displayName || assessment.sourceRef}</b><StatusTag status={assessment.status || "assessing"} /></div>
          <p>{assessment.description || "No description returned by assessor."}</p>
          <DetailGrid item={assessment} />
          <div className="capability-action-row">
            <button type="button" disabled={!isApprovedIntake(assessment)}>Run smoke test</button>
            <button type="button" disabled={!isApprovedIntake(assessment)}>Install/register</button>
            <span>{approvalSummary(assessment)}</span>
          </div>
        </div>
      )}
    </section>
  );
}

function CapabilityCard({ record, active, onSelect }: { record: CapabilityRegistryRecord; active: boolean; onSelect: () => void }) {
  const risks = record.governance?.riskLevels ?? record.policyEvidence?.riskLevels ?? [];
  return (
    <article className={`skill-card capability-card ${active ? "on" : ""}`}>
      <button className="skill-card-main" onClick={onSelect}>
        <div className="skill-card-top">
          <div className="skill-card-badges">
            <span className={`skill-enabled-icon ${record.enabled ? "on" : "off"}`}>{record.enabled ? "✓" : "—"}</span>
          </div>
          <StatusTag status={record.status} health={record.health?.state} />
        </div>
        <div className="skill-title-row"><h2>{displayName(record)}</h2></div>
        <p>{record.description || "No description recorded for this capability source."}</p>
        <div className="skill-chips">
          <span>{titleCase(record.type)}</span>
          <span>{record.sourceLabel || "Registry"}</span>
          <span>{record.ownerKind || "system"}</span>
          {risks.slice(0, 2).map((risk) => <em key={risk}>{risk}</em>)}
        </div>
        <div className="skill-triplet">
          <Mini label="Assigned" value={assignmentCount(record)} />
          <Mini label="Health" value={titleCase(record.health?.state)} />
          <Mini label="Approval" value={titleCase(record.governance?.approvalStatus || record.policyEvidence?.approvalStatus)} />
        </div>
      </button>
    </article>
  );
}

function CapabilityListRow({ record, active, onSelect }: { record: CapabilityRegistryRecord; active: boolean; onSelect: () => void }) {
  return (
    <button className={`ops-row capability-list-row ${active ? "on" : ""}`} onClick={onSelect}>
      <div className="ops-row-main">
        <div className="ops-row-top">
          <b>{displayName(record)}</b>
          <StatusTag status={record.status} health={record.health?.state} />
        </div>
        <p>{record.description || "No description recorded."}</p>
        <small className="mono">{record.id}</small>
      </div>
      <div className="ops-row-meta">
        <span>{titleCase(record.type)}</span>
        <small>{record.sourceLabel || "Registry"} · {record.ownerKind || "system"}</small>
        <em>{assignmentCount(record)} assigned · {record.installMethod?.requiresRestart ? "restart required" : "no restart flag"}</em>
      </div>
    </button>
  );
}

function IntakeQueue({ intake, loading, onChanged }: { intake: CapabilityIntakeRecord[]; loading: boolean; onChanged: () => void }) {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});

  const runSmokeTest = async (item: CapabilityIntakeRecord) => {
    if (!isApprovedIntake(item)) return;
    setRunningId(item.id);
    setRowMessage((prev) => ({ ...prev, [item.id]: "Running approved sandbox smoke test…" }));
    try {
      const result = await client.runCapabilitySandbox(item.id, { mode: "dry-run", command: item.smokeTestCommand || item.healthPlan?.smokeTestCommand });
      setRowMessage((prev) => ({ ...prev, [item.id]: result.ok ? "Smoke test evidence recorded." : (result.error || "Smoke test blocked.") }));
      onChanged();
    } catch (err) {
      setRowMessage((prev) => ({ ...prev, [item.id]: err instanceof Error ? err.message : "Smoke test failed" }));
    } finally {
      setRunningId(null);
    }
  };

  return (
    <section className="ops-list capability-intake-list">
      <div className="ops-list-head"><span>Intake Queue</span><small>{loading ? "Loading…" : `${intake.length} requests`}</small></div>
      {intake.map((item) => {
        const approved = isApprovedIntake(item);
        return (
          <div className="ops-row capability-intake-row" key={item.id}>
            <div className="ops-row-main">
              <div className="ops-row-top"><b>{item.title}</b><StatusTag status={item.status || "intake"} /></div>
              <p>{item.description || "No intake description recorded."}</p>
              <small className="mono">{item.id}</small>
              <DetailGrid item={item} />
              <AuditTimeline events={item.auditEvents ?? item.audit ?? []} compact empty="No intake audit yet." />
              {rowMessage[item.id] && <div className="capability-approval-note compact">{rowMessage[item.id]}</div>}
            </div>
            <div className="ops-row-meta capability-intake-meta">
              <span>{titleCase(item.sourceType)}</span>
              <small>{item.sourceLabel || item.sourceRef || item.sourceUri || "Requested source"}</small>
              <em>{approvalSummary(item)}</em>
              <div className="capability-action-stack">
                <button type="button" disabled={!approved || runningId === item.id} onClick={() => void runSmokeTest(item)}>{runningId === item.id ? "Running…" : "Run smoke test"}</button>
                <button type="button" disabled={!approved} title={approved ? "Approval recorded; install/register workflow can proceed." : "Approval required before install/register."}>Install/register</button>
                {!approved && <b>Approval required before install/run</b>}
              </div>
            </div>
          </div>
        );
      })}
      {!loading && intake.length === 0 && <div className="empty big">No capability intake requests matched this filter.</div>}
    </section>
  );
}

function AssignedByAgent({ records, loading, onSelect }: { records: CapabilityRegistryRecord[]; loading: boolean; onSelect: (id: string) => void }) {
  const rows = useMemo(() => {
    const byAgent = new Map<string, { agent: CapabilityAssignmentRef; records: CapabilityRegistryRecord[] }>();
    records.forEach((record) => {
      (record.assignment?.assignedAgents ?? []).forEach((agent) => {
        const id = agent.id || agent.name || "unassigned";
        const existing = byAgent.get(id) ?? { agent, records: [] };
        existing.records.push(record);
        byAgent.set(id, existing);
      });
    });
    return Array.from(byAgent.entries()).sort((a, b) => String(a[1].agent?.name || a[0]).localeCompare(String(b[1].agent?.name || b[0])));
  }, [records]);

  return (
    <section className="ops-list capability-assigned-list">
      <div className="ops-list-head"><span>Assigned by Agent</span><small>{loading ? "Loading…" : `${rows.length} agents`}</small></div>
      {rows.map(([agentId, row]) => (
        <div className="capability-agent-group" key={agentId}>
          <div className="capability-agent-head">
            <b>{row.agent?.name || agentId}</b>
            <span>{row.records.length} capabilities</span>
          </div>
          <div className="capability-agent-records">
            {row.records.map((record) => (
              <button key={record.id} className="capability-agent-chip" onClick={() => onSelect(record.id)}>
                <b>{displayName(record)}</b>
                <small>{titleCase(record.type)} · {titleCase(record.status)}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
      {!loading && rows.length === 0 && <div className="empty big">No agent assignments matched this filter.</div>}
    </section>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

type CapabilityAuditEvent = NonNullable<CapabilityRegistryRecord["auditEvents"]>[number] | Record<string, unknown>;

function auditField(event: CapabilityAuditEvent, key: string) {
  const value = (event as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function AuditTimeline({ events, compact: isCompact = false, empty }: { events: CapabilityAuditEvent[]; compact?: boolean; empty: string }) {
  const visible = (events ?? []).slice(0, isCompact ? 2 : 6);
  return (
    <section className={`drawer-tool-card capability-audit-timeline ${isCompact ? "compact" : ""}`}>
      <h3>Lifecycle audit</h3>
      {visible.map((event, index) => {
        const action = auditField(event, "action") || "lifecycle-event";
        return (
          <div className="kv" key={auditField(event, "id") || `${action}-${index}`}>
            <span>{titleCase(action)}</span>
            <b>{auditField(event, "summary") || "Non-secret evidence recorded."} · {auditField(event, "actorId") || "system"}</b>
          </div>
        );
      })}
      {visible.length === 0 && <div className="kv"><span>Evidence</span><b>{empty}</b></div>}
    </section>
  );
}

type CapabilityDetailTab = "Overview" | "Setup/install" | "Governance" | "Assigned agents" | "Health/evidence" | "Audit trail" | "Rollback" | "Source";

const capabilityDetailTabs: CapabilityDetailTab[] = ["Overview", "Setup/install", "Governance", "Assigned agents", "Health/evidence", "Audit trail", "Rollback", "Source"];
const sensitivePattern = /(token|secret|password|credential|api[_-]?key|authorization|bearer|private[_-]?key)/i;
const tokenLikeFragmentPattern = /(?:[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-.]{12,}|[A-Fa-f0-9]{32,}|[A-Za-z0-9_\-]{48,})/;

function hasTokenLikeFragment(value: string) {
  return tokenLikeFragmentPattern.test(value);
}

function isSafeExternalSourceUrl(value?: string | null): value is string {
  if (!value || !/^https?:\/\//.test(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    for (const [key, value] of url.searchParams.entries()) {
      if (sensitivePattern.test(key) || sensitivePattern.test(value)) return false;
    }
    if (hasTokenLikeFragment(url.pathname) || hasTokenLikeFragment(url.search)) return false;
    return true;
  } catch {
    return false;
  }
}

function redactSensitive(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not recorded";
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item)).join(", ") || "Not recorded";
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 8).map(([key, nested]) => `${titleCase(key)}: ${sensitivePattern.test(key) ? "•••• redacted" : redactSensitive(nested)}`);
    return entries.join(" · ") || "Not recorded";
  }
  const text = String(value);
  if (sensitivePattern.test(text) || /(?:[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-.]{12,}|[A-Fa-f0-9]{32,})/.test(text)) return "•••• redacted";
  return text;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function evidenceLabel(item: EvidenceRecord) {
  return item.title || item.summary || item.source || item.id || "Evidence record";
}

function sourceLinkFor(record: CapabilityRegistryRecord): { label: string; href: string } | null {
  if (isSafeExternalSourceUrl(record.sourceUri)) {
    const sourceUri = record.sourceUri;
    return { label: "Open source URL", href: sourceUri };
  }
  if (record.type === "skill") return { label: "Open Skills Hub", href: buildMissionControlUrl({ view: "skills" }) };
  if (record.type === "tool" || record.type === "toolset") return { label: "Open Tools Hub", href: buildMissionControlUrl({ view: "tools" }) };
  if (record.type === "plugin" || record.type === "mcp") return { label: "Open Plugins Hub", href: buildMissionControlUrl({ view: "plugins" }) };
  if (record.runtimeId) return { label: "Open Runtime Connectors", href: buildMissionControlUrl({ view: "runtimes" }) };
  return null;
}

function CapabilityRefList({ label, items, empty }: { label: string; items?: CapabilityAssignmentRef[]; empty: string }) {
  return (
    <section className="capability-ref-list">
      <h4>{label}</h4>
      {(items ?? []).map((item) => (
        <div className="kv" key={item.id || item.name || item.title}>
          <span>{item.status ? titleCase(item.status) : item.enabled === false ? "Disabled" : "Assigned"}</span>
          <b>{item.name || item.title || item.id}{item.reason ? ` · ${item.reason}` : ""}</b>
        </div>
      ))}
      {(!items || items.length === 0) && <div className="kv"><span>None</span><b>{empty}</b></div>}
    </section>
  );
}

function CapabilityDrawer({ record, onClose }: { record: CapabilityRegistryRecord; onClose: () => void }) {
  const [detailTab, setDetailTab] = useState<CapabilityDetailTab>("Overview");
  const risks = record.governance?.riskLevels ?? record.policyEvidence?.riskLevels ?? [];
  const blocker = record.governance?.actionableBlocker ?? record.policyEvidence?.actionableBlocker;
  const auditEvents = record.auditEvents ?? record.audit ?? [];
  const sourceLink = sourceLinkFor(record);
  const lastVerified = record.health?.lastCheckedAt || record.updatedAt || record.createdAt;
  const broken = isBroken(record);
  const brokenSummary = broken ? (String(record.health?.checkSummary || (blocker as { message?: string } | undefined)?.message || "Record is broken, stale, degraded, rejected, or approval-blocked.")) : "No broken state currently flagged.";
  const requiredSecrets = [...(record.requiredSecrets ?? []), ...(record.installMethod?.requiredSecrets ?? [])];
  const requiredPermissions = [...(record.permissions ?? []), ...(record.installMethod?.requiredPermissions ?? [])];

  return (
    <SlideOverDrawer
      title={displayName(record)}
      subtitle={<span className="mono">{record.id}</span>}
      eyebrow={titleCase(record.type)}
      statusClassName={`tag ${toneForStatus(record.status, record.health?.state)}`}
      onClose={onClose}
      closeLabel="Close capability details"
      tabs={capabilityDetailTabs}
      activeTab={detailTab}
      onTabChange={setDetailTab}
      width="wide"
      className="capability-detail-drawer"
    >
      <div className="drawer-section-list capability-detail-sections">
        {detailTab === "Overview" && (
          <section className="drawer-tool-card">
            <h3>Overview</h3>
            <p className="capability-detail-copy">{record.description || "No description recorded for this capability source."}</p>
            <div className="capability-assessment-grid">
              <Mini label="Status" value={titleCase(record.status)} />
              <Mini label="Health" value={titleCase(record.health?.state)} />
              <Mini label="Last verified" value={formatDateTime(lastVerified)} />
              <Mini label="Broken state" value={broken ? titleCase(record.health?.state || record.status || "needs review") : "Not flagged"} />
              <Mini label="Type" value={titleCase(record.type)} />
              <Mini label="Owner" value={`${record.visibility || "workspace"} · ${record.ownerKind || "system"}`} />
            </div>
            {broken && <div className="skills-error install-status">{brokenSummary}</div>}
          </section>
        )}

        {detailTab === "Setup/install" && (
          <section className="drawer-tool-card">
            <h3>Setup / install</h3>
            <div className="kv"><span>Method</span><b>{titleCase(record.installMethod?.kind || "record-only")}</b></div>
            <div className="kv"><span>Command preview</span><b>{redactSensitive(record.installMethod?.commandPreview || "No command preview recorded.")}</b></div>
            <div className="kv"><span>Config path</span><b>{redactSensitive(record.installMethod?.configPath || "No config path recorded.")}</b></div>
            <div className="kv"><span>Secrets required</span><b>{requiredSecrets.length ? requiredSecrets.map((item) => `${item}: •••• redacted`).join(", ") : "None recorded"}</b></div>
            <div className="kv"><span>Permissions required</span><b>{formatList(requiredPermissions)}</b></div>
            <div className="kv"><span>Smoke test</span><b>{redactSensitive(record.smokeTestCommand || "No smoke test command recorded.")}</b></div>
            <div className="kv"><span>Restart</span><b>{record.installMethod?.requiresRestart ? "Required after install" : "Not flagged"}</b></div>
          </section>
        )}

        {detailTab === "Governance" && (
          <section className="drawer-tool-card">
            <h3>Governance</h3>
            <div className="kv"><span>Risk</span><b>{risks.join(", ") || "read-only"}</b></div>
            <div className="kv"><span>Approval</span><b>{titleCase(record.governance?.approvalStatus || record.policyEvidence?.approvalStatus)} · {record.governance?.approvalAuthority || record.policyEvidence?.approvalAuthority || "none"}</b></div>
            <div className="kv"><span>Policy gate</span><b>{record.governance?.policyGate || record.policyEvidence?.policyGate || "No policy gate recorded."}</b></div>
            <div className="kv"><span>Blocked actions</span><b>{formatList(record.governance?.blockedActions)}</b></div>
            <div className="kv"><span>Policy summary</span><b>{record.governance?.policySummary || "No policy summary recorded."}</b></div>
            {blocker && <div className="skills-error install-status">{String((blocker as { message?: string }).message || "Capability has an actionable blocker.")}</div>}
          </section>
        )}

        {detailTab === "Assigned agents" && (
          <section className="drawer-tool-card">
            <h3>Assigned agents</h3>
            <div className="kv"><span>Assignment unit</span><b>{record.assignment?.assignmentUnit || "capability"}</b></div>
            <div className="kv"><span>Usage count</span><b>{assignmentCount(record)}</b></div>
            <CapabilityRefList label="Agents" items={record.assignment?.assignedAgents} empty="No agent assignment recorded." />
            <CapabilityRefList label="Routines" items={record.assignment?.assignedRoutines} empty="No routine assignment recorded." />
            <CapabilityRefList label="Tasks" items={record.assignment?.assignedTasks} empty="No task assignment recorded." />
            <CapabilityRefList label="Suggested agents" items={record.assignment?.suggestedAgents} empty="No suggested agent recorded." />
          </section>
        )}

        {detailTab === "Health/evidence" && (
          <section className="drawer-tool-card capability-evidence-list">
            <h3>Health / evidence</h3>
            <div className="kv"><span>Health</span><b>{titleCase(record.health?.state)} · {record.health?.checkSummary || "No check summary"}</b></div>
            <div className="kv"><span>Last verified</span><b>{formatDateTime(record.health?.lastCheckedAt)}</b></div>
            <div className="kv"><span>Next check due</span><b>{formatDateTime(record.health?.nextCheckDueAt)}</b></div>
            <div className="kv"><span>Health evidence IDs</span><b>{formatList(record.health?.evidenceIds)}</b></div>
            {(record.evidence ?? []).slice(0, 6).map((item) => (
              <div className="kv" key={item.id}>
                <span>{titleCase(item.kind)} · {formatDateTime(item.createdAt)}</span>
                <b>{evidenceLabel(item)}{item.redacted ? " · redacted" : ""}{item.path ? ` · ${redactSensitive(item.path)}` : ""}{item.url ? ` · ${redactSensitive(item.url)}` : ""}</b>
              </div>
            ))}
            {(!record.evidence || record.evidence.length === 0) && <div className="kv"><span>Evidence</span><b>No evidence records attached yet.</b></div>}
          </section>
        )}

        {detailTab === "Audit trail" && <AuditTimeline events={auditEvents} empty="No lifecycle audit events recorded yet." />}

        {detailTab === "Rollback" && (
          <section className="drawer-tool-card">
            <h3>Rollback</h3>
            <div className="kv"><span>Supported</span><b>{record.rollback?.supported === false ? "Not supported" : "Supported / not explicitly blocked"}</b></div>
            <div className="kv"><span>Disable steps</span><b>{formatList(record.rollback?.disableSteps, "No disable steps recorded.")}</b></div>
            <div className="kv"><span>Uninstall steps</span><b>{formatList(record.rollback?.uninstallSteps, "No uninstall steps recorded.")}</b></div>
            <div className="kv"><span>Restart required</span><b>{record.rollback?.restartRequired ? "Required" : "Not flagged"}</b></div>
          </section>
        )}

        {detailTab === "Source" && (
          <section className="drawer-tool-card">
            <h3>Source</h3>
            <div className="kv"><span>Record source</span><b>{record.sourceLabel || "Registry"}</b></div>
            <div className="kv"><span>Source ref</span><b>{redactSensitive(record.sourceRef || "No source ref recorded.")}</b></div>
            <div className="kv"><span>Source URI</span><b>{redactSensitive(record.sourceUri || "No source URI recorded.")}</b></div>
            <div className="kv"><span>Runtime / profile</span><b>{record.runtimeId || "no runtime"} · {record.profileId || "no profile"}</b></div>
            <div className="kv"><span>Workspace</span><b>{record.workspaceId || "global/admin-visible"}</b></div>
            {sourceLink ? <a className="capability-source-link" href={sourceLink.href}>{sourceLink.label}</a> : <div className="kv"><span>Underlying record</span><b>No hub deep link available for this record type.</b></div>}
          </section>
        )}
      </div>
    </SlideOverDrawer>
  );
}
