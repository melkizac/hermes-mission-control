import { useState } from "react";
import { Icon } from "../components/Icon";
import { useStore } from "../services/store";

type SettingsTab = "profile" | "security";

const tabs: Array<{ id: SettingsTab; label: string; icon: Parameters<typeof Icon>[0]["name"] }> = [
  { id: "profile", label: "Profile", icon: "profile" },
  { id: "security", label: "Security", icon: "settings" },
];

function ValueRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="user-settings-value-row">
      <span>{label}</span>
      <b>{value || "-"}</b>
    </div>
  );
}

export function SettingsPage() {
  const { me, selected, uiMode } = useStore();
  const [tab, setTab] = useState<SettingsTab>("profile");
  const user = me?.user;
  const workspace = me?.workspace;

  return (
    <div className="user-settings-page scroll">
      <section className="user-settings-hero">
        <div>
          <span className="eyebrow">SETTINGS</span>
          <h1>Settings</h1>
        </div>
      </section>

      <nav className="user-settings-tabs" aria-label="Settings sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "on" : ""}
            type="button"
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {tab === "profile" && (
        <section className="user-settings-grid">
          <article className="user-settings-panel user-settings-span-7">
            <header className="user-settings-panel-head">
              <div>
                <Icon name="profile" size={18} />
                <span>Account Profile</span>
              </div>
            </header>
            <div className="user-settings-values">
              <ValueRow label="Name" value={user?.name} />
              <ValueRow label="Email" value={user?.email} />
              <ValueRow label="Role" value={user?.role} />
              <ValueRow label="Status" value={user?.status} />
            </div>
          </article>

          <article className="user-settings-panel user-settings-span-5">
            <header className="user-settings-panel-head">
              <div>
                <Icon name="dashboard" size={18} />
                <span>Workspace</span>
              </div>
            </header>
            <div className="user-settings-values">
              <ValueRow label="Workspace" value={workspace?.name} />
              <ValueRow label="Slug" value={workspace?.slug} />
              <ValueRow label="Mode" value={uiMode} />
            </div>
          </article>

          <article className="user-settings-panel user-settings-span-12">
            <header className="user-settings-panel-head">
              <div>
                <Icon name="agents" size={18} />
                <span>Active Agent Profile</span>
              </div>
            </header>
            <div className="user-settings-values user-settings-values-three">
              <ValueRow label="Agent" value={selected?.name} />
              <ValueRow label="Group" value={selected?.squad} />
              <ValueRow label="Model" value={selected?.model} />
              <ValueRow label="Status" value={selected?.statusLabel || selected?.status} />
              <ValueRow label="Profile" value={selected?.profile_details?.profile_id || selected?.id} />
              <ValueRow label="Path" value={selected?.profilePath} />
            </div>
          </article>
        </section>
      )}

      {tab === "security" && (
        <section className="user-settings-grid">
          <article className="user-settings-panel user-settings-span-7">
            <header className="user-settings-panel-head">
              <div>
                <Icon name="settings" size={18} />
                <span>Security</span>
              </div>
            </header>
            <div className="user-settings-values">
              <ValueRow label="Session" value={user ? "Signed in" : "Not signed in"} />
              <ValueRow label="Account role" value={user?.role} />
              <ValueRow label="Account status" value={user?.status} />
              <ValueRow label="Workspace" value={workspace?.name} />
            </div>
          </article>

          <article className="user-settings-panel user-settings-span-5">
            <header className="user-settings-panel-head">
              <div>
                <Icon name="approvals" size={18} />
                <span>Access Boundary</span>
              </div>
            </header>
            <div className="user-settings-callout">
              <b>{user?.role === "admin" ? "Admin account" : "Workspace account"}</b>
              <p>{user?.role === "admin" ? "Admin controls remain in the admin console." : "Workspace access is limited to your assigned workspace and agent profile."}</p>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
