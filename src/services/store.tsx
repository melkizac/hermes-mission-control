import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Agent, Approval, Attachment, ConfigFile, ReplyContext, Skill, ViewKey } from "../types";
import type { HermesClient } from "./hermesClient";
import { HttpHermesClient } from "./httpHermesClient";

// Production Mission Control talks to the same authenticated origin.
const client: HermesClient = new HttpHermesClient();

interface StoreValue {
  agents: Agent[];
  approvals: Approval[];
  selectedId: string | null;
  selected: Agent | undefined;
  view: ViewKey;
  loading: boolean;
  setView: (v: ViewKey) => void;
  select: (id: string) => void;
  uploadAttachment: (file: File) => Promise<Attachment>;
  send: (text: string, attachments?: Attachment[], options?: { signal?: AbortSignal; requestId?: string; replyTo?: ReplyContext }) => Promise<void>;
  stopProcessing: (requestId?: string) => Promise<void>;
  refreshSelected: () => Promise<void>;
  createAgent: (i: { name: string; squad: string; model: string }) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  saveFile: (file: ConfigFile) => Promise<void>;
  addSkill: (skill: Skill) => Promise<void>;
  removeSkill: (skillId: string) => Promise<void>;
  resolveApproval: (id: string, decision: "approve" | "reject") => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewKey>("mission");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [a, ap] = await Promise.all([client.listAgents(), client.listApprovals()]);
    setAgents(a);
    setApprovals(ap);
    setSelectedId((cur) => cur ?? a[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = useMemo(
    () => agents.find((a) => a.id === selectedId),
    [agents, selectedId],
  );

  const select = useCallback((id: string) => setSelectedId(id), []);

  const uploadAttachment = useCallback(
    async (file: File) => {
      if (!selectedId) throw new Error("No agent selected");
      return client.uploadAttachment(selectedId, file);
    },
    [selectedId],
  );

  const send = useCallback(
    async (text: string, attachments: Attachment[] = [], options: { signal?: AbortSignal; requestId?: string; replyTo?: ReplyContext } = {}) => {
      if (!selectedId || (!text.trim() && attachments.length === 0)) return;
      const newMessages = await client.sendMessage(selectedId, text.trim(), attachments, options);
      setAgents((cur) =>
        cur.map((agent) =>
          agent.id === selectedId
            ? {
                ...agent,
                messages: [...agent.messages, ...newMessages],
                lastActive: "now",
                activity: "Mission Control conversation updated",
              }
            : agent,
        ),
      );
    },
    [selectedId],
  );

  const stopProcessing = useCallback(
    async (requestId?: string) => {
      if (!selectedId) return;
      await client.stopMessage(selectedId, requestId);
    },
    [selectedId],
  );

  const refreshSelected = useCallback(async () => {
    if (!selectedId) return;
    const updated = await client.getAgent(selectedId);
    if (!updated) return;
    setAgents((cur) => cur.map((agent) => (agent.id === selectedId ? updated : agent)));
  }, [selectedId]);

  const createAgent = useCallback(
    async (i: { name: string; squad: string; model: string }) => {
      const a = await client.createAgent(i);
      await refresh();
      setSelectedId(a.id);
    },
    [refresh],
  );

  const deleteAgent = useCallback(
    async (id: string) => {
      await client.deleteAgent(id);
      setSelectedId((cur) => (cur === id ? null : cur));
      await refresh();
    },
    [refresh],
  );

  const saveFile = useCallback(
    async (file: ConfigFile) => {
      if (!selectedId) return;
      await client.saveConfigFile(selectedId, file);
      await refresh();
    },
    [selectedId, refresh],
  );

  const addSkill = useCallback(
    async (skill: Skill) => {
      if (!selectedId) return;
      await client.addSkill(selectedId, skill);
      await refresh();
    },
    [selectedId, refresh],
  );

  const removeSkill = useCallback(
    async (skillId: string) => {
      if (!selectedId) return;
      await client.removeSkill(selectedId, skillId);
      await refresh();
    },
    [selectedId, refresh],
  );

  const resolveApproval = useCallback(
    async (id: string, decision: "approve" | "reject") => {
      await client.resolveApproval(id, decision);
      await refresh();
    },
    [refresh],
  );

  const value: StoreValue = {
    agents,
    approvals,
    selectedId,
    selected,
    view,
    loading,
    setView,
    select,
    uploadAttachment,
    send,
    stopProcessing,
    refreshSelected,
    createAgent,
    deleteAgent,
    saveFile,
    addSkill,
    removeSkill,
    resolveApproval,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
