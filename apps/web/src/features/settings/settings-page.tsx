import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadAuthConfig } from "@/features/auth/login-page";
import { useAuth } from "@/hooks/use-auth";
import { ApiClientError } from "@/lib/api";
import { cn } from "@/lib/utils";

const sections = [
  { id: "profile", label: "Profile" },
  { id: "connections", label: "Connections" },
  { id: "privacy", label: "Privacy" },
  { id: "data", label: "Data" },
];

export function SettingsPage() {
  const params = useParams();
  const section = sections.some((item) => item.id === params.section) ? params.section : "profile";
  const { me, api, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const config = useQuery({ queryKey: ["auth-config"], queryFn: loadAuthConfig });
  const gmailError = searchParams.get("error");

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav className="flex flex-wrap gap-2 lg:flex-col" aria-label="Settings">
        {sections.map((item) => (
          <NavLink
            key={item.id}
            to={`/settings/${item.id}`}
            className={() =>
              cn("rounded-full px-3 py-2 text-sm", section === item.id ? "bg-moss text-paper" : "bg-card text-ink")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Card>
        {section === "profile" ? (
          <>
            <h1 className="font-serif text-3xl">Profile</h1>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted">Name</dt>
                <dd>{me?.user.name}</dd>
              </div>
              <div>
                <dt className="text-muted">Email</dt>
                <dd>{me?.user.email}</dd>
              </div>
            </dl>
          </>
        ) : null}
        {section === "connections" ? (
          <>
            <h1 className="font-serif text-3xl">Connections</h1>
            <p className="mt-3 leading-relaxed text-muted">
              Gmail is {me?.gmailConnected ? "connected" : "not connected"}. Sign-in and mailbox access stay separate.
              The only scope requested here is read-only Gmail. Statement search is not turned on yet.
            </p>
            {gmailError === "gmail_not_configured" ? (
              <p className="mt-4 text-sm text-danger" role="alert">
                Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and TOKEN_ENCRYPTION_KEY on the API. Register the redirect
                URI http://localhost:5173/api/v1/gmail/callback on that Google client.
              </p>
            ) : null}
            {gmailError === "gmail_denied" ? (
              <p className="mt-4 text-sm text-danger" role="alert">
                Gmail access was cancelled.
              </p>
            ) : null}
            {gmailError === "gmail_auth_failed" ? (
              <p className="mt-4 text-sm text-danger" role="alert">
                Gmail connection did not finish. Try again from http://localhost:5173 so the return address matches.
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              {me?.gmailConnected ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void api("/gmail/disconnect", { method: "POST" })
                      .then(async () => {
                        await queryClient.invalidateQueries({ queryKey: ["me"] });
                        await refresh();
                      })
                      .catch((caught: unknown) => {
                        window.alert(caught instanceof ApiClientError ? caught.message : "Could not disconnect Gmail.");
                      });
                  }}
                >
                  Disconnect Gmail
                </Button>
              ) : config.data?.gmailConnectEnabled ? (
                <a
                  href="/api/v1/gmail/connect"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-moss px-5 text-sm font-medium text-paper"
                >
                  Connect Gmail
                </a>
              ) : (
                <p className="text-sm text-muted">
                  Connect Gmail appears after the API has a Google OAuth client and a token encryption key.
                </p>
              )}
            </div>
          </>
        ) : null}
        {section === "privacy" ? (
          <>
            <h1 className="font-serif text-3xl">Privacy</h1>
            <p className="mt-3 leading-relaxed text-muted">
              The session cookie is HttpOnly. Requests that change data must come from this app and include the token
              issued with your session. Every account, transaction, statement, and sync job is looked up with your user
              id from that session.
            </p>
          </>
        ) : null}
        {section === "data" ? (
          <>
            <h1 className="font-serif text-3xl">Data</h1>
            <p className="mt-3 leading-relaxed text-muted">
              You can remove an account, which also removes the transactions on it. A full export and workspace deletion
              flow is not in this version.
            </p>
          </>
        ) : null}
      </Card>
    </div>
  );
}
