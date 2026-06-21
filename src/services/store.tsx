import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Agent, AgentRuntimeAssignment, AgentRuntimeSwitcher, Approval, Attachment, CapabilityAssignmentMutationResponse, CapabilityMatrixResponse, ConfigFile, Message, MissionControlMe, ModelRoutingSelection, ReplyContext, RouterConfig, Skill, ViewKey } from "../types";
import type { UiPermissions } from "./uiPermissions";
import { adminOnlyViews, canAccessView, permissionsForRole, safeDefaultViewForRole } from "./uiPermissions";
import type { HermesClient } from "./hermesClient";
import { HttpHermesClient } from "./httpHermesClient";
import { initialDeepLinkTarget, parseMissionControlDeepLink, type MissionControlDeepLinkTarget } from "./deepLinks";
import { cachedJsonRequest } from "./queryCache";

type UiMode = "workspace" | "expert" | "admin";
const defaultViewForUiMode = (mode: UiMode): ViewKey => mode === "admin" ? "settings" : mode === "expert" ? "agent-org" : "mission";

// Production Mission Control talks to the same authenticated origin.
const client: HermesClient = new HttpHermesClient();

function mergeMessages(existing: Agent["messages"], incoming: Agent["messages"]) {
  const merged = [...existing, ...incoming];
  const byId = new Map<string, Message>();
  for (const message of merged) {
    byId.set(String(message.id), message);
  }
  return Array.from(byId.values());
}

interface StoreValue {
  agents: Agent[];
  approvals: Approval[];
  selectedId: string | null;
  selected: Agent | undefined;
  view: ViewKey;
  uiMode: UiMode;
  me: MissionControlMe | null;
  permissions: UiPermissions;
  loading: boolean;
  setView: (v: ViewKey) => void;
  applyDeepLinkTarget: (target: MissionControlDeepLinkTarget) => void;
  setUiMode: (mode: UiMode) => void;
  select: (id: string) => void;
  uploadAttachment: (file: File) => Promise<Attachment>;
  uploadAttachmentToAgent: (agentId: string, file: File) => Promise<Attachment>;
  send: (text: string, attachments?: Attachment[], options?: { signal?: AbortSignal; requestId?: string; replyTo?: ReplyContext; modelRouting?: ModelRoutingSelection }) => Promise<Message[]>;
  sendToAgent: (agentId: string, text: string, attachments?: Attachment[], options?: { signal?: AbortSignal; requestId?: string; replyTo?: ReplyContext; modelRouting?: ModelRoutingSelection }) => Promise<Message[]>;
  getModelRouter: () => Promise<RouterConfig>;
  getAgentRuntimes: () => Promise<AgentRuntimeSwitcher>;
  saveAgentRuntime: (agentId: string, input: AgentRuntimeAssignment) => Promise<AgentRuntimeSwitcher>;
  stopProcessing: (requestId?: string) => Promise<void>;
  stopProcessingForAgent: (agentId: string, requestId?: string) => Promise<void>;
  refreshSelected: () => Promise<void>;
  refreshAgent: (agentId: string) => Promise<void>;
  createAgent: (i: { name: string; squad: string; model: string }) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  saveFile: (file: ConfigFile) => Promise<void>;
  addSkill: (skill: Skill) => Promise<void>;
  removeSkill: (skillId: string) => Promise<void>;
  getCapabilityMatrix: (filters?: { agent?: string; agentId?: string; q?: string; type?: string; status?: string; risk?: string; health?: string; assigned?: string }) => Promise<CapabilityMatrixResponse>;
  assignCapability: (capabilityId: string, input: { agentId: string; agent?: Record<string, unknown>; reason?: string }) => Promise<CapabilityAssignmentMutationResponse>;
  unassignCapability: (capabilityId: string, input: { agentId: string; agent?: Record<string, unknown>; reason?: string }) => Promise<CapabilityAssignmentMutationResponse>;
  resolveApproval: (id: string, decision: "approve" | "reject") => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const startingDeepLink = initialDeepLinkTarget();
  const startingPath = window.location.pathname.replace(/\/$/, "") || "/";
  const startsInAdmin = startingPath === "/admin";
  const [agents, setAgents] = useState<Agent[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setRawView] = useState<ViewKey>(startingDeepLink.view ?? (startsInAdmin ? "settings" : "mission"));
  const [uiMode, setRawUiMode] = useState<UiMode>(startsInAdmin || (startingDeepLink.view && adminOnlyViews.has(startingDeepLink.view)) ? "admin" : "workspace");
  const [me, setMe] = useState<MissionControlMe | null>(null);
  const [loading, setLoading] = useState(true);

  const accountRole = me?.user?.role;
  const effectiveRole = accountRole === "admin" && uiMode === "admin" ? "admin" : accountRole === "admin" ? "user" : accountRole;
  const permissions = useMemo(() => permissionsForRole(effectiveRole, accountRole), [effectiveRole, accountRole]);

  const setView = useCallback((next: ViewKey) => {
    if (accountRole === "admin" && adminOnlyViews.has(next)) {
      setRawUiMode("admin");
      setRawView(next);
      return;
    }
    setRawView((current) => {
      if (canAccessView(effectiveRole, next)) return next;
      return canAccessView(effectiveRole, current) ? current : safeDefaultViewForRole(effectiveRole);
    });
  }, [accountRole, effectiveRole]);

  const setUiMode = useCallback((mode: UiMode) => {
    setRawUiMode(mode);
    setRawView(defaultViewForUiMode(mode));
  }, []);

  const refresh = useCallback(async () => {
    const nextMe = await client.getMe();
    setMe(nextMe);
    const nextAccountRole = nextMe?.user?.role;
    const nextRole = nextAccountRole === "admin" && uiMode === "admin" ? "admin" : nextAccountRole === "admin" ? "user" : nextAccountRole;
    setRawView((next) => canAccessView(nextRole, next) ? next : safeDefaultViewForRole(nextRole));
    setLoading(false);
    window.setTimeout(() => {
      void client.listAgents()
        .then((a) => {
          setAgents((cur) => {
            const detailedById = new Map(cur.filter((agent) => agent.detailLoaded).map((agent) => [agent.id, agent]));
            return a.map((agent) => ({ ...agent, ...(detailedById.get(agent.id) ?? {}) }));
          });
          setSelectedId((cur) => cur ?? a[0]?.id ?? null);
        })
        .catch(() => undefined);
    }, 250);
    window.setTimeout(() => {
      void client.listApprovals().then(setApprovals).catch(() => setApprovals([]));
    }, 1000);
  }, [uiMode]);

  useLayoutEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = useMemo(
    () => agents.find((a) => a.id === selectedId),
    [agents, selectedId],
  );

  const select = useCallback((id: string) => setSelectedId(id), []);

  useEffect(() => {
    if (!selectedId) return;
    const current = agents.find((agent) => agent.id === selectedId);
    if (!current || current.detailLoaded) return;
    let alive = true;
    void client.getAgent(selectedId)
      .then((detail) => {
        if (!alive || !detail) return;
        setAgents((cur) => cur.map((agent) => (agent.id === selectedId ? { ...agent, ...detail, detailLoaded: true } : agent)));
      })
      .catch(() => {
        // Keep the lightweight roster usable; detail errors surface on explicit refresh/send paths.
      });
    return () => {
      alive = false;
    };
  }, [agents, selectedId]);

  const applyDeepLinkTarget = useCallback((target: MissionControlDeepLinkTarget) => {
    if (target.view) setView(target.view);
    if (target.agentId) setSelectedId(target.agentId);
  }, [setView]);

  useLayoutEffect(() => {
    const target = parseMissionControlDeepLink(window.location);
    if (target.agentId) setSelectedId(target.agentId);
    // The initial view is already seeded from initialDeepLinkTarget() above.
    // Do not re-apply target.view here before /api/me has loaded; doing so
    // evaluates admin-only URLs without the account role and falls back to Chat.
    // Popstate navigation is still handled by Shell.
  }, []);

  const uploadAttachmentToAgent = useCallback(
    async (agentId: string, file: File) => {
      if (!agentId) throw new Error("No agent selected");
      return client.uploadAttachment(agentId, file);
    },
    [],
  );

  const uploadAttachment = useCallback(
    async (file: File) => {
      if (!selectedId) throw new Error("No agent selected");
      return uploadAttachmentToAgent(selectedId, file);
    },
    [selectedId, uploadAttachmentToAgent],
  );

  const sendToAgent = useCallback(
    async (agentId: string, text: string, attachments: Attachment[] = [], options: { signal?: AbortSignal; requestId?: string; replyTo?: ReplyContext; modelRouting?: ModelRoutingSelection } = {}) => {
      if (!agentId || (!text.trim() && attachments.length === 0)) return [];
      const requestId = options.requestId ?? `ui-${agentId}-${Date.now()}`;
      const optimisticUserMessage: Message = {
        id: `pending-${requestId}`,
        role: "user",
        text: text.trim(),
        attachments,
        replyTo: options.replyTo,
        at: "just now",
        ts: Date.now() / 1000,
        source: "web-ui",
        requestId,
      };
      setAgents((cur) =>
        cur.map((agent) =>
          agent.id === agentId
            ? {
                ...agent,
                status: "active",
                activityState: "active",
                statusLabel: "Active",
                statusDetail: "Mission Control request is processing.",
                activity: "Processing Mission Control message",
                lastActive: "now",
                messages: mergeMessages(agent.messages, [optimisticUserMessage]),
                processingRequests: requestId
                  ? Array.from(new Set([...(agent.processingRequests ?? []), requestId]))
                  : agent.processingRequests,
                processingRequestDetails: requestId
                  ? [
                      ...(agent.processingRequestDetails ?? []).filter((item) => item.id !== requestId),
                      { id: requestId, agent_id: agentId, started_at: Date.now() / 1000 },
                    ]
                  : agent.processingRequestDetails,
              }
            : agent,
        ),
      );
      try {
        const newMessages = await client.sendMessage(agentId, text.trim(), attachments, { ...options, requestId });
        setAgents((cur) =>
          cur.map((agent) =>
            agent.id === agentId
              ? {
                  ...agent,
                  messages: mergeMessages(agent.messages.filter((message) => message.id !== optimisticUserMessage.id), newMessages),
                  status: "active",
                  activityState: "active",
                  statusLabel: "Active",
                  statusDetail: "Recent Mission Control chat activity; agent remains active for 15 minutes after the latest chat.",
                  lastActive: "now",
                  activity: "Mission Control conversation updated",
                  processingRequests: requestId ? (agent.processingRequests ?? []).filter((id) => id !== requestId) : agent.processingRequests,
                  processingRequestDetails: requestId
                    ? (agent.processingRequestDetails ?? []).filter((item) => item.id !== requestId)
                    : agent.processingRequestDetails,
                }
              : agent,
          ),
        );
        return newMessages;
      } catch (err) {
        setAgents((cur) =>
          cur.map((agent) =>
            agent.id === agentId
              ? {
                  ...agent,
                  messages: agent.messages.filter((message) => message.id !== optimisticUserMessage.id),
                  processingRequests: requestId ? (agent.processingRequests ?? []).filter((id) => id !== requestId) : agent.processingRequests,
                  processingRequestDetails: requestId
                    ? (agent.processingRequestDetails ?? []).filter((item) => item.id !== requestId)
                    : agent.processingRequestDetails,
                }
              : agent,
          ),
        );
        throw err;
      }
    },
    [],
  );

  const send = useCallback(
    async (text: string, attachments: Attachment[] = [], options: { signal?: AbortSignal; requestId?: string; replyTo?: ReplyContext; modelRouting?: ModelRoutingSelection } = {}) => {
      if (!selectedId) return [];
      return sendToAgent(selectedId, text, attachments, options);
    },
    [selectedId, sendToAgent],
  );

  const stopProcessingForAgent = useCallback(
    async (agentId: string, requestId?: string) => {
      if (!agentId) return;
      await client.stopMessage(agentId, requestId);
    },
    [],
  );

  const stopProcessing = useCallback(
    async (requestId?: string) => {
      if (!selectedId) return;
      await stopProcessingForAgent(selectedId, requestId);
    },
    [selectedId, stopProcessingForAgent],
  );

  const getModelRouter = useCallback(() => cachedJsonRequest("chat-page:model-router", () => client.getModelRouter(), { staleAfterMs: 60_000 }), []);
  const getAgentRuntimes = useCallback(() => client.getAgentRuntimes(), []);
  const saveAgentRuntime = useCallback((agentId: string, input: AgentRuntimeAssignment) => client.saveAgentRuntime(agentId, input), []);

  const refreshAgent = useCallback(async (agentId: string) => {
    if (!agentId) return;
    const updated = await client.getAgent(agentId);
    if (!updated) return;
    setAgents((cur) => {
      const exists = cur.some((agent) => agent.id === agentId);
      if (!exists) return [updated, ...cur];
      return cur.map((agent) => (agent.id === agentId ? { ...agent, ...updated, detailLoaded: true } : agent));
    });
  }, []);

  const refreshSelected = useCallback(async () => {
    if (!selectedId) return;
    await refreshAgent(selectedId);
  }, [selectedId, refreshAgent]);

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

  const getCapabilityMatrix = useCallback((filters?: { agent?: string; agentId?: string; q?: string; type?: string; status?: string; risk?: string; health?: string; assigned?: string }) => client.getCapabilityMatrix(filters), []);

  const assignCapability = useCallback(
    async (capabilityId: string, input: { agentId: string; agent?: Record<string, unknown>; reason?: string }) => {
      const result = await client.assignCapability(capabilityId, input);
      await refresh();
      return result;
    },
    [refresh],
  );

  const unassignCapability = useCallback(
    async (capabilityId: string, input: { agentId: string; agent?: Record<string, unknown>; reason?: string }) => {
      const result = await client.unassignCapability(capabilityId, input);
      await refresh();
      return result;
    },
    [refresh],
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
    uiMode,
    me,
    permissions,
    loading,
    setView,
    applyDeepLinkTarget,
    setUiMode,
    select,
    uploadAttachment,
    uploadAttachmentToAgent,
    send,
    sendToAgent,
    getModelRouter,
    getAgentRuntimes,
    saveAgentRuntime,
    stopProcessing,
    stopProcessingForAgent,
    refreshSelected,
    refreshAgent,
    createAgent,
    deleteAgent,
    saveFile,
    addSkill,
    removeSkill,
    getCapabilityMatrix,
    assignCapability,
    unassignCapability,
    resolveApproval,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
