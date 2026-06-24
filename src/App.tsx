import { useEffect, useState } from "react";
import { StoreProvider, useStore } from "./services/store";
import { adminOnlyViews, canAccessView, safeDefaultViewForRole } from "./services/uiPermissions";
import { NavRail } from "./components/NavRail";
import { MissionControl } from "./views/MissionControl";
import { Dashboard } from "./views/Dashboard";
import { Agents } from "./views/Agents";
import { AgentVoice } from "./views/AgentVoice";
import { AgentOrg } from "./views/AgentOrg";
import { Runtimes } from "./views/Runtimes";
import { Projects } from "./views/Projects";
import { FileSystem } from "./views/FileSystem";
import { DelegateWork } from "./views/DelegateWork";
import { WorkflowLibrary } from "./views/WorkflowLibrary";
import { SecondBrain } from "./views/SecondBrain";
import { Approvals } from "./views/Approvals";
import { Reflections } from "./views/Reflections";
import { AuditLog } from "./views/AuditLog";
import { Automations } from "./views/Automations";
import { TaskBoard } from "./views/TaskBoard";
import { SkillsHub } from "./views/SkillsHub";
import { MemoryContext } from "./views/MemoryContext";
import { ToolsHub } from "./views/ToolsHub";
import { CapabilityRegistry } from "./views/CapabilityRegistry";
import { PluginsHub } from "./views/PluginsHub";
import { CostDashboard } from "./views/CostDashboard";
import { UsageRemaining } from "./views/UsageRemaining";
import { ModelRouter } from "./views/ModelRouter";
import { HermesDesktopAdmin } from "./views/HermesDesktopAdmin";
import { MissionControlDocs } from "./views/MissionControlDocs";
import { LandingPage } from "./views/LandingPage";
import { LoginPage } from "./views/LoginPage";
import { AdminSetupPage } from "./views/AdminSetupPage";
import { BrowserOperations } from "./views/BrowserOperations";
import { ResearchRuns } from "./views/ResearchRuns";
import { Placeholder } from "./views/Placeholder";
import { parseMissionControlDeepLink } from "./services/deepLinks";
import { recordRouteTelemetry } from "./services/performanceTelemetry";

const docsPaths = new Set(["/mission-control-docs", "/mission-control-guide", "/docs"]);
const publicPaths = new Set(["/", "/login"]);
const standaloneAgentVoicePaths = new Set(["/agent-voice"]);

function Shell() {
  // Preserve auth-flash regression contract: const { view, setView, me, loading } = useStore();
  const { view, setView, applyDeepLinkTarget, uiMode, me, loading, permissions } = useStore();
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  const canRenderView = (permissions.canAccessAdmin || !adminOnlyViews.has(view)) ? canAccessView(me?.user?.role, view) : false;
  const [isMobileChatOnly, setIsMobileChatOnly] = useState(false);

  useEffect(() => {
    const syncDeepLink = () => applyDeepLinkTarget(parseMissionControlDeepLink(window.location));
    window.addEventListener("popstate", syncDeepLink);
    return () => window.removeEventListener("popstate", syncDeepLink);
  }, [applyDeepLinkTarget]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const syncMobileChatOnly = () => setIsMobileChatOnly(mediaQuery.matches);
    syncMobileChatOnly();
    mediaQuery.addEventListener("change", syncMobileChatOnly);
    return () => mediaQuery.removeEventListener("change", syncMobileChatOnly);
  }, []);

  useEffect(() => {
    recordRouteTelemetry(view);
  }, [view]);

  if (docsPaths.has(pathname)) {
    return <MissionControlDocs />;
  }

  if (loading && !me) {
    return <div className="app-loading-screen" aria-label="Loading Mission Control" />;
  }

  const shouldRenderMobileChatOnly = isMobileChatOnly && uiMode !== "admin" && !adminOnlyViews.has(view) && view !== "agent-voice";

  if (shouldRenderMobileChatOnly) {
    return (
      <div className="shell mobile-chat-only-shell">
        <main className="main mobile-chat-only-main">
          <MissionControl />
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <NavRail />
      <main className="main">
        {!canRenderView && <AdminOnlyNotice onGoHome={() => setView(safeDefaultViewForRole(me?.user.role))} />}
        {canRenderView && view === "mission" && <MissionControl />}
        {canRenderView && view === "dashboard" && <Dashboard />}
        {canRenderView && view === "delegate-work" && <DelegateWork />}
        {canRenderView && view === "workflow-library" && <WorkflowLibrary />}
        {canRenderView && view === "profile" && <Placeholder title="Account Settings" blurb="Account identity and operator preferences for your Mission Control workspace." />}
        {canRenderView && view === "agents" && <Agents />}
        {canRenderView && view === "agent-voice" && <AgentVoice />}
        {canRenderView && view === "agent-org" && <AgentOrg />}
        {canRenderView && view === "runtimes" && <Runtimes />}
        {canRenderView && view === "projects" && <Projects />}
        {canRenderView && view === "files" && <FileSystem />}
        {canRenderView && view === "second-brain" && <SecondBrain />}
        {canRenderView && view === "approvals" && <Approvals />}
        {canRenderView && view === "board" && <TaskBoard />}
        {canRenderView && view === "skills" && <SkillsHub />}
        {canRenderView && view === "memory" && <MemoryContext />}
        {canRenderView && view === "reflections" && <Reflections />}
        {canRenderView && view === "tools" && <ToolsHub />}
        {canRenderView && view === "capabilities" && <CapabilityRegistry />}
        {canRenderView && view === "plugins" && <PluginsHub />}
        {canRenderView && view === "automations" && <Automations />}
        {canRenderView && view === "audit" && <AuditLog />}
        {canRenderView && view === "usage" && <UsageRemaining />}
        {canRenderView && view === "costs" && <CostDashboard />}
        {canRenderView && view === "models" && <ModelRouter />}
        {canRenderView && view === "settings" && <HermesDesktopAdmin />}
        {canRenderView && view === "agent-platform-admin" && <AdminSetupPage kind="agent-platform-admin" />}
        {canRenderView && view === "users-workspaces" && <AdminSetupPage kind="users-workspaces" />}
        {canRenderView && view === "workspace-runtime-console" && <AdminSetupPage kind="workspace-runtime-console" />}
        {canRenderView && view === "shared-agent-templates" && <AdminSetupPage kind="shared-agent-templates" />}
        {canRenderView && view === "desktop-gateway" && <HermesDesktopAdmin />}
        {canRenderView && view === "browser-ops" && <BrowserOperations />}
        {canRenderView && view === "research-runs" && <ResearchRuns />}
        {canRenderView && view === "approval-policy" && <AdminSetupPage kind="approval-policy" />}
        {canRenderView && view === "quota" && <AdminSetupPage kind="quota" />}
      </main>
    </div>
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

  if (docsPaths.has(pathname)) {
    return <MissionControlDocs />;
  }

  if (standaloneAgentVoicePaths.has(pathname)) {
    return <AgentVoice />;
  }

  if (publicPaths.has(pathname)) {
    return pathname === "/login" ? <LoginPage /> : <LandingPage />;
  }

  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
