import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { formatSingaporeTime } from "../utils/time";
import { InfoTooltip } from "../components/InfoTooltip";

type FileRoot = {
  id: string;
  label: string;
  description: string;
  path: string;
  writable?: boolean;
};

type FileItem = {
  name: string;
  path: string;
  kind: "directory" | "file";
  size: number;
  updated_at: string;
  extension?: string;
  mime?: string;
  download_url?: string | null;
  previewable?: boolean;
};

type FilePayload = {
  ok: boolean;
  error?: string;
  roots: FileRoot[];
  root: FileRoot;
  path: string;
  parent: string;
  breadcrumbs?: Array<{ label: string; path: string }>;
  item?: FileItem;
  items: FileItem[];
  summary?: { directories: number; files: number; shown: number };
};

type PreviewPayload = { ok: boolean; error?: string; item?: FileItem; content?: string };

function bytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function fileIcon(item: FileItem) {
  if (item.kind === "directory") return "folder";
  const ext = (item.extension || "").toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return "image";
  if ([".pptx", ".pdf", ".docx", ".xlsx"].includes(ext)) return "file";
  return "file";
}

async function requestFiles(root: string, path: string): Promise<FilePayload> {
  const params = new URLSearchParams({ root, path });
  const res = await fetch(`${window.location.protocol}//${window.location.host}/api/files?${params}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = await res.json() as FilePayload;
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function requestPreview(root: string, path: string): Promise<PreviewPayload> {
  const params = new URLSearchParams({ root, path });
  const res = await fetch(`${window.location.protocol}//${window.location.host}/api/files/preview?${params}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = await res.json() as PreviewPayload;
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export function FileSystem() {
  const [root, setRoot] = useState("outputs");
  const [path, setPath] = useState("");
  const [data, setData] = useState<FilePayload | null>(null);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<{ item: FileItem; content: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextRoot = root, nextPath = path) => {
    try {
      setLoading(true);
      const next = await requestFiles(nextRoot, nextPath);
      setData(next);
      setRoot(next.root.id);
      setPath(next.path || "");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(root, path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shownItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = data?.items || [];
    if (!q) return items;
    return items.filter((item) => `${item.name} ${item.path} ${item.mime || ""}`.toLowerCase().includes(q));
  }, [data?.items, query]);

  async function openItem(item: FileItem) {
    if (item.kind === "directory") {
      setPreview(null);
      setPath(item.path);
      await load(root, item.path);
      return;
    }
    if (item.previewable) {
      try {
        const next = await requestPreview(root, item.path);
        if (next.ok && next.content !== undefined) setPreview({ item, content: next.content });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Preview unavailable");
      }
      return;
    }
    if (item.download_url) window.location.href = item.download_url;
  }

  function switchRoot(nextRoot: string) {
    setRoot(nextRoot);
    setPath("");
    setPreview(null);
    void load(nextRoot, "");
  }

  function goTo(nextPath: string) {
    setPath(nextPath);
    setPreview(null);
    void load(root, nextPath);
  }

  return (
    <div className="file-system-page scroll">
      <header className="fs-hero">
        <div>
          <span className="stub-tag">VPS FILE ACCESS</span>
          <div className="hero-title-with-help">
            <h1>File System</h1>
            <InfoTooltip label="About file access">Browse generated outputs, uploads, and Second Brain files directly from Mission Control. Download files without SSH/SFTP.</InfoTooltip>
          </div>
        </div>
        <button className="task-icon-action dark" aria-label="Refresh files" title="Refresh files" onClick={() => void load()} disabled={loading}>
          <Icon name="refresh" size={18} />
        </button>
      </header>

      <section className="fs-root-grid">
        {(data?.roots || []).map((item) => (
          <button key={item.id} className={"fs-root-card" + (root === item.id ? " on" : "")} onClick={() => switchRoot(item.id)}>
            <b>{item.label}</b>
            <span>{item.description}</span>
            <code>{item.path}</code>
          </button>
        ))}
      </section>

      <section className="fs-toolbar">
        <div className="fs-breadcrumbs" aria-label="Current folder">
          {(data?.breadcrumbs || [{ label: data?.root?.label || "Files", path: "" }]).map((crumb, index, arr) => (
            <button key={`${crumb.path}-${index}`} onClick={() => goTo(crumb.path)} className={index === arr.length - 1 ? "current" : ""}>
              {crumb.label}
            </button>
          ))}
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter current folder…" />
      </section>

      {error && <div className="task-error">{error}</div>}
      {loading && <div className="task-error">Loading files…</div>}

      <section className="fs-table-card">
        <div className="fs-table-head">
          <span>Name</span>
          <span>Type</span>
          <span>Size</span>
          <span>Updated</span>
          <span>Action</span>
        </div>
        {path && <button className="fs-row parent" onClick={() => goTo(data?.parent || "")}>
          <span><Icon name="chevronLeft" size={16} /> ..</span><span>folder</span><span>—</span><span>—</span><span>Open</span>
        </button>}
        {shownItems.map((item) => (
          <button key={`${item.kind}-${item.path}`} className="fs-row" onClick={() => void openItem(item)}>
            <span><Icon name={fileIcon(item) as any} size={17} /> <b>{item.name}</b></span>
            <span>{item.kind === "directory" ? "folder" : item.mime || item.extension || "file"}</span>
            <span>{item.kind === "directory" ? "—" : bytes(item.size)}</span>
            <span>{formatSingaporeTime(item.updated_at)}</span>
            <span>{item.kind === "directory" ? "Open" : item.previewable ? "Preview" : "Download"}</span>
          </button>
        ))}
        {!loading && shownItems.length === 0 && <div className="fs-empty">No files match this filter.</div>}
      </section>

      <footer className="fs-status">
        <span>{data?.summary ? `${data.summary.directories} folders · ${data.summary.files} files` : "—"}</span>
        <span>Read-only allowlist: outputs, uploads, Second Brain{(data?.roots || []).some((r) => r.id === "mission-control") ? ", HMC app files" : ""}</span>
      </footer>

      {preview && <div className="drawer-backdrop" onClick={() => setPreview(null)}>
        <aside className="brain-detail-drawer fs-preview-drawer" onClick={(event) => event.stopPropagation()}>
          <button className="drawer-close" onClick={() => setPreview(null)}>×</button>
          <span className="stub-tag">FILE PREVIEW</span>
          <h2>{preview.item.name}</h2>
          <div className="brain-detail-kv">
            <div><span>Size</span><b>{bytes(preview.item.size)}</b></div>
            <div><span>Updated</span><b>{formatSingaporeTime(preview.item.updated_at)}</b></div>
            <div><span>Type</span><b>{preview.item.mime || preview.item.extension || "file"}</b></div>
          </div>
          <label>Path</label><code>{preview.item.path}</code>
          <div className="fs-preview-actions">
            {preview.item.download_url && <a className="btn" href={preview.item.download_url}>Download</a>}
          </div>
          <label>Preview</label>
          <pre className="brain-preview">{preview.content}</pre>
        </aside>
      </div>}
    </div>
  );
}
