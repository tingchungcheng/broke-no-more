import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { LoginPage, loadAuthConfig } from "@/features/auth/login-page";
import { AccountsPage } from "@/features/accounts/accounts-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { OnboardingPage } from "@/features/onboarding/onboarding-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { StatementsPage } from "@/features/statements/statements-page";
import { TransactionsPage } from "@/features/transactions/transactions-page";
import { useAuth } from "@/hooks/use-auth";
import { api, ApiClientError } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

function FullPage({ children }: { children: string }) {
  return <p className="grid min-h-screen place-items-center px-4 text-sm text-muted">{children}</p>;
}

function RequireAuth() {
  const { me, isLoading } = useAuth();
  if (isLoading) return <FullPage>Checking your session…</FullPage>;
  if (!me) return <Navigate to="/login" replace />;
  return <AppShell />;
}

function LoginRoute() {
  const { me, isLoading, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const config = useQuery({ queryKey: ["auth-config"], queryFn: loadAuthConfig });

  if (isLoading || config.isLoading) return <FullPage>Loading sign-in…</FullPage>;
  if (me) return <Navigate to="/dashboard" replace />;

  return (
    <LoginPage
      googleAuthEnabled={config.data?.googleAuthEnabled ?? false}
      cognitoAuthEnabled={config.data?.cognitoAuthEnabled ?? false}
      devAuthEnabled={config.data?.devAuthEnabled ?? false}
      error={error}
      devLoginPending={pending}
      onDevLogin={(persona) => {
        setPending(true);
        setError(null);
        void api("/auth/dev-login", { method: "POST", body: JSON.stringify({ persona }) })
          .then(async () => {
            await queryClient.invalidateQueries({ queryKey: ["me"] });
            await refresh();
          })
          .catch((caught: unknown) => {
            setError(caught instanceof ApiClientError ? caught.code : "google_auth_failed");
            setPending(false);
          });
      }}
    />
  );
}

function NotFound() {
  return (
    <FullPage>That page is not part of this version.</FullPage>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/onboarding/accounts" element={<Navigate to="/accounts" replace />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/quick-add" element={<Navigate to="/transactions" replace />} />
        <Route path="/statements" element={<StatementsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/:section" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
