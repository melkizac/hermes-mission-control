import { useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import type { ConfigFile } from "../types";

export function FileEditorDrawer({ file, onClose, onSave }: { file: ConfigFile; onClose: () => void; onSave?: (file: ConfigFile) => Promise<void> }) {
  const { saveFile } = useStore();
  const [content, setContent] = useState(file.content);
  const [saving, setSaving] = useState(false);
  const dirty = content !== file.content;

  const save = async () => {
    setSaving(true);
    await (onSave ? onSave({ ...file, content }) : saveFile({ ...file, content }));
    setSaving(false);
    onClose();
  };

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="fn" style={{ fontSize: 14 }}>
              {file.name}
            </div>
            <div className="fd">{file.label}</div>
          </div>
          <button className="iconbtn" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <textarea
          className="editor"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
        />
        <div className="drawer-foot">
          <span className="fd">
            {content.length} bytes {dirty ? "· unsaved changes" : ""}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn dark" disabled={!dirty || saving} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
