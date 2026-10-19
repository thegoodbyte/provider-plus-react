import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
export const workApi = {
  get: async (path = "") =>
    (await api.get(`/work-modes${path}`, { suppressGlobalError: true } as any))
      .data,
  post: async (path: string, body: any) =>
    (
      await api.post(`/work-modes${path}`, body, {
        suppressGlobalError: true,
      } as any)
    ).data,
};
export const workError = (error: any) => {
  const m = error?.response?.data?.message;
  return Array.isArray(m)
    ? m.join(". ")
    : m ||
        "Work could not be saved. Your position and draft have been kept. Retry or refresh.";
};
type Context = {
  data: any;
  active: boolean;
  error: string;
  refresh: () => Promise<void>;
  enter: (id?: string) => Promise<void>;
  exit: () => Promise<void>;
};
const empty: Context = {
  data: null,
  active: false,
  error: "",
  refresh: async () => {},
  enter: async () => {},
  exit: async () => {},
};
const WorkContext = createContext<Context>(empty);
export const useWorkMode = () => useContext(WorkContext);
export function WorkModeProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const owner =
    isAuthenticated && user?.role === "admin"
      ? String(user._id || user.id || user.email)
      : "";
  const latest = useRef(owner);
  latest.current = owner;
  const [state, setState] = useState<{
    owner: string;
    data: any;
    error: string;
  }>({ owner: "", data: null, error: "" });
  const load = useCallback(
    async (path?: string, body?: any) => {
      if (!owner) return;
      try {
        const data = path
          ? await workApi.post(path, body)
          : await workApi.get();
        if (latest.current === owner) setState({ owner, data, error: "" });
      } catch (e) {
        if (latest.current === owner)
          setState((s) => ({ ...s, owner, error: workError(e) }));
        if (path) throw e;
      }
    },
    [owner],
  );
  useEffect(() => {
    setState({ owner, data: null, error: "" });
    void load();
  }, [owner, load]);
  const data = owner && state.owner === owner ? state.data : null;
  return (
    <WorkContext.Provider
      value={{
        data,
        active: !!data?.workspace?.activeMode,
        error: state.owner === owner ? state.error : "",
        refresh: () => load(),
        enter: (id) =>
          load("/context", {
            action: "enter",
            mode: "medical",
            ...(id ? { sessionId: id } : {}),
          }),
        exit: () => load("/context", { action: "exit" }),
      }}
    >
      {children}
    </WorkContext.Provider>
  );
}
