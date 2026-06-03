import { useEffect, useState } from "react";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "mental-model", label: "Mental model" },
  { id: "daily-flow", label: "Daily operating flow" },
  { id: "navigation", label: "Navigation" },
  { id: "agents", label: "Agents" },
  { id: "projects", label: "Projects / Workspaces" },
  { id: "task-board", label: "Task Board" },
  { id: "approvals", label: "Approval Gates" },
  { id: "automation", label: "Routines" },
  { id: "audit", label: "Audit & costs" },
  { id: "patterns", label: "Operating patterns" },
];

const navCards = [
  {
    title: "Mission Control",
    body: "The command cockpit. Pick an agent, talk to it, attach files, stop long runs, and inspect current context without leaving the dashboard.",
  },
  {
    title: "Agent Org",
    body: "Your operating structure. See agent groups, assign goals, track goal actions, and keep human-owned bottlenecks visible.",
  },
  {
    title: "Projects",
    body: "One card per real initiative. Product plans, filesystem workspaces, kanban context, notes, artifacts, agents, and routines are linked into a single project view.",
  },
  {
    title: "Task Board",
    body: "The execution lane. Shows concrete tasks across agents and Melverick-owned actions, with status and ownership instead of hidden prose.",
  },
  {
    title: "Approval Gates",
    body: "Human-in-the-loop checkpoint for drafts, risky actions, outbound messages, and anything that needs explicit sign-off.",
  },
  {
    title: "Audit Log / Costs",
    body: "Trace what happened, which tools ran, how sessions ended, token usage, and operational spend signals.",
  },
];

const operatingPatterns = [
  "Give outcome-first instructions: say what should be true when the work is done, not every keystroke.",
  "Use agent-owned tasks for executable work and Melverick-owned tasks only for real human decisions, approvals, or missing context.",
  "Treat Projects as the source of initiative context and Task Board as the source of next actions.",
  "Use Approval Gates for live publishing, external messages, irreversible changes, or anything with reputational or financial risk.",
  "Check Audit Log when you need evidence: session history, tool usage, errors, and completion signals.",
];

export function MissionControlDocs() {
  const [activeSection, setActiveSection] = useState(sections[0].id);

  useEffect(() => {
    const sectionElements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (!sectionElements.length) return;

    let frame = 0;
    const markActive = (id: string) => {
      setActiveSection(id);
      sectionElements.forEach((section) => {
        section.classList.toggle("is-active", section.id === id);
      });
    };

    const updateActiveSection = () => {
      const activationLine = Math.min(220, window.innerHeight * 0.28);
      const current = sectionElements.reduce((selected, section) => {
        const selectedDistance = Math.abs(selected.getBoundingClientRect().top - activationLine);
        const sectionDistance = Math.abs(section.getBoundingClientRect().top - activationLine);
        return sectionDistance < selectedDistance ? section : selected;
      }, sectionElements[0]);
      markActive(current.id);
    };

    const requestUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      sectionElements.forEach((section) => section.classList.remove("is-active"));
    };
  }, []);

  return (
    <div className="docs-page">
      <aside className="docs-sidebar">
        <a className="docs-brand" href="/">
          <span>MC</span>
          <b>Mission Control Docs</b>
        </a>
        <nav aria-label="Mission Control documentation sections">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={activeSection === section.id ? "active" : undefined}
              aria-current={activeSection === section.id ? "true" : undefined}
            >
              {section.label}
            </a>
          ))}
        </nav>
        <a className="docs-open-app" href="/app">
          Open Mission Control →
        </a>
      </aside>

      <main className="docs-main">
        <section className="docs-hero" id="overview">
          <div>
            <p className="docs-kicker">Melverick_OS · Hermes Mission Control</p>
            <h1>Operate your AI workforce from one control plane.</h1>
            <p>
              Mission Control is the working dashboard for your Hermes agents, projects, approvals, audit trail,
              routines, and second brain. It is designed for an operator-led workflow: you set goals, agents execute,
              and the system keeps decisions, evidence, and bottlenecks visible.
            </p>
            <div className="docs-actions">
              <a href="/app">Launch dashboard</a>
              <a href="#daily-flow">Learn the daily flow</a>
            </div>
          </div>
          <div className="docs-hero-card">
            <span>Core loop</span>
            <ol>
              <li>Set the goal</li>
              <li>Assign the right agent</li>
              <li>Track tasks and blockers</li>
              <li>Approve sensitive actions</li>
              <li>Review audit evidence</li>
            </ol>
          </div>
        </section>

        <section className="docs-section" id="mental-model">
          <p className="docs-kicker">Mental model</p>
          <h2>Mission Control is not a chat app. It is an execution layer.</h2>
          <div className="docs-grid three">
            <div className="docs-card">
              <span>01</span>
              <h3>Agents do the work</h3>
              <p>Agents own execution: research, file edits, browser checks, API work, scheduled runs, and verification.</p>
            </div>
            <div className="docs-card">
              <span>02</span>
              <h3>Projects hold context</h3>
              <p>Each project collects plans, workspaces, notes, artifacts, tasks, agents, and routines into one operating surface.</p>
            </div>
            <div className="docs-card">
              <span>03</span>
              <h3>Humans approve leverage points</h3>
              <p>Melverick stays focused on decisions, approvals, direction, and exceptions instead of chasing every operational step.</p>
            </div>
          </div>
        </section>

        <section className="docs-section" id="daily-flow">
          <p className="docs-kicker">Daily operating flow</p>
          <h2>Use this sequence when you open Mission Control.</h2>
          <div className="docs-steps">
            <div><b>1. Check active work</b><p>Open Mission Control or Agent Org to see active agents, recent sessions, and waiting states.</p></div>
            <div><b>2. Review the Task Board</b><p>Look for blocked items, Melverick-owned actions, and tasks that need a decision before agents can continue.</p></div>
            <div><b>3. Clear Approval Gates</b><p>Approve, reject, or revise drafts and external actions. This keeps execution moving without sacrificing control.</p></div>
            <div><b>4. Open Projects</b><p>Use Projects for initiative-level context: what exists, what changed, which workspace is live, and which agents are attached.</p></div>
            <div><b>5. Audit what matters</b><p>Use Audit Log and Costs when you need traceability, debugging evidence, or spend visibility.</p></div>
          </div>
        </section>

        <section className="docs-section" id="navigation">
          <p className="docs-kicker">Navigation</p>
          <h2>What each page is for</h2>
          <div className="docs-grid two">
            {navCards.map((card) => (
              <div className="docs-card" key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="docs-section" id="agents">
          <p className="docs-kicker">Agents</p>
          <h2>Talking to agents</h2>
          <div className="docs-callout">
            <b>Best prompt shape:</b> “Goal: [business outcome]. Context: [facts/files]. Constraints: [approval/risk]. Verify by: [test/API/browser evidence].”
          </div>
          <ul className="docs-list">
            <li>Select an agent from the roster before sending instructions.</li>
            <li>Attach files when the agent needs source material or screenshots.</li>
            <li>Use STOP when a run is going down the wrong path or should be cancelled.</li>
            <li>Ask for verified output: live URL, build result, API response, screenshot, or changed file path.</li>
          </ul>
        </section>

        <section className="docs-section" id="projects">
          <p className="docs-kicker">Projects / Workspaces</p>
          <h2>Use Projects as your initiative map.</h2>
          <p>
            The Projects page merges related product plans, workspace folders, kanban goals, notes, artifacts, agents,
            and routines into a single card per real initiative. A card showing “3 contexts” means multiple backing
            sources are linked, not duplicated.
          </p>
          <div className="docs-grid two">
            <div className="docs-card"><h3>Open a project when…</h3><p>You need the current operating brief, workspace path, linked notes, recent artifacts, or which agents and routines are involved.</p></div>
            <div className="docs-card"><h3>Use the brief when…</h3><p>You need a compact summary of mission, status, next actions, risks, and project evidence before assigning more work.</p></div>
          </div>
        </section>

        <section className="docs-section" id="task-board">
          <p className="docs-kicker">Task Board</p>
          <h2>Keep work visible and owned.</h2>
          <p>
            The Task Board is where execution becomes accountable. Agent work should sit on agent lanes. Human work should
            be explicit and assigned to Melverick only when a real decision, approval, credential, or business input is needed.
          </p>
        </section>

        <section className="docs-section" id="approvals">
          <p className="docs-kicker">Approval Gates</p>
          <h2>Control risk without slowing execution.</h2>
          <ul className="docs-list">
            <li>Approve only when the draft/action is ready to go live.</li>
            <li>Reject when the action is wrong, risky, premature, or missing context.</li>
            <li>Ask the agent to revise if the direction is right but the output needs improvement.</li>
            <li>Use this page especially for LinkedIn posts/comments, website publishing, emails, irreversible edits, and credential-sensitive work.</li>
          </ul>
        </section>

        <section className="docs-section" id="automation">
          <p className="docs-kicker">Routines</p>
          <h2>Scheduled work and recurring missions.</h2>
          <p>
            Routines show recurring Hermes jobs such as monitors, planners, reminders, content workflows, and watchdogs.
            Use them to confirm schedule, status, next run, attached skills, and whether a job is paused or active.
          </p>
        </section>

        <section className="docs-section" id="audit">
          <p className="docs-kicker">Audit & costs</p>
          <h2>Use evidence, not vibes.</h2>
          <div className="docs-grid two">
            <div className="docs-card"><h3>Audit Log</h3><p>Inspect session source, status, duration, tool calls, previews, and completion/error state.</p></div>
            <div className="docs-card"><h3>Costs</h3><p>Track model usage, token volume, provider cost signals, and expensive or unusual sessions.</p></div>
          </div>
        </section>

        <section className="docs-section" id="patterns">
          <p className="docs-kicker">Operating patterns</p>
          <h2>Rules of thumb</h2>
          <ul className="docs-list strong">
            {operatingPatterns.map((pattern) => <li key={pattern}>{pattern}</li>)}
          </ul>
          <div className="docs-footer-cta">
            <b>Ready?</b>
            <span>Open the dashboard and start from active work, approval gates, or the project you care about.</span>
            <a href="/app">Open Mission Control</a>
          </div>
        </section>
      </main>
    </div>
  );
}
