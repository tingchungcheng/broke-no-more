import { api } from "@/lib/api";

const loginErrors: Record<string, string> = {
  google_not_configured: "Google sign-in is not configured for this environment.",
  google_auth_failed: "Google sign-in did not finish. Try again.",
  sign_in_failed: "Sign-in did not finish. Try again.",
  access_denied: "Google sign-in was cancelled.",
  forbidden_origin: "This address cannot sign in. Open the app at http://localhost:5173.",
};

export function LoginPage({
  googleAuthEnabled,
  cognitoAuthEnabled = false,
  devAuthEnabled,
  error,
  onDevLogin,
  devLoginPending,
}: {
  googleAuthEnabled: boolean;
  cognitoAuthEnabled?: boolean;
  devAuthEnabled: boolean;
  error: string | null;
  onDevLogin: (persona: "alex" | "blair") => void;
  devLoginPending: boolean;
}) {
  const message = error ? (loginErrors[error] ?? "Sign-in did not finish. Try again.") : null;

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.1fr_0.9fr]">
      <section>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-moss">Personal ledger · Malaysia</p>
        <h1 className="mt-4 max-w-xl font-serif text-5xl leading-tight tracking-tight sm:text-6xl">Broke No More</h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
          A workspace for accounts and transactions you can trace. Arithmetic stays in the ledger. Google sign-in
          confirms your identity. Inbox access is a separate consent step, and this version does not ask for it.
        </p>
      </section>
      <section className="rounded-3xl border border-line bg-card p-6 shadow-[0_16px_40px_rgba(28,25,21,0.06)] sm:p-8">
        <h2 className="font-serif text-3xl">Sign in</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">One Google identity. One private workspace.</p>
        {message ? (
          <p className="mt-4 rounded-2xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {message}
          </p>
        ) : null}
        {googleAuthEnabled || cognitoAuthEnabled ? (
          <a
            href={cognitoAuthEnabled ? "/api/v1/auth/cognito" : "/api/v1/auth/google"}
            className="mt-6 flex h-12 items-center justify-center rounded-full bg-moss px-5 text-sm font-medium text-paper"
          >
            Continue with Google
          </a>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-line px-3 py-3 text-sm text-muted">
            Google sign-in is not configured yet. Add a Google OAuth client, or use the local development sign-in below.
          </p>
        )}
        {devAuthEnabled ? (
          <div className="mt-8 border-t border-line pt-6">
            <p className="text-sm font-medium">Local development</p>
            <p className="mt-1 text-sm text-muted">These personas exist only when dev sign-in is enabled. Production refuses them.</p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                className="h-11 rounded-full border border-line bg-paper text-sm font-medium"
                disabled={devLoginPending}
                onClick={() => onDevLogin("alex")}
              >
                Continue as Alex Tan
              </button>
              <button
                type="button"
                className="h-11 rounded-full border border-line bg-paper text-sm font-medium"
                disabled={devLoginPending}
                onClick={() => onDevLogin("blair")}
              >
                Continue as Blair Lim
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export async function loadAuthConfig(): Promise<{
  googleAuthEnabled: boolean;
  cognitoAuthEnabled: boolean;
  devAuthEnabled: boolean;
}> {
  return api("/auth/config");
}
