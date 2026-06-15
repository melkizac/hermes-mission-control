import { useEffect, useMemo, useState } from "react";
import type { MissionControlMe } from "../types";
import { useStore } from "../services/store";
import { InfoTooltip } from "../components/InfoTooltip";

function label(value: unknown, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function statusLabel(value: unknown) {
  return label(value, "not provisioned");
}

function KeyValueList({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <dl className="account-kv-list">
      {rows.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{label(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AccountSettings({ initialSection = "profile" }: { initialSection?: "profile" | "preferences" }) {
  const { me: storeMe, uiMode } = useStore();
  const [me, setMe] = useState<MissionControlMe | null>(storeMe);
  const [loading, setLoading] = useState(!storeMe);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function loadMe() {
      try {
        setLoading(true);
        const res = await fetch(`${window.location.protocol}//${window.location.host}/api/me`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => null) as MissionControlMe | null;
        if (!alive) return;
        if (!res.ok || !data?.ok) {
          throw new Error(data && "error" in data ? String((data as any).error) : "Unable to load account identity");
        }
        setMe(data);
        setError(null);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Unable to load account identity");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void loadMe();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (storeMe) setMe(storeMe);
  }, [storeMe]);

  const profileRows = useMemo<Array<[string, unknown]>>(() => [
    ["Hermes profile", me?.hermes_profile?.display_name || me?.hermes_profile?.profile_name],
    ["Profile status", me?.hermes_profile?.status],
    ["Runtime", me?.runtime?.kind || me?.runtime?.container_name],
    ["Runtime status", me?.runtime?.status],
    ["Agent access", me?.agent_access?.role || (me?.user.role === "admin" ? "Workspace owner" : "Workspace member")],
  ], [me]);

  const identityRows = useMemo<Array<[string, unknown]>>(() => {
    if (!me) return [
      ["Name", null],
      ["Email", null],
      ["Role", null],
      ["Account status", null],
      ["Workspace", null],
      ["Workspace slug", null],
    ];
    return [
      ["Name", me.user.name],
      ["Email", me.user.email],
      ["Role", me.user.role],
      ["Account status", me.user.status],
      ["Workspace", me.workspace.name],
      ["Workspace slug", me.workspace.slug],
    ];
  }, [me]);

  const preferencesFocused = initialSection === "preferences";

  return (
    <div className="account-settings-page scroll" aria-busy={loading}>
      <header className="account-settings-hero">
        <div>
          <span className="stub-tag">{preferencesFocused ? "WORKSPACE PREFERENCES" : "USER PROFILE"}</span>
          <div className="hero-title-with-help">
            <h1>{preferencesFocused ? "Workspace Preferences" : "User Profile"}</h1>
            <InfoTooltip label="About account settings">
              This page reads authenticated /api/me identity and separates user workspace preferences from Admin platform setup.
            </InfoTooltip>
          </div>
          <p>{preferencesFocused
            ? "Review user-owned defaults for agents, projects, notifications, timezone, and voice without entering the Admin Console."
            : "Review the workspace identity Mission Control uses for chat, tasks, approvals, routines, and agent access."}</p>
        </div>
        <div className="account-hero-card">
          <span>Workspace Preferences</span>
          <b>{label(me?.workspace.name, "Workspace loading…")}</b>
          <small>{uiMode === "admin" ? "Admin mode active" : "User mode active"}</small>
        </div>
      </header>

      {error ? <div className="account-settings-error">{error}</div> : null}

      <section className="account-identity-grid">
        <article className="account-settings-card">
          <div className="account-card-head">
            <span>Authenticated identity</span>
            <b>{statusLabel(me?.user.status)}</b>
          </div>
          <KeyValueList rows={identityRows} />
        </article>

        <article className="account-settings-card">
          <div className="account-card-head">
            <span>Hermes runtime</span>
            <b>{statusLabel(me?.runtime?.status || me?.hermes_profile?.status)}</b>
          </div>
          <KeyValueList rows={profileRows} />
        </article>
      </section>

      <section className="account-preferences-grid" aria-label="Workspace Preferences">
        <article className="account-preference-card">
          <div>
            <span>Default agent</span>
            <b>Workspace roster default</b>
          </div>
          <p>The default agent selector will persist per-user once preference saving is enabled.</p>
          <em className="account-readonly-pill">Planned / read-only</em>
        </article>
        <article className="account-preference-card">
          <div>
            <span>Default project</span>
            <b>Last active project</b>
          </div>
          <p>Project defaults will use the same project list as Chat and Task Board.</p>
          <em className="account-readonly-pill">Planned / read-only</em>
        </article>
        <article className="account-preference-card">
          <div>
            <span>Notifications</span>
            <b>Mission Control + subscribed channels</b>
          </div>
          <p>Approval, blocked-task, and routine alerts remain governed by existing channel subscriptions.</p>
          <em className="account-readonly-pill">Planned / read-only</em>
        </article>
        <article className="account-preference-card">
          <div>
            <span>Timezone</span>
            <b>{Intl.DateTimeFormat().resolvedOptions().timeZone || "Browser timezone"}</b>
          </div>
          <p>Times are currently displayed from browser/runtime context until workspace timezone persistence lands.</p>
          <em className="account-readonly-pill">Planned / read-only</em>
        </article>
        <article className="account-preference-card">
          <div>
            <span>Voice preference</span>
            <b>Composer-first</b>
          </div>
          <p>Voice remains a workspace feature preference; route-level voice setup stays separate from Admin runtime setup.</p>
          <em className="account-readonly-pill">Planned / read-only</em>
        </article>
      </section>
    </div>
  );
}
