import { StoreProvider, useStore } from "./services/store";
import { NavRail } from "./components/NavRail";
import { MissionControl } from "./views/MissionControl";
import { Agents } from "./views/Agents";
import { AgentOrg } from "./views/AgentOrg";
import { Projects } from "./views/Projects";
import { SecondBrain } from "./views/SecondBrain";
import { Approvals } from "./views/Approvals";
import { AuditLog } from "./views/AuditLog";
import { Automations } from "./views/Automations";
import { TaskBoard } from "./views/TaskBoard";
import { SkillsHub } from "./views/SkillsHub";
import { CostDashboard } from "./views/CostDashboard";
import { MissionControlDocs } from "./views/MissionControlDocs";
import { LandingPage } from "./views/LandingPage";
import { LoginPage } from "./views/LoginPage";
import { Placeholder } from "./views/Placeholder";

const docsPaths = new Set(["/mission-control-docs", "/mission-control-guide", "/docs"]);
const publicPaths = new Set(["/", "/login"]);

function Shell() {
  const { view } = useStore();
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";

  if (docsPaths.has(pathname)) {
    return <MissionControlDocs />;
  }

  return (
    <div className="shell">
      <NavRail />
      <main className="main">
        {view === "mission" && <MissionControl />}
        {view === "agents" && <Agents />}
        {view === "agent-org" && <AgentOrg />}
        {view === "projects" && <Projects />}
        {view === "second-brain" && <SecondBrain />}
        {view === "approvals" && <Approvals />}
        {view === "board" && <TaskBoard />}
        {view === "skills" && <SkillsHub />}
        {view === "automations" && <Automations />}
        {view === "audit" && <AuditLog />}
        {view === "costs" && <CostDashboard />}
        {view === "settings" && (
          <Placeholder
            title="Settings"
            blurb="Gateway connection, model defaults, secrets provider, and workspace conventions."
          />
        )}
      </main>
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
