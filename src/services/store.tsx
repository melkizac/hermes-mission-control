import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Agent, Approval, ConfigFile, Skill, ViewKey } from "../types";
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
  send: (text: string) => Promise<void>;
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

  const send = useCallback(
    async (text: string) => {
      if (!selectedId || !text.trim()) return;
      const newMessages = await client.sendMessage(selectedId, text.trim());
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
    send,
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
