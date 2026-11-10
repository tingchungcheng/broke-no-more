import type { SessionResponse } from "@broke-no-more/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { api, ApiClientError } from "@/lib/api";

type AuthContextValue = {
  me: SessionResponse | null;
  isLoading: boolean;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const response = await fetch("/api/v1/auth/me", { headers: { accept: "application/json" } });
      if (response.status === 401) return null;
      if (!response.ok) throw new Error("Could not load the current session.");
      return (await response.json()) as SessionResponse;
    },
  });

  const csrfToken = meQuery.data?.csrfToken;
  const callApi = useCallback(
    async function callApi<T>(path: string, options: RequestInit = {}): Promise<T> {
      try {
        return await api<T>(path, options, csrfToken);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          queryClient.setQueryData(["me"], null);
        }
        throw error;
      }
    },
    [csrfToken, queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      me: meQuery.data ?? null,
      isLoading: meQuery.isLoading,
      api: callApi,
      refresh: async () => {
        await meQuery.refetch();
      },
      signOut: async () => {
        await callApi("/auth/logout", { method: "POST" });
        queryClient.clear();
        queryClient.setQueryData(["me"], null);
      },
    }),
    [callApi, meQuery, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
