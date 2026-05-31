import { StoreProvider, useStore } from "./services/store";
import { NavRail } from "./components/NavRail";
import { MissionControl } from "./views/MissionControl";
import { Agents } from "./views/Agents";
import { Projects } from "./views/Projects";
import { Approvals } from "./views/Approvals";
import { AuditLog } from "./views/AuditLog";
import { Automations } from "./views/Automations";
import { TaskBoard } from "./views/TaskBoard";
import { SkillsHub } from "./views/SkillsHub";
import { CostDashboard } from "./views/CostDashboard";
import { Placeholder } from "./views/Placeholder";

function Shell() {
  const { view } = useStore();
  return (
    <div className="shell">
      <NavRail />
      <main className="main">
        {view === "mission" && <MissionControl />}
        {view === "agents" && <Agents />}
        {view === "projects" && <Projects />}
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
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
