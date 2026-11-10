import { LogOut } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { safePicture } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const links = [
  { to: "/dashboard", label: "Overview" },
  { to: "/accounts", label: "Accounts" },
  { to: "/transactions", label: "Transactions" },
  { to: "/statements", label: "Statements" },
  { to: "/settings", label: "Settings" },
];

export function AppShell() {
  const { me, signOut } = useAuth();
  const picture = safePicture(me?.user.pictureUrl ?? null);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card/95">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <a href="/dashboard" className="font-serif text-2xl tracking-tight">
            Broke No More
          </a>
          <nav className="flex flex-wrap gap-1" aria-label="Primary">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn("rounded-full px-3 py-2 text-sm", isActive ? "bg-moss text-paper" : "text-ink hover:bg-ink/5")
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {picture ? <img src={picture} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" /> : null}
            <span className="text-sm">{me?.user.name}</span>
            <button type="button" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
