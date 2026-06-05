import { useEffect, useState } from "react";
import { StoreProvider, useStore } from "./services/store";
import { canAccessView, safeDefaultViewForRole } from "./services/uiPermissions";
import { NavRail } from "./components/NavRail";
import { Icon } from "./components/Icon";
import { MissionControl } from "./views/MissionControl";
import { Dashboard } from "./views/Dashboard";
import { WorkHub } from "./views/WorkHub";
import { EvidenceHub } from "./views/EvidenceHub";
import { Agents } from "./views/Agents";
import { AgentOrg } from "./views/AgentOrg";
import { Runtimes } from "./views/Runtimes";
import { Projects } from "./views/Projects";
import { DelegateWork } from "./views/DelegateWork";
import { WorkflowLibrary } from "./views/WorkflowLibrary";
import { SecondBrain } from "./views/SecondBrain";
import { Approvals } from "./views/Approvals";
import { AuditLog } from "./views/AuditLog";
import { Automations } from "./views/Automations";
import { TaskBoard } from "./views/TaskBoard";
import { SkillsHub } from "./views/SkillsHub";
import { ToolsHub } from "./views/ToolsHub";
import { CostDashboard } from "./views/CostDashboard";
import { ModelRouter } from "./views/ModelRouter";
import { SettingsDesktop } from "./views/SettingsDesktop";
import { MissionControlDocs } from "./views/MissionControlDocs";
import { LandingPage } from "./views/LandingPage";
import { LoginPage } from "./views/LoginPage";
import { AdminSetupPage } from "./views/AdminSetupPage";
import { BrowserOperations } from "./views/BrowserOperations";
import { ResearchRuns } from "./views/ResearchRuns";
import { Placeholder } from "./views/Placeholder";
import { parseMissionControlDeepLink } from "./services/deepLinks";

const docsPaths = new Set(["/mission-control-docs", "/mission-control-guide", "/docs"]);
const publicPaths = new Set(["/", "/login"]);

async function requestJson<T>(path: string): Promise<T> {
  const res = await fetch(`${window.location.protocol}//${window.location.host}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${path}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function safeJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return await requestJson<T>(path);
  } catch {
    return fallback;
  }
}

function Shell() {
  // Preserve auth-flash regression contract: const { view, setView, me, loading } = useStore();
  const { view, setView, applyDeepLinkTarget, me, loading } = useStore();
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  const canRenderView = canAccessView(me?.user.role, view);

  useEffect(() => {
    const syncDeepLink = () => applyDeepLinkTarget(parseMissionControlDeepLink(window.location));
    window.addEventListener("popstate", syncDeepLink);
    return () => window.removeEventListener("popstate", syncDeepLink);
  }, [applyDeepLinkTarget]);

  if (docsPaths.has(pathname)) {
    return <MissionControlDocs />;
  }

  if (loading && !me) {
    return <div className="app-loading-screen" aria-label="Loading Mission Control" />;
  }

  return (
    <div className="shell">
      <NavRail />
      <div className="top-right-actions">
        <AdminUserModeToggle />
        <NeedsAttentionBell />
      </div>
      <main className="main">
        {!canRenderView && <AdminOnlyNotice onGoHome={() => setView(safeDefaultViewForRole(me?.user.role))} />}
        {canRenderView && view === "mission" && <MissionControl />}
        {canRenderView && view === "dashboard" && <Dashboard />}
        {canRenderView && view === "work" && <WorkHub />}
        {canRenderView && view === "evidence" && <EvidenceHub />}
        {canRenderView && view === "delegate-work" && <DelegateWork />}
        {canRenderView && view === "workflow-library" && <WorkflowLibrary />}
        {canRenderView && view === "profile" && <Placeholder title="Profile" blurb="Account identity and operator preferences for Mission Control." />}
        {canRenderView && view === "agents" && <Agents />}
        {canRenderView && view === "agent-org" && <AgentOrg />}
        {canRenderView && view === "runtimes" && <Runtimes />}
        {canRenderView && view === "projects" && <Projects />}
        {canRenderView && view === "second-brain" && <SecondBrain />}
        {canRenderView && view === "approvals" && <Approvals />}
        {canRenderView && view === "board" && <TaskBoard />}
        {canRenderView && view === "skills" && <SkillsHub />}
        {canRenderView && view === "tools" && <ToolsHub />}
        {canRenderView && view === "automations" && <Automations />}
        {canRenderView && view === "audit" && <AuditLog />}
        {canRenderView && view === "costs" && <CostDashboard />}
        {canRenderView && view === "models" && <ModelRouter />}
        {canRenderView && view === "settings" && <SettingsDesktop />}
        {canRenderView && view === "users-workspaces" && <AdminSetupPage kind="users-workspaces" />}
        {canRenderView && view === "shared-agent-templates" && <AdminSetupPage kind="shared-agent-templates" />}
        {canRenderView && view === "desktop-gateway" && <AdminSetupPage kind="desktop-gateway" />}
        {canRenderView && view === "browser-ops" && <BrowserOperations />}
        {canRenderView && view === "research-runs" && <ResearchRuns />}
        {canRenderView && view === "approval-policy" && <AdminSetupPage kind="approval-policy" />}
        {canRenderView && view === "quota" && <AdminSetupPage kind="quota" />}
      </main>
    </div>
  );
}

function AdminUserModeToggle() {
  const { uiMode, setUiMode, setView, permissions } = useStore();

  if (!permissions.accountIsAdmin) return null;

  function switchToUser() {
    setUiMode("workspace");
    setView("mission");
  }

  function switchToAdmin() {
    setUiMode("admin");
    setView("settings");
  }

  return (
    <div className="top-mode-toggle" aria-label="Admin and user mode toggle">
      <button
        className={"mode-button" + (uiMode === "workspace" ? " on" : "")}
        aria-pressed={uiMode === "workspace"}
        onClick={switchToUser}
      >
        User
      </button>
      <button
        className={"mode-button" + (uiMode === "admin" ? " on" : "")}
        aria-pressed={uiMode === "admin"}
        onClick={switchToAdmin}
      >
        Admin
      </button>
    </div>
  );
}

function NeedsAttentionBell() {
  const { approvals, setView } = useStore();
  const [attentionCount, setAttentionCount] = useState(0);

  useEffect(() => {
    let alive = true;
    async function loadAttentionCount() {
      const [status, inbox, automations, board] = await Promise.all([
        safeJson<any>("/api/status", null),
        safeJson<any>("/api/inbox", null),
        safeJson<any>("/api/automations", null),
        safeJson<any>("/api/task-board", null),
      ]);
      const apiOk = Boolean(status?.api?.health?.ok);
      const gatewayOk = Boolean(status?.gateway?.running);
      const inboxSummary = inbox?.summary;
      const highRisk = inboxSummary?.high_risk ?? inbox?.items?.filter((item: any) => item.risk === "high" || item.risk === "critical").length ?? 0;
      const failedRoutines = automations?.summary?.error ?? 0;
      const blockedTasks = (board?.summary?.blocked ?? 0) + (board?.summary?.error ?? 0);
      const draftApprovals = inboxSummary?.drafted ?? approvals.length;
      const nextCount = draftApprovals + highRisk + failedRoutines + blockedTasks + (!apiOk ? 1 : 0) + (!gatewayOk ? 1 : 0);
      if (alive) setAttentionCount(nextCount);
    }
    void loadAttentionCount();
    const timer = window.setInterval(loadAttentionCount, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [approvals.length]);

  const countLabel = attentionCount === 1 ? "1 item" : `${attentionCount} items`;

  return (
    <button
      className={"top-attention-bell" + (attentionCount > 0 ? " has-items" : "")}
      aria-label={`Needs Attention: ${attentionCount} item${attentionCount === 1 ? "" : "s"}`}
      onClick={() => setView("approvals")}
      title={`Needs Attention: ${countLabel}`}
    >
      <Icon name="bell" size={18} />
      <span className="attention-count">{attentionCount > 99 ? "99+" : attentionCount}</span>
    </button>
  );
}

function AdminOnlyNotice({ onGoHome }: { onGoHome: () => void }) {
  return (
    <div className="center mc-empty">
      <h2>This area is restricted to Mission Control admins</h2>
      <p>Your workspace role can use agents, projects, task board, approvals, automations, and audit evidence.</p>
      <button className="btn" onClick={onGoHome}>Go to my workspace</button>
    </div>
  );
}

export default function App() {
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";

  if (publicPaths.has(pathname)) {
    return pathname === "/login" ? <LoginPage /> : <LandingPage />;
  }

  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
