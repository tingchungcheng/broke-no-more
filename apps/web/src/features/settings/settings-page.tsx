import { NavLink, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
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
  const { me } = useAuth();

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
              Gmail is {me?.gmailConnected ? "connected" : "not connected"}. Sign-in and mailbox access are separate.
              This version does not start a Gmail consent flow, and it does not store a mailbox token.
            </p>
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
